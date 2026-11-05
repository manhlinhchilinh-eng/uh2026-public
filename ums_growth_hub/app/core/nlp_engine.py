"""
Bilingual NLP Engine for UMS Smart Growth Hub
Handles Vietnamese and English tokenization, lexical diversity (TTR),
language detection, academic vocabulary metrics, and evidence snippet extraction.
100% Offline, Deterministic, and Zero External API Dependency.
"""

import re
import math
import unicodedata
from typing import Optional


# Comprehensive Vietnamese diacritics regex
VIETNAMESE_DIACRITICS_PATTERN = re.compile(
    r"[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]",
    re.IGNORECASE
)

# Common abbreviations in Vietnamese and English to avoid incorrect sentence splitting
ABBREVIATIONS = {
    "pgs.ts.", "ths.", "ts.", "gs.", "mr.", "mrs.", "ms.", "dr.", "prof.",
    "e.g.", "i.e.", "etc.", "vs.", "al.", "approx.", "v.v.", "tp.", "st."
}

# Vietnamese high-frequency functional words
VIETNAMESE_STOPWORDS = {
    "và", "của", "là", "trong", "các", "một", "cho", "được", "với", "những",
    "này", "khi", "để", "về", "người", "có", "đã", "sẽ", "em", "chúng", "nhóm",
    "học", "sinh", "trường", "dự", "án", "bài", "thực", "hiện", "kết", "quả",
    "nghiên", "cứu", "phương", "pháp", "sau", "đó", "tuy", "nhiên", "do", "đó",
    "vì", "vậy", "bởi", "thầy", "cô", "lớp", "nêu", "ra", "như", "theo", "tại",
    "ở", "từ", "lại", "rất", "cũng", "đang", "đến", "làm", "phát", "triển"
}

# English high-frequency functional words
ENGLISH_STOPWORDS = {
    "the", "and", "of", "to", "in", "a", "is", "that", "for", "it", "as", "was",
    "with", "on", "are", "by", "this", "be", "or", "from", "at", "which", "an",
    "have", "each", "make", "our", "their", "we", "you", "can", "will", "project",
    "research", "team", "results", "methodology", "study", "analysis", "students",
    "about", "all", "also", "been", "has", "more", "not", "one", "than", "they"
}

# Academic & domain vocabulary patterns for bilingual STEM, Language, Humanities
ACADEMIC_STEM_TERMS = {
    # English
    "hypothesis", "experiment", "experimental", "variable", "variables", "methodology",
    "quantitative", "qualitative", "empirical", "sensor", "microcontroller", "algorithm",
    "photosynthesis", "biodegradable", "biodegradability", "tensile", "conductivity",
    "arduino", "iot", "circuit", "hydroponic", "automation", "data", "statistics",
    "correlation", "measurement", "concentration", "synthesis", "specimen", "prototype",
    # Vietnamese
    "giả thuyết", "thực nghiệm", "thí nghiệm", "biến số", "phương pháp", "định lượng",
    "định tính", "cảm biến", "vi điều khiển", "thuật toán", "quang hợp", "phân hủy sinh học",
    "độ bền kéo", "độ dẫn điện", "mạch điện", "thủy canh", "tự động hóa", "số liệu",
    "thống kê", "tương quan", "đo lường", "nồng độ", "tổng hợp", "mẫu thử", "mô hình", "sáng chế"
}

ACADEMIC_HUMANITIES_TERMS = {
    # English
    "heritage", "folklore", "tradition", "traditional", "culture", "cultural", "preservation",
    "historical", "rhetoric", "literary", "empathy", "identity", "community", "narrative",
    "ethics", "aesthetic", "perspective", "societal", "engagement", "ideology", "philosophy",
    # Vietnamese
    "di sản", "dân gian", "truyền thống", "văn hóa", "bảo tồn", "lịch sử", "tu từ", "văn học",
    "thấu cảm", "bản sắc", "cộng đồng", "nghệ thuật", "đạo đức", "thẩm mỹ", "góc nhìn",
    "xã hội", "lan tỏa", "phụng sự", "nhân văn", "triết lý", "truyền cảm hứng"
}

