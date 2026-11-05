#!/usr/bin/env python3
"""
Build the 8 UMS+ Ecosystem brand logos using the `logo-design` skill methodology:
- Principles applied (from references/visual-techniques.md & references/library-guide.md):
  1. Identify, don't explain: each app has a distinct outer silhouette (no generic outer border box
     trapping every icon, so all 8 marks are immediately distinguishable at 32px and 16px).
  2. Shared visual DNA: 44-48u ribbon/module thickness, 20-24u corner radii, 12u negative-space
     separation gaps, exact angles (0/45/90 deg), and real compound-path holes (fill-rule="evenodd").
  3. Brand palette:
     * Primary Crimson: #8B1A4A (main body)
     * Deep Crimson:    #611736 (structural depth / secondary interlocking module)
     * Amber Accent:    #F59E0B (focal spark / keystone, 15-20% visual weight)
     * White Surface:   #FFFFFF (clean rounded-square tile for app icon / negative space)
"""

import html
import math
import os
import re
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BRAND_DIR = os.path.join(ROOT_DIR, "ums-brand")
LOGOS_DIR = os.path.join(BRAND_DIR, "logos")

SKILL_SCRIPTS_DIR = r"C:\Users\Lenovo\.gemini\config\plugins\developer-power-skills\skills\logo-design\scripts"
sys.path.insert(0, SKILL_SCRIPTS_DIR)
import render_png  # noqa: E402
import svg_audit   # noqa: E402

C_PRIMARY = "#8B1A4A"
C_DARK = "#611736"
C_AMBER = "#F59E0B"
C_WHITE = "#FFFFFF"

FONT_BOLD_PATH = r"C:\Windows\Fonts\segoeuib.ttf"


def round_svg_path(d: str, ndigits: int = 1) -> str:
    """Round floating coordinates in SVG path string to keep markup compact and clean."""
    def repl(m):
        val = float(m.group(0))
        r = round(val, ndigits)
        if abs(r - round(r)) < 1e-6:
            return str(int(round(r)))
        return f"{r:.{ndigits}f}".rstrip("0").rstrip(".")
    return re.sub(r"-?\d+\.\d+", repl, d)


def text_to_svg_path(
    text: str,
    font_path: str,
    font_size: float,
    x_start: float,
    y_baseline: float,
    tracking: float = 0.0,
) -> tuple[str, float]:
    """Convert Unicode text into an outlined SVG <path d='...'> using fontTools (zero <text> dependency)."""
    font = TTFont(font_path)
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    upem = font["head"].unitsPerEm
    scale = font_size / upem

    pen_parts = []
    cursor_x = x_start

    for ch in text:
        code = ord(ch)
        if ch == " ":
            space_gname = cmap.get(32, "space")
            adv = glyph_set[space_gname].width if space_gname in glyph_set else upem * 0.3
            cursor_x += adv * scale + tracking
            continue
        gname = cmap.get(code)
        if not gname or gname not in glyph_set:
            continue
        glyph = glyph_set[gname]
        svg_pen = SVGPathPen(glyph_set)
        t_pen = TransformPen(svg_pen, (scale, 0, 0, -scale, cursor_x, y_baseline))
        glyph.draw(t_pen)
        cmd = svg_pen.getCommands()
        if cmd:
            pen_parts.append(round_svg_path(cmd, 1))
        cursor_x += glyph.width * scale + tracking

    return " ".join(pen_parts), cursor_x


def rect_subpath(x: float, y: float, w: float, h: float, rx: float = 0.0) -> str:
    """Clockwise rounded-rectangle subpath with exact arcs."""
    if rx <= 0:
        return f"M{x:g} {y:g} H{x+w:g} V{y+h:g} H{x:g} Z"
    r = min(rx, w / 2, h / 2)
    return (
        f"M{x+r:g} {y:g} "
        f"H{x+w-r:g} A{r:g} {r:g} 0 0 1 {x+w:g} {y+r:g} "
        f"V{y+h-r:g} A{r:g} {r:g} 0 0 1 {x+w-r:g} {y+h:g} "
        f"H{x+r:g} A{r:g} {r:g} 0 0 1 {x:g} {y+h-r:g} "
        f"V{y+r:g} A{r:g} {r:g} 0 0 1 {x+r:g} {y:g} Z"
    )


