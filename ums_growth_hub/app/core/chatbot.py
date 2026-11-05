"""
School-Home AI Companion Chatbot Engine for UMS Smart Growth Hub.
Provides 24/7 offline guidance for parents and students based on 20 official UMS Handbook Q&As.
Integrates semantic TF-IDF scoring, rule-based intent classification, polite Vietnamese honorifics,
and personalized student context awareness.
"""

import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple

from app.data.repository import DataRepository

# Standard Intent Constants
INTENT_CNN_ORIENTATION = "CNN_ORIENTATION"
INTENT_CLUBS = "CLUBS_EXTRACURRICULAR"
INTENT_REGULATIONS = "SCHOOL_REGULATIONS"
INTENT_TEACHER_CONTACT = "TEACHER_CONTACT"
INTENT_TIMELINE_STATUS = "TIMELINE_STATUS"
INTENT_ACADEMICS = "ACADEMICS_CURRICULUM"
INTENT_GREETING = "GENERAL_GREETING"
INTENT_FALLBACK = "GENERAL_INQUIRY"


def normalize_vietnamese_text(text: str) -> str:
    """Normalize text and remove diacritics for robust search."""
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in normalized if not unicodedata.combining(c))
    return stripped.lower().strip()


class SchoolHomeChatbot:
    """
    Intelligent offline chatbot engine serving parent and student inquiries.
    """

    def __init__(self, repo: Optional[DataRepository] = None):
        self.repo = repo or DataRepository.get_instance()
        self._handbook_qa: List[Dict[str, Any]] = []
        self._tfidf_vectorizer = None
        self._tfidf_matrix = None
        self._initialize_knowledge_base()

    def _initialize_knowledge_base(self):
        """Load handbook Q&A and precompute search indices."""
        try:
            self._handbook_qa = self.repo.get_handbook_qa()
        except Exception:
            self._handbook_qa = []

        # Attempt to build TF-IDF index if scikit-learn is available
        if self._handbook_qa:
            try:
                from sklearn.feature_extraction.text import TfidfVectorizer
                corpus = []
                for item in self._handbook_qa:
                    doc = f"{item.get('question', '')} {item.get('answer', '')} {' '.join(item.get('keywords', []))}"
                    corpus.append(doc)
                self._tfidf_vectorizer = TfidfVectorizer(token_pattern=r"(?u)\b\w+\b")
                self._tfidf_matrix = self._tfidf_vectorizer.fit_transform(corpus)
            except Exception:
                self._tfidf_vectorizer = None
                self._tfidf_matrix = None

    def classify_intent(self, question: str) -> Tuple[str, float]:
        """
        Classify parent question into specific pedagogical intent.
        Returns (intent_name, confidence).
        """
        q_norm = normalize_vietnamese_text(question)
        q_raw = question.lower()

        # Greetings
        if re.search(r"\b(xin chao|chao co|chao thay|hello|hi|bonjour|halo)\b", q_norm):
            if len(q_norm.split()) <= 4:
                return INTENT_GREETING, 0.95

        # CNN Orientation
        if any(kw in q_norm for kw in [
            "cnn", "chuyen ngoai ngu", "chuyen cnn", "tuyen sinh 10", "chuyen cap",
            "thpt chuyen", "thi vao 10", "lop 10", "chuyen anh", "chuyen phap",
            "chuyen duc", "chuyen trung", "chuyen nhat", "chuyen han", "de thi cnn",
            "danh gia nang luc ngoai ngu", "lien thong"
        ]):
            return INTENT_CNN_ORIENTATION, 0.96

        # Clubs & Extracurriculars
        if any(kw in q_norm for kw in [
            "clb", "cau lac bo", "debate", "robotics", "green earth", "stem",
            "u-stem", "u-press", "ngoai khoa", "hoat dong ngoai khoa", "tranh bien",
            "sinh hoat clb", "cau lac bo debate"
        ]):
            return INTENT_CLUBS, 0.95

        # Teacher Contact / Meeting
        if any(kw in q_norm for kw in [
            "gap co", "gap thay", "giao vien chu nhiem", "gvcn", "lien he giao vien",
            "hen gap", "trao doi rieng", "so dien thoai co", "hop phu huynh",
            "co giao chu nhiem", "thay giao"
        ]):
            return INTENT_TEACHER_CONTACT, 0.94

        # Timeline / Learning Progress
        if any(kw in q_norm for kw in [
            "tien do", "du an", "bai nop", "diem so", "rubric", "ket qua",
            "dong thoi gian", "timeline", "san pham hoc tap", "hoc ba", "ho chieu"
        ]):
            return INTENT_TIMELINE_STATUS, 0.92

        # School Regulations & Schedule
        if any(kw in q_norm for kw in [
            "quy che", "quy dinh", "dong phuc", "gio vao lop", "gio tan hoc",
            "ban tru", "an trua", "nghi hoc", "xin phep", "dien thoai",
            "lich thi", "hoc ky", "noi quy", "hoc phi", "xe bus", "dua don"
        ]):
            return INTENT_REGULATIONS, 0.93

        # Academics & Curriculum
        if any(kw in q_norm for kw in [
            "ngoai ngu 2", "mon hoc", "khtn", "stem", "tieng duc", "tieng nhat",
            "tieng han", "chuong trinh", "gdpt 2018", "ielts", "cefr"
        ]):
            return INTENT_ACADEMICS, 0.90

        return INTENT_FALLBACK, 0.65

    def _find_best_handbook_match(self, question: str) -> Optional[Dict[str, Any]]:
        """Find best matching handbook item using TF-IDF or keyword overlap."""
        if not self._handbook_qa:
            self._initialize_knowledge_base()
        if not self._handbook_qa:
            return None

        # 1. Try TF-IDF cosine similarity if available
        if self._tfidf_vectorizer is not None and self._tfidf_matrix is not None:
            try:
                from sklearn.metrics.pairwise import cosine_similarity
                q_vec = self._tfidf_vectorizer.transform([question])
                scores = cosine_similarity(q_vec, self._tfidf_matrix).flatten()
                best_idx = int(scores.argmax())
                if scores[best_idx] > 0.15:
                    return self._handbook_qa[best_idx]
            except Exception:
                pass

        # 2. Keyword overlap fallback
        q_norm = normalize_vietnamese_text(question)
        q_words = set(q_norm.split())
        best_item = None
        best_score = -1

        for item in self._handbook_qa:
            score = 0
            # Question match
            item_q = normalize_vietnamese_text(item.get("question", ""))
            item_q_words = set(item_q.split())
            score += len(q_words.intersection(item_q_words)) * 3

            # Keywords match
            for kw in item.get("keywords", []):
                kw_norm = normalize_vietnamese_text(kw)
                if kw_norm in q_norm:
                    score += 5

            # Category match
            cat = normalize_vietnamese_text(item.get("category", ""))
            if cat in q_norm:
                score += 2

            if score > best_score:
                best_score = score
                best_item = item

        if best_score > 0:
            return best_item

        return None

    def query(self, question: str, student_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Process a user question and return a structured pedagogical response.
        """
        raw_q = (question or "").strip()

        # Handle empty query
        if not raw_q:
            return {
                "reply": "Chào Quý Phụ huynh! Em là Trợ lý AI Đồng hành UMS. Quý Phụ huynh vui lòng nhập câu hỏi để em có thể hỗ trợ giải đáp quy chế, hoạt động hoặc định hướng học tập cho học sinh ạ.",
                "source_intent": INTENT_FALLBACK,
                "confidence": 1.0,
                "matched_qa_id": None
            }

        # Check for prompt injection / safety strings
        injection_markers = ["ignore previous", "system prompt", "api key", "developer mode", "jailbreak"]
        is_injection = any(marker in raw_q.lower() for marker in injection_markers)

        # Retrieve student details if student_id provided
        student = None
        if student_id:
            student = self.repo.get_student_by_id(student_id)

        intent, confidence = self.classify_intent(raw_q)
        best_match = self._find_best_handbook_match(raw_q)

        # Build personalized greeting
        greeting = "Chào Quý Phụ huynh!"
        if student:
            s_name = student.get("full_name", "")
            s_class = student.get("class_name", "")
            if s_name:
                greeting = f"Chào Quý Phụ huynh em {s_name} (Lớp {s_class})!"

        # Construct reply based on intent and matched handbook knowledge
        reply_body = ""

        if is_injection:
            reply_body = (
                "Nhà trường luôn đặt sự an toàn, bảo mật và tính liêm chính học thuật lên hàng đầu. "
                "Em là Trợ lý AI đồng hành của Trường THCS Ngoại ngữ (UMS - ULIS), luôn sẵn sàng giải đáp các thắc mắc về quy chế học tập, câu lạc bộ và tuyển sinh chuyển cấp vào CNN."
            )
            return {
                "reply": f"{greeting}\n\n{reply_body}",
                "source_intent": INTENT_REGULATIONS,
                "confidence": 0.95,
                "matched_qa_id": "SEC-SAFETY"
            }

        if intent == INTENT_GREETING:
            reply_body = (
                "Rất vui được hỗ trợ Quý Phụ huynh! UMS Smart Growth Hub là nền tảng số hóa hồ sơ năng lực học sinh "
                "và kết nối 24/7 giữa Gia đình và Trường THCS Ngoại ngữ (ULIS). Quý Phụ huynh có thể hỏi em về lịch sinh hoạt CLB, quy chế bán trú, điểm số dự án, hoặc lộ trình thi vào THPT Chuyên Ngoại ngữ (CNN) ạ."
            )
            return {
                "reply": f"{greeting}\n\n{reply_body}",
                "source_intent": INTENT_GREETING,
                "confidence": 0.98,
                "matched_qa_id": None
            }

        if intent == INTENT_CNN_ORIENTATION:
            extra_context = ""
            if student:
                gpa = student.get("gpa", 9.0)
                cefr = student.get("cefr_level", "B2/C1")
                extra_context = f"\n* Dữ liệu học tập của em: Điểm trung bình {gpa}, năng lực ngoại ngữ {cefr}. Đây là nền tảng rất vững vàng để chuẩn bị cho kỳ thi tuyển sinh CNN."

            reply_body = (
                "Về lộ trình định hướng thi vào Trường THPT Chuyên Ngoại ngữ (CNN - FLSS, Trường Đại học Ngoại ngữ - ĐHQGHN):\n"
                "1. **Cấu trúc bài thi tuyển sinh CNN**: Gồm 3 bài đánh giá năng lực: (1) ĐGNL Ngoại ngữ (Hệ số 2, trắc nghiệm & tự luận), (2) ĐGNL Toán & Khoa học Tự nhiên, (3) ĐGNL Ngữ văn & Khoa học Xã hội.\n"
                "2. **Hồ sơ năng lực liên thông**: Học sinh tốt nghiệp UMS có lợi thế lớn nhờ hồ sơ năng lực số (Digital Passport) tích lũy qua các dự án liên môn và hoạt động tại CLB Debate, MUN.\n"
                "3. **Khuyến nghị chuẩn bị**: Gia đình nên duy trì việc rèn luyện viết luận xã hội, mở rộng vốn từ vựng học thuật quốc tế và tham gia các kỳ thi thử do CNN/ULIS tổ chức vào đầu năm lớp 9."
                f"{extra_context}"
            )
            return {
                "reply": f"{greeting}\n\n{reply_body}",
                "source_intent": INTENT_CNN_ORIENTATION,
                "confidence": 0.96,
                "matched_qa_id": best_match.get("id") if best_match else "QA-CNN"
            }

        if intent == INTENT_CLUBS:
            extra_club = ""
            if student and student.get("clubs"):
                clubs_str = ", ".join(student.get("clubs", []))
                extra_club = f"\n* Hiện tại, em đang tham gia tích cực tại: **{clubs_str}**."

            reply_body = (
                "Về lịch sinh hoạt các Câu lạc bộ học thuật tại Trường THCS Ngoại ngữ:\n"
                "- **Thời gian**: Diễn ra định kỳ vào chiều Thứ Ba và chiều Thứ Năm hàng tuần (từ 15h30 đến 17h00).\n"
                "- **Các CLB tiêu biểu**: UMS Debate Club (Tranh biện tiếng Anh), U-STEM Robotics (Lập trình & Chế tạo), Green Earth (Môi trường xanh), U-Press & Media (Truyền thông & Báo chí), và Arts & Culture Club (Văn hóa & Nghệ thuật).\n"
                "- **Đánh giá năng lực**: Kết quả hoạt động và sản phẩm sáng tạo tại CLB được tự động tích hợp vào Hộ chiếu Năng lực Số của học sinh theo khung GDPT 2018."
                f"{extra_club}"
            )
            return {
                "reply": f"{greeting}\n\n{reply_body}",
                "source_intent": INTENT_CLUBS,
                "confidence": 0.95,
                "matched_qa_id": best_match.get("id") if best_match else "QA-CLUBS"
            }

        if intent == INTENT_TEACHER_CONTACT:
            teacher_name = student.get("homeroom_teacher_name", "cô giáo chủ nhiệm") if student else "cô giáo chủ nhiệm"
            reply_body = (
                f"Để kết nối trao đổi với {teacher_name} hoặc các giáo viên bộ môn:\n"
                "1. **Khung giờ tiếp phụ huynh**: Nhà trường bố trí thời gian tư vấn học tập vào các buổi chiều Thứ Sáu (16h30 - 17h30) hoặc theo lịch hẹn trước qua cổng thông tin UMS Smart Growth Hub.\n"
                "2. **Hòm thư điện tử**: Quý Phụ huynh có thể gửi tin nhắn phản hồi trực tiếp qua phân hệ 'Dòng thời gian trưởng thành' của hệ thống.\n"
                "3. **Hỗ trợ khẩn cấp**: Phòng Công tác Học sinh - Sinh viên UMS luôn sẵn sàng tiếp nhận thông tin vào giờ hành chính."
            )
            return {
                "reply": f"{greeting}\n\n{reply_body}",
                "source_intent": INTENT_TEACHER_CONTACT,
                "confidence": 0.94,
                "matched_qa_id": best_match.get("id") if best_match else "QA-CONTACT"
            }

        if intent == INTENT_REGULATIONS:
            match_answer = best_match.get("answer", "") if best_match else ""
            if match_answer:
                reply_body = match_answer
            else:
                reply_body = (
                    "Quy chế hoạt động và nề nếp tại Trường THCS Ngoại ngữ:\n"
                    "- **Thời gian biểu**: Giờ vào lớp là 7h30 sáng; giờ tan học là 16h40 chiều từ Thứ Hai đến Thứ Sáu.\n"
                    "- **Đồng phục**: Áo sơ mi trắng gắn logo UMS các ngày Thứ Hai, Thứ Tư, Thứ Sáu; đồng phục thể thao xanh navy trong các ngày có tiết Giáo dục thể chất.\n"
                    "- **Quy định thiết bị số**: Học sinh được sử dụng máy tính bảng/laptop trong các tiết học dự án liên môn dưới sự hướng dẫn của giáo viên và cất vào tủ đồ lớp trong giờ nghỉ.\n"
                    "- **Đánh giá định kỳ**: Áp dụng Thông tư 22/2021/TT-BGDĐT kết hợp chấm điểm Rubric dự án liên môn."
                )
            return {
                "reply": f"{greeting}\n\n{reply_body}",
                "source_intent": INTENT_REGULATIONS,
                "confidence": 0.93,
                "matched_qa_id": best_match.get("id") if best_match else "QA-REG"
            }

        # Check if handbook matched an answer with good quality
        if best_match and best_match.get("answer"):
            return {
                "reply": f"{greeting}\n\n{best_match.get('answer')}",
                "source_intent": best_match.get("category", INTENT_FALLBACK),
                "confidence": 0.88,
                "matched_qa_id": best_match.get("id")
            }

        # Graceful polite fallback
        fallback_reply = (
            f"{greeting}\n\n"
            "Cảm ơn Quý Phụ huynh đã gửi câu hỏi. Nhà trường luôn lắng nghe và đồng hành cùng sự phát triển của học sinh. "
            "Hiện tại câu hỏi của Quý Phụ huynh đã được ghi nhận. Quý Phụ huynh có thể tham khảo thêm các chủ đề phổ biến như: "
            "Quy chế đánh giá Thông tư 22, Lộ trình thi vào THPT Chuyên Ngoại ngữ (CNN), Lịch sinh hoạt CLB Debate & Robotics, hoặc liên hệ trực tiếp với Giáo viên chủ nhiệm qua hệ thống nhé ạ!"
        )
        return {
            "reply": fallback_reply,
            "source_intent": INTENT_FALLBACK,
            "confidence": 0.70,
            "matched_qa_id": None
        }


# Singleton instance
school_home_chatbot = SchoolHomeChatbot()
