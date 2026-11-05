"""
Application Configuration for UMS Smart Growth Hub.
Centralizes paths, runtime defaults, brand colors, and environment configurations.
"""

import os
from pathlib import Path
from typing import List

# Path constants
BASE_DIR: Path = Path(__file__).resolve().parent.parent
APP_DIR: Path = BASE_DIR / "app"
STATIC_DIR: Path = APP_DIR / "static"
DATA_DIR: Path = APP_DIR / "data"

# Application metadata
APP_TITLE: str = "UMS Smart Growth Hub"
APP_VERSION: str = "1.0.0"
APP_DESCRIPTION: str = (
    "Hệ thống số hóa hồ sơ năng lực học sinh (Digital Portfolio / Student Competency Passport) "
    "tích hợp Core AI Engine đánh giá năng lực liên môn và trợ lý đồng hành thông minh Nhà trường - Gia đình "
    "dành cho Trường THCS Ngoại ngữ (UMS - ULIS)."
)

# Server defaults
DEFAULT_HOST: str = os.getenv("HOST", "127.0.0.1")
DEFAULT_PORT: int = int(os.getenv("PORT", "8000"))
FALLBACK_PORTS: List[int] = [8000, 8001, 8002, 8080, 5000, 3000]

# CORS configuration
ALLOWED_ORIGINS: List[str] = ["*"]
ALLOWED_METHODS: List[str] = ["*"]
ALLOWED_HEADERS: List[str] = ["*"]

# Brand Theme Aesthetics
BRAND_PRIMARY_NAVY: str = "#0A2540"
BRAND_SECONDARY_GOLD: str = "#D4AF37"
BRAND_ACCENT_BLUE: str = "#1A4F7C"
BRAND_BG_LIGHT: str = "#F8FAFC"
BRAND_TEXT_DARK: str = "#1E293B"

# School identity metadata
SCHOOL_NAME: str = "Trường THCS Ngoại ngữ"
SCHOOL_NAME_EN: str = "ULIS Middle School (UMS)"
UNIVERSITY_AFFILIATION: str = "Trường Đại học Ngoại ngữ - Đại học Quốc gia Hà Nội (ULIS - VNU)"
TARGET_HIGHSCHOOL: str = "Trường THPT Chuyên Ngoại ngữ (CNN - FLSS)"
