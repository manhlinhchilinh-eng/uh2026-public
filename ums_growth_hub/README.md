# UMS SMART GROWTH HUB
### Nền tảng Số hóa Hồ sơ Năng lực Học sinh & Trợ lý Đồng hành Nhà trường - Gia đình
**Trường THCS Ngoại ngữ — Trường Đại học Ngoại ngữ, Đại học Quốc gia Hà Nội (UMS - ULIS)**

---

[![Python Version](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![Core AI Engine](https://img.shields.io/badge/Core%20AI-100%25%20Offline%20NLP-success.svg)](#core-ai-engine)
[![Rubric Standard](https://img.shields.io/badge/Rubric-GDPT%202018%20(10--pt)-orange.svg)](#he-thong-rubric-gdpt-2018)
[![High School Pathway](https://img.shields.io/badge/Pathway-THPT%20Chuy%C3%AAn%20Ngo%E1%BA%A1i%20ng%E1%BB%AF%20(CNN)-gold.svg)](#lo-trinh-chuyen-cap-cnn)
[![Tests Passing](https://img.shields.io/badge/E2E%20Tests-265%2F265%20Passing%20(100%25)-brightgreen.svg)](#kiem-thu-tu-dong)

---

## 1. TỔNG QUAN DỰ ÁN

**UMS Smart Growth Hub** là nền tảng chuyển đổi số toàn diện hồ sơ học tập và rèn luyện của học sinh dành riêng cho **Trường THCS Ngoại ngữ (UMS - ULIS)**. Hệ thống kết hợp:
1. **Core AI Engine Đánh giá Năng lực Liên môn**: Tự động phân tích các bài nộp dự án học tập (PBL), bài thuyết trình đa phương tiện song ngữ Anh - Việt, trích xuất chỉ số năng lực theo khung **GDPT 2018**, gắn thẻ kỹ năng (skill tagging) và chấm điểm rubric 10 điểm kèm phản hồi sư phạm mang tính xây dựng.
2. **AI Automated Report Generator**: Tự động tổng hợp dữ liệu học tập để sinh bản nhận xét học kỳ hoàn chỉnh, giàu chiều sâu nhân văn, hỗ trợ chế độ kép cho Giáo viên Chủ nhiệm (GVCN) và Giáo viên Bộ môn (GVBM) với cam kết tuyệt đối **Zero-Placeholder** (không rập khuôn, không sót mã giữ chỗ).
3. **Nền tảng Tương tác Đa Phân hệ (Multi-Role Glassmorphic SPA)**: Không gian số kết nối chặt chẽ 3 bên:
   - **Học sinh**: Kho lưu trữ sản phẩm (Project Vault), Biểu đồ mạng nhện năng lực 15 trục (Competency Spider Chart), và Hộ chiếu Năng lực Số (Digital Passport / CV) xuất bản PDF chuẩn in ấn ReportLab để nộp hồ sơ chuyển cấp lên THPT Chuyên Ngoại ngữ (CNN).
   - **Giáo viên**: Bảng điều khiển quản lý lớp, bản đồ nhiệt năng lực (competency heatmap), công cụ chấm rubric trực tiếp và biên tập nhận xét AI theo thời gian thực.
   - **Phụ huynh**: Dòng thời gian trưởng thành (Growth Timeline) lưu giữ từng minh chứng sản phẩm của con và Trợ lý AI đồng hành 24/7 giải đáp quy chế, hoạt động câu lạc bộ và định hướng thi vào CNN.

---

## 2. KIẾN TRÚC HỆ THỐNG & CÔNG NGHỆ

Hệ thống được thiết kế theo kiến trúc **Zero-Configuration, 100% Offline AI** độc lập, an toàn tuyệt đối về dữ liệu học sinh, không phụ thuộc vào internet hay các dịch vụ API trả phí bên ngoài.

```
+-----------------------------------------------------------------------------------+
|                        CLIENT BROWSER (PORT 8000)                                 |
|  - Modern Glassmorphic SPA (UMS Navy #0A2540 & Gold #D4AF37)                      |
|  - Role Switcher: [Học sinh / Student] [Giáo viên / Teacher] [Phụ huynh / Parent] |
|  - Interactive Chart.js Competency Radar & Visual Growth Timeline                 |
|  - Student Digital Passport / Print-Ready ReportLab PDF Export for CNN (ULIS)     |
+------------------------------------------+----------------------------------------+
                                           | HTTP / REST API
                                           v
+-----------------------------------------------------------------------------------+
|                     FASTAPI APPLICATION SERVER (PORT 8000)                        |
|                                                                                   |
|  [Static Files / Frontend Mount]        [API Router: /api/v1]                     |
|  - index.html, styles.css, app.js       - /ai (evaluate, extract-skills)          |
|                                         - /reports (generate, preview, pdf)       |
|                                         - /students (profiles, radar, passport)   |
|                                         - /projects (vault, submit, grade)        |
|                                         - /parent (timeline, chat)                |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |             CORE AI COMPETENCY & EVALUATION ENGINE (100% OFFLINE)           |  |
|  |  +---------------------+ +----------------------+ +----------------------+  |  |
|  |  | Bilingual NLP       | | Rubric Evaluator     | | Skill Tagger         |  |  |
|  |  | - Lexical/TTR/Vocab | | - GDPT 2018 (0-10)   | | - 28-Skill Taxonomy  |  |  |
|  |  | - VI/EN Tokenizer   | | - 4 Core Criteria    | | - Confidence >=0.65  |  |  |
|  |  +---------------------+ +----------------------+ +----------------------+  |  |
|  |  +---------------------+ +----------------------+ +----------------------+  |  |
|  |  | Report Synthesizer  | | School-Home Chatbot  | | Digital Passport PDF |  |  |
|  |  | - 3-Part Feedback   | | - 20 UMS Handbook QA | | - ReportLab Engine   |  |  |
|  |  | - Zero Placeholders | | - Semantic/Keyword   | | - Vector A4 Layout   |  |  |
|  |  +---------------------+ +----------------------+ +----------------------+  |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                  DATA REPOSITORY & PERSISTENCE LAYER                        |  |
|  |  - In-Memory State Store with persistent JSON seed storage                   |  |
|  |  - 4 Student Personas (Grades 6-9), 3 Deep PBL Payloads, 4 Boundary Fixtures |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 3. TÍNH NĂNG CỐT LÕI (FEATURE INVENTORY)

| Mã | Tên Tính năng | Mô tả Chi tiết | Phân hệ |
|:---|:---|:---|:---|
| **F01** | Bilingual Ingestion | Xử lý nội dung bài tập, báo cáo và tự soi chiếu song ngữ Anh - Việt, tự động nhận diện ngôn ngữ và mã hóa thực thể | Core AI |
| **F02** | GDPT 2018 Rubric Engine | Chấm điểm tự động thang 10 trên 4 tiêu chí chuẩn quốc gia (Nội dung 3.0, Ngôn ngữ 2.5, Tư duy sáng tạo 2.5, Hợp tác 2.0) | Core AI |
| **F03** | 28-Skill Tagging Engine | Tự động gắn thẻ tối thiểu 3 kỹ năng từ bộ danh mục 28 kỹ năng cốt lõi với độ tin cậy $\ge 0.65$ kèm trích dẫn văn bản minh chứng | Core AI |
| **F04** | Constructive Feedback | Tổng hợp lời khuyên sư phạm mang tính khích lệ, chỉ rõ điểm mạnh và lộ trình phát triển kỹ năng cụ thể | Core AI |
| **F05** | Tripartite Report Generator | Sinh nhận xét học kỳ 3 phần: (1) Chuyên môn & Ngoại ngữ, (2) Phẩm chất & Kỹ năng mềm, (3) Định hướng THPT CNN/ULIS | Report |
| **F06** | Zero-Placeholder Validation | Cơ chế kiểm tra regex nghiêm ngặt, ngăn chặn 100% các mẫu giữ chỗ chưa điền (`[Tên]`, `[Môn học]`, `undefined`, `NaN`) | Report |
| **F07** | Dual Teacher Mode | Chế độ nhận xét kép chuyên biệt cho Giáo viên Chủ nhiệm (bao quát năng lực phẩm chất) và Giáo viên Bộ môn (chuyên sâu bộ môn) | Report |
| **F08** | Realistic UMS Personas | 4 hồ sơ học sinh mẫu đại diện từ Khối 6 đến Khối 9 phản ánh đa dạng thế mạnh (STEM, Tranh biện, Ngôn ngữ 2, Hoạt động CLB) | Dataset |
| **F09** | Authentic PBL Scenarios | 3 kịch bản dự án liên môn sâu (English AI Debate, STEM Hydroponics IoT, Di sản Văn hóa Việt) cùng các ca biên thực nghiệm | Dataset |
| **F10** | UMS Handbook Knowledge Base | Ngân hàng 20 câu hỏi - đáp chính thức về tuyển sinh CNN, quy chế thi đua, thời khóa biểu và câu lạc bộ UMS | Chatbot |
| **F11** | Student Project Vault | Kho lưu trữ bài tập dự án của học sinh với bộ lọc danh mục, liên kết tệp đính kèm và trạng thái đánh giá theo thời gian thực | Học sinh |
| **F12** | Competency Spider Chart | Biểu đồ radar tương tác 15 trục năng lực GDPT 2018 (Chart.js), so sánh trực quan năng lực cá nhân với chuẩn trung bình khối | Học sinh |
| **F13** | Digital Passport & PDF Export | Hộ chiếu Năng lực Số tổng hợp thành tích học tập, xuất file PDF vector chất lượng in ấn phục vụ chuyển cấp CNN | Học sinh |
| **F14** | Teacher Class Management | Bảng điều khiển quản lý lớp, trực quan hóa phân bố điểm, bản đồ nhiệt năng lực tập thể và danh sách cần hỗ trợ | Giáo viên |
| **F15** | Teacher Rubric Grading | Không gian chấm rubric trực tiếp, cho phép giáo viên điều chỉnh điểm tiêu chí, ghi chú sư phạm và đồng bộ tức thì | Giáo viên |
| **F16** | Teacher AI Report Review | Công cụ duyệt nhận xét do AI đề xuất, hỗ trợ biên tập trực tiếp inline và kiểm tra tính hợp lệ trước khi lưu học bạ | Giáo viên |
| **F17** | Parent Growth Timeline | Dòng thời gian trực quan hiển thị từng cột mốc trưởng thành, minh chứng bài tập dự án và huy hiệu đạt được của học sinh | Phụ huynh |
| **F18** | Parent 24/7 AI Companion | Trợ lý ảo giải đáp 24/7 thắc mắc của phụ huynh về quy chế nhà trường, lịch hoạt động và lộ trình chuyển tiếp CNN | Phụ huynh |
| **F19** | Single-Command Startup | Trình khởi chạy thông minh `run.py` & `start.bat`, tự động quét và giải quyết xung đột cổng, mở trình duyệt mặc định | Hạ tầng |
| **F20** | Automated Test Suite | Bộ kiểm thử tự động toàn diện 5 tầng (Tiers 1-5) với 265 test assertions độc lập bảo vệ tính toàn vẹn 100% | Đảm bảo CL |

---

## 4. HƯỚNG DẪN KHỞI CHẠY NHANH (QUICKSTART)

### Yêu cầu hệ thống
- **Hệ điều hành**: Windows 10/11, macOS, hoặc Linux
- **Python**: Phiên bản 3.10 trở lên
- **Bộ nhớ RAM**: Tối thiểu 1 GB (hệ thống cực kỳ nhẹ do chạy offline AI, không tải mô hình LLM hàng chục GB)

### Khởi chạy trong 1 bước (Single-Command Launcher)

#### Cách 1: Sử dụng Windows Batch Script
Nhấp đúp chuột vào file:
```cmd
start.bat
```

#### Cách 2: Khởi chạy bằng Python CLI
Mở Terminal hoặc PowerShell tại thư mục dự án và chạy:
```bash
python run.py
```

*Hệ thống sẽ tự động:*
1. Kiểm tra môi trường và các thư viện cần thiết.
2. Dò tìm cổng TCP khả dụng (bắt đầu từ 8000, tự động chuyển sang 8001, 8002... nếu bị trùng).
3. Khởi động máy chủ FastAPI uvicorn.
4. Tự động mở trình duyệt web tại địa chỉ: `http://127.0.0.1:8000`.

---

## 5. HƯỚNG DẪN KIỂM THỬ TỰ ĐỘNG (TEST SUITE)

Dự án sở hữu bộ test suite tự động 5 tầng hoàn chỉnh, tuân thủ nguyên tắc kiểm thử xác thực (authentic testing) — 100% kiểm thử gọi trực tiếp vào logic ứng dụng thực, không chứa tautology hay dữ liệu giả định:

### Chạy Standalone Test Runner:
```bash
python tests/test_runner.py
```

*Kết quả thực thi mẫu:*
```
==================================================================================
  UMS SMART GROWTH HUB — AUTOMATED E2E & UNIT TEST SUITE RUNNER
  Authoritative Specifications: GDPT 2018 | CEFR | CNN High School Pathway
==================================================================================
Tier 1: Category-Partition Feature Coverage (F01-F20)  Run: 100  Pass: 100  Rate: 100.0%
Tier 2: Boundary Value Analysis & Corner Cases         Run: 100  Pass: 100  Rate: 100.0%
Tier 3: Combinatorial Pairwise Cross-Feature           Run:  22  Pass:  22  Rate: 100.0%
Tier 4: Real-World Application Workloads (S01-S10)     Run:  10  Pass:  10  Rate: 100.0%
----------------------------------------------------------------------------------
TOTAL COMBINED SUITE                                   Run: 232  Pass: 232  Rate: 100.0%
==================================================================================
  [SUCCESS] All 232 automated test assertions PASSED (Exit Code: 0)
==================================================================================
```

### Chạy kiểm thử nâng cao với Pytest (bao gồm Tier 5 Adversarial Hardening):
```bash
python -m pytest tests/ -v
```
*Kết quả:* **265 passed** trên toàn bộ 5 tầng kiểm thử.

---

## 6. TÀI LIỆU REST API CHÍNH THỨC

FastAPI tự động cung cấp tài liệu tương tác Swagger UI tại: `http://127.0.0.1:8000/docs`

### 1. Phân hệ Core AI (`/api/ai`)
- `POST /api/ai/evaluate`: Đánh giá toàn diện bài nộp dự án theo 4 tiêu chí rubric GDPT 2018, trích xuất kỹ năng và sinh nhận xét sư phạm.
- `POST /api/ai/extract-skills`: Trích xuất danh sách kỹ năng cốt lõi kèm trích dẫn văn bản minh chứng.

### 2. Phân hệ Báo cáo Học tập (`/api/reports`)
- `POST /api/reports/generate`: Sinh nhận xét học kỳ 3 phần tự động (kiểm tra nghiêm ngặt 0 placeholder).
- `GET /api/reports/{report_id}`: Lấy chi tiết bản nhận xét học kỳ.
- `PUT /api/reports/{report_id}`: Giáo viên chỉnh sửa trực tiếp nhận xét học bạ với bộ lọc kiểm tra placeholder.
- `GET /api/reports/{report_id}/pdf`: Xuất bản nhận xét học kỳ dưới dạng file PDF ReportLab.

### 3. Phân hệ Học sinh & Hộ chiếu Số (`/api/students`)
- `GET /api/students`: Lấy danh sách hồ sơ học sinh (hỗ trợ lọc theo khối lớp 6-9, tên lớp).
- `GET /api/students/{student_id}`: Lấy thông tin chi tiết học sinh theo ID hoặc mã học sinh (ví dụ: `UMS-8A1-012`).
- `GET /api/students/{student_id}/radar`: Lấy cấu trúc dữ liệu chuẩn hóa 15 trục năng lực cho biểu đồ Chart.js Radar.
- `GET /api/students/{student_id}/passport`: Lấy gói dữ liệu Hộ chiếu Năng lực Số.
- `GET /api/students/{student_id}/passport/pdf`: Tải xuống file PDF Hộ chiếu Năng lực Số vector chất lượng cao.

### 4. Phân hệ Dự án Học tập (`/api/projects`)
- `GET /api/projects`: Truy vấn danh mục dự án trong Project Vault (lọc theo học sinh, danh mục, trạng thái).
- `POST /api/projects/submit`: Học sinh nộp bài tập dự án mới; tự động kích hoạt Core AI chấm điểm và cập nhật timeline phụ huynh.
- `PUT /api/projects/{project_id}/grade`: Giáo viên phê duyệt hoặc điều chỉnh điểm rubric, ghi chú sư phạm.

### 5. Phân hệ Phụ huynh & Đồng hành (`/api/parent`)
- `GET /api/parent/timeline/{student_id}`: Lấy dòng thời gian trưởng thành với đầy đủ minh chứng sản phẩm của học sinh.
- `POST /api/parent/chat`: Hộp thoại Trợ lý ảo AI 24/7 giải đáp thắc mắc theo bộ cẩm nang UMS Handbook.

---

## 7. BẢN THUYẾT MINH GIẢI PHÁP: "24H KIẾN TẠO – 90 NGÀY TRIỂN KHAI" TẠI UMS

### PHẦN I: "24H KIẾN TẠO" — BỨT PHÁ TỪ THỰC TIỄN GIÁO DỤC UMS

#### 1. Đặt vấn đề và bài toán đặc thù tại Trường THCS Ngoại ngữ (UMS - ULIS)
Trường THCS Ngoại ngữ (UMS) trực thuộc Trường Đại học Ngoại ngữ – ĐHQGHN là môi trường giáo dục chất lượng cao với triết lý đào tạo tiên phong. Học sinh UMS được rèn luyện trong môi trường song ngữ năng động, thường xuyên thực hiện các dự án học tập liên môn (Project-Based Learning - PBL), nghiên cứu khoa học STEM và tham gia các câu lạc bộ học thuật như UMS Debate Club, CLB STEM, U-Press...

Tuy nhiên, nhà trường đang đối mặt với 3 thách thức lớn trong công tác quản lý chuyên môn:
1. **Thiếu công cụ số hóa định lượng năng lực liên môn**: Các bài tập dự án rất đa dạng (video clip, báo cáo nghiên cứu, bài trình chiếu tiếng Anh), nhưng việc đánh giá hiện vẫn phân tán, thiếu một thước đo chuẩn hóa theo khung chương trình GDPT 2018 và chuẩn đầu ra ngoại ngữ.
2. **Áp lực nhận xét học bạ định kỳ**: Vào cuối mỗi học kỳ, mỗi giáo viên phải viết hàng trăm bản nhận xét cá nhân hóa. Áp lực thời gian dễ dẫn đến tình trạng "nhận xét công nghiệp", rập khuôn, thiếu tính gợi mở cho tương lai học sinh.
3. **Kênh kết nối Nhà trường - Gia đình còn gián đoạn**: Phụ huynh học sinh THCS rất quan tâm đến sự trưởng thành của con nhưng thường chỉ nhìn thấy điểm số cuối kỳ qua sổ liên lạc điện tử thông thường mà không tận mắt nhìn thấy các sản phẩm dự án (minh chứng thực tế) của con. Đồng thời, phụ huynh luôn có nhu cầu lớn về việc tư vấn lộ trình chuyển cấp lên THPT Chuyên Ngoại ngữ (CNN).

#### 2. Thành tựu kiến tạo trong 24 giờ
Chỉ trong 24 giờ của đợt Hackathon chuyên sâu, nhóm phát triển đã hiện thực hóa toàn bộ giải pháp từ ý tưởng thành sản phẩm hoàn chỉnh có thể vận hành ngay:
- **Kiến trúc Core AI 100% Offline**: Không sử dụng API đám mây đắt đỏ hay tiềm ẩn nguy cơ rò rỉ dữ liệu trẻ vị thành niên. Engine phân tích ngôn ngữ tự nhiên (NLP) song ngữ chạy mượt mà ngay trên máy tính cục bộ, phân tích từ vựng, độ phức tạp câu và trích xuất bằng chứng thực nghiệm.
- **Khung Rubric GDPT 2018 chuẩn hóa**: Xây dựng thuật toán chấm điểm thang 10 trên 4 tiêu chí cốt lõi, loại bỏ hoàn toàn sự cảm tính trong đánh giá bài tập dự án.
- **Bộ dữ liệu mô phỏng chân thực UMS**: Xây dựng 4 chân dung học sinh đại diện từ Khối 6 đến Khối 9, 3 dự án liên môn thực tế của học sinh UMS và 20 cặp câu hỏi - đáp quy chế học đường chuẩn xác.
- **Kỷ luật kỹ thuật khắt khe (Test-Driven Development)**: Xây dựng 265 ca kiểm thử tự động, vượt qua các bài kiểm tra áp lực đồng thời và kiểm định pháp y mã nguồn nghiêm ngặt.

---

### PHẦN II: "90 NGÀY TRIỂN KHAI" — LỘ TRÌNH ĐƯA HỆ THỐNG VÀO VẬN HÀNH THỰC TẾ

Để hệ thống chuyển từ "bản thử nghiệm công nghệ xuất sắc" sang "nền tảng vận hành hàng ngày" phục vụ toàn thể cán bộ giáo viên, học sinh và phụ huynh UMS, lộ trình triển khai 90 ngày được hoạch định chi tiết qua 3 giai đoạn:

```
+---------------------------------------------------------------------------------------------------+
|                            LỘ TRÌNH 90 NGÀY TRIỂN KHAI TẠI UMS                                    |
+------------------------------------+----------------------------------+---------------------------+
|      THÁNG 1: NGÀY 1 - NGÀY 30     |    THÁNG 2: NGÀY 31 - NGÀY 60    | THÁNG 3: NGÀY 61 - NGÀY 90|
|     THÍ ĐIỂM & CHUẨN HÓA RUBRIC    |     MỞ RỘNG & TẬP HUẤN GV        | LIÊN THÔNG CNN & VẬN HÀNH |
+------------------------------------+----------------------------------+---------------------------+
| - Triển khai thí điểm Khối 8-9     | - Triển khai Khối 6 và Khối 7    | - Tích hợp tuyển sinh CNN |
| - Họp Hội đồng Sư phạm chuẩn hóa   | - Tập huấn 100% GVCN và GVBM     | - Số hóa Học bạ điện tử   |
|   bộ tiêu chí Rubric & 28 kỹ năng  | - Mở cổng Phụ huynh toàn trường  | - Bàn giao kỹ thuật & BGH |
| - Thu thập 200 bài nộp mẫu thực tế | - Tối ưu hóa UI/UX đa thiết bị   | - Đánh giá KPI giảm tải   |
+------------------------------------+----------------------------------+---------------------------+
```

#### GIAI ĐOẠN 1: THÍ ĐIỂM KHỐI 8-9 & CHUẨN HÓA SƯ PHẠM (NGÀY 1 – NGÀY 30)
- **Mục tiêu**: Kiểm chứng tính hiệu quả và độ chính xác sư phạm của Core AI trên dữ liệu bài nộp thật.
- **Hành động cụ thể**:
  1. *Triển khai thử nghiệm tại Khối 8 và Khối 9* (Trọng tâm là 2 lớp 8A1 và 9A1) trong đợt làm bài tập dự án giữa kỳ môn Tiếng Anh và Khoa học Tự nhiên / STEM.
  2. *Hội đồng Sư phạm UMS họp thẩm định*: Các tổ trưởng bộ môn Ngoại ngữ, Khoa học Tự nhiên, Khoa học Xã hội cùng chuyên gia công nghệ rà soát trọng số của 4 tiêu chí Rubric và tinh chỉnh danh mục 28 kỹ năng cho sát nhất với chuẩn đầu ra của từng khối lớp.
  3. *Thu thập và gắn nhãn 200 bài nộp dự án thực tế* của học sinh để hiệu chỉnh ngưỡng tin cậy của thuật toán Skill Tagging ($\ge 0.65$) và kiểm tra độ mượt mà của bộ sinh nhận xét tiếng Việt.
- **Chỉ số đo lường (KPI)**:
  - Tỷ lệ giáo viên tham gia thí điểm đồng thuận với kết quả phân tích sơ bộ của AI đạt $\ge 85\%$.
  - 100% bản nhận xét tự động không có lỗi giữ chỗ (zero-placeholder) và được giáo viên chủ nhiệm phê duyệt.

#### GIAI ĐOẠN 2: MỞ RỘNG TOÀN TRƯỜNG & TẬP HUẤN GIÁO VIÊN (NGÀY 31 – NGÀY 60)
- **Mục tiêu**: Đưa toàn bộ học sinh Khối 6 đến Khối 9 vào hệ sinh thái và giải phóng sức lao động hành chính cho giáo viên.
- **Hành động cụ thể**:
  1. *Tổ chức 02 buổi tập huấn chuyên sâu*:
     - Buổi 1: Dành cho Giáo viên Bộ môn về kỹ thuật giao bài tập dự án lên Project Vault, cách điều chỉnh điểm rubric split-screen.
     - Buổi 2: Dành cho Giáo viên Chủ nhiệm về quy trình duyệt nhận xét học kỳ, cách biên tập inline và theo dõi bản đồ nhiệt năng lực (competency heatmap) của lớp.
  2. *Mở cổng phân hệ Phụ huynh*: Gửi thư ngỏ và hướng dẫn đăng nhập cho cha mẹ học sinh toàn trường. Phụ huynh bắt đầu theo dõi Dòng thời gian trưởng thành (Growth Timeline) của con và trải nghiệm Trợ lý ảo AI giải đáp thông tin nhà trường.
  3. *Cập nhật cơ sở tri thức UMS Handbook*: Bổ sung thêm các câu hỏi phát sinh từ thực tế phụ huynh gửi về vào kho tri thức chatbot (lịch xe bus, hoạt động ngoại khóa, chế độ bán trú...).
- **Chỉ số đo lường (KPI)**:
  - 100% giáo viên chủ nhiệm và giáo viên bộ môn sử dụng thành thạo hệ thống.
  - Hơn 80% phụ huynh học sinh truy cập xem sản phẩm dự án của con ít nhất 2 lần/tháng.

#### GIAI ĐOẠN 3: KẾT NỐI HỆ SINH THÁI ULIS/CNN & CHÍNH THỨC VẬN HÀNH (NGÀY 61 – NGÀY 90)
- **Mục tiêu**: Biến Hộ chiếu Năng lực Số thành giá trị gia tăng cốt lõi cho học sinh chuyển cấp lên THPT Chuyên Ngoại ngữ (CNN) và vận hành bền vững.
- **Hành động cụ thể**:
  1. *Liên thông dữ liệu với THPT Chuyên Ngoại ngữ (CNN - ULIS)*:
     - Phối hợp với Ban Tuyển sinh trường THPT Chuyên Ngoại ngữ để chuẩn hóa mẫu xuất file PDF **Hộ chiếu Năng lực Số (Digital Passport)**.
     - Mẫu PDF này chứa mã xác thực QR và bảng phân tích 15 năng lực radar GDPT 2018, được công nhận như một minh chứng học tập chính thức trong hồ sơ xét tuyển và phỏng vấn vào các lớp chuyên hoặc chương trình học bổng của CNN.
  2. *Liên kết chuẩn đầu ra Đại học Ngoại ngữ (ULIS)*: Tích hợp chuẩn đo lường năng lực ngôn ngữ theo khung tham chiếu Châu Âu (CEFR A2/B1 cho THCS).
  3. *Bàn giao kỹ thuật & Đánh giá hiệu quả tổng thể*:
     - Bàn giao mã nguồn, tài liệu hướng dẫn vận hành và quy trình sao lưu dữ liệu cho Tổ Công nghệ Thông tin trường UMS.
     - Khảo sát đo lường thời gian viết nhận xét cuối năm của giáo viên: Đánh giá tỷ lệ giảm tải hành chính thực tế.
- **Chỉ số đo lường (KPI)**:
  - **Giảm 75% thời gian** tổng hợp và viết nhận xét học bạ cuối kỳ cho giáo viên (từ trung bình 15-20 phút/học sinh xuống còn 3-5 phút duyệt/tinh chỉnh).
  - 100% học sinh Khối 9 tốt nghiệp UMS sở hữu bản Hộ chiếu Năng lực Số PDF chuẩn in ấn có xác nhận điện tử.
  - Ban Giám hiệu UMS chính thức ban hành quy chế sử dụng hệ thống như một cấu phần trong công tác quản lý chất lượng giáo dục của nhà trường.

---

## 8. CAM KẾT ĐẠO ĐỨC & BẢO MẬT DỮ LIỆU HỌC SINH

1. **Bảo mật tuyệt đối (100% Local Processing)**: Toàn bộ thông tin cá nhân, hình ảnh, bài làm và nhận xét của học sinh được lưu trữ cục bộ trong cơ sở dữ liệu của nhà trường. Không có bất kỳ dữ liệu nào bị gửi lên máy chủ bên thứ ba.
2. **AI vì mục đích khích lệ sư phạm (Human-in-the-loop)**: AI chỉ đóng vai trò là "trợ lý thông minh đề xuất", quyền quyết định cao nhất về điểm số và lời nhận xét luôn thuộc về thầy cô giáo.
3. **Tính minh bạch và không thiên vị**: Tiêu chí đánh giá rubric được công khai rõ ràng cho học sinh và phụ huynh trước mỗi dự án học tập, thúc đẩy tinh thần học tập tự chủ và trung thực học thuật.

---

## 9. THÔNG TIN BẢN QUYỀN & PHÁT TRIỂN

- **Đơn vị phối hợp**: Trường THCS Ngoại ngữ — Trường Đại học Ngoại ngữ, ĐHQGHN
- **Đội ngũ phát triển**: Nhóm Dự án UMS Smart Growth Hub
- **Phiên bản**: v1.0.0 (Bản hoàn thiện sẵn sàng triển khai thực tế)
- **Giấy phép**: Độc quyền sử dụng trong hệ sinh thái giáo dục UMS - ULIS
