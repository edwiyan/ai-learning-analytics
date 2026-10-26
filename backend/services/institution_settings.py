"""Institution-defined operational thresholds (panel comment 2).

The capstone's thresholds (75% mastery, 3 learning gaps, 15% grade decline, ...) are
institutional decisions, not values taken from the literature, so BTECH can review and
change them here instead of in code. Values live in the institution_settings table;
anything not stored there uses DEFAULTS. Reads are cached on the SQLAlchemy session
(one query per request/session); writes clear that cache.
"""
from dataclasses import asdict, dataclass, fields
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.models.institution_setting import InstitutionSetting


@dataclass(frozen=True)
class InstitutionSettings:
    mastery_threshold: float = 75.0           # competency below this = learning gap
    at_risk_min_gaps: int = 3                 # At-Risk when gaps >= this ...
    grade_decline_pct: float = 15.0           # ... or decline between periods > this
    excelling_avg: float = 85.0               # Excelling: average >= this and no gaps
    proficient_threshold: float = 85.0        # competency mastery level "Proficient"
    mapping_review_threshold: float = 0.75    # AI confidence below this = priority review
    mapping_auto_accept: bool = False         # pilot: every AI mapping needs faculty confirmation
    early_warning_period: str = "prelim"      # flagged in this grading period = "early" (before Midterm)
    intervention_target_school_days: int = 5  # alert -> intervention target


DEFAULTS = InstitutionSettings()

# key -> (label, description, min, max) for validation and the settings page
SPEC = {
    "mastery_threshold": ("Mastery threshold (%)", "A competency below this mastery is a learning gap.", 50, 100),
    "at_risk_min_gaps": ("Learning gaps for At-Risk", "At-Risk when a student has at least this many learning gaps.", 1, 10),
    "grade_decline_pct": ("Grade decline for At-Risk (%)", "At-Risk when the average drops by more than this between the two most recent grading periods.", 1, 100),
    "excelling_avg": ("Excelling average (%)", "Excelling when the average is at least this and there are no learning gaps.", 50, 100),
    "proficient_threshold": ("Proficient mastery (%)", "Competency mastery level 'Proficient' starts here; 'Developing' is between the mastery threshold and this.", 50, 100),
    "mapping_review_threshold": ("AI mapping review threshold", "AI mappings with a self-reported confidence below this are flagged for priority review.", 0, 1),
    "mapping_auto_accept": ("Auto-accept confident AI mappings", "Off: every AI mapping waits for faculty confirmation (recommended until the mapping validation supports it).", None, None),
    "early_warning_period": ("Early-warning period", "An At-Risk flag first raised in this grading period counts as early (before the Midterm).", None, None),
    "intervention_target_school_days": ("Intervention target (school days)", "An At-Risk alert should have a logged intervention within this many school days.", 1, 30),
}
PERIODS = ("prelim", "midterm", "semi_final", "final")
RISK_KEYS = {"mastery_threshold", "at_risk_min_gaps", "grade_decline_pct", "excelling_avg", "proficient_threshold"}
_CACHE_KEY = "institution_settings"


def get_settings(db: Session | None) -> InstitutionSettings:
    if not isinstance(db, Session):  # no session (or a test double): use the defaults
        return DEFAULTS
    cached = db.info.get(_CACHE_KEY)
    if cached is not None:
        return cached
    stored = {row.key: row.value for row in db.query(InstitutionSetting).all()}
    values = asdict(DEFAULTS)
    for f in fields(InstitutionSettings):
        if f.name in stored and stored[f.name] is not None:
            values[f.name] = _coerce(f.name, stored[f.name])
    result = InstitutionSettings(**values)
    db.info[_CACHE_KEY] = result
    return result


def _coerce(key, value):
    default = getattr(DEFAULTS, key)
    if isinstance(default, bool):
        return bool(value)
    if isinstance(default, int):
        return int(value)
    if isinstance(default, float):
        return float(value)
    return str(value)


def validate_changes(changes: dict) -> dict:
    """Return the cleaned changes or raise ValueError with a readable message."""
    clean = {}
    for key, value in changes.items():
        if key not in SPEC:
            raise ValueError(f"Unknown setting '{key}'")
        try:
            v = _coerce(key, value)
        except (TypeError, ValueError):
            raise ValueError(f"{SPEC[key][0]}: invalid value")
        lo, hi = SPEC[key][2], SPEC[key][3]
        if lo is not None and not (lo <= v <= hi):
            raise ValueError(f"{SPEC[key][0]} must be between {lo} and {hi}")
        if key == "early_warning_period" and v not in PERIODS:
            raise ValueError(f"Early-warning period must be one of {', '.join(PERIODS)}")
        clean[key] = v
    return clean


def update_settings(db: Session, changes: dict, user_id) -> tuple[InstitutionSettings, dict]:
    """Apply validated changes; returns (new settings, {key: (old, new)} for what changed)."""
    clean = validate_changes(changes)
    current = get_settings(db)
    merged = {**asdict(current), **clean}
    if merged["proficient_threshold"] < merged["mastery_threshold"]:
        raise ValueError("Proficient mastery must be at least the mastery threshold")
    changed = {}
    now = datetime.now(timezone.utc)
    for key, value in clean.items():
        old = getattr(current, key)
        if old == value:
            continue
        row = db.get(InstitutionSetting, key)
        if row is None:
            row = InstitutionSetting(key=key)
            db.add(row)
        row.value = value
        row.updated_by = user_id
        row.updated_at = now
        changed[key] = (old, value)
    db.commit()
    db.info.pop(_CACHE_KEY, None)
    return get_settings(db), changed


def last_updated(db: Session):
    """(timestamp, user id) of the most recent settings change, or (None, None)."""
    row = db.query(InstitutionSetting).order_by(InstitutionSetting.updated_at.desc()).first()
    return (row.updated_at, row.updated_by) if row else (None, None)
