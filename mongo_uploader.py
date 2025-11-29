# coding=utf-8
import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple, Union, Optional

import pytz

# Giá trị mặc định là None nếu không có biến môi trường
DEFAULT_MONGO_URI = None

def _clean_title(title: str) -> str:
    """Normalize whitespace inside titles."""
    if not isinstance(title, str):
        title = str(title)
    cleaned = title.replace("\n", " ").replace("\r", " ")
    return re.sub(r"\s+", " ", cleaned).strip()


def _parse_translated_file(file_path: Path) -> Tuple[Dict, Dict]:
    """
    Parse a translated txt file into a structure similar to parse_file_titles.
    Returns (titles_by_id, id_to_name).
    """
    titles_by_id: Dict[str, Dict] = {}
    id_to_name: Dict[str, str] = {}

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        sections = content.split("\n\n")

        for section in sections:
            if not section.strip() or "==== 以下ID请求失败 ====" in section:
                continue

            lines = [line for line in section.strip().split("\n") if line.strip()]
            if len(lines) < 2:
                continue

            header_line = lines[0].strip()
            if " | " in header_line:
                source_id, source_name = header_line.split(" | ", 1)
                source_id, source_name = source_id.strip(), source_name.strip()
            else:
                source_id = source_name = header_line

            id_to_name[source_id] = source_name
            titles_by_id[source_id] = {}

            for line in lines[1:]:
                try:
                    title_part = line.strip()
                    rank = None

                    if ". " in title_part and title_part.split(". ")[0].isdigit():
                        rank_str, title_part = title_part.split(". ", 1)
                        rank = int(rank_str)

                    mobile_url = ""
                    if " [MOBILE:" in title_part:
                        title_part, mobile_part = title_part.rsplit(" [MOBILE:", 1)
                        if mobile_part.endswith("]"):
                            mobile_url = mobile_part[:-1]

                    url = ""
                    if " [URL:" in title_part:
                        title_part, url_part = title_part.rsplit(" [URL:", 1)
                        if url_part.endswith("]"):
                            url = url_part[:-1]

                    title = _clean_title(title_part)
                    ranks = [rank] if rank is not None else []

                    titles_by_id[source_id][title] = {
                        "ranks": ranks,
                        "url": url,
                        "mobileUrl": mobile_url,
                    }
                except Exception:
                    # Skip malformed lines to avoid breaking the whole upload
                    continue

    return titles_by_id, id_to_name


def _ensure_unique_index(collection, index_key):
    """Tạo index duy nhất trên collection nếu chưa tồn tại."""
    from pymongo import errors
    try:
        # Kiểm tra xem index đã tồn tại chưa
        existing_indexes = collection.index_information()
        index_name = f"{index_key[0][0]}_1_{index_key[1][0]}_1_{index_key[2][0]}_1"
        if index_name not in existing_indexes:
            # Tạo index duy nhất
            collection.create_index(index_key, unique=True)
            print(f"Đã tạo index duy nhất: {index_key}")
        else:
            print(f"Index duy nhất đã tồn tại: {index_key}")
    except errors.DuplicateKeyError as e:
        print(f"Cảnh báo: Có dữ liệu trùng trong DB trước khi tạo index: {e}")
        # Nếu có dữ liệu trùng, cần xử lý (xóa/xác nhận) trước khi tạo index
        # Trong thực tế, bạn có thể cần thêm logic xử lý tại đây, nhưng để đơn giản, ta bỏ qua lỗi nếu index đã tồn tại.
        # Tuy nhiên, điều này *chỉ* nên xảy ra nếu bạn chắc chắn không có dữ liệu trùng từ trước.
        # Nếu có thể có, bạn nên gọi một hàm dọn dẹp dữ liệu trùng trước (xem bên dưới)
    except Exception as e:
        print(f"Lỗi khi tạo index duy nhất: {e}")


def _cleanup_old_records(collection, days_to_keep: int = 30):
    """Xóa các bản ghi cũ hơn số ngày quy định."""
    from pymongo.errors import PyMongoError
    now = datetime.now(pytz.timezone("Asia/Shanghai"))
    cutoff_date = now - timedelta(days=days_to_keep)

    try:
        result = collection.delete_many({"translated_at": {"$lt": cutoff_date}})
        if result.deleted_count > 0:
            print(f"Đã xóa {result.deleted_count} bản ghi cũ hơn {days_to_keep} ngày.")
        else:
            print(f"Không có bản ghi nào cũ hơn {days_to_keep} ngày để xóa.")
    except PyMongoError as e:
        print(f"Lỗi khi xóa bản ghi cũ: {e}")


