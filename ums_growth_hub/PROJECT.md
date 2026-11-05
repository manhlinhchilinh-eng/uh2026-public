# Project: UMS Smart Growth Hub

## Architecture
UMS Smart Growth Hub is architected as a high-performance, zero-configuration Python application combining a Modular FastAPI Backend with an embedded offline Core AI Engine, serving a modern, responsive Single-Page Web Platform (Student, Teacher, Parent) and automated PDF export.

```
+-----------------------------------------------------------------------------------+
|                        CLIENT BROWSER (PORT 8000)                                 |
|  - Modern Glassmorphic SPA (UMS Navy #0A2540 & Gold #D4AF37)                      |
|  - Role Switcher: [Student View] [Teacher View] [Parent View]                     |
|  - Interactive Chart.js Competency Radar & Visual Growth Timeline                 |
|  - Digital Competency Passport / Print & PDF Export for CNN (ULIS)                |
+------------------------------------------+----------------------------------------+
                                           | HTTP / REST API
                                           v
+-----------------------------------------------------------------------------------+
|                     FASTAPI APPLICATION SERVER (PORT 8000)                        |
|                                                                                   |
|  [Static Files / Frontend Mount]        [API Router: /api/v1]                     |
|  - index.html, styles.css, app.js       - /ai (evaluate, extract-skills)          |
|                                         - /reports (generate, preview, pdf)       |
|                                         - /students (profiles, radar-data)        |
|                                         - /projects (vault, submit, review)       |
|                                         - /parent (timeline, chatbot)             |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |             CORE AI COMPETENCY & EVALUATION ENGINE (100% OFFLINE)           |  |
|  |  +---------------------+ +----------------------+ +----------------------+  |  |
|  |  | Bilingual NLP       | | Rubric Evaluator     | | Skill Tagger         |  |  |
|  |  | - Lexical/TTR/Vocab | | - GDPT 2018 (0-10)   | | - 28-Skill Taxonomy  |  |  |
|  |  | - VI/EN Tokenizer   | | - 4 Core Criteria    | | - Confidence >=0.65  |  |  |
|  |  +---------------------+ +----------------------+ +----------------------+  |  |
|  |  +---------------------+ +----------------------+ +----------------------+  |  |
|  |  | Report Synthesizer  | | School-Home Chatbot  | | Digital Passport PDF |  |  |
|  |  | - 3-Part Feedback   | | - 20 UMS Handbook QA | | - ReportLab Builder  |  |  |
|  |  | - Zero Placeholders | | - Keyword & Semantic | | - Print-Ready Layout |  |  |
|  |  +---------------------+ +----------------------+ +----------------------+  |  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                  DATA REPOSITORY & PERSISTENCE LAYER                        |  |
|  |  - In-Memory State Store with persistent JSON seed storage                   |  |
|  |  - 4 Student Personas (Grades 6-9), 3 Deep-dive PBL Payloads, 4 Edge Cases |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

## Feature Inventory
Every feature from the Survey phase is enumerated here with its assigned milestone:

| # | Feature | Description | Milestone | Status |
|---|---------|-------------|-----------|--------|
| F01 | Bilingual Ingestion | Process project text, reflections, and metadata in English & Vietnamese | M1 | DONE |
| F02 | GDPT 2018 Rubric Engine | 10-point scale across 4 criteria (Content 3.0, Language 2.5, Thinking 2.5, Collaboration 2.0) | M1 | DONE |
| F03 | Skill Tagging Engine | Tag >= 3 skills from 28-skill taxonomy with confidence >=0.65 & evidence | M1 | DONE |
| F04 | Constructive Feedback | Produce personalized, actionable recommendations for student growth | M1 | DONE |
| F05 | Tripartite Report Generator | 3 parts: Chuyên môn/ngoại ngữ, Phẩm chất/kỹ năng mềm, Định hướng CNN/ULIS | M2 | DONE |
| F06 | Zero-Placeholder Validation | Strict regex validator preventing any raw placeholders (`[Tên]`, `undefined`) | M2 | DONE |
| F07 | Dual Teacher Mode | Support tailored comments for Homeroom Teacher (GVCN) and Subject Teacher (GVBM) | M2 | DONE |
| F08 | Realistic UMS Personas | 4 student personas (Grades 6-9) reflecting clubs, foreign languages, and CNN goals | M3 | DONE |
| F09 | Authentic PBL Scenarios | 3 deep-dive payloads (English AI, STEM IoT, Folk Culture) + 4 boundary cases | M3 | DONE |
| F10 | UMS Handbook Knowledge Base | 20 official Q&A pairs covering admissions, regulations, clubs, curriculum | M3 | DONE |
| F11 | Student Project Vault | Project submission UI with category tags, file/link upload, live status | M4 | DONE |
| F12 | Competency Spider Chart | Interactive Chart.js radar chart mapping 10-15 GDPT 2018 competency scores | M4 | DONE |
| F13 | Digital Passport & PDF Export | Student Digital Passport with printable layout & ReportLab PDF download | M4 | DONE |
| F14 | Teacher Class Management | Class dashboard with grade distribution, competency heatmaps, at-risk flags | M4 | DONE |
| F15 | Teacher Rubric Grading | Interactive split-screen rubric grading with score adjustments | M4 | DONE |
| F16 | Teacher AI Report Review | AI comment generator with real-time inline editing and saving | M4 | DONE |
| F17 | Parent Growth Timeline | Visual milestone timeline showing student project cards and achievements | M4 | DONE |
| F18 | Parent 24/7 AI Companion | Interactive chatbot answering school regulations, club schedules, CNN transition | M4 | DONE |
| F19 | Single-Command Startup | Fast zero-config launcher (`run.py` & `start.bat`) with automatic port resolution | M4 | DONE |
| F20 | Opaque-Box E2E Test Suite | Automated test suite across Tiers 1-5 with 265 test assertions | E2E/M5 | DONE |

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Test harness, test runners, Tier 1-4 test suites, TEST_READY.md | none | DONE |
| M1 | Core AI Competency & Rubric Engine | `app/core/evaluator.py`, `nlp_engine.py`, `skill_tagger.py`, Pydantic models | none | DONE |
| M2 | AI Automated Student Report Generator | `app/core/report_gen.py`, zero-placeholder validator, CNN/ULIS orientation | M1 | DONE |
| M3 | Realistic UMS Sample Dataset & Scenarios | `app/data/seed_data.py`, 4 personas (Grades 6-9), 3 PBL payloads, 20 Handbook Q&A | none | DONE |
| M4 | Interactive Multi-Role Web Platform & APIs | `app/main.py`, routers, `static/` modern UI (Student, Teacher, Parent), PDF export, `run.py` | M1, M2, M3 | DONE |
| M5 | Final Milestone: 100% E2E Pass, Hardening & Audit | 265/265 tests passing, Tier 5 Adversarial tests passing, Forensic Audit CLEAN | E2E, M1-M4 | DONE |

## Code Layout
```
ums_growth_hub/
├── run.py                       # Single-command startup launcher & port resolver
├── start.bat                    # Windows batch launcher
├── requirements.txt             # Clean minimal dependencies
├── README.md                    # Comprehensive quickstart & 24h-90d solution narrative
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI application entry point
│   ├── config.py                # App configuration & paths
│   ├── core/                    # Core AI Engine (100% Offline)
│   │   ├── __init__.py
│   │   ├── nlp_engine.py        # Tokenizer, lexical density, language detection
│   │   ├── evaluator.py         # 4-criterion GDPT 2018 rubric scoring (0-10)
│   │   ├── skill_tagger.py      # 28-skill taxonomy extractor (>= 3 skills)
│   │   ├── report_gen.py        # 3-part semester report synthesizer
│   │   ├── chatbot.py           # 24/7 School-Home AI companion FAQ matcher
│   │   └── pdf_builder.py       # ReportLab PDF generator for Digital Passport
│   ├── models/                  # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── rubric.py
│   │   ├── student.py
│   │   ├── report.py
│   │   └── project.py
│   ├── api/                     # REST API routers
│   │   ├── __init__.py
│   │   ├── ai_routes.py
│   │   ├── report_routes.py
│   │   ├── student_routes.py
│   │   ├── project_routes.py
│   │   └── parent_routes.py
│   ├── data/                    # Authentic UMS Sample Dataset
│   │   ├── __init__.py
│   │   ├── seed_data.py         # 4 personas, 3 PBL fixtures, 20 Handbook Q&A
│   │   └── repository.py        # In-memory store with JSON persistence
│   └── static/                  # Responsive Multi-Role Web Platform
│       ├── index.html           # Single Page Application
│       ├── css/
│       │   └── styles.css       # Modern glassmorphism UI (UMS Navy & Gold)
│       └── js/
│           └── app.js           # Multi-role navigation, Chart.js radar, API calls
└── tests/                       # Opaque-box E2E, Unit & Adversarial Test Suites
    ├── __init__.py
    ├── conftest.py
    ├── test_tier1_features.py   # Feature coverage (100 tests)
    ├── test_tier2_boundaries.py # Boundary & corner cases (100 tests)
    ├── test_tier3_pairwise.py   # Cross-feature interactions (22 tests)
    ├── test_tier4_workloads.py  # Realistic application scenarios (10 tests)
    ├── test_tier5_adversarial_challenger1.py # Adversarial stress tests (24 tests)
    ├── test_challenger2_stress.py # API & Data synchronization stress (9 tests)
    └── test_runner.py           # Independent standalone test runner
```
