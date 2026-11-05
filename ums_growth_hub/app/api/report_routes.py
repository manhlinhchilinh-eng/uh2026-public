"""
Semester Report Generation and Management API Routes.
Provides endpoints to generate, query, edit, and export AI-assisted semester evaluation reports.
Enforces strict zero-placeholder guarantee.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field

from app.core.pdf_builder import pdf_builder
from app.core.report_gen import ReportGenerator, validate_no_placeholders
from app.data.repository import DataRepository
from app.models.report import SemesterReportRequest, SemesterReportResponse

router = APIRouter(prefix="/reports", tags=["Reports"])
logger = logging.getLogger(__name__)

report_generator = ReportGenerator()
repo = DataRepository.get_instance()


class ReportUpdateRequest(BaseModel):
    """Payload for teacher manual report updates."""
    academic_eval: Optional[str] = Field(default=None, description="Chỉnh sửa phần chuyên môn")
    soft_skills_eval: Optional[str] = Field(default=None, description="Chỉnh sửa phần phẩm chất")
    highschool_pathway_advice: Optional[str] = Field(default=None, description="Chỉnh sửa định hướng CNN")
    section_academic: Optional[str] = None
    section_qualities: Optional[str] = None
    section_orientation: Optional[str] = None
    full_text: Optional[str] = None
    teacher_signature: Optional[str] = None
    status: Optional[str] = "teacher_edited"


@router.post("/generate", status_code=status.HTTP_200_OK)
def generate_semester_report(payload: Dict[str, Any]):
    """
    Generates a tripartite semester report for a student.
    Enriches with student persona data and project achievements from repository if available.
    Guarantees zero placeholders.
    """
    try:
        student_id = payload.get("student_id")
        student = None
        if student_id:
            student = repo.get_student_by_id(student_id)

        # Enrich payload with student data if not provided
        if student:
            if not payload.get("student_name"):
                payload["student_name"] = student.get("full_name", "Học sinh UMS")
            if not payload.get("grade_level"):
                payload["grade_level"] = student.get("grade", 8)
            if not payload.get("competency_scores") and student.get("competencies"):
                comp = student["competencies"]
                payload["competency_scores"] = comp if isinstance(comp, dict) else comp.to_dict()
            if not payload.get("projects_completed"):
                student_projects = repo.get_projects_by_student(student_id)
                payload["projects_completed"] = student_projects

        # Generate report
        report_res: SemesterReportResponse = report_generator.generate_report(payload)
        report_dict = report_res.model_dump()

        # Ensure report_id is present
        report_id = payload.get("report_id") or f"REP-{report_res.student_id}-{payload.get('semester', 'HK1')}"
        report_dict["report_id"] = report_id
        report_dict["id"] = report_id

        # Save to repository
        repo.update_report(report_id, report_dict)

        return report_dict

    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as exc:
        logger.exception("Error generating report: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi sinh nhận xét học kỳ: {str(exc)}",
        )


@router.get("", response_model=List[Dict[str, Any]], status_code=status.HTTP_200_OK)
def list_reports():
    """Returns all stored semester reports."""
    return repo.get_reports()


@router.get("/{report_id}", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
def get_report(report_id: str):
    """Retrieves a single semester report by ID."""
    report = repo.get_report_by_id(report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bản nhận xét")
    return report


@router.put("/{report_id}", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
def update_report(report_id: str, updates: ReportUpdateRequest):
    """
    Allows teacher to inline edit and personalize AI-suggested comments.
    Enforces strict zero-placeholder check on modified text.
    """
    existing = repo.get_report_by_id(report_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bản nhận xét")

    updated_dict = dict(existing)

    # Apply section updates
    if updates.academic_eval or updates.section_academic:
        val = updates.academic_eval or updates.section_academic
        violations = validate_no_placeholders(val)
        if violations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Phát hiện placeholder chưa xử lý: {', '.join(violations)}"
            )
        updated_dict["section_academic"] = val
        if "sections" in updated_dict and isinstance(updated_dict["sections"], dict):
            updated_dict["sections"]["academic_and_language"] = val

    if updates.soft_skills_eval or updates.section_qualities:
        val = updates.soft_skills_eval or updates.section_qualities
        violations = validate_no_placeholders(val)
        if violations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Phát hiện placeholder chưa xử lý: {', '.join(violations)}"
            )
        updated_dict["section_qualities"] = val
        if "sections" in updated_dict and isinstance(updated_dict["sections"], dict):
            updated_dict["sections"]["qualities_and_soft_skills"] = val

    if updates.highschool_pathway_advice or updates.section_orientation:
        val = updates.highschool_pathway_advice or updates.section_orientation
        violations = validate_no_placeholders(val)
        if violations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Phát hiện placeholder chưa xử lý: {', '.join(violations)}"
            )
        updated_dict["section_orientation"] = val
        if "sections" in updated_dict and isinstance(updated_dict["sections"], dict):
            updated_dict["sections"]["highschool_pathway_guidance"] = val

    if updates.full_text:
        violations = validate_no_placeholders(updates.full_text)
        if violations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Phát hiện placeholder chưa xử lý: {', '.join(violations)}"
            )
        updated_dict["full_text"] = updates.full_text

    if updates.teacher_signature:
        updated_dict["teacher_signature"] = updates.teacher_signature

    updated_dict["status"] = updates.status or "teacher_edited"

    saved = repo.update_report(report_id, updated_dict)
    return saved


@router.get("/{report_id}/pdf", status_code=status.HTTP_200_OK)
def export_report_pdf(report_id: str):
    """
    Downloads the semester evaluation report as a printable ReportLab PDF.
    """
    report = repo.get_report_by_id(report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bản nhận xét")

    student_id = report.get("student_id")
    student = repo.get_student_by_id(student_id) if student_id else None

    pdf_bytes = pdf_builder.build_report_pdf(report, student)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=UMS_Report_{report_id}.pdf"
        },
    )
