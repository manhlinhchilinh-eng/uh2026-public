"""
Shared test configuration, fixtures, sample payloads, and mock clients
for UMS Smart Growth Hub E2E and Unit Test Suites.
Dual-compatible with pytest and python -m unittest.
"""

import re
import os
import sys
from pathlib import Path
from typing import Optional, Any, Dict, List

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Optional pytest import for fixtures
try:
    import pytest
except ImportError:
    # Minimal decorator shim if running purely in unittest without pytest installed
    class _MockPytest:
        @staticmethod
        def fixture(func=None, **kwargs):
            if func:
                return func
            return lambda f: f
    pytest = _MockPytest()


# ============================================================================
# 1. TAXONOMY & VALIDATION CONSTANTS
# ============================================================================

SKILL_TAXONOMY_28 = {
    # Cluster A: Ngôn ngữ & Giao tiếp (6 skills)
    "skill_en_academic_writing": {"name": "Viết học thuật tiếng Anh", "cluster": "Ngôn ngữ & Giao tiếp"},
    "skill_vn_creative_expression": {"name": "Diễn đạt ngôn ngữ tiếng Việt sáng tạo", "cluster": "Ngôn ngữ & Giao tiếp"},
    "skill_public_speaking": {"name": "Thuyết trình trước đám đông", "cluster": "Ngôn ngữ & Giao tiếp"},
    "skill_debate_argumentation": {"name": "Tranh biện phản biện đa chiều", "cluster": "Ngôn ngữ & Giao tiếp"},
    "skill_multilingual_competence": {"name": "Sử dụng linh hoạt song ngữ Anh - Việt", "cluster": "Ngôn ngữ & Giao tiếp"},
    "skill_multimodal_storytelling": {"name": "Nghệ thuật kể chuyện đa phương tiện", "cluster": "Ngôn ngữ & Giao tiếp"},

    # Cluster B: Nghiên cứu & Tư duy (6 skills)
    "skill_scientific_inquiry": {"name": "Phương pháp nghiên cứu khoa học", "cluster": "Nghiên cứu & Tư duy"},
    "skill_critical_analysis": {"name": "Phân tích dữ liệu & nguồn tài liệu", "cluster": "Nghiên cứu & Tư duy"},
    "skill_problem_solving": {"name": "Giải quyết vấn đề phức tạp", "cluster": "Nghiên cứu & Tư duy"},
    "skill_creative_design": {"name": "Tư duy sáng tạo & thiết kế giải pháp", "cluster": "Nghiên cứu & Tư duy"},
    "skill_data_interpretation": {"name": "Đọc hiểu & phân tích số liệu", "cluster": "Nghiên cứu & Tư duy"},
    "skill_systems_thinking": {"name": "Tư duy hệ thống & quan hệ nhân quả", "cluster": "Nghiên cứu & Tư duy"},

    # Cluster C: Số hóa & Công nghệ (5 skills)
    "skill_stem_prototyping": {"name": "Chế tạo mô hình thực nghiệm STEM", "cluster": "Số hóa & Công nghệ"},
    "skill_digital_literacy": {"name": "Ứng dụng công cụ số xử lý thông tin", "cluster": "Số hóa & Công nghệ"},
    "skill_media_production": {"name": "Biên tập video & podcast truyền thông", "cluster": "Số hóa & Công nghệ"},
    "skill_coding_automation": {"name": "Lập trình ứng dụng & tự động hóa", "cluster": "Số hóa & Công nghệ"},
    "skill_ethical_ai_usage": {"name": "Sử dụng trí tuệ nhân tạo có đạo đức", "cluster": "Số hóa & Công nghệ"},

    # Cluster D: Cá nhân & Tự chủ (5 skills)
    "skill_self_directed_learning": {"name": "Tự chủ kế hoạch học tập", "cluster": "Cá nhân & Tự chủ"},
    "skill_metacognitive_reflection": {"name": "Năng lực phản tư & tự đánh giá", "cluster": "Cá nhân & Tự chủ"},
    "skill_time_management": {"name": "Quản lý thời gian & tiến độ dự án", "cluster": "Cá nhân & Tự chủ"},
    "skill_growth_mindset": {"name": "Tư duy cầu tiến & đón nhận thử thách", "cluster": "Cá nhân & Tự chủ"},
    "skill_intellectual_curiosity": {"name": "Tính hiếu tri khoa học", "cluster": "Cá nhân & Tự chủ"},

    # Cluster E: Xã hội & Hợp tác (6 skills)
    "skill_teamwork_collaboration": {"name": "Làm việc nhóm & phối hợp đồng đội", "cluster": "Xã hội & Hợp tác"},
    "skill_leadership_coordination": {"name": "Năng lực điều phối & lãnh đạo nhóm", "cluster": "Xã hội & Hợp tác"},
    "skill_peer_empathy": {"name": "Thấu cảm & hỗ trợ đồng môn", "cluster": "Xã hội & Hợp tác"},
    "skill_academic_integrity": {"name": "Tuân thủ đạo đức học thuật & trích dẫn", "cluster": "Xã hội & Hợp tác"},
    "skill_community_engagement": {"name": "Hoạt động phục vụ cộng đồng", "cluster": "Xã hội & Hợp tác"},
    "skill_cultural_awareness": {"name": "Nhận thức bản sắc văn hóa dân tộc", "cluster": "Xã hội & Hợp tác"},
}

