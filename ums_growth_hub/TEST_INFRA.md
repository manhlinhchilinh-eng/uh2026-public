# E2E Test Infra: UMS Smart Growth Hub

## Test Philosophy
- Opaque-box, requirement-driven. Derived from `ORIGINAL_REQUEST.md` and user specifications, independent of internal implementation design.
- Methodology: Systematic 4-Tier Test Architecture:
  - **Tier 1**: Feature Coverage (Category-Partition Testing, >= 5 cases per feature across representative happy paths).
  - **Tier 2**: Boundary & Corner Cases (Boundary Value Analysis, extremes, invalid inputs, edge cases, >= 5 cases per feature).
  - **Tier 3**: Cross-Feature Combinations (Pairwise combinatorial testing of feature interactions).
  - **Tier 4**: Real-World Application Scenarios (End-to-end user workflows: Student submission -> Teacher evaluation -> Parent reflection).

## Feature Inventory & Test Target Matrix (20 Features, Minimum 230 Test Cases)

| # | Feature | Requirement Source | Tier 1 (Min 5) | Tier 2 (Min 5) | Tier 3 (Pairwise) | Tier 4 (Workflow) |
|---|---------|-------------------|:--------------:|:--------------:|:-----------------:|:-----------------:|
| F01 | Bilingual Ingestion | R1, Line 12 | 5 | 5 | ✓ | ✓ |
| F02 | GDPT 2018 Rubric Engine (10-pt) | R1, Line 13 | 5 | 5 | ✓ | ✓ |
| F03 | Skill Tagging Engine (>=3 skills) | R1, Line 13 | 5 | 5 | ✓ | ✓ |
| F04 | Constructive Feedback Generator | R1, Line 14 | 5 | 5 | ✓ | ✓ |
| F05 | Tripartite Semester Report | R2, Line 16 | 5 | 5 | ✓ | ✓ |
| F06 | Zero-Placeholder Validation | R2 & AC, Line 35 | 5 | 5 | ✓ | ✓ |
| F07 | Dual Teacher Mode (GVCN & GVBM) | R2, Line 16 | 5 | 5 | ✓ | ✓ |
| F08 | Realistic UMS Personas (Gr 6-9) | R4, Line 24 | 5 | 5 | ✓ | ✓ |
| F09 | Authentic PBL Scenarios (3 types) | R4 & AC, Line 31 | 5 | 5 | ✓ | ✓ |
| F10 | UMS Handbook Knowledge Base | R3 & R4, Line 22 | 5 | 5 | ✓ | ✓ |
| F11 | Student Project Vault & Upload | R3, Line 20 | 5 | 5 | ✓ | ✓ |
| F12 | Competency Spider Chart (GDPT 2018) | R3, Line 20 | 5 | 5 | ✓ | ✓ |
| F13 | Digital Passport & PDF Export | R3, Line 20 | 5 | 5 | ✓ | ✓ |
| F14 | Teacher Class Management Dashboard | R3, Line 21 | 5 | 5 | ✓ | ✓ |
| F15 | Teacher Rubric Grading Workspace | R3, Line 21 | 5 | 5 | ✓ | ✓ |
| F16 | Teacher AI Report Review & Edit | R3, Line 21 | 5 | 5 | ✓ | ✓ |
| F17 | Parent Growth Timeline Cards | R3, Line 22 | 5 | 5 | ✓ | ✓ |
| F18 | Parent 24/7 AI Companion Chatbot | R3, Line 22 | 5 | 5 | ✓ | ✓ |
| F19 | Single-Command Startup Script | AC, Line 38 | 5 | 5 | ✓ | ✓ |
| F20 | Opaque-Box E2E Test Suite & CLI | AC, Line 45 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test Framework: `pytest` and `python -m unittest` dual-compatible test suite.
- Test Location: `ums_growth_hub/tests/`
- Invocation Command: `pytest -v tests/` or `python tests/test_runner.py`
- Pass/Fail Semantics: 100% tests must pass with exit code 0. Zero tolerance for unhandled exceptions or failed assertions.
- Test Directory Layout:
  - `tests/conftest.py`: Shared fixtures (sample payloads, mock clients, test clients).
  - `tests/test_tier1_features.py`: >= 100 feature coverage tests.
  - `tests/test_tier2_boundaries.py`: >= 100 boundary & error handling tests.
  - `tests/test_tier3_pairwise.py`: >= 20 cross-feature interaction tests.
  - `tests/test_tier4_workloads.py`: >= 10 end-to-end application scenario tests.
  - `tests/test_runner.py`: Standalone CLI runner reporting tier-by-tier execution status.

## Real-World Application Scenarios (Tier 4)
1. **Scenario S01**: Grade 8 student submits English presentation on "AI in Future Education" -> Core AI evaluates (8.8/10, 4 skills tagged) -> Radar chart updates -> Teacher reviews and finalizes -> Parent views on Growth Timeline.
2. **Scenario S02**: Grade 7 student submits STEM Micro:bit Hydroponics lab report -> Core AI evaluates (9.2/10, 5 skills tagged) -> Competency passport incorporates scientific data -> Teacher generates Semester Report.
3. **Scenario S03**: Grade 8 student submits Social/Folklore project "Bảo tồn nghệ thuật Chèo & Tranh Đông Hồ" -> Core AI evaluates (9.0/10) -> Digital passport displays cultural badge.
4. **Scenario S04**: Grade 6 student new to UMS submits first bilingual project -> Core AI provides nurturing constructive feedback -> Spider chart establishes baseline competency profile.
5. **Scenario S05**: Grade 9 student preparing for THPT Chuyên Ngoại ngữ (CNN) entrance -> System generates high school transition recommendation & exports printable Digital Passport PDF.
6. **Scenario S06**: Teacher edits AI-suggested semester comment to personalize further -> System validates zero placeholders and saves updated evaluation.
7. **Scenario S07**: Parent inquires with 24/7 AI Companion regarding UMS extracurricular clubs & CNN transition criteria -> Chatbot returns accurate policy guidance.
8. **Scenario S08**: End-to-end cold start of `run.py` -> Server boots on free port -> Health check endpoint returns status 200 -> Static frontend served.

## Coverage Thresholds
- Tier 1: ≥ 100 tests (≥ 5 per feature across 20 features)
- Tier 2: ≥ 100 tests (≥ 5 boundary/corner cases per feature)
- Tier 3: ≥ 20 tests (major pairwise interactions)
- Tier 4: ≥ 10 realistic workload scenarios
- Total Target: ≥ 230 automated test assertions
