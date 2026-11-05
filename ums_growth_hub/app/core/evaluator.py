"""
Core AI Rubric Evaluation Engine for UMS Smart Growth Hub
Implements the GDPT 2018 4-Dimension 10-Point Rubric:
- Content Depth: 3.0 pts
- Language Expression: 2.5 pts
- Critical Innovation: 2.5 pts
- Collaboration & Integrity: 2.0 pts
Total: 10.0 pts.
100% Offline, Deterministic, and Pedagogically Constructive.
"""

import re
from typing import Optional, Any
from app.models.rubric import (
    EvaluationRequest,
    EvaluationResponse,
    RubricScoreBreakdown,
    RubricCriterionDetail,
    SkillTag,
)
from app.core.nlp_engine import nlp_engine
from app.core.skill_tagger import skill_tagger


class RubricEvaluator:
    """
    Evaluates project-based learning submissions against the GDPT 2018 rubric.
    Generates criterion-level scoring, integrates skill tagging, and synthesizes
    constructive pedagogical feedback.
    """

    def __init__(self):
        self.nlp = nlp_engine
        self.tagger = skill_tagger

    def evaluate(self, request: EvaluationRequest | dict[str, Any]) -> EvaluationResponse:
        """
        Main evaluation entry point. Accepts EvaluationRequest or dictionary.
        """
        if isinstance(request, dict):
            req_obj = EvaluationRequest(**request)
        else:
            req_obj = request

        # Validate edge case E01: Empty or whitespace-only content
        cleaned_content = self.nlp.sanitize_text(req_obj.content)
        if not cleaned_content or len(cleaned_content.strip()) == 0:
            raise ValueError("Nội dung bài nộp không được để trống hoặc chỉ chứa ký tự đặc biệt")

        return self._evaluate_core(req_obj, cleaned_content)

    def evaluate_submission(
        self,
        submission_id: str = "SUB-DEFAULT",
        title: str = "Untitled Project",
        category: str = "general",
        language: str = "auto",
        content: str = "",
        reflection: Optional[str] = None,
        grade_level: int = 8,
        **kwargs
    ) -> EvaluationResponse:
        """
        Convenience wrapper accepting individual arguments.
        """
        req = EvaluationRequest(
            submission_id=submission_id,
            title=title,
            category=category,
            language=language,
            content=content,
            reflection=reflection,
            grade_level=grade_level,
            **kwargs
        )
        return self.evaluate(req)

    def _evaluate_core(self, req: EvaluationRequest, cleaned_content: str) -> EvaluationResponse:
        combined_text = f"{cleaned_content}\n\n{req.reflection or ''}".strip()
        metrics = self.nlp.compute_lexical_metrics(combined_text)

        # Detect or confirm language
        detected_lang = self.nlp.detect_language(combined_text)
        effective_lang = req.language if req.language in ("en", "vi", "bilingual") else detected_lang

        # 1. Score Criterion 1: Content Depth (max 3.0)
        c1_score, c1_level, c1_rationale = self._score_content_depth(
            req, cleaned_content, metrics, effective_lang
        )

        # 2. Score Criterion 2: Language Expression (max 2.5)
        c2_score, c2_level, c2_rationale = self._score_language_expression(
            req, cleaned_content, metrics, effective_lang
        )

        # 3. Score Criterion 3: Critical Thinking & Innovation (max 2.5)
        c3_score, c3_level, c3_rationale = self._score_critical_innovation(
            req, cleaned_content, metrics, effective_lang
        )

        # 4. Score Criterion 4: Collaboration & Integrity (max 2.0)
        c4_score, c4_level, c4_rationale = self._score_collaboration_integrity(
            req, cleaned_content, metrics, effective_lang
        )

        # Total score calculation: max 10.0, rounded to 1 decimal place
        total_score = round(c1_score + c2_score + c3_score + c4_score, 1)
        total_score = min(max(total_score, 1.0), 10.0)

        # Rubric details mapping
        rubric_details = {
            "content_depth": RubricCriterionDetail(
                score=c1_score,
                max_score=3.0,
                criteria_name="Kiến thức Chuyên môn & Chiều sâu Nội dung",
                level=c1_level,
                rationale=c1_rationale
            ),
            "language_expression": RubricCriterionDetail(
                score=c2_score,
                max_score=2.5,
                criteria_name="Năng lực Ngôn ngữ & Truyền thông Đa phương thức",
                level=c2_level,
                rationale=c2_rationale
            ),
            "critical_innovation": RubricCriterionDetail(
                score=c3_score,
                max_score=2.5,
                criteria_name="Tư duy Phản biện, Sáng tạo & Giải quyết vấn đề",
                level=c3_level,
                rationale=c3_rationale
            ),
            "collaboration_integrity": RubricCriterionDetail(
                score=c4_score,
                max_score=2.0,
                criteria_name="Hợp tác, Quản lý dự án & Đạo đức học thuật",
                level=c4_level,
                rationale=c4_rationale
            )
        }

        rubric_breakdown = RubricScoreBreakdown(
            content_depth=c1_score,
            language_expression=c2_score,
            critical_innovation=c3_score,
            collaboration_integrity=c4_score,
            total_score=total_score,
            details=rubric_details
        )

        # Extract verified skills (guarantees >= 3)
        tagged_skills = self.tagger.extract_skills(
            content=cleaned_content,
            reflection=req.reflection,
            category=req.category,
            min_skills=3,
            max_skills=6,
            confidence_threshold=0.65
        )

        # Constructive feedback synthesis
        feedback_data = self._generate_feedback(
            req=req,
            rubric=rubric_breakdown,
            skills=tagged_skills,
            lang=effective_lang
        )

        # Determine overall level
        if total_score >= 9.0:
            overall_level = "Xuất sắc"
        elif total_score >= 7.0:
            overall_level = "Tốt"
        elif total_score >= 5.0:
            overall_level = "Đạt"
        else:
            overall_level = "Cần cố gắng"

        return EvaluationResponse(
            submission_id=req.submission_id,
            rubric=rubric_breakdown,
            skills=tagged_skills,
            feedback=feedback_data["full_feedback"],
            growth_recommendations=feedback_data["milestones_list"],
            overall_score=total_score,
            overall_level=overall_level,
            tagged_skills=tagged_skills,
            constructive_feedback={
                "strengths": feedback_data["strengths"],
                "growth_areas": feedback_data["growth_areas"],
                "actionable_milestones": "\n".join(feedback_data["milestones_list"])
            },
            rubric_scores={
                "content_and_depth": {
                    "score": c1_score,
                    "max_score": 3.0,
                    "criteria_name": "Kiến thức Chuyên môn & Chiều sâu Nội dung",
                    "level": c1_level,
                    "rationale": c1_rationale
                },
                "language_and_communication": {
                    "score": c2_score,
                    "max_score": 2.5,
                    "criteria_name": "Năng lực Ngôn ngữ & Truyền thông Đa phương thức",
                    "level": c2_level,
                    "rationale": c2_rationale
                },
                "critical_thinking_and_creativity": {
                    "score": c3_score,
                    "max_score": 2.5,
                    "criteria_name": "Tư duy Phản biện & Sáng tạo",
                    "level": c3_level,
                    "rationale": c3_rationale
                },
                "collaboration_and_integrity": {
                    "score": c4_score,
                    "max_score": 2.0,
                    "criteria_name": "Hợp tác & Đạo đức Học thuật",
                    "level": c4_level,
                    "rationale": c4_rationale
                },
                "total_score": total_score
            }
        )

    # --------------------------------------------------------------------------
    # Scoring algorithms for individual criteria
    # --------------------------------------------------------------------------

    def _score_content_depth(
        self, req: EvaluationRequest, content: str, metrics: dict, lang: str
    ) -> tuple[float, str, str]:
        """Content Depth (Max 3.0). Factors: word count, academic terms, empirical data."""
        word_count = metrics["word_count"]
        academic_matches = metrics["academic_matches"]

        # Base score from substantive length
        if word_count < 30:
            score = 1.0
        elif word_count < 80:
            score = 1.6
        elif word_count < 150:
            score = 2.1
        elif word_count < 300:
            score = 2.5
        else:
            score = 2.7

        # Terminology & empirical bonus
        has_numbers_or_data = bool(re.search(r"\b\d+(?:[\.,]\d+)?\s*(?:%|mg|ml|cm|m|kg|ngày|hours|days|samples|lần|độ)?\b", content))
        if has_numbers_or_data:
            score += 0.2
        if academic_matches >= 3:
            score += 0.2
        elif academic_matches >= 1:
            score += 0.1

        # Structure bonus (Abstract/Intro/Method/Result/Conclusion)
        structure_markers = ["mục tiêu", "phương pháp", "kết quả", "kết luận", "objective", "method", "result", "discussion", "conclusion"]
        found_structure = sum(1 for sm in structure_markers if sm in content.lower())
        if found_structure >= 2:
            score += 0.2

        score = round(min(max(score, 0.8), 3.0), 1)

        if score >= 2.7:
            level = "Xuất sắc"
            rationale = "Nội dung phong phú, bố cục bài bản, kiến thức chuyên môn chính xác và có số liệu minh chứng thuyết phục."
        elif score >= 2.1:
            level = "Tốt"
            rationale = "Nội dung đạt chuẩn mục tiêu dự án, lập luận rõ ràng, hiểu biết chuyên môn vững vàng."
        elif score >= 1.5:
            level = "Đạt"
            rationale = "Nội dung đáp ứng yêu cầu cơ bản, cần đào sâu thêm phân tích nguyên nhân và số liệu đối chứng."
        else:
            level = "Cần cố gắng"
            rationale = "Nội dung còn quá ngắn gọn hoặc sơ sài, cần bổ sung thêm dẫn chứng và chi tiết thực nghiệm."

        return score, level, rationale

    def _score_language_expression(
        self, req: EvaluationRequest, content: str, metrics: dict, lang: str
    ) -> tuple[float, str, str]:
        """Language Expression (Max 2.5). Factors: TTR, sentence length, discourse connectors."""
        ttr = metrics["ttr"]
        root_ttr = metrics["root_ttr"]
        word_count = metrics["word_count"]

        if word_count < 30:
            score = 0.9
        elif word_count < 80:
            score = 1.4
        elif word_count < 150:
            score = 1.8
        else:
            score = 2.1

        # Lexical diversity bonus
        if root_ttr >= 5.0 or (ttr >= 0.65 and word_count >= 50):
            score += 0.25
        elif root_ttr >= 3.5:
            score += 0.15

        # Bilingual / presentation discourse bonus
        discourse_count = sum(1 for m in ["tuy nhiên", "do đó", "vì vậy", "furthermore", "however", "therefore", "specifically"] if m in content.lower())
        if discourse_count >= 2:
            score += 0.15

        score = round(min(max(score, 0.8), 2.5), 1)

        if score >= 2.2:
            level = "Xuất sắc"
            rationale = "Vốn từ vựng phong phú, sử dụng chính xác thuật ngữ chuyên môn và cấu trúc câu mạch lạc, tự nhiên."
        elif score >= 1.8:
            level = "Tốt"
            rationale = "Diễn đạt lưu loát, ngữ pháp chuẩn mực, phong cách trình bày khoa học và trực quan."
        elif score >= 1.3:
            level = "Đạt"
            rationale = "Diễn đạt tròn ý, câu cú cơ bản hoàn chỉnh; cần trau chuốt thêm các liên từ kết nối mạch lập luận."
        else:
            level = "Cần cố gắng"
            rationale = "Câu văn còn đơn điệu hoặc lặp từ; cần mở rộng vốn từ học thuật và cải thiện diễn đạt."

        return score, level, rationale

    def _score_critical_innovation(
        self, req: EvaluationRequest, content: str, metrics: dict, lang: str
    ) -> tuple[float, str, str]:
        """Critical Thinking & Innovation (Max 2.5). Factors: counter-arguments, solution novelty."""
        content_lower = content.lower()
        word_count = metrics["word_count"]

        if word_count < 30:
            score = 0.8
        elif word_count < 80:
            score = 1.3
        elif word_count < 150:
            score = 1.7
        else:
            score = 2.0

        # Critical indicators
        critical_markers = [
            "tại sao", "nguyên nhân", "phản biện", "so sánh", "đối chứng", "hạn chế", "thách thức",
            "why", "cause", "limitation", "challenge", "trade-off", "counter", "contrast"
        ]
        crit_hits = sum(1 for cm in critical_markers if cm in content_lower)
        if crit_hits >= 3:
            score += 0.3
        elif crit_hits >= 1:
            score += 0.15

        # Innovation indicators
        innovation_markers = [
            "sáng tạo", "đề xuất", "giải pháp", "cải tiến", "mới", "đột phá", "mô hình",
            "innovative", "novel", "solution", "prototype", "designed", "improved", "idea"
        ]
        innov_hits = sum(1 for im in innovation_markers if im in content_lower)
        if innov_hits >= 3:
            score += 0.3
        elif innov_hits >= 1:
            score += 0.15

        score = round(min(max(score, 0.7), 2.5), 1)

        if score >= 2.2:
            level = "Xuất sắc"
            rationale = "Ý tưởng có tính đột phá cao, tiếp cận bài toán đa chiều và đề xuất giải pháp sáng tạo, khả thi."
        elif score >= 1.8:
            level = "Tốt"
            rationale = "Có tư duy phản biện tốt, nhận diện đúng thách thức thực tế và đưa ra giải pháp phù hợp."
        elif score >= 1.3:
            level = "Đạt"
            rationale = "Giải pháp cơ bản khả thi nhưng chưa có nhiều điểm mới lạ; cần phân tích sâu hơn tính ứng dụng."
        else:
            level = "Cần cố gắng"
            rationale = "Chưa thể hiện rõ góc nhìn phản biện cá nhân hoặc giải pháp còn mang tính sao chép sơ lược."

        return score, level, rationale

    def _score_collaboration_integrity(
        self, req: EvaluationRequest, content: str, metrics: dict, lang: str
    ) -> tuple[float, str, str]:
        """Collaboration & Academic Integrity (Max 2.0). Factors: references, teamwork, reflection."""
        content_lower = content.lower()
        reflection_text = req.reflection or ""
        refl_lower = reflection_text.lower()

        base = 1.2

        # Integrity & citations check
        citation_markers = [
            "nguồn", "tài liệu tham khảo", "trích dẫn", "theo nghiên cứu", "apa", "mla",
            "references", "sources", "bibliography", "cited", "et al", "http", "doi"
        ]
        has_citations = any(cm in content_lower for cm in citation_markers)
        if has_citations:
            base += 0.4

        # Collaboration check in content or reflection
        collab_markers = [
            "nhóm", "thành viên", "phân công", "vai trò", "đồng đội", "phối hợp", "chúng em",
            "team", "member", "collaborate", "divided", "coordination", "partner", "role"
        ]
        has_collab = any(cm in content_lower or cm in refl_lower for cm in collab_markers)
        if has_collab:
            base += 0.3

        # Reflection bonus
        if len(reflection_text.strip()) >= 30:
            base += 0.3
        elif len(reflection_text.strip()) > 0:
            base += 0.15

        score = round(min(max(base, 0.6), 2.0), 1)

        if score >= 1.8:
            level = "Xuất sắc"
            rationale = "Tuân thủ nghiêm ngặt liêm chính học thuật với nguồn trích dẫn chuẩn mực; tinh thần hợp tác nhóm và phản tư rất gương mẫu."
        elif score >= 1.4:
            level = "Tốt"
            rationale = "Trích dẫn nguồn tài liệu minh bạch; phân công công việc trong nhóm rõ ràng và có tinh thần trách nhiệm."
        elif score >= 1.0:
            level = "Đạt"
            rationale = "Có ghi nhận tài liệu tham khảo và tham gia nhóm; cần chuẩn hóa định dạng trích dẫn theo chuẩn học thuật (APA)."
        else:
            level = "Cần cố gắng"
            rationale = "Thiếu danh mục tài liệu tham khảo hoặc chưa thể hiện rõ sự đóng góp trong quy trình làm việc nhóm."

        return score, level, rationale

    # --------------------------------------------------------------------------
    # Constructive Feedback Synthesis
    # --------------------------------------------------------------------------

    def _generate_feedback(
        self,
        req: EvaluationRequest,
        rubric: RubricScoreBreakdown,
        skills: list[SkillTag],
        lang: str
    ) -> dict[str, Any]:
        """
        Synthesizes 3-part constructive feedback:
        1. Strengths (Điểm sáng nổi bật)
        2. Growth Areas (Cơ hội bứt phá)
        3. Actionable Milestones (Hành động kế tiếp)
        """
        is_english = lang == "en"
        title = req.title or "Dự án học tập"
        top_skill_names = [s.skill_name for s in skills[:2]]
        skill_str = ", ".join(top_skill_names) if top_skill_names else "tư duy nghiên cứu độc lập"

        # 1. Strengths
        if rubric.total_score >= 8.5:
            if is_english:
                strengths = (
                    f"Outstanding performance on project '{title}'! The submission showcases strong academic rigor, "
                    f"sophisticated vocabulary, and compelling argumentation. Your command of {skill_str} is exemplary for Grade {req.grade_level}."
                )
            else:
                strengths = (
                    f"Bài nộp dự án '{title}' thể hiện chất lượng học thuật rất xuất sắc! "
                    f"Em đã vận dụng hiệu quả {skill_str}, lập luận chặt chẽ và kết hợp trực quan sinh động, vượt chuẩn kỳ vọng của lứa tuổi THCS."
                )
        elif rubric.total_score >= 7.0:
            if is_english:
                strengths = (
                    f"Very commendable work on '{title}'. Your content is well-structured, concepts are articulated clearly, "
                    f"and your application of {skill_str} demonstrates commendable diligence and capability."
                )
            else:
                strengths = (
                    f"Dự án '{title}' được hoàn thiện rất chỉn chu và đúng tiến độ. "
                    f"Em đã nắm vững kiến thức chuyên môn, thể hiện rõ {skill_str} và tinh thần trách nhiệm cao đối với sản phẩm học tập."
                )
        else:
            if is_english:
                strengths = (
                    f"Good initiative in completing '{title}'. You successfully addressed the basic objectives "
                    f"and showed an encouraging start in developing {skill_str}."
                )
            else:
                strengths = (
                    f"Ghi nhận nỗ lực bước đầu của em trong việc hoàn thành dự án '{title}'. "
                    f"Em đã bước đầu làm quen với phương pháp làm việc dự án và rèn luyện {skill_str}."
                )

        # 2. Growth Areas
        lowest_criterion = min(
            [
                ("content_depth", rubric.content_depth / 3.0),
                ("language_expression", rubric.language_expression / 2.5),
                ("critical_innovation", rubric.critical_innovation / 2.5),
                ("collaboration_integrity", rubric.collaboration_integrity / 2.0),
            ],
            key=lambda x: x[1]
        )[0]

        growth_map_vi = {
            "content_depth": "Em nên bổ sung thêm số liệu thực nghiệm định lượng hoặc phân tích sâu hơn về nguyên nhân cốt lõi của vấn đề.",
            "language_expression": "Có thể mở rộng thêm vốn thuật ngữ học thuật chuyên sâu và sử dụng các câu chuyển ý linh hoạt hơn để tăng tính thuyết phục.",
            "critical_innovation": "Nên dành thêm dung lượng để so sánh ưu - nhược điểm của các phương án khác nhau và làm nổi bật tính mới lạ của giải pháp.",
            "collaboration_integrity": "Cần chuẩn hóa danh mục tài liệu tham khảo theo định dạng APA và viết nhật ký phản tư cá nhân chi tiết hơn."
        }
        growth_map_en = {
            "content_depth": "Consider expanding the quantitative empirical evidence and deepening the analysis of underlying root causes.",
            "language_expression": "Try integrating more advanced academic terminology and varied discourse connectors to elevate expression flow.",
            "critical_innovation": "You can strengthen the critical evaluation by contrasting counter-arguments and emphasizing the unique novelty of your solution.",
            "collaboration_integrity": "Standardize your bibliography according to APA guidelines and elaborate on peer collaboration in your reflection."
        }

        growth_areas = growth_map_en[lowest_criterion] if is_english else growth_map_vi[lowest_criterion]

        # 3. Actionable Milestones
        if is_english:
            milestones = [
                f"1. Refine the project bibliography using APA 7th edition citation standards within the next revision.",
                f"2. Engage actively in UMS academic clubs (Debate Club or STEM Robotics) to practice presenting and defending your research before wider audiences."
            ]
        else:
            milestones = [
                f"1. Chuẩn hóa định dạng trích dẫn tài liệu tham khảo và bổ sung 1 biểu đồ trực quan hóa dữ liệu trong lần nộp tiếp theo.",
                f"2. Đăng ký tham gia Câu lạc bộ Tranh biện hoặc CLB Nghiên cứu Khoa học UMS để tiếp tục bồi dưỡng tư duy phản biện và sẵn sàng cho mục tiêu chuyển cấp vào THPT Chuyên Ngoại ngữ (CNN)."
            ]

        full_feedback = (
            f"【Điểm sáng nổi bật】: {strengths}\n\n"
            f"【Cơ hội bứt phá】: {growth_areas}\n\n"
            f"【Hành động tiếp theo】:\n" + "\n".join(milestones)
        )

        return {
            "strengths": strengths,
            "growth_areas": growth_areas,
            "milestones_list": milestones,
            "full_feedback": full_feedback
        }


# Singleton instance
rubric_evaluator = RubricEvaluator()