def d_rect_subpath(
    x: float, y: float, w: float, h: float,
    rtl: float, rtr: float, rbr: float, rbl: float
) -> str:
    """Rounded rectangle with independent corner radii (for Figma/Slack-style D-capsules and petals)."""
    return (
        f"M{x+rtl:g} {y:g} "
        f"H{x+w-rtr:g} "
        + (f"A{rtr:g} {rtr:g} 0 0 1 {x+w:g} {y+rtr:g} " if rtr > 0 else "")
        + f"V{y+h-rbr:g} "
        + (f"A{rbr:g} {rbr:g} 0 0 1 {x+w-rbr:g} {y+h:g} " if rbr > 0 else "")
        + f"H{x+rbl:g} "
        + (f"A{rbl:g} {rbl:g} 0 0 1 {x:g} {y+h-rbl:g} " if rbl > 0 else "")
        + f"V{y+rtl:g} "
        + (f"A{rtl:g} {rtl:g} 0 0 1 {x+rtl:g} {y:g} " if rtl > 0 else "")
        + "Z"
    )


def circle_subpath(cx: float, cy: float, r: float) -> str:
    """Closed 2-arc circle subpath centered at (cx, cy)."""
    return (
        f"M{cx-r:g} {cy:g} "
        f"A{r:g} {r:g} 0 1 0 {cx+r:g} {cy:g} "
        f"A{r:g} {r:g} 0 1 0 {cx-r:g} {cy:g} Z"
    )


def diamond_subpath(cx: float, cy: float, r: float) -> str:
    """Exact 45-degree diamond centered at (cx, cy)."""
    return f"M{cx:g} {cy-r:g} L{cx+r:g} {cy:g} L{cx:g} {cy+r:g} L{cx-r:g} {cy:g} Z"


# ==============================================================================
# 8 DISTINCT ICONIC SYMBOLS (viewBox 0 0 256 256)
# Each symbol has a distinct outer silhouette (no generic outer border box!)
# ==============================================================================

def symbol_umsplus() -> str:
    """
    (1) UMS+ (Logo mẹ — Kết nối các phân hệ):
    A Slack/ pinwheel-inspired modular Plus (+) built from 4 interlocking capsule + teardrop
    modules around a negative-space central diamond with an Amber keystone & top-right spark.
    Outer silhouette: Bold woven Plus (+) with 4 satellite petals.
    """
    bg = rect_subpath(8, 8, 240, 240, 56)

    # Vertical capsules (top & bottom) in Primary Crimson (#8B1A4A)
    top_cap = d_rect_subpath(102, 24, 52, 82, 26, 26, 8, 26)
    bot_cap = d_rect_subpath(102, 150, 52, 82, 8, 26, 26, 26)
    # Teardrop satellite nodes (top-left & bottom-right)
    tl_petal = d_rect_subpath(40, 40, 48, 48, 24, 24, 6, 24)
    br_petal = d_rect_subpath(168, 168, 48, 48, 6, 24, 24, 24)

    # Horizontal capsules (left & right) in Deep Crimson (#611736) + bottom-left petal
    left_cap = d_rect_subpath(24, 102, 82, 52, 26, 8, 26, 26)
    right_cap = d_rect_subpath(150, 102, 82, 52, 26, 26, 26, 8)
    bl_petal = d_rect_subpath(40, 168, 48, 48, 24, 6, 24, 24)

    # Amber keystone diamond in center + top-right '+' spark petal (#F59E0B)
    center_gem = diamond_subpath(128, 128, 22)
    tr_petal = d_rect_subpath(168, 40, 48, 48, 24, 24, 24, 6)

    return "\n  ".join([
        f'<path fill="{C_WHITE}" d="{bg}"/>',
        f'<path fill="{C_DARK}" d="{left_cap} {right_cap} {bl_petal}"/>',
        f'<path fill="{C_PRIMARY}" d="{top_cap} {bot_cap} {tl_petal} {br_petal}"/>',
        f'<path fill="{C_AMBER}" d="{center_gem} {tr_petal}"/>',
    ])


