"""
ReportLab PDF Generator for Student Digital Passport & Semester Reports.
Creates print-ready A4 documents with UMS / ULIS letterhead, student profile details,
15 GDPT 2018 radar competency breakdown, signature project achievements, and CNN high school recommendations.
"""

import io
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# Colors matching UMS Navy & Royal Gold brand palette
COLOR_NAVY = colors.HexColor("#0A2540")
COLOR_NAVY_LIGHT = colors.HexColor("#1A4F7C")
COLOR_GOLD = colors.HexColor("#D4AF37")
COLOR_GOLD_LIGHT = colors.HexColor("#FDF8E8")
COLOR_BG_GRAY = colors.HexColor("#F8FAFC")
COLOR_TEXT = colors.HexColor("#1E293B")
COLOR_TEXT_MUTED = colors.HexColor("#64748B")
COLOR_BORDER = colors.HexColor("#E2E8F0")

# Register Unicode fonts if available
FONT_NAME = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

def _register_system_fonts() -> tuple[str, str]:
    """Attempts to register TrueType fonts for full Vietnamese Unicode support."""
    global FONT_NAME, FONT_BOLD
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    font_candidates = [
        ("Arial", "C:/Windows/Fonts/arial.ttf", "Arial-Bold", "C:/Windows/Fonts/arialbd.ttf"),
        ("Calibri", "C:/Windows/Fonts/calibri.ttf", "Calibri-Bold", "C:/Windows/Fonts/calibrib.ttf"),
        ("SegoeUI", "C:/Windows/Fonts/segoeui.ttf", "SegoeUI-Bold", "C:/Windows/Fonts/segoeuib.ttf"),
    ]

    for reg_name, reg_path, bold_name, bold_path in font_candidates:
        if os.path.exists(reg_path) and os.path.exists(bold_path):
            try:
                pdfmetrics.registerFont(TTFont(reg_name, reg_path))
                pdfmetrics.registerFont(TTFont(bold_name, bold_path))
                FONT_NAME = reg_name
                FONT_BOLD = bold_name
                return FONT_NAME, FONT_BOLD
            except Exception:
                continue

    return "Helvetica", "Helvetica-Bold"

# Initialize fonts
_register_system_fonts()


