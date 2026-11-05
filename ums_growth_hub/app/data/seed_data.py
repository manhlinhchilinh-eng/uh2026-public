"""
Realistic UMS Sample Dataset & Simulation Scenarios (Seed Data).
Reflects authentic educational practices at Trường THCS Ngoại ngữ (UMS - ULIS - ĐHQGHN).

Includes:
- 4 Authentic Student Personas (Grades 6 to 9) with foreign languages, clubs, and CNN pathway
- 2 Teacher Personas (Homeroom & Subject)
- 4 Parent Personas
- 3 Deep-dive authentic PBL payloads (English AI presentation with 3E transcript, STEM Micro:bit IoT report, Folk culture preservation)
- 4 Boundary test cases (minimal valid, code-switching, missing reflection, teacher overwrite)
- 20 Official UMS Parent & Student Handbook Q&A pairs for 24/7 AI Companion
- Growth timeline milestones for visual parent tracking
"""

from typing import Dict, List, Any

# ==============================================================================
# 1. 4 AUTHENTIC STUDENT PERSONAS (GRADES 6 - 9)
# ==============================================================================

STUDENTS_SEED_DATA: List[Dict[str, Any]] = [
    {
        "id": "usr_stu_004",
        "student_code": "UMS-6A1-018",
        "full_name": "Lê Hoàng Nam",
        "grade": 6,
        "class_name": "6A1",
        "email": "nam.lh6a1@ums.edu.vn",
        "avatar_url": "/static/avatars/student_nam.png",
        "date_of_birth": "2014-08-12",
        "gender": "Nam",
        "second_language": "Japanese",
        "clubs": [
            "CLB Môi trường xanh (Green Earth)",
            "CLB Khoa học Khám phá"
        ],
        "gpa": 8.8,
        "cefr_level": "A2+",
        "target_highschool": "THPT Chuyên Ngoại ngữ (CNN - ULIS)",
        "parent_id": "usr_par_004",
        "parent_name": "Lê Hải Yến",
        "parent_phone": "0900000674",
        "parent_email": "phuhuynh.demo@example.com",
        "homeroom_teacher_id": "usr_tea_001",
        "homeroom_teacher_name": "Cô Đỗ Tuệ Uyên",
        "conduct_grade": "Tốt",
        "attendance_rate": 99.0,
        "notes": "Giai đoạn Hòa nhập & Khám phá. Khởi đầu cấp 2 với ngữ điệu tiếng Anh tự nhiên, tư duy quan sát tốt, đang tích cực rèn luyện kỹ năng làm việc nhóm và thuyết trình tự tin trước tập thể.",
        "badges": [
            "Mầm xanh UMS 2025",
            "Tự giác học tập",
            "Đại sứ Môi trường Lớp 6A1"
        ],
        "competencies": {
            "yeu_nuoc": 8.8,
            "nhan_ai": 9.0,
            "cham_chi": 8.5,
            "trung_thuc": 9.0,
            "trach_nhiem": 8.2,
            "tu_chu_tu_hoc": 8.0,
            "giao_tiep_hop_tac": 7.8,
            "giai_quyet_van_de_sang_tao": 8.2,
            "ngon_ngu": 8.6,
            "tinh_toan": 8.4,
            "khoa_hoc_tu_nhien": 8.5,
            "cong_nghe": 8.0,
            "tin_hoc": 8.2,
            "tham_my": 8.0,
            "the_chat": 8.5
        },
        "signature_projects": [
            {
                "id": "PRJ-ENV-2026-06A1-01",
                "title": "Rác thải học đường và Hành động của UMSer: Kế hoạch phân loại rác tại nguồn tại trường UMS",
                "subject": "Hoạt động Trải nghiệm & KHTN 6",
                "category": "social_humanities",
                "score": 8.5,
                "status": "evaluated",
                "skills": [
                    "#EnvironmentalStewardship",
                    "#CommunityEngagement",
                    "#ScientificInquiry",
                    "#Teamwork"
                ],
                "submitted_at": "2026-02-28T09:00:00Z",
                "summary": "Khảo sát thực trạng xả rác tại hành lang tòa A2 và thiết kế bộ infographic song ngữ hướng dẫn phân loại rác hữu cơ, rác tái chế trong khuôn viên trường.",
                "artifacts_count": 2
            }
        ]
    },
    {
        "id": "usr_stu_002",
        "student_code": "UMS-7A2-005",
        "full_name": "Nguyễn Mai Chi",
        "grade": 7,
        "class_name": "7A2",
        "email": "chi.nm7a2@ums.edu.vn",
        "avatar_url": "/static/avatars/student_chi.png",
        "date_of_birth": "2013-05-19",
        "gender": "Nữ",
        "second_language": "German",
        "clubs": [
            "CLB U-STEM Robotics (Trưởng ban Kỹ thuật)",
            "CLB Thiên văn học Trẻ"
        ],
        "gpa": 9.3,
        "cefr_level": "B1+ (IELTS 6.5)",
        "target_highschool": "THPT Chuyên Ngoại ngữ (CNN - ULIS) & THPT Chuyên KHTN",
        "parent_id": "usr_par_002",
        "parent_name": "Nguyễn Văn Hùng",
        "parent_phone": "0900000672",
        "parent_email": "phuhuynh.demo@example.com",
        "homeroom_teacher_id": "usr_tea_002",
        "homeroom_teacher_name": "Thầy Trần Quốc Tuấn",
        "conduct_grade": "Tốt",
        "attendance_rate": 98.8,
        "notes": "Giai đoạn Tăng tốc & Liên môn STEM. Xuất sắc môn Toán và KHTN, tư duy phản biện và khả năng lập trình vi điều khiển thực tế vượt trội lứa tuổi THCS.",
        "badges": [
            "STEM Champion 2026",
            "Kỹ sư Micro:bit Trẻ",
            "Nhà nghiên cứu Khoa học UMS",
            "Huy chương Bạc Robothon Hà Nội"
        ],
        "competencies": {
            "yeu_nuoc": 8.9,
            "nhan_ai": 8.8,
            "cham_chi": 9.5,
            "trung_thuc": 9.5,
            "trach_nhiem": 9.2,
            "tu_chu_tu_hoc": 9.3,
            "giao_tiep_hop_tac": 8.8,
            "giai_quyet_van_de_sang_tao": 9.6,
            "ngon_ngu": 8.8,
            "tinh_toan": 9.5,
            "khoa_hoc_tu_nhien": 9.6,
            "cong_nghe": 9.5,
            "tin_hoc": 9.4,
            "tham_my": 8.2,
            "the_chat": 8.6
        },
        "signature_projects": [
            {
                "id": "PRJ-STEM-2026-07A2-03",
                "title": "Smart Hydroponic System with IoT & Micro:bit for School Rooftop Garden",
                "subject": "Khoa học Tự nhiên & Tin học Liên môn",
                "category": "stem_scientific",
                "score": 9.4,
                "status": "evaluated",
                "skills": [
                    "#STEM-Robotics",
                    "#IoT-Engineering",
                    "#ScientificMethodology",
                    "#DataAnalysis",
                    "#EnvironmentalStewardship"
                ],
                "submitted_at": "2026-04-20T14:30:00Z",
                "summary": "Chế tạo giàn thủy canh hồi lưu tự động hóa đo TDS, nhiệt độ nước và điều khiển bơm dinh dưỡng tự động bằng Micro:bit và ESP8266 cho vườn sinh học trường.",
                "artifacts_count": 4
            },
            {
                "id": "PRJ-MATH-2025-07A2-01",
                "title": "Mô hình hóa lượng tiêu thụ năng lượng điện học đường bằng biểu đồ hồi quy",
                "subject": "Toán học 7 & Tin học",
                "category": "stem_scientific",
                "score": 9.0,
                "status": "evaluated",
                "skills": [
                    "#DataAnalysis",
                    "#SystemsThinking",
                    "#DigitalLiteracy"
                ],
                "submitted_at": "2025-11-15T10:00:00Z",
                "summary": "Thu thập hóa đơn điện năng 12 tháng của tòa A2 và xây dựng mô hình dự báo tiết kiệm điện khi tắt điều hòa trước giờ tan học 30 phút.",
                "artifacts_count": 2
            }
        ]
    },
    {
        "id": "usr_stu_003",
        "student_code": "UMS-8A1-012",
        "full_name": "Trần Đức Anh",
        "grade": 8,
        "class_name": "8A1",
        "email": "ducanh.t8a1@ums.edu.vn",
        "avatar_url": "/static/avatars/student_ducanh.png",
        "date_of_birth": "2012-11-03",
        "gender": "Nam",
        "second_language": "French",
        "clubs": [
            "UMS Debate Club (Phó Chủ tịch)",
            "U-Press & Media Club (Ban Nội dung)"
        ],
        "gpa": 9.2,
        "cefr_level": "B2 (IELTS 7.0)",
        "target_highschool": "THPT Chuyên Ngoại ngữ (CNN - ULIS) - Chuyên Anh / Pháp",
        "parent_id": "usr_par_003",
        "parent_name": "Trần Hoàng Long",
        "parent_phone": "0900000673",
        "parent_email": "long.tran@vietcombank.com.vn",
        "homeroom_teacher_id": "usr_tea_001",
        "homeroom_teacher_name": "Cô Đỗ Tuệ Uyên",
        "conduct_grade": "Tốt",
        "attendance_rate": 99.2,
        "notes": "Giai đoạn Phát triển Văn hóa & Kỹ năng Tranh biện. Nổi trội về Ngữ văn, Lịch sử và Ngoại ngữ; kỹ năng diễn thuyết hùng biện lưu loát song ngữ Anh - Việt, có tinh thần gìn giữ văn hóa dân tộc sâu sắc.",
        "badges": [
            "Cây hùng biện UMS 2025",
            "Đại sứ Văn hóa Di sản",
            "Cây bút U-Press xuất sắc",
            "Top Speaker UMS Debate Open"
        ],
        "competencies": {
            "yeu_nuoc": 9.8,
            "nhan_ai": 9.2,
            "cham_chi": 9.0,
            "trung_thuc": 9.4,
            "trach_nhiem": 9.3,
            "tu_chu_tu_hoc": 9.2,
            "giao_tiep_hop_tac": 9.6,
            "giai_quyet_van_de_sang_tao": 9.2,
            "ngon_ngu": 9.7,
            "tinh_toan": 8.5,
            "khoa_hoc_tu_nhien": 8.4,
            "cong_nghe": 8.8,
            "tin_hoc": 9.0,
            "tham_my": 9.5,
            "the_chat": 8.8
        },
        "signature_projects": [
            {
                "id": "PRJ-ENG-2026-08A1-01",
                "title": "AI in Future Education: Empowering Personalized Learning while Preserving Human Empathy",
                "subject": "English Language & Digital Literacy",
                "category": "english_presentation",
                "score": 9.5,
                "status": "evaluated",
                "skills": [
                    "#English-PublicSpeaking",
                    "#CriticalThinking",
                    "#AI-Literacy",
                    "#CollaborativeResearch",
                    "#GlobalCitizenship"
                ],
                "submitted_at": "2026-03-15T14:30:00Z",
                "summary": "Nghiên cứu mô hình 3E (Empower, Evaluate, Empathize) khảo sát thực tế 180 học sinh UMS về vai trò của Trí tuệ nhân tạo trong giáo dục cá nhân hóa.",
                "artifacts_count": 3
            },
            {
                "id": "PRJ-SOC-2026-08A1-02",
                "title": "Bảo tồn văn hóa dân gian Việt Nam qua lăng kính Gen Z: Số hóa Nghệ thuật Chèo & Tranh Đông Hồ",
                "subject": "Ngữ văn 8 & Lịch sử - Địa lý 8",
                "category": "social_humanities",
                "score": 9.6,
                "status": "evaluated",
                "skills": [
                    "#CulturalHeritage",
                    "#NationalIdentity",
                    "#BilingualStorytelling",
                    "#CivicResponsibility",
                    "#CreativeMedia"
                ],
                "submitted_at": "2026-05-10T16:00:00Z",
                "summary": "Điền dã làng tranh Đông Hồ Bắc Ninh, xây dựng website bảo tàng số tương tác 12 tích chèo và 10 bức tranh Đông Hồ với audio guide song ngữ Anh - Việt.",
                "artifacts_count": 4
            }
        ]
    },
    {
        "id": "usr_stu_001",
        "student_code": "UMS-9A1-001",
        "full_name": "Phạm Quỳnh Anh",
        "grade": 9,
        "class_name": "9A1",
        "email": "quynhanh.p9a1@ums.edu.vn",
        "avatar_url": "/static/avatars/student_quynhanh.png",
        "date_of_birth": "2011-09-24",
        "gender": "Nữ",
        "second_language": "German",
        "clubs": [
            "UMS Debate Club (Chủ tịch)",
            "Ban Tổ chức UMS Model United Nations (MUN) 2025 (Trưởng ban)"
        ],
        "gpa": 9.4,
        "cefr_level": "C1 (IELTS 7.5)",
        "target_highschool": "THPT Chuyên Ngoại ngữ (CNN - FLSS, ULIS) - Chuyên Anh",
        "parent_id": "usr_par_001",
        "parent_name": "Vũ Minh Trang",
        "parent_phone": "0900000671",
        "parent_email": "minhtrang.vu@fpt.com.vn",
        "homeroom_teacher_id": "usr_tea_001",
        "homeroom_teacher_name": "Cô Đỗ Tuệ Uyên",
        "conduct_grade": "Tốt",
        "attendance_rate": 99.5,
        "notes": "Giai đoạn Bứt phá & Chuyển cấp THPT Chuyên Ngoại ngữ. Năng lực tự chủ xuất sắc, tư duy toàn cầu, kỹ năng lãnh đạo dự án và phong thái học thuật chững chạc; là hạt nhân tiêu biểu cho lộ trình liên thông UMS - CNN.",
        "badges": [
            "Thủ lĩnh Tranh biện UMS 2025",
            "Học sinh Tiêu biểu UMS Toàn diện",
            "Hộ chiếu CNN Xuất sắc",
            "Best Delegate UMS MUN 2025"
        ],
        "competencies": {
            "yeu_nuoc": 9.5,
            "nhan_ai": 9.5,
            "cham_chi": 9.6,
            "trung_thuc": 9.8,
            "trach_nhiem": 9.7,
            "tu_chu_tu_hoc": 9.8,
            "giao_tiep_hop_tac": 9.7,
            "giai_quyet_van_de_sang_tao": 9.5,
            "ngon_ngu": 9.8,
            "tinh_toan": 9.0,
            "khoa_hoc_tu_nhien": 8.9,
            "cong_nghe": 9.0,
            "tin_hoc": 9.2,
            "tham_my": 9.3,
            "the_chat": 9.0
        },
        "signature_projects": [
            {
                "id": "PRJ-ENG-2026-08A1-01",
                "title": "AI in Future Education: Empowering Personalized Learning while Preserving Human Empathy",
                "subject": "English Language & Digital Literacy",
                "category": "english_presentation",
                "score": 9.5,
                "status": "evaluated",
                "skills": [
                    "#English-PublicSpeaking",
                    "#CriticalThinking",
                    "#AI-Literacy",
                    "#CollaborativeResearch",
                    "#GlobalCitizenship"
                ],
                "submitted_at": "2026-03-15T14:30:00Z",
                "summary": "Đồng tác giả bài thuyết trình nghiên cứu khung tương tác 3E (Empower, Evaluate, Empathize) ứng dụng AI trong trường phổ thông.",
                "artifacts_count": 3
            },
            {
                "id": "PRJ-CAP-2026-09A1-01",
                "title": "Global Citizenship in the 21st Century: Climate Refugees & Diplomatic Solutions",
                "subject": "Capstone Project & English for International Relations",
                "category": "english_presentation",
                "score": 9.7,
                "status": "evaluated",
                "skills": [
                    "#GlobalCitizenship",
                    "#DebateArgumentation",
                    "#AcademicWriting",
                    "#Leadership"
                ],
                "submitted_at": "2026-01-18T15:00:00Z",
                "summary": "Dự án tốt nghiệp THCS phân tích pháp lý quốc tế về khủng hoảng người tị nạn khí hậu tại khu vực Đông Nam Á và mô phỏng nghị quyết ngoại giao ĐHQGHN.",
                "artifacts_count": 3
            }
        ]
    }
]

