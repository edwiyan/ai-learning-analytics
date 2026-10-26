"""Notification helpers — call inside a router before db.commit() so they share the same transaction."""
from sqlalchemy.orm import Session

from backend.models.notification import Notification
from backend.models.user import User, UserRole


def notify(db: Session, user_id: str, type: str, title: str, message: str, related_id: str = None):
    db.add(Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        related_id=related_id,
    ))


def notify_roles(db: Session, roles: list, college: str | None, type: str, title: str, message: str, related_id: str = None):
    """Notify all active users with any of the given roles, optionally filtered by college."""
    q = db.query(User).filter(User.role.in_(roles), User.is_active == True)
    if college:
        q = q.filter(User.college == college)
    for user in q.all():
        notify(db, str(user.id), type, title, message, related_id)