def upload_translated_file_to_mongo(
    translated_file_path: Union[str, Path],
    mongo_db_uri: Optional[str] = None,
    db_name: Optional[str] = None,
    collection_name: Optional[str] = None,
) -> int:
    """
    Upload translated news results to MongoDB using upsert to avoid duplicates.
    Also, automatically cleans up old records older than 30 days.

    Returns number of inserted/updated documents.
    """
    try:
        from pymongo import MongoClient
        from pymongo.errors import ConfigurationError, PyMongoError, DuplicateKeyError
    except ImportError:
        print("pymongo is not installed, skip MongoDB upload")
        return 0

    path = Path(translated_file_path)
    if not path.exists():
        print(f"Translated file not found: {path}")
        return 0

    titles_by_id, id_to_name = _parse_translated_file(path)
    if not titles_by_id:
        print(f"No translated news parsed from {path}")
        return 0

    # Cấu hình DB
    mongo_uri = mongo_db_uri or os.environ.get("MONGODB_URI") or DEFAULT_MONGO_URI
    
    # Kiểm tra nếu không có MongoDB URI, thì bỏ qua việc upload
    if not mongo_uri:
        print("MONGODB_URI not provided. Skipping MongoDB upload.")
        return 0
        
    target_db_name = db_name or os.environ.get("MONGODB_DB_NAME") or "trendradar"
    target_collection_name = collection_name or os.environ.get("MONGODB_COLLECTION") or "china_news"

    now = datetime.now(pytz.timezone("Asia/Shanghai"))
    docs_to_upsert: List[Dict] = []

    for source_id, titles in titles_by_id.items():
        source_name = id_to_name.get(source_id, source_id)
        for title, data in titles.items():
            # Dùng title làm unique key cùng với source_id và date
            # Nếu url là duy nhất hơn, bạn có thể dùng url thay cho title
            doc = {
                "source_id": source_id,
                "source_name": source_name,
                "title": title,
                "url": data.get("url", ""),
                "mobile_url": data.get("mobileUrl", ""),
                "ranks": data.get("ranks", []), # Có thể cần logic thêm rank nếu đã tồn tại
                "translated_at": now,
                "date": now.strftime("%Y-%m-%d"),
            }
            docs_to_upsert.append(doc)

    if not docs_to_upsert:
        print(f"No translated news documents to upload from {path}")
        return 0

    upserted_count = 0
    client = None
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        try:
            default_db = client.get_default_database()
        except ConfigurationError:
            default_db = None

        db = default_db or client[target_db_name]
        collection = db[target_collection_name]

        # 1. Đảm bảo index duy nhất tồn tại để tránh trùng lặp
        # Sử dụng (source_id, title, date) làm unique key
        _ensure_unique_index(collection, [("source_id", 1), ("title", 1), ("date", 1)])

        # 2. Xóa dữ liệu cũ hơn 30 ngày
        _cleanup_old_records(collection, days_to_keep=30)

        # 3. Thực hiện upsert cho từng document
        # Với index duy nhất, việc upsert sẽ thay thế nếu đã tồn tại.
        # Tuy nhiên, nếu bạn muốn *cập nhật* mảng ranks (thêm rank mới vào nếu đã có rồi),
        # thì cần logic phức tạp hơn một chút. Hiện tại, script này sẽ ghi đè ranks mới.
        for doc in docs_to_upsert:
            # Điều kiện tìm kiếm duy nhất
            filter_condition = {
                "source_id": doc["source_id"],
                "title": doc["title"],
                "date": doc["date"],
            }
            # Dữ liệu để upsert (nếu không tìm thấy) hoặc cập nhật (nếu tìm thấy)
            # Ghi đè toàn bộ các trường trừ `_id`
            # Nếu bạn muốn giữ lại `translated_at` cũ nếu đã tồn tại và chỉ cập nhật rank, bạn cần logic khác.
            # Ví dụ: update = {"$set": doc, "$addToSet": {"ranks": {"$each": doc["ranks"]}}}
            # Nhưng nếu schema `ranks` là rank tại thời điểm crawl, thì ghi đè là hợp lý hơn.
            result = collection.replace_one(filter_condition, doc, upsert=True)
            if result.upserted_id or result.modified_count > 0:
                upserted_count += 1

        print(f"Uploaded/Updated {upserted_count} translated news items to MongoDB "
              f"({db.name}.{collection.name}) using upsert.")

    except PyMongoError as e:
        print(f"MongoDB operation failed: {e}")
    finally:
        if client:
            client.close()

    return upserted_count