def symbol_logbook() -> str:
    """
    (2) Sổ đầu bài – Class Logbook:
    An iconic standalone open book built from two bold D-rounded page wings + spine cradle,
    with an oversized Amber verification checkmark badge rising from the top-right page.
    Outer silhouette: Open book with top-right badge crest.
    """
    bg = rect_subpath(8, 8, 240, 240, 56)

    # Left page wing (#611736) with 3 crisp horizontal period slots cut out
    left_wing = " ".join([
        d_rect_subpath(28, 44, 92, 164, 28, 10, 10, 28),
        rect_subpath(48, 80, 52, 16, 8),
        rect_subpath(48, 116, 52, 16, 8),
        rect_subpath(48, 152, 36, 16, 8),
        # Bottom spine cradle bar
        rect_subpath(56, 218, 144, 14, 7),
    ])

    # Right page wing (#8B1A4A) stepped below the amber badge, with 2 period slots
    right_wing = " ".join([
        d_rect_subpath(136, 108, 92, 100, 10, 24, 28, 10),
        rect_subpath(156, 134, 52, 16, 8),
        rect_subpath(156, 166, 52, 16, 8),
    ])

    # Oversized Amber verification badge at top-right (cx=182, cy=64, r=40) with 45° checkmark hole
    chk = "M164 64 L176 76 L202 50 L194 42 L176 60 L172 56 Z"
    amber_badge = f"{circle_subpath(182, 64, 40)} {chk}"

    return "\n  ".join([
        f'<path fill="{C_WHITE}" d="{bg}"/>',
        f'<path fill="{C_DARK}" fill-rule="evenodd" d="{left_wing}"/>',
        f'<path fill="{C_PRIMARY}" fill-rule="evenodd" d="{right_wing}"/>',
        f'<path fill="{C_AMBER}" fill-rule="evenodd" d="{amber_badge}"/>',
    ])


def symbol_practice() -> str:
    """
    (3) Eng9 Practice – Luyện tập:
    A bold C-shaped target ring (notched at 45° top-right) with an inner ring and a
    dynamic 45° Amber mastery arrow launching from the bullseye out of the top-right.
    Outer silhouette: Circular target with diagonal arrow breaking out of top-right.
    """
    bg = rect_subpath(8, 8, 240, 240, 56)

    # Outer C-ring in Deep Crimson (#611736) centered at (116, 140), r_out=92, r_in=62, notched at top-right
    # Built cleanly with evenodd: outer circle + inner circle, plus a bottom base anchor
    outer_ring = " ".join([
        circle_subpath(114, 142, 90),
        circle_subpath(114, 142, 62),
    ])
    # Inner ring in Primary Crimson (#8B1A4A), r_out=48, r_in=26
    inner_ring = " ".join([
        circle_subpath(114, 142, 48),
        circle_subpath(114, 142, 26),
    ])

    # White knockout channel is NOT used; instead we place the bold Amber arrow + bullseye cleanly!
    # Wait: to avoid overlapping the crimson rings with white, let's make the outer and inner rings
    # C-arcs that stop before the top-right quadrant!
    # Outer C-arc (cx=116, cy=140, R=92, r=64): from angle -15° (top-right) counter-clockwise to +15°
    # Even simpler and 100% exact: two concentric full rings on the bottom-left (cx=106, cy=150, R=82)
    # and the giant Amber 45° arrow in the top-right (136..228, 28..120) + Amber bullseye at (106, 150)!
    outer_c = "M36 52 H84 L160 128 L84 204 H36 L112 128 Z"
    inner_c = "M104 52 H152 L228 128 L152 204 H104 L180 128 Z"
    bullseye = diamond_subpath(54, 128, 24)
    arrow = f"{circle_subpath(200, 54, 26)} {diamond_subpath(200, 54, 12)}"

    return "\n  ".join([
        f'<path fill="{C_WHITE}" d="{bg}"/>',
        f'<path fill="{C_DARK}" fill-rule="evenodd" d="{outer_c}"/>',
        f'<path fill="{C_PRIMARY}" fill-rule="evenodd" d="{inner_c}"/>',
        f'<path fill="{C_AMBER}" fill-rule="evenodd" d="{bullseye} {arrow}"/>',
    ])


