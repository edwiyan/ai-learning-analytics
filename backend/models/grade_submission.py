from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from backend.core.database import Base
from backend.core.types import GUID
from backend.models.assessment import GradingPeriod


class GradeSubmissionStatus(str, enum.Enum):
    draft = "draft"
    pending_pd = "pending_pd"
    pending_dean = "pending_dean"
    pending_vp = "pending_vp"
    posted = "posted"
    rejected = "rejected"


class GradeSubmission(Base):
    __tablename__ = "grade_submissions"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    course_id = Column(GUID(), ForeignKey("courses.id"), nullable=False)
    instructor_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    grading_period = Column(Enum(GradingPeriod), nullable=False)
    status = Column(
        Enum(GradeSubmissionStatus),
        default=GradeSubmissionStatus.draft,
        nullable=False,
        server_default="draft",
    )
    notes = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    posted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    course = relationship("Course")
    instructor = relationship("User", foreign_keys=[instructor_id])
    approvals = relationship("GradeSubmissionApproval", back_populates="submission", cascade="all, delete-orphan")


class GradeSubmissionApproval(Base):
    __tablename__ = "grade_submission_approvals"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    submission_id = Column(GUID(), ForeignKey("grade_submissions.id"), nullable=False)
    approver_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False)
    status = Column(String, nullable=False)
    feedback = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), server_default=func.now())

    submission = relationship("GradeSubmission", back_populates="approvals")
    approver = relationship("User", foreign_keys=[approver_id])
