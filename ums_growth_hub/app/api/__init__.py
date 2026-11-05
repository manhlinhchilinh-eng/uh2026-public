"""
REST API Routers Package for UMS Smart Growth Hub.
"""

from app.api.ai_routes import router as ai_router
from app.api.report_routes import router as report_router
from app.api.student_routes import router as student_router
from app.api.project_routes import router as project_router
from app.api.parent_routes import router as parent_router

__all__ = [
    "ai_router",
    "report_router",
    "student_router",
    "project_router",
    "parent_router",
]