# ==============================================================================
# 2. TEACHER PERSONAS
# ==============================================================================

TEACHERS_SEED_DATA: List[Dict[str, Any]] = [
    {
        "id": "usr_tea_001",
        "full_name": "Cô Đỗ Tuệ Uyên",
        "email": "ha.nt@ums.edu.vn",
        "role": "teacher",
        "teacher_type": "homeroom",
        "department": "Tổ Tiếng Anh & Hoạt động Trải nghiệm",
        "classes": ["8A1", "9A1"],
        "advisory_club": "UMS Debate Club",
        "avatar_url": "/static/avatars/teacher_ha.png",
        "phone": "0900000233",
        "bio": "Thạc sĩ Giảng dạy Tiếng Anh (ULIS - VNU). 12 năm kinh nghiệm bồi dưỡng học sinh giỏi chuyên Anh và huấn luyện kỹ năng tranh biện WSDC."
    },
    {
        "id": "usr_tea_002",
        "full_name": "Thầy Trần Quốc Tuấn",
        "email": "tuan.tq@ums.edu.vn",
        "role": "teacher",
        "teacher_type": "subject",
        "department": "Tổ Khoa học Tự nhiên & Tin học",
        "classes": ["6A1", "7A2", "8A1"],
        "advisory_club": "CLB U-STEM Robotics",
        "avatar_url": "/static/avatars/teacher_tuan.png",
        "phone": "0900000566",
        "bio": "Thạc sĩ Vật lý Ứng dụng & Khoa học Máy tính. Phụ trách không gian sáng chế Makerspace UMS và các dự án IoT liên môn."
    }
]

# ==============================================================================
# 3. PARENT PERSONAS
# ==============================================================================

PARENTS_SEED_DATA: List[Dict[str, Any]] = [
    {
        "id": "usr_par_001",
        "full_name": "Bà Vũ Minh Trang",
        "email": "minhtrang.vu@fpt.com.vn",
        "phone": "0900000671",
        "student_id": "usr_stu_001",
        "student_name": "Phạm Quỳnh Anh",
        "student_class": "9A1",
        "avatar_url": "/static/avatars/parent_trang.png",
        "interest": "Lộ trình tuyển sinh vào THPT Chuyên Ngoại ngữ (CNN) và học bổng du lịch hè."
    },
    {
        "id": "usr_par_002",
        "full_name": "Ông Nguyễn Văn Hùng",
        "email": "phuhuynh.demo@example.com",
        "phone": "0900000672",
        "student_id": "usr_stu_002",
        "student_name": "Nguyễn Mai Chi",
        "student_class": "7A2",
        "avatar_url": "/static/avatars/parent_hung.png",
        "interest": "Hoạt động Maker/Robotics, định hướng thi học sinh giỏi Khoa học Tự nhiên."
    },
    {
        "id": "usr_par_003",
        "full_name": "Ông Trần Hoàng Long",
        "email": "long.tran@vietcombank.com.vn",
        "phone": "0900000673",
        "student_id": "usr_stu_003",
        "student_name": "Trần Đức Anh",
        "student_class": "8A1",
        "avatar_url": "/static/avatars/parent_long.png",
        "interest": "Kỹ năng tranh biện, chuẩn bị danh mục thành tích (Portfolio) cho kỳ thi lớp 10."
    },
    {
        "id": "usr_par_004",
        "full_name": "Bà Lê Hải Yến",
        "email": "phuhuynh.demo@example.com",
        "phone": "0900000674",
        "student_id": "usr_stu_004",
        "student_name": "Lê Hoàng Nam",
        "student_class": "6A1",
        "avatar_url": "/static/avatars/parent_yen.png",
        "interest": "Quy chế bán trú, hòa nhập học tập đầu cấp và thói quen tự học ở nhà."
    }
]

# ==============================================================================
# 4. 3 DEEP-DIVE AUTHENTIC PBL PAYLOADS
# ==============================================================================

