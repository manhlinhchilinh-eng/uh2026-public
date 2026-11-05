# UMS+ Brand Identity & Logo Kit (`ums-brand`)

Bộ nhận diện hình ảnh thống nhất cho hệ sinh thái trường học thông minh **UMS+ SmartConnect** (Trường THCS Ngoại ngữ – ULIS Middle School, ĐHQGHN).

> **Nguyên tắc bắt buộc:** Logo chính thức của Trường THCS Ngoại ngữ (`/logo.jpg`, `/logo.png`, `/logoums*`) luôn được **giữ nguyên** trên Header, màn Đăng nhập và các mẫu phiếu/báo cáo in ấn. Bộ 8 logo trong `ums-brand/logos/` là biểu tượng nhận diện cho từng phân hệ/ứng dụng trong hệ sinh thái UMS+ (đặt tại `public/brand/logos/<ten>/`).

---

## 1. Bảng màu chủ đạo (Color Palette)

Toàn bộ 8 biểu tượng và bản khóa ngang (`logo-horizontal.svg`) tuân thủ nghiêm ngặt bảng 4 màu chuẩn của `umsplus`:

| Vai trò màu | Tên gọi | Mã HEX | RGB | Quy tắc sử dụng trong Logo & UI |
|---|---|---|---|---|
| **Màu chính (Primary)** | Đỏ đô UMS (`Crimson`) | `#8B1A4A` | `rgb(139, 26, 74)` | Mảng hình khối trung tâm của biểu tượng, dòng tiêu đề phụ tiếng Anh (EN), nút bấm chính. |
| **Màu đậm (Primary Dark)** | Đỏ đô đậm (`Deep Plum`) | `#611736` | `rgb(97, 23, 54)` | Khung cấu trúc, mảng tạo chiều sâu, dòng tiêu đề chính tiếng Việt (VI) trên nền sáng. |
| **Màu nhấn (Accent)** | Hổ phách (`Amber Gold`) | `#F59E0B` | `rgb(245, 158, 11)` | Điểm hội tụ, dấu tích xác nhận, tia sáng năng lực hoặc nút kết nối trung tâm (chiếm 10–15% diện tích). |
| **Màu nền (Surface)** | Trắng (`Pure White`) | `#FFFFFF` | `rgb(255, 255, 255)` | Nền thẻ bo góc, vùng âm bản và nền an toàn cho `icon-maskable-512.png`. |

---

## 2. Ngôn ngữ hình khối & Quy chuẩn thiết kế

1. **Giữ nguyên huy hiệu chính thức của trường UMS:** Không thay thế hay chỉnh sửa logo/huy hiệu chính thức của Trường THCS Ngoại ngữ.
2. **Không chữ nhỏ trong icon vuông (`logo.svg`):** Biểu tượng vuông chỉ dùng hình khối thuần túy với hình dáng bao ngoài (silhouette) riêng biệt để đọc rõ ngay ở kích thước `32×32px` và `16×16px`.
3. **Cùng một ngôn ngữ hình học:**
   - Lưới chuẩn `256 × 256` (`viewBox="0 0 256 256"`), đạt **100/100** điểm kiểm định `svg_audit.py`.
   - Vùng khoét âm bản dùng `fill-rule="evenodd"` thật, không đè mảng trắng giả.
4. **Bản logo ngang (`logo-horizontal.svg`):**
   - Bên trái là biểu tượng vuông; bên phải là **tên tiếng Việt** (cỡ lớn, đậm, màu `#611736`) ở dòng trên và **tên tiếng Anh** (cỡ nhỏ, in hoa, màu `#8B1A4A` kèm điểm nhấn hổ phách `#F59E0B`) ở dòng dưới.
   - Toàn bộ chữ đã được chuyển thành đường cong vector (`<path>`) để hiển thị đồng nhất trên mọi thiết bị mà không phụ thuộc font cài đặt.

---

## 3. Danh mục 8 bộ Logo & Ánh xạ ứng dụng

Mỗi thư mục con trong `ums-brand/logos/<ten>/` chứa đủ 6 file thành phẩm:

