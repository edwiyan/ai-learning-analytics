from backend.models.user import User
from backend.models.course import Course
from backend.models.syllabus import Syllabus, Competency, SyllabusApproval
from backend.models.assessment import Assessment, AssessmentItem
from backend.models.score import StudentScore
from backend.models.prediction import RiskPrediction
from backend.models.competency_mastery import CompetencyMastery
from backend.models.resource import CourseResource, Recommendation, Resource
from backend.models.recommendation_feedback import RecommendationFeedback
from backend.models.audit import AuditLog
from backend.models.instructor_intervention import InstructorIntervention
from backend.models.program import Program
from backend.models.curriculum import Curriculum
from backend.models.curriculum_subject import CurriculumSubject
from backend.models.section import Section
from backend.models.enrollment import StudentEnrollment
from backend.models.consent import PrivacyConsent
from backend.models.grade_weight import GradeWeight
from backend.models.grade_scale import GradeScale
from backend.models.tos import TableOfSpecifications
from backend.models.attendance import AttendanceRecord
from backend.models.grade_consultation import GradeConsultation
from backend.models.sus_survey import SusSurveyResponse
from backend.models.academic_standing import AcademicStanding
from backend.models.notification import Notification
from backend.models.grade_submission import GradeSubmission, GradeSubmissionApproval
from backend.models.exam_question import ExamQuestion
from backend.models.llm_cache import LLMCache
from backend.models.institution_setting import InstitutionSetting
