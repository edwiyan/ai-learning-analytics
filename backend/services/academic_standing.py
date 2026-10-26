from sqlalchemy.orm import Session
from backend.models.grade_consultation import GradeConsultation, AcademicStatus
from backend.models.academic_standing import AcademicStanding, AcademicStandingLevel


def compute_standing_level(student_id_hash: str, course_id: str, db: Session) -> AcademicStandingLevel:
    rows = db.query(GradeConsultation).filter(
        GradeConsultation.student_id_hash == student_id_hash,
        GradeConsultation.course_id == course_id,
    ).all()

    failed = sum(1 for r in rows if r.academic_status == AcademicStatus.failed)
    dropped = sum(1 for r in rows if r.academic_status == AcademicStatus.dropped)

    if failed >= 3 or (failed >= 2 and dropped >= 1):
        return AcademicStandingLevel.dismissal_risk
    if failed >= 2:
        return AcademicStandingLevel.probation
    if failed >= 1 or dropped >= 1:
        return AcademicStandingLevel.warning
    return AcademicStandingLevel.good


def upsert_academic_standing(student_id_hash: str, course_id: str, db: Session) -> AcademicStanding:
    level = compute_standing_level(student_id_hash, course_id, db)
    record = db.query(AcademicStanding).filter(
        AcademicStanding.student_id_hash == student_id_hash,
        AcademicStanding.course_id == course_id,
    ).first()

    if record:
        record.standing = level
    else:
        record = AcademicStanding(
            student_id_hash=student_id_hash,
            course_id=course_id,
            standing=level,
        )
        db.add(record)

    db.commit()
    db.refresh(record)
    return record
