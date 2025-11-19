# 📚 Hướng Dẫn Cài Đặt TrendRadar Chi Tiết

> **Phiên bản**: v3.0.5  
> **Cập nhật**: 19/11/2025  
> **Thời gian hoàn thành**: ~10 phút

## 📋 Mục Lục

1. [Tổng Quan](#-tổng-quan)
2. [Chuẩn Bị](#-chuẩn-bị)
3. [Bước 1: Cấu Hình GitHub Secrets](#-bước-1-cấu-hình-github-secrets)
4. [Bước 2: Cấu Hình Từ Khóa Lọc Tin](#-bước-2-cấu-hình-từ-khóa-lọc-tin)
5. [Bước 3: Bật GitHub Pages](#-bước-3-bật-github-pages)
6. [Bước 4: Cấu Hình GitHub Actions](#-bước-4-cấu-hình-github-actions)
7. [Bước 5: Chạy Thử Nghiệm](#-bước-5-chạy-thử-nghiệm)
8. [Xác Minh Kết Quả](#-xác-minh-kết-quả)
9. [Tùy Chỉnh Nâng Cao](#-tùy-chỉnh-nâng-cao)
10. [Xử Lý Sự Cố](#-xử-lý-sự-cố)

---

## 🎯 Tổng Quan

### TrendRadar là gì?

TrendRadar là hệ thống tự động thu thập và phân tích tin tức xu hướng từ 11 nền tảng lớn:
- 🇨🇳 Zhihu (知乎), Weibo (微博), Douyin (抖音), Bilibili
- 📰 Baidu, Toutiao, Thepaper, Ifeng, Tieba
- 💼 Wallstreetcn, Yicai

### Bạn sẽ nhận được gì?

1. **Email thông báo** - Báo cáo đẹp mắt gửi thẳng vào hộp thư
2. **GitHub Pages** - Trang web hiển thị tin tức, có thể xem trên điện thoại
3. **Tự động hóa** - Chạy mỗi giờ, không cần can thiệp

### Luồng hoạt động

```
[GitHub Actions] ──► [Thu thập tin từ 11 nền tảng] 
                              │
                              ▼
                     [Lọc theo từ khóa]
                              │
                              ▼
                ┌─────────────┴──────────────┐
                │                            │
                ▼                            ▼
          [Gửi Email]                 [Deploy Web]
```

---

## 🛠️ Chuẩn Bị

### Yêu cầu

- ✅ Tài khoản GitHub (đã fork dự án này)
- ✅ Tài khoản Email (Gmail, Outlook, QQ Mail, v.v.)
- ⏱️ 10 phút thời gian

### Lấy App Password cho Email

> ⚠️ **QUAN TRỌNG**: Bạn cần **App Password** (mật khẩu ứng dụng), KHÔNG phải mật khẩu đăng nhập thông thường!

#### Gmail

1. Truy cập: https://myaccount.google.com/apppasswords
2. **Lưu ý**: Phải bật xác thực 2 bước (2FA) trước
3. Chọn app: "Mail", device: "Other" (nhập "TrendRadar")
4. Click "Generate" → Copy mật khẩu 16 ký tự (dạng: `xxxx xxxx xxxx xxxx`)

#### Outlook/Hotmail

1. Truy cập: https://account.live.com/proofs/AppPassword
2. Đăng nhập và click "Create a new app password"
3. Copy mật khẩu hiển thị

#### QQ Mail (QQ邮箱)

1. Đăng nhập QQ Mail → Settings (设置)
2. Account (账户) → POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务
3. Click "Generate authorization code" (生成授权码)
4. Làm theo hướng dẫn xác minh (gửi SMS)
5. Copy mã授权码

#### 163/126 Mail

1. Đăng nhập → Settings → POP3/SMTP/IMAP
2. Enable IMAP/SMTP service
3. Set authorization password (mật khẩu ủy quyền)

---

## 🔐 Bước 1: Cấu Hình GitHub Secrets

Secrets là nơi lưu trữ thông tin nhạy cảm (email, mật khẩu) một cách an toàn trên GitHub.

### 1.1. Mở trang Secrets

1. Vào repository đã fork: `https://github.com/[your-username]/TrendRadar`
2. Click **Settings** (⚙️ biểu tượng ở menu trên)
3. Sidebar trái → **Secrets and variables** → **Actions**
4. Click nút **"New repository secret"** (màu xanh lá)

### 1.2. Thêm Secrets

> ⚠️ **Lưu ý quan trọng**:
> - Mỗi secret phải tạo riêng (click "New repository secret" 3 lần)
> - **Name** phải CHÍNH XÁC như bên dưới (phân biệt chữ hoa/thường)
> - Copy-paste Name để tránh lỗi chính tả
> - Sau khi Save, bạn sẽ KHÔNG thấy lại giá trị Secret (bình thường)

#### Secret #1: EMAIL_FROM

```
Name:   EMAIL_FROM
Secret: your-email@gmail.com
```

**Giải thích**: Email gửi thông báo

**Ví dụ**:
- `nguyenvana@gmail.com`
- `user123@outlook.com`
- `1234567890@qq.com`

---

#### Secret #2: EMAIL_PASSWORD

```
Name:   EMAIL_PASSWORD
Secret: xxxx xxxx xxxx xxxx
```

**Giải thích**: App Password vừa lấy ở phần [Chuẩn Bị](#lấy-app-password-cho-email)

**Ví dụ Gmail**:
```
abcd efgh ijkl mnop
```

**Ví dụ QQ Mail**:
```
授权码16kýtự
```

> 💡 **Tip**: Paste nguyên cả dấu cách, GitHub sẽ tự xử lý

---

#### Secret #3: EMAIL_TO

```
Name:   EMAIL_TO
Secret: recipient@gmail.com
```

**Giải thích**: Email nhận thông báo

**Các trường hợp**:
- **Gửi cho chính mình**: Điền giống `EMAIL_FROM`
  ```
  nguồn: nguyenvana@gmail.com
  đích:   nguyenvana@gmail.com
  ```

- **Gửi cho nhiều người**: Phân cách bằng dấu phẩy
  ```
  nguyenvana@gmail.com,friend@outlook.com,colleague@qq.com
  ```

---

### 1.3. Xác Nhận

Sau khi thêm xong, trang Secrets sẽ hiển thị:

```
Repository secrets (3)

EMAIL_FROM        Updated now by you
EMAIL_PASSWORD    Updated now by you
EMAIL_TO          Updated now by you
```

✅ **Hoàn thành Bước 1!**

---

## 📝 Bước 2: Cấu Hình Từ Khóa Lọc Tin

File `config/frequency_words.txt` chứa từ khóa để lọc tin tức.

### 2.1. Hiểu File Hiện Tại

Mở file này, bạn sẽ thấy đã có sẵn nhiều từ khóa tiếng Trung:

```
胖东来
DeepSeek
华为
比亚迪
ai
!gai
人工智能
...
```

### 2.2. Quyết Định Chiến Lược

Bạn có 3 lựa chọn:

#### Option A: Giữ Nguyên (Khuyến Nghị Nếu Quan Tâm Công Nghệ Trung Quốc)

✅ **Ưu điểm**: Có sẵn từ khóa về công nghệ, AI, ô tô điện  
❌ **Nhược điểm**: Toàn tiếng Trung, có thể bỏ sót tin tiếng Anh

**Làm gì**: Không cần sửa gì, qua bước tiếp theo

---

#### Option B: Thêm Từ Khóa Tiếng Anh/Việt

✅ **Ưu điểm**: Mở rộng phạm vi theo dõi  
❌ **Nhược điểm**: Nhiều từ = nhiều thông báo

**Cách làm**:

1. Mở file `config/frequency_words.txt`
2. Thêm từ khóa ở cuối file:

```
# === Từ khóa tiếng Anh ===
AI
OpenAI
ChatGPT
Claude
Gemini
Tesla
SpaceX
Bitcoin
Ethereum

# === Từ khóa tiếng Việt (nếu nguồn tin có) ===
Việt Nam
VinFast
FPT
```

3. Commit và push lên GitHub

---

#### Option C: Xóa Hết và Tự Tạo Từ Đầu

✅ **Ưu điểm**: 100% kiểm soát  
❌ **Nhược điểm**: Mất thời gian

**Cách làm**:

1. Xóa toàn bộ nội dung file `frequency_words.txt`
2. Thêm từ khóa theo nhu cầu:

```
# Công nghệ
AI
ChatGPT
Google
Apple
Microsoft

# Tài chính
Bitcoin
Tesla
Stock market

# Từ BẮT BUỘC (phải xuất hiện)
+Breaking news
+Urgent

# Từ LOẠI TRỪ (không hiển thị)
!celebrity
!gossip
!娱乐
```

---

### 2.3. Cú Pháp Từ Khóa

| Cú pháp | Ý nghĩa | Ví dụ |
|---------|---------|-------|
| `AI` | Từ thường, xuất hiện thì match | Tin có chữ "AI" → ✅ hiển thị |
| `+AI` | Từ BẮT BUỘC phải có | Tin PHẢI có "AI" → ✅, không có → ❌ |
| `!gossip` | Từ LOẠI TRỪ | Tin có "gossip" → ❌ bỏ qua |

**Ưu tiên**: `!` (loại trừ) > `+` (bắt buộc) > từ thường

**Ví dụ phức tạp**:

```
+AI
+technology
!entertainment
```

➡️ Tin PHẢI có cả "AI" VÀ "technology", NHƯNG không có "entertainment"

---

### 2.4. Trường Hợp Đặc Biệt: Nhận TẤT CẢ Tin

Nếu muốn nhận TOÀN BỘ tin không lọc:

1. Xóa sạch file `frequency_words.txt` (để trống hoàn toàn)
2. Lưu file

⚠️ **Cảnh báo**: Sẽ có RẤT NHIỀU tin, email có thể quá dài!

---

## 🌐 Bước 3: Bật GitHub Pages

GitHub Pages biến repository thành website tĩnh.

### 3.1. Mở Settings

1. Repository → **Settings**
2. Sidebar trái → **Pages**

### 3.2. Cấu Hình Source

1. **Source**: Chọn **"GitHub Actions"** (dropdown menu)
   - ❌ KHÔNG chọn "Deploy from a branch"
   - ✅ Chọn "GitHub Actions"

2. Save (tự động lưu)

### 3.3. Lấy URL

Sau khi Actions chạy lần đầu (Bước 5), URL sẽ là:

```
https://[your-username].github.io/TrendRadar/
```

**Ví dụ**:
- Username: `nguyenvana`
- URL: `https://nguyenvana.github.io/TrendRadar/`

> 💡 **Bookmark URL này** để xem tin nhanh trên điện thoại!

---

## ⚙️ Bước 4: Cấu Hình GitHub Actions

Cho phép Actions có quyền deploy GitHub Pages.

### 4.1. Mở Actions Settings

1. Repository → **Settings**
2. Sidebar trái → **Actions** → **General**

### 4.2. Cấp Quyền Ghi

Kéo xuống phần **"Workflow permissions"**:

- ❌ Bỏ chọn: "Read repository contents and packages permissions"
- ✅ **Chọn**: **"Read and write permissions"**

### 4.3. Allow GitHub Actions

Đảm bảo phần **"Actions permissions"** ở trên:

- ✅ **Chọn**: "Allow all actions and reusable workflows"

### 4.4. Save

Click nút **"Save"** ở dưới cùng.

---

## 🚀 Bước 5: Chạy Thử Nghiệm

### 5.1. Trigger Manual Run

1. Repository → Tab **Actions** (menu trên cùng)
2. Sidebar trái → Click workflow **"News Crawler"**
3. Bên phải → Nút **"Run workflow"** (dropdown)
4. Chọn branch `master` hoặc `main`
5. Click nút xanh **"Run workflow"**

### 5.2. Theo Dõi Tiến Trình

1. Trang sẽ refresh, xuất hiện dòng vàng:
   ```
   News Crawler  #1  ● queued
   ```

2. Click vào dòng đó để xem chi tiết

3. Chờ 2-5 phút, các bước sẽ chạy:
   ```
   ✓ Set up job
   ✓ Checkout code
   ✓ Set up Python
   ✓ Install dependencies
   ✓ Run news crawler
   ✓ Upload artifact
   ✓ Deploy to GitHub Pages
   ```

### 5.3. Kiểm Tra Kết Quả

#### Trường hợp thành công ✅

- Tất cả bước có dấu ✓ xanh lá
- Tổng thời gian: ~2-3 phút
- Có nút "View deployment"

#### Trường hợp lỗi ❌

- Có bước dấu ✗ đỏ
- Click vào bước lỗi để xem log
- Xem phần [Xử Lý Sự Cố](#-xử-lý-sự-cố)

---

## ✅ Xác Minh Kết Quả

### 1. Kiểm Tra Email

**Thời gian**: 2-5 phút sau khi Actions thành công

**Nơi kiểm tra**:
- Hộp thư đến (Inbox)
- ⚠️ Nếu không thấy, check **Spam/Junk**

**Tiêu đề email**:
```
📊 TrendRadar 趋势雷达 - [daily] 每日汇总 (2025-11-19 22:00)
```

**Nội dung**:
- HTML format đẹp mắt
- Có logo, màu sắc
- Danh sách tin tức có link
- Responsive trên mobile

**Không nhận được email?** → Xem [Xử Lý Sự Cố - Email](#email-không-gửi)

---

### 2. Kiểm Tra GitHub Pages

**URL**: `https://[your-username].github.io/TrendRadar/`

**Thời gian**: 5-10 phút sau khi Actions thành công (lần đầu lâu hơn)

**Nội dung trang web**:
- Header với logo TrendRadar
- Thông tin tổng hợp: tổng số tin, thời gian cập nhật
- Danh sách tin tức được phân loại:
  - 🆕 Tin mới
  - 📈 Tin đang tăng hạng
  - 🔥 Tin HOT (top ranking)
- Footer với thống kê nền tảng

**Tính năng**:
- 📱 Tự động điều chỉnh giao diện trên mobile
- 🔗 Click vào tin để xem chi tiết
- 🖼️ Nút "Save as Image" để chia sẻ

**Không truy cập được?** → Xem [Xử Lý Sự Cố - GitHub Pages](#github-pages-404)

---

### 3. Kiểm Tra Tự Động Hóa

**Lịch chạy**: Mỗi giờ (vào phút 0)

**Cách kiểm tra**:
1. Đợi 1 giờ sau lần chạy thủ công
2. Vào tab Actions
3. Xem có run mới hay không (tự động)

**Lịch cụ thể** (theo cron `0 * * * *`):
```
00:00, 01:00, 02:00, ..., 23:00 (UTC+8 - Giờ Bắc Kinh)
```

**Chuyển đổi múi giờ**:
- UTC+7 (Việt Nam): Chậm hơn 1 giờ
  - Beijing 09:00 = VN 08:00
  
**Tắt tự động**:
- Không khuyến khích
- Nếu cần: Vào `Actions` → Workflow → `Disable workflow`

---

## 🎨 Tùy Chỉnh Nâng Cao

### 1. Thay Đổi Chế Độ Báo Cáo

File: `config/config.yaml`

```yaml
report:
  mode: "daily"  # Đổi thành: daily | incremental | current
```

**3 chế độ**:

#### `daily` - Báo Cáo Hàng Ngày (Mặc định)

✅ **Ưu điểm**: Toàn diện, thấy tất cả tin trong ngày  
❌ **Nhược điểm**: Có tin lặp lại (tin HOT cả ngày)

**Thích hợp**: Quản lý, người đọc tin tổng hợp

---

#### `current` - Bảng Xếp Hạng Hiện Tại

✅ **Ưu điểm**: Thấy "TOP trending" thời điểm này  
❌ **Nhược điểm**: Tin HOT liên tục xuất hiện mỗi giờ

**Thích hợp**: Content creator, người làm marketing

---

#### `incremental` - Chỉ Tin Mới

✅ **Ưu điểm**: ZERO lặp lại, chỉ báo tin mới  
❌ **Nhược điểm**: Có thể bỏ sót nếu tin nhanh tụt hạng

**Thích hợp**: Trader, nhà đầu tư (cần phản ứng nhanh)

---

### 2. Giới Hạn Thời Gian Push

Chỉ nhận thông báo trong khung giờ nhất định.

File: `config/config.yaml`

```yaml
notification:
  push_window:
    enabled: true  # Bật tính năng
    time_range:
      start: "09:00"  # Giờ bắt đầu (24h format)
      end: "18:00"    # Giờ kết thúc
    once_per_day: true  # true = chỉ 1 lần/ngày, false = mỗi giờ
```

**Ví dụ**:

```yaml
# Chỉ nhận tin lúc 20:00-22:00, 1 lần/ngày
start: "20:00"
end: "22:00"
once_per_day: true
```

⚠️ **Lưu ý**: GitHub Actions có delay, nên đặt range ≥ 2 giờ

---

### 3. Chỉnh Trọng Số Tin Nổi Bật

Quyết định tin nào xuất hiện đầu tiên.

File: `config/config.yaml`

```yaml
weight:
  rank_weight: 0.6       # Ưu tiên tin xếp hạng cao
  frequency_weight: 0.3  # Ưu tiên tin xuất hiện nhiều lần
  hotness_weight: 0.1    # Ưu tiên tin "đang lên"
```

**Tổng phải = 1.0**

**Ví dụ điều chỉnh**:

```yaml
# Tôi chỉ quan tâm tin TOP, không care tin lặp lại
rank_weight: 0.8
frequency_weight: 0.1
hotness_weight: 0.1
```

```yaml
# Tôi muốn thấy tin "đang viral" (xuất hiện nhiều platform)
rank_weight: 0.3
frequency_weight: 0.6
hotness_weight: 0.1
```

---

### 4. Thêm/Bớt Nền Tảng Theo Dõi

File: `config/config.yaml`

```yaml
platforms:
  - id: "zhihu"
    name: "知乎"
  - id: "weibo"
    name: "微博"
  # ... 11 platforms
```

**Bớt platform**: Comment dòng với `#`

```yaml
# Không quan tâm Douyin
# - id: "douyin"
#   name: "抖音"
```

**Thêm platform**: Xem danh sách API tại https://github.com/ourongxing/newsnow

---

### 5. Sử Dụng Proxy (Nếu Cần)

File: `config/config.yaml`

```yaml
crawler:
  use_proxy: true
  default_proxy: "http://127.0.0.1:7890"  # Đổi thành proxy của bạn
```

⚠️ **Lưu ý**: GitHub Actions không có proxy, chỉ dùng khi chạy local

---

## 🛠️ Xử Lý Sự Cố

### Email Không Gửi

#### Dấu hiệu
- Actions chạy thành công (✓ xanh)
- Nhưng không nhận email
- Log có dòng: `Email sent successfully` VẪN không có mail

#### Nguyên nhân & Giải pháp

##### 1. Sai App Password

**Kiểm tra**:
- Bạn dùng mật khẩu đăng nhập thay vì App Password?

**Cách sửa**:
- Lấy lại App Password đúng cách (xem [Chuẩn Bị](#lấy-app-password-cho-email))
- Update lại Secret `EMAIL_PASSWORD`

---

##### 2. Gmail: Chưa Bật 2FA

**Lỗi trong log**:
```
Username and Password not accepted
```

**Cách sửa**:
1. Bật 2-Factor Authentication: https://myaccount.google.com/security
2. Sau đó mới tạo được App Password

---

##### 3. QQ Mail: Chưa Bật SMTP

**Cách sửa**:
1. QQ Mail → Settings → Account
2. Tìm "POP3/SMTP service" → Enable
3. Generate authorization code (授权码) → Copy vào `EMAIL_PASSWORD`

---

##### 4. Email Rơi Vào Spam

**Kiểm tra**:
- Inbox → Spam/Junk folder

**Cách sửa**:
- Mark email "Not spam"
- Thêm sender vào Contact để sau này vào Inbox

---

##### 5. Sai SMTP Server/Port

**Dấu hiệu**: Log báo "Connection refused" hoặc "Timeout"

**Cách sửa**: Thêm Secret tùy chỉnh

```
Name:   EMAIL_SMTP_SERVER
Secret: smtp.gmail.com

Name:   EMAIL_SMTP_PORT
Secret: 587
```

**Bảng SMTP phổ biến**:

| Email | SMTP Server | Port | Encryption |
|-------|-------------|------|------------|
| Gmail | smtp.gmail.com | 587 | TLS |
| Outlook | smtp-mail.outlook.com | 587 | TLS |
| QQ Mail | smtp.qq.com | 465 | SSL |
| 163 Mail | smtp.163.com | 465 | SSL |

---

### GitHub Pages 404

#### Dấu hiệu
- Truy cập `https://[username].github.io/TrendRadar/` → "404 Not Found"

#### Nguyên nhân & Giải pháp

##### 1. Chưa Chạy Actions

**Kiểm tra**: Tab Actions có run nào thành công chưa?

**Cách sửa**: Chạy lại Bước 5

---

##### 2. Chưa Bật GitHub Pages

**Kiểm tra**: Settings → Pages → Source có phải "GitHub Actions" không?

**Cách sửa**: Xem lại [Bước 3](#-bước-3-bật-github-pages)

---

##### 3. Branch Sai

**Kiểm tra**: Repository có branch `master` hay `main`?

**Cách sửa**:
- Vào Actions → workflow → line 3-4:
  ```yaml
  on:
    push:
      branches: [ master ]  # Đổi thành main nếu cần
  ```

---

##### 4. Actions Không Deploy

**Kiểm tra log**: Bước "Deploy to GitHub Pages" có lỗi?

**Cách sửa**: 
- Settings → Actions → General
- Workflow permissions → "Read and write permissions"
- Save

---

### Actions Chạy Fail

#### Lỗi: "No module named 'requests'"

**Nguyên nhân**: Thiếu dependencies

**Sửa**: Workflow đã có `pip install -r requirements.txt`, kiểm tra file `requirements.txt` còn nguyên vẹn không

---

#### Lỗi: "Secrets not found"

**Dấu hiệu**: Log báo `EMAIL_FROM is not set`

**Nguyên nhân**: Tên Secret sai hoặc chưa tạo

**Cách sửa**:
- Vào Settings → Secrets → Actions
- Kiểm tra tên CHÍNH XÁC:
  - ✅ `EMAIL_FROM`
  - ❌ `email_from` (sai chữ thường)
  - ❌ `EMAILFROM` (thiếu dấu gạch dưới)

---

#### Lỗi: "Permission denied"

**Dấu hiệu**: Bước "Deploy" fail với "403 Forbidden"

**Cách sửa**: 
- Settings → Actions → General
- Workflow permissions → **Read and write permissions**

---

### Không Nhận Được Tin (Email Trống)

#### Dấu hiệu
- Email đến nhưng chỉ có header, không có tin tức

#### Nguyên nhân

##### 1. Từ Khóa Quá Nghiêm

**Kiểm tra**: File `frequency_words.txt` có quá nhiều từ `+` (bắt buộc)?

**Ví dụ lỗi**:
```
+AI
+Bitcoin
+Tesla
```
➡️ Tin PHẢI có CẢ 3 từ → rất khó match

**Cách sửa**: Bỏ dấu `+` hoặc giảm từ bắt buộc

---

##### 2. Từ Loại Trừ Quá Nhiều

**Kiểm tra**: Có quá nhiều `!` không?

```
!娱乐
!八卦
!明星
!celebrity
!gossip
!entertainment
```
➡️ Loại bỏ gần hết tin

**Cách sửa**: Chỉ giữ lại từ loại trừ quan trọng

---

##### 3, API Nguồn Lỗi

**Kiểm tra log**: Có dòng "Failed to fetch from platform X"?

**Cách sửa**: Chờ API phục hồi, thường tự động hết sau vài giờ

---

### Actions Không Tự Chạy

#### Dấu hiệu
- Chạy manual OK
- Nhưng không tự động chạy mỗi giờ

#### Nguyên nhân & Giải pháp

##### 1. Workflow Bị Disable

**Kiểm tra**: Tab Actions → Workflow có dòng "This workflow is disabled"?

**Cách sửa**: Click "Enable workflow"

---

##### 2. Repository Không Active

**Nguyên nhân**: GitHub tự tắt Actions nếu repo không có hoạt động 60 ngày

**Cách sửa**: 
- Tạo commit bất kỳ (sửa README chẳng hạn)
- Hoặc chạy manual để "đánh thức" repo

---

## 📞 Hỗ Trợ Thêm

### Liên Hệ

- **GitHub Issues**: https://github.com/sansan0/TrendRadar/issues
- **Original README**: [README-EN.md](README-EN.md)

### Tài Liệu Tham Khảo

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Pages Guide](https://docs.github.com/en/pages)
- [Email SMTP Settings](https://support.google.com/mail/answer/7126229)

---

## 🎉 Hoàn Thành!

Nếu bạn đã:
- ✅ Nhận được email đầu tiên
- ✅ Truy cập được GitHub Pages
- ✅ Thấy Actions tự chạy

**Chúc mừng! Bạn đã cài đặt thành công TrendRadar! 🚀**

Bây giờ bạn có thể:
- 📱 Bookmark URL GitHub Pages trên điện thoại
- 🔔 Kiểm tra email mỗi giờ để cập nhật tin
- ⚙️ Tùy chỉnh từ khóa theo sở thích
- 🎨 Điều chỉnh chế độ báo cáo phù hợp

**Enjoy your personal trending news radar! 📡**