# Strict blacklist regex for unhandled placeholders
PLACEHOLDER_REGEX = re.compile(
    r"(\[(?:Tên|Tên học sinh|Học sinh|Em|Student Name|Môn học|Môn|Subject|Điểm|Điểm số|Score|Lớp|Grade|Class|X|Y)\]|"
    r"\bundefined\b|\bnull\b|\bNaN\b|\bNone\b|\[object Object\]|"
    r"\{[a-zA-Z0-9_\.\$]+\}|\{\{[a-zA-Z0-9_\.\$]+\}\})"
)

def validate_no_placeholders(text: str) -> List[str]:
    """
    Scans text for forbidden placeholder tokens while safely ignoring
    legitimate numeric citations like [1], [2], [2026] or [APA].
    Returns list of offending placeholder strings.
    """
    if not text:
        return []
    matches = PLACEHOLDER_REGEX.findall(text)
    return matches


# ============================================================================
# 2. AUTHENTIC SAMPLE DATASETS & PAYLOADS
# ============================================================================

SAMPLE_ENGLISH_PBL = {
    "submission_id": "PRJ-ENG-2026-08A1-01",
    "student_id": "UMS-9A1-001",
    "student_name": "Phạm Quỳnh Anh",
    "title": "AI in Future Education: Empowering Personalized Learning while Preserving Human Empathy",
    "category": "english_presentation",
    "language": "en",
    "grade_level": 8,
    "attachments": [
        "https://drive.google.com/ums-debate-ai-slides.pdf",
        "https://youtu.be/ums-presentation-ai-education"
    ],
    "content": """Topic: AI in Future Education: Empowering Personalized Learning while Preserving Human Empathy
Presenters: Pham Quynh Anh & Tran Duc Anh (UMS Debate Club)
Target Audience: Middle School Teachers, Students, and School Administrators

1. Abstract & Introduction
Artificial Intelligence (AI) is fundamentally transforming education from a standardized, one-size-fits-all model into an adaptive, deeply personalized learning ecosystem. In secondary schools like UMS, students demonstrate vastly different learning paces, cognitive styles, and linguistic affinities. However, excessive reliance on automated tutors risks eroding interpersonal empathy, critical skepticism, and collaborative teamwork. Our project investigates the synergistic boundary: How can secondary education leverage AI diagnostic engines to elevate personalized competency development without compromising human moral connection?

2. Research Problem & Field Survey
We conducted an empirical survey of 180 UMS middle schoolers across Grades 7, 8, and 9:
- 78% utilize AI tools (ChatGPT, Claude, Grammarly) for foreign language drafting and idea brainstorming.
- 62% express anxiety that AI feedback feels transactional and lacks emotional encouragement compared to teacher mentorship.
- 85% desire an integrated school portfolio that tracks their long-term growth across projects rather than isolated test scores.

3. Proposed Framework: "The 3E Synergy" (Empower, Evaluate, Empathize)
- Empower: Generative AI acts as a 24/7 personal inquiry companion, providing scaffolded grammar correction, vocabulary expansion in English/French/German, and adaptive math exercises tailored to GDPT 2018 standards.
- Evaluate: Automated rubric scoring based on verifiable artifacts (project vaults, code repositories, debate transcripts), liberating educators from mechanical grading.
- Empathize: Reallocating 40% of teacher administrative time toward socio-emotional counseling, ethical leadership seminars, and one-on-one student coaching.

4. Ethical Safeguards & Algorithmic Responsibility
We formulate an ethical code for young scholars:
1. Transparency: Mandatory citation of AI assistance in project bibliographies following APA 7th standards.
2. Original Voice: AI may refine syntax, but the core thesis, experimental data, and moral reflection must originate from human inquiry.
3. Equity: Ensuring equal hardware and software access across all school demographics to avoid a digital learning divide.

5. Conclusion & Actionable Call to UMS Community
Technology is not the destination; it is the catalyst. By pairing algorithmic precision with pedagogical compassion, UMS can pioneer a high-school readiness pathway that equips future CNN scholars to become global citizens who think critically, innovate fearlessly, and care deeply.""",
    "reflection": "Khi chuẩn bị bài thuyết trình này, nhóm em đã phải sửa cấu trúc luận điểm 4 lần để không bị biến bài nói thành bài quảng cáo công nghệ. Em học được rằng kỹ năng phản biện không phải là chê bai công nghệ, mà là tìm ra điểm cân bằng để công nghệ phục vụ con người. Phần làm việc nhóm giúp em và Đức Anh phối hợp ăn ý giữa tìm kiếm số liệu khảo sát và thiết kế slide trên Canva."
}

