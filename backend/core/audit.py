from sqlalchemy.orm import Session
from backend.models.audit import AuditLog


def log_action(db: Session, user_id: str, action: str, target_table: str = None, target_id: str = None, extra: dict = None):
    entry = AuditLog(
        user_id=user_id,
        action=action,
        target_table=target_table,
        target_id=target_id,
        extra_data=extra,
    )
    db.add(entry)
    db.commit()
