# Nguồn gốc bản công khai (Provenance)

Bản công khai này là ảnh chụp (snapshot) đã làm sạch của kho mã riêng tư **`manhlinhchilinh-eng/uh2026`**.
Kho riêng tư giữ nguyên lịch sử commit và tag; Ban tổ chức có thể yêu cầu quyền xem để đối chiếu.

## Đối chiếu với kho gốc

| Mục | Giá trị |
|---|---|
| Commit gốc được chụp | `619598b8bba26dec03588f4729b22ee5a1e65428` — nhánh `main`, 05/11/2026 23:56:43 (+07:00) |
| Mốc bắt đầu 24 giờ | tag `baseline-08h00-0511` = tag `hackathon-start-20261105-0800` → commit `c836a55f99a95a081ab87efb191c060d70fea63f` (04/11/2026 23:35, commit cuối trước 08h00 05/11) |
| Thay đổi trong 24 giờ | 116 commit từ mốc tới commit được chụp (91 commit không tính commit gộp nhánh) |
| Bản đang chạy thật lúc chụp | https://umsplus.web.app — cập nhật lúc 23h56 05/11/2026 |
| Thời điểm tạo bản công khai | 06/11/2026 |

## Những gì đã lược bỏ hoặc thay thế

| Hạng mục | Xử lý | Lý do |
|---|---|---|
| Lịch sử commit | Không đưa vào (1 commit duy nhất) | Lịch sử cũ có mật khẩu và ghi chú vận hành nội bộ từng bị commit trước khi được gỡ |
| Tài liệu bàn giao, quy tắc vận hành nội bộ (`HANDOFF*.md`, `ROADMAP.md`, `CLAUDE.md`, `handoffs/`, `docs/` trừ `PROPOSAL.md`, nhật ký agent `.agents/`) | Lược bỏ | Chứa thông tin vận hành, đường dẫn máy, ghi chú bảo mật chưa xử lý xong |
| Công cụ tạo/đặt lại tài khoản thật và sao lưu (`tools/accounts`, `tools/backup`) | Lược bỏ | Thao tác trực tiếp trên dữ liệu thật |
| Tài liệu nội bộ của trường (hướng dẫn chế độ tiền lương, bản thảo thuyết trình) | Lược bỏ | Không thuộc mã nguồn, là tài liệu nội bộ |
| Mật khẩu mặc định cũ trong mã và kiểm thử | Thay bằng `Demo@2026` / `demo@2026` (kèm hash SHA-256 tương ứng) | Không công khai mật khẩu từng dùng cho tài khoản thật |
| Mật khẩu tài khoản demo của công cụ luyện tập | Thay bằng chuỗi giả | Như trên |
| 6 họ tên và vài mã học sinh trùng với học sinh thật trong dữ liệu mẫu / kiểm thử | Đổi họ hoặc tên, đổi mã sang dạng `99xxxx` | Bảo vệ dữ liệu cá nhân học sinh |
| Email gmail, số điện thoại trong dữ liệu mẫu | Thay bằng địa chỉ `@example.com`, số `0900000xxx` | Như trên |
| Danh sách lớp, học sinh, thời khóa biểu thật (`ums-logbook/data/*`) | Không có (đã bị `.gitignore` loại từ đầu) | Dữ liệu thật của trường; thay bằng `data/class_data.example.json` rỗng |

Không có khóa service account, tệp `.env`, token GitHub hay khóa API dịch vụ AI nào trong bản này (đã quét tự động trước khi công khai).

## Phần giữ nguyên

Toàn bộ mã nguồn chạy được của `ums-logbook`, `notify-functions`, `ums_growth_hub`, `ums-brand`, Security Rules và bộ kiểm thử. Tên đăng nhập dạng `ms…ums` / `mr…ums` trong dữ liệu mẫu được giữ để kiểm thử logic ghép tên giáo viên trên thời khóa biểu. Mật khẩu mặc định cũ đã được thay bằng mật khẩu ngẫu nhiên cho các tài khoản thật từ 11/10/2026; tài khoản mới được cấp mật khẩu ngẫu nhiên và phải đổi khi đăng nhập lần đầu.

Kiểm thử tại commit được chụp (trên kho gốc, có dữ liệu thật): 1.749/1.749 đạt.
