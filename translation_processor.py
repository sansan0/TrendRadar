#!/usr/bin/env python3
"""
## Thuật toán xử lý và dịch file - Phiên bản tối ưu

### Bước 1: Đọc và phân tách nội dung
- Đọc toàn bộ nội dung file `a.txt`
- Tách nội dung thành các phần dựa trên dòng trống (`\n\n`)
- Kết quả: Danh sách các chunk độc lập (toutiao, baidu, wallstreetcn-hot)

### Bước 2: Xử lý và chuẩn bị dữ liệu
Với mỗi chunk:
1. **Parse cấu trúc:**
   - Tách tiêu đề (dòng đầu)
   - Tách từng mục: số thứ tự, nội dung tiếng Trung, URL
   - Lưu mapping: `chunk_id → {số_thứ_tự → URL}`

2. **Chuẩn bị batch dịch:**
   - Gom tất cả text tiếng Trung của chunk (giữ số thứ tự)
   - Tạo prompt request cho chunk đó

### Bước 3: Xử lý bất đồng bộ với rate limiting

**Cấu hình:**
- Pool: 10 worker threads/coroutines
- Rate limiter: 1 request/6 giây (10 req/phút)
- Retry strategy với fallback

**Flow xử lý:**

1. **Queue Manager:**
   - Tạo queue chứa tất cả chunk cần dịch
   - Mỗi chunk có metadata: `{id, content, retry_count, model_version}`

2. **Worker Pool (10 workers):**
   ```
   Mỗi worker:
   - Lấy chunk từ queue
   - Chờ rate limiter cho phép (6s từ request cuối)
   - Gọi API với model hiện tại
   - Xử lý response hoặc error
   ```

3. **Rate Limiter:**
   - Dùng semaphore hoặc token bucket
   - Track thời gian request cuối
   - Enforce delay 6s giữa các request

4. **Error Handling & Fallback:**
   ```
   Try gemini-2.5-flash:
     - Success → lưu kết quả
     - Error 429 → trigger cooldown
     - Other errors → retry với fallback
   
   On Error 429:
     - Pause tất cả workers 60s
     - Switch sang gemini-2.0-flash cho chunk đó
     - Resume processing
   
   Fallback to gemini-2.0-flash:
     - Retry chunk với model mới
     - Nếu vẫn lỗi → log và skip hoặc retry sau
   ```

### Bước 4: Synchronization & Result Collection

1. **Result Collector:**
   - Dictionary/Map: `chunk_id → translated_result`
   - Thread-safe write operations
   - Track completion status

2. **Progress Tracking:**
   - Counter: completed/total chunks
   - Error log: failed chunks với reason
   - Retry queue cho chunks thất bại

### Bước 5: Post-processing & Assembly

1. **Khi tất cả chunks hoàn thành:**
   - Sort results theo thứ tự gốc
   - Với mỗi chunk đã dịch:
     - Parse kết quả dịch
     - Map lại URL theo số thứ tự
     - Format: `số. text_việt [URL:original]`

2. **Final assembly:**
   - Join các chunks với `\n\n`
   - Validate format
   - Ghi file output

### Bước 6: Monitoring & Optimization

**Metrics cần track:**
- Request rate (đảm bảo ≤ 10/phút)
- Success/failure ratio per model
- Average response time
- Queue depth

**Optimization strategies:**
1. **Dynamic rate adjustment:**
   - Nếu nhiều lỗi 429 → giảm rate xuống 8 req/phút
   - Nếu stable → có thể tăng lên 9-10 req/phút

2. **Smart fallback:**
   - Track model performance
   - Ưu tiên model ổn định hơn cho retry

3. **Batch sizing:**
   - Nếu chunk quá lớn → chia nhỏ
   - Nếu quá nhỏ → gộp chunks

### Error Recovery Plan

1. **Partial failure:**
   - Lưu chunks đã dịch thành công
   - Retry chỉ chunks failed
   - Option: manual review cho chunks lỗi

2. **Complete failure:**
   - Serialize queue state
   - Resume từ checkpoint khi khởi động lại

3. **Graceful degradation:**
   - Nếu cả 2 model đều fail → mark chunk as "untranslated"
   - Vẫn output file với phần đã dịch

### Cấu trúc dữ liệu chính

```
ChunkState:
  - id: string
  - status: pending|processing|completed|failed
  - model: gemini-2.5-flash|gemini-2.0-flash
  - retry_count: int
  - content: string
  - result: string|null
  - error: string|null

RateLimiter:
  - last_request_time: timestamp
  - request_interval: 6000ms
  - cooldown_until: timestamp|null

WorkerPool:
  - workers: List[Worker]
  - queue: Queue[ChunkState]
  - results: Map[id, result]
  - rate_limiter: RateLimiter
```

### Ưu điểm của thiết kế

1. **Resilient:** Tự động recover từ lỗi
2. **Efficient:** Tận dụng tối đa rate limit
3. **Scalable:** Dễ điều chỉnh số worker
4. **Monitorable:** Track được mọi metrics
5. **Resumable:** Có thể pause/resume
6. **Flexible:** Dễ thêm model mới làm fallback
"""
import asyncio
import time
import re
import json
import logging
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
from queue import Queue
from pathlib import Path
from threading import Lock, Semaphore, Thread
from concurrent.futures import ThreadPoolExecutor
import requests
from datetime import datetime
import urllib.parse


