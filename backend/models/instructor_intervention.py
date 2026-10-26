import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Enum, Float, Boolean, Date

from backend.core.database import Base
from backend.core.types import GUID


class InterventionType(str, enum.Enum):
    academic_counseling = "academic_counseling"
    tutoring_referral = "tutoring_referral"
    study_skills_workshop = "study_skills_workshop"
    peer_mentoring = "peer_mentoring"
    modified_learning_strategy = "modified_learning_strategy"
    time_management_coaching = "time_management_coaching"
    wellness_support_referral = "wellness_support_referral"
    general_note = "general_note"


class InterventionStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"


class InstructorIntervention(Base):
    __tablename__ = "instructor_interventions"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    instructor_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(GUID(), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id_hash = Column(String(64), nullable=False, index=True)
    action_type = Column(String(50), nullable=False, default="flag")
    intervention_type = Column(Enum(InterventionType), nullable=True)
    note = Column(Text, nullable=True)
    # T4-B: Improvement plan fields
    goal_description = Column(Text, nullable=True)
    target_score = Column(Float, nullable=True)
    target_period = Column(String(50), nullable=True)
    follow_up_date = Column(Date, nullable=True)
    plan_accepted_by_student = Column(Boolean, nullable=False, default=False, server_default="false")
    # Capstone §3.4 Interventions: the AI-generated feedback logged with the
    # intervention, and its status tracking.
    ai_feedback = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default=InterventionStatus.open.value, server_default="open")
    status_updated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