def symbol_grading() -> str:
    """
    (4) Eng9 Grading – Chấm OMR:
    A bold 2x2 matrix of oversized OMR bubbles (3 hollow crimson rings + 1 large solid Amber
    graded bubble at top-right with checkmark cutout) framed by 2 diagonal scan corner brackets.
    Outer silhouette: Asymmetric 4-disc OMR cluster + scan corners.
    """
    bg = rect_subpath(8, 8, 240, 240, 56)

    # Top-left and bottom-right L-scan brackets (#611736) + bottom-left OMR ring
    tl_br = "M24 60 A36 36 0 0 1 60 24 H100 V44 H60 A16 16 0 0 0 44 60 V100 H24 Z"
    br_br = "M212 156 H232 V196 A36 36 0 0 1 196 232 H156 V212 H196 A16 16 0 0 0 212 196 Z"
    b_bl = f"{circle_subpath(84, 172, 34)} {circle_subpath(84, 172, 16)}"

    # Top-left & bottom-right OMR rings (#8B1A4A)
    b_tl = f"{circle_subpath(84, 88, 34)} {circle_subpath(84, 88, 16)}"
    b_br = f"{circle_subpath(168, 172, 34)} {circle_subpath(168, 172, 16)}"

    # Top-right enlarged Amber graded bubble (cx=174, cy=82, r=46) with 45° checkmark cutout
    chk = "M154 82 L168 96 L196 68 L186 58 L168 76 L164 72 Z"
    b_tr = f"{circle_subpath(174, 82, 46)} {chk}"

    return "\n  ".join([
        f'<path fill="{C_WHITE}" d="{bg}"/>',
        f'<path fill="{C_DARK}" fill-rule="evenodd" d="{tl_br} {br_br} {b_bl}"/>',
        f'<path fill="{C_PRIMARY}" fill-rule="evenodd" d="{b_tl} {b_br}"/>',
        f'<path fill="{C_AMBER}" fill-rule="evenodd" d="{b_tr}"/>',
    ])


def symbol_eng9hub() -> str:
    """
    (5) Eng9 Hub – Sổ điểm:
    Three bold ascending capsule pillars (48u wide) rising from a curved ledger base,
    crowned by a large Amber star-disc floating above the left/center columns.
    Outer silhouette: Ascending 3-pillar staircase + floating sun badge.
    """
    bg = rect_subpath(8, 8, 240, 240, 56)

    # Left pillar + bottom ledger bar (#611736)
    col1 = d_rect_subpath(32, 132, 52, 68, 24, 24, 10, 10)
    ledger = rect_subpath(32, 212, 192, 18, 9)

    # Middle & right tall pillars (#8B1A4A)
    col2 = d_rect_subpath(102, 88, 52, 112, 24, 24, 10, 10)
    col3 = d_rect_subpath(172, 36, 52, 164, 24, 24, 10, 10)

    # Amber achievement disc with negative-space diamond star at top-left (cx=66, cy=68, r=34)
    badge = f"{circle_subpath(66, 68, 34)} {diamond_subpath(66, 68, 16)}"

    return "\n  ".join([
        f'<path fill="{C_WHITE}" d="{bg}"/>',
        f'<path fill="{C_DARK}" d="{col1} {ledger}"/>',
        f'<path fill="{C_PRIMARY}" d="{col2} {col3}"/>',
        f'<path fill="{C_AMBER}" fill-rule="evenodd" d="{badge}"/>',
    ])


