"""Render the Academic Performance & Early Intervention report as a formal PDF."""
from io import BytesIO
from zoneinfo import ZoneInfo

from reportlab.graphics.charts.barcharts import HorizontalBarChart
from reportlab.graphics.charts.doughnut import Doughnut
from reportlab.graphics.shapes import Drawing, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import (
    BaseDocTemplate, CondPageBreak, Frame, KeepTogether, NextPageTemplate, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
)


PH_TZ = ZoneInfo("Asia/Manila")
PAGE_W, PAGE_H = A4
MARGIN = 18 * mm
CONTENT_W = PAGE_W - 2 * MARGIN

NAVY = colors.HexColor("#1E1B4B")
INDIGO = colors.HexColor("#4338CA")
INK = colors.HexColor("#1F2937")
MUTED = colors.HexColor("#6B7280")
RULE = colors.HexColor("#E5E7EB")
ZEBRA = colors.HexColor("#F8FAFC")
RISK_COLORS = {
    "At-Risk": colors.HexColor("#DC2626"),
    "On-Track": colors.HexColor("#D97706"),
    "Excelling": colors.HexColor("#059669"),
}
RISK_TINTS = {
    "At-Risk": colors.HexColor("#FEE2E2"),
    "On-Track": colors.HexColor("#FEF3C7"),
    "Excelling": colors.HexColor("#D1FAE5"),
}

_base = getSampleStyleSheet()
S = {
    "h1": ParagraphStyle("h1", parent=_base["Heading1"], fontName="Helvetica-Bold", fontSize=15,
                         textColor=NAVY, spaceBefore=12, spaceAfter=6, leading=19),
    "h2": ParagraphStyle("h2", parent=_base["Heading2"], fontName="Helvetica-Bold", fontSize=11.5,
                         textColor=INDIGO, spaceBefore=10, spaceAfter=4, leading=14),
    "body": ParagraphStyle("body", parent=_base["BodyText"], fontName="Helvetica", fontSize=9.5,
                           textColor=INK, leading=13.5, spaceAfter=5),
    "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8, textColor=MUTED, leading=10.5),
    "cell": ParagraphStyle("cell", fontName="Helvetica", fontSize=8, textColor=INK, leading=10),
    "cell_b": ParagraphStyle("cell_b", fontName="Helvetica-Bold", fontSize=8, textColor=INK, leading=10),
    "cell_r": ParagraphStyle("cell_r", fontName="Helvetica", fontSize=8, textColor=INK, leading=10, alignment=TA_RIGHT),
    "th": ParagraphStyle("th", fontName="Helvetica-Bold", fontSize=8, textColor=colors.white, leading=10),
    "th_r": ParagraphStyle("th_r", fontName="Helvetica-Bold", fontSize=8, textColor=colors.white, leading=10,
                           alignment=TA_RIGHT),
    "kpi_v": ParagraphStyle("kpi_v", fontName="Helvetica-Bold", fontSize=20, leading=23, alignment=TA_CENTER),
    "kpi_l": ParagraphStyle("kpi_l", fontName="Helvetica", fontSize=7.5, textColor=MUTED, leading=9.5,
                            alignment=TA_CENTER),
}