SAMPLE_STEM_PBL = {
    "submission_id": "PRJ-STEM-2026-07A2-03",
    "student_id": "UMS-7A2-005",
    "student_name": "Nguyễn Mai Chi",
    "title": "Smart Hydroponic System with IoT & Micro:bit for School Rooftop Garden",
    "category": "stem_scientific",
    "language": "vi",
    "grade_level": 7,
    "attachments": [
        "https://github.com/ums-stem/smart-hydroponic-microbit",
        "https://drive.google.com/ums-iot-lab-report.pdf"
    ],
    "content": """Báo cáo Nghiên cứu Kỹ thuật: Hệ thống Thủy canh Thông minh Ứng dụng IoT và Vi điều khiển Micro:bit cho Vườn Sinh học UMS
Nhóm tác giả: Nguyễn Mai Chi (Trưởng nhóm), Lê Tuấn Minh, Hoàng Khánh Linh (Lớp 7A2 - UMS)
Giáo viên hướng dẫn: ThS. Trần Thị Thanh Hương (Bộ môn KHTN & Công nghệ)

1. Đặt vấn đề và Mục tiêu Nghiên cứu
Khu vườn thực nghiệm trên tầng thượng trường THCS Ngoại ngữ thường xuyên gặp khó khăn trong việc duy trì độ ẩm và nồng độ dinh dưỡng (TDS) ổn định do thời tiết Hà Nội mùa hè nắng gắt và mùa đông hanh khô. Việc tưới tiêu thủ công gây lãng phí 35% lượng nước và cây rau xà lách thủy canh thường bị úng rễ hoặc cháy lá.
Mục tiêu dự án:
1. Chế tạo hệ thống hồi lưu thủy canh thông minh tự động giám sát pH, nhiệt độ nước và chỉ số TDS.
2. Lập trình vi điều khiển Micro:bit kết hợp ESP8266 gửi dữ liệu theo thời gian thực về Dashboard Adafruit IO.
3. Tối ưu hóa chu kỳ bơm dinh dưỡng tự động dựa trên độ ẩm và cường độ ánh sáng, tiết kiệm điện năng 30%.

2. Thiết kế Phần cứng và Sơ đồ Khối (Hardware Architecture)
- Bộ điều khiển trung tâm: BBC Micro:bit v2 kết hợp mạch mở rộng IOBit.
- Cảm biến sử dụng: Cảm biến độ đục TDS Meter V1.0, cảm biến nhiệt độ chống nước DS18B20, cảm biến quang trở LDR, cảm biến siêu âm HC-SR04 đo lượng dung dịch.
- Cơ cấu chấp hành: Relay 5V 2 kênh điều khiển máy bơm chìm 12V DC và quạt làm mát nước; màn hình LCD 1602 I2C; module ESP8266 truyền MQTT.

3. Thuật toán Điều khiển & Mã nguồn MicroPython
Hệ thống đo đạc thông số liên tục mỗi 5 giây. Nếu TDS < 550 ppm, kích hoạt relay bơm dung dịch dinh dưỡng A-B trong 2 giây. Nếu nhiệt độ nước > 28.5 độ C, bật quạt làm mát nước để tránh thối rễ rau xà lách.

4. Kết quả Thực nghiệm & Đo lường
Thử nghiệm liên tục trong 21 ngày tại vườn trường:
- Tỷ lệ sống và phát triển của rau xà lách đạt 96.5% (so với 78% của luống đối chứng trồng thủ công).
- Lượng nước tiêu thụ giảm 42.8 lít/tuần nhờ cơ chế tuần hoàn kín.
- Nồng độ dinh dưỡng dao động ổn định trong biên độ tối ưu 620 - 740 ppm.
- Hệ thống gửi cảnh báo Telegram khi mực nước bồn chứa dưới 15%.

5. Hạn chế và Hướng phát triển
Tích hợp tấm pin năng lượng mặt trời 18V có ắc quy lưu trữ để đảm bảo vận hành độc lập khi mất điện và nâng cao tính bền vững môi trường.""",
    "reflection": "Lúc đầu mạch của nhóm em bị chập chờn do cảm biến TDS bị nhiễu sóng từ máy bơm. Thầy cô khuyên nhóm em bọc cách ly mass và dùng tụ lọc 100uF. Nhờ vậy tụi em đã tự sửa được lỗi phần cứng mà không cần mua mạch mới. Em thấy môn KHTN gắn với thực hành lập trình vui hơn rất nhiều so với học công thức suông."
}

