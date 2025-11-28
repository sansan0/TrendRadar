import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Union, Optional

import pytz

DEFAULT_MONGO_URI = (
    "mongodb+srv://lethanhson9901:WCUf7zMeNpxZhCl8@cluster0.wbloa.mongodb.net/"
    "?retryWrites=true&w=majority"
)


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


def upload_translated_file_to_mongo(
    translated_file_path: Union[str, Path],
    mongo_db_uri: Optional[str] = None,
    db_name: Optional[str] = None,
    collection_name: Optional[str] = None,
) -> int:
    """
    Upload translated news results to MongoDB.

    Returns number of inserted documents (0 on failure or no data).
    """
    try:
        from pymongo import MongoClient
        from pymongo.errors import ConfigurationError, PyMongoError
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

    mongo_uri = mongo_db_uri or os.environ.get("MONGODB_URI") or DEFAULT_MONGO_URI
    target_db_name = db_name or os.environ.get("MONGODB_DB_NAME") or "trendradar"
    target_collection = (
        collection_name or os.environ.get("MONGODB_COLLECTION") or "china_news"
    )

    now = datetime.now(pytz.timezone("Asia/Shanghai"))
    docs: List[Dict] = []

    for source_id, titles in titles_by_id.items():
        source_name = id_to_name.get(source_id, source_id)
        for title, data in titles.items():
            docs.append(
                {
                    "source_id": source_id,
                    "source_name": source_name,
                    "title": title,
                    "url": data.get("url", ""),
                    "mobile_url": data.get("mobileUrl", ""),
                    "ranks": data.get("ranks", []),
                    "translated_at": now,
                    "date": now.strftime("%Y-%m-%d"),
                }
            )

    if not docs:
        print(f"No translated news documents to upload from {path}")
        return 0

    inserted_count = 0
    client = None
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        try:
            default_db = client.get_default_database()
        except ConfigurationError:
            default_db = None

        db = default_db or client[target_db_name]
        result = db[target_collection].insert_many(docs)
        inserted_count = len(result.inserted_ids)
        print(
            f"Uploaded {inserted_count} translated news items to MongoDB "
            f"({db.name}.{target_collection})"
        )
    except PyMongoError as e:
        print(f"MongoDB upload failed: {e}")
    finally:
        if client:
            client.close()

    return inserted_count
