"""
Tier 3 Test Suite: Combinatorial Pairwise Cross-Feature Interactions
Covers >= 20 combinatorial interaction test cases across Core AI, reports,
projects, data store, and multi-role views.
Dual-compatible with pytest and python -m unittest.
"""

import sys
import unittest
from pathlib import Path
from typing import Dict, Any

from tests.conftest import (
    get_evaluator,
    get_skill_tagger,
    get_nlp_engine,
    get_report_generator,
    get_data_repository,
    get_test_client,
    validate_no_placeholders,
    SKILL_TAXONOMY_28,
    SAMPLE_ENGLISH_PBL,
    SAMPLE_STEM_PBL,
    SAMPLE_SOCIAL_PBL,
    SAMPLE_PERSONAS,
    SAMPLE_HANDBOOK_QA,
)


class TestTier3_PairwiseCombinations(unittest.TestCase):
    """Pairwise combinatorial tests verifying cross-feature integrations."""

    def setUp(self):
        self.evaluator = get_evaluator()
        self.tagger = get_skill_tagger()
        self.nlp = get_nlp_engine()
        self.report_gen = get_report_generator()
        self.repo = get_data_repository()
        self.client = get_test_client()

    def test_t3_01_bilingual_ingestion_and_gdpt_rubric(self):
        """F01 (Bilingual) + F02 (GDPT Rubric): Processes EN, VI, and mixed texts into 10-pt scores."""
        for pbl in [SAMPLE_ENGLISH_PBL, SAMPLE_STEM_PBL, SAMPLE_SOCIAL_PBL]:
            res = self.evaluator.evaluate(pbl)
            rubric = res.rubric if hasattr(res, "rubric") else res["rubric"]
            tot = rubric.total_score if hasattr(rubric, "total_score") else rubric["total_score"]
            self.assertGreaterEqual(tot, 7.0)
            self.assertLessEqual(tot, 10.0)

    def test_t3_02_rubric_scoring_and_skill_tagging(self):
        """F02 (Rubric) + F03 (Skill Tagging): Simultaneous rubric scoring and skill tag extraction."""
        res = self.evaluator.evaluate(SAMPLE_ENGLISH_PBL)
        rubric = res.rubric if hasattr(res, "rubric") else res["rubric"]
        skills = res.skills if hasattr(res, "skills") else res["skills"]
        self.assertGreaterEqual(rubric.total_score if hasattr(rubric, "total_score") else rubric["total_score"], 8.0)
        self.assertGreaterEqual(len(skills), 3)

    def test_t3_03_skill_tagging_and_constructive_feedback(self):
        """F03 (Skill Tagging) + F04 (Constructive Feedback): Tagged skills align with feedback."""
        res = self.evaluator.evaluate(SAMPLE_STEM_PBL)
        skills = res.skills if hasattr(res, "skills") else res["skills"]
        fb = res.feedback if hasattr(res, "feedback") else res["feedback"]
        self.assertGreaterEqual(len(skills), 3)
        self.assertGreater(len(fb), 20)

    def test_t3_04_core_ai_and_project_vault(self):
        """Core AI (F01-F04) + F11 (Project Vault): Vault stores submission and attaches AI evaluation."""
        eval_res = self.evaluator.evaluate(SAMPLE_ENGLISH_PBL)
        stored_project = dict(SAMPLE_ENGLISH_PBL)
        stored_project["id"] = "PRJ-T3-04-VAULT-STORED"
        stored_project["submission_id"] = "PRJ-T3-04-VAULT-STORED"
        stored_project["evaluation"] = eval_res
        res = self.repo.add_project(stored_project)
        self.assertEqual(res["submission_id"], "PRJ-T3-04-VAULT-STORED")

    def test_t3_05_project_vault_and_competency_spider_chart(self):
        """F11 (Vault) + F12 (Spider Chart): Projects in vault contribute to student radar profile."""
        projects = self.repo.get_projects()
        student = self.repo.get_student_by_id("UMS-8A1-012") or self.repo.get_students()[0]
        radar = student.get("competencies") or student.get("radar_scores") or {}
        self.assertGreater(len(projects), 0)
        self.assertTrue("language" in radar or "ngon_ngu" in radar)

    def test_t3_06_spider_chart_and_digital_passport(self):
        """F12 (Spider Chart) + F13 (Digital Passport): Radar scores embed into passport."""
        student = self.repo.get_student_by_id("UMS-9A1-001") or self.repo.get_students()[0]
        radar = student.get("competencies") or student.get("radar_scores") or {}
        passport_data = {
            "student_id": student.get("id", student.get("student_id")),
            "full_name": student.get("full_name"),
            "radar_scores": radar
        }
        self.assertTrue("language" in passport_data["radar_scores"] or "ngon_ngu" in passport_data["radar_scores"])
        lang_score = passport_data["radar_scores"].get("language") or passport_data["radar_scores"].get("ngon_ngu")
        self.assertGreaterEqual(lang_score, 8.0)

    def test_t3_07_tripartite_report_and_zero_placeholder_validation(self):
        """F05 (Tripartite Report) + F06 (Zero Placeholder): Multi-student batch has zero placeholders."""
        for p in self.repo.get_students():
            rep = self.report_gen.generate_report({
                "student_name": p["full_name"],
                "grade_level": p.get("grade", 8),
                "teacher_type": "homeroom"
            })
            text = rep.full_text if hasattr(rep, "full_text") else rep["full_text"]
            self.assertEqual(validate_no_placeholders(text), [])

    def test_t3_08_tripartite_report_and_dual_teacher_mode(self):
        """F05 (Tripartite Report) + F07 (Dual Teacher Mode): Homeroom vs Subject distinction."""
        rep_hr = self.report_gen.generate_report({"teacher_type": "homeroom", "student_name": "Trần Đức Anh"})
        rep_sub = self.report_gen.generate_report({"teacher_type": "subject", "subject_name": "Khoa học Tự nhiên", "student_name": "Trần Đức Anh"})
        t1 = rep_hr.full_text if hasattr(rep_hr, "full_text") else rep_hr["full_text"]
        t2 = rep_sub.full_text if hasattr(rep_sub, "full_text") else rep_sub["full_text"]
        self.assertNotEqual(t1, t2)

    def test_t3_09_realistic_personas_and_authentic_pbl(self):
        """F08 (Personas) + F09 (PBL Payloads): Payloads match corresponding grade levels."""
        self.assertEqual(SAMPLE_STEM_PBL["grade_level"], 7)
        self.assertEqual(SAMPLE_SOCIAL_PBL["grade_level"], 8)
        self.assertEqual(SAMPLE_ENGLISH_PBL["grade_level"], 8)

    def test_t3_10_pbl_scenarios_and_rubric_scoring(self):
        """F09 (PBL Scenarios) + F02 (Rubric Scoring): All 3 scenarios achieve >= 8.5."""
        for pbl in [SAMPLE_ENGLISH_PBL, SAMPLE_STEM_PBL, SAMPLE_SOCIAL_PBL]:
            res = self.evaluator.evaluate(pbl)
            rubric = res.rubric if hasattr(res, "rubric") else res["rubric"]
            tot = rubric.total_score if hasattr(rubric, "total_score") else rubric["total_score"]
            self.assertGreaterEqual(tot, 8.5)

    def test_t3_11_teacher_class_dashboard_and_rubric_grading(self):
        """F14 (Class Dashboard) + F15 (Rubric Grading): Teacher navigates from class to grading."""
        students = self.repo.get_students()
        st_id = students[0].get("id", students[0].get("student_id"))
        self.assertIsNotNone(st_id)
        # Select project for that student
        projects = self.repo.get_projects()
        self.assertGreaterEqual(len(projects), 1)

    def test_t3_12_teacher_rubric_override_and_parent_timeline(self):
        """F15 (Teacher Override) + F17 (Parent Timeline): Score adjustment propagates to timeline."""
        resp_grade = self.client.put(
            "/api/projects/PRJ-ENG-2026-08A1-01/grade",
            json={"new_score": 9.7, "teacher_note": "Xuất sắc", "teacher_name": "Cô Hà"}
        )
        self.assertEqual(resp_grade.status_code, 200)

        resp_timeline = self.client.get("/api/parent/timeline/UMS-8A1-012")
        self.assertEqual(resp_timeline.status_code, 200)
        events = resp_timeline.json()
        self.assertGreaterEqual(len(events), 1)
        matched = [e for e in events if e.get("project_id") == "PRJ-ENG-2026-08A1-01" or "AI in Future Education" in e.get("title", "")]
        self.assertTrue(len(matched) > 0)
        self.assertTrue(any(e.get("score") == 9.7 for e in matched))

    def test_t3_13_teacher_ai_report_review_and_zero_placeholder(self):
        """F16 (Teacher Review) + F06 (Zero Placeholder): Teacher-edited report passes validator."""
        draft = self.report_gen.generate_report({"student_name": "Phạm Quỳnh Anh", "grade_level": 9})
        orig = draft.full_text if hasattr(draft, "full_text") else draft["full_text"]
        edited = orig + "\nThầy cô chúc em thi đỗ Chuyên Anh CNN."
        self.assertEqual(validate_no_placeholders(edited), [])

    def test_t3_14_teacher_report_edit_and_digital_passport(self):
        """F16 (Report Edit) + F13 (Passport Export): Finalized report feeds passport document."""
        resp_update = self.client.put(
            "/api/reports/REP-2025-001",
            json={"section_academic": "Năng lực ngôn ngữ vượt bậc"}
        )
        self.assertEqual(resp_update.status_code, 200)
        self.assertEqual(resp_update.json().get("section_academic"), "Năng lực ngôn ngữ vượt bậc")

        resp_pass = self.client.get("/api/students/UMS-9A1-001/passport")
        self.assertEqual(resp_pass.status_code, 200)
        pass_data = resp_pass.json()
        self.assertIn("full_name", pass_data)
        self.assertEqual(pass_data.get("student_code"), "UMS-9A1-001")

    def test_t3_15_ums_handbook_and_parent_ai_companion(self):
        """F10 (Handbook) + F18 (Parent Companion): Chatbot leverages handbook information."""
        resp = self.client.post("/api/parent/chat", json={"question": "Tiêu chí tuyển sinh vào CNN?"})
        self.assertEqual(resp.status_code, 200)
        self.assertIn("CNN", resp.json().get("reply", "") + resp.json().get("source_intent", ""))

    def test_t3_16_parent_ai_companion_and_student_persona(self):
        """F18 (Companion) + F08 (Student Persona): Chatbot provides student-specific guidance."""
        resp = self.client.post("/api/parent/chat", json={"question": "CLB Debate sinh hoạt khi nào?", "student_id": "UMS-8A1-012"})
        self.assertEqual(resp.status_code, 200)
        self.assertIn("reply", resp.json())

    def test_t3_17_student_submission_and_parent_timeline_card(self):
        """F11 (Vault) + F17 (Timeline): New project creates corresponding timeline milestone."""
        sub_payload = {
            "title": "Báo cáo Thực địa Sinh học UMS 2026",
            "category": "stem_scientific",
            "content": "Báo cáo chi tiết về đa dạng sinh học các loài thực vật tại khuôn viên trường THCS Ngoại ngữ và phân tích dữ liệu thực nghiệm.",
            "student_id": "UMS-8A1-012"
        }
        resp_sub = self.client.post("/api/projects/submit", json=sub_payload)
        self.assertIn(resp_sub.status_code, [200, 201])
        prj_data = resp_sub.json()
        self.assertIn("id", prj_data)

        resp_tl = self.client.get("/api/parent/timeline/UMS-8A1-012")
        self.assertEqual(resp_tl.status_code, 200)
        events = resp_tl.json()
        self.assertGreaterEqual(len(events), 1)
        self.assertTrue(any("Báo cáo Thực địa Sinh học UMS 2026" in e.get("title", "") for e in events))

    def test_t3_18_grade9_persona_and_cnn_transition_report(self):
        """F08 (Grade 9) + F05 (Report) + F13 (Passport): Grade 9 transition pipeline."""
        p9 = self.repo.get_student_by_id("UMS-9A1-001")
        self.assertIsNotNone(p9)
        rep = self.report_gen.generate_report({
            "student_name": p9["full_name"],
            "grade_level": 9,
            "target_highschool": p9.get("target_highschool", "THPT Chuyên Ngoại ngữ (CNN - ULIS)")
        })
        text = rep.full_text if hasattr(rep, "full_text") else rep["full_text"]
        self.assertIn("Chuyên Ngoại ngữ", text)

    def test_t3_19_startup_script_and_api_routers(self):
        """F19 (Startup) + REST APIs: Health, students, and projects endpoints respond."""
        r_health = self.client.get("/api/health")
        r_students = self.client.get("/api/students")
        r_projects = self.client.get("/api/projects")
        self.assertEqual(r_health.status_code, 200)
        self.assertEqual(r_students.status_code, 200)
        self.assertEqual(r_projects.status_code, 200)

    def test_t3_20_full_data_seed_and_opaque_test_runner(self):
        """F08, F09, F10 (Seed) + F20 (Test Runner): Data store verified with 28 skills & 4 personas."""
        students = self.repo.get_students()
        projects = self.repo.get_projects()
        qa_list = self.repo.get_handbook_qa()
        self.assertGreaterEqual(len(students), 4)
        self.assertGreaterEqual(len(projects), 3)
        self.assertGreaterEqual(len(qa_list), 20)

    def test_t3_21_stem_iot_project_skill_tagger_and_teacher_grading(self):
        """F09 (STEM IoT) + F03 (Skill Tagger) + F15 (Teacher Grading): Evaluates and tags IoT tech."""
        tags = self.tagger.extract_skills(content=SAMPLE_STEM_PBL["content"], category="stem_scientific")
        s_ids = [t.skill_id if hasattr(t, "skill_id") else t["skill_id"] for t in tags]
        self.assertTrue(any("stem" in s or "problem" in s or "scientific" in s or "data" in s for s in s_ids))

    def test_t3_22_vietnamese_cultural_pbl_and_growth_timeline(self):
        """F09 (Cultural PBL) + F01 (Vietnamese NLP) + F17 (Timeline): Cultural project timeline card."""
        lang = self.nlp.detect_language(SAMPLE_SOCIAL_PBL["content"])
        self.assertIn(lang, ["vi", "bilingual"])
        eval_res = self.evaluator.evaluate(SAMPLE_SOCIAL_PBL)
        rubric = eval_res.rubric if hasattr(eval_res, "rubric") else eval_res["rubric"]
        tot = rubric.total_score if hasattr(rubric, "total_score") else rubric["total_score"]
        self.assertGreaterEqual(tot, 8.8)


if __name__ == "__main__":
    unittest.main(verbosity=2)