| TT | Thư mục (`<ten>`) | Tên hiển thị (VI / EN) | Ý nghĩa hình khối (32px) | Ứng dụng / Phân hệ sử dụng |
|---|---|---|---|---|
| 1 | [`umsplus`](./logos/umsplus/) | **UMS+ SmartConnect**<br>`CONNECTED SCHOOL PLATFORM` | Dấu cộng `+` trung tâm nối 4 nút vệ tinh (4 vai trò: BGH, GV, HS, PH) với lõi kim cương hổ phách. | Nền tảng mẹ **UMS+ SmartConnect** (`ums-logbook` — `https://umsplus.web.app`), trang Hệ sinh thái `/apps`. |
| 2 | [`logbook`](./logos/logbook/) | **Sổ Đầu Bài Điện Tử**<br>`DIGITAL CLASS LOGBOOK` | Cuốn sổ mở đôi đối xứng với các dòng tiết học đều nhau và huy hiệu dấu tích hổ phách đã ký ở góc phải trên. | Phân hệ **Sổ đầu bài điện tử**, Điểm danh đầu giờ, Nề nếp (`/logbook`, `/attendance`, `/behavior`). |
| 3 | [`practice`](./logos/practice/) | **Luyện Tập Anh 9**<br>`ENG9 PRACTICE PORTAL` | Mũi tên kép tăng tốc (`»` – Forward Double Chevrons) kết hợp kim cương tâm điểm & huy hiệu sao 4 cánh hổ phách. | Web app **Luyện tập Tiếng Anh khối 9** (`practice-client` — `https://umseng9practice.web.app`). |
| 4 | [`grading`](./logos/grading/) | **Chấm Thi OMR**<br>`ENG9 OMR GRADING` | 4 góc khung ngắm quét camera bao quanh lưới 2×2 ô tô trắc nghiệm OMR, nổi bật 1 ô đáp án đúng màu hổ phách. | Web app **Chấm phiếu OMR & Phân tích đề** (`wonderful-shannon` — `https://umseng9grading.web.app`). |
| 5 | [`eng9hub`](./logos/eng9hub/) | **Sổ Điểm Anh 9**<br>`ENG9 GRADEBOOK HUB` | 3 cột điểm tăng trưởng bậc thang trên thanh sổ cái, kèm huy hiệu sao kim cương hổ phách phía trên. | Web app **Sổ điểm Tiếng Anh khối 9** (`student-management` — `https://umseng9hub.web.app`). |
| 6 | [`homeroom9`](./logos/homeroom9/) | **Cổng Khảo Sát Khối 9**<br>`HOMEROOM9 SURVEY PORTAL` | Mái nhà chủ nhiệm 45° che chở 3 trụ cột lớp học đồng tâm và ngọn đèn định hướng hổ phách ở đỉnh. | Cổng **GVCN & Tra cứu khảo sát khối 9** (`student-management` — `https://umshomeroom9.web.app`). |
| 7 | [`eportfolio`](./logos/eportfolio/) | **Hồ Sơ Năng Lực Số**<br>`DIGITAL EPORTFOLIO` | Khiên bát giác Hộ chiếu năng lực ôm ngôi sao la bàn 4 cánh màu hổ phách (4 chiều năng lực HS & rubric AI). | Phân hệ **ePortfolio HS & GV** (`/portfolio`, `/teacher-portfolio` trong `ums-logbook` và `ums_growth_hub`). |
| 8 | [`esl`](./logos/esl/) | **Dạy Học Bằng Tiếng Anh**<br>`UMS BILINGUAL PROGRAM` | Hai bong bóng hội thoại song ngữ lồng ghép nối bằng nút kim cương hổ phách ở tâm giao thoa. | Phân hệ **Dạy học bằng tiếng Anh & ESL Dashboard** (`/esl` và nhãn tiết CLIL/ESL trong Sổ đầu bài). |

---

## 4. Thành phần Design Tokens & Đồng bộ (`ums-brand/`)

| File | Mục đích |
|---|---|
| [`tokens.css`](./tokens.css) | Biến CSS chuẩn (`--ums-primary`, `--ums-primary-dark`, `--ums-accent`, `--ums-50`..`--ums-950`, bo góc, đổ bóng). |
| [`tailwind.preset.js`](./tailwind.preset.js) | Preset Tailwind CSS dùng chung cho `ums-logbook` và các app vệ tinh. |
| [`BrandMark.tsx`](./BrandMark.tsx) | Component React `<BrandMark app="logbook" size={36} />` hiển thị icon vuông hoặc bản ngang từ `/brand/logos/<app>/`. |
| [`preview.html`](./preview.html) | Trang xem nhanh trực quan toàn bộ 8 bộ logo ở các cỡ `128px`, `64px`, `32px`, `16px` và bản khóa ngang. |
| `tools/brand/build_logos.py` | Script Python tái sinh toàn bộ 48 file SVG/PNG và trang `preview.html`. |
| `tools/brand/sync_brand.ps1` | Script PowerShell đồng bộ `ums-brand/` vào `public/brand/` của `ums-logbook` (và các app vệ tinh khi truyền `-IncludeSatellites`), bảo toàn tuyệt đối logo trường UMS (`/logo.jpg`, `/logo.png`). |