ACADEMIC_DISCOURSE_MARKERS = {
    # English
    "furthermore", "moreover", "nevertheless", "consequently", "specifically",
    "demonstrates", "substantiate", "conversely", "in contrast", "therefore",
    "accordingly", "subsequently", "fundamentally", "notably", "significantly",
    # Vietnamese
    "hơn nữa", "mặt khác", "tuy nhiên", "do đó", "vì vậy", "cụ thể là", "chứng minh rằng",
    "đối chiếu", "tóm lại", "ngược lại", "đặc biệt là", "đáng chú ý", "thực chất",
    "nhìn chung", "trên cơ sở", "xét về mặt"
}


class NLPEngine:
    """
    Offline bilingual NLP analysis engine for student PBL projects.
    Computes text statistics, lexical diversity (TTR), language identity,
    and extracts evidence quotes.
    """

    def __init__(self):
        self._stem_terms = ACADEMIC_STEM_TERMS
        self._humanities_terms = ACADEMIC_HUMANITIES_TERMS
        self._discourse_markers = ACADEMIC_DISCOURSE_MARKERS

    @staticmethod
    def sanitize_text(text: str) -> str:
        """Strip dangerous controls, normalize Unicode, and clean whitespace."""
        if not text:
            return ""
        # Unicode normalization (NFC)
        text = unicodedata.normalize("NFC", text)
        # Remove HTML-like tags if present
        text = re.sub(r"<[^>]+>", " ", text)
        # Collapse multiple whitespaces and control characters
        text = re.sub(r"[ \t\r\f\v]+", " ", text)
        return text.strip()

    @staticmethod
    def tokenize(text: str, lowercase: bool = True) -> list[str]:
        """
        Tokenizes text into word tokens preserving Vietnamese diacritics and English terms.
        """
        if not text:
            return []
        if lowercase:
            text = text.lower()
        # Match alphanumeric word tokens including Vietnamese accented letters and hyphens
        pattern = re.compile(
            r"[a-z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+(?:-[a-z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+)*",
            re.IGNORECASE
        )
        return pattern.findall(text)

    @staticmethod
    def tokenize_sentences(text: str) -> list[str]:
        """
        Splits text into sentences, respecting common abbreviations and formatting.
        """
        if not text or not text.strip():
            return []
        cleaned = text.strip()
        # Split by paragraph newlines first or sentence punctuation
        raw_splits = re.split(r"(?<=[.!?])\s+|\n+", cleaned)
        sentences = []
        for s in raw_splits:
            s_clean = s.strip()
            if len(s_clean) > 0:
                # Discard trivial non-sentence punctuation
                if re.search(r"[a-zA-Z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]", s_clean):
                    sentences.append(s_clean)
        return sentences if sentences else [cleaned]

    def detect_language(self, text: str) -> str:
        """
        Accurately detects language: 'vi', 'en', or 'bilingual'.
        Accounts for Vietnamese diacritics, function words, and code-switching.
        """
        if not text or not text.strip():
            return "vi"

        text_lower = text.lower()
        tokens = self.tokenize(text_lower)
        if not tokens:
            return "vi"

        total_tokens = len(tokens)

        # Broader English vocabulary including project/academic terms
        en_vocab = ENGLISH_STOPWORDS | {
            "slide", "slides", "global", "warming", "climate", "change", "education",
            "school", "students", "learning", "presentation", "ai", "technology",
            "stem", "robotics", "project", "design", "future", "system", "water",
            "plant", "green", "smart", "environment", "impact", "youth", "perspectives",
            "solutions", "team", "model", "analysis", "data", "test", "science", "canva",
            "artificial", "intelligence", "ethical", "challenges", "opportunities", "plastic"
        }

        # 1. Count Vietnamese diacritic occurrences
        diacritic_chars = len(VIETNAMESE_DIACRITICS_PATTERN.findall(text_lower))
        diacritic_ratio = diacritic_chars / max(len(text_lower), 1)

        # 2. Count Vietnamese and English stopword matches
        vi_hits = sum(1 for t in tokens if t in VIETNAMESE_STOPWORDS or VIETNAMESE_DIACRITICS_PATTERN.search(t))
        en_hits = sum(1 for t in tokens if t in en_vocab)

        vi_word_ratio = vi_hits / total_tokens
        en_word_ratio = en_hits / total_tokens

        # Check for significant bilingual code-switching:
        # A mix of Vietnamese words/diacritics and English terms
        is_code_switching = (
            (diacritic_chars >= 2 or vi_hits >= 2) and
            (en_hits >= 2 and en_word_ratio >= 0.12)
        )

        if is_code_switching:
            return "bilingual"

        # Strong Vietnamese signals: diacritics and Vietnamese stop words
        if diacritic_chars >= 2 or vi_word_ratio > 0.10 or (vi_hits > en_hits and vi_hits > 0):
            if en_word_ratio > 0.25 and vi_word_ratio > 0.15:
                return "bilingual"
            return "vi"

        # If English stopwords are dominant and minimal/no Vietnamese diacritics
        if en_word_ratio >= 0.05 or en_hits >= 3 or (en_hits > vi_hits):
            return "en"

        # Default heuristic based on diacritics
        return "vi" if diacritic_chars > 0 else "en"

    def compute_lexical_metrics(self, text: str) -> dict:
        """
        Computes vocabulary sophistication, Type-Token Ratio (TTR),
        sentence length, and academic density.
        """
        sanitized = self.sanitize_text(text)
        tokens = self.tokenize(sanitized, lowercase=True)
        sentences = self.tokenize_sentences(sanitized)
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        word_count = len(tokens)
        unique_tokens = set(tokens)
        unique_word_count = len(unique_tokens)
        sentence_count = max(len(sentences), 1)

        avg_sentence_length = round(word_count / sentence_count, 2) if word_count > 0 else 0.0

        # Type-Token Ratio (TTR)
        ttr = round(unique_word_count / max(word_count, 1), 3)

        # Guiraud's Root TTR: length-independent lexical diversity
        root_ttr = round(unique_word_count / math.sqrt(max(word_count, 1)), 2) if word_count > 0 else 0.0

        # Academic vocabulary detection
        text_lower = sanitized.lower()
        stem_matches = sum(1 for term in self._stem_terms if term in text_lower)
        humanities_matches = sum(1 for term in self._humanities_terms if term in text_lower)
        discourse_matches = sum(1 for term in self._discourse_markers if term in text_lower)

        total_academic_matches = stem_matches + humanities_matches + discourse_matches
        academic_density = round(total_academic_matches / max(word_count / 100, 1), 2)

        # Composite complexity score (0.0 to 1.0)
        # Factors: Root TTR (scaled), average sentence length, academic density
        norm_ttr = min(root_ttr / 8.0, 1.0)
        norm_len = min(avg_sentence_length / 25.0, 1.0)
        norm_acad = min(academic_density / 5.0, 1.0)
        complexity_score = round(0.4 * norm_ttr + 0.3 * norm_len + 0.3 * norm_acad, 2)

        return {
            "word_count": word_count,
            "unique_word_count": unique_word_count,
            "sentence_count": sentence_count,
            "paragraph_count": max(len(paragraphs), 1),
            "avg_sentence_length": avg_sentence_length,
            "ttr": ttr,
            "root_ttr": root_ttr,
            "academic_matches": total_academic_matches,
            "academic_density": academic_density,
            "complexity_score": complexity_score,
            "language": self.detect_language(sanitized),
        }

    def analyze_text(self, text: str) -> dict:
        """
        Public convenience alias for compute_lexical_metrics.
        """
        return self.compute_lexical_metrics(text)

    def find_evidence_snippet(
        self,
        text: str,
        keywords: list[str],
        category_hint: str = "",
        max_words: int = 45
    ) -> str:
        """
        Locates a representative quote (1-2 sentences) from the text that
        best illustrates the student's mastery of the target skill/keywords.
        """
        sentences = self.tokenize_sentences(text)
        if not sentences:
            if category_hint:
                return f"Học sinh thể hiện năng lực qua dự án {category_hint}."
            return "Minh chứng được xác thực từ nội dung bài nộp dự án của học sinh."

        best_sentence = ""
        best_score = -1

        for sent in sentences:
            sent_lower = sent.lower()
            # Score sentence by matched keywords
            score = 0
            for kw in keywords:
                if kw.lower() in sent_lower:
                    score += 1
            # Bonus for substantial sentences (not too short, not gigantic)
            words = sent.split()
            if 8 <= len(words) <= 40:
                score += 0.5
            if score > best_score:
                best_score = score
                best_sentence = sent

        # Fallback to the first substantial sentence if no direct keyword match
        if best_score <= 0 or not best_sentence:
            for sent in sentences:
                if len(sent.split()) >= 6:
                    best_sentence = sent
                    break
            if not best_sentence:
                best_sentence = sentences[0]

        # Truncate gracefully if excessively long
        words = best_sentence.split()
        if len(words) > max_words:
            return " ".join(words[:max_words]) + "..."
        return best_sentence.strip()


# Singleton instance for system-wide access
nlp_engine = NLPEngine()
