"""
Parent Experience and 24/7 AI Companion API Routes.
Provides visual growth timeline feeds and AI companion chatbot interaction.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.chatbot import school_home_chatbot
from app.data.repository import DataRepository

router = APIRouter(prefix="/parent", tags=["Parent Portal"])
logger = logging.getLogger(__name__)

repo = DataRepository.get_instance()


class ParentChatRequest(BaseModel):
    """Payload for parent 24/7 AI companion inquiries."""
    question: str = Field(default="", description="Câu hỏi hoặc yêu cầu tư vấn")
    student_id: Optional[str] = Field(default=None, description="Mã học sinh liên kết")


@router.get("/timeline/{student_id}", response_model=List[Dict[str, Any]], status_code=status.HTTP_200_OK)
def get_parent_growth_timeline(student_id: str):
    """
    Returns visual growth timeline events for a student.
    Resolves both user ID (e.g. usr_stu_001) and student code (e.g. UMS-9A1-001).
    """
    student = repo.get_student_by_id(student_id)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy học sinh với mã {student_id}",
        )

    # Search by both ID and code
    ids_to_check = [student.get("id"), student.get("student_code"), student_id]
    events = []
    seen_ids = set()

    for sid in ids_to_check:
        if not sid:
            continue
        timeline_items = repo.get_student_timeline(sid)
        for item in timeline_items:
            iid = item.get("id")
            if iid not in seen_ids:
                seen_ids.add(iid)
                events.append(item)

    # Ensure all student signature projects (including freshly submitted/graded ones) are represented
    for prj in student.get("signature_projects", []):
        pid = prj.get("id")
        milestone_id = f"milestone_{pid}"
        if milestone_id not in seen_ids and not any(e.get("project_id") == pid for e in events):
            seen_ids.add(milestone_id)
            events.append({
                "id": milestone_id,
                "student_id": student.get("id", student_id),
                "date": str(prj.get("submitted_at", "2026-03-15"))[:10],
                "title": prj.get("title", "Dự án liên môn"),
                "description": prj.get("summary") or "Dự án học tập liên môn UMS.",
                "category": "project",
                "score": prj.get("score"),
                "badge": (prj.get("skills", ["Minh chứng UMS"])[0] if prj.get("skills") else "Minh chứng UMS"),
                "project_id": pid,
            })

    events.sort(key=lambda x: str(x.get("date", "")), reverse=True)
    return events


@router.post("/chat", status_code=status.HTTP_200_OK)
def parent_ai_companion_chat(payload: Dict[str, Any]):
    """
    24/7 School-Home AI Companion Chatbot.
    Answers parent questions about school regulations, clubs, timetable, and CNN high school transition.
    Accepts question and optional student_id for personalized context.
    """
    question = payload.get("question", "")
    student_id = payload.get("student_id")

    res = school_home_chatbot.query(question=question, student_id=student_id)
    return res
