"""
Rubric and Evaluation Pydantic Models for UMS Smart Growth Hub
Conforming to GDPT 2018 4-Dimension 10-Point Rubric & Skill Taxonomy Specifications
"""

from typing import Optional, Any
from pydantic import BaseModel, Field, model_validator


class RubricCriterionDetail(BaseModel):
    """Detailed score and pedagogical justification for a single criterion."""
    score: float
    max_score: float
    criteria_name: str
    level: str  # "Xuất sắc", "Tốt", "Đạt", "Cần cố gắng"
    rationale: str


class RubricScoreBreakdown(BaseModel):
    """
    GDPT 2018 4-Criterion 10-Point Score Breakdown:
    - Content Depth: max 3.0
    - Language Expression: max 2.5
    - Critical Innovation: max 2.5
    - Collaboration & Integrity: max 2.0
    Total: max 10.0
    """
    content_depth: float = Field(..., ge=0.0, le=3.0, description="Nội dung chuyên môn & Hàm lượng học thuật (Max 3.0)")
    language_expression: float = Field(..., ge=0.0, le=2.5, description="Năng lực ngôn ngữ & Diễn đạt (Max 2.5)")
    critical_innovation: float = Field(..., ge=0.0, le=2.5, description="Tư duy phản biện, Sáng tạo & Giải quyết vấn đề (Max 2.5)")
    collaboration_integrity: float = Field(..., ge=0.0, le=2.0, description="Hợp tác, Quản lý dự án & Đạo đức học thuật (Max 2.0)")
    total_score: float = Field(..., ge=0.0, le=10.0, description="Tổng điểm đánh giá theo thang điểm 10 GDPT 2018")
    details: Optional[dict[str, RubricCriterionDetail]] = Field(
        default=None, description="Chi tiết giải trình và mức độ cho từng tiêu chí"
    )

    @property
    def content_and_depth(self) -> float:
        return self.content_depth

    @property
    def language_and_communication(self) -> float:
        return self.language_expression

    @property
    def critical_thinking_and_creativity(self) -> float:
        return self.critical_innovation

    @property
    def collaboration_and_integrity(self) -> float:
        return self.collaboration_integrity


class SkillTag(BaseModel):
    """Extracted competency skill tag with confidence and evidence snippet."""
    skill_id: str
    skill_name: str
    category: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    evidence: str
    cluster: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_aliases(cls, values: Any) -> Any:
        if isinstance(values, dict):
            # Support id / skill_id
            if "id" in values and "skill_id" not in values:
                values["skill_id"] = values["id"]
            # Support name / skill_name
            if "name" in values and "skill_name" not in values:
                values["skill_name"] = values["name"]
            # Support cluster / category
            if "cluster" in values and "category" not in values:
                values["category"] = values["cluster"]
            elif "category" in values and "cluster" not in values:
                values["cluster"] = values["category"]
        return values

    @property
    def id(self) -> str:
        return self.skill_id

    @property
    def name(self) -> str:
        return self.skill_name


class EvaluationRequest(BaseModel):
    """
    Project submission evaluation input payload.
    Compatible with PROJECT.md Interface Contract and flexible field aliases.
    """
    submission_id: str = "SUB-DEFAULT"
    title: str = "Untitled Project"
    category: str = "general"  # "english_presentation", "stem_scientific", "social_humanities", "general"
    language: str = "en"  # "en", "vi", "bilingual"
    content: str
    reflection: Optional[str] = None
    grade_level: int = 8
    student_id: Optional[str] = None
    student_name: Optional[str] = None
    attachments: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, values: Any) -> Any:
        if isinstance(values, dict):
            # Map project_title -> title
            if "project_title" in values and "title" not in values:
                values["title"] = values["project_title"]
            # Map submission_text or content_text -> content
            if "submission_text" in values and "content" not in values:
                values["content"] = values["submission_text"]
            elif "content_text" in values and "content" not in values:
                values["content"] = values["content_text"]
            # Map reflection_text -> reflection
            if "reflection_text" in values and "reflection" not in values:
                values["reflection"] = values["reflection_text"]
            # Map project_category -> category
            if "project_category" in values and "category" not in values:
                values["category"] = values["project_category"]
        return values


class EvaluationResponse(BaseModel):
    """
    Evaluation output conforming to PROJECT.md Contract.
    Guarantees >= 3 SkillTags, 10-pt rubric breakdown, and constructive feedback.
    """
    submission_id: str
    rubric: RubricScoreBreakdown
    skills: list[SkillTag] = Field(..., min_length=3, description="Danh sách tối thiểu 3 thẻ kỹ năng được gắn")
    feedback: str
    growth_recommendations: list[str] = Field(default_factory=list)

    # Rich compatibility aliases & auxiliary fields
    overall_score: Optional[float] = None
    overall_level: Optional[str] = None
    tagged_skills: Optional[list[SkillTag]] = None
    constructive_feedback: Optional[dict[str, str]] = None
    rubric_scores: Optional[dict[str, Any]] = None

    @model_validator(mode="before")
    @classmethod
    def populate_compatibility_fields(cls, values: Any) -> Any:
        if isinstance(values, dict):
            # Ensure skills is set from tagged_skills if needed
            if "skills" not in values and "tagged_skills" in values:
                values["skills"] = values["tagged_skills"]
            elif "tagged_skills" not in values and "skills" in values:
                values["tagged_skills"] = values["skills"]

            # Populate overall_score from rubric if needed
            if values.get("overall_score") is None and "rubric" in values:
                rub = values["rubric"]
                if isinstance(rub, dict) and "total_score" in rub:
                    values["overall_score"] = rub["total_score"]
                elif hasattr(rub, "total_score"):
                    values["overall_score"] = rub.total_score

            # Determine overall level
            score = values.get("overall_score")
            if score is not None and not values.get("overall_level"):
                if score >= 9.0:
                    values["overall_level"] = "Xuất sắc"
                elif score >= 7.0:
                    values["overall_level"] = "Tốt"
                elif score >= 5.0:
                    values["overall_level"] = "Đạt"
                else:
                    values["overall_level"] = "Cần cố gắng"
        return values

    @property
    def total_score(self) -> float:
        return self.rubric.total_score

    @property
    def performance_band(self) -> str:
        return self.overall_level or "Tốt"