def html_escape(text: str) -> str:
    """HTML转义"""
    if not isinstance(text, str):
        text = str(text)

    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#x27;")
    )

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(threadName)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ChunkStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class ChunkState:
    id: str
    content: str
    status: ChunkStatus = ChunkStatus.PENDING
    model: str = "gemini-2.5-flash"
    retry_count: int = 0
    result: Optional[str] = None
    error: Optional[str] = None
    url_mapping: Dict[str, str] = field(default_factory=dict)


@dataclass
class RateLimiter:
    request_interval: float = 6.0  # 6 seconds between requests (10 req/min)
    last_request_time: float = 0.0
    cooldown_until: float = 0.0
    lock: Lock = field(default_factory=Lock)

    def acquire(self):
        with self.lock:
            current_time = time.time()

            # Check if we're in cooldown period
            if current_time < self.cooldown_until:
                sleep_time = self.cooldown_until - current_time
                logger.info(f"Rate limiter in cooldown, sleeping for {sleep_time:.2f}s")
                time.sleep(sleep_time)

            # Enforce rate limit
            elapsed = current_time - self.last_request_time
            if elapsed < self.request_interval:
                sleep_time = self.request_interval - elapsed
                logger.debug(f"Rate limiter sleeping for {sleep_time:.2f}s")
                time.sleep(sleep_time)

            self.last_request_time = time.time()

    def initiate_cooldown(self, duration: float = 60.0):
        """Initiate cooldown for all workers"""
        with self.lock:
            self.cooldown_until = time.time() + duration
            logger.info(f"Initiated cooldown for {duration} seconds")


