"""
Project and Submission Models for UMS Smart Growth Hub
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from app.models.rubric import EvaluationResponse


class SubmissionCategory(str, Enum):
    """Core categories of project-based learning submissions at UMS."""
    ENGLISH_PRESENTATION = "english_presentation"
    STEM_SCIENTIFIC = "stem_scientific"
    SOCIAL_HUMANITIES = "social_humanities"
    GENERAL = "general"


class ProjectCreate(BaseModel):
    """Schema for submitting a new student project."""
    student_id: str
    student_name: Optional[str] = None
    title: str = Field(..., min_length=2)
    category: str = Field(default=SubmissionCategory.GENERAL.value)
    language: str = Field(default="vi")
    content: str = Field(..., min_length=1)
    reflection: Optional[str] = None
    grade_level: int = Field(default=8, ge=6, le=9)
    attachments: list[str] = Field(default_factory=list)


class ProjectSubmission(BaseModel):
    """Stored student project entity in Project Vault."""
    submission_id: str
    student_id: str
    student_name: Optional[str] = None
    title: str
    category: str
    language: str = "vi"
    content: str
    reflection: Optional[str] = None
    grade_level: int = 8
    attachments: list[str] = Field(default_factory=list)
    status: str = "submitted"  # "submitted", "evaluated", "reviewed"
    submitted_at: Optional[str] = None
    evaluation: Optional[EvaluationResponse] = None
