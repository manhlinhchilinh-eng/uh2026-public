"""
Student Domain Models for UMS Smart Growth Hub.
Includes StudentProfile, CompetencyRadarScore, ProjectSummary, and supporting models.
Compliant with GDPT 2018 standards and UMS (ULIS Middle School) curriculum requirements.
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict


class CompetencyRadarScore(BaseModel):
    """
    Competency and Qualities profile under the Vietnam GDPT 2018 framework:
    - 5 Core Qualities (Phẩm chất chủ yếu)
    - 3 General Competencies (Năng lực cốt lõi chung)
    - 7 Specific Competencies (Năng lực đặc thù chuyên môn)
    Scores range from 0.0 to 10.0.
    """
    model_config = ConfigDict(extra="ignore")

    # 5 Phẩm chất chủ yếu (Core Qualities)
    yeu_nuoc: float = Field(default=8.5, ge=0.0, le=10.0, description="Phẩm chất Yêu nước")
    nhan_ai: float = Field(default=8.5, ge=0.0, le=10.0, description="Phẩm chất Nhân ái")
    cham_chi: float = Field(default=8.5, ge=0.0, le=10.0, description="Phẩm chất Chăm chỉ")
    trung_thuc: float = Field(default=8.5, ge=0.0, le=10.0, description="Phẩm chất Trung thực")
    trach_nhiem: float = Field(default=8.5, ge=0.0, le=10.0, description="Phẩm chất Trách nhiệm")

    # 3 Năng lực cốt lõi chung (General Competencies)
    tu_chu_tu_hoc: float = Field(default=8.5, ge=0.0, le=10.0, description="Tự chủ & Tự học")
    giao_tiep_hop_tac: float = Field(default=8.5, ge=0.0, le=10.0, description="Giao tiếp & Hợp tác")
    giai_quyet_van_de_sang_tao: float = Field(default=8.5, ge=0.0, le=10.0, description="Giải quyết vấn đề & Sáng tạo")

    # 7 Năng lực đặc thù chuyên môn (Specific Competencies)
    ngon_ngu: float = Field(default=8.5, ge=0.0, le=10.0, description="Năng lực Ngôn ngữ")
    tinh_toan: float = Field(default=8.5, ge=0.0, le=10.0, description="Năng lực Tính toán")
    khoa_hoc_tu_nhien: float = Field(default=8.5, ge=0.0, le=10.0, description="Năng lực Khoa học tự nhiên")
    cong_nghe: float = Field(default=8.5, ge=0.0, le=10.0, description="Năng lực Công nghệ")
    tin_hoc: float = Field(default=8.5, ge=0.0, le=10.0, description="Năng lực Tin học")
    tham_my: float = Field(default=8.5, ge=0.0, le=10.0, description="Năng lực Thẩm mỹ")
    the_chat: float = Field(default=8.5, ge=0.0, le=10.0, description="Năng lực Thể chất")

    def to_dict(self) -> Dict[str, float]:
        """Return all 15 competency & quality scores as a dictionary."""
        return {
            "yeu_nuoc": round(self.yeu_nuoc, 2),
            "nhan_ai": round(self.nhan_ai, 2),
            "cham_chi": round(self.cham_chi, 2),
            "trung_thuc": round(self.trung_thuc, 2),
            "trach_nhiem": round(self.trach_nhiem, 2),
            "tu_chu_tu_hoc": round(self.tu_chu_tu_hoc, 2),
            "giao_tiep_hop_tac": round(self.giao_tiep_hop_tac, 2),
            "giai_quyet_van_de_sang_tao": round(self.giai_quyet_van_de_sang_tao, 2),
            "ngon_ngu": round(self.ngon_ngu, 2),
            "tinh_toan": round(self.tinh_toan, 2),
            "khoa_hoc_tu_nhien": round(self.khoa_hoc_tu_nhien, 2),
            "cong_nghe": round(self.cong_nghe, 2),
            "tin_hoc": round(self.tin_hoc, 2),
            "tham_my": round(self.tham_my, 2),
            "the_chat": round(self.the_chat, 2),
        }

    def average_score(self) -> float:
        """Calculate overall average score across all 15 dimensions."""
        scores = list(self.to_dict().values())
        return round(sum(scores) / len(scores), 2)

    def qualities_average(self) -> float:
        """Calculate average of the 5 Core Qualities."""
        q = [self.yeu_nuoc, self.nhan_ai, self.cham_chi, self.trung_thuc, self.trach_nhiem]
        return round(sum(q) / len(q), 2)

    def general_competencies_average(self) -> float:
        """Calculate average of the 3 General Competencies."""
        g = [self.tu_chu_tu_hoc, self.giao_tiep_hop_tac, self.giai_quyet_van_de_sang_tao]
        return round(sum(g) / len(g), 2)

    def specific_competencies_average(self) -> float:
        """Calculate average of the 7 Specific Competencies."""
        s = [
            self.ngon_ngu, self.tinh_toan, self.khoa_hoc_tu_nhien,
            self.cong_nghe, self.tin_hoc, self.tham_my, self.the_chat
        ]
        return round(sum(s) / len(s), 2)

    def to_radar_chart_data(self, benchmark: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
        """
        Produce Chart.js radar chart configuration payload.
        Includes student scores and optional grade benchmark.
        """
        labels = [
            "Yêu nước", "Nhân ái", "Chăm chỉ", "Trung thực", "Trách nhiệm",
            "Tự chủ & Tự học", "Giao tiếp & Hợp tác", "Sáng tạo & GQ Vấn đề",
            "Ngôn ngữ", "Tính toán", "Khoa học TN", "Công nghệ",
            "Tin học", "Thẩm mỹ", "Thể chất"
        ]
        keys = [
            "yeu_nuoc", "nhan_ai", "cham_chi", "trung_thuc", "trach_nhiem",
            "tu_chu_tu_hoc", "giao_tiep_hop_tac", "giai_quyet_van_de_sang_tao",
            "ngon_ngu", "tinh_toan", "khoa_hoc_tu_nhien", "cong_nghe",
            "tin_hoc", "tham_my", "the_chat"
        ]
        student_data = [getattr(self, k) for k in keys]

        datasets = [
            {
                "label": "Hồ sơ Học sinh",
                "data": student_data,
                "backgroundColor": "rgba(10, 37, 64, 0.2)",
                "borderColor": "#0A2540",
                "pointBackgroundColor": "#D4AF37",
                "pointBorderColor": "#fff",
                "pointHoverBackgroundColor": "#fff",
                "pointHoverBorderColor": "#0A2540",
            }
        ]

        if benchmark:
            benchmark_data = [benchmark.get(k, 7.5) for k in keys]
            datasets.append({
                "label": "Chuẩn Trung bình Khối",
                "data": benchmark_data,
                "backgroundColor": "rgba(212, 175, 55, 0.15)",
                "borderColor": "#D4AF37",
                "borderDash": [4, 4],
                "pointBackgroundColor": "#A0AEC0",
            })

        return {
            "labels": labels,
            "datasets": datasets,
            "summary": {
                "overall_average": self.average_score(),
                "qualities_average": self.qualities_average(),
                "general_average": self.general_competencies_average(),
                "specific_average": self.specific_competencies_average()
            }
        }


class ProjectSummary(BaseModel):
    """
    Summary record of a student's project stored in the vault or highlighted on CV.
    """
    model_config = ConfigDict(extra="ignore")

    id: str = Field(description="Mã định danh dự án, ví dụ: PRJ-ENG-2026-08A1-01")
    title: str = Field(description="Tên dự án")
    subject: str = Field(description="Môn học")
    category: str = Field(
        default="general",
        description="Phân loại: english_presentation, stem_scientific, social_humanities, general"
    )
    score: Optional[float] = Field(default=None, ge=0.0, le=10.0, description="Điểm rubric")
    status: str = Field(default="evaluated", description="Trạng thái: draft, submitted, evaluated")
    skills: List[str] = Field(default_factory=list, description="Danh sách kỹ năng gắn thẻ")
    submitted_at: Optional[str] = Field(default=None, description="Thời điểm nộp ISO 8601")
    summary: Optional[str] = Field(default=None, description="Tóm tắt ngắn gọn nội dung")
    artifacts_count: int = Field(default=1, description="Số lượng minh chứng đính kèm")


class TimelineMilestone(BaseModel):
    """
    Growth timeline milestone card displayed for parents and teachers.
    """
    model_config = ConfigDict(extra="ignore")

    id: str
    student_id: str
    date: str
    title: str
    description: str
    category: str = Field(
        default="project",
        description="project, badge, report, competition, club"
    )
    badge: Optional[str] = None
    score: Optional[float] = None
    project_id: Optional[str] = None
    teacher_note: Optional[str] = None


class StudentProfile(BaseModel):
    """
    Comprehensive Student Profile model for UMS Digital Competency Passport.
    """
    model_config = ConfigDict(extra="ignore")

    id: str = Field(description="Mã người dùng, ví dụ: usr_stu_001")
    student_code: str = Field(description="Mã học sinh UMS, ví dụ: UMS-9A1-001")
    full_name: str = Field(description="Họ và tên học sinh")
    grade: int = Field(ge=6, le=9, description="Khối lớp (6, 7, 8, 9)")
    class_name: str = Field(description="Lớp học, ví dụ: 9A1")
    email: str = Field(description="Email trường (@ums.edu.vn)")
    avatar_url: Optional[str] = Field(default=None, description="URL ảnh đại diện")
    date_of_birth: Optional[str] = Field(default=None, description="Ngày sinh YYYY-MM-DD")
    gender: Optional[str] = Field(default=None, description="Nam / Nữ")
    second_language: str = Field(description="Ngoại ngữ 2: Japanese, German, French, Korean, Chinese")
    clubs: List[str] = Field(default_factory=list, description="Các CLB tham gia")
    gpa: float = Field(ge=0.0, le=10.0, description="Điểm trung bình học tập")
    cefr_level: str = Field(description="Trình độ ngoại ngữ, ví dụ: C1 (IELTS 7.5)")
    target_highschool: str = Field(description="Mục tiêu trường cấp 3, ví dụ: THPT Chuyên Ngoại ngữ")
    parent_id: Optional[str] = Field(default=None, description="ID phụ huynh liên kết")
    parent_name: Optional[str] = Field(default=None, description="Tên phụ huynh")
    parent_phone: Optional[str] = Field(default=None, description="Số điện thoại phụ huynh")
    parent_email: Optional[str] = Field(default=None, description="Email phụ huynh")
    homeroom_teacher_id: Optional[str] = Field(default=None, description="ID giáo viên chủ nhiệm")
    homeroom_teacher_name: Optional[str] = Field(default=None, description="Tên giáo viên chủ nhiệm")
    conduct_grade: str = Field(default="Tốt", description="Xếp loại rèn luyện")
    attendance_rate: float = Field(default=98.5, ge=0.0, le=100.0, description="Tỷ lệ chuyên cần (%)")
    signature_projects: List[ProjectSummary] = Field(default_factory=list, description="Top dự án tiêu biểu")
    competencies: Optional[CompetencyRadarScore] = Field(default=None, description="Hồ sơ năng lực GDPT 2018")
    badges: List[str] = Field(default_factory=list, description="Danh hiệu / Huy hiệu đạt được")
    notes: Optional[str] = Field(default=None, description="Ghi chú sư phạm cá nhân hóa")

    def to_passport_dict(self) -> Dict[str, Any]:
        """
        Export data package tailored for Student Digital Passport & PDF export.
        """
        return {
            "student_id": self.id,
            "student_code": self.student_code,
            "full_name": self.full_name,
            "grade": self.grade,
            "class_name": self.class_name,
            "email": self.email,
            "second_language": self.second_language,
            "clubs": self.clubs,
            "gpa": self.gpa,
            "cefr_level": self.cefr_level,
            "target_highschool": self.target_highschool,
            "homeroom_teacher": self.homeroom_teacher_name,
            "conduct_grade": self.conduct_grade,
            "attendance_rate": self.attendance_rate,
            "badges": self.badges,
            "signature_projects": [p.model_dump() for p in self.signature_projects],
            "competency_radar": self.competencies.to_radar_chart_data() if self.competencies else None,
            "summary_scores": {
                "overall_average": self.competencies.average_score() if self.competencies else None,
                "qualities_average": self.competencies.qualities_average() if self.competencies else None,
                "general_average": self.competencies.general_competencies_average() if self.competencies else None,
                "specific_average": self.competencies.specific_competencies_average() if self.competencies else None,
            }
        }


class HandbookQAItem(BaseModel):
    """
    Official UMS Parent & Student Handbook Q&A Item for 24/7 AI Companion.
    """
    model_config = ConfigDict(extra="ignore")

    id: str = Field(description="Mã định danh câu hỏi, ví dụ: QA-01")
    category: str = Field(description="Danh mục: admissions, schedule, regulations, clubs, academics, boarding, wellbeing")
    question: str = Field(description="Câu hỏi phổ biến từ phụ huynh / học sinh")
    answer: str = Field(description="Câu trả lời chuẩn theo quy chế trường UMS - ULIS")
    keywords: List[str] = Field(default_factory=list, description="Từ khóa ngữ nghĩa tra cứu nhanh")