PBL_PROJECTS_SEED_DATA: List[Dict[str, Any]] = [
    {
        "id": "PRJ-ENG-2026-08A1-01",
        "title": "AI in Future Education: Empowering Personalized Learning while Preserving Human Empathy",
        "subject": "English Language & Digital Literacy",
        "category": "english_presentation",
        "language": "en",
        "grade_level": 8,
        "lead_student_id": "usr_stu_003",
        "lead_student_name": "Trần Đức Anh",
        "class_name": "8A1",
        "collaborators": ["Phạm Quỳnh Anh (9A1)"],
        "submitted_at": "2026-03-15T14:30:00Z",
        "status": "evaluated",
        "content_text": """# Topic: AI in Future Education: Empowering Personalized Learning while Preserving Human Empathy
**Presenters**: Pham Quynh Anh & Tran Duc Anh (UMS Debate Club)
**Target Audience**: Middle School Teachers, Students, and School Administrators

## 1. Abstract & Introduction
Artificial Intelligence (AI) is fundamentally transforming education from a standardized, one-size-fits-all model into an adaptive, deeply personalized learning ecosystem. In secondary schools like UMS, students demonstrate vastly different learning paces, cognitive styles, and linguistic affinities. However, excessive reliance on automated tutors risks eroding interpersonal empathy, critical skepticism, and collaborative teamwork. Our project investigates the synergistic boundary: How can secondary education leverage AI diagnostic engines to elevate personalized competency development without compromising human moral connection?

## 2. Research Problem & Field Survey
We conducted an empirical survey of 180 UMS middle schoolers across Grades 7, 8, and 9:
- 78% utilize AI tools (ChatGPT, Claude, Grammarly) for foreign language drafting and idea brainstorming.
- 62% express anxiety that AI feedback feels transactional and lacks emotional encouragement compared to teacher mentorship.
- 85% desire an integrated school portfolio that tracks their long-term growth across projects rather than isolated test scores.

## 3. Proposed Framework: "The 3E Synergy" (Empower, Evaluate, Empathize)
- **Empower**: Generative AI acts as a 24/7 personal inquiry companion, providing scaffolded grammar correction, vocabulary expansion in English/French/German, and adaptive math exercises tailored to GDPT 2018 standards.
- **Evaluate**: Automated rubric scoring based on verifiable artifacts (project vaults, code repositories, debate transcripts), liberating educators from mechanical grading.
- **Empathize**: Reallocating 40% of teacher administrative time toward socio-emotional counseling, ethical leadership seminars, and one-on-one student coaching.

## 4. Ethical Safeguards & Algorithmic Responsibility
We formulate an ethical code for young scholars:
1. Transparency: Mandatory citation of AI assistance in project bibliographies.
2. Original Voice: AI may refine syntax, but the core thesis, experimental data, and moral reflection must originate from human inquiry.
3. Equity: Ensuring equal hardware and software access across all school demographics to avoid a digital learning divide.

## 5. Conclusion & Actionable Call to UMS Community
Technology is not the destination; it is the catalyst. By pairing algorithmic precision with pedagogical compassion, UMS can pioneer a high-school readiness pathway that equips future CNN scholars to become global citizens who think critically, innovate fearlessly, and care deeply.""",
        "student_reflection": "Khi chuẩn bị bài thuyết trình này, nhóm em đã phải sửa cấu trúc luận điểm 4 lần để không bị biến bài nói thành bài quảng cáo công nghệ. Em học được rằng kỹ năng phản biện không phải là chê bai công nghệ, mà là tìm ra điểm cân bằng để công nghệ phục vụ con người. Phần làm việc nhóm giúp em và chị Quỳnh Anh phối hợp ăn ý giữa tìm kiếm số liệu khảo sát và thiết kế slide trên Canva.",
        "artifacts": [
            {"type": "slide_pdf", "name": "AI_Future_Education_Slides.pdf", "url": "/artifacts/prj_eng_01_slides.pdf"},
            {"type": "video_mp4", "name": "Speech_Recording_DebateHall.mp4", "url": "/artifacts/prj_eng_01_video.mp4"},
            {"type": "survey_data", "name": "UMS_180_Students_Survey.csv", "url": "/artifacts/prj_eng_01_survey.csv"}
        ],
        "rubric_evaluation": {
            "evaluation_id": "eval_prj_eng_01",
            "evaluated_by": "Core AI Engine v1.0 & Cô Đỗ Tuệ Uyên",
            "evaluated_at": "2026-03-17T11:00:00Z",
            "total_score": 9.5,
            "breakdown": {
                "content_depth": 2.9,
                "language_expression": 2.5,
                "critical_innovation": 2.3,
                "collaboration_integrity": 1.8
            },
            "skill_tags": [
                {
                    "skill_id": "skill_en_academic_writing",
                    "skill_name": "English Academic Writing",
                    "category": "Language & Communication",
                    "confidence": 0.96,
                    "evidence": "Sophisticated vocabulary choices (synergistic boundary, transactional, scaffolded) and rigorous structure adhere to advanced academic conventions."
                },
                {
                    "skill_id": "skill_public_speaking",
                    "skill_name": "Public Speaking & Oratory",
                    "category": "Language & Communication",
                    "confidence": 0.94,
                    "evidence": "Pacing and persuasive cadence exhibited throughout the recorded speech demonstrate refined delivery."
                },
                {
                    "skill_id": "skill_critical_analysis",
                    "skill_name": "Critical Analysis",
                    "category": "Research & Critical Thinking",
                    "confidence": 0.92,
                    "evidence": "Identified the double-edged sword of automated tutors eroding empathy versus personalized speed."
                },
                {
                    "skill_id": "skill_ethical_ai_usage",
                    "skill_name": "Ethical AI Usage",
                    "category": "Digital & Technological",
                    "confidence": 0.95,
                    "evidence": "Formulated a 3-pillar ethical code for middle schoolers emphasizing transparency and original voice."
                },
                {
                    "skill_id": "skill_teamwork_collaboration",
                    "skill_name": "Teamwork & Collaboration",
                    "category": "Social & Collaborative",
                    "confidence": 0.89,
                    "evidence": "Cross-grade collaboration (Grade 8 & 9) with harmonious distribution of empirical survey and slide synthesis."
                }
            ],
            "feedback": {
                "strengths": "Lập luận sắc sảo, dẫn chứng khảo sát 180 học sinh thực tế tại UMS rất thuyết phục. Mô hình 3E Synergy có giá trị thực tiễn cao.",
                "areas_for_improvement": "Có thể mở rộng thêm phần so sánh với mô hình học tập thích ứng tại các trường phổ thông quốc tế tại Singapore hoặc Nhật Bản.",
                "actionable_advice": "Nên phát triển dự án thành bài viết nghiên cứu gửi tham luận tại Hội thảo Khoa học Học sinh THCS cấp ĐHQGHN."
            },
            "growth_recommendations": [
                "Chuẩn bị bài tham luận song ngữ cho diễn đàn liên trường UMS - CNN.",
                "Bổ sung mẫu khảo sát bổ sung cho nhóm học sinh lớp 6 mới vào trường."
            ]
        }
    },
    {
        "id": "PRJ-STEM-2026-07A2-03",
        "title": "Smart Hydroponic System with IoT & Micro:bit for School Rooftop Garden",
        "subject": "Khoa học Tự nhiên & Tin học Liên môn",
        "category": "stem_scientific",
        "language": "vi",
        "grade_level": 7,
        "lead_student_id": "usr_stu_002",
        "lead_student_name": "Nguyễn Mai Chi",
        "class_name": "7A2",
        "collaborators": ["Lê Tuấn Minh (7A2)", "Hoàng Khánh Linh (7A2)"],
        "submitted_at": "2026-04-20T14:30:00Z",
        "status": "evaluated",
        "content_text": """# Báo cáo Nghiên cứu Kỹ thuật: Hệ thống Thủy canh Thông minh Ứng dụng IoT và Vi điều khiển Micro:bit cho Vườn Sinh học UMS
**Nhóm tác giả**: Nguyễn Mai Chi (Trưởng nhóm), Lê Tuấn Minh, Hoàng Khánh Linh (Lớp 7A2 - UMS)
**Giáo viên hướng dẫn**: ThS. Trần Quốc Tuấn (Bộ môn KHTN & Công nghệ)

## 1. Đặt vấn đề và Mục tiêu Nghiên cứu
Khu vườn thực nghiệm trên tầng thượng trường THCS Ngoại ngữ thường xuyên gặp khó khăn trong việc duy trì độ ẩm và nồng độ dinh dưỡng (TDS) ổn định do thời tiết Hà Nội mùa hè nắng gắt và mùa đông hanh khô. Việc tưới tiêu thủ công gây lãng phí 35% lượng nước và cây rau xà lách thủy canh thường bị úng rễ hoặc cháy lá.
Mục tiêu dự án:
1. Chế tạo hệ thống hồi lưu thủy canh thông minh tự động giám sát pH, nhiệt độ nước và chỉ số TDS.
2. Lập trình vi điều khiển Micro:bit kết hợp ESP8266 gửi dữ liệu theo thời gian thực về Dashboard Adafruit IO / Web Server trường.
3. Tối ưu hóa chu kỳ bơm dinh dưỡng tự động dựa trên độ ẩm và cường độ ánh sáng, tiết kiệm điện năng 30%.

## 2. Thiết kế Phần cứng và Sơ đồ Khối (Hardware Architecture)
- **Bộ điều khiển trung tâm**: BBC Micro:bit v2 kết hợp mạch mở rộng IOBit.
- **Cảm biến sử dụng**:
  - Cảm biến độ đục/dinh dưỡng TDS Meter V1.0 (Analog Pin P0).
  - Cảm biến nhiệt độ chống nước DS18B20 (Digital Pin P1).
  - Cảm biến quang trở LDR đo cường độ nắng (Pin P2).
  - Cảm biến mực nước siêu âm HC-SR04 đo lượng dung dịch trong bồn chứa.
- **Cơ cấu chấp hành**:
  - Relay 5V 2 kênh điều khiển máy bơm chìm 12V DC và quạt tản nhiệt nước.
  - Màn hình LCD 1602 I2C hiển thị thông số tại trạm đo cục bộ.
  - Module Wi-Fi ESP8266 truyền dữ liệu giao thức MQTT.

## 3. Thuật toán Điều khiển & Code Lập trình (MicroPython Automation Controller)
```python
from microbit import *

TDS_THRESHOLD_LOW = 550   # ppm (thiếu dinh dưỡng)
TDS_THRESHOLD_HIGH = 850  # ppm (thừa dinh dưỡng)
TEMP_WATER_MAX = 28.5     # độ C (nguy cơ thối rễ)

def read_sensors():
    tds_val = pin0.read_analog() * (3.3 / 1023.0) * 400
    temp_val = (pin1.read_analog() * 3.3 / 1023.0 - 0.5) * 100
    return tds_val, temp_val

while True:
    tds, temp = read_sensors()
    # Tu dong bat bom bo sung dinh duong khi duoi nguong
    if tds < TDS_THRESHOLD_LOW:
        pin8.write_digital(1) # Kich hoat Relay Bom Dinh Duong A-B
        sleep(2000)
        pin8.write_digital(0)
    
    # Tu dong bat quat lam mat nuoc
    if temp > TEMP_WATER_MAX:
        pin12.write_digital(1) # Kich hoat quat lam mat nuoc
    else:
        pin12.write_digital(0)
    
    sleep(5000)
```

## 4. Kết quả Thực nghiệm & Đo lường
Thử nghiệm liên tục trong 21 ngày tại vườn trường (từ 01/04/2026 đến 21/04/2026):
- Tỷ lệ sống và phát triển của rau xà lách xoăn đạt 96.5% (so với 78% của luống đối chứng trồng thủ công).
- Lượng nước tiêu thụ giảm 42.8 lít/tuần nhờ cơ chế tuần hoàn đóng.
- Nồng độ dinh dưỡng dao động ổn định trong biên độ tối ưu 620 - 740 ppm.
- Hệ thống gửi cảnh báo Telegram cho đội chăm sóc khi mực nước trong bồn chứa dưới 15%.

## 5. Hạn chế và Hướng phát triển
Hệ thống hiện tại chạy bằng nguồn điện lưới 220V qua adapter; hướng tới việc tích hợp tấm pin năng lượng mặt trời 18V có ắc quy lưu trữ để đảm bảo vận hành độc lập khi mất điện và nâng cao tính bền vững môi trường.""",
        "student_reflection": "Lúc đầu mạch của nhóm em bị chập chờn do cảm biến TDS bị nhiễu sóng từ máy bơm. Thầy Tuấn khuyên nhóm em bọc cách ly mass và dùng tụ lọc 100uF. Nhờ vậy tụi em đã tự sửa được lỗi phần cứng mà không cần mua mạch mới. Em thấy môn KHTN gắn với thực hành lập trình vui hơn rất nhiều so với học công thức suông.",
        "artifacts": [
            {"type": "circuit_schematic", "name": "Microbit_Hydroponics_Fritzing.pdf", "url": "/artifacts/prj_stem_03_fritzing.pdf"},
            {"type": "code_repo", "name": "microbit_smart_garden.py", "url": "/artifacts/prj_stem_03_code.py"},
            {"type": "photo_gallery", "name": "Vườn_Thủy_Canh_21_Ngày.zip", "url": "/artifacts/prj_stem_03_photos.zip"}
        ],
        "rubric_evaluation": {
            "evaluation_id": "eval_prj_stem_03",
            "evaluated_by": "Core AI Engine v1.0 & Thầy Trần Quốc Tuấn",
            "evaluated_at": "2026-04-22T16:00:00Z",
            "total_score": 9.4,
            "breakdown": {
                "content_depth": 2.9,
                "language_expression": 2.3,
                "critical_innovation": 2.4,
                "collaboration_integrity": 1.8
            },
            "skill_tags": [
                {
                    "skill_id": "skill_stem_prototyping",
                    "skill_name": "STEM Prototyping & Engineering",
                    "category": "Digital & Technological",
                    "confidence": 0.97,
                    "evidence": "Thiết kế mạch phần cứng tích hợp Micro:bit v2, cảm biến TDS, nhiệt độ DS18B20 và relay điều khiển máy bơm."
                },
                {
                    "skill_id": "skill_coding_automation",
                    "skill_name": "Coding & Automation",
                    "category": "Digital & Technological",
                    "confidence": 0.95,
                    "evidence": "Viết thuật ngữ MicroPython tự động hóa logic điều khiển chu kỳ bơm và ngưỡng an toàn nhiệt độ."
                },
                {
                    "skill_id": "skill_scientific_inquiry",
                    "skill_name": "Scientific Inquiry",
                    "category": "Research & Critical Thinking",
                    "confidence": 0.93,
                    "evidence": "Thiết lập nhóm đối chứng, đo đạc dữ liệu thực nghiệm liên tục 21 ngày với các chỉ số định lượng cụ thể."
                },
                {
                    "skill_id": "skill_data_interpretation",
                    "skill_name": "Data Interpretation",
                    "category": "Research & Critical Thinking",
                    "confidence": 0.91,
                    "evidence": "Phân tích biên độ dao động nồng độ dinh dưỡng 620-740 ppm và lượng nước tiết kiệm 42.8L/tuần."
                },
                {
                    "skill_id": "skill_problem_solving",
                    "skill_name": "Problem Solving",
                    "category": "Research & Critical Thinking",
                    "confidence": 0.94,
                    "evidence": "Xử lý thành công lỗi nhiễu cảm biến analog bằng giải pháp tụ lọc 100uF và bọc cách ly mass."
                }
            ],
            "feedback": {
                "strengths": "Dự án liên môn KHTN - Tin học có tính thực tiễn cao. Phương pháp nghiên cứu khoa học bài bản, số liệu thực nghiệm 21 ngày rất chuẩn mực.",
                "areas_for_improvement": "Cần hoàn thiện thêm sơ đồ nguyên lý mạch dạng tiêu chuẩn IEEE và bổ sung tính toán tuổi thọ linh kiện.",
                "actionable_advice": "Đăng ký tham gia Ngày hội Khoa học STEM UMS và chuẩn bị hồ sơ tham dự cuộc thi Sáng tạo Thanh thiếu niên cấp Thành phố."
            },
            "growth_recommendations": [
                "Nâng cấp tấm pin năng lượng mặt trời 18V cho hệ thống độc lập năng lượng.",
                "Kết nối dữ liệu lên Dashboard chung của trường để học sinh các lớp khác cùng quan sát."
            ]
        }
    },
    {
        "id": "PRJ-SOC-2026-08A1-02",
        "title": "Bảo tồn văn hóa dân gian Việt Nam qua lăng kính Gen Z: Số hóa Nghệ thuật Chèo & Tranh Đông Hồ",
        "subject": "Ngữ văn 8 & Lịch sử - Địa lý 8 (Hoạt động Trải nghiệm)",
        "category": "social_humanities",
        "language": "bilingual",
        "grade_level": 8,
        "lead_student_id": "usr_stu_003",
        "lead_student_name": "Trần Đức Anh",
        "class_name": "8A1",
        "collaborators": ["Hoàng Thảo My (8A1)", "Lê Minh Triết (8A1)"],
        "submitted_at": "2026-05-10T16:00:00Z",
        "status": "evaluated",
        "content_text": """# Dự án Trải nghiệm Liên môn: Bảo tồn Văn hóa Dân gian Việt Nam qua Lăng kính Gen Z
**Tên sản phẩm**: Bộ cẩm nang số "Hồn Dân Tộc trong Nét Vẽ Đông Hồ & Tiếng Trống Chèo Sân Đình"
**Nhóm thực hiện**: Trần Đức Anh & Nhóm Văn Hóa UMS 8A1
**Đơn vị phối hợp**: Bảo tàng Dân tộc học Việt Nam & Nghệ nhân Nguyễn Đăng Chế (Thuận Thành, Bắc Ninh)

## 1. Khát vọng Dự án: Kết nối Quá khứ và Hiện đại
Nhiều bạn học sinh thế hệ Gen Z thường nghĩ nghệ thuật truyền thống như Chèo hay Tranh khắc gỗ Đông Hồ là cổ hủ, khó tiếp cận. Tuy nhiên, khi đào sâu dưới góc nhìn mỹ thuật và triết học nhân sinh, mỗi bức tranh Đông Hồ như "Đám cưới chuột", "Vinh hoa - Phú quý", hay mỗi điệu chèo "Đào liễu", "Luyện năm cung" đều chứa đựng tính châm biếm sâu cay, lòng vị tha và ước vọng thái bình của cha ông.
Dự án của nhóm UMS 8A1 không chỉ nghiên cứu lý thuyết mà thực hiện sứ mệnh: "Dùng công nghệ số và tư duy ngôn ngữ hiện đại để đưa di sản đến gần giới trẻ trong nước và bạn bè quốc tế".

## 2. Hành trình Điền dã Thực địa
- **Chuyến đi Bắc Ninh**: Nhóm đã trực tiếp đến làng tranh Đông Hồ (Bắc Ninh), phỏng vấn Nghệ nhân Ưu tú Nguyễn Đăng Chế, ghi âm quy trình nghiền vỏ điệp, nấu hồ nếp và quét màu tự nhiên từ lá chàm, hoa hòe, than lá tre.
- **Chuyến đi Nhà hát Chèo Hà Nội**: Phỏng vấn nghệ sĩ biểu diễn về sự thay đổi của trang phục và làn điệu chèo khi diễn cho khán giả trẻ.

## 3. Sản phẩm Số hóa Đột phá
1. **Trang web Tương tác Di sản Số**: Nhóm xây dựng website đa phương tiện giới thiệu 12 tích chèo kinh điển và 10 bức tranh Đông Hồ với âm thanh giải thích song ngữ (Audio Guide) do chính học sinh UMS thu âm bằng tiếng Anh và tiếng Việt.
2. **Bộ Thẻ Học tập Tương tác AR (Augmented Reality Flashcards)**: Khi dùng điện thoại quét vào mặt tranh in trên giấy dó, hình ảnh chuyển động hoạt họa 2D hiện lên kèm trích đoạn âm nhạc ngũ cung.
3. **Chiến dịch Truyền thông Học đường "Di sản trong Ba lô"**: Tổ chức triển lãm mini tại sảnh nhà A2 trường UMS, thu hút hơn 450 lượt học sinh tham quan, trải nghiệm tự tay in mộc bản tranh Đông Hồ lên túi vải canvas.

## 4. Tác động Xã hội và Thông điệp Tự hào Dân tộc
- Dự án chứng minh rằng thế hệ trẻ Việt Nam không hề quay lưng với truyền thống, mà cần những cách tiếp cận trực quan, công nghệ và tôn trọng ngôn ngữ của thời đại.
- Qua bản dịch tiếng Anh của bộ cẩm nang, nhóm đã gửi tặng tài liệu cho các giáo viên nước ngoài đang giảng dạy tại ULIS và UMS, nhận được lời khen ngợi sâu sắc về tinh thần đại sứ văn hóa học đường.""",
        "student_reflection": "Khi dịch các thuật ngữ chèo như 'hề áo ngắn', 'đào thương', 'nói lối' sang tiếng Anh, em gặp khó khăn cực kỳ lớn vì không có từ ngữ tương đương tuyệt đối trong từ điển. Em đã phải xin gặp thầy cô Khoa Ngôn ngữ và Văn hóa Anh - ULIS để nhờ tư vấn cách chuyển ngữ giữ nguyên hồn cốt văn hóa dân tộc. Dự án này giúp em hiểu sâu sắc câu nói: 'Học ngoại ngữ là để mang văn hóa Việt Nam ra thế giới'.",
        "artifacts": [
            {"type": "emagazine_pdf", "name": "Cam_nang_Di_san_So_GenZ.pdf", "url": "/artifacts/prj_soc_02_magazine.pdf"},
            {"type": "audio_podcast", "name": "Podcast_Dong_Ho_NguyenDangChe.mp3", "url": "/artifacts/prj_soc_02_podcast.mp3"},
            {"type": "ar_flashcards", "name": "AR_Cheo_Flashcards.zip", "url": "/artifacts/prj_soc_02_ar.zip"}
        ],
        "rubric_evaluation": {
            "evaluation_id": "eval_prj_soc_02",
            "evaluated_by": "Core AI Engine v1.0 & Cô Đỗ Tuệ Uyên",
            "evaluated_at": "2026-05-12T09:30:00Z",
            "total_score": 9.6,
            "breakdown": {
                "content_depth": 2.9,
                "language_expression": 2.5,
                "critical_innovation": 2.3,
                "collaboration_integrity": 1.9
            },
            "skill_tags": [
                {
                    "skill_id": "skill_cultural_awareness",
                    "skill_name": "Cultural Awareness & Heritage",
                    "category": "Social & Collaborative",
                    "confidence": 0.98,
                    "evidence": "Điền dã thực tế phỏng vấn nghệ nhân Đông Hồ và nghệ sĩ Nhà hát Chèo, thể hiện tình yêu sâu sắc với di sản."
                },
                {
                    "skill_id": "skill_multilingual_competence",
                    "skill_name": "Multilingual Competence",
                    "category": "Language & Communication",
                    "confidence": 0.96,
                    "evidence": "Dịch thuật các khái niệm kịch nghệ cổ truyền sang tiếng Anh có sự cố vấn học thuật từ chuyên gia ULIS."
                },
                {
                    "skill_id": "skill_multimodal_storytelling",
                    "skill_name": "Multimodal Storytelling",
                    "category": "Language & Communication",
                    "confidence": 0.95,
                    "evidence": "Sáng tạo bộ cẩm nang số kết hợp Audio Guide, thẻ AR chuyển động và triển lãm in mộc bản tương tác."
                },
                {
                    "skill_id": "skill_community_engagement",
                    "skill_name": "Community Engagement",
                    "category": "Social & Collaborative",
                    "confidence": 0.94,
                    "evidence": "Tổ chức sự kiện triển lãm học đường thu hút hơn 450 học sinh tham quan và lan tỏa tới giáo viên quốc tế."
                },
                {
                    "skill_id": "skill_creative_design",
                    "skill_name": "Creative Design",
                    "category": "Research & Critical Thinking",
                    "confidence": 0.92,
                    "evidence": "Hiện thực hóa ý tưởng in mộc bản tranh Đông Hồ lên túi vải canvas thân thiện môi trường."
                }
            ],
            "feedback": {
                "strengths": "Dự án xuất sắc toàn diện! Thể hiện lòng tự hào dân tộc, năng lực ngoại ngữ học thuật và tư duy sáng tạo truyền thông di sản số mang đậm bản sắc UMSer.",
                "areas_for_improvement": "Có thể bổ sung thêm một video ngắn 60 giây dạng Reels/TikTok giáo dục để tiếp cận thêm đông đảo bạn bè đồng trang lứa trên mạng xã hội.",
                "actionable_advice": "Đề xuất trưng bày bộ cẩm nang tại Ngày hội Văn hóa ULIS International Day vào tháng 11."
            },
            "growth_recommendations": [
                "Lưu trữ bộ sản phẩm vào Hộ chiếu Năng lực Số để phục vụ hồ sơ xét tuyển liên thông CNN.",
                "Tiếp tục mở rộng dự án với nghệ thuật gốm Bát Tràng trong năm học tới."
            ]
        }
    }
]

