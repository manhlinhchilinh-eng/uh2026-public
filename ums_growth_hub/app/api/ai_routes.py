"""
AI Evaluation and Skill Tagging API Routes.
Exposes Core AI Engine endpoints for GDPT 2018 rubric grading and competency skill extraction.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.evaluator import rubric_evaluator
from app.core.skill_tagger import skill_tagger
from app.models.rubric import EvaluationRequest, EvaluationResponse, SkillTag

router = APIRouter(prefix="/ai", tags=["AI Engine"])
logger = logging.getLogger(__name__)


class SkillExtractionRequest(BaseModel):
    """Payload for skill extraction endpoint."""
    content: Optional[str] = Field(default=None, description="Nội dung bài viết hoặc transcript thuyết trình")
    text: Optional[str] = Field(default=None, description="Alias cho content")
    category: Optional[str] = Field(default="general", description="Phân loại dự án")
    reflection: Optional[str] = Field(default=None, description="Nhật ký phản tư của học sinh")


class PreCheckRequest(BaseModel):
    """Payload for student pre-submission check."""
    content: str = Field(..., min_length=1)
    category: str = Field(default="general")
    title: Optional[str] = None


@router.post("/evaluate", response_model=EvaluationResponse, status_code=status.HTTP_200_OK)
def evaluate_project(payload: Dict[str, Any]):
    """
    Evaluates a project-based learning submission using the GDPT 2018 4-Dimension Rubric.
    Guarantees:
    - 10-point scale breakdown (Content, Language, Critical Thinking, Collaboration)
    - At least 3 tagged skills with confidence >= 0.65
    - Constructive, actionable pedagogical feedback
    """
    try:
        response = rubric_evaluator.evaluate(payload)
        return response
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as exc:
        logger.exception("AI evaluation error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Đã xảy ra lỗi trong quá trình đánh giá AI: {str(exc)}",
        )


@router.post("/extract-skills", status_code=status.HTTP_200_OK)
def extract_skills(payload: SkillExtractionRequest):
    """
    Extracts verified skill tags from text and reflection based on the 28-skill GDPT 2018 taxonomy.
    Guarantees at least 3 skills with evidence citations.
    """
    text = payload.content or payload.text or ""
    if not text.strip():
        # Fallback to category prior skills
        text = "Báo cáo dự án học tập liên môn UMS."

    skills: List[SkillTag] = skill_tagger.tag_submission(
        content=text,
        category=payload.category or "general",
        reflection=payload.reflection,
    )
    return {
        "skills": [s.model_dump() for s in skills],
        "count": len(skills),
    }


@router.post("/pre-check", status_code=status.HTTP_200_OK)
def pre_check_submission(payload: PreCheckRequest):
    """
    Lightweight pre-submission quality inspection for students before submitting to teacher.
    Checks completeness, word count, structural sections, and initial skills.
    """
    text = payload.content.strip()
    words = text.split()
    word_count = len(words)

    skills = skill_tagger.tag_submission(content=text, category=payload.category)
    skill_names = [s.skill_name for s in skills]

    hints = []
    if word_count < 150:
        hints.append("Nội dung bài viết còn tương đối ngắn. Em nên mở rộng thêm các luận cứ và số liệu thực tế.")
    else:
        hints.append("Độ dài bài viết đạt chuẩn học thuật.")

    if not any(h in text.lower() for h in ["kết luận", "tổng kết", "conclusion", "bài học"]):
        hints.append("Gợi ý: Bổ sung thêm phần kết luận hoặc bài học rút ra để bài nộp thêm trọn vẹn.")

    return {
        "word_count": word_count,
        "readiness": "Sẵn sàng nộp" if word_count >= 150 else "Cần bổ sung thêm",
        "predicted_skills": skill_names,
        "suggestions": hints,
    }