SAMPLE_SOCIAL_PBL = {
    "submission_id": "PRJ-SOC-2026-08A1-02",
    "student_id": "UMS-8A1-012",
    "student_name": "Trần Đức Anh",
    "title": "Bảo tồn văn hóa dân gian Việt Nam qua lăng kính Gen Z: Số hóa Nghệ thuật Chèo & Tranh Đông Hồ",
    "category": "social_humanities",
    "language": "bilingual",
    "grade_level": 8,
    "attachments": [
        "https://ums-heritage-dongho.web.app",
        "https://spotify.com/ums-cheo-podcast-ep1"
    ],
    "content": """Dự án Trải nghiệm Liên môn: Bảo tồn Văn hóa Dân gian Việt Nam qua Lăng kính Gen Z
Tên sản phẩm: Bộ cẩm nang số 'Hồn Dân Tộc trong Nét Vẽ Đông Hồ & Tiếng Trống Chèo Sân Đình'
Nhóm thực hiện: Trần Đức Anh & Nhóm Văn Hóa UMS 8A1
Đơn vị phối hợp: Bảo tàng Dân tộc học Việt Nam & Nghệ nhân Nguyễn Đăng Chế (Bắc Ninh)

1. Khát vọng Dự án: Kết nối Quá khứ và Hiện đại
Nhiều bạn học sinh thế hệ Gen Z thường nghĩ nghệ thuật truyền thống như Chèo hay Tranh khắc gỗ Đông Hồ là cổ hủ, khó tiếp cận. Tuy nhiên, khi đào sâu dưới góc nhìn mỹ thuật và triết học nhân sinh, mỗi bức tranh Đông Hồ như 'Đám cưới chuột', 'Vinh hoa - Phú quý', hay mỗi điệu chèo 'Đào liễu' đều chứa đựng tính châm biếm sâu cay, lòng vị tha và ước vọng thái bình của cha ông.
Sứ mệnh của nhóm: 'Dùng công nghệ số và tư duy ngôn ngữ hiện đại để đưa di sản đến gần giới trẻ trong nước và bạn bè quốc tế'.

2. Hành trình Điền dã Thực địa
- Chuyến đi Bắc Ninh: Phỏng vấn Nghệ nhân Ưu tú Nguyễn Đăng Chế, ghi âm quy trình nghiền vỏ điệp, nấu hồ nếp và quét màu tự nhiên từ lá chàm, hoa hòe, than lá tre.
- Chuyến đi Nhà hát Chèo Hà Nội: Phỏng vấn nghệ sĩ biểu diễn về sự chuyển biến phong cách khi tiếp cận khán giả học đường.

3. Sản phẩm Số hóa Đột phá
1. Trang web Tương tác Di sản Số với Audio Guide song ngữ Anh - Việt do học sinh UMS tự thu âm.
2. Bộ Thẻ Học tập Tương tác AR (Augmented Reality): Quét camera vào tranh giấy dó hiển thị đồ họa hoạt họa 2D kèm âm nhạc ngũ cung.
3. Triển lãm học đường 'Di sản trong Ba lô' tại sảnh nhà A2 UMS thu hút 450 lượt học sinh tham quan trải nghiệm in mộc bản lên túi vải canvas.

4. Tác động Xã hội và Thông điệp Tự hào Dân tộc
Bản dịch tiếng Anh của bộ cẩm nang được gửi tặng các giảng viên quốc tế tại ĐHQGHN, lan tỏa thông điệp đại sứ văn hóa học đường.""",
    "reflection": "Khi dịch các thuật ngữ chèo như 'hề áo ngắn', 'đào thương', 'nói lối' sang tiếng Anh, em gặp khó khăn cực kỳ lớn vì không có từ ngữ tương đương tuyệt đối trong từ điển. Em đã phải xin gặp thầy cô Khoa Ngôn ngữ và Văn hóa Anh - ULIS để nhờ tư vấn cách chuyển ngữ giữ nguyên hồn cốt văn hóa dân tộc. Dự án này giúp em hiểu sâu sắc câu nói: 'Học ngoại ngữ là để mang văn hóa Việt Nam ra thế giới'."
}