# ==============================================================================
# 5. 4 BOUNDARY TEST CASES
# ==============================================================================

BOUNDARY_CASES_SEED_DATA: List[Dict[str, Any]] = [
    {
        "case_id": "TC-BOUND-01",
        "name": "Minimal Valid Submission",
        "description": "Bài nộp độ dài tối thiểu (~100 từ, tiêu đề ngắn, không đính kèm liên kết ngoài). Kiểm tra hệ thống không crash, cho điểm cơ bản hợp lệ và gợi ý bổ sung.",
        "payload": {
            "submission_id": "PRJ-BOUND-01",
            "student_id": "usr_stu_004",
            "student_name": "Lê Hoàng Nam",
            "grade_level": 6,
            "title": "Short Eco Note UMS",
            "subject": "Hoạt động Trải nghiệm 6",
            "category": "general",
            "language": "vi",
            "content": "Trường chúng em có nhiều cây xanh nhưng vẫn còn rác nhựa ở sân bóng. Chúng em cần đặt thêm thùng rác hai màu để các bạn phân loại. Nhóm em sẽ làm biển nhắc nhở.",
            "reflection": "Em viết bài ngắn gọn để đề xuất giải pháp nhanh cho lớp.",
            "artifacts": []
        },
        "expected_behavior": {
            "min_score": 5.0,
            "max_score": 6.8,
            "min_skill_tags": 3,
            "status": "evaluated",
            "crash": False,
            "notes": "Hệ thống chấp nhận văn bản ngắn, tính điểm thành phần và đưa ra khuyến nghị bổ sung số liệu minh chứng."
        }
    },
    {
        "case_id": "TC-BOUND-02",
        "name": "Code-Switching (Anh - Việt xen kẽ)",
        "description": "Bài luận khoa học môi trường xen kẽ câu và thuật ngữ tiếng Anh và tiếng Việt. Kiểm tra bộ phân loại ngôn ngữ nhận diện song ngữ, không lỗi parser.",
        "payload": {
            "submission_id": "PRJ-BOUND-02",
            "student_id": "usr_stu_003",
            "student_name": "Trần Đức Anh",
            "grade_level": 8,
            "title": "Biodiversity and Ecosystem Protection in Hanoi Urban Lakes",
            "subject": "Khoa học Tự nhiên & Tiếng Anh",
            "category": "interdisciplinary",
            "language": "bilingual",
            "content": "Hệ sinh thái biodiversity tại các hồ Hà Nội đang đối mặt với severe threat từ hiện tượng eutrophication và plastic waste. Các loài endemic fish đang suy giảm population nhanh chóng. Nhóm em đề xuất lắp đặt floating wetlands kết hợp native aquatic plants để filter chất ô nhiễm tự nhiên.",
            "reflection": "Em sử dụng thuật ngữ tiếng Anh xen kẽ vì một số từ khoa học chưa có từ dịch tiếng Việt hoàn toàn sát nghĩa.",
            "artifacts": [{"type": "doc", "name": "Bilingual_Abstract.docx"}]
        },
        "expected_behavior": {
            "detected_language": "bilingual",
            "min_score": 7.5,
            "tagged_both_languages": True,
            "tags_include": ["#EnglishProficiency", "#VietnameseLinguistics"],
            "crash": False
        }
    },
    {
        "case_id": "TC-BOUND-03",
        "name": "Collaborative Project with Missing Member Reflection",
        "description": "Dự án nhóm 4 học sinh nhưng 1 học sinh chưa nộp phần nhật ký phản tư cá nhân. Kiểm tra hệ thống gắn cờ cảnh báo (warning flag) mà không từ chối bài nộp của cả nhóm.",
        "payload": {
            "submission_id": "PRJ-BOUND-03",
            "student_id": "usr_stu_002",
            "student_name": "Nguyễn Mai Chi",
            "grade_level": 7,
            "title": "RoboTrash: Thùng rác tự động nhận diện vỏ lon bằng AI camera",
            "subject": "Tin học & STEM 7",
            "category": "stem_scientific",
            "language": "vi",
            "collaborators": ["Lê Hoàng Nam (6A1)", "Trần Đức Anh (8A1)", "Lê Tuấn Minh (7A2)"],
            "content": "Dự án ứng dụng mô hình YOLOv8 trên Raspberry Pi để phân loại tự động rác vỏ kim loại và rác hữu cơ tại căng tin trường UMS.",
            "member_reflections": {
                "usr_stu_002": "Em phụ trách lập trình thị giác máy tính và huấn luyện 500 ảnh mẫu.",
                "usr_stu_003": "Em biên soạn tài liệu thuyết trình và kiểm tra độ trễ nhận diện.",
                "usr_stu_004": "Em hỗ trợ đo kích thước khung kim loại của thùng rác.",
                "usr_stu_005_missing": None
            }
        },
        "expected_behavior": {
            "has_missing_reflection": True,
            "warning_flag": "FLAG_MISSING_MEMBER_REFLECTION",
            "status": "submitted_pending_reflection",
            "system_action": "Gửi thông báo nhắc nhở thành viên còn thiếu hoàn thành nhật ký phản tư trước ngày khóa sổ."
        }
    },
    {
        "case_id": "TC-BOUND-04",
        "name": "Post-Evaluation Teacher Inline Edit Overwrite",
        "description": "Giáo viên ghi đè điểm số từ 8.5 lên 9.0 và tinh chỉnh nhận xét do AI đề xuất. Kiểm tra cơ chế lưu vết lịch sử (audit trail) và đồng bộ tức thì vào hồ sơ năng lực.",
        "payload": {
            "submission_id": "PRJ-BOUND-04",
            "student_id": "usr_stu_003",
            "original_ai_score": 8.5,
            "teacher_override_score": 9.0,
            "teacher_id": "usr_tea_001",
            "teacher_name": "Cô Đỗ Tuệ Uyên",
            "original_comment": "Bài viết có dẫn chứng tốt, phân tích số liệu đạt yêu cầu.",
            "modified_comment": "Bài viết lập luận rất chững chạc, thể hiện rõ góc nhìn phản biện của một UMSer. Cô đánh giá cao sự tiến bộ vượt bậc của Đức Anh trong học kỳ này!",
            "edit_reason": "Cộng 0.5 điểm khuyến khích phần trả lời câu hỏi vấn đáp phản biện trực tiếp trước lớp rất xuất sắc."
        },
        "expected_behavior": {
            "is_teacher_overridden": True,
            "history_logged": True,
            "final_score": 9.0,
            "editor": "Cô Đỗ Tuệ Uyên",
            "radar_sync": True
        }
    }
]

