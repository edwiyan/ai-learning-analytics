"""Academic Performance & Early Intervention report: on-screen preview and PDF / Excel export.

Scope follows the viewer's role (see services/reports/data.py); filters narrow it further
by college, program, curriculum, section or course.
"""
import re
import uuid

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.core.audit import log_action
from backend.core.database import get_db
from backend.core.deps import require_role
from backend.core.limiter import limiter
from backend.models.user import User, UserRole
from backend.services.reports.data import ReportFilters, build_report
from backend.services.reports.pdf import render_pdf
from backend.services.reports.xlsx import render_xlsx

router = APIRouter(prefix="/reports", tags=["reports"])

REPORT_ROLES = (UserRole.admin, UserRole.vp_academic_affairs, UserRole.dean,
                UserRole.program_director, UserRole.instructor)


def _filters(
    college: str | None = Query(None),
    program: str | None = Query(None),
    curriculum_id: uuid.UUID | None = Query(None),
    section: str | None = Query(None),
    course_id: uuid.UUID | None = Query(None),
) -> ReportFilters:
    return ReportFilters(college=college, program=program, curriculum_id=curriculum_id,
                         section=section, course_id=course_id)


@router.get("/options")
def report_options(db: Session = Depends(get_db), current_user: User = Depends(require_role(*REPORT_ROLES))):
    """Filter values that have data in the viewer's scope."""
    data = build_report(db, current_user, ReportFilters())
    rows = data["rows"]
    curricula = {r["curriculum_id"]: r["curriculum"] for r in rows if r["curriculum_id"]}
    courses = {r["course_id"]: f"{r['course']} — {r['course_title']} ({r['instructor']})" for r in rows}
    return {
        "scope": data["scope"],
        "colleges": sorted({r["college"] for r in rows}),
        "programs": sorted({r["program"] for r in rows}),
        "curricula": [{"id": k, "name": v} for k, v in sorted(curricula.items(), key=lambda kv: kv[1])],
        "sections": sorted({r["section"] for r in rows}),
        "courses": [{"id": k, "name": v} for k, v in sorted(courses.items(), key=lambda kv: kv[1])],
    }


@router.get("/academic-performance")
def report_preview(
    filters: ReportFilters = Depends(_filters),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*REPORT_ROLES)),
):
    data = build_report(db, current_user, filters)
    rows = data["rows"]
    slim = ("name", "student_number", "program", "curriculum", "section", "year_level", "course", "course_title",
            "avg_score", "gap_count", "risk_level", "reason", "weak_topics", "intervention")
    return {
        "title": data["title"],
        "scope": data["scope"],
        "filters": data["filters"],
        "academic_periods": data["academic_periods"],
        "generated_at": data["generated_at"].isoformat(),
        "summary": data["summary"],
        "breakdowns": data["breakdowns"],
        "competency_gaps": data["competency_gaps"][:15],
        "interventions": data["interventions"],
        "early_warning": data["early_warning"]["summary"],
        "at_risk": [{k: r[k] for k in slim} for r in rows if r["risk_level"] == "At-Risk"],
        "excelling": [{k: r[k] for k in slim} for r in rows if r["risk_level"] == "Excelling"],
    }


@router.get("/academic-performance/export")
@limiter.limit("10/minute")
def report_export(
    request: Request,
    format: str = Query("pdf", pattern="^(pdf|xlsx)$"),
    filters: ReportFilters = Depends(_filters),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(*REPORT_ROLES)),
):
    data = build_report(db, current_user, filters)
    stamp = data["generated_at"].strftime("%Y%m%d")
    scope = re.sub(r"[^A-Za-z0-9]+", "_", data["scope"]).strip("_")[:40] or "Report"
    if format == "pdf":
        body, media = render_pdf(data), "application/pdf"
    else:
        body = render_xlsx(data)
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    filename = f"AILAS_Academic_Performance_Report_{scope}_{stamp}.{format}"
    log_action(db, str(current_user.id), "export_report", target_table="reports",
               extra={"format": format, "scope": data["scope"], "filters": dict(data["filters"]),
                      "enrolments": data["summary"]["total"]})
    return Response(content=body, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})