SAMPLE_PERSONAS = {
    "UMS-6A1-018": {
        "student_id": "UMS-6A1-018",
        "full_name": "Lê Hoàng Nam",
        "grade_level": 6,
        "class_name": "6A1",
        "second_language": "Japanese",
        "clubs": ["Green Earth", "Khoa học Khám phá"],
        "gpa": 8.7,
        "target_highschool": "THPT Chuyên Ngoại ngữ (CNN - ULIS)",
        "radar_scores": {
            "language": 8.5,
            "creativity": 8.0,
            "problem_solving": 8.2,
            "collaboration": 7.8,
            "self_direction": 8.0,
            "digital_tech": 7.9
        }
    },
    "UMS-7A2-005": {
        "student_id": "UMS-7A2-005",
        "full_name": "Nguyễn Mai Chi",
        "grade_level": 7,
        "class_name": "7A2",
        "second_language": "German",
        "clubs": ["U-STEM Robotics", "CLB Toán Vui"],
        "gpa": 9.2,
        "target_highschool": "THPT Chuyên Ngoại ngữ (Khối Chuyên Đức) & Chuyên KHTN",
        "radar_scores": {
            "language": 8.9,
            "creativity": 9.4,
            "problem_solving": 9.5,
            "collaboration": 8.8,
            "self_direction": 9.1,
            "digital_tech": 9.6
        }
    },
    "UMS-8A1-012": {
        "student_id": "UMS-8A1-012",
        "full_name": "Trần Đức Anh",
        "grade_level": 8,
        "class_name": "8A1",
        "second_language": "French",
        "clubs": ["UMS Debate Club", "U-Press & Media"],
        "gpa": 9.1,
        "target_highschool": "THPT Chuyên Ngoại ngữ (Khối Chuyên Anh/Pháp)",
        "radar_scores": {
            "language": 9.6,
            "creativity": 9.2,
            "problem_solving": 8.9,
            "collaboration": 9.4,
            "self_direction": 9.0,
            "digital_tech": 8.7
        }
    },
    "UMS-9A1-001": {
        "student_id": "UMS-9A1-001",
        "full_name": "Phạm Quỳnh Anh",
        "grade_level": 9,
        "class_name": "9A1",
        "second_language": "German",
        "clubs": ["UMS Debate Club", "Model United Nations (MUN)"],
        "gpa": 9.5,
        "target_highschool": "THPT Chuyên Ngoại ngữ (Khối Chuyên Anh CNN - ULIS)",
        "radar_scores": {
            "language": 9.8,
            "creativity": 9.5,
            "problem_solving": 9.3,
            "collaboration": 9.6,
            "self_direction": 9.7,
            "digital_tech": 9.2
        }
    }
}