def _esc(text) -> str:
    return (str(text) if text is not None else "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _fmt_pct(v):
    return "—" if v is None else f"{v:.1f}%"


class _NumberedCanvas(rl_canvas.Canvas):
    """Defers page output so every footer can say 'Page x of y'."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved = []

    def showPage(self):
        self._saved.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._saved)
        for state in self._saved:
            self.__dict__.update(state)
            if self._pageNumber > 1:
                self.setFont("Helvetica", 7.5)
                self.setFillColor(MUTED)
                self.drawRightString(PAGE_W - MARGIN, 10 * mm, f"Page {self._pageNumber} of {total}")
            super().showPage()
        super().save()


def _table(header, rows, widths, numeric_cols=(), risk_col=None, zebra=True):
    data = [[Paragraph(_esc(h), S["th_r"] if i in numeric_cols else S["th"]) for i, h in enumerate(header)]]
    for row in rows:
        data.append([
            c if not isinstance(c, (str, int, float)) and c is not None
            else Paragraph(_esc(c), S["cell_r"] if i in numeric_cols else S["cell"])
            for i, c in enumerate(row)
        ])
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, RULE),
    ]
    if zebra:
        for r in range(1, len(data)):
            if r % 2 == 0:
                style.append(("BACKGROUND", (0, r), (-1, r), ZEBRA))
    if risk_col is not None:
        for r, row in enumerate(rows, start=1):
            level = row[risk_col] if isinstance(row[risk_col], str) else None
            if level in RISK_TINTS:
                style.append(("BACKGROUND", (risk_col, r), (risk_col, r), RISK_TINTS[level]))
                style.append(("TEXTCOLOR", (risk_col, r), (risk_col, r), RISK_COLORS[level]))
    t.setStyle(TableStyle(style))
    return t


def _kpi_tiles(summary):
    tiles = [
        (str(summary["students"]), "Students assessed", INK),
        (str(summary["total"]), "Course enrolments", INK),
        (f"{summary['at_risk']}", f"At-Risk ({summary['at_risk_pct']:.1f}%)", RISK_COLORS["At-Risk"]),
        (f"{summary['on_track']}", f"On-Track ({summary['on_track_pct']:.1f}%)", RISK_COLORS["On-Track"]),
        (f"{summary['excelling']}", f"Excelling ({summary['excelling_pct']:.1f}%)", RISK_COLORS["Excelling"]),
        (_fmt_pct(summary["avg_score"]), "Average score", INDIGO),
    ]
    cells = []
    for value, label, color in tiles:
        v = ParagraphStyle("v", parent=S["kpi_v"], textColor=color)
        cells.append([Paragraph(_esc(value), v), Paragraph(_esc(label), S["kpi_l"])])
    w = CONTENT_W / len(tiles)
    t = Table([[Table([[c[0]], [c[1]]], colWidths=[w - 6]) for c in cells]], colWidths=[w] * len(tiles))
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, RULE),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, RULE),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAFAFF")),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def _donut(summary, size=150):
    d = Drawing(size + 140, size)
    values = [summary["at_risk"], summary["on_track"], summary["excelling"]]
    if sum(values) == 0:
        d.add(String(10, size / 2, "No data", fontName="Helvetica", fontSize=9, fillColor=MUTED))
        return d
    ch = Doughnut()
    ch.x, ch.y, ch.width, ch.height = 5, 5, size - 10, size - 10
    ch.data = [v if v else 0.0001 for v in values]
    ch.innerRadiusFraction = 0.58
    ch.slices.strokeColor = colors.white
    ch.slices.strokeWidth = 1.5
    for i, level in enumerate(["At-Risk", "On-Track", "Excelling"]):
        ch.slices[i].fillColor = RISK_COLORS[level]
    d.add(ch)
    d.add(String(size / 2, size / 2 + 2, str(summary["total"]), fontName="Helvetica-Bold", fontSize=16,
                 fillColor=INK, textAnchor="middle"))
    d.add(String(size / 2, size / 2 - 11, "enrolments", fontName="Helvetica", fontSize=7,
                 fillColor=MUTED, textAnchor="middle"))
    y = size - 40
    for level, key in (("At-Risk", "at_risk"), ("On-Track", "on_track"), ("Excelling", "excelling")):
        from reportlab.graphics.shapes import Rect
        d.add(Rect(size + 8, y, 9, 9, fillColor=RISK_COLORS[level], strokeColor=None))
        d.add(String(size + 22, y + 1.5, f"{level}: {summary[key]} ({summary[key + '_pct']:.1f}%)",
                     fontName="Helvetica", fontSize=8.5, fillColor=INK))
        y -= 18
    return d


def _stacked_bars(groups, title, max_groups=12):
    groups = groups[:max_groups]
    if not groups:
        return Spacer(1, 1)
    bar_h = 15
    h = len(groups) * bar_h + 50
    d = Drawing(CONTENT_W, h)
    ch = HorizontalBarChart()
    ch.x, ch.y = 120, 28
    ch.width, ch.height = CONTENT_W - 150, len(groups) * bar_h
    # Percent of each group's enrolments, stacked
    ch.data = [
        [g["at_risk_pct"] for g in groups],
        [g["on_track_pct"] for g in groups],
        [g["excelling_pct"] for g in groups],
    ]
    ch.categoryAxis.categoryNames = [g["group"][:28] for g in groups]
    ch.categoryAxis.style = "stacked"
    ch.categoryAxis.labels.fontName = "Helvetica"
    ch.categoryAxis.labels.fontSize = 7.5
    ch.categoryAxis.labels.dx = -4
    ch.categoryAxis.reverseDirection = True
    ch.valueAxis.valueMin, ch.valueAxis.valueMax, ch.valueAxis.valueStep = 0, 100, 25
    ch.valueAxis.labels.fontSize = 7
    ch.valueAxis.labels.fontName = "Helvetica"
    ch.valueAxis.labelTextFormat = "%d%%"
    ch.valueAxis.gridStrokeColor = RULE
    ch.valueAxis.visibleGrid = True
    ch.barSpacing = 0
    ch.groupSpacing = 4
    for i, level in enumerate(["At-Risk", "On-Track", "Excelling"]):
        ch.bars[i].fillColor = RISK_COLORS[level]
        ch.bars[i].strokeColor = colors.white
        ch.bars[i].strokeWidth = 0.5
    d.add(ch)
    d.add(String(0, h - 10, title, fontName="Helvetica-Bold", fontSize=8.5, fillColor=INK))
    return d


def _breakdown_table(groups, label):
    header = [label, "Enrolments", "At-Risk", "On-Track", "Excelling", "At-Risk %", "Avg score"]
    rows = [[g["group"], g["total"], g["at_risk"], g["on_track"], g["excelling"], _fmt_pct(g["at_risk_pct"]),
             _fmt_pct(g["avg_score"])] for g in groups]
    w = CONTENT_W
    return _table(header, rows, [w * 0.34, w * 0.11, w * 0.1, w * 0.11, w * 0.11, w * 0.11, w * 0.12],
                  numeric_cols=(1, 2, 3, 4, 5, 6))


def _narrative(data) -> list:
    s = data["summary"]
    MASTERY_THRESHOLD = data["thresholds"].mastery_threshold
    out = []
    if not s["total"]:
        return [Paragraph("No assessment results were found for the selected scope and filters.", S["body"])]
    out.append(Paragraph(
        f"This report covers <b>{s['students']}</b> student{'s' if s['students'] != 1 else ''} across "
        f"<b>{s['courses']}</b> course{'s' if s['courses'] != 1 else ''} ({s['total']} course enrolments). "
        f"<b>{s['at_risk']}</b> enrolment{'s are' if s['at_risk'] != 1 else ' is'} flagged <b>At-Risk</b> "
        f"({s['at_risk_pct']:.1f}%), involving <b>{s['students_flagged']}</b> distinct student"
        f"{'s' if s['students_flagged'] != 1 else ''}; {s['excelling']} ({s['excelling_pct']:.1f}%) are "
        f"<b>Excelling</b> and {s['on_track']} ({s['on_track_pct']:.1f}%) are <b>On-Track</b>. "
        f"The average score across all enrolments is {_fmt_pct(s['avg_score'])}.", S["body"]))
    sections = [g for g in data["breakdowns"]["Section"] if g["group"] != "Unassigned" and g["at_risk"]]
    if sections:
        top = sections[0]
        out.append(Paragraph(
            f"The section with the highest At-Risk rate is <b>{_esc(top['group'])}</b> "
            f"({top['at_risk']} of {top['total']} enrolments, {top['at_risk_pct']:.1f}%).", S["body"]))
    gaps = [g for g in data["competency_gaps"] if g["below"]]
    if gaps:
        g = gaps[0]
        out.append(Paragraph(
            f"The most widespread learning gap is <b>{_esc(g['code'])} {_esc(g['topic'])}</b> in "
            f"{_esc(g['course'])}: {g['below']} of {g['students']} students ({g['below_pct']:.1f}%) are below "
            f"the {MASTERY_THRESHOLD:.0f}% mastery threshold (average mastery {g['avg_mastery']:.1f}%).", S["body"]))
    iv = data["interventions"]
    if iv["at_risk"]:
        out.append(Paragraph(
            f"Interventions have been logged for <b>{iv['with_intervention']}</b> of {iv['at_risk']} At-Risk "
            f"enrolments ({_fmt_pct(iv['coverage_pct'])}); <b>{iv['without_intervention']}</b> still need follow-up.",
            S["body"]))
    return out


def render_pdf(data: dict) -> bytes:
    buf = BytesIO()
    generated = data["generated_at"].astimezone(PH_TZ)

    def cover(c, _doc):
        c.saveState()
        c.setFillColor(NAVY)
        c.rect(0, PAGE_H - 95 * mm, PAGE_W, 95 * mm, stroke=0, fill=1)
        c.setFillColor(INDIGO)
        c.rect(0, PAGE_H - 98 * mm, PAGE_W, 3 * mm, stroke=0, fill=1)
        c.setFillColor(colors.HexColor("#C7D2FE"))
        c.setFont("Helvetica", 9.5)
        c.drawString(MARGIN, PAGE_H - 22 * mm, data["institution"].upper())
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 25)
        c.drawString(MARGIN, PAGE_H - 45 * mm, "Academic Performance and")
        c.drawString(MARGIN, PAGE_H - 56 * mm, "Early Intervention Report")
        c.setFont("Helvetica", 11)
        c.setFillColor(colors.HexColor("#E0E7FF"))
        c.drawString(MARGIN, PAGE_H - 68 * mm, data["scope"])
        c.setFont("Helvetica", 8.5)
        c.drawString(MARGIN, PAGE_H - 84 * mm,
                     "AI-Assisted Learning Analytics System (AILAS) · Rule-based risk engine")
        c.setFont("Helvetica", 7.5)
        c.setFillColor(MUTED)
        c.drawString(MARGIN, 14 * mm, "CONFIDENTIAL — Contains student information protected under the Data Privacy Act "
                                      "of 2012 (RA 10173). For authorized academic use only.")
        c.restoreState()

    def later(c, _doc):
        c.saveState()
        c.setStrokeColor(RULE)
        c.setLineWidth(0.6)
        c.line(MARGIN, PAGE_H - 13 * mm, PAGE_W - MARGIN, PAGE_H - 13 * mm)
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(NAVY)
        c.drawString(MARGIN, PAGE_H - 11 * mm, "AILAS · Academic Performance and Early Intervention Report")
        c.setFont("Helvetica", 7.5)
        c.setFillColor(MUTED)
        c.drawRightString(PAGE_W - MARGIN, PAGE_H - 11 * mm, data["scope"])
        c.line(MARGIN, 14 * mm, PAGE_W - MARGIN, 14 * mm)
        c.drawString(MARGIN, 10 * mm, f"Confidential (RA 10173) · Generated {generated:%d %B %Y, %I:%M %p} PHT")
        c.restoreState()

    doc = BaseDocTemplate(buf, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=20 * mm,
                          bottomMargin=20 * mm, title=data["title"], author="AILAS",
                          subject=f"{data['institution']} — {data['scope']}")
    doc.addPageTemplates([
        PageTemplate("cover", [Frame(MARGIN, 22 * mm, CONTENT_W, PAGE_H - 125 * mm, id="c")], onPage=cover),
        PageTemplate("body", [Frame(MARGIN, 18 * mm, CONTENT_W, PAGE_H - 36 * mm, id="b")], onPage=later),
    ])

    s = data["summary"]
    t = data["thresholds"]
    MASTERY_THRESHOLD, GRADE_DECLINE_THRESHOLD = t.mastery_threshold, t.grade_decline_pct
    story = []

    # ── Cover details ──
    meta = [
        ["Prepared for", data["prepared_for"]],
        ["Report scope", data["scope"]],
        ["Academic period", ", ".join(data["academic_periods"]) or "—"],
        ["Generated", f"{generated:%d %B %Y, %I:%M %p} (Philippine Time)"],
    ]
    for label, value in data["filters"]:
        meta.append([f"Filter: {label}", value])
    mt = Table([[Paragraph(_esc(a), S["cell_b"]), Paragraph(_esc(b), S["cell"])] for a, b in meta],
               colWidths=[42 * mm, CONTENT_W - 42 * mm])
    mt.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE), ("TOPPADDING", (0, 0), (-1, -1), 5),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    story += [Paragraph("Report details", S["h2"]), mt, Spacer(1, 8 * mm),
              Paragraph("At a glance", S["h2"]), _kpi_tiles(s), Spacer(1, 6 * mm)]
    contents = ["1. Executive Summary", "2. Risk Distribution by College, Program and Curriculum",
                "3. Risk Distribution by Year Level and Section", "4. Risk Distribution by Course",
                "5. Competency Gap Analysis", "6. At-Risk Students", "7. Excelling Students",
                "8. Intervention Status", "9. Section Rosters by Curriculum", "10. Methodology and Definitions"]
    story += [Paragraph("Contents", S["h2"])] + [Paragraph(c, S["body"]) for c in contents]
    story += [NextPageTemplate("body"), PageBreak()]

    # ── 1. Executive summary ──
    story += [Paragraph("1. Executive Summary", S["h1"])] + _narrative(data)
    story += [Spacer(1, 3 * mm), _donut(s), Spacer(1, 3 * mm)]
    by_college = data["breakdowns"]["College"]
    if by_college:
        story.append(_stacked_bars(by_college, "Risk mix by college (% of enrolments)"))
    by_course = [dict(g, group=g["group"].split(" — ")[0] + " · " + g["group"].rsplit("(", 1)[-1].rstrip(")"))
                 for g in data["breakdowns"]["Course"]]
    if by_course:
        story += [Spacer(1, 4 * mm), _stacked_bars(by_course, "Risk mix by course (% of enrolments)")]

    # ── 2–4. Breakdowns ──
    story += [PageBreak(), Paragraph("2. Risk Distribution by College, Program and Curriculum", S["h1"]),
              Paragraph("Counts are course enrolments (one student in two courses counts twice). Groups are "
                        "ordered by At-Risk rate.", S["small"])]
    for key in ("College", "Program", "Curriculum"):
        story += [Paragraph(f"By {key.lower()}", S["h2"]), _breakdown_table(data["breakdowns"][key], key)]
    story += [CondPageBreak(90 * mm), Paragraph("3. Risk Distribution by Year Level and Section", S["h1"])]
    story += [Paragraph("By year level", S["h2"]), _breakdown_table(data["breakdowns"]["Year Level"], "Year level")]
    story += [Paragraph("By section", S["h2"]), _breakdown_table(data["breakdowns"]["Section"], "Section"),
              Spacer(1, 4 * mm), _stacked_bars(data["breakdowns"]["Section"], "Risk mix by section (% of enrolments)")]
    story += [CondPageBreak(80 * mm), Paragraph("4. Risk Distribution by Course", S["h1"]),
              _breakdown_table(data["breakdowns"]["Course"], "Course (instructor)")]

    # ── 5. Competency gaps ──
    story += [PageBreak(), Paragraph("5. Competency Gap Analysis", S["h1"]),
              Paragraph(f"Competency Mastery Score (CMS) = total points earned ÷ total points possible on the items "
                        f"mapped to the competency. A competency below {MASTERY_THRESHOLD:.0f}% is a learning gap. "
                        "Ordered by the share of students below the threshold.", S["small"]), Spacer(1, 2 * mm)]
    gaps = data["competency_gaps"]
    if gaps:
        w = CONTENT_W
        story.append(_table(
            ["Course", "Code", "Competency", "Students", "Avg mastery", "Below 75%", "% below"],
            [[g["course"], g["code"], g["topic"], g["students"], _fmt_pct(g["avg_mastery"]), g["below"],
              _fmt_pct(g["below_pct"])] for g in gaps],
            [w * 0.11, w * 0.1, w * 0.37, w * 0.1, w * 0.11, w * 0.1, w * 0.11], numeric_cols=(3, 4, 5, 6)))
    else:
        story.append(Paragraph("No competency-level results are available.", S["body"]))

    # ── 6. At-Risk roster ──
    at_risk = [r for r in data["rows"] if r["risk_level"] == "At-Risk"]
    story += [PageBreak(), Paragraph("6. At-Risk Students", S["h1"]),
              Paragraph(f"Flagged by the rule-based engine: {t.at_risk_min_gaps} or more competencies below {MASTERY_THRESHOLD:.0f}% "
                        f"mastery, or a grade decline greater than {GRADE_DECLINE_THRESHOLD:.0f}% between the two most "
                        "recent grading periods.", S["small"]), Spacer(1, 2 * mm)]
    if at_risk:
        w = CONTENT_W
        story.append(_table(
            ["Student", "Program / Section", "Course", "Avg", "Why flagged", "Weakest competencies", "Intervention"],
            [[Paragraph(f"<b>{_esc(r['name'])}</b><br/>{_esc(r['student_number'])}", S["cell"]),
              Paragraph(f"{_esc(r['program'])}<br/>{_esc(r['section'])}", S["cell"]),
              r["course"], _fmt_pct(r["avg_score"]), r["reason"],
              Paragraph("<br/>".join(_esc(t) for t in r["weak_topics"]) or "—", S["cell"]),
              (r["intervention"] or "None logged").capitalize()] for r in at_risk],
            [w * 0.15, w * 0.17, w * 0.09, w * 0.07, w * 0.16, w * 0.24, w * 0.12], numeric_cols=(3,)))
    else:
        story.append(Paragraph("No students are currently At-Risk in this scope.", S["body"]))

    # ── 7. Excelling ──
    excelling = [r for r in data["rows"] if r["risk_level"] == "Excelling"]
    story += [CondPageBreak(60 * mm), Paragraph("7. Excelling Students", S["h1"]),
              Paragraph(f"Average of {t.excelling_avg:.0f}% or higher with no competency below the mastery threshold.", S["small"]),
              Spacer(1, 2 * mm)]
    if excelling:
        w = CONTENT_W
        story.append(_table(
            ["Student", "Student no.", "Program", "Section", "Course", "Avg score"],
            [[r["name"], r["student_number"], r["program"], r["section"], r["course"], _fmt_pct(r["avg_score"])]
             for r in excelling],
            [w * 0.22, w * 0.13, w * 0.3, w * 0.12, w * 0.11, w * 0.12], numeric_cols=(5,)))
    else:
        story.append(Paragraph("No students are Excelling in this scope.", S["body"]))

    # ── 8. Interventions ──
    iv = data["interventions"]
    story += [CondPageBreak(60 * mm), Paragraph("8. Intervention Status", S["h1"])]
    status_rows = [["At-Risk enrolments", iv["at_risk"]], ["With an intervention logged", iv["with_intervention"]],
                   ["Without an intervention", iv["without_intervention"]],
                   ["Coverage", _fmt_pct(iv["coverage_pct"])]]
    status_rows += [[f"Latest status: {k}", v] for k, v in sorted(iv["by_status"].items())]
    story.append(_table(["Measure", "Value"], status_rows, [CONTENT_W * 0.6, CONTENT_W * 0.4], numeric_cols=(1,)))
    ew = data["early_warning"]["summary"]
    story += [Paragraph("Early-warning timeliness", S["h2"]),
              Paragraph(f"An At-Risk flag raised in the {ew['early_period']} period (before the Midterm examination) counts "
                        f"as early; the target is an intervention within {ew['target_school_days']} school days of the "
                        "alert.", S["small"]), Spacer(1, 2 * mm)]
    story.append(_table(["Measure", "Value"], [
        ["Students ever flagged At-Risk (enrolments)", ew["flagged"]],
        [f"First flagged in the {ew['early_period']} period", f"{ew['flagged_early']} ({_fmt_pct(ew['flagged_early_pct'])})"],
        ["Intervention logged after the first flag", ew["with_intervention"]],
        ["Median school days from alert to intervention",
         "—" if ew["median_school_days_to_intervention"] is None else ew["median_school_days_to_intervention"]],
        [f"Intervention within {ew['target_school_days']} school days", f"{ew['within_target']} ({_fmt_pct(ew['within_target_pct'])})"],
        ["Currently overdue (no intervention past the target)", ew["overdue"]],
    ], [CONTENT_W * 0.6, CONTENT_W * 0.4], numeric_cols=(1,)))
    pending = [r for r in at_risk if not r["intervention_count"]]
    if pending:
        story += [Paragraph("At-Risk students awaiting an intervention", S["h2"]),
                  _table(["Student", "Course", "Instructor", "Why flagged"],
                         [[r["name"], r["course"], r["instructor"], r["reason"]] for r in pending],
                         [CONTENT_W * 0.25, CONTENT_W * 0.15, CONTENT_W * 0.25, CONTENT_W * 0.35])]

    # ── 9. Methodology ──
    defs = [
        ("At-Risk", f"{t.at_risk_min_gaps} or more competencies with mastery below {MASTERY_THRESHOLD:.0f}%, OR a grade decline greater "
                    f"than {GRADE_DECLINE_THRESHOLD:.0f}% between the two most recent grading periods."),
        ("Excelling", f"Average score of {t.excelling_avg:.0f}% or higher and no competency below the mastery threshold."),
        ("Threshold source", "Institutionally defined operational thresholds, set by BTECH in AILAS Institution Settings"
                             + (f" (last changed {data['thresholds_updated_at']:%d %B %Y})." if data.get("thresholds_updated_at")
                                else " (system defaults; not yet changed).")),
        ("On-Track", "Neither At-Risk nor Excelling."),
        ("Competency Mastery Score", "Total points earned ÷ total points possible on the assessment items mapped to the "
                                     "competency, × 100."),
        ("Grade decline", "(previous period average − current period average) ÷ previous period average × 100."),
        ("Data sources", "Assessment results uploaded by faculty after Program Director approval; competencies from the "
                         "endorsed syllabus; question-to-competency mapping by GPT-4o-mini, validated by faculty."),
        ("Scope of the flag", "Attendance and submission timeliness are recorded for context but do not drive the risk "
                              "flag (capstone Delimitation 2). The engine is deterministic; no predictive model is trained."),
        ("Privacy", "Student identifiers are stored as salted SHA-256 hashes; names appear only in reports generated "
                    "for authorized faculty and administrators. Handle and dispose of this document per RA 10173."),
    ]
    # ── 9. Section rosters ──
    story += [PageBreak(), Paragraph("9. Section Rosters by Curriculum", S["h1"]),
              Paragraph("Every assessed enrolment, grouped by the student's curriculum and section.", S["small"])]
    by_section = {}
    for r in data["rows"]:
        by_section.setdefault((r["curriculum"], r["section"]), []).append(r)
    current_curriculum = None
    for (curriculum, section), rs in sorted(by_section.items(), key=lambda kv: (kv[0][0] == "No enrolment record", kv[0])):
        if curriculum != current_curriculum:
            story.append(CondPageBreak(45 * mm))
            story.append(Paragraph(_esc(curriculum), S["h2"]))
            current_curriculum = curriculum
        c = {lvl: sum(1 for r in rs if r["risk_level"] == lvl) for lvl in ("At-Risk", "On-Track", "Excelling")}
        rs = sorted(rs, key=lambda r: (("At-Risk", "On-Track", "Excelling").index(r["risk_level"])
                                       if r["risk_level"] in c else 9, r["name"], r["course"]))
        w = CONTENT_W
        story.append(KeepTogether([
            Paragraph(f"<b>{_esc(section)}</b> · {_esc(rs[0]['year_level'])} — {len(rs)} enrolment"
                      f"{'s' if len(rs) != 1 else ''}: {c['At-Risk']} At-Risk, {c['On-Track']} On-Track, "
                      f"{c['Excelling']} Excelling", S["body"]),
            _table(["Student", "Student no.", "Course", "Avg score", "Gaps", "Status"],
                   [[r["name"], r["student_number"], r["course"], _fmt_pct(r["avg_score"]), r["gap_count"],
                     r["risk_level"]] for r in rs],
                   [w * 0.28, w * 0.15, w * 0.14, w * 0.13, w * 0.1, w * 0.2], numeric_cols=(3, 4), risk_col=5),
            Spacer(1, 3 * mm),
        ]))

    story += [PageBreak(), Paragraph("10. Methodology and Definitions", S["h1"]),
              KeepTogether(_table(["Term", "Definition"], [[a, b] for a, b in defs],
                                  [CONTENT_W * 0.24, CONTENT_W * 0.76], zebra=False))]

    doc.build(story, canvasmaker=_NumberedCanvas)
    return buf.getvalue()