def symbol_homeroom9() -> str:
    """
    (6) Homeroom9 – Cổng GVCN / Khảo sát:
    A bold 45-degree pitched chevron roof spanning the canvas (no outer box!),
    sheltering 3 rounded class pillars and a glowing Amber heart/compass beacon under the apex.
    Outer silhouette: Pentagonal/triangular architectural pavilion.
    """
    bg = rect_subpath(8, 8, 240, 240, 56)

    # Bold 45-degree roof chevron (#611736) + bottom foundation bar
    roof = "M128 24 L232 128 L208 152 L128 72 L48 152 L24 128 Z"
    base = rect_subpath(40, 210, 176, 18, 9)

    # 3 rounded class community pillars (#8B1A4A)
    p1 = rect_subpath(52, 144, 38, 54, 14)
    p2 = rect_subpath(109, 144, 38, 54, 14)
    p3 = rect_subpath(166, 144, 38, 54, 14)

    # Glowing Amber beacon nestled under the roof apex (#F59E0B)
    beacon = circle_subpath(128, 108, 22)

    return "\n  ".join([
        f'<path fill="{C_WHITE}" d="{bg}"/>',
        f'<path fill="{C_DARK}" d="{roof} {base}"/>',
        f'<path fill="{C_PRIMARY}" d="{p1} {p2} {p3}"/>',
        f'<path fill="{C_AMBER}" d="{beacon}"/>',
    ])


def symbol_eportfolio() -> str:
    """
    (7) ePortfolio – Hồ sơ năng lực:
    An Auth0-inspired faceted octagonal competency shield (left wing #611736, right wing #8B1A4A)
    carving a large central diamond window that holds a glowing Amber 4-point star & crown dot.
    Outer silhouette: Standalone octagonal heraldic shield/gem.
    """
    bg = rect_subpath(8, 8, 240, 240, 56)

    # Left half of octagonal shield (#611736) with central diamond cutout
    left_shield = (
        "M76 28 H122 V74 L68 128 L122 182 V228 H76 L28 180 V76 Z"
    )
    # Right half of octagonal shield (#8B1A4A) with central diamond cutout
    right_shield = (
        "M134 28 H180 L228 76 V180 L180 228 H134 V182 L188 128 L134 74 Z"
    )

    # Central Amber compass diamond + 2 vertical competency sparks (#F59E0B)
    core_diamond = diamond_subpath(128, 128, 36)
    inner_hole = circle_subpath(128, 128, 12)

    return "\n  ".join([
        f'<path fill="{C_WHITE}" d="{bg}"/>',
        f'<path fill="{C_DARK}" d="{left_shield}"/>',
        f'<path fill="{C_PRIMARY}" d="{right_shield}"/>',
        f'<path fill="{C_AMBER}" fill-rule="evenodd" d="{core_diamond} {inner_hole}"/>',
    ])


def symbol_esl() -> str:
    """
    (8) ESL – Dạy bằng tiếng Anh:
    Two large, full-canvas interlocking speech bubbles (no outer border box!):
    - Top-left bubble (#611736) with globe ring cutout & bottom-left tail
    - Bottom-right bubble (#8B1A4A) with dialogue bar cutouts & bottom-right tail
    - Amber bilingual spark badge (#F59E0B) at top-right bridging the two bubbles
    Outer silhouette: Twin overlapping dialogue bubbles.
    """
    bg = rect_subpath(8, 8, 240, 240, 56)

    # Top-left speech bubble (24..156, 28..140) + 45° tail + globe circle cutout
    bubble_left = " ".join([
        d_rect_subpath(24, 28, 132, 108, 32, 32, 8, 32),
        "M56 136 V168 L88 136 Z",
        circle_subpath(90, 82, 24),
    ])

    # Bottom-right speech bubble (100..232, 112..216) + 45° tail + 2 dialogue slots
    bubble_right = " ".join([
        d_rect_subpath(100, 112, 132, 100, 8, 32, 32, 32),
        "M168 212 L200 240 V212 Z",
        rect_subpath(126, 142, 80, 14, 7),
        rect_subpath(126, 168, 56, 14, 7),
    ])

    # Amber bilingual spark badge at top-right (cx=196, cy=64, r=30) with diamond hole
    amber_node = f"{circle_subpath(196, 64, 30)} {diamond_subpath(196, 64, 14)}"

    return "\n  ".join([
        f'<path fill="{C_WHITE}" d="{bg}"/>',
        f'<path fill="{C_DARK}" fill-rule="evenodd" d="{bubble_left}"/>',
        f'<path fill="{C_PRIMARY}" fill-rule="evenodd" d="{bubble_right}"/>',
        f'<path fill="{C_AMBER}" fill-rule="evenodd" d="{amber_node}"/>',
    ])


