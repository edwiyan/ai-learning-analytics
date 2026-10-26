from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Enum, Text, Boolean, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from backend.core.database import Base
from backend.core.types import GUID


class AssessmentType(str, enum.Enum):
    quiz = "quiz"
    exam = "exam"
    assignment = "assignment"


class GradingPeriod(str, enum.Enum):
    prelim = "prelim"
    midterm = "midterm"
    semi_final = "semi_final"
    final = "final"


class AssessmentCategory(str, enum.Enum):
    formative = "formative"
    summative = "summative"


class AssessmentApprovalStatus(str, enum.Enum):
    draft = "draft"
    pending_pd = "pending_pd"
    approved = "approved"
    rejected = "rejected"


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    course_id = Column(GUID(), ForeignKey("courses.id"), nullable=False)
    title = Column(String, nullable=False)
    type = Column(Enum(AssessmentType), nullable=False)
    grading_period = Column(Enum(GradingPeriod), nullable=False)
    assessment_category = Column(Enum(AssessmentCategory), nullable=True)
    date = Column(DateTime(timezone=True))
    approval_status = Column(
        Enum(AssessmentApprovalStatus),
        default=AssessmentApprovalStatus.draft,
        nullable=False,
        server_default="draft",
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    course = relationship("Course", back_populates="assessments")
    items = relationship("AssessmentItem", back_populates="assessment", cascade="all, delete-orphan")
    scores = relationship("StudentScore", back_populates="assessment")
    approvals = relationship("AssessmentApproval", back_populates="assessment", cascade="all, delete-orphan")
    tos_entries = relationship("TableOfSpecifications", back_populates="assessment", cascade="all, delete-orphan")


class AssessmentItem(Base):
    __tablename__ = "assessment_items"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(GUID(), ForeignKey("assessments.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    mapped_competency_id = Column(GUID(), ForeignKey("competencies.id"))
    # DB columns use the capstone §3.4 names (mapping_confidence, requires_review);
    # the Python attributes are kept stable to avoid churn across routers/services/UI.
    confidence_score = Column("mapping_confidence", Float)
    needs_review = Column("requires_review", Boolean, default=False)
    validated_by = Column(GUID(), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    bloom_level = Column(String, nullable=True)

    assessment = relationship("Assessment", back_populates="items")
    mapped_competency = relationship("Competency", back_populates="assessment_items")
    scores = relationship("StudentScore", back_populates="item")


class AssessmentApproval(Base):
    __tablename__ = "assessment_approvals"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(GUID(), ForeignKey("assessments.id"), nullable=False)
    approver_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=True)
    status = Column(String, nullable=False)
    feedback = Column(Text, nullable=True)
    content_validity = Column(Boolean, default=False, nullable=False)
    difficulty_appropriate = Column(Boolean, default=False, nullable=False)
    instructions_clear = Column(Boolean, default=False, nullable=False)
    bias_free = Column(Boolean, default=False, nullable=False)
    outcomes_covered = Column(Boolean, default=False, nullable=False)
    reviewed_at = Column(DateTime(timezone=True), server_default=func.now())

    assessment = relationship("Assessment", back_populates="approvals")
    approver = relationship("User")
