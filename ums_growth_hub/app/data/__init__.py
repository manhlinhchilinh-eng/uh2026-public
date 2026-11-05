"""
Data layer package for UMS Smart Growth Hub.
Exports DataRepository, default_repository, and seed datasets.
"""

from app.data.repository import DataRepository, default_repository
from app.data.seed_data import (
    BOUNDARY_CASES_SEED_DATA,
    GROWTH_TIMELINE_SEED_DATA,
    HANDBOOK_QA_SEED_DATA,
    PARENTS_SEED_DATA,
    PBL_PROJECTS_SEED_DATA,
    REPORTS_SEED_DATA,
    STUDENTS_SEED_DATA,
    TEACHERS_SEED_DATA,
)

__all__ = [
    "DataRepository",
    "default_repository",
    "STUDENTS_SEED_DATA",
    "PBL_PROJECTS_SEED_DATA",
    "HANDBOOK_QA_SEED_DATA",
    "BOUNDARY_CASES_SEED_DATA",
    "TEACHERS_SEED_DATA",
    "PARENTS_SEED_DATA",
    "GROWTH_TIMELINE_SEED_DATA",
    "REPORTS_SEED_DATA",
]
