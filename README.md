# UMS+ (UMS SmartConnect) — Nền tảng số thống nhất cho Trường học thông minh

Mã nguồn sản phẩm dự thi **ULIS Hackathon 2026** của đội **UMS Hackathon**, Trường THCS Ngoại ngữ (UMS – ULIS), ĐHQGHN.
**Một nền tảng · Bốn vai trò** (Ban Giám hiệu & Tổ trưởng · Giáo viên · Học sinh · Phụ huynh).

- Sản phẩm đang chạy thật: **https://umsplus.web.app**
- Hồ sơ dự thi (bản mô tả, báo cáo tiến độ, sổ tay hướng dẫn): [`docs/ho-so-hackathon/`](docs/ho-so-hackathon/)
- Proposal: [`docs/PROPOSAL.md`](docs/PROPOSAL.md)

> **Đây là bản công khai (public mirror) đã được làm sạch** từ kho mã riêng tư của đội.
> Bản này **không có lịch sử commit**. Mốc thời gian, mã commit gốc và danh sách những gì đã lược bỏ được ghi trong [`PROVENANCE.md`](PROVENANCE.md).
> Kho riêng tư có đầy đủ lịch sử và các tag mốc; đội cấp quyền xem cho Ban tổ chức khi được yêu cầu.

## Cấu trúc

| Thư mục | Nội dung | Công nghệ |
|---|---|---|
| `ums-logbook/` | Ứng dụng chính UMS+: Sổ đầu bài điện tử, Sổ điểm, Thông báo, Hành chính – Văn bản, Đơn xin nghỉ, Xếp hạng thi đua, Dashboard BGH, Cổng phụ huynh, **Trợ lý UMS+** | React 18, TypeScript, Vite, Tailwind CSS, Firebase (Auth, Firestore, Hosting) |
| `notify-functions/` | Hàm gửi thông báo đẩy, đặt ở dự án Firebase riêng có ngân sách và tự ngắt thanh toán | Cloud Functions, Firebase Cloud Messaging |
| `ums_growth_hub/` | Hồ sơ năng lực số (ePortfolio) học sinh, đánh giá theo rubric offline | Python, FastAPI |
| `ums-brand/` | Bộ nhận diện: logo phân hệ, design tokens, preset Tailwind | SVG, CSS |
| `tools/rules-emulator/` | Kiểm thử Firestore Security Rules trên Firebase Emulator | Node.js, `@firebase/rules-unit-testing` |
| `tools/e2e/`, `tools/brand/` | Kịch bản kiểm thử đầu-cuối trên môi trường thử; công cụ sinh logo | Node.js, Python |

## Chạy thử trên máy (dữ liệu giả, không cần tài khoản thật)

```bash
cd ums-logbook
npm install
cp data/class_data.example.json data/class_data.json   # danh sách lớp rỗng; dữ liệu thật của trường không được công khai
npm test                                                # kiểm thử tự động (Vitest)
npm run dev                                             # chạy giao diện ở http://localhost:5173
```

Dùng Firebase Emulator với dữ liệu giả:

```bash
cd ums-logbook
npx firebase emulators:start --only auth,firestore --project demo-sodaubai
node ../tools/rules-emulator/seed_browser.mjs           # tạo tài khoản thử trên Emulator
npx vite --mode emulator                                # cần file .env.emulator.local: VITE_USE_FIREBASE_EMULATOR=true
```

Kiểm thử ePortfolio:

```bash
cd ums_growth_hub
pip install -r requirements.txt
pytest
```

Ghi chú về kiểm thử: trên kho gốc (có dữ liệu lớp thật) bộ kiểm thử `ums-logbook` đạt 1.749/1.749 tại commit được chụp. Ở bản công khai, khi chạy với danh sách lớp rỗng, một số kiểm thử cần dữ liệu thật (đọc workbook 674 học sinh, đăng nhập tài khoản mẫu) sẽ báo lỗi. Số kiểm thử lỗi này giống hệt khi chạy kho gốc với danh sách rỗng, tức là không phát sinh do việc làm sạch.

## Trợ lý UMS+ không dùng AI bên ngoài

Trợ lý so khớp câu hỏi với bộ câu hỏi đã được nhà trường duyệt (`ums-logbook/src/data/assistantFaq.json`) ngay trên trình duyệt, chạy được khi mất mạng; khi hỏi về văn bản, thông báo hoặc sĩ số thì trích nguyên văn từ dữ liệu người hỏi có quyền xem. Không gửi dữ liệu tới dịch vụ AI nào.

## Về cấu hình Firebase trong mã

Các khóa `apiKey` trong `ums-logbook/src/config/` là khóa web công khai của Firebase (bắt buộc có trong mã chạy trên trình duyệt), không phải mật khẩu. Quyền truy cập dữ liệu được kiểm soát bằng Firebase Authentication và Firestore Security Rules (`ums-logbook/firestore.rules`).

## Bản quyền

© 2026 Đội UMS Hackathon – Trường THCS Ngoại ngữ (ULIS, ĐHQGHN). Mã nguồn công khai để Ban tổ chức và cộng đồng tham khảo, đánh giá; chưa cấp giấy phép tái sử dụng. Logo và huy hiệu Trường THCS Ngoại ngữ thuộc quyền của nhà trường. Các thư viện mã nguồn mở sử dụng theo giấy phép riêng của từng thư viện (MIT, Apache-2.0, ISC).
