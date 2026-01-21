import os

class Config:
    # 数据库配置
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "root")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_NAME = os.getenv("DB_NAME", "nextweb")

    # asyncmy 连接字符串
    DATABASE_URL = f"mysql+asyncmy://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

    # 路径配置
    OUTPUT_DIR = os.getenv("OUTPUT_DIR", "/app/output/news")
    CONFIG_DIR = os.getenv("CONFIG_DIR", "/app/config")
    STATIC_DIR = os.getenv("STATIC_DIR", "/app/static")
    AUDIO_DIR = os.path.join(STATIC_DIR, "audio")

    # 功能开关
    ENABLE_AUTO_CLEANUP = os.getenv("ENABLE_AUTO_CLEANUP", "False").lower() == "true"

    # 认证密钥
    SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-it")

config = Config()