# ==============================================================================
# 6. 20 OFFICIAL UMS HANDBOOK Q&A PAIRS FOR 24/7 AI COMPANION
# ==============================================================================

HANDBOOK_QA_SEED_DATA: List[Dict[str, Any]] = [
    {
        "id": "QA-01",
        "category": "schedule",
        "question": "Thời gian biểu học tập hàng ngày tại Trường THCS Ngoại ngữ (UMS) quy định như thế nào?",
        "answer": "Học sinh UMS học bán trú cả ngày từ thứ Hai đến thứ Sáu. Buổi sáng bắt đầu lúc 7h30 và kết thúc lúc 11h15 (4 tiết học). Buổi trưa học sinh ăn bán trú và nghỉ ngơi tại phòng nghỉ điều hòa từ 11h15 đến 13h30. Buổi chiều bắt đầu từ 13h45 đến 16h40 (3 tiết học). Riêng các ngày thứ Ba và thứ Năm, học sinh tham gia các CLB ngoại khóa từ 15h30 đến 17h00.",
        "keywords": ["thời gian biểu", "giờ học", "vào lớp", "tan học", "buổi sáng", "buổi chiều", "lịch học"]
    },
    {
        "id": "QA-02",
        "category": "boarding",
        "question": "Dịch vụ bán trú và chế độ dinh dưỡng, nghỉ trưa tại UMS được tổ chức ra sao?",
        "answer": "Khu vực bán trú UMS tọa lạc tại Tòa nhà A2 - Trường Đại học Ngoại ngữ (ULIS). Suất ăn trưa do Công ty Dinh dưỡng Học đường đạt chuẩn ISO 22000 cung cấp, thực đơn phong phú gồm 1 món chính, 2 món phụ, canh và tráng miệng, thay đổi hàng tuần và công khai trên cổng UMS Hub. Phòng ngủ bán trú nam và nữ riêng biệt, có giáo viên quản nhiệm chăm sóc, điều hòa hai chiều và chăn gối được giặt khử khuẩn định kỳ.",
        "keywords": ["bán trú", "ăn trưa", "nghỉ trưa", "phòng ngủ", "thực đơn", "tòa nhà A2", "dinh dưỡng"]
    },
    {
        "id": "QA-03",
        "category": "regulations",
        "question": "Quy định về trang phục và đồng phục học sinh UMS trong tuần như thế nào?",
        "answer": "Học sinh UMS mặc áo sơ mi trắng gắn phù hiệu UMS, quần sẫm màu (hoặc váy xếp ly kèm quần bảo hộ với học sinh nữ), đi giày quai hậu/giày thể thao vào các ngày thứ Hai, thứ Tư, thứ Sáu. Vào thứ Ba và thứ Năm (ngày có tiết Thể chất và sinh hoạt CLB), học sinh mặc đồng phục thể thao màu xanh navy đặc trưng của trường. Trong các dịp lễ khai giảng, bế giảng hoặc sự kiện quốc tế, học sinh mặc áo vest đồng phục UMS.",
        "keywords": ["đồng phục", "trang phục", "áo sơ mi", "quần thể thao", "phù hiệu", "nề nếp"]
    },
    {
        "id": "QA-04",
        "category": "regulations",
        "question": "Quy chế sử dụng điện thoại thông minh và thiết bị điện tử trong trường học UMS ra sao?",
        "answer": "Để bảo đảm sự tập trung và tương tác xã hội lành mạnh, học sinh phải cất điện thoại thông minh và đồng hồ thông minh vào tủ đồ cá nhân của lớp học ngay đầu giờ sáng (7h20). Học sinh chỉ được phép sử dụng máy tính bảng hoặc laptop trong lớp khi có yêu cầu và sự giám sát trực tiếp của giáo viên bộ môn cho các dự án PBL hoặc bài tập tra cứu. Mọi hành vi dùng thiết bị chơi game, lướt mạng xã hội trái phép sẽ bị tạm giữ và thông báo cho phụ huynh.",
        "keywords": ["điện thoại", "thiết bị điện tử", "smartphone", "tủ đồ", "chơi game", "nội quy"]
    },
    {
        "id": "QA-05",
        "category": "clubs",
        "question": "Lịch sinh hoạt và cơ chế đăng ký câu lạc bộ (CLB) ngoại khóa tại UMS như thế nào?",
        "answer": "Hệ thống CLB UMS hoạt động vào chiều thứ Ba và thứ Năm hàng tuần (15h30 - 17h00). Mỗi học sinh được đăng ký tối đa 2 CLB (1 CLB học thuật/ngôn ngữ và 1 CLB nghệ thuật/thể thao) vào đầu năm học qua cổng UMS Hub. Các CLB nổi bật gồm: UMS Debate Club, U-STEM Robotics, Green Earth, U-Press & Media, Arts & Culture, CLB Bóng rổ UMS Dragons. Tham gia CLB là tiêu chí quan trọng để tích lũy huy hiệu cho Hộ chiếu Năng lực Số.",
        "keywords": ["câu lạc bộ", "CLB", "ngoại khóa", "debate", "robotics", "green earth", "thứ ba", "thứ năm"]
    },
    {
        "id": "QA-06",
        "category": "clubs",
        "question": "CLB Tranh biện UMS Debate Club có gì đặc biệt và học sinh được tôi luyện kỹ năng nào?",
        "answer": "UMS Debate Club được bảo trợ chuyên môn bởi Khoa Sư phạm Tiếng Anh - ULIS và CLB Tranh biện CNN. Học sinh được huấn luyện tranh biện song ngữ theo các luật quốc tế (Karl Popper, WSDC). CLB rèn luyện tư duy phản biện đa chiều, kỹ năng nghiên cứu dữ liệu thực chứng và phong thái hùng biện trước đám đông. Thành viên thường xuyên tham gia giải UMS Debate Open, HN-AMS Debate Tournament và các diễn đàn trẻ ĐHQGHN.",
        "keywords": ["debate", "tranh biện", "hùng biện", "phản biện", "WSDC", "CLB debate"]
    },
    {
        "id": "QA-07",
        "category": "clubs",
        "question": "CLB U-STEM Robotics hỗ trợ học sinh tham gia nghiên cứu và thi đấu sáng tạo kỹ thuật như thế nào?",
        "answer": "U-STEM Robotics sở hữu không gian sáng chế Makerspace trang bị máy in 3D, vi điều khiển BBC Micro:bit, Arduino, linh kiện LEGO Education SPIKE Prime. Dưới sự dẫn dắt của các giảng viên Đại học Quốc gia Hà Nội, thành viên được học lập trình Scratch, Python, C++, chế tạo robot dò đường và hệ thống IoT bảo vệ môi trường, định kỳ tham dự giải Robothon quốc gia và WRO (World Robot Olympiad).",
        "keywords": ["STEM", "robotics", "microbit", "arduino", "makerspace", "lập trình", "U-STEM"]
    },
    {
        "id": "QA-08",
        "category": "academics",
        "question": "Chương trình Ngoại ngữ 2 tại UMS được triển khai với những ngôn ngữ nào và chuẩn đầu ra ra sao?",
        "answer": "Học sinh UMS được tự chọn học một trong 5 Ngoại ngữ 2: Tiếng Nhật, Tiếng Đức, Tiếng Pháp, Tiếng Hàn hoặc Tiếng Trung với thời lượng 3 tiết/tuần từ lớp 6. Chuẩn đầu ra Ngoại ngữ 2 khi tốt nghiệp lớp 9 đạt trình độ tương đương Bậc 1 - 2 theo Khung 6 bậc (A1 - A2 CEFR), tạo bàn đạp thuận lợi cho học sinh thi tuyển vào các lớp chuyên ngữ tương ứng tại THPT Chuyên Ngoại ngữ (CNN).",
        "keywords": ["ngoại ngữ 2", "tiếng Nhật", "tiếng Đức", "tiếng Pháp", "tiếng Hàn", "tiếng Trung", "CEFR"]
    },
    {
        "id": "QA-09",
        "category": "academics",
        "question": "Quy chế đánh giá học tập qua dự án liên môn (PBL) được quy đổi điểm như thế nào theo Thông tư 22/2021/TT-BGDĐT?",
        "answer": "Theo Thông tư 22/2021/TT-BGDĐT và đề án đổi mới đánh giá tại UMS, điểm số các sản phẩm dự án PBL (bài thuyết trình, video phóng sự, mô hình kỹ thuật STEM, báo cáo khoa học) được giáo viên quy đổi chính thức thành điểm Đánh giá Thường xuyên (ĐGTX) hoặc điểm Đánh giá Định kỳ (ĐGĐK) của các môn học liên quan. Điểm rubric được lưu vết công khai trên UMS Smart Growth Hub để học sinh và phụ huynh theo dõi.",
        "keywords": ["PBL", "học tập dự án", "thông tư 22", "quy đổi điểm", "đánh giá thường xuyên", "định kỳ"]
    },
    {
        "id": "QA-10",
        "category": "academics",
        "question": "Khung Rubric đánh giá năng lực 10 điểm của Core AI Engine tại UMS gồm những tiêu chí thành phần nào?",
        "answer": "Core AI Engine đánh giá sản phẩm học sinh dựa trên 4 tiêu chí chuẩn GDPT 2018 với thang điểm 10.0: (1) Kiến thức chuyên môn & Chiều sâu nội dung (tối đa 3.0 điểm); (2) Năng lực ngôn ngữ & Truyền thông đa phương thức (tối đa 2.5 điểm); (3) Tư duy phản biện, Sáng tạo & Giải quyết vấn đề (tối đa 2.5 điểm); (4) Hợp tác nhóm & Đạo đức học thuật (tối đa 2.0 điểm). Hệ thống đồng thời gắn tối thiểu 3 thẻ kỹ năng minh chứng.",
        "keywords": ["rubric", "thang điểm 10", "tiêu chí", "core AI", "chiều sâu", "ngôn ngữ", "sáng tạo", "hợp tác"]
    },
    {
        "id": "QA-11",
        "category": "academics",
        "question": "Làm thế nào để phụ huynh đọc và hiểu đúng Biểu đồ Mạng nhện Năng lực (Competency Radar Chart) của con?",
        "answer": "Biểu đồ mạng nhện thể hiện sự cân bằng giữa 15 chỉ số (5 Phẩm chất: Yêu nước, Nhân ái, Chăm chỉ, Trung thực, Trách nhiệm; 3 Năng lực chung: Tự chủ, Giao tiếp hợp tác, Sáng tạo; và 7 Năng lực đặc thù: Ngôn ngữ, Tính toán, KHTN, Công nghệ, Tin học, Thẩm mỹ, Thể chất). Vùng mạng nhện càng mở rộng đều thể hiện học sinh phát triển toàn diện. Phụ huynh có thể bật đường nét đứt để so sánh với mức trung bình khối và bấm vào từng đỉnh để xem dự án đóng góp.",
        "keywords": ["biểu đồ radar", "mạng nhện", "năng lực", "phẩm chất", "15 chỉ số", "so sánh khối"]
    },
    {
        "id": "QA-12",
        "category": "academics",
        "question": "Hộ chiếu Năng lực Số (Student Digital Passport) của học sinh UMS có cấu trúc và công dụng gì?",
        "answer": "Hộ chiếu Năng lực Số là bản CV học thuật điện tử chuẩn hóa tổng hợp toàn bộ hành trình 4 năm THCS của học sinh: điểm GPA, chứng chỉ CEFR/IELTS, top dự án xuất sắc, biểu đồ radar năng lực và nhận xét của giáo viên. Bản hộ chiếu có thể xuất file PDF in ấn sắc nét và đính kèm mã QR xác thực số, giúp học sinh nộp hồ sơ chuyển cấp vào THPT Chuyên Ngoại ngữ, xin học bổng hoặc tham gia trại hè quốc tế.",
        "keywords": ["hộ chiếu năng lực", "digital passport", "CV học sinh", "xuất PDF", "mã QR", "chuyển cấp"]
    },
    {
        "id": "QA-13",
        "category": "academics",
        "question": "Quy trình sinh bản nhận xét học kỳ bằng AI và vai trò tinh chỉnh của Giáo viên chủ nhiệm diễn ra như thế nào?",
        "answer": "AI Engine tổng hợp lịch sử nộp bài, điểm rubric và hoạt động CLB để đề xuất bản nhận xét 3 phần: (1) Năng lực chuyên môn & Ngoại ngữ; (2) Phẩm chất & Kỹ năng mềm; (3) Định hướng chuyển cấp CNN/THPT chuyên. Bản nhận xét cam đoan 100% không chứa placeholder. Giáo viên chủ nhiệm có toàn quyền rà soát, chỉnh sửa câu chữ trực tiếp để đảm bảo phản ánh sâu sắc tâm tư và nét riêng của học trò trước khi phê duyệt chính thức.",
        "keywords": ["nhận xét học kỳ", "AI report", "giáo viên chủ nhiệm", "tinh chỉnh", "chuyển cấp CNN"]
    },
    {
        "id": "QA-14",
        "category": "admissions",
        "question": "Kỳ thi tuyển sinh vào Lớp 10 THPT Chuyên Ngoại ngữ (CNN – FLSS) có cấu trúc các bài thi như thế nào?",
        "answer": "Kỳ thi tuyển sinh vào lớp 10 CNN bao gồm 3 bài thi Đánh giá Năng lực bắt buộc: (1) Bài thi ĐGNL Ngoại ngữ (Trắc nghiệm và Tự luận, hệ số 2, thời gian 90 phút); (2) Bài thi ĐGNL Toán & Khoa học Tự nhiên (Trắc nghiệm, hệ số 1, thời gian 55 phút); (3) Bài thi ĐGNL Văn & Khoa học Xã hội (Trắc nghiệm và Tự luận, hệ số 1, thời gian 55 phút). Đề thi tập trung đánh giá tư duy logic, năng lực đọc hiểu và khả năng diễn đạt học thuật.",
        "keywords": ["tuyển sinh lớp 10", "CNN", "chuyên ngoại ngữ", "cấu trúc bài thi", "đánh giá năng lực"]
    },
    {
        "id": "QA-15",
        "category": "admissions",
        "question": "Học sinh UMS có những ưu thế đặc biệt nào khi tham gia thi tuyển vào THPT Chuyên Ngoại ngữ?",
        "answer": "Học sinh UMS được hưởng lợi thế vượt bậc nhờ: (1) Môi trường học tập liên thông cùng khuôn viên ĐHQGHN, làm quen sớm với phương pháp giảng dạy đại học; (2) Trình độ ngoại ngữ chuyên sâu đạt B2/C1 ngay từ cấp 2; (3) Năng lực tranh biện, thuyết trình và tư duy phản biện đã được rèn giũa qua hàng chục dự án PBL; (4) Hồ sơ Hộ chiếu Năng lực Số thể hiện rõ nét phẩm chất và minh chứng thực chất theo đúng chuẩn đầu vào của CNN.",
        "keywords": ["ưu thế UMS", "thi CNN", "liên thông", "lợi thế học sinh UMS", "b2", "c1"]
    },
    {
        "id": "QA-16",
        "category": "regulations",
        "question": "Quy định về việc xin nghỉ phép và quy trình học bù, nộp bù bài dự án tại UMS như thế nào?",
        "answer": "Khi học sinh có việc đột xuất hoặc lý do sức khỏe cần nghỉ học, phụ huynh phải gửi Đơn xin nghỉ phép qua ứng dụng UMS Hub hoặc liên hệ trực tiếp GVCN trước 7h15 sáng. Trường hợp nghỉ ốm trên 3 ngày cần có giấy xác nhận của cơ sở y tế. Học sinh vắng mặt vào ngày nộp dự án PBL được gia hạn tối đa 3 ngày và được giáo viên bộ môn hướng dẫn nộp bổ sung trực tuyến lên Project Vault mà không bị trừ điểm chuyên cần.",
        "keywords": ["nghỉ phép", "xin nghỉ học", "học bù", "nộp bù bài", "ốm đau", "quy trình nghỉ"]
    },
    {
        "id": "QA-17",
        "category": "wellbeing",
        "question": "Nhà trường có tuyến xe bus đưa đón học sinh không và quy trình bảo đảm an toàn như thế nào?",
        "answer": "UMS hợp tác với các đơn vị vận tải chuyên nghiệp cung cấp gần 15 tuyến xe bus đưa đón học sinh tại các điểm tập kết trên các quận Cầu Giấy, Nam Từ Liêm, Bắc Từ Liêm, Ba Đình, Đống Đa, Tây Hồ, Thanh Xuân, Hà Đông. Mỗi xe đều có giám sát viên phụ trách điểm danh, thắt dây an toàn và liên hệ với phụ huynh qua Zalo/App khi xe đón/trả học sinh. Toàn bộ xe được kiểm định an toàn định kỳ nghiêm ngặt.",
        "keywords": ["xe bus", "đưa đón học sinh", "tuyến xe", "an toàn", "điểm đón"]
    },
    {
        "id": "QA-18",
        "category": "wellbeing",
        "question": "Dịch vụ y tế và phòng tư vấn tâm lý học đường tại UMS hoạt động ra sao để chăm sóc học sinh?",
        "answer": "Phòng Y tế UMS trực thuộc Trạm Y tế ĐHQGHN, luôn có bác sĩ và điều dưỡng túc trực xử lý sơ cấp cứu, khám sức khỏe định kỳ và bảo hiểm y tế. Đồng thời, Tổ Tư vấn Tâm lý Học đường (với sự tham gia của các chuyên gia tâm lý Trường Đại học Giáo dục & ULIS) mở cửa 5 ngày/tuần, hỗ trợ giải tỏa áp lực học tập, định hướng giới tính lứa tuổi dậy thì và tư vấn phương pháp quản lý cảm xúc hoàn toàn bảo mật.",
        "keywords": ["y tế", "tư vấn tâm lý", "áp lực học tập", "chăm sóc sức khỏe", "tâm lý học đường"]
    },
    {
        "id": "QA-19",
        "category": "wellbeing",
        "question": "Các kênh thông tin liên lạc chính thức giữa Nhà trường và Gia đình bao gồm những kênh nào?",
        "answer": "Hệ sinh thái liên lạc UMS gồm: (1) Cổng thông tin & Ứng dụng UMS Smart Growth Hub cập nhật điểm số, nhật ký dự án và dòng thời gian phát triển; (2) Sổ liên lạc điện tử cập nhật điểm danh hàng ngày; (3) Hộp thoại Trợ lý AI giải đáp thắc mắc 24/7; (4) Các buổi họp phụ huynh đầu kỳ, cuối kỳ theo mô hình 'Hội thảo Chia sẻ & Đồng hành' nơi học sinh trực tiếp thuyết trình báo cáo thành tích với cha mẹ.",
        "keywords": ["liên lạc", "nhà trường và gia đình", "kênh liên lạc", "họp phụ huynh", "UMS Hub"]
    },
    {
        "id": "QA-20",
        "category": "academics",
        "question": "Các sự kiện và ngày hội văn hóa - khoa học thường niên nào tạo nên dấu ấn bản sắc học sinh UMS?",
        "answer": "Bản sắc UMS được thể hiện qua các chuỗi sự kiện truyền thống quy mô: (1) UMS Language & Cultural Festival (Ngày hội Văn hóa Ngôn ngữ đa quốc gia); (2) UMS Science Fair & Maker Day (Ngày hội Sáng tạo STEM và Công nghệ); (3) UMS Debate Championship (Giải Tranh biện mở rộng); (4) Hội trại Xuân UMSer Khát vọng Vươn xa; (5) Dạ hội Âm nhạc và Kịch nghệ Chào mừng Ngày Nhà giáo Việt Nam 20/11.",
        "keywords": ["sự kiện", "ngày hội văn hóa", "science fair", "festival", "bản sắc UMS", "hội trại"]
    }
]

