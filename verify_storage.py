import os
import sys
import boto3
from botocore.exceptions import ClientError

def verify_storage():
    """
    验证 S3/R2 兼容存储配置是否正确，并测试上传与公开访问权限
    """
    print("=" * 60)
    print("🔍 正在验证对象存储 (S3/R2) 配置...")
    print("=" * 60)

    # 1. 检查环境变量
    required_vars = ["S3_BUCKET_NAME", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_ENDPOINT_URL"]
    missing_vars = [var for var in required_vars if not os.environ.get(var)]

    if missing_vars:
        print(f"❌ 错误: 缺少以下必须的环境变量: {', '.join(missing_vars)}")
        return False

    bucket_name = os.environ["S3_BUCKET_NAME"]
    endpoint_url = os.environ["S3_ENDPOINT_URL"]
    access_key = os.environ["S3_ACCESS_KEY_ID"]
    secret_key = os.environ["S3_SECRET_ACCESS_KEY"]
    region = os.environ.get("S3_REGION", "auto")

    print(f"配置检查:")
    print(f"  - Bucket: {bucket_name}")
    print(f"  - Endpoint: {endpoint_url}")
    print(f"  - Region: {region}")

    # 2. 初始化客户端
    try:
        s3 = boto3.client(
            's3',
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region
        )
    except Exception as e:
        print(f"❌ 错误: 无法初始化 S3 客户端: {e}")
        return False

    # 3. 测试上传
    test_filename = "trendradar_verify.txt"
    test_content = "Hello from TrendRadar! Storage configuration is working."
    object_key = f"verification/{test_filename}"

    try:
        print(f"🚀 正在尝试上传测试文件到: {object_key} ...")
        s3.put_object(
            Bucket=bucket_name,
            Key=object_key,
            Body=test_content,
            ContentType="text/plain"
        )
        print("✅ 上传成功！")
    except ClientError as e:
        print(f"❌ 上传失败: {e}")
        print("💡 提示: 请检查 Access Key/Secret Key 是否正确，以及是否有 Write 权限。")
        return False
    except Exception as e:
        print(f"❌ 上传发生未知错误: {e}")
        return False

    # 4. 生成/推测公开访问链接
    print("\n🌍 正在推测公开访问链接...")

    # 简单的 URL 构造逻辑 (适配常见服务商)
    public_url = ""

    # Cloudflare R2 / AWS S3
    if endpoint_url.endswith(".r2.cloudflarestorage.com"):
        # R2 需要绑定自定义域名或开启 r2.dev
        print("💡 检测到 Cloudflare R2。")
        print("⚠️ 注意: R2 默认不公开。请确保你已在 R2 设置中开启了 'R2.dev subdomain' 或绑定了自定义域名。")
        # 这里无法自动获知自定义域名，只能提示用户
        print("❓ 如果你开启了 R2.dev，链接可能类似于: https://pub-<hash>.r2.dev/verification/trendradar_verify.txt")
    elif "aliyuncs.com" in endpoint_url:
        # 阿里云 OSS
        # endpoint: https://oss-cn-hangzhou.aliyuncs.com
        # url: https://bucket-name.oss-cn-hangzhou.aliyuncs.com/key
        base_domain = endpoint_url.replace("https://", "").replace("http://", "")
        public_url = f"https://{bucket_name}.{base_domain}/{object_key}"
    elif "myqcloud.com" in endpoint_url:
        # 腾讯云 COS
        public_url = f"{endpoint_url}/{object_key}"
    else:
        # 通用 S3 尝试
        if endpoint_url.endswith("/"):
            public_url = f"{endpoint_url}{bucket_name}/{object_key}"
        else:
            public_url = f"{endpoint_url}/{bucket_name}/{object_key}"

    if public_url:
        print(f"推测链接: {public_url}")
        print("👉 请手动在浏览器中打开此链接。如果能看到 'Hello from TrendRadar!'，则配置完美！")
        print("⚠️ 如果无法打开（403 Forbidden），说明 Bucket 权限不是公开读 (Public Read)，飞书可能无法播放音频。")
    else:
        print("⚠️ 无法自动推测公开链接，请登录云存储控制台查看文件是否可访问。")

    return True

if __name__ == "__main__":
    success = verify_storage()
    if not success:
        sys.exit(1)
