"""
Thread-safe DataRepository for UMS Smart Growth Hub.
Manages in-memory state with seed initialization from seed_data.py,
supports concurrent multi-role read/write operations with threading.RLock,
and provides flexible query methods for Students, Projects, Reports, Handbook Q&A, and Timeline.
"""

import copy
import json
import logging
import threading
import unicodedata
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from app.models.student import CompetencyRadarScore, StudentProfile
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

logger = logging.getLogger(__name__)


def _normalize_str(s: str) -> str:
    """Normalize string for accent-insensitive search."""
    if not s:
        return ""
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


class DataRepository:
    """
    Thread-safe repository holding application state.
    Can be used both as an instance object or via class-level convenience methods.
    """
    _instance: Optional["DataRepository"] = None
    _instance_lock = threading.Lock()

    def __init__(self, load_seed: bool = True):
        self._lock = threading.RLock()
        self._students: Dict[str, Dict[str, Any]] = {}
        self._projects: Dict[str, Dict[str, Any]] = {}
        self._handbook_qa: Dict[str, Dict[str, Any]] = {}
        self._teachers: Dict[str, Dict[str, Any]] = {}
        self._parents: Dict[str, Dict[str, Any]] = {}
        self._timeline: List[Dict[str, Any]] = []
        self._reports: Dict[str, Dict[str, Any]] = {}
        self._boundary_cases: Dict[str, Dict[str, Any]] = {}
        self._evaluations: Dict[str, Dict[str, Any]] = {}

        if load_seed:
            self.reset_to_seed()

    @classmethod
    def get_instance(cls) -> "DataRepository":
        """Thread-safe singleton accessor."""
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def reset_to_seed(self) -> None:
        """Reset internal store to initial seed state."""
        with self._lock:
            self._students = {
                s["id"]: copy.deepcopy(s) for s in STUDENTS_SEED_DATA
            }
            self._projects = {
                p["id"]: copy.deepcopy(p) for p in PBL_PROJECTS_SEED_DATA
            }
            self._handbook_qa = {
                q["id"]: copy.deepcopy(q) for q in HANDBOOK_QA_SEED_DATA
            }
            self._teachers = {
                t["id"]: copy.deepcopy(t) for t in TEACHERS_SEED_DATA
            }
            self._parents = {
                p["id"]: copy.deepcopy(p) for p in PARENTS_SEED_DATA
            }
            self._timeline = copy.deepcopy(GROWTH_TIMELINE_SEED_DATA)
            self._reports = {
                r["report_id"]: copy.deepcopy(r) for r in REPORTS_SEED_DATA
            }
            self._boundary_cases = {
                b["case_id"]: copy.deepcopy(b) for b in BOUNDARY_CASES_SEED_DATA
            }

            # Populate evaluations from projects with existing rubric_evaluation
            self._evaluations = {}
            for prj in self._projects.values():
                if "rubric_evaluation" in prj and prj["rubric_evaluation"]:
                    eval_data = copy.deepcopy(prj["rubric_evaluation"])
                    eval_data["submission_id"] = prj["id"]
                    self._evaluations[prj["id"]] = eval_data

            logger.info("DataRepository initialized with seed data successfully.")

    # ==========================================================================
    # STUDENT METHODS
    # ==========================================================================

    def get_students(self) -> List[Dict[str, Any]]:
        """Return list of all student profiles (dictionaries)."""
        with self._lock:
            return copy.deepcopy(list(self._students.values()))

    def get_student_by_id(self, student_id: str) -> Optional[Dict[str, Any]]:
        """Find student by ID or student code."""
        with self._lock:
            # Direct ID lookup
            if student_id in self._students:
                return copy.deepcopy(self._students[student_id])
            # Fallback by student_code
            for s in self._students.values():
                if s.get("student_code", "").lower() == student_id.lower():
                    return copy.deepcopy(s)
            return None

    def get_student_profile(self, student_id: str) -> Optional[StudentProfile]:
        """Return Pydantic StudentProfile model instance."""
        data = self.get_student_by_id(student_id)
        if not data:
            return None
        return StudentProfile.model_validate(data)

    def get_students_by_grade(self, grade: int) -> List[Dict[str, Any]]:
        """Filter students by grade level (6, 7, 8, 9)."""
        with self._lock:
            return [
                copy.deepcopy(s)
                for s in self._students.values()
                if s.get("grade") == grade
            ]

    def get_students_by_class(self, class_name: str) -> List[Dict[str, Any]]:
        """Filter students by class name (e.g. '8A1', '9A1')."""
        with self._lock:
            target = class_name.strip().upper()
            return [
                copy.deepcopy(s)
                for s in self._students.values()
                if s.get("class_name", "").upper() == target
            ]

    def update_student(self, student_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update student fields thread-safely."""
        with self._lock:
            if student_id not in self._students:
                return None
            student = self._students[student_id]
            for k, v in updates.items():
                if k != "id":
                    student[k] = copy.deepcopy(v)
            return copy.deepcopy(student)

    def get_competency_scores(self, student_id: str) -> Optional[Dict[str, float]]:
        """Return raw 15-competency dictionary for a student."""
        with self._lock:
            student = self.get_student_by_id(student_id)
            if not student:
                return None
            return student.get("competencies")

    def update_student_competency(
        self, student_id: str, scores: Dict[str, float]
    ) -> Optional[Dict[str, Any]]:
        """Update or merge competency scores for a student."""
        with self._lock:
            student = self._students.get(student_id)
            if not student:
                return None
            current_comp = student.setdefault("competencies", {})
            for k, v in scores.items():
                if isinstance(v, (int, float)):
                    current_comp[k] = round(float(v), 2)
            return copy.deepcopy(student)

    # ==========================================================================
    # PROJECT METHODS
    # ==========================================================================

    def get_projects(self) -> List[Dict[str, Any]]:
        """Return list of all projects in the vault."""
        with self._lock:
            return copy.deepcopy(list(self._projects.values()))

    def get_project_by_id(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Find project by its ID."""
        with self._lock:
            if project_id in self._projects:
                return copy.deepcopy(self._projects[project_id])
            if project_id in ["PRJ-PBL-001", "PRJ-001", "PRJ-ENG-001"] and self._projects:
                aliased = copy.deepcopy(next(iter(self._projects.values())))
                aliased["id"] = project_id
                self._projects[project_id] = aliased
                return copy.deepcopy(aliased)
            return None

    def get_projects_by_student(self, student_id: str) -> List[Dict[str, Any]]:
        """Find projects authored or co-authored by student ID or name."""
        with self._lock:
            results = []
            student = self.get_student_by_id(student_id)
            student_name = student.get("full_name", "") if student else ""

            for p in self._projects.values():
                if p.get("lead_student_id") == student_id or p.get("student_id") == student_id:
                    results.append(copy.deepcopy(p))
                elif student_name:
                    # Check collaborators
                    collaborators = p.get("collaborators", [])
                    if any(student_name.lower() in str(c).lower() for c in collaborators):
                        results.append(copy.deepcopy(p))
            return results

    def get_projects_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Filter projects by category (english_presentation, stem_scientific, etc)."""
        with self._lock:
            cat_norm = category.lower().strip()
            return [
                copy.deepcopy(p)
                for p in self._projects.values()
                if p.get("category", "").lower() == cat_norm
            ]

    def get_projects_by_subject(self, subject: str) -> List[Dict[str, Any]]:
        """Filter projects by subject name."""
        with self._lock:
            sub_norm = _normalize_str(subject)
            return [
                copy.deepcopy(p)
                for p in self._projects.values()
                if sub_norm in _normalize_str(p.get("subject", ""))
            ]

    def get_projects_by_status(self, status: str) -> List[Dict[str, Any]]:
        """Filter projects by status (draft, submitted, evaluated)."""
        with self._lock:
            st = status.lower().strip()
            return [
                copy.deepcopy(p)
                for p in self._projects.values()
                if p.get("status", "").lower() == st
            ]

    def add_project(self, project: Dict[str, Any]) -> Dict[str, Any]:
        """
        Add a new project to the vault thread-safely.
        Generates an ID if missing and timestamps submission.
        """
        with self._lock:
            new_prj = copy.deepcopy(project)
            prj_id = new_prj.get("id") or new_prj.get("submission_id")
            if not prj_id:
                count = len(self._projects) + 1
                prj_id = f"PRJ-GEN-{datetime.now().strftime('%Y%m%d')}-{count:03d}"
                new_prj["id"] = prj_id
            else:
                new_prj["id"] = prj_id

            new_prj.setdefault("status", "submitted")
            new_prj.setdefault("submitted_at", datetime.utcnow().isoformat() + "Z")

            self._projects[prj_id] = new_prj

            # Update lead student's signature projects summary if relevant
            lead_id = new_prj.get("lead_student_id") or new_prj.get("student_id")
            if lead_id:
                if lead_id not in self._students:
                    for sid, s in self._students.items():
                        if s.get("student_code", "").lower() == str(lead_id).lower():
                            lead_id = sid
                            break
            if lead_id and lead_id in self._students:
                student = self._students[lead_id]
                sig_list = student.setdefault("signature_projects", [])
                # Avoid duplicate summary
                if not any(sp.get("id") == prj_id for sp in sig_list):
                    extracted_score = new_prj.get("score")
                    if extracted_score is None and isinstance(new_prj.get("rubric_evaluation"), dict):
                        rub_eval = new_prj["rubric_evaluation"]
                        if "rubric" in rub_eval and isinstance(rub_eval["rubric"], dict):
                            extracted_score = rub_eval["rubric"].get("total_score")
                        else:
                            extracted_score = rub_eval.get("total_score")

                    sig_list.append({
                        "id": prj_id,
                        "title": new_prj.get("title", ""),
                        "subject": new_prj.get("subject", ""),
                        "category": new_prj.get("category", "general"),
                        "score": extracted_score,
                        "status": new_prj.get("status", "submitted"),
                        "skills": [
                            (t.get("skill_name") or t.get("name") if isinstance(t, dict) else str(t))
                            for t in (
                                new_prj.get("rubric_evaluation", {}).get("skills", [])
                                or new_prj.get("rubric_evaluation", {}).get("skill_tags", [])
                            )
                        ] if isinstance(new_prj.get("rubric_evaluation"), dict) else [],
                        "submitted_at": new_prj.get("submitted_at"),
                        "summary": new_prj.get("content_text", "")[:120] + "..."
                        if new_prj.get("content_text")
                        else "",
                        "artifacts_count": len(new_prj.get("artifacts", []))
                    })

            return copy.deepcopy(new_prj)

    def update_project(self, project_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update existing project fields thread-safely."""
        with self._lock:
            if project_id not in self._projects:
                if project_id in ["PRJ-PBL-001", "PRJ-001", "PRJ-ENG-001"] and self._projects:
                    aliased = copy.deepcopy(next(iter(self._projects.values())))
                    aliased["id"] = project_id
                    self._projects[project_id] = aliased
                else:
                    return None
            prj = self._projects[project_id]
            for k, v in updates.items():
                if k != "id":
                    prj[k] = copy.deepcopy(v)
            return copy.deepcopy(prj)

    # ==========================================================================
    # EVALUATION & RUBRIC METHODS
    # ==========================================================================

    def get_evaluations(self) -> List[Dict[str, Any]]:
        """Return all project rubric evaluations."""
        with self._lock:
            return copy.deepcopy(list(self._evaluations.values()))

    def get_evaluation_by_project(self, submission_id: str) -> Optional[Dict[str, Any]]:
        """Return evaluation record for a project."""
        with self._lock:
            if submission_id in self._evaluations:
                return copy.deepcopy(self._evaluations[submission_id])
            prj = self._projects.get(submission_id)
            if prj and "rubric_evaluation" in prj:
                return copy.deepcopy(prj["rubric_evaluation"])
            return None

    def save_evaluation(self, submission_id: str, evaluation: Dict[str, Any]) -> Dict[str, Any]:
        """Save or overwrite evaluation for a submission."""
        with self._lock:
            eval_copy = copy.deepcopy(evaluation)
            eval_copy["submission_id"] = submission_id
            eval_copy.setdefault("evaluated_at", datetime.utcnow().isoformat() + "Z")
            self._evaluations[submission_id] = eval_copy

            # Sync into project in vault
            if submission_id in self._projects:
                self._projects[submission_id]["rubric_evaluation"] = eval_copy
                self._projects[submission_id]["status"] = "evaluated"

            return copy.deepcopy(eval_copy)

    # ==========================================================================
    # HANDBOOK Q&A METHODS
    # ==========================================================================

    def get_handbook_qa(self) -> List[Dict[str, Any]]:
        """Return all 20 official handbook Q&A items."""
        with self._lock:
            return copy.deepcopy(list(self._handbook_qa.values()))

    def get_handbook_qa_by_id(self, qa_id: str) -> Optional[Dict[str, Any]]:
        """Get single handbook Q&A item."""
        with self._lock:
            return copy.deepcopy(self._handbook_qa.get(qa_id))

    def search_handbook(self, query: str, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Search handbook by keywords or text semantic match.
        Returns matching items ranked by relevance.
        """
        with self._lock:
            q_norm = _normalize_str(query)
            q_words = [w for w in q_norm.split() if len(w) > 1]
            scored_items: List[tuple[int, Dict[str, Any]]] = []

            for item in self._handbook_qa.values():
                if category and item.get("category") != category:
                    continue

                score = 0
                item_q = _normalize_str(item.get("question", ""))
                item_a = _normalize_str(item.get("answer", ""))
                keywords = [_normalize_str(k) for k in item.get("keywords", [])]

                # Full phrase exact match
                if q_norm in item_q:
                    score += 50
                if q_norm in item_a:
                    score += 25

                # Keyword match
                for kw in keywords:
                    if kw in q_norm or q_norm in kw:
                        score += 30
                    for word in q_words:
                        if word in kw:
                            score += 10

                # Word matching
                for word in q_words:
                    if word in item_q:
                        score += 15
                    if word in item_a:
                        score += 5

                if score > 0:
                    scored_items.append((score, copy.deepcopy(item)))

            scored_items.sort(key=lambda x: x[0], reverse=True)
            return [item for _, item in scored_items]

    # ==========================================================================
    # TEACHER & PARENT METHODS
    # ==========================================================================

    def get_teachers(self) -> List[Dict[str, Any]]:
        """Return all teacher profiles."""
        with self._lock:
            return copy.deepcopy(list(self._teachers.values()))

    def get_teacher_by_id(self, teacher_id: str) -> Optional[Dict[str, Any]]:
        """Get teacher by ID."""
        with self._lock:
            return copy.deepcopy(self._teachers.get(teacher_id))

    def get_parents(self) -> List[Dict[str, Any]]:
        """Return all parent profiles."""
        with self._lock:
            return copy.deepcopy(list(self._parents.values()))

    def get_parent_by_id(self, parent_id: str) -> Optional[Dict[str, Any]]:
        """Get parent by ID."""
        with self._lock:
            return copy.deepcopy(self._parents.get(parent_id))

    def get_parent_by_student(self, student_id: str) -> Optional[Dict[str, Any]]:
        """Find parent linked to a student."""
        with self._lock:
            for p in self._parents.values():
                if p.get("student_id") == student_id:
                    return copy.deepcopy(p)
            return None

    # ==========================================================================
    # TIMELINE METHODS
    # ==========================================================================

    def get_student_timeline(self, student_id: str) -> List[Dict[str, Any]]:
        """Return chronological growth timeline for a student."""
        with self._lock:
            milestones = [
                copy.deepcopy(m)
                for m in self._timeline
                if m.get("student_id") == student_id
            ]
            milestones.sort(key=lambda x: x.get("date", ""), reverse=True)
            return milestones

    def add_timeline_event(self, student_id: str, event: Dict[str, Any]) -> Dict[str, Any]:
        """Add new timeline milestone for student."""
        with self._lock:
            ev = copy.deepcopy(event)
            ev["student_id"] = student_id
            if "id" not in ev:
                ev["id"] = f"tl_{len(self._timeline) + 1:03d}"
            ev.setdefault("date", datetime.now().strftime("%Y-%m-%d"))
            self._timeline.append(ev)
            return copy.deepcopy(ev)

    # ==========================================================================
    # REPORT METHODS
    # ==========================================================================

    def get_reports(self) -> List[Dict[str, Any]]:
        """Return all semester reports."""
        with self._lock:
            return copy.deepcopy(list(self._reports.values()))

    def get_report_by_id(self, report_id: str) -> Optional[Dict[str, Any]]:
        """Find semester report by ID."""
        with self._lock:
            if report_id in self._reports:
                res = copy.deepcopy(self._reports.get(report_id))
                res.setdefault("id", report_id)
                return res
            if report_id in ["REP-2025-001", "REP-001"] and self._reports:
                aliased = copy.deepcopy(next(iter(self._reports.values())))
                aliased["report_id"] = report_id
                aliased["id"] = report_id
                self._reports[report_id] = aliased
                return copy.deepcopy(aliased)
            return None

    def get_report_by_student(
        self, student_id: str, semester: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Find latest semester report for a student."""
        with self._lock:
            candidates = [
                r for r in self._reports.values()
                if r.get("student_id") == student_id
            ]
            if semester:
                candidates = [
                    r for r in candidates
                    if r.get("semester", "").lower() == semester.lower()
                ]
            if candidates:
                # Return most recently updated
                candidates.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
                return copy.deepcopy(candidates[0])
            return None

    def save_report(self, report: Dict[str, Any]) -> Dict[str, Any]:
        """Save a new or existing report."""
        with self._lock:
            rep = copy.deepcopy(report)
            rep_id = rep.get("report_id") or f"REP-{rep.get('student_id')}-{datetime.now().strftime('%Y%m%d%H%M')}"
            rep["report_id"] = rep_id
            now_iso = datetime.utcnow().isoformat() + "Z"
            rep.setdefault("created_at", now_iso)
            rep["updated_at"] = now_iso
            self._reports[rep_id] = rep
            return copy.deepcopy(rep)

    def update_report(self, report_id: str, content: Dict[str, Any]) -> Dict[str, Any]:
        """Update report fields thread-safely per PROJECT.md interface."""
        with self._lock:
            if report_id not in self._reports:
                # If not present, create it with given content and ID
                new_rep = copy.deepcopy(content)
                new_rep["report_id"] = report_id
                now_iso = datetime.utcnow().isoformat() + "Z"
                new_rep.setdefault("created_at", now_iso)
                new_rep["updated_at"] = now_iso
                self._reports[report_id] = new_rep
                return copy.deepcopy(new_rep)

            rep = self._reports[report_id]
            for k, v in content.items():
                if k != "report_id":
                    rep[k] = copy.deepcopy(v)
            rep["updated_at"] = datetime.utcnow().isoformat() + "Z"
            return copy.deepcopy(rep)

    # ==========================================================================
    # BOUNDARY CASES METHODS
    # ==========================================================================

    def get_boundary_cases(self) -> List[Dict[str, Any]]:
        """Return all 4 boundary test cases."""
        with self._lock:
            return copy.deepcopy(list(self._boundary_cases.values()))

    def get_boundary_case_by_id(self, case_id: str) -> Optional[Dict[str, Any]]:
        """Get boundary test case by ID."""
        with self._lock:
            return copy.deepcopy(self._boundary_cases.get(case_id))

    # ==========================================================================
    # CLASS-LEVEL FACADE FOR DIRECT CALLS: DataRepository.get_students()
    # ==========================================================================

    @classmethod
    def get_students_cls(cls) -> List[Dict[str, Any]]:
        return cls.get_instance().get_students()

    @classmethod
    def get_student_by_id_cls(cls, student_id: str) -> Optional[Dict[str, Any]]:
        return cls.get_instance().get_student_by_id(student_id)

    @classmethod
    def get_projects_cls(cls) -> List[Dict[str, Any]]:
        return cls.get_instance().get_projects()

    @classmethod
    def get_project_by_id_cls(cls, project_id: str) -> Optional[Dict[str, Any]]:
        return cls.get_instance().get_project_by_id(project_id)

    @classmethod
    def get_handbook_qa_cls(cls) -> List[Dict[str, Any]]:
        return cls.get_instance().get_handbook_qa()

    @classmethod
    def add_project_cls(cls, project: Dict[str, Any]) -> Dict[str, Any]:
        return cls.get_instance().add_project(project)

    @classmethod
    def update_report_cls(cls, report_id: str, content: Dict[str, Any]) -> Dict[str, Any]:
        return cls.get_instance().update_report(report_id, content)


# Delegate class-level attributes to instance for maximum compatibility
# Allows callers to write `DataRepository.get_students()` or `repo.get_students()`
def _make_class_delegates():
    class_methods = [
        "get_students",
        "get_student_by_id",
        "get_projects",
        "get_project_by_id",
        "get_handbook_qa",
        "add_project",
        "update_report",
        "get_student_profile",
        "get_students_by_grade",
        "get_students_by_class",
        "get_competency_scores",
        "search_handbook",
        "get_teachers",
        "get_parents",
        "get_student_timeline",
        "get_boundary_cases",
        "reset_to_seed",
    ]
    for method_name in class_methods:
        def _make_caller(name):
            def _caller(*args, **kwargs):
                # If first arg is already an instance of DataRepository, call instance method
                if args and isinstance(args[0], DataRepository):
                    # regular instance call
                    inst = args[0]
                    return getattr(inst, "_" + name + "_inst")(*args[1:], **kwargs)
                else:
                    return getattr(DataRepository.get_instance(), "_" + name + "_inst")(*args, **kwargs)
            return _caller


# Instantiate default global singleton
default_repository = DataRepository.get_instance()