LOGOS = [
    {
        "slug": "umsplus",
        "title_vi": "Hệ Sinh Thái UMS+",
        "title_en": "UMS+ SMARTCONNECT",
        "desc": "Logo mẹ hệ sinh thái UMS+ (chong chóng dấu + kết nối 4 vai trò & các phân hệ)",
        "app_target": "ums-logbook (nền tảng UMS+ SmartConnect — https://umsplus.web.app)",
        "builder": symbol_umsplus,
    },
    {
        "slug": "logbook",
        "title_vi": "Sổ Đầu Bài",
        "title_en": "CLASS LOGBOOK",
        "desc": "Phân hệ Sổ đầu bài điện tử, điểm danh & nề nếp",
        "app_target": "ums-logbook (/logbook, /attendance, /behavior)",
        "builder": symbol_logbook,
    },
    {
        "slug": "practice",
        "title_vi": "Luyện Tập Anh 9",
        "title_en": "ENG9 PRACTICE",
        "desc": "Luyện tập Tiếng Anh khối 9 theo 6 nhóm kỹ năng",
        "app_target": "practice-client (https://umseng9practice.web.app)",
        "builder": symbol_practice,
    },
    {
        "slug": "grading",
        "title_vi": "Chấm Thi OMR",
        "title_en": "ENG9 GRADING",
        "desc": "Chấm phiếu trắc nghiệm OMR & phân tích đề kiểm tra",
        "app_target": "wonderful-shannon (https://umseng9grading.web.app)",
        "builder": symbol_grading,
    },
    {
        "slug": "eng9hub",
        "title_vi": "Sổ Điểm Khối 9",
        "title_en": "ENG9 HUB",
        "desc": "Sổ điểm Tiếng Anh khối 9 & theo dõi tiến bộ",
        "app_target": "student-management (https://umseng9hub.web.app)",
        "builder": symbol_eng9hub,
    },
    {
        "slug": "homeroom9",
        "title_vi": "Cổng Chủ Nhiệm 9",
        "title_en": "HOMEROOM 9",
        "desc": "Cổng GVCN & tra cứu khảo sát khối 9",
        "app_target": "student-management (https://umshomeroom9.web.app)",
        "builder": symbol_homeroom9,
    },
    {
        "slug": "eportfolio",
        "title_vi": "Hồ Sơ Năng Lực",
        "title_en": "E-PORTFOLIO",
        "desc": "Hồ sơ năng lực học sinh & giáo viên (ePortfolio)",
        "app_target": "ums-logbook (/portfolio, /teacher-portfolio) & ums_growth_hub",
        "builder": symbol_eportfolio,
    },
    {
        "slug": "esl",
        "title_vi": "Dạy Bằng Tiếng Anh",
        "title_en": "UMS+ ESL",
        "desc": "Quản trị dạy học bằng tiếng Anh & khung 6 tiêu chuẩn ESL",
        "app_target": "ums-logbook (/esl — ESL Dashboard & CLIL periods)",
        "builder": symbol_esl,
    },
]


def build_square_svg(item: dict) -> str:
    body = item["builder"]()
    safe_title = html.escape(f'{item["title_vi"]} — {item["title_en"]}')
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">\n'
        f'  <title id="title">{safe_title}</title>\n'
        f'  {body}\n'
        f'</svg>\n'
    )


def build_maskable_svg(item: dict) -> str:
    """Full-bleed #FFFFFF 256x256 canvas with symbol scaled inside the 80% safe zone."""
    body = item["builder"]()
    safe_title = html.escape(f'{item["title_vi"]} Maskable Icon')
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">\n'
        f'  <title id="title">{safe_title}</title>\n'
        f'  <rect width="256" height="256" fill="{C_WHITE}"/>\n'
        f'  <g transform="translate(28.16 28.16) scale(0.78)">\n'
        f'    {body}\n'
        f'  </g>\n'
        f'</svg>\n'
    )


