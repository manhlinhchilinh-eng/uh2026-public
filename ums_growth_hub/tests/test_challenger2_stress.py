"""
Adversarial Stress Verification Suite - Challenger 2:
Empirical challenge of Web Platform, REST APIs, Data Integrity, PDF Structure, Concurrency, and Single-Command Startup.
Dual-compatible with pytest and python -m unittest.
"""

import io
import os
import sys
import time
import socket
import random
import threading
import unittest
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, Any, List

# Ensure project root in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
import pypdf
import fitz

from app.main import app
from app.data.repository import DataRepository
from app.core.report_gen import validate_no_placeholders
import run


class TestChallenger2_EmpiricalStress(unittest.TestCase):
    """Adversarial stress and empirical verification suite."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        # Reset system state to clean seed data before each test
        self.client.post("/api/reset")
        self.repo = DataRepository.get_instance()

    # =========================================================================
    # CHALLENGE 1: END-TO-END MULTI-ROLE FLOW & DATA INTEGRITY
    # =========================================================================

    def test_challenge1_01_student_submission_data_integrity(self):
        """Verify student project submission persists intact without corruption."""
        payload = {
            "student_id": "usr_stu_003",
            "title": "Challenger E2E: Ứng dụng Trí tuệ Nhân tạo trong Giáo dục",
            "category": "english_presentation",
            "language": "en",
            "content": "This research project investigates how advanced natural language processing models can assist middle school students in mastering English pronunciation, syntax, and vocabulary retention. Through empirical trials with 120 peers at UMS, we measured lexical richness and fluency.",
            "reflection": "I realized the critical balance between automated feedback and teacher guidance.",
            "grade_level": 8
        }
        resp = self.client.post("/api/projects/submit", json=payload)
        self.assertEqual(resp.status_code, 201, f"Expected 201 Created, got {resp.status_code}")
        data = resp.json()
        prj_id = data.get("id")
        self.assertIsNotNone(prj_id)
        self.assertEqual(data.get("title"), payload["title"])
        self.assertEqual(data.get("content"), payload["content"])
        self.assertIn("rubric_evaluation", data)
        self.assertGreaterEqual(len(data["rubric_evaluation"].get("skills", [])), 3)

        # Retrieve from vault via API
        fetch_resp = self.client.get(f"/api/projects/{prj_id}")
        self.assertEqual(fetch_resp.status_code, 200)
        self.assertEqual(fetch_resp.json()["id"], prj_id)
        self.assertEqual(fetch_resp.json()["student_id"], "usr_stu_003")

    def test_challenge1_02_teacher_grade_and_report_edit_integrity(self):
        """Verify teacher grading and report inline editing persist without corruption."""
        # 1. Submit project
        sub_resp = self.client.post("/api/projects/submit", json={
            "student_id": "usr_stu_001",
            "title": "Capstone: Human-Centric AI",
            "category": "english_presentation",
            "content": "Research on AI ethics and human empathy across educational systems.",
            "grade_level": 9
        })
        prj_id = sub_resp.json()["id"]

        # 2. Teacher grades project
        grade_payload = {
            "criteria_scores": {
                "content_depth": 2.9,
                "language_expression": 2.5,
                "critical_innovation": 2.4,
                "collaboration_integrity": 2.0
            },
            "total_score": 9.8,
            "teacher_feedback": "Phạm Quỳnh Anh thể hiện xuất sắc tư duy học thuật và phong thái lãnh đạo!",
            "teacher_name": "Cô Đỗ Tuệ Uyên"
        }
        grade_resp = self.client.put(f"/api/projects/{prj_id}/grade", json=grade_payload)
        self.assertEqual(grade_resp.status_code, 200)
        self.assertEqual(grade_resp.json()["score"], 9.8)

        # 3. Teacher generates semester report
        rep_resp = self.client.post("/api/reports/generate", json={
            "student_id": "usr_stu_001",
            "teacher_type": "homeroom",
            "semester": "Học kỳ II"
        })
        self.assertEqual(rep_resp.status_code, 200)
        rep_id = rep_resp.json()["report_id"]

        # 4. Teacher personalizes report text
        custom_text = "Em Phạm Quỳnh Anh là học sinh gương mẫu, luôn dẫn đầu phong trào tranh biện và nghiên cứu khoa học tại UMS."
        edit_resp = self.client.put(f"/api/reports/{rep_id}", json={
            "academic_eval": custom_text,
            "teacher_signature": "Cô Đỗ Tuệ Uyên"
        })
        self.assertEqual(edit_resp.status_code, 200)

        # Verify edited report retrieved via GET contains customized text and zero placeholders
        get_rep = self.client.get(f"/api/reports/{rep_id}")
        self.assertEqual(get_rep.status_code, 200)
        self.assertIn("Phạm Quỳnh Anh là học sinh gương mẫu", get_rep.json()["section_academic"])
        violations = validate_no_placeholders(get_rep.json()["section_academic"])
        self.assertEqual(violations, [], f"Placeholders detected in report: {violations}")

    def test_challenge1_03_investigate_parent_timeline_and_score_sync_gap(self):
        """
        Adversarial probe: Test whether new student submission and teacher score calibrate
        propagate into Parent Timeline and Student Signature Projects.
        Documents data synchronization behavior.
        """
        # 1. Submit project
        resp = self.client.post("/api/projects/submit", json={
            "student_id": "usr_stu_003",
            "title": "Solar Energy Efficiency in UMS Building A2",
            "category": "stem_scientific",
            "content": "Detailed analysis of rooftop photovoltaic array power output over 90 days.",
            "reflection": "Learned practical IoT sensor data logging with Micro:bit.",
            "grade_level": 8
        })
        prj_id = resp.json()["id"]

        # 2. Teacher grades project to 9.9
        self.client.put(f"/api/projects/{prj_id}/grade", json={
            "total_score": 9.9,
            "teacher_feedback": "Thầy rất khen ngợi đề tài nghiên cứu thực tiễn này.",
            "teacher_name": "Thầy Trần Quốc Tuấn"
        })

        # 3. Check Parent Timeline
        tl_resp = self.client.get("/api/parent/timeline/usr_stu_003")
        self.assertEqual(tl_resp.status_code, 200)
        tl_items = tl_resp.json()

        # Check if project appears in timeline
        found_in_timeline = any(
            it.get("project_id") == prj_id or it.get("title") == "Solar Energy Efficiency in UMS Building A2"
            for it in tl_items
        )

        # Check if student's signature_projects score is synchronized with teacher's 9.9 score
        student_data = self.repo.get_student_by_id("usr_stu_003")
        sig_projects = [p for p in student_data.get("signature_projects", []) if p.get("id") == prj_id]
        score_in_profile = sig_projects[0].get("score") if sig_projects else "MISSING"

        # Record empirical observation:
        # Note: If found_in_timeline is False or score_in_profile != 9.9, this empirically proves
        # the synchronization gap between Project Vault, Student Profile, and Parent Timeline.
        print(f"\n[EMPIRICAL PROBE] New Project in Timeline: {found_in_timeline}")
        print(f"[EMPIRICAL PROBE] Score in Student Profile: {score_in_profile} (Teacher Graded: 9.9)")

    # =========================================================================
    # CHALLENGE 2: PDF BYTE & STRUCTURE VERIFICATION (ALL 4 PERSONAS)
    # =========================================================================

    def test_challenge2_pdf_all_four_personas_structure_and_magic_bytes(self):
        """
        Verify Student Digital Passport PDF generation for all 4 student personas.
        Checks %PDF magic bytes, %%EOF, valid PDF document structure, non-empty text, and page count.
        """
        student_ids = ["usr_stu_001", "usr_stu_002", "usr_stu_003", "usr_stu_004"]

        for sid in student_ids:
            resp = self.client.get(f"/api/students/{sid}/passport/pdf")
            self.assertEqual(resp.status_code, 200, f"Failed PDF export for {sid}")

            # 1. Headers verification
            content_type = resp.headers.get("content-type", "")
            self.assertIn("application/pdf", content_type)
            disposition = resp.headers.get("content-disposition", "")
            self.assertIn(".pdf", disposition)

            pdf_bytes = resp.content
            self.assertGreater(len(pdf_bytes), 10000, f"PDF byte payload suspiciously small: {len(pdf_bytes)}")

            # 2. Magic bytes verification
            self.assertTrue(pdf_bytes.startswith(b"%PDF-"), f"Missing %PDF- magic bytes for {sid}")
            self.assertTrue(b"%%EOF" in pdf_bytes[-1024:], f"Missing %%EOF trailer marker for {sid}")

            # 3. Structure verification with pypdf
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            self.assertGreaterEqual(len(reader.pages), 1, f"Expected at least 1 page for {sid}")
            self.assertEqual(len(reader.pages), 1, f"Expected printable single-page A4 layout for {sid}")

            # 4. Text extraction and content verification with PyMuPDF (fitz)
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            extracted_text = "".join(page.get_text() for page in doc)

            self.assertGreater(len(extracted_text), 1000, f"Extracted text too sparse in PDF for {sid}")
            self.assertIn("TRƯỜNG THCS NGOẠI NGỮ", extracted_text)
            self.assertIn("HỘ CHIẾU NĂNG LỰC SỐ HỌC SINH", extracted_text)
            self.assertIn("GDPT 2018", extracted_text)

    # =========================================================================
    # CHALLENGE 3: CONCURRENCY STRESS (100+ REQUESTS)
    # =========================================================================

    def test_challenge3_concurrency_blast_150_requests_zero_deadlocks(self):
        """
        Blast API with 150+ concurrent mixed requests (reads & writes) across all major endpoints.
        Verify zero race conditions, zero deadlocks, and zero 500 errors.
        """
        endpoints = [
            ("GET", "/api/health", None),
            ("GET", "/api/students", None),
            ("GET", "/api/students/usr_stu_001/radar", None),
            ("GET", "/api/students/usr_stu_002", None),
            ("GET", "/api/projects", None),
            ("GET", "/api/reports", None),
            ("POST", "/api/parent/chat", {"question": "Quy chế tuyển sinh THPT Chuyên Ngoại ngữ?", "student_id": "usr_stu_001"}),
            ("POST", "/api/parent/chat", {"question": "UMS có những câu lạc bộ nào?", "student_id": "usr_stu_003"}),
            ("POST", "/api/reports/generate", {"student_id": "usr_stu_002", "teacher_type": "homeroom"}),
            ("POST", "/api/projects/submit", {
                "student_id": "usr_stu_004",
                "title": "Concurrent Blast Stress Project",
                "category": "stem_scientific",
                "content": "Concurrent verification payload to test locking and repository thread safety.",
                "reflection": "High concurrency test.",
                "grade_level": 6
            })
        ]

        num_requests = 150
        max_workers = 25

        def worker_task(idx):
            method, path, body = random.choice(endpoints)
            t0 = time.time()
            try:
                if method == "GET":
                    r = self.client.get(path)
                else:
                    custom_body = dict(body)
                    if path == "/api/projects/submit":
                        custom_body["title"] = f"Concurrent Blast Stress Project {idx}"
                    r = self.client.post(path, json=custom_body)
                latency = time.time() - t0
                return (idx, path, r.status_code, latency, None)
            except Exception as exc:
                latency = time.time() - t0
                return (idx, path, 0, latency, str(exc))

        t_start = time.time()
        results = []
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [executor.submit(worker_task, i) for i in range(num_requests)]
            for f in as_completed(futures):
                results.append(f.result())
        t_total = time.time() - t_start

        errors = [r for r in results if r[2] >= 500 or r[4] is not None]
        status_codes = {}
        for r in results:
            status_codes[r[2]] = status_codes.get(r[2], 0) + 1

        # Assertions
        self.assertEqual(len(results), num_requests)
        self.assertEqual(len(errors), 0, f"Encountered errors during concurrent blast: {errors}")
        self.assertLess(t_total, 10.0, f"Concurrency test took too long: {t_total:.2f}s (potential deadlock)")
        for code in status_codes:
            self.assertIn(code, [200, 201], f"Unexpected status code {code} under stress")

    def test_challenge3_concurrent_project_submissions_unique_ids(self):
        """
        Stress test 50 concurrent project submissions.
        Verifies thread safety of ID generator and data repository.
        """
        initial_count = len(self.client.get("/api/projects").json())
        num_submissions = 50

        def submit_worker(i):
            r = self.client.post("/api/projects/submit", json={
                "student_id": f"usr_stu_{1 + (i % 4):03d}",
                "title": f"Concurrent Unique ID Test #{i}",
                "category": "stem_scientific",
                "content": f"Detailed experimental data content for concurrent submission {i} with sufficient words to pass evaluation.",
                "grade_level": 8
            })
            return r.status_code, r.json().get("id")

        with ThreadPoolExecutor(max_workers=20) as pool:
            results = list(pool.map(submit_worker, range(num_submissions)))

        statuses = [r[0] for r in results]
        created_ids = [r[1] for r in results]

        self.assertTrue(all(s == 201 for s in statuses), f"Some submissions failed: {statuses}")
        self.assertEqual(len(set(created_ids)), num_submissions, "Duplicate project IDs generated under concurrency!")

        final_count = len(self.client.get("/api/projects").json())
        self.assertEqual(final_count, initial_count + num_submissions)

    # =========================================================================
    # CHALLENGE 4: SINGLE-COMMAND STARTUP PROBE (RUN.PY)
    # =========================================================================

    def test_challenge4_01_port_availability_detection(self):
        """Verify run.py detects port boundaries and occupied ports correctly."""
        # Restricted port < 1024
        self.assertFalse(run.is_port_available("127.0.0.1", 80))
        self.assertFalse(run.is_port_available("127.0.0.1", 443))

        # Invalid port > 65535
        self.assertFalse(run.is_port_available("127.0.0.1", 70000))

        # Real socket occupation test
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            occupied_port = s.getsockname()[1]
            self.assertFalse(run.is_port_available("127.0.0.1", occupied_port))

            # Verify find_available_port skips the occupied port
            fallback_port = run.find_available_port("127.0.0.1", [occupied_port, 9876])
            self.assertNotEqual(fallback_port, occupied_port)
            self.assertEqual(fallback_port, 9876)

    def test_challenge4_02_healthcheck_timeout_on_closed_port(self):
        """Verify wait_for_healthcheck times out gracefully on closed port."""
        t0 = time.time()
        res = run.wait_for_healthcheck("http://127.0.0.1:54321/api/health", timeout_sec=0.6)
        elapsed = time.time() - t0
        self.assertFalse(res)
        self.assertGreaterEqual(elapsed, 0.5)

    def test_challenge4_03_live_server_boot_and_health_ping(self):
        """
        Validate single-command startup end-to-end:
        Spin up Uvicorn on an available port, execute health ping loop, verify HTTP 200, and shut down.
        """
        import uvicorn
        port = run.find_available_port("127.0.0.1", [8980, 8981, 8982])
        config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error")
        server = uvicorn.Server(config)

        server_thread = threading.Thread(target=server.run, daemon=True)
        server_thread.start()

        health_url = f"http://127.0.0.1:{port}/api/health"
        is_healthy = run.wait_for_healthcheck(health_url, timeout_sec=6.0)
        self.assertTrue(is_healthy, f"Server failed to become healthy at {health_url}")

        # Query health endpoint
        req = urllib.request.Request(health_url)
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            self.assertEqual(resp.status, 200)
            data = resp.read().decode("utf-8")
            self.assertIn("healthy", data)
            self.assertIn("ums_growth_hub", data)

        # Clean shutdown
        server.should_exit = True
        server_thread.join(timeout=3.0)


if __name__ == "__main__":
    unittest.main()
