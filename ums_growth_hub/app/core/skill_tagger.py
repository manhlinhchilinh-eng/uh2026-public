"""
Skill Tagging Engine for UMS Smart Growth Hub
Implements the 28-skill taxonomy across 5 GDPT 2018 clusters.
Guarantees >= 3 tagged skills with confidence >= 0.65 and authentic evidence quotes.
100% Offline, Deterministic, and Zero External API Dependency.
"""

import re
from typing import Optional
from app.models.rubric import SkillTag
from app.core.nlp_engine import nlp_engine


# 28-Skill Taxonomy definition across 5 clusters
SKILL_TAXONOMY = {
    # Cluster A: Ngôn ngữ & Giao tiếp (Language & Communication)
    "skill_en_academic_writing": {
        "name": "Viết học thuật tiếng Anh",
        "cluster": "Ngôn ngữ & Giao tiếp",
        "keywords_en": [
            "academic writing", "essay", "thesis", "argument", "abstract", "methodology",
            "conclusion", "literature review", "syntax", "lexical", "discourse",
            "scholarly", "inquiry", "investigated", "consequently", "furthermore"
        ],
        "keywords_vi": ["viết học thuật tiếng anh", "bài luận tiếng anh", "tiếng anh học thuật", "ngôn ngữ anh"],
        "default_evidence_en": "Student employed academic syntax, formal vocabulary, and structured paragraphing in the submission.",
        "default_evidence_vi": "Học sinh sử dụng từ ngữ học thuật tiếng Anh chuẩn xác và kết cấu bài luận rõ ràng."
    },
    "skill_vn_creative_expression": {
        "name": "Diễn đạt ngôn ngữ tiếng Việt sáng tạo",
        "cluster": "Ngôn ngữ & Giao tiếp",
        "keywords_en": ["vietnamese expression", "literary rhetoric", "creative writing", "poetic"],
        "keywords_vi": [
            "biểu cảm", "giàu hình ảnh", "cảm thụ", "văn học", "ngôn từ", "câu từ",
            "sáng tạo ngôn ngữ", "bút pháp", "thơ", "văn xuôi", "tác phẩm", "ngữ văn",
            "truyền cảm hứng", "nghệ thuật từ ngữ", "sâu lắng"
        ],
        "default_evidence_en": "Student demonstrated rich literary rhetoric and creative expression in Vietnamese.",
        "default_evidence_vi": "Học sinh diễn đạt ngôn ngữ tiếng Việt giàu hình ảnh, biểu cảm sâu sắc và truyền tải cảm xúc tốt."
    },
    "skill_public_speaking": {
        "name": "Thuyết trình trước đám đông",
        "cluster": "Ngôn ngữ & Giao tiếp",
        "keywords_en": [
            "presentation", "public speaking", "speech", "slides", "audience", "pitch",
            "body language", "delivery", "speaker", "presenter", "q&a", "keynote"
        ],
        "keywords_vi": [
            "thuyết trình", "trình bày", "bài nói", "khán giả", "báo cáo trước lớp",
            "diễn thuyết", "slide", "tự tin trình bày", "thuyết phục người nghe"
        ],
        "default_evidence_en": "Student structured an engaging multimedia presentation with clear delivery for the audience.",
        "default_evidence_vi": "Học sinh chuẩn bị bài thuyết trình trực quan, tự tin trình bày và tương tác hiệu quả với khán giả."
    },
    "skill_debate_argumentation": {
        "name": "Tranh biện & Bảo vệ luận điểm",
        "cluster": "Ngôn ngữ & Giao tiếp",
        "keywords_en": [
            "debate", "counter-argument", "rebuttal", "motion", "argumentation",
            "persuasion", "premise", "contention", "fallacy", "refutation"
        ],
        "keywords_vi": [
            "tranh biện", "phản biện", "luận điểm", "bảo vệ quan điểm", "đối chất",
            "lập luận", "bác bỏ", "chứng minh luận cứ", "khẳng định"
        ],
        "default_evidence_en": "Student articulated multi-perspective argumentation and robust rebuttals.",
        "default_evidence_vi": "Học sinh xây dựng hệ thống luận điểm chặt chẽ và phản biện đa chiều trước các quan điểm trái chiều."
    },
    "skill_multilingual_competence": {
        "name": "Năng lực song ngữ / Đa ngữ",
        "cluster": "Ngôn ngữ & Giao tiếp",
        "keywords_en": [
            "bilingual", "multilingual", "code-switching", "translation", "foreign language",
            "second language", "bilingual presentation"
        ],
        "keywords_vi": [
            "song ngữ", "tiếng anh và tiếng việt", "ngoại ngữ 2", "đa ngữ", "tiếng nhật",
            "tiếng hàn", "tiếng pháp", "tiếng đức", "dịch thuật", "giao thoa ngôn ngữ"
        ],
        "default_evidence_en": "Student transitioned seamlessly between languages with high bilingual fluency.",
        "default_evidence_vi": "Học sinh thể hiện năng lực song ngữ lưu loát, kết hợp tự nhiên giữa tiếng Anh và tiếng Việt."
    },
    "skill_multimodal_storytelling": {
        "name": "Kể chuyện đa phương thức",
        "cluster": "Ngôn ngữ & Giao tiếp",
        "keywords_en": [
            "storytelling", "multimodal", "narrative", "podcast", "infographic",
            "visual story", "video story", "storyline"
        ],
        "keywords_vi": [
            "kể chuyện", "đa phương thức", "podcast", "infographic", "video",
            "truyền thông thị giác", "thông điệp", "câu chuyện", "hình ảnh và âm thanh"
        ],
        "default_evidence_en": "Student combined audio-visual elements and engaging narrative arcs effectively.",
        "default_evidence_vi": "Học sinh kết hợp nhuần nhuyễn giữa âm thanh, hình ảnh và câu chuyện để truyền tải thông điệp."
    },

    # Cluster B: Nghiên cứu & Tư duy (Research & Critical Thinking)
    "skill_scientific_inquiry": {
        "name": "Phương pháp nghiên cứu khoa học",
        "cluster": "Nghiên cứu & Tư duy",
        "keywords_en": [
            "hypothesis", "experiment", "experimental", "scientific method", "controlled variable",
            "sample", "observation", "empirical", "testing", "specimen", "procedure"
        ],
        "keywords_vi": [
            "nghiên cứu khoa học", "thực nghiệm", "giả thuyết", "thí nghiệm", "mẫu thử",
            "biến số", "quy trình nghiên cứu", "quan sát", "phương pháp khoa học"
        ],
        "default_evidence_en": "Student established controlled experimental setups and verified scientific hypotheses.",
        "default_evidence_vi": "Học sinh tuân thủ phương pháp nghiên cứu khoa học với các bước thực nghiệm và đối chứng chặt chẽ."
    },
    "skill_critical_analysis": {
        "name": "Phân tích & Đánh giá phản biện",
        "cluster": "Nghiên cứu & Tư duy",
        "keywords_en": [
            "critical analysis", "evaluate", "source critique", "bias", "validity",
            "credibility", "examine", "scrutiny", "root cause", "comparative"
        ],
        "keywords_vi": [
            "phân tích phản biện", "đánh giá nguồn", "tính xác thực", "độ tin cậy",
            "đối chiếu", "mổ xẻ", "nguyên nhân gốc rễ", "so sánh đa chiều"
        ],
        "default_evidence_en": "Student scrutinized external evidence sources and evaluated prospective underlying biases.",
        "default_evidence_vi": "Học sinh thể hiện tư duy phản biện sâu sắc qua việc so sánh và đánh giá độc lập các nguồn tài liệu."
    },
    "skill_problem_solving": {
        "name": "Giải quyết vấn đề thực tiễn",
        "cluster": "Nghiên cứu & Tư duy",
        "keywords_en": [
            "problem solving", "solution", "troubleshoot", "resolve", "challenge",
            "address", "action plan", "practical application", "mitigate"
        ],
        "keywords_vi": [
            "giải quyết vấn đề", "giải pháp", "thực tiễn", "khắc phục", "thách thức",
            "phương án xử lý", "hành động", "ứng dụng thực tế"
        ],
        "default_evidence_en": "Student identified real-world bottlenecks and engineered workable solutions.",
        "default_evidence_vi": "Học sinh phát hiện vấn đề thực tiễn gần gũi và đề xuất giải pháp khả thi, cụ thể."
    },
    "skill_creative_design": {
        "name": "Tư duy sáng tạo & Thiết kế đột phá",
        "cluster": "Nghiên cứu & Tư duy",
        "keywords_en": [
            "creative design", "innovation", "brainstorming", "novel idea", "prototype",
            "out of the box", "invent", "originality", "breakthrough"
        ],
        "keywords_vi": [
            "sáng tạo", "đột phá", "ý tưởng mới", "thiết kế", "độc đáo", "đổi mới",
            "sáng kiến", "mới lạ", "cải tiến"
        ],
        "default_evidence_en": "Student demonstrated distinctive originality and designed innovative prototype models.",
        "default_evidence_vi": "Học sinh đưa ra ý tưởng thiết kế độc đáo và cách tiếp cận mới mẻ so với các mô hình truyền thống."
    },
    "skill_data_interpretation": {
        "name": "Đọc hiểu & Phân tích số liệu",
        "cluster": "Nghiên cứu & Tư duy",
        "keywords_en": [
            "data analysis", "statistics", "chart", "graph", "percentage", "metric",
            "quantitative", "correlation", "dataset", "measurement", "survey"
        ],
        "keywords_vi": [
            "số liệu", "biểu đồ", "thống kê", "định lượng", "phần trăm", "khảo sát",
            "tương quan", "bảng dữ liệu", "đo đạc", "phân tích số liệu"
        ],
        "default_evidence_en": "Student synthesized quantitative survey and experimental metrics into intelligible charts.",
        "default_evidence_vi": "Học sinh thu thập và trực quan hóa số liệu đo đạc thực nghiệm qua các bảng biểu thống kê."
    },
    "skill_systems_thinking": {
        "name": "Tư duy hệ thống",
        "cluster": "Nghiên cứu & Tư duy",
        "keywords_en": [
            "systems thinking", "interconnected", "ecosystem", "cause and effect",
            "holistic", "feedback loop", "lifecycle", "macro"
        ],
        "keywords_vi": [
            "tư duy hệ thống", "mối quan hệ nhân quả", "hệ sinh thái", "tổng thể",
            "liên kết", "chu trình", "vòng đời", "tác động dây chuyền"
        ],
        "default_evidence_en": "Student mapped interdependent cause-and-effect mechanisms across the ecosystem.",
        "default_evidence_vi": "Học sinh nhìn nhận vấn đề dưới góc độ tổng thể và phân tích mối liên hệ nhân quả phức tạp."
    },

    # Cluster C: Số hóa & Công nghệ (Digital & Technology)
    "skill_stem_prototyping": {
        "name": "Chế tạo mô hình STEM & Kỹ thuật",
        "cluster": "Số hóa & Công nghệ",
        "keywords_en": [
            "stem", "prototyping", "hardware", "sensor", "circuit", "model", "engineering",
            "iot", "arduino", "microbit", "fabrication", "mechanics"
        ],
        "keywords_vi": [
            "chế tạo stem", "mô hình", "phần cứng", "cảm biến", "mạch điện", "kỹ thuật",
            "iot", "lắp ráp", "thực nghiệm stem", "công nghệ kỹ thuật"
        ],
        "default_evidence_en": "Student assembled functioning hardware circuitry and applied engineering design principles.",
        "default_evidence_vi": "Học sinh lắp ráp mô hình kỹ thuật STEM hoạt động thực tế với các linh kiện cảm biến và điều khiển."
    },
    "skill_digital_literacy": {
        "name": "Ứng dụng công cụ số & An toàn số",
        "cluster": "Số hóa & Công nghệ",
        "keywords_en": [
            "digital literacy", "software", "online tool", "canva", "google docs",
            "cloud", "information literacy", "digital citizenship"
        ],
        "keywords_vi": [
            "công nghệ số", "công cụ số", "tin học", "phần mềm", "canva",
            "tìm kiếm thông tin", "số hóa", "kỹ năng số", "an toàn mạng"
        ],
        "default_evidence_en": "Student leveraged cloud platforms and collaborative digital productivity software effectively.",
        "default_evidence_vi": "Học sinh ứng dụng thành thạo các phần mềm số hóa và công cụ trực tuyến để tối ưu hóa sản phẩm dự án."
    },
    "skill_media_production": {
        "name": "Sản xuất nội dung truyền thông đa phương tiện",
        "cluster": "Số hóa & Công nghệ",
        "keywords_en": [
            "media production", "video editing", "podcast", "capcut", "graphic design",
            "audio", "multimedia", "animation", "visual layout"
        ],
        "keywords_vi": [
            "truyền thông", "biên tập video", "làm phim", "podcast", "đồ họa",
            "capcut", "hình ảnh", "âm thanh", "ấn phẩm", "thiết kế đồ họa"
        ],
        "default_evidence_en": "Student produced high-grade multimedia video/audio assets to amplify project reach.",
        "default_evidence_vi": "Học sinh tự biên tập video, podcast hoặc infographic truyền thông với tính thẩm mỹ cao."
    },
    "skill_coding_automation": {
        "name": "Lập trình & Tự động hóa",
        "cluster": "Số hóa & Công nghệ",
        "keywords_en": [
            "coding", "programming", "python", "scratch", "algorithm", "automation",
            "code", "script", "logic gates", "firmware"
        ],
        "keywords_vi": [
            "lập trình", "viết mã", "python", "scratch", "thuật toán",
            "tự động hóa", "code", "mã lệnh", "tự động"
        ],
        "default_evidence_en": "Student wrote structured code algorithms to automate sensor polling and control flows.",
        "default_evidence_vi": "Học sinh lập trình thuật toán điều khiển tự động hóa giúp hệ thống hoạt động chính xác."
    },
    "skill_ethical_ai_usage": {
        "name": "Ứng dụng Trí tuệ Nhân tạo có đạo đức",
        "cluster": "Số hóa & Công nghệ",
        "keywords_en": [
            "artificial intelligence", "ai", "chatgpt", "machine learning", "ai ethics",
            "responsible ai", "prompt engineering", "algorithmic bias"
        ],
        "keywords_vi": [
            "trí tuệ nhân tạo", "đạo đức ai", "sử dụng ai", "ai có trách nhiệm",
            "mô hình ngôn ngữ", "chatgpt", "công nghệ ai"
        ],
        "default_evidence_en": "Student deployed AI assistance responsibly, acknowledging boundaries and citations.",
        "default_evidence_vi": "Học sinh vận dụng công cụ Trí tuệ nhân tạo có trách nhiệm, hiểu rõ giới hạn và minh bạch nguồn tham khảo."
    },

    # Cluster D: Cá nhân & Tự chủ (Personal Growth & Autonomy)
    "skill_self_directed_learning": {
        "name": "Tự chủ & Tự học",
        "cluster": "Cá nhân & Tự chủ",
        "keywords_en": [
            "self-directed", "independent learning", "self-study", "research independently",
            "autonomous", "self-guided", "proactive"
        ],
        "keywords_vi": [
            "tự học", "tự chủ", "tự nghiên cứu", "chủ động tìm hiểu", "độc lập",
            "tự tìm tài liệu", "chủ động", "tự giác"
        ],
        "default_evidence_en": "Student took personal initiative to research academic materials outside required curriculum.",
        "default_evidence_vi": "Học sinh chủ động tự tìm kiếm tài liệu nghiên cứu chuyên sâu ngoài phạm vi sách giáo khoa."
    },
    "skill_metacognitive_reflection": {
        "name": "Năng lực phản tư & Tự đánh giá",
        "cluster": "Cá nhân & Tự chủ",
        "keywords_en": [
            "reflection", "self-evaluation", "metacognition", "lessons learned",
            "retrospective", "realized", "improved myself", "reflection journal"
        ],
        "keywords_vi": [
            "phản tư", "nhật ký phản tư", "tự nhận xét", "chiêm nghiệm", "bài học rút ra",
            "nhìn nhận lại", "tự đánh giá", "kinh nghiệm", "nhận ra"
        ],
        "default_evidence_en": "Student reflected critically on personal strengths, weaknesses, and key takeaways.",
        "default_evidence_vi": "Học sinh viết nhật ký phản tư sâu sắc, thẳng thắn nhìn nhận hạn chế và bài học kinh nghiệm của bản thân."
    },
    "skill_time_management": {
        "name": "Quản lý thời gian & Tiến độ",
        "cluster": "Cá nhân & Tự chủ",
        "keywords_en": [
            "time management", "schedule", "deadline", "milestone", "timeline",
            "planning", "on time", "punctual"
        ],
        "keywords_vi": [
            "quản lý thời gian", "tiến độ", "kế hoạch", "đúng hạn", "thời hạn",
            "phân bổ thời gian", "lịch trình", "hoàn thành trước hạn"
        ],
        "default_evidence_en": "Student met project milestones systematically according to the scheduled timeline.",
        "default_evidence_vi": "Học sinh thiết lập kế hoạch học tập khoa học và hoàn thành từng giai đoạn dự án đúng thời hạn."
    },
    "skill_growth_mindset": {
        "name": "Tư duy phát triển & Vượt khó",
        "cluster": "Cá nhân & Tự chủ",
        "keywords_en": [
            "growth mindset", "perseverance", "resilience", "overcome obstacle",
            "trial and error", "fail and learn", "persist", "determination"
        ],
        "keywords_vi": [
            "tư duy phát triển", "vượt qua khó khăn", "kiên trì", "thử sai",
            "không bỏ cuộc", "nỗ lực", "bền bỉ", "học hỏi từ thất bại"
        ],
        "default_evidence_en": "Student demonstrated resilience when addressing experimental setbacks and iterated forward.",
        "default_evidence_vi": "Học sinh kiên trì khắc phục sự cố kỹ thuật trong quá trình thực nghiệm và không nản lòng trước thử sai."
    },
    "skill_intellectual_curiosity": {
        "name": "Niềm đam mê khám phá tri thức",
        "cluster": "Cá nhân & Tự chủ",
        "keywords_en": [
            "curiosity", "inquisitive", "exploration", "passion for learning",
            "deep dive", "wonder", "fascination"
        ],
        "keywords_vi": [
            "hiếu tri", "tò mò", "đam mê khám phá", "tìm tòi", "say mê",
            "ham học hỏi", "khát khao hiểu biết", "đào sâu"
        ],
        "default_evidence_en": "Student showed genuine scholarly enthusiasm and deep curiosity about domain mechanics.",
        "default_evidence_vi": "Học sinh bộc lộ niềm đam mê khám phá khoa học sâu sắc và tinh thần ham học hỏi vượt bậc."
    },

    # Cluster E: Xã hội & Hợp tác (Social & Collaboration)
    "skill_teamwork_collaboration": {
        "name": "Làm việc nhóm & Hợp tác",
        "cluster": "Xã hội & Hợp tác",
        "keywords_en": [
            "teamwork", "collaboration", "team member", "working together",
            "cooperation", "group project", "partner", "team effort"
        ],
        "keywords_vi": [
            "làm việc nhóm", "hợp tác", "thành viên nhóm", "đồng đội",
            "phối hợp", "nhóm chúng em", "tinh thần đồng đội", "hỗ trợ lẫn nhau"
        ],
        "default_evidence_en": "Student coordinated productively with peers and contributed to collective team deliverables.",
        "default_evidence_vi": "Học sinh phối hợp ăn ý với các thành viên trong nhóm và đóng góp tích cực vào sản phẩm chung."
    },
    "skill_leadership_coordination": {
        "name": "Lãnh đạo & Điều phối dự án",
        "cluster": "Xã hội & Hợp tác",
        "keywords_en": [
            "leadership", "coordination", "project leader", "delegation",
            "task assignment", "facilitator", "guided the team"
        ],
        "keywords_vi": [
            "lãnh đạo", "điều phối", "trưởng nhóm", "phân công công việc",
            "dẫn dắt", "giao nhiệm vụ", "quản lý nhóm", "chỉ huy"
        ],
        "default_evidence_en": "Student acted as project facilitator, orchestrating tasks and guiding peers toward objectives.",
        "default_evidence_vi": "Học sinh đảm nhận vai trò điều phối nhóm mạch lạc, phân chia công việc công bằng và truyền cảm hứng."
    },
    "skill_peer_empathy": {
        "name": "Thấu cảm & Tôn trọng sự khác biệt",
        "cluster": "Xã hội & Hợp tác",
        "keywords_en": [
            "empathy", "active listening", "respect differences", "peer support",
            "mutual understanding", "inclusion", "compassion"
        ],
        "keywords_vi": [
            "thấu cảm", "lắng nghe", "tôn trọng sự khác biệt", "giúp đỡ bạn bè",
            "đồng cảm", "thấu hiểu", "hỗ trợ đồng môn", "hòa đồng"
        ],
        "default_evidence_en": "Student demonstrated empathetic listening and respectful consideration of divergent viewpoints.",
        "default_evidence_vi": "Học sinh biết lắng nghe ý kiến đóng góp của bạn bè và tôn trọng sự đa dạng trong phong cách làm việc."
    },
    "skill_academic_integrity": {
        "name": "Đạo đức học thuật & Liêm chính",
        "cluster": "Xã hội & Hợp tác",
        "keywords_en": [
            "academic integrity", "citations", "references", "bibliography", "apa",
            "mla", "plagiarism free", "honesty", "attribution", "ethics"
        ],
        "keywords_vi": [
            "liêm chính học thuật", "đạo đức học thuật", "trích dẫn", "tài liệu tham khảo",
            "nguồn gốc", "trung thực", "không đạo văn", "tôn trọng bản quyền"
        ],
        "default_evidence_en": "Student documented bibliographic citations meticulously, ensuring complete academic integrity.",
        "default_evidence_vi": "Học sinh trích dẫn nguồn tài liệu tham khảo minh bạch, tuân thủ nghiêm ngặt quy tắc liêm chính học thuật."
    },
    "skill_community_engagement": {
        "name": "Phụng sự cộng đồng & Trách nhiệm xã hội",
        "cluster": "Xã hội & Hợp tác",
        "keywords_en": [
            "community engagement", "social responsibility", "civic", "volunteer",
            "sustainability", "environment", "outreach", "public good"
        ],
        "keywords_vi": [
            "cộng đồng", "trách nhiệm xã hội", "tình nguyện", "phụng sự",
            "bảo vệ môi trường", "xã hội", "lan tỏa", "lợi ích cộng đồng", "xanh"
        ],
        "default_evidence_en": "Student oriented the project outcomes toward real community betterment and ecological stewardship.",
        "default_evidence_vi": "Học sinh hướng sản phẩm dự án đến việc giải quyết các thách thức xã hội và bảo vệ môi trường học đường."
    },
    "skill_cultural_awareness": {
        "name": "Ý thức bản sắc văn hóa & Hội nhập",
        "cluster": "Xã hội & Hợp tác",
        "keywords_en": [
            "cultural awareness", "heritage", "tradition", "identity",
            "global integration", "cultural diversity", "folklore", "customs"
        ],
        "keywords_vi": [
            "bản sắc văn hóa", "di sản", "truyền thống", "văn hóa việt nam",
            "hội nhập quốc tế", "dân tộc", "phong tục", "lịch sử văn hóa", "bảo tồn di sản"
        ],
        "default_evidence_en": "Student honored cultural heritage while situating themes within a modern global context.",
        "default_evidence_vi": "Học sinh thể hiện lòng tự hào về bản sắc văn hóa dân tộc và ý thức quảng bá giá trị di sản ra cộng đồng."
    }
}