class NumberedCanvas(canvas.Canvas):
    """Adds running footer with page numbers and authentication note."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_footer(num_pages)
            super().showPage()
        super().save()

    def draw_page_footer(self, total_pages: int):
        self.saveState()
        self.setFont(FONT_NAME, 8)
        self.setFillColor(COLOR_TEXT_MUTED)
        footer_text = (
            f"Trường THCS Ngoại ngữ (UMS - ULIS) — Hộ chiếu Năng lực Số — Trang {self._pageNumber}/{total_pages} "
            f"— Xác thực điện tử qua UMS Smart Growth Hub"
        )
        self.drawCentredString(A4[0] / 2.0, 20, footer_text)
        self.restoreState()


class PDFBuilder:
    """
    Constructs high-fidelity PDF documents for UMS students.
    """

    def __init__(self):
        self._font_regular, self._font_bold = _register_system_fonts()

    def _get_styles(self) -> Dict[str, ParagraphStyle]:
        """Builds custom paragraph styles tailored to UMS brand aesthetics."""
        styles = getSampleStyleSheet()

        return {
            "UnivHeader": ParagraphStyle(
                "UnivHeader",
                fontName=self._font_bold,
                fontSize=9,
                leading=11,
                textColor=COLOR_NAVY,
                alignment=1,  # Center
            ),
            "SchoolHeader": ParagraphStyle(
                "SchoolHeader",
                fontName=self._font_bold,
                fontSize=13,
                leading=16,
                textColor=COLOR_NAVY,
                alignment=1,
            ),
            "DocTitle": ParagraphStyle(
                "DocTitle",
                fontName=self._font_bold,
                fontSize=15,
                leading=19,
                textColor=COLOR_GOLD,
                alignment=1,
                spaceAfter=6,
            ),
            "DocSubtitle": ParagraphStyle(
                "DocSubtitle",
                fontName=self._font_regular,
                fontSize=9,
                leading=12,
                textColor=COLOR_TEXT_MUTED,
                alignment=1,
                spaceAfter=12,
            ),
            "SectionHeading": ParagraphStyle(
                "SectionHeading",
                fontName=self._font_bold,
                fontSize=11,
                leading=14,
                textColor=COLOR_NAVY,
                spaceBefore=8,
                spaceAfter=4,
            ),
            "Body": ParagraphStyle(
                "Body",
                fontName=self._font_regular,
                fontSize=9,
                leading=12,
                textColor=COLOR_TEXT,
            ),
            "BodyBold": ParagraphStyle(
                "BodyBold",
                fontName=self._font_bold,
                fontSize=9,
                leading=12,
                textColor=COLOR_TEXT,
            ),
            "SmallMuted": ParagraphStyle(
                "SmallMuted",
                fontName=self._font_regular,
                fontSize=8,
                leading=10,
                textColor=COLOR_TEXT_MUTED,
            ),
            "TableText": ParagraphStyle(
                "TableText",
                fontName=self._font_regular,
                fontSize=8,
                leading=11,
                textColor=COLOR_TEXT,
            ),
            "TableTextBold": ParagraphStyle(
                "TableTextBold",
                fontName=self._font_bold,
                fontSize=8,
                leading=11,
                textColor=COLOR_NAVY,
            ),
        }

    def build_passport_pdf(self, student: Dict[str, Any]) -> bytes:
        """
        Generate Student Digital Passport / CV as a downloadable PDF stream.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = self._get_styles()
        elements = []

        # 1. Header with UMS Letterhead
        elements.append(Paragraph("ĐẠI HỌC QUỐC GIA HÀ NỘI — TRƯỜNG ĐẠI HỌC NGOẠI NGỮ", styles["UnivHeader"]))
        elements.append(Paragraph("TRƯỜNG THCS NGOẠI NGỮ (ULIS MIDDLE SCHOOL - UMS)", styles["SchoolHeader"]))
        elements.append(Spacer(1, 4))
        elements.append(HRFlowable(width="100%", thickness=1.5, color=COLOR_GOLD, spaceAfter=8))

        elements.append(Paragraph("HỘ CHIẾU NĂNG LỰC SỐ HỌC SINH (STUDENT DIGITAL PASSPORT)", styles["DocTitle"]))
        elements.append(
            Paragraph(
                "Hồ sơ năng lực học tập liên môn & Định hướng liên thông THPT Chuyên Ngoại ngữ (CNN - ULIS)",
                styles["DocSubtitle"],
            )
        )

        # 2. Student Info Card (2-column layout)
        s_name = student.get("full_name", "Học sinh UMS")
        s_code = student.get("student_code", student.get("id", "UMS-STU-001"))
        s_class = student.get("class_name", "8A1")
        s_grade = student.get("grade", 8)
        s_gpa = student.get("gpa", 9.0)
        s_cefr = student.get("cefr_level", "B2/C1")
        s_target = student.get("target_highschool", "THPT Chuyên Ngoại ngữ (CNN - FLSS)")
        s_lang2 = student.get("second_language", "Tiếng Đức")
        s_clubs = ", ".join(student.get("clubs", [])) or "UMS Debate Club"
        s_teacher = student.get("homeroom_teacher_name") or student.get("homeroom_teacher") or "Cô Đỗ Tuệ Uyên"

        info_data = [
            [
                Paragraph(f"<b>Họ và tên:</b> {s_name}", styles["Body"]),
                Paragraph(f"<b>Mã học sinh:</b> {s_code}", styles["Body"]),
            ],
            [
                Paragraph(f"<b>Lớp:</b> {s_class} (Khối {s_grade})", styles["Body"]),
                Paragraph(f"<b>Điểm trung bình (GPA):</b> <font color='{COLOR_NAVY.hexval()}'><b>{s_gpa}/10.0</b></font>", styles["Body"]),
            ],
            [
                Paragraph(f"<b>Ngoại ngữ 2:</b> {s_lang2}", styles["Body"]),
                Paragraph(f"<b>Trình độ ngoại ngữ:</b> {s_cefr}", styles["Body"]),
            ],
            [
                Paragraph(f"<b>Câu lạc bộ:</b> {s_clubs}", styles["Body"]),
                Paragraph(f"<b>Giáo viên chủ nhiệm:</b> {s_teacher}", styles["Body"]),
            ],
            [
                Paragraph(f"<b>Mục tiêu chuyển cấp:</b> <b>{s_target}</b>", styles["BodyBold"]),
                Paragraph(f"<b>Xếp loại rèn luyện:</b> {student.get('conduct_grade', 'Tốt')}", styles["Body"]),
            ],
        ]

        info_table = Table(info_data, colWidths=[260, 260])
        info_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_BG_GRAY),
                ("BOX", (0, 0), (-1, -1), 0.75, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ])
        )
        elements.append(info_table)
        elements.append(Spacer(1, 10))

        # 3. GDPT 2018 15 Competency & Quality Breakdown Table
        elements.append(Paragraph("I. HỒ SƠ NĂNG LỰC & PHẨM CHẤT THEO KHUNG GDPT 2018", styles["SectionHeading"]))

        comp_dict = student.get("competencies", {})
        if isinstance(comp_dict, dict):
            radar_vals = comp_dict
        else:
            radar_vals = {}

        # 3 Columns for 15 dimensions: Qualities (5), General (3), Specific (7)
        qualities = [
            ("Yêu nước", radar_vals.get("yeu_nuoc", 9.0)),
            ("Nhân ái", radar_vals.get("nhan_ai", 9.2)),
            ("Chăm chỉ", radar_vals.get("cham_chi", 8.8)),
            ("Trung thực", radar_vals.get("trung_thuc", 9.5)),
            ("Trách nhiệm", radar_vals.get("trach_nhiem", 9.1)),
        ]
        general_comp = [
            ("Tự chủ & Tự học", radar_vals.get("tu_chu_tu_hoc", 9.0)),
            ("Giao tiếp & Hợp tác", radar_vals.get("giao_tiep_hop_tac", 9.4)),
            ("Sáng tạo & GQ Vấn đề", radar_vals.get("giai_quyet_van_de_sang_tao", 8.9)),
        ]
        specific_comp = [
            ("Năng lực Ngôn ngữ", radar_vals.get("ngon_ngu", 9.5)),
            ("Năng lực Tính toán", radar_vals.get("tinh_toan", 8.7)),
            ("Khoa học tự nhiên", radar_vals.get("khoa_hoc_tu_nhien", 8.8)),
            ("Công nghệ & Tin học", radar_vals.get("cong_nghe", 8.9)),
            ("Thẩm mỹ & Thể chất", radar_vals.get("tham_my", 9.0)),
        ]

        comp_rows = [
            [
                Paragraph("<b>5 Phẩm chất chủ yếu</b>", styles["TableTextBold"]),
                Paragraph("<b>3 Năng lực cốt lõi chung</b>", styles["TableTextBold"]),
                Paragraph("<b>7 Năng lực đặc thù</b>", styles["TableTextBold"]),
            ]
        ]

        max_rows = max(len(qualities), len(general_comp), len(specific_comp))
        for r in range(max_rows):
            col1 = f"{qualities[r][0]}: <b>{qualities[r][1]}</b>" if r < len(qualities) else ""
            col2 = f"{general_comp[r][0]}: <b>{general_comp[r][1]}</b>" if r < len(general_comp) else ""
            col3 = f"{specific_comp[r][0]}: <b>{specific_comp[r][1]}</b>" if r < len(specific_comp) else ""
            comp_rows.append([
                Paragraph(col1, styles["TableText"]),
                Paragraph(col2, styles["TableText"]),
                Paragraph(col3, styles["TableText"]),
            ])

        comp_table = Table(comp_rows, colWidths=[173, 173, 174])
        comp_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), COLOR_GOLD_LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.75, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ])
        )
        elements.append(comp_table)
        elements.append(Spacer(1, 10))

        # 4. Signature Projects
        elements.append(Paragraph("II. DỰ ÁN HỌC TẬP LIÊN MÔN TIÊU BIỂU (SIGNATURE PROJECTS)", styles["SectionHeading"]))
        projects = student.get("signature_projects", [])

        if projects:
            proj_rows = [
                [
                    Paragraph("<b>Mã & Tên Dự án</b>", styles["TableTextBold"]),
                    Paragraph("<b>Môn học</b>", styles["TableTextBold"]),
                    Paragraph("<b>Điểm Rubric</b>", styles["TableTextBold"]),
                    Paragraph("<b>Kỹ năng gắn thẻ</b>", styles["TableTextBold"]),
                ]
            ]
            for p in projects[:3]:
                p_title = p.get("title", "Dự án liên môn")
                p_sub = p.get("subject", "Liên môn")
                p_score = p.get("score")
                score_str = f"<b>{p_score}/10.0</b>" if p_score is not None else "Đang duyệt"
                skills = p.get("skills", [])
                skill_str = ", ".join(skills[:3]) if skills else "Tư duy phản biện, Hợp tác"

                proj_rows.append([
                    Paragraph(f"<b>{p.get('id', '')}</b><br/>{p_title}", styles["TableText"]),
                    Paragraph(p_sub, styles["TableText"]),
                    Paragraph(score_str, styles["TableTextBold"]),
                    Paragraph(skill_str, styles["TableText"]),
                ])

            proj_table = Table(proj_rows, colWidths=[200, 100, 80, 140])
            proj_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), COLOR_BG_GRAY),
                    ("BOX", (0, 0), (-1, -1), 0.75, COLOR_BORDER),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ])
            )
            elements.append(proj_table)
        else:
            elements.append(
                Paragraph("Học sinh đang hoàn thiện các minh chứng dự án liên môn cho học kỳ hiện tại.", styles["Body"])
            )

        elements.append(Spacer(1, 10))

        # 5. CNN Pathway Recommendation & Teacher Certification
        elements.append(
            Paragraph("III. LỜI PHÊ GIÁO VIÊN & ĐỊNH HƯỚNG LIÊN THÔNG THPT CHUYÊN NGOẠI NGỮ", styles["SectionHeading"])
        )

        teacher_note = student.get("notes") or (
            f"Em {s_name} là học sinh có tư duy độc lập, giàu tính sáng tạo và khả năng biểu đạt song ngữ xuất sắc. "
            f"Với năng lực hiện tại và sự tiến bộ vượt bậc qua các dự án thực tế, em hoàn toàn đáp ứng các tiêu chuẩn khắt khe "
            f"để thi tuyển vào lớp Chuyên Anh của Trường THPT Chuyên Ngoại ngữ (CNN - ULIS)."
        )

        rec_box = Table(
            [[Paragraph(teacher_note, styles["Body"])]],
            colWidths=[520]
        )
        rec_box.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_GOLD_LIGHT),
                ("BOX", (0, 0), (-1, -1), 1, COLOR_GOLD),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ])
        )
        elements.append(rec_box)
        elements.append(Spacer(1, 14))

        # 6. Signatures (GVCN & Ban Giám Hiệu)
        sig_data = [
            [
                Paragraph("<b>GIÁO VIÊN CHỦ NHIỆM</b><br/><i>(Ký và ghi rõ họ tên)</i>", styles["UnivHeader"]),
                Paragraph("<b>XÁC NHẬN CỦA BAN GIÁM HIỆU</b><br/><i>(Ký tên và đóng dấu điện tử)</i>", styles["UnivHeader"]),
            ],
            [
                Spacer(1, 35),
                Spacer(1, 35),
            ],
            [
                Paragraph(f"<b>{s_teacher}</b>", styles["UnivHeader"]),
                Paragraph("<b>HIỆU TRƯỞNG TRƯỜNG THCS NGOẠI NGỮ</b>", styles["UnivHeader"]),
            ],
        ]
        sig_table = Table(sig_data, colWidths=[260, 260])
        sig_table.setStyle(
            TableStyle([
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ])
        )
        elements.append(KeepTogether([sig_table]))

        # Build document
        doc.build(elements, canvasmaker=NumberedCanvas)
        return buffer.getvalue()

    def build_report_pdf(self, report: Dict[str, Any], student: Optional[Dict[str, Any]] = None) -> bytes:
        """
        Generate Semester Report document as a downloadable PDF stream.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=40,
            rightMargin=40,
            topMargin=40,
            bottomMargin=40,
        )

        styles = self._get_styles()
        elements = []

        # Letterhead
        elements.append(Paragraph("TRƯỜNG THCS NGOẠI NGỮ — TRƯỜNG ĐẠI HỌC NGOẠI NGỮ, ĐHQGHN", styles["UnivHeader"]))
        elements.append(Paragraph("BẢN NHẬN XÉT HỌC KỲ & ĐÁNH GIÁ NĂNG LỰC HỌC SINH", styles["DocTitle"]))
        elements.append(Spacer(1, 6))

        s_name = report.get("student_name", "Học sinh UMS")
        s_id = report.get("student_id", "UMS-STU-001")
        semester = report.get("semester", "Học kỳ I")
        school_year = report.get("school_year", "2025-2026")
        t_type = "Giáo viên chủ nhiệm" if report.get("teacher_type") == "homeroom" else "Giáo viên bộ môn"

        meta_data = [
            [
                Paragraph(f"<b>Học sinh:</b> {s_name}", styles["Body"]),
                Paragraph(f"<b>Mã số:</b> {s_id}", styles["Body"]),
            ],
            [
                Paragraph(f"<b>Thời điểm:</b> {semester} — Năm học {school_year}", styles["Body"]),
                Paragraph(f"<b>Hình thức đánh giá:</b> {t_type}", styles["Body"]),
            ]
        ]
        meta_table = Table(meta_data, colWidths=[260, 260])
        meta_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), COLOR_BG_GRAY),
                ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ])
        )
        elements.append(meta_table)
        elements.append(Spacer(1, 12))

        # Section 1: Academic
        sec_acad = report.get("section_academic") or (
            report.get("sections", {}).get("academic_and_language", "")
        )
        elements.append(Paragraph("1. ĐÁNH GIÁ NĂNG LỰC CHUYÊN MÔN & NGOẠI NGỮ", styles["SectionHeading"]))
        elements.append(Paragraph(sec_acad, styles["Body"]))
        elements.append(Spacer(1, 10))

        # Section 2: Qualities
        sec_qual = report.get("section_qualities") or (
            report.get("sections", {}).get("qualities_and_soft_skills", "")
        )
        elements.append(Paragraph("2. ĐÁNH GIÁ PHẨM CHẤT & KỸ NĂNG MỀM (GDPT 2018)", styles["SectionHeading"]))
        elements.append(Paragraph(sec_qual, styles["Body"]))
        elements.append(Spacer(1, 10))

        # Section 3: High School Orientation
        sec_orient = report.get("section_orientation") or (
            report.get("sections", {}).get("highschool_pathway_guidance", "")
        )
        elements.append(
            Paragraph("3. LỜI KHUYÊN ĐỊNH HƯỚNG PHÁT TRIỂN LÊN BẬC THPT CHUYÊN NGOẠI NGỮ (CNN)", styles["SectionHeading"])
        )
        elements.append(Paragraph(sec_orient, styles["Body"]))
        elements.append(Spacer(1, 20))

        # Certification signoff
        sign_data = [
            [
                Spacer(1, 1),
                Paragraph("<b>GIÁO VIÊN ĐÁNH GIÁ</b><br/><i>(Ký và lưu hồ sơ điện tử)</i>", styles["UnivHeader"]),
            ],
            [
                Spacer(1, 40),
                Spacer(1, 40),
            ],
            [
                Spacer(1, 1),
                Paragraph("<b>Hệ thống UMS Smart Growth Hub</b>", styles["UnivHeader"]),
            ]
        ]
        elements.append(KeepTogether([Table(sign_data, colWidths=[260, 260])]))

        doc.build(elements, canvasmaker=NumberedCanvas)
        return buffer.getvalue()

    def build_digital_passport(self, student: Dict[str, Any]) -> bytes:
        """Alias for build_passport_pdf conforming to digital passport contract."""
        return self.build_passport_pdf(student)


# Singleton instance
pdf_builder = PDFBuilder()
