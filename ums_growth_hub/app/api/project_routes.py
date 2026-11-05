"""
Project Vault and Teacher Rubric Grading API Routes.
Provides endpoints for submitting projects, viewing vault items, and grading submissions.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.evaluator import rubric_evaluator
from app.data.repository import DataRepository
from app.models.project import ProjectCreate

router = APIRouter(prefix="/projects", tags=["Projects"])
logger = logging.getLogger(__name__)

repo = DataRepository.get_instance()


class GradeSubmissionRequest(BaseModel):
    """Payload for teacher manual rubric grading and score adjustments."""
    criteria_scores: Optional[Dict[str, float]] = Field(default=None, description="Điểm 4 tiêu chí")
    total_score: Optional[float] = Field(default=None, ge=0.0, le=10.0, description="Tổng điểm")
    new_score: Optional[float] = Field(default=None, ge=0.0, le=10.0, description="Bí danh tổng điểm")
    teacher_feedback: Optional[str] = Field(default=None, description="Nhận xét của giáo viên")
    teacher_note: Optional[str] = Field(default=None, description="Bí danh nhận xét của giáo viên")
    teacher_name: Optional[str] = Field(default="Cô Đỗ Tuệ Uyên", description="Tên giáo viên chấm")
    status: Optional[str] = "evaluated"

    def get_effective_score(self) -> Optional[float]:
        if self.total_score is not None:
            return self.total_score
        return self.new_score

    def get_effective_feedback(self) -> str:
        if self.teacher_feedback and self.teacher_feedback.strip():
            return self.teacher_feedback.strip()
        if self.teacher_note and self.teacher_note.strip():
            return self.teacher_note.strip()
        return "Giáo viên chủ nhiệm đã điều chỉnh điểm rubric."



@router.get("", response_model=List[Dict[str, Any]], status_code=status.HTTP_200_OK)
def list_projects(
    student_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    subject: Optional[str] = Query(None),
):
    """
    Returns list of projects in the vault, with flexible filtering.
    """
    if student_id:
        return repo.get_projects_by_student(student_id)
    elif category:
        return repo.get_projects_by_category(category)
    elif status_filter:
        return repo.get_projects_by_status(status_filter)
    elif subject:
        return repo.get_projects_by_subject(subject)
    else:
        return repo.get_projects()


@router.get("/{project_id}", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
def get_project_by_id(project_id: str):
    """
    Retrieves detailed submission record and evaluation for a project.
    """
    project = repo.get_project_by_id(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy dự án với mã {project_id}",
        )
    return project


@router.post("/submit", status_code=status.HTTP_201_CREATED)
@router.post("", status_code=status.HTTP_201_CREATED)
def submit_project(payload: Dict[str, Any]):
    """
    Submits a project to the Project Vault.
    Optionally evaluates immediately using the Core AI Engine if requested.
    """
    try:
        # Normalize fields
        content = payload.get("content") or payload.get("content_text") or payload.get("submission_text") or ""
        if not content.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nội dung bài nộp không được để trống",
            )

        title = payload.get("title") or payload.get("project_title") or "Dự án liên môn UMS"
        category = payload.get("category") or payload.get("project_category") or "general"
        student_id = payload.get("student_id") or "usr_stu_001"
        reflection = payload.get("reflection") or payload.get("student_reflection")

        # Automatically evaluate via AI evaluator to enrich project
        ai_eval = None
        try:
            eval_res = rubric_evaluator.evaluate({
                "submission_id": payload.get("submission_id") or payload.get("id") or "PRJ-TEMP",
                "title": title,
                "category": category,
                "language": payload.get("language", "vi"),
                "content": content,
                "reflection": reflection,
                "grade_level": payload.get("grade_level", 8)
            })
            ai_eval = eval_res.model_dump()
        except Exception as e:
            logger.warning("Auto evaluation warning: %s", e)

        # Prepare project record
        project_record = dict(payload)
        project_record["title"] = title
        project_record["content"] = content
        project_record["content_text"] = content
        project_record["category"] = category
        project_record["student_id"] = student_id
        project_record["reflection"] = reflection
        project_record["submitted_at"] = datetime.utcnow().isoformat() + "Z"

        if ai_eval:
            project_record["rubric_evaluation"] = ai_eval
            project_record["score"] = ai_eval.get("rubric", {}).get("total_score")
            project_record["status"] = "evaluated"
        else:
            project_record.setdefault("status", "submitted")

        saved = repo.add_project(project_record)
        if student_id:
            repo.add_timeline_event(student_id, {
                "title": f"Dự án '{title}' đã nộp thành công",
                "description": f"Học sinh đã nộp sản phẩm học tập lĩnh vực {category} vào Project Vault.",
                "category": "project",
                "badge": "Minh chứng Liên môn UMS",
                "score": project_record.get("score"),
                "project_id": saved.get("id"),
            })
        return saved

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error submitting project: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi nộp dự án: {str(exc)}"
        )


@router.put("/{project_id}/grade", status_code=status.HTTP_200_OK)
@router.post("/{project_id}/grade", status_code=status.HTTP_200_OK)
def grade_project(project_id: str, payload: GradeSubmissionRequest):
    """
    Teacher overrides or approves rubric scoring for a student project.
    Synchronizes into student profile and activity timeline.
    """
    project = repo.get_project_by_id(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy dự án với mã {project_id}",
        )

    effective_score = payload.get_effective_score()
    effective_feedback = payload.get_effective_feedback()

    # Update rubric evaluation
    existing_eval = project.get("rubric_evaluation", {}) or {}
    if payload.criteria_scores:
        existing_eval["criteria_scores"] = payload.criteria_scores
    if effective_score is not None:
        existing_eval["total_score"] = effective_score
        project["score"] = effective_score
    existing_eval["teacher_feedback"] = effective_feedback
    if payload.teacher_name:
        existing_eval["evaluated_by"] = payload.teacher_name

    project["rubric_evaluation"] = existing_eval
    project["status"] = "evaluated"

    updated = repo.update_project(project_id, project)

    # 1. Synchronize updated score & status to student's signature_projects summary
    student_id = project.get("student_id") or project.get("lead_student_id")
    if student_id:
        student = repo.get_student_by_id(student_id)
        if student and "signature_projects" in student:
            for sp in student["signature_projects"]:
                if sp.get("id") == project_id:
                    sp["score"] = project.get("score")
                    sp["status"] = "evaluated"
            repo.update_student(student["id"], {"signature_projects": student["signature_projects"]})

        # 2. Add real-time milestone event to Parent Growth Timeline
        repo.add_timeline_event(student_id, {
            "title": f"Dự án '{project.get('title')}' hoàn thành đánh giá",
            "description": f"Giáo viên {payload.teacher_name or 'bộ môn'} đã hoàn tất chấm điểm rubric: {project.get('score', 10.0)}/10.0.",
            "category": "project",
            "badge": "Minh chứng Liên môn UMS",
            "score": project.get("score"),
            "project_id": project_id,
            "teacher_note": effective_feedback
        })

    return updated
