"""
Student and Digital Passport API Routes.
Provides endpoints for student profile management, GDPT 2018 radar chart data, and Student Digital Passport PDF export.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.core.pdf_builder import pdf_builder
from app.data.repository import DataRepository

router = APIRouter(prefix="/students", tags=["Students"])
logger = logging.getLogger(__name__)

repo = DataRepository.get_instance()


def _ensure_radar_scores(student: Dict[str, Any]) -> Dict[str, float]:
    """Ensures student has standard radar_scores dictionary compatible with tests and UI."""
    if "radar_scores" in student and isinstance(student["radar_scores"], dict) and student["radar_scores"]:
        return student["radar_scores"]

    comp = student.get("competencies", {})
    if not isinstance(comp, dict):
        comp = {}

    radar = {
        "language": comp.get("ngon_ngu", 8.8),
        "creativity": comp.get("tham_my", comp.get("giai_quyet_van_de_sang_tao", 8.5)),
        "problem_solving": comp.get("giai_quyet_van_de_sang_tao", 8.5),
        "collaboration": comp.get("giao_tiep_hop_tac", 8.8),
        "self_direction": comp.get("tu_chu_tu_hoc", 8.5),
        "digital_tech": comp.get("tin_hoc", comp.get("cong_nghe", 8.5)),
    }
    student["radar_scores"] = radar
    return radar


@router.get("", response_model=List[Dict[str, Any]], status_code=status.HTTP_200_OK)
def list_students(
    grade: Optional[int] = Query(None, ge=6, le=9),
    class_name: Optional[str] = Query(None),
):
    """
    Returns list of all students, with optional filtering by grade level or class.
    """
    if grade is not None:
        students = repo.get_students_by_grade(grade)
    elif class_name:
        students = repo.get_students_by_class(class_name)
    else:
        students = repo.get_students()

    for s in students:
        _ensure_radar_scores(s)

    return students


@router.get("/{student_id}", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
def get_student_by_id(student_id: str):
    """
    Retrieves full profile for a specific student by student_id or student_code.
    """
    student = repo.get_student_by_id(student_id)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy học sinh với mã {student_id}",
        )
    _ensure_radar_scores(student)
    return student


@router.get("/{student_id}/radar", status_code=status.HTTP_200_OK)
def get_student_radar_data(student_id: str):
    """
    Retrieves normalized radar / spider chart competency scores for Chart.js visualization.
    Conforms to GDPT 2018 15-dimension competency framework.
    """
    student = repo.get_student_by_id(student_id)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy học sinh với mã {student_id}",
        )

    radar = _ensure_radar_scores(student)
    comp = student.get("competencies", {})

    labels_vi = [
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

    gdpt_scores = [comp.get(k, 8.5) for k in keys]
    benchmark_scores = [8.0 for _ in keys]

    return {
        "student_id": student.get("id", student_id),
        "student_code": student.get("student_code", student_id),
        "student_name": student.get("full_name", "Học sinh UMS"),
        "radar_scores": radar,
        "competencies": comp,
        "chart_config": {
            "labels": labels_vi,
            "datasets": [
                {
                    "label": f"Học sinh: {student.get('full_name', '')}",
                    "data": gdpt_scores,
                    "borderColor": "#0A2540",
                    "backgroundColor": "rgba(10, 37, 64, 0.2)",
                    "pointBackgroundColor": "#D4AF37",
                },
                {
                    "label": "Chuẩn trung bình Khối",
                    "data": benchmark_scores,
                    "borderColor": "#D4AF37",
                    "borderDash": [4, 4],
                    "backgroundColor": "rgba(212, 175, 55, 0.1)",
                    "pointBackgroundColor": "#94A3B8",
                }
            ]
        }
    }


@router.get("/{student_id}/passport", status_code=status.HTTP_200_OK)
def get_student_digital_passport(student_id: str):
    """
    Returns structured data for the Student Digital Passport / CV for high school transition.
    """
    student = repo.get_student_by_id(student_id)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy học sinh với mã {student_id}",
        )
    _ensure_radar_scores(student)

    # Return passport package
    passport_data = dict(student)
    passport_data["school_name"] = "Trường THCS Ngoại ngữ (UMS - ULIS)"
    passport_data["school_branding"] = "Trường THCS Ngoại ngữ (UMS - ULIS)"
    passport_data["passport_id"] = f"PASS-{student.get('student_code', student_id)}"
    passport_data["qr_verification_url"] = f"https://ums.edu.vn/verify/{student.get('student_code', student_id)}"
    return passport_data


@router.get("/{student_id}/passport/pdf", status_code=status.HTTP_200_OK)
@router.get("/{student_id}/export-passport", status_code=status.HTTP_200_OK)
def export_student_passport_pdf(
    student_id: str,
    format: Optional[str] = Query("pdf", description="pdf or json")
):
    """
    Exports printable Student Digital Passport as ReportLab PDF stream (or JSON if requested).
    """
    student = repo.get_student_by_id(student_id)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy học sinh với mã {student_id}",
        )
    _ensure_radar_scores(student)

    if format and format.lower() == "json":
        return student

    pdf_bytes = pdf_builder.build_passport_pdf(student)
    filename = f"Passport_{student.get('student_code', student_id)}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        },
    )