SAMPLE_HANDBOOK_QA = [
    {"q": "Quy chế đánh giá học sinh tại UMS tuân theo văn bản nào?", "category": "regulations", "keywords": ["quy chế", "đánh giá", "thông tư 22", "gdpt 2018"]},
    {"q": "Học sinh UMS học những ngoại ngữ nào ngoài tiếng Anh?", "category": "curriculum", "keywords": ["ngoại ngữ 2", "tiếng nhật", "tiếng đức", "tiếng pháp", "tiếng hàn", "tiếng trung"]},
    {"q": "Tiêu chí và lộ trình chuẩn bị thi vào THPT Chuyên Ngoại ngữ (CNN) là gì?", "category": "admissions", "keywords": ["cnn", "chuyên ngoại ngữ", "tuyển sinh", "chuyển cấp", "lớp 10"]},
    {"q": "Các câu lạc bộ ngoại khóa tiêu biểu tại UMS gồm những CLB nào?", "category": "clubs", "keywords": ["clb", "câu lạc bộ", "debate", "robotics", "green earth", "ngoại khóa"]},
    {"q": "Quy định về đồng phục học sinh UMS trong tuần như thế nào?", "category": "regulations", "keywords": ["đồng phục", "áo sơ mi", "thứ hai", "lễ phục"]},
    {"q": "Thời khóa biểu và giờ giấc học tập, bán trú tại trường ra sao?", "category": "schedule", "keywords": ["thời khóa biểu", "bán trú", "giờ vào lớp", "giờ tan học"]},
    {"q": "Cách thức liên hệ và đặt lịch trao đổi với Giáo viên chủ nhiệm (GVCN)?", "category": "contact", "keywords": ["liên hệ", "gvcn", "giáo viên chủ nhiệm", "hẹn gặp"]},
    {"q": "Hồ sơ năng lực học tập (Student Portfolio) được tính điểm vào học kỳ ra sao?", "category": "curriculum", "keywords": ["portfolio", "hồ sơ năng lực", "pbl", "rubric"]},
    {"q": "Quy định về nghỉ phép và xin học bù như thế nào?", "category": "regulations", "keywords": ["nghỉ phép", "đơn xin nghỉ", "học bù"]},
    {"q": "Học sinh UMS có cơ hội học bổng và giao lưu quốc tế không?", "category": "scholarships", "keywords": ["học bổng", "giao lưu", "trao đổi quốc tế", "ulis"]},
    {"q": "Chính sách sử dụng thiết bị công nghệ và điện thoại thông minh tại UMS?", "category": "regulations", "keywords": ["điện thoại", "thiết bị", "laptop", "quy định"]},
    {"q": "Cấu trúc bài thi tuyển sinh vào lớp 6 trường THCS Ngoại ngữ?", "category": "admissions", "keywords": ["tuyển sinh lớp 6", "đánh giá năng lực", "tiếng việt", "toán", "tiếng anh"]},
    {"q": "Chương trình Giáo dục STEM và ngày hội UMS Science Fair tổ chức khi nào?", "category": "curriculum", "keywords": ["stem", "science fair", "ngày hội khoa học", "nghiên cứu"]},
    {"q": "Chế độ dinh dưỡng và kiểm định an toàn vệ sinh thực phẩm bếp ăn bán trú UMS?", "category": "facilities", "keywords": ["bán trú", "bữa trưa", "dinh dưỡng", "an toàn thực phẩm"]},
    {"q": "Quy chế liêm chính học thuật và phòng chống đạo văn tại UMS?", "category": "regulations", "keywords": ["liêm chính", "đạo đức học thuật", "đạo văn", "trích dẫn"]},
    {"q": "Dịch vụ tham vấn tâm lý học đường và hỗ trợ hòa nhập tại UMS?", "category": "support", "keywords": ["tâm lý", "tư vấn", "hòa nhập", "tuổi dậy thì"]},
    {"q": "Cách xem biểu đồ năng lực học tập của con trên UMS Smart Growth Hub?", "category": "tech", "keywords": ["biểu đồ năng lực", "radar", "spider chart", "tra cứu"]},
    {"q": "Thủ tục xuất và in Hộ chiếu Năng lực Số (Digital Passport)?", "category": "tech", "keywords": ["hộ chiếu số", "digital passport", "in pdf", "chuyển cấp"]},
    {"q": "Chương trình thiện nguyện và phục vụ cộng đồng của học sinh UMS?", "category": "clubs", "keywords": ["thiện nguyện", "cộng đồng", "green earth", "nhân ái"]},
    {"q": "Kênh phản ánh và đóng góp ý kiến của cha mẹ học sinh đến Ban Giám hiệu?", "category": "contact", "keywords": ["góp ý", "ban giám hiệu", "hòm thư", "phụ huynh"]}
]