class TranslationProcessor:
    """Main processor for handling file translation with rate limiting and fallback mechanisms"""
    
    def __init__(self, api_key: str, max_workers: int = 10):
        self.api_key = api_key
        self.max_workers = max_workers
        self.rate_limiter = RateLimiter()
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.results_lock = Lock()
        self.results: Dict[str, ChunkState] = {}
        self.completed_count = 0
        self.total_chunks = 0
        self.failed_chunks = []
        
    def read_and_split_file(self, file_path: str) -> List[str]:
        """Đọc file và phân tách thành các chunks dựa trên dòng trống"""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Tách thành các chunks dựa trên dòng trống
        chunks = [chunk.strip() for chunk in content.split('\n\n') if chunk.strip()]
        logger.info(f"Found {len(chunks)} chunks to process")
        return chunks
    
    def parse_chunk_structure(self, chunk: str) -> Tuple[str, List[Tuple[str, str, str]]]:
        """
        Parse chunk structure to extract:
        - Title (first line)
        - List of (number, chinese_text, url)
        """
        lines = chunk.split('\n')
        if not lines:
            return "", []
        
        title = lines[0].strip()
        items = []
        
        for line in lines[1:]:
            line = line.strip()
            if not line:
                continue
                
            # Try to parse: number. chinese_text [URL:original_url]
            match = re.match(r'^(\d+)\.\s*(.*?)\s*\[URL:(.*?)\]$', line)
            if match:
                number, text, url = match.groups()
                items.append((number, text.strip(), url.strip()))
            else:
                # Alternative pattern: number. chinese_text
                match = re.match(r'^(\d+)\.\s*(.*)$', line)
                if match:
                    number, text = match.groups()
                    items.append((number, text.strip(), ""))
        
        return title, items
    
    def prepare_translation_batch(self, chunk_id: str, items: List[Tuple[str, str, str]]) -> Tuple[str, Dict[str, str]]:
        """
        Prepare batch for translation and create URL mapping
        Returns: (batch_content, url_mapping)
        """
        batch_lines = []
        url_mapping = {}
        
        for number, text, url in items:
            batch_lines.append(f"{number}. {text}")
            if url:
                url_mapping[number] = url
        
        batch_content = '\n'.join(batch_lines)
        return batch_content, url_mapping
    
    def translate_with_gemini(self, text: str, model: str = "gemini-2.5-flash") -> str:
        """Call Gemini API to translate text"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"

        payload = {
            "contents": [{
                "parts": [{
                    "text": f"Please translate the following Chinese text to Vietnamese, preserving the numbering and format:\n\n{text}\n\nOnly return the translated content, no additional text."
                }]
            }]
        }

        headers = {
            "Content-Type": "application/json"
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)

            if response.status_code == 429:
                logger.warning(f"Rate limit exceeded for model {model}")
                raise requests.HTTPError("Rate limit exceeded", response=response)
            elif response.status_code != 200:
                response.raise_for_status()

            result = response.json()
            translated_text = result['candidates'][0]['content']['parts'][0]['text']
            return translated_text.strip()

        except requests.RequestException as e:
            logger.error(f"API request failed for model {model}: {e}")
            raise
        except (KeyError, IndexError) as e:
            logger.error(f"Unexpected API response format for model {model}: {e}")
            raise
    
    def process_chunk(self, chunk_state: ChunkState) -> ChunkState:
        """Process a single chunk with error handling and fallback"""
        try:
            # Acquire rate limiter
            self.rate_limiter.acquire()

            logger.info(f"Processing chunk {chunk_state.id} with model {chunk_state.model}")

            # Parse and prepare for translation
            title, items = self.parse_chunk_structure(chunk_state.content)
            batch_content, url_mapping = self.prepare_translation_batch(chunk_state.id, items)

            # Store URL mapping
            chunk_state.url_mapping = url_mapping

            # Translate
            translated_content = self.translate_with_gemini(batch_content, chunk_state.model)

            # Process the translated content to match format
            translated_items = self.format_translated_result(translated_content, url_mapping)
            final_result = f"{title}\n" + translated_items

            chunk_state.status = ChunkStatus.COMPLETED
            chunk_state.result = final_result

            logger.info(f"Successfully processed chunk {chunk_state.id}")

        except requests.HTTPError as e:
            if e.response.status_code == 429:
                # Handle rate limit - pause only this worker for 60s
                logger.warning(f"Rate limit hit for model {chunk_state.model}, pausing this worker for 60s for chunk {chunk_state.id}")
                time.sleep(60)

                # If currently using gemini-2.5-flash, fallback to gemini-2.0-flash
                if chunk_state.model == "gemini-2.5-flash":
                    chunk_state.model = "gemini-2.0-flash"
                    chunk_state.retry_count = 0  # Reset retry count for new model
                    logger.info(f"Falling back to gemini-2.0-flash for chunk {chunk_state.id}")
                    return self.process_chunk(chunk_state)
                else:
                    # If already on gemini-2.0-flash and it failed again, initiate cooldown and retry
                    logger.warning(f"gemini-2.0-flash also failed, initiating cooldown for all workers")
                    self.rate_limiter.initiate_cooldown(60.0)
                    # Retry gemini-2.0-flash up to 2 more times (total of 3 attempts: original + 2 retries)
                    if chunk_state.retry_count < 2:  # Allow 2 more retries after the first failure
                        chunk_state.retry_count += 1
                        logger.info(f"Retrying gemini-2.0-flash for chunk {chunk_state.id}, attempt {chunk_state.retry_count + 1}/3")
                        return self.process_chunk(chunk_state)

            chunk_state.status = ChunkStatus.FAILED
            chunk_state.error = f"HTTP {e.response.status_code}: {str(e)}"

        except Exception as e:
            logger.error(f"Error processing chunk {chunk_state.id}: {e}")
            chunk_state.status = ChunkStatus.FAILED
            chunk_state.error = str(e)

            # Retry with fallback model if not already tried
            if chunk_state.model != "gemini-2.0-flash" and chunk_state.retry_count < 1:
                chunk_state.model = "gemini-2.0-flash"
                chunk_state.retry_count = 0  # Reset retry count for new model
                logger.info(f"Retrying with fallback model for chunk {chunk_state.id}")
                return self.process_chunk(chunk_state)
            elif chunk_state.model == "gemini-2.0-flash" and chunk_state.retry_count < 2:
                # If already using gemini-2.0-flash and still failing, retry up to 2 more times
                chunk_state.retry_count += 1
                logger.info(f"Retrying gemini-2.0-flash for chunk {chunk_state.id} after general error, attempt {chunk_state.retry_count + 1}/3")
                return self.process_chunk(chunk_state)

        # Update results
        with self.results_lock:
            self.results[chunk_state.id] = chunk_state
            if chunk_state.status == ChunkStatus.COMPLETED:
                self.completed_count += 1
            else:
                self.failed_chunks.append(chunk_state.id)

        return chunk_state

    def format_translated_result(self, translated_text: str, url_mapping: Dict[str, str]) -> str:
        """
        Format translated text by adding back URL mappings
        """
        lines = translated_text.split('\n')
        formatted_lines = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Extract number from the line
            match = re.match(r'^(\d+)\.\s*(.*)$', line)
            if match:
                number, text = match.groups()
                if number in url_mapping:
                    formatted_line = f"{number}. {text.strip()} [URL:{url_mapping[number]}]"
                else:
                    formatted_line = f"{number}. {text.strip()}"
                formatted_lines.append(formatted_line)
            else:
                formatted_lines.append(line)

        return '\n'.join(formatted_lines)

    def process_all_chunks(self, file_path: str, output_path: str) -> bool:
        """Main method to process all chunks with parallel execution"""
        logger.info("Starting file translation process...")
        
        # Step 1: Read and split file
        chunks = self.read_and_split_file(file_path)
        self.total_chunks = len(chunks)
        
        if not chunks:
            logger.warning("No chunks found in file")
            return False
        
        # Step 2: Create chunk states
        chunk_queue = Queue()
        for i, chunk_content in enumerate(chunks):
            chunk_id = f"chunk_{i:03d}"
            chunk_state = ChunkState(
                id=chunk_id,
                content=chunk_content
            )
            chunk_queue.put(chunk_state)
        
        logger.info(f"Created {self.total_chunks} chunks to process")
        
        # Step 3: Process chunks with thread pool
        futures = []
        for _ in range(min(self.max_workers, len(chunks))):
            future = self.executor.submit(self._process_queue_worker, chunk_queue)
            futures.append(future)
        
        # Wait for all workers to complete
        for future in futures:
            future.result()
        
        # Step 4: Assemble results
        success_count = sum(1 for state in self.results.values() if state.status == ChunkStatus.COMPLETED)
        logger.info(f"Processing completed: {success_count}/{self.total_chunks} chunks successful")
        
        if self.failed_chunks:
            logger.warning(f"Failed chunks: {self.failed_chunks}")
        
        # Step 5: Write output files (both txt and html)
        self.write_output_files(output_path)

        # Step 6: Print metrics
        self.print_metrics()

        return success_count > 0
    
    def _process_queue_worker(self, chunk_queue: Queue):
        """Worker function to process chunks from the queue"""
        while not chunk_queue.empty():
            try:
                chunk_state = chunk_queue.get_nowait()
                self.process_chunk(chunk_state)
            except Exception as e:
                logger.error(f"Worker error: {e}")
    
    def write_output_files(self, output_path: str):
        """Write final results to both txt and html output files"""
        # Extract directory and filename
        output_file_path = Path(output_path)
        directory = output_file_path.parent
        base_filename = output_file_path.stem

        # Create output for txt file
        txt_content = ""
        sorted_results = sorted(self.results.items(), key=lambda x: int(x[0].split('_')[1]))

        for chunk_id, chunk_state in sorted_results:
            if chunk_state.status == ChunkStatus.COMPLETED and chunk_state.result:
                txt_content += chunk_state.result
                txt_content += '\n\n'

        # Write txt file
        txt_file_path = output_file_path
        with open(txt_file_path, 'w', encoding='utf-8') as f:
            f.write(txt_content.strip())

        logger.info(f"TXT output written to {txt_file_path}")

        # Generate and write html file
        html_file_path = directory / f"{base_filename}.html"
        html_content = self.generate_html_content(sorted_results)

        with open(html_file_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

        logger.info(f"HTML output written to {html_file_path}")

    def generate_html_content(self, sorted_results) -> str:
        """Generate HTML content from sorted results"""
        # Parse the translated content to extract platform information
        html_parts = []

        for chunk_id, chunk_state in sorted_results:
            if chunk_state.status == ChunkStatus.COMPLETED and chunk_state.result:
                # Split the result by lines to extract title and news items
                lines = chunk_state.result.strip().split('\n')
                if not lines:
                    continue

                # First line is the platform title
                platform_title = lines[0].strip()

                # Process the news items
                news_items = []
                for line in lines[1:]:
                    line = line.strip()
                    if not line:
                        continue

                    # Parse: "1. News title [URL:https://example.com]"
                    import re
                    match = re.match(r'^(\d+)\.\s*(.*?)\s*(\[.*?\])?$', line)
                    if match:
                        number, title, url_part = match.groups()
                        url = ""
                        if url_part and 'URL:' in url_part:
                            # Extract URL from [URL:https://example.com]
                            url_match = re.search(r'URL:(.*?)\]', url_part)
                            if url_match:
                                url = url_match.group(1)

                        news_items.append({
                            'number': number,
                            'title': title.strip(),
                            'url': url
                        })

                # Create HTML structure for this platform
                platform_html = self.create_platform_html(platform_title, news_items)
                html_parts.append(platform_html)

        # Combine all parts into a complete HTML document
        complete_html = self.wrap_html_content('\n'.join(html_parts))
        return complete_html

    def create_platform_html(self, platform_title: str, news_items: List[Dict]) -> str:
        """Create HTML structure for a single platform"""
        items_html = []
        for item in news_items:
            url_html = ""
            if item['url']:
                url_html = f' <a href="{html_escape(item["url"])}" class="news-link" target="_blank">🔗</a>'

            item_html = f"""
            <div class="news-item">
                <div class="news-number">{html_escape(item['number'])}</div>
                <div class="news-content">
                    <div class="news-title">{html_escape(item['title'])}{url_html}</div>
                </div>
            </div>
            """
            items_html.append(item_html.strip())

        platform_html = f"""
        <div class="word-group">
            <div class="word-header">
                <div class="word-info">
                    <span class="word-name">{html_escape(platform_title)}</span>
                </div>
            </div>
            <div class="news-list">
                {''.join(items_html)}
            </div>
        </div>
        """

        return platform_html.strip()

    def wrap_html_content(self, content: str) -> str:
        """Wrap content in complete HTML document structure"""
        return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Translated News Report</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            margin: 0;
            padding: 16px;
            background: #fafafa;
            color: #333;
            line-height: 1.5;
        }}

        .container {{
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 16px rgba(0,0,0,0.06);
        }}

        .header {{
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            padding: 24px;
            text-align: center;
        }}

        .header-title {{
            font-size: 20px;
            font-weight: 700;
            margin: 0;
        }}

        .content {{
            padding: 24px;
        }}

        .word-group {{
            margin-bottom: 40px;
        }}

        .word-header {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid #f0f0f0;
        }}

        .word-info {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}

        .word-name {{
            font-size: 17px;
            font-weight: 600;
            color: #1a1a1a;
        }}

        .news-item {{
            margin-bottom: 16px;
            padding: 12px 0;
            border-bottom: 1px solid #f5f5f5;
            position: relative;
            display: flex;
            gap: 12px;
            align-items: flex-start;
        }}

        .news-item:last-child {{
            border-bottom: none;
        }}

        .news-number {{
            color: #999;
            font-size: 13px;
            font-weight: 600;
            min-width: 20px;
            text-align: center;
            flex-shrink: 0;
            background: #f8f9fa;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            align-self: flex-start;
            margin-top: 4px;
        }}

        .news-content {{
            flex: 1;
            min-width: 0;
        }}

        .news-title {{
            font-size: 15px;
            line-height: 1.4;
            color: #1a1a1a;
            margin: 0;
        }}

        .news-link {{
            color: #2563eb;
            text-decoration: none;
            margin-left: 8px;
        }}

        .news-link:hover {{
            text-decoration: underline;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="header-title">Translated News Report</h1>
        </div>
        <div class="content">
            {content}
        </div>
    </div>
</body>
</html>"""
    
    def print_metrics(self):
        """Print processing metrics"""
        success_count = sum(1 for state in self.results.values() if state.status == ChunkStatus.COMPLETED)
        failure_count = len(self.failed_chunks)
        
        print("\n=== Processing Metrics ===")
        print(f"Total chunks: {self.total_chunks}")
        print(f"Successful: {success_count}")
        print(f"Failed: {failure_count}")
        print(f"Success rate: {(success_count/self.total_chunks)*100:.2f}%")
        
        if self.failed_chunks:
            print(f"Failed chunk IDs: {', '.join(self.failed_chunks)}")


def main():
    """Main entry point"""
    import sys
    import os

    if len(sys.argv) < 3:
        print("Usage: python translation_processor.py <input_file> <output_file> [api_key]")
        print("If API key not provided, will try to read from GEMINI_API_KEY environment variable")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    # Get API key from argument or environment
    api_key = sys.argv[3] if len(sys.argv) > 3 else os.getenv("GEMINI_API_KEY")

    if not api_key:
        print("Error: API key not provided and GEMINI_API_KEY environment variable not set")
        sys.exit(1)

    # Create processor and run
    processor = TranslationProcessor(api_key=api_key)
    success = processor.process_all_chunks(input_file, output_file)

    if success:
        print("Translation completed successfully!")
        return 0
    else:
        print("Translation failed!")
        return 1


if __name__ == "__main__":
    main()