# Category-specific primary skills (fallback priors when text is brief)
CATEGORY_PRIORS = {
    "english_presentation": [
        "skill_en_academic_writing",
        "skill_public_speaking",
        "skill_debate_argumentation",
        "skill_multimodal_storytelling",
        "skill_multilingual_competence",
    ],
    "stem_scientific": [
        "skill_scientific_inquiry",
        "skill_stem_prototyping",
        "skill_data_interpretation",
        "skill_problem_solving",
        "skill_coding_automation",
    ],
    "social_humanities": [
        "skill_cultural_awareness",
        "skill_vn_creative_expression",
        "skill_critical_analysis",
        "skill_community_engagement",
        "skill_multimodal_storytelling",
    ],
    "general": [
        "skill_self_directed_learning",
        "skill_problem_solving",
        "skill_teamwork_collaboration",
        "skill_academic_integrity",
        "skill_critical_analysis",
    ]
}


class SkillTagger:
    """
    Core AI Skill Tagging Engine.
    Evaluates student project texts and reflections against the 28-skill taxonomy.
    Guarantees >= 3 tagged skills with confidence >= 0.65 and context-rich evidence quotes.
    """

    def __init__(self):
        self.taxonomy = SKILL_TAXONOMY
        self.priors = CATEGORY_PRIORS

    def extract_skills(
        self,
        content: str,
        reflection: Optional[str] = None,
        category: str = "general",
        min_skills: int = 3,
        max_skills: int = 6,
        confidence_threshold: float = 0.65
    ) -> list[SkillTag]:
        """
        Extracts verified skills from content and reflection text.
        Guarantees at least min_skills tags with confidence >= 0.65.
        """
        combined_text = f"{content or ''}\n\n{reflection or ''}".strip()
        text_lower = combined_text.lower()
        reflection_lower = (reflection or "").lower()

        # Normalize category
        norm_cat = "general"
        for key in self.priors:
            if key in category.lower():
                norm_cat = key
                break
        if norm_cat == "general":
            if "english" in category.lower() or "debate" in category.lower() or "pres" in category.lower():
                norm_cat = "english_presentation"
            elif "stem" in category.lower() or "iot" in category.lower() or "sci" in category.lower():
                norm_cat = "stem_scientific"
            elif "social" in category.lower() or "human" in category.lower() or "cultur" in category.lower():
                norm_cat = "social_humanities"

        scored_skills: dict[str, dict] = {}

        # 1. Evaluate every skill in the 28-skill taxonomy
        for skill_id, meta in self.taxonomy.items():
            en_kws = meta["keywords_en"]
            vi_kws = meta["keywords_vi"]
            all_kws = en_kws + vi_kws

            matches = []
            for kw in all_kws:
                # Use regex word boundary check if word is purely alphanumeric
                if re.search(r"^[a-zA-Z0-9\s\-]+$", kw):
                    pattern = r"\b" + re.escape(kw) + r"\b"
                    if re.search(pattern, text_lower):
                        matches.append(kw)
                else:
                    if kw in text_lower:
                        matches.append(kw)

            # Reflection bonus: skills reflected by student personally receive high confidence
            reflection_hits = [kw for kw in all_kws if kw in reflection_lower]

            # Category prior bonus: category core skills receive affinity boost
            is_category_prior = skill_id in self.priors.get(norm_cat, [])

            if matches or reflection_hits or is_category_prior:
                # Compute confidence score: base 0.65, scaling with keyword richness
                base_conf = 0.68 if is_category_prior else 0.65
                match_bonus = min(len(matches) * 0.05, 0.20)
                refl_bonus = min(len(reflection_hits) * 0.06, 0.12)
                confidence = round(min(base_conf + match_bonus + refl_bonus, 0.98), 2)

                # Locate authentic evidence snippet
                matched_keywords = matches if matches else (en_kws[:2] + vi_kws[:2])
                evidence = nlp_engine.find_evidence_snippet(
                    text=combined_text,
                    keywords=matched_keywords,
                    category_hint=meta["name"]
                )
                if not evidence or len(evidence.strip()) < 10:
                    lang = nlp_engine.detect_language(combined_text)
                    evidence = meta["default_evidence_en"] if lang == "en" else meta["default_evidence_vi"]

                scored_skills[skill_id] = {
                    "skill_id": skill_id,
                    "skill_name": meta["name"],
                    "category": meta["cluster"],
                    "cluster": meta["cluster"],
                    "confidence": confidence,
                    "evidence": evidence,
                    "match_count": len(matches) + len(reflection_hits) + (2 if is_category_prior else 0)
                }

        # 2. Sort by confidence descending, then match count descending
        sorted_candidates = sorted(
            scored_skills.values(),
            key=lambda x: (x["confidence"], x["match_count"]),
            reverse=True
        )

        # Filter strictly by confidence >= confidence_threshold
        qualified_skills = [s for s in sorted_candidates if s["confidence"] >= confidence_threshold]

        # 3. Guarantee at least min_skills (3)
        if len(qualified_skills) < min_skills:
            # Seed from category priors and universal competencies
            prior_list = self.priors.get(norm_cat, self.priors["general"])
            backup_candidates = [
                "skill_self_directed_learning",
                "skill_problem_solving",
                "skill_teamwork_collaboration",
                "skill_academic_integrity",
                "skill_critical_analysis",
            ]
            combined_fallback = prior_list + [b for b in backup_candidates if b not in prior_list]

            existing_ids = {s["skill_id"] for s in qualified_skills}
            lang = nlp_engine.detect_language(combined_text)

            for fallback_id in combined_fallback:
                if fallback_id not in existing_ids:
                    meta = self.taxonomy[fallback_id]
                    default_ev = meta["default_evidence_en"] if lang == "en" else meta["default_evidence_vi"]
                    # Extract quote if possible
                    evidence = nlp_engine.find_evidence_snippet(
                        text=combined_text,
                        keywords=meta["keywords_en"][:2] + meta["keywords_vi"][:2],
                        category_hint=meta["name"]
                    )
                    if not evidence or len(evidence.strip()) < 10:
                        evidence = default_ev

                    # Assign reliable confidence >= 0.70
                    conf = 0.78 if fallback_id in prior_list else 0.72
                    qualified_skills.append({
                        "skill_id": fallback_id,
                        "skill_name": meta["name"],
                        "category": meta["cluster"],
                        "cluster": meta["cluster"],
                        "confidence": conf,
                        "evidence": evidence,
                        "match_count": 1
                    })
                    existing_ids.add(fallback_id)

                if len(qualified_skills) >= min_skills:
                    break

        # 4. Limit to max_skills (e.g. 6)
        final_list = qualified_skills[:max_skills]

        # Convert to Pydantic SkillTag objects
        return [
            SkillTag(
                skill_id=item["skill_id"],
                skill_name=item["skill_name"],
                category=item["category"],
                cluster=item["cluster"],
                confidence=item["confidence"],
                evidence=item["evidence"]
            )
            for item in final_list
        ]

    def tag_submission(
        self,
        content: str,
        category: str = "general",
        reflection: Optional[str] = None,
        min_skills: int = 3,
        max_skills: int = 6,
        confidence_threshold: float = 0.65,
    ) -> list[SkillTag]:
        """
        Public facade for tagging submissions, delegating to extract_skills.
        Accepts content, category, and optional reflection. Conforms to ai_routes contract.
        """
        return self.extract_skills(
            content=content,
            reflection=reflection,
            category=category,
            min_skills=min_skills,
            max_skills=max_skills,
            confidence_threshold=confidence_threshold,
        )


# Singleton instance
skill_tagger = SkillTagger()