# ============================================================================
# 3. COMPONENT INSTANCE LOADERS & FACTORIES
# ============================================================================

def get_nlp_engine():
    """Returns the authentic NLPEngine instance."""
    from app.core.nlp_engine import nlp_engine
    return nlp_engine


def get_skill_tagger():
    """Returns the authentic SkillTagger instance."""
    from app.core.skill_tagger import skill_tagger
    return skill_tagger


def get_evaluator():
    """Returns the authentic RubricEvaluator instance."""
    from app.core.evaluator import rubric_evaluator
    return rubric_evaluator


def get_report_generator():
    """Returns the authentic ReportGenerator instance."""
    from app.core.report_gen import report_generator
    return report_generator


def get_data_repository():
    """Returns the authentic DataRepository singleton."""
    from app.data.repository import DataRepository
    return DataRepository.get_instance()


def get_fastapi_app():
    """Returns the authentic FastAPI application instance."""
    from app.main import app
    return app


def get_test_client():
    """Returns a TestClient instance."""
    from fastapi.testclient import TestClient
    return TestClient(get_fastapi_app())


# ============================================================================
# 4. PYTEST FIXTURES
# ============================================================================

@pytest.fixture
def sample_english_pbl():
    return dict(SAMPLE_ENGLISH_PBL)

@pytest.fixture
def sample_stem_pbl():
    return dict(SAMPLE_STEM_PBL)

@pytest.fixture
def sample_social_pbl():
    return dict(SAMPLE_SOCIAL_PBL)

@pytest.fixture
def sample_personas():
    return dict(SAMPLE_PERSONAS)

@pytest.fixture
def sample_handbook_qa():
    return list(SAMPLE_HANDBOOK_QA)

@pytest.fixture
def skill_taxonomy():
    return dict(SKILL_TAXONOMY_28)

@pytest.fixture
def nlp_engine():
    return get_nlp_engine()

@pytest.fixture
def skill_tagger():
    return get_skill_tagger()

@pytest.fixture
def evaluator():
    return get_evaluator()

@pytest.fixture
def report_generator():
    return get_report_generator()

@pytest.fixture
def data_repository():
    return get_data_repository()

@pytest.fixture
def api_client():
    return get_test_client()
