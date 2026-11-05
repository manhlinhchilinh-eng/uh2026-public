"""
FastAPI Application Entry Point for UMS Smart Growth Hub.
Configures CORS, static assets, API routers, health checks, and root single-page application delivery.
"""

import os
from pathlib import Path
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import (
    ai_router,
    parent_router,
    project_router,
    report_router,
    student_router,
)
from app.config import (
    ALLOWED_HEADERS,
    ALLOWED_METHODS,
    ALLOWED_ORIGINS,
    APP_DESCRIPTION,
    APP_TITLE,
    APP_VERSION,
    STATIC_DIR,
)
from app.data.repository import DataRepository

# Initialize FastAPI application
app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure Cross-Origin Resource Sharing (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=ALLOWED_METHODS,
    allow_headers=ALLOWED_HEADERS,
)

# Register API Routers under /api prefix
app.include_router(ai_router, prefix="/api")
app.include_router(report_router, prefix="/api")
app.include_router(student_router, prefix="/api")
app.include_router(project_router, prefix="/api")
app.include_router(parent_router, prefix="/api")

# Mount static asset directory
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/api/health", status_code=status.HTTP_200_OK, tags=["System"])
def health_check():
    """
    Service health check endpoint used by runners and monitoring tools.
    """
    return {
        "status": "healthy",
        "service": "ums_growth_hub",
        "version": APP_VERSION,
        "mode": "offline_core_ai",
        "standards": ["GDPT 2018", "CEFR", "CNN High School Pathway"]
    }


@app.post("/api/reset", status_code=status.HTTP_200_OK, tags=["System"])
@app.get("/api/reset", status_code=status.HTTP_200_OK, tags=["System"])
def reset_system_state():
    """
    Resets the in-memory repository to clean seed data.
    """
    repo = DataRepository.get_instance()
    repo.reset_to_seed()
    return {
        "status": "success",
        "message": "Hệ thống đã được thiết lập lại về trạng thái dữ liệu mẫu chuẩn UMS."
    }


@app.get("/", include_in_schema=False)
def serve_index():
    """
    Delivers the single-page web platform front-end.
    """
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return JSONResponse(
        content={
            "service": APP_TITLE,
            "status": "running",
            "docs": "/docs",
            "api_health": "/api/health"
        }
    )