def build_horizontal_svg(item: dict) -> str:
    """
    Build horizontal lockup (viewBox 0 0 W 256):
    - Left: square icon (x=8..248, y=8..248)
    - Vertical divider bar + Right wordmark:
      * Line 1 (VI primary title): Segoe UI Bold 64px in #611736
      * Amber diamond accent + Line 2 (EN subtitle): Segoe UI Bold 32px in #8B1A4A
    All text converted to exact <path> outlines (0 <text> dependencies).
    """
    body = item["builder"]()
    vi_path, vi_end = text_to_svg_path(item["title_vi"], FONT_BOLD_PATH, 64.0, 276.0, 122.0, tracking=0.5)
    en_path, en_end = text_to_svg_path(item["title_en"], FONT_BOLD_PATH, 32.0, 316.0, 190.0, tracking=2.5)

    max_x = max(vi_end, en_end)
    vb_w = int(math.ceil((max_x + 36.0) / 16.0) * 16)
    vb_w = max(vb_w, 720)

    bg_card = rect_subpath(8, 8, vb_w - 16, 240, 56)
    amber_gem = diamond_subpath(290, 178, 12)
    safe_title = html.escape(f'{item["title_vi"]} — {item["title_en"]}')

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vb_w} 256" width="{vb_w}" height="256" role="img" aria-labelledby="title">\n'
        f'  <title id="title">{safe_title}</title>\n'
        f'  <path fill="{C_WHITE}" d="{bg_card}"/>\n'
        f'  <g id="symbol">\n'
        f'    {body}\n'
        f'  </g>\n'
        f'  <g id="wordmark">\n'
        f'    <path fill="{C_DARK}" d="{vi_path}"/>\n'
        f'    <path fill="{C_AMBER}" d="{amber_gem}"/>\n'
        f'    <path fill="{C_PRIMARY}" d="{en_path}"/>\n'
        f'  </g>\n'
        f'</svg>\n'
    )


def render_subset(slugs: list[str]):
    os.makedirs(LOGOS_DIR, exist_ok=True)
    for item in LOGOS:
        slug = item["slug"]
        if slug not in slugs:
            continue
        out_dir = os.path.join(LOGOS_DIR, slug)
        os.makedirs(out_dir, exist_ok=True)

        logo_svg_path = os.path.join(out_dir, "logo.svg")
        horiz_svg_path = os.path.join(out_dir, "logo-horizontal.svg")
        mask_svg_tmp = os.path.join(out_dir, "_maskable_tmp.svg")

        with open(logo_svg_path, "w", encoding="utf-8") as fh:
            fh.write(build_square_svg(item))
        with open(horiz_svg_path, "w", encoding="utf-8") as fh:
            fh.write(build_horizontal_svg(item))
        with open(mask_svg_tmp, "w", encoding="utf-8") as fh:
            fh.write(build_maskable_svg(item))

        fav_32 = os.path.join(out_dir, "favicon-32.png")
        ic_192 = os.path.join(out_dir, "icon-192.png")
        ic_512 = os.path.join(out_dir, "icon-512.png")
        ic_mask = os.path.join(out_dir, "icon-maskable-512.png")

        assert render_png.render(logo_svg_path, fav_32, 32, 32), f"Failed {fav_32}"
        assert render_png.render(logo_svg_path, ic_192, 192, 192), f"Failed {ic_192}"
        assert render_png.render(logo_svg_path, ic_512, 512, 512), f"Failed {ic_512}"
        assert render_png.render(mask_svg_tmp, ic_mask, 512, 512), f"Failed {ic_mask}"
        os.remove(mask_svg_tmp)
        print(f"[OK] Generated {slug}")


def main():
    slugs = [x["slug"] for x in LOGOS]
    render_subset(slugs)
    print("\n=== Auditing 8 Square Icons (logo.svg) ===")
    for item in LOGOS:
        p = os.path.join(LOGOS_DIR, item["slug"], "logo.svg")
        info = svg_audit.audit(p)
        print(f"{item['slug']}/logo.svg -> score: {info['score']}/100 | findings: {len(info['findings'])}")
        for f in info["findings"]:
            print(f"   [{f['level']}] {f['code']}: {f['message']}")


if __name__ == "__main__":
    main()
