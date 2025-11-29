# Hướng Dẫn Thiết Lập Bảo Mật cho TrendRadar

## Tổng Quan

Dự án TrendRadar đã được cập nhật để bảo mật thông tin kết nối MongoDB. Trước đây, chuỗi kết nối MongoDB (MongoDB URI) được lưu trực tiếp trong mã nguồn, tạo ra lỗ hổng bảo mật. Bây giờ, ứng dụng sử dụng biến môi trường để lưu trữ thông tin nhạy cảm.

## Những Thay Đổi

1. **Trong mã nguồn (`mongo_uploader.py`)**:
   - Loại bỏ chuỗi kết nối MongoDB hardcode
   - Sử dụng biến môi trường `MONGODB_URI` để lấy thông tin kết nối
   - Nếu không có URI được cung cấp, ứng dụng sẽ bỏ qua việc upload lên MongoDB

2. **Trong GitHub Actions workflow (`.github/workflows/crawler.yml`)**:
   - Thêm biến môi trường `MONGODB_URI` từ GitHub Secrets
   - Thêm các biến `MONGODB_DB_NAME` và `MONGODB_COLLECTION` từ GitHub Variables

## Cách Thiết Lập GitHub Secrets và Variables

### 1. Thiết Lập GitHub Secrets

GitHub Secrets được sử dụng để lưu trữ thông tin nhạy cảm như mật khẩu, khóa API, URI cơ sở dữ liệu.

**Các Secrets cần thiết lập:**

- `MONGODB_URI`: Chuỗi kết nối MongoDB của bạn
  - Ví dụ: `mongodb+srv://username:password@cluster0.example.mongodb.net/?retryWrites=true&w=majority`

**Cách thiết lập:**

1. Truy cập repository của bạn trên GitHub
2. Chọn tab **Settings**
3. Trong menu bên trái, chọn **Secrets and variables** > **Actions**
4. Chọn **New repository secret**
5. Thêm các secret sau:

| Name | Description | Example |
|------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://myuser:mypassword@cluster0.example.mongodb.net/?retryWrites=true&w=majority` |

### 2. Thiết Lập GitHub Variables

GitHub Variables được sử dụng để lưu trữ thông tin không nhạy cảm nhưng vẫn cần được cấu hình.

**Các Variables cần thiết lập:**

- `MONGODB_DB_NAME`: Tên database (mặc định là `trendradar`)
- `MONGODB_COLLECTION`: Tên collection (mặc định là `china_news`)

**Cách thiết lập:**

1. Truy cập repository của bạn trên GitHub
2. Chọn tab **Settings**
3. Trong menu bên trái, chọn **Secrets and variables** > **Actions**
4. Chọn tab **Variables**
5. Chọn **New repository variable**
6. Thêm các variable sau:

| Name | Description | Default Value |
|------|-------------|---------------|
| `MONGODB_DB_NAME` | Tên database MongoDB | `trendradar` |
| `MONGODB_COLLECTION` | Tên collection MongoDB | `china_news` |

## Cấu Trúc MongoDB URI

Cấu trúc của MongoDB URI thường có dạng:

```
mongodb+srv://username:password@cluster-name.project.mongodb.net/database_name?retryWrites=true&w=majority
```

**Lưu ý quan trọng:**
- Không bao giờ commit chuỗi kết nối MongoDB trực tiếp vào mã nguồn
- Luôn sử dụng GitHub Secrets để lưu trữ thông tin xác thực
- Đảm bảo rằng tài khoản MongoDB có đủ quyền để đọc/ghi dữ liệu vào database và collection tương ứng

## Kiểm Tra Cấu Hình

Sau khi thiết lập Secrets và Variables, hãy kiểm tra bằng cách chạy lại GitHub Actions workflow:

1. Truy cập tab **Actions** trong repository
2. Chọn workflow **Hot News Crawler**
3. Chọn **Run workflow** để chạy thủ công
4. Kiểm tra logs để đảm bảo không có lỗi liên quan đến MongoDB

## Xử Lý Sự Cố

### Workflow báo lỗi "MONGODB_URI not provided"

- Kiểm tra lại xem bạn đã thêm secret `MONGODB_URI` trong GitHub Secrets chưa
- Đảm bảo tên secret được viết đúng chính tả (phân biệt chữ hoa/chữ thường)

### Không thể kết nối đến MongoDB

- Kiểm tra lại chuỗi kết nối trong GitHub Secrets
- Đảm bảo rằng IP của GitHub Actions được cho phép truy cập MongoDB (nếu có thiết lập IP whitelist)
- Kiểm tra xem tài khoản MongoDB có đủ quyền hạn cần thiết không

## Bảo Mật Tốt Nhất

1. **Sử dụng tài khoản MongoDB riêng biệt** cho ứng dụng với quyền hạn hạn chế
2. **Thường xuyên thay đổi mật khẩu** cho tài khoản MongoDB
3. **Giám sát truy cập** vào cơ sở dữ liệu
4. **Không chia sẻ GitHub Secrets** với người khác
5. **Sử dụng branch protection** để ngăn chặn việc xem secrets trong các pull request

## Cập Nhật Từ Phiên Bản Cũ

Nếu bạn đang cập nhật từ phiên bản cũ của TrendRadar:

1. Xóa bất kỳ chuỗi kết nối MongoDB nào được lưu trong code
2. Thiết lập GitHub Secrets và Variables như hướng dẫn trên
3. Cập nhật workflow file nếu cần
4. Kiểm tra lại toàn bộ quá trình

## Liên Hệ Hỗ Trợ

Nếu bạn gặp bất kỳ vấn đề nào trong quá trình thiết lập, vui lòng tạo issue trong repository để được hỗ trợ.