# ==============================================================================
# 7. GROWTH TIMELINE MILESTONES (FOR PARENT VIEW)
# ==============================================================================

GROWTH_TIMELINE_SEED_DATA: List[Dict[str, Any]] = [
    {
        "id": "tl_001",
        "student_id": "usr_stu_003",
        "date": "2026-05-12",
        "title": "Dự án Di sản Số Chèo & Tranh Đông Hồ đạt 9.6 điểm xuất sắc",
        "description": "Dự án 'Bảo tồn văn hóa dân gian Việt Nam qua lăng kính Gen Z' được Cô Thu Hà chấm điểm 9.6, đánh giá cao tinh thần tự hào dân tộc và sản phẩm thẻ tương tác AR.",
        "category": "project",
        "badge": "Đại sứ Văn hóa Di sản",
        "score": 9.6,
        "project_id": "PRJ-SOC-2026-08A1-02",
        "teacher_note": "Bài làm sáng tạo đột phá, cô rất tự hào về tinh thần nghiên cứu điền dã của nhóm!"
    },
    {
        "id": "tl_002",
        "student_id": "usr_stu_003",
        "date": "2026-04-15",
        "title": "Giành giải Top Speaker tại Vòng Chung kết UMS Debate Tournament",
        "description": "Trần Đức Anh xuất sắc đạt danh hiệu Top Speaker với phần tranh biện về chủ đề 'Đạo đức trong ứng dụng Trí tuệ nhân tạo học đường'.",
        "category": "competition",
        "badge": "Cây hùng biện UMS 2025",
        "score": None,
        "project_id": None,
        "teacher_note": "Tư duy phản biện và phong thái thuyết trình của em ngày càng vững vàng."
    },
    {
        "id": "tl_003",
        "student_id": "usr_stu_003",
        "date": "2026-03-17",
        "title": "Hoàn thành thuyết trình 'AI in Future Education' với mô hình 3E Synergy",
        "description": "Bài thuyết trình nghiên cứu liên môn Tiếng Anh được Core AI Engine và giáo viên đánh giá 9.5 điểm.",
        "category": "project",
        "badge": "AI Literacy Pioneer",
        "score": 9.5,
        "project_id": "PRJ-ENG-2026-08A1-01",
        "teacher_note": "Số liệu khảo sát 180 học sinh UMS rất chân thực và có giá trị thực tiễn."
    },
    {
        "id": "tl_004",
        "student_id": "usr_stu_003",
        "date": "2026-01-10",
        "title": "Nhận xét Học kỳ I: Học sinh Tiêu biểu Toàn diện Lớp 8A1",
        "description": "Bản nhận xét học kỳ 1 của Cô giáo chủ nhiệm Đỗ Tuệ Uyên ghi nhận thành tích GPA 9.2 và tinh thần cống hiến tại U-Press.",
        "category": "report",
        "badge": "Học sinh Tiêu biểu Kỳ I",
        "score": None,
        "project_id": None,
        "teacher_note": "Đức Anh luôn là chỗ dựa tinh thần tin cậy cho các bạn trong các hoạt động tập thể."
    },
    {
        "id": "tl_005",
        "student_id": "usr_stu_001",
        "date": "2026-01-20",
        "title": "Hoàn thành Capstone Project: Khủng hoảng người tị nạn khí hậu",
        "description": "Phạm Quỳnh Anh hoàn thành bài nghiên cứu tốt nghiệp THCS đạt 9.7 điểm, hướng tới kỳ thi tuyển sinh Chuyên Ngoại ngữ.",
        "category": "project",
        "badge": "Best Delegate UMS MUN",
        "score": 9.7,
        "project_id": "PRJ-CAP-2026-09A1-01",
        "teacher_note": "Một nghiên cứu học thuật tầm vóc, sẵn sàng bước vào ngưỡng cửa CNN!"
    },
    {
        "id": "tl_006",
        "student_id": "usr_stu_002",
        "date": "2026-04-22",
        "title": "Thử nghiệm thành công Giàn Thủy canh Thông minh IoT tại Vườn trường",
        "description": "Hệ thống Micro:bit điều khiển tự động của nhóm Nguyễn Mai Chi đạt tỷ lệ sống của cây 96.5% sau 21 ngày thử nghiệm.",
        "category": "project",
        "badge": "STEM Champion 2026",
        "score": 9.4,
        "project_id": "PRJ-STEM-2026-07A2-03",
        "teacher_note": "Mai Chi thể hiện phẩm chất của một kỹ sư trẻ đầy triển vọng."
    },
    {
        "id": "tl_007",
        "student_id": "usr_stu_004",
        "date": "2026-03-02",
        "title": "Nộp thành công Dự án Môi trường Xanh: Kế hoạch phân loại rác",
        "description": "Lê Hoàng Nam hoàn thành sản phẩm dự án đầu tay tại UMS với bộ infographic tuyên truyền tái chế tại tòa A2.",
        "category": "project",
        "badge": "Đại sứ Môi trường Lớp 6A1",
        "score": 8.5,
        "project_id": "PRJ-ENV-2026-06A1-01",
        "teacher_note": "Nam hòa nhập rất nhanh và luôn tích cực trong các hoạt động bảo vệ môi trường của trường."
    }
]

