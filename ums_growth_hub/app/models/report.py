"""
Report Domain Models for UMS Smart Growth Hub.
Includes SemesterReportRequest, SemesterReportResponse, TeacherType enum, and SectionFeedback.
Compliant with GDPT 2018 standards, UMS curriculum, and THPT Chuyên Ngoại ngữ (CNN - ULIS) pathway orientation.
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, field_validator, model_validator


class TeacherType(str, Enum):
    """Teacher evaluation roles at UMS."""
    HOMEROOM = "homeroom"  # Giáo viên chủ nhiệm (GVCN)
    SUBJECT = "subject"    # Giáo viên bộ môn (GVBM)


class SectionFeedback(BaseModel):
    """Structured detail for an individual evaluation section."""
    section_key: str = Field(..., description="Key identifier: academic, qualities, orientation")
    title: str = Field(..., description="Tiêu đề đề mục đánh giá")
    content: str = Field(..., description="Nội dung nhận xét chi tiết")
    criteria_assessed: List[str] = Field(default_factory=list, description="Các tiêu chí hoặc chỉ số hành vi được đánh giá")
    key_highlights: List[str] = Field(default_factory=list, description="Các điểm sáng và dẫn chứng tiêu biểu")


class SemesterReportRequest(BaseModel):
    """
    Request model for generating a personalized semester report.
    Conforms to PROJECT.md interface contracts.
    """
    student_id: str = Field(default="UMS-STU-001", description="Mã định danh học sinh UMS")
    student_name: str = Field(default="Học sinh UMS", description="Họ và tên học sinh")
    grade_level: int = Field(default=8, ge=6, le=9, description="Khối lớp (6, 7, 8, 9)")
    semester: str = Field(default="Học kỳ I", description="Học kỳ đánh giá ('Học kỳ I' hoặc 'Học kỳ II')")
    school_year: str = Field(default="2025-2026", description="Năm học ('2025-2026')")
    teacher_type: str = Field(default="homeroom", description="Chế độ giáo viên: 'homeroom' (GVCN) hoặc 'subject' (GVBM)")
    subject_name: Optional[str] = Field(default=None, description="Tên môn học (nếu là giáo viên bộ môn)")
    competency_scores: Dict[str, float] = Field(default_factory=dict, description="Điểm đánh giá các năng lực GDPT 2018")
    projects_completed: List[Dict[str, Any]] = Field(default_factory=list, description="Danh sách dự án liên môn đã hoàn thành")
    attendance_rate: float = Field(default=98.5, ge=0.0, le=100.0, description="Tỷ lệ chuyên cần (%)")
    conduct_grade: str = Field(default="Tốt", description="Xếp loại rèn luyện / hạnh kiểm ('Tốt', 'Khá', 'Đạt')")

    @field_validator("student_name", mode="before")
    @classmethod
    def sanitize_student_name(cls, v: Any) -> str:
        if v is None or not str(v).strip() or str(v).strip().lower() in ("none", "null", "undefined"):
            return "Học sinh UMS"
        return str(v).strip()

    @field_validator("teacher_type", mode="before")
    @classmethod
    def normalize_teacher_type(cls, v: Any) -> str:
        if v is None:
            return "homeroom"
        val = str(v).strip().lower()
        if not val:
            return "homeroom"
        if "subject" in val or "gvbm" in val or "bộ môn" in val:
            return "subject"
        if "homeroom" in val or "gvcn" in val or "chủ nhiệm" in val:
            return "homeroom"
        # Unknown roles (e.g. 'counselor', 'supervisor') fallback gracefully to homeroom
        return "homeroom"

    @field_validator("subject_name", mode="before")
    @classmethod
    def sanitize_subject_name(cls, v: Any) -> Optional[str]:
        if v is None or not str(v).strip() or str(v).strip().lower() in ("none", "null", "undefined"):
            return None
        return str(v).strip()

    @field_validator("grade_level", mode="before")
    @classmethod
    def normalize_grade_level(cls, v: Any) -> int:
        if v is None:
            return 8
        try:
            val = int(v)
            if 6 <= val <= 9:
                return val
            if val < 6:
                return 6
            return 9
        except (ValueError, TypeError):
            return 8

    @model_validator(mode="after")
    def ensure_subject_for_subject_teacher(self) -> "SemesterReportRequest":
        if self.teacher_type == "subject" and not self.subject_name:
            self.subject_name = "Tiếng Anh"
        return self


class SemesterReportResponse(BaseModel):
    """
    Response model for generated semester report.
    Conforms to PROJECT.md interface contracts with dictionary access compatibility.
    """
    student_id: str = Field(..., description="Mã định danh học sinh")
    student_name: str = Field(..., description="Họ và tên học sinh")
    teacher_type: str = Field(..., description="Chế độ nhận xét ('homeroom' hoặc 'subject')")
    section_academic: str = Field(..., description="Phần 1: Đánh giá năng lực chuyên môn & ngoại ngữ")
    section_qualities: str = Field(..., description="Phần 2: Đánh giá phẩm chất & kỹ năng mềm")
    section_orientation: str = Field(..., description="Phần 3: Lời khuyên định hướng phát triển lên bậc THPT Chuyên Ngoại ngữ / CNN / ULIS")
    full_text: str = Field(..., description="Văn bản nhận xét học kỳ hoàn chỉnh")
    placeholders_detected: List[str] = Field(default_factory=list, description="Danh sách các placeholder chưa xử lý (bắt buộc rỗng [])")
    validation_status: str = Field(default="PASSED", description="Trạng thái xác thực: 'PASSED' hoặc 'FAILED'")

    # Optional metadata
    grade_level: Optional[int] = Field(default=8, description="Khối lớp của học sinh")
    semester: Optional[str] = Field(default="Học kỳ I", description="Học kỳ")
    school_year: Optional[str] = Field(default="2025-2026", description="Năm học")
    subject_name: Optional[str] = Field(default=None, description="Môn học đánh giá")
    attendance_rate: Optional[float] = Field(default=98.5, description="Tỷ lệ chuyên cần")
    conduct_grade: Optional[str] = Field(default="Tốt", description="Xếp loại rèn luyện")
    sections: Optional[List[SectionFeedback]] = Field(default=None, description="Danh sách các phần nhận xét chi tiết")

    def __getitem__(self, item: str) -> Any:
        """Allow dictionary-style access (e.g. rep['full_text'])."""
        if hasattr(self, item):
            return getattr(self, item)
        raise KeyError(f"Key '{item}' not found in SemesterReportResponse")

    def get(self, item: str, default: Any = None) -> Any:
        """Allow dictionary-style .get() access."""
        return getattr(self, item, default)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to standard dictionary."""
        return self.model_dump()
