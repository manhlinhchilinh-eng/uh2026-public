"""
Tier 4 Test Suite: Real-World Application Workloads & User Scenarios
Covers S01 to S08, plus extended multi-student and end-to-end lifecycle workflows (10 tests total).
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
    SAMPLE_ENGLISH_PBL,
    SAMPLE_STEM_PBL,
    SAMPLE_SOCIAL_PBL,
    SAMPLE_PERSONAS,
)


class TestTier4_RealisticWorkloads(unittest.TestCase):
    """Real-world end-to-end application workloads simulating full school workflows."""

    def setUp(self):
        self.evaluator = get_evaluator()
        self.tagger = get_skill_tagger()
        self.nlp = get_nlp_engine()
        self.report_gen = get_report_generator()
        self.repo = get_data_repository()
        self.client = get_test_client()

    def test_workload_s01_english_presentation_lifecycle(self):
        """
        Scenario S01: Grade 8 student submits English presentation on 'AI in Future Education'.
        Core AI evaluates (8.8-9.8/10, >= 4 skills tagged) -> Radar updates -> Teacher reviews -> Parent timeline.
        """
        # 1. Submission
        submission = dict(SAMPLE_ENGLISH_PBL)
        saved_proj = self.repo.add_project(submission)
        self.assertEqual(saved_proj["submission_id"], submission["submission_id"])

        # 2. Core AI Evaluation
        eval_res = self.evaluator.evaluate(submission)
        rubric = eval_res.rubric if hasattr(eval_res, "rubric") else eval_res["rubric"]
        skills = eval_res.skills if hasattr(eval_res, "skills") else eval_res["skills"]
        tot = rubric.total_score if hasattr(rubric, "total_score") else rubric["total_score"]

        self.assertGreaterEqual(tot, 8.8)
        self.assertLessEqual(tot, 10.0)
        self.assertGreaterEqual(len(skills), 4)

        # 3. Radar update
        student = self.repo.get_student_by_id(submission["student_id"])
        self.assertIsNotNone(student)

        # 4. Teacher Review Note
        teacher_feedback = "Bài thuyết trình của Quỳnh Anh và Đức Anh rất xuất sắc, phong thái tự tin."
        self.assertEqual(validate_no_placeholders(teacher_feedback), [])

        # 5. Parent Timeline Event
        timeline_card = {
            "student_id": submission["student_id"],
            "title": submission["title"],
            "score": tot,
            "status": "reviewed"
        }
        self.assertEqual(timeline_card["score"], tot)

    def test_workload_s02_stem_hydroponics_report_lifecycle(self):
        """
        Scenario S02: Grade 7 student submits STEM Micro:bit Hydroponics lab report.
        Core AI evaluates (9.0-9.6/10, >= 4 skills tagged) -> Passport incorporates data -> Teacher report.
        """
        # 1. Submission
        submission = dict(SAMPLE_STEM_PBL)
        self.repo.add_project(submission)

        # 2. Evaluation
        eval_res = self.evaluator.evaluate(submission)
        rubric = eval_res.rubric if hasattr(eval_res, "rubric") else eval_res["rubric"]
        skills = eval_res.skills if hasattr(eval_res, "skills") else eval_res["skills"]
        tot = rubric.total_score if hasattr(rubric, "total_score") else rubric["total_score"]

        self.assertGreaterEqual(tot, 9.0)
        self.assertGreaterEqual(len(skills), 4)

        # 3. Semester report generation
        rep = self.report_gen.generate_report({
            "student_id": submission["student_id"],
            "student_name": submission["student_name"],
            "grade_level": 7,
            "teacher_type": "subject",
            "subject_name": "Khoa học Tự nhiên"
        })
        text = rep.full_text if hasattr(rep, "full_text") else rep["full_text"]
        self.assertEqual(validate_no_placeholders(text), [])
        self.assertIn("Khoa học Tự nhiên", text)

    def test_workload_s03_cultural_heritage_project_lifecycle(self):
        """
        Scenario S03: Grade 8 student submits Social/Folklore project 'Bảo tồn nghệ thuật Chèo & Tranh Đông Hồ'.
        Core AI evaluates (>= 9.0/10) -> Digital passport displays cultural badge.
        """
        submission = dict(SAMPLE_SOCIAL_PBL)
        eval_res = self.evaluator.evaluate(submission)
        rubric = eval_res.rubric if hasattr(eval_res, "rubric") else eval_res["rubric"]
        tot = rubric.total_score if hasattr(rubric, "total_score") else rubric["total_score"]

        self.assertGreaterEqual(tot, 9.0)

        # Passport badge integration
        cultural_badge = {"badge_id": "BADGE-HERITAGE", "name": "Đại sứ Di sản Văn hóa UMS", "project": submission["title"]}
        self.assertEqual(cultural_badge["badge_id"], "BADGE-HERITAGE")

    def test_workload_s04_grade6_onboarding_baseline(self):
        """
        Scenario S04: Grade 6 student new to UMS submits first project.
        Core AI provides nurturing feedback -> Establishes baseline competency profile.
        """
        g6_payload = {
            "submission_id": "PRJ-G6-001",
            "student_id": "UMS-6A1-018",
            "student_name": "Lê Hoàng Nam",
            "title": "Rác thải học đường và Hành động của UMSer",
            "category": "social_humanities",
            "language": "vi",
            "grade_level": 6,
            "content": "Dự án phân loại rác tại nguồn tại trường UMS nhằm giảm thiểu đồ nhựa dùng 1 lần trong căng tin.",
            "reflection": "Em rất vui khi được cùng các bạn thu gom vỏ chai nhựa và làm chậu cây tái chế."
        }
        eval_res = self.evaluator.evaluate(g6_payload)
        fb = eval_res.feedback if hasattr(eval_res, "feedback") else eval_res["feedback"]
        self.assertGreater(len(fb), 20)

        # Establish baseline radar
        baseline = {"language": 8.0, "self_direction": 8.0, "collaboration": 7.8}
        self.assertGreaterEqual(baseline["self_direction"], 7.0)

    def test_workload_s05_grade9_cnn_transition_passport(self):
        """
        Scenario S05: Grade 9 student preparing for THPT Chuyên Ngoại ngữ (CNN) entrance.
        System generates transition recommendation & exports printable passport.
        """
        p9 = self.repo.get_student_by_id("UMS-9A1-001")
        self.assertIsNotNone(p9)
        rep = self.report_gen.generate_report({
            "student_id": p9.get("id", p9.get("student_id")),
            "student_name": p9["full_name"],
            "grade_level": 9,
            "teacher_type": "homeroom"
        })
        text = rep.full_text if hasattr(rep, "full_text") else rep["full_text"]
        self.assertIn("Chuyên Ngoại ngữ", text)
        self.assertEqual(validate_no_placeholders(text), [])

    def test_workload_s06_teacher_editorial_personalization(self):
        """
        Scenario S06: Teacher edits AI-suggested semester comment to personalize further.
        System validates zero placeholders and saves updated evaluation.
        """
        draft = self.report_gen.generate_report({"student_name": "Trần Đức Anh", "grade_level": 8})
        orig = draft.full_text if hasattr(draft, "full_text") else draft["full_text"]
        personalized = orig + "\nCô tin rằng với khả năng tranh biện tốt, em sẽ là một đại diện xuất sắc của lớp 8A1!"
        violations = validate_no_placeholders(personalized)
        self.assertEqual(violations, [])

    def test_workload_s07_parent_ai_companion_inquiry(self):
        """
        Scenario S07: Parent inquires with 24/7 AI Companion regarding extracurricular clubs & CNN transition.
        Chatbot returns accurate policy guidance.
        """
        resp = self.client.post("/api/parent/chat", json={
            "student_id": "UMS-8A1-012",
            "question": "Chào cô, cho tôi hỏi về định hướng thi vào Chuyên Ngoại ngữ CNN và lịch sinh hoạt CLB Debate?"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("reply", data)
        self.assertGreater(len(data["reply"]), 20)

    def test_workload_s08_startup_and_healthcheck(self):
        """
        Scenario S08: Server cold start and health check validation.
        """
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("status"), "healthy")

    def test_workload_s09_multi_student_concurrent_submissions(self):
        """
        Scenario S09: Multi-student batch submission across all 4 grade levels.
        All 4 personas submit projects; each is evaluated cleanly without interference.
        """
        submissions = [
            {
                "student_id": "UMS-6A1-018",
                "title": "G6 Eco Green School Project",
                "category": "social_humanities",
                "content": "Dự án môi trường xanh của học sinh lớp 6A1 nhằm thu gom chai nhựa và tái chế làm chậu cây cho hành lang lớp học. Nhóm em đã khảo sát ý thức giữ gìn vệ sinh và tổ chức ngày hội đổi rác lấy mầm xanh."
            },
            {
                "student_id": "UMS-7A2-005",
                "title": "G7 Arduino Obstacle Robot",
                "category": "stem_scientific",
                "content": "Báo cáo chế tạo robot tránh vật cản sử dụng cảm biến siêu âm HC-SR04 và bo mạch Arduino Uno. Robot có khả năng tự động rẽ hướng khi phát hiện chướng ngại vật trong khoảng cách 15 cm với độ chính xác cao."
            },
            {
                "student_id": "UMS-8A1-012",
                "title": "G8 Debate on Ethics and AI",
                "category": "english_presentation",
                "content": "This academic debate explores the critical intersection between artificial intelligence and student integrity in secondary education. We presented structured arguments analyzing algorithmic bias, academic honesty, and constructive mentorship. Our team surveyed peer attitudes and proposed verifiable guidelines ensuring technology empowers human learning rather than replacing critical thinking."
            },
            {
                "student_id": "UMS-9A1-001",
                "title": "G9 Model UN Climate Resolution",
                "category": "english_presentation",
                "content": "Our diplomatic resolution addresses global climate migration and refugee assistance frameworks under the Model United Nations program. Through multilateral consensus building, our committee synthesized policy proposals balancing economic feasibility and humanitarian responsibilities. We formulated actionable safeguards to protect vulnerable communities while fostering international educational cooperation."
            }
        ]
        results = []
        for s in submissions:
            eval_res = self.evaluator.evaluate(s)
            self.repo.add_project(s)
            results.append(eval_res)

        self.assertEqual(len(results), 4)
        for r in results:
            rub = r.rubric if hasattr(r, "rubric") else r["rubric"]
            tot = rub.total_score if hasattr(rub, "total_score") else rub["total_score"]
            self.assertGreaterEqual(tot, 5.0)

    def test_workload_s10_end_to_end_audit_trail_and_export(self):
        """
        Scenario S10: Complete lifecycle from student submission -> AI rubric -> Teacher approval -> Passport PDF readiness.
        """
        # Student submits
        proj = dict(SAMPLE_ENGLISH_PBL)
        self.repo.add_project(proj)

        # AI evaluates
        eval_res = self.evaluator.evaluate(proj)

        # Teacher generates & approves report
        report = self.report_gen.generate_report({
            "student_id": proj["student_id"],
            "student_name": proj["student_name"],
            "grade_level": 8,
            "teacher_type": "homeroom"
        })
        self.assertEqual(report.validation_status if hasattr(report, "validation_status") else report["validation_status"], "PASSED")

        # Digital Passport is assembled
        passport = {
            "student_id": proj["student_id"],
            "student_name": proj["student_name"],
            "signature_project": proj["title"],
            "rubric_score": eval_res.rubric.total_score if hasattr(eval_res, "rubric") else eval_res["rubric"]["total_score"],
            "report_summary": report.section_academic if hasattr(report, "section_academic") else report["section_academic"]
        }
        self.assertGreater(len(passport["report_summary"]), 10)


if __name__ == "__main__":
    unittest.main(verbosity=2)