# ==============================================================================
# 8. SEMESTER REPORTS SEED DATA
# ==============================================================================

REPORTS_SEED_DATA: List[Dict[str, Any]] = [
    {
        "report_id": "REP-2026-08A1-012",
        "student_id": "usr_stu_003",
        "student_name": "Trần Đức Anh",
        "grade_level": 8,
        "class_name": "8A1",
        "semester": "Học kỳ I",
        "school_year": "2025-2026",
        "teacher_id": "usr_tea_001",
        "teacher_name": "Cô Đỗ Tuệ Uyên",
        "teacher_type": "homeroom",
        "academic_eval": "Đức Anh có thế mạnh nổi bật trong các môn Khoa học Xã hội và Ngoại ngữ. Điểm GPA đạt 9.2 với kỹ năng viết học thuật và diễn đạt tiếng Anh lưu loát tương đương chuẩn B2 CEFR. Em hoàn thành xuất sắc bài nghiên cứu 3E Synergy về ứng dụng AI học đường với điểm số 9.5.",
        "soft_skills_eval": "Em là một học sinh chăm chỉ, có tinh thần trách nhiệm và đạo đức học thuật chuẩn mực. Trên cương vị Phó Chủ tịch CLB Tranh biện UMS và thành viên ban nội dung U-Press, Đức Anh thể hiện khả năng truyền cảm hứng, biết lắng nghe và tôn trọng sự khác biệt của đồng đội.",
        "highschool_pathway_advice": "Với năng lực ngôn ngữ và tư duy phản biện hiện tại, Đức Anh có tiềm năng rất lớn để thi đỗ vào lớp Chuyên Anh hoặc Chuyên Pháp tại THPT Chuyên Ngoại ngữ (CNN – FLSS). Em nên tiếp tục duy trì cọ xát tại các giải tranh biện và đầu tư thêm vào các dạng toán thực tế để tối ưu điểm bài thi ĐGNL Khoa học Tự nhiên.",
        "status": "finalized",
        "created_at": "2026-01-12T10:00:00Z",
        "updated_at": "2026-01-12T10:00:00Z"
    },
    {
        "report_id": "REP-2026-09A1-001",
        "student_id": "usr_stu_001",
        "student_name": "Phạm Quỳnh Anh",
        "grade_level": 9,
        "class_name": "9A1",
        "semester": "Học kỳ I",
        "school_year": "2025-2026",
        "teacher_id": "usr_tea_001",
        "teacher_name": "Cô Đỗ Tuệ Uyên",
        "teacher_type": "homeroom",
        "academic_eval": "Quỳnh Anh đạt thành tích học tập toàn diện xuất sắc với GPA 9.4, điểm tổng kết môn Tiếng Anh đạt 9.8 và trình độ IELTS 7.5 (C1). Đề tài Capstone tốt nghiệp về khủng hoảng người tị nạn khí hậu đạt 9.7 điểm, chứng minh năng lực nghiên cứu độc lập của một học giả trẻ.",
        "soft_skills_eval": "Phong thái đĩnh đạc, khả năng điều hành xuất sắc trong vai trò Chủ tịch CLB Tranh biện và Trưởng ban tổ chức Hội nghị Mô phỏng Liên Hợp Quốc UMS MUN 2025. Em luôn chan hòa, nhân ái và sẵn sàng hỗ trợ các bạn khóa dưới.",
        "highschool_pathway_advice": "Quỳnh Anh hoàn toàn sẵn sàng cho kỳ thi tuyển sinh vào THPT Chuyên Ngoại ngữ. Em là ứng viên sáng giá cho vị trí thủ khoa hoặc nhận học bổng danh dự của trường CNN. Hồ sơ Hộ chiếu Năng lực Số của em là minh chứng hoàn hảo cho một học sinh toàn cầu thế hệ mới.",
        "status": "finalized",
        "created_at": "2026-01-15T09:00:00Z",
        "updated_at": "2026-01-15T09:00:00Z"
    }
]
