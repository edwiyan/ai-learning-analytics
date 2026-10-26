"""course resource curation: AI suggestions, instructor decisions, custom resources

Revision ID: w3s4t5u6v7w8
Revises: v2r3s4t5u6v7
Create Date: 2026-10-26

Instructors accept or decline AI-suggested review resources per competency and
add their own (links, lessons, uploaded PDF/PPT/DOCX files).
"""
from alembic import op
import sqlalchemy as sa
import backend.core.types

revision = 'w3s4t5u6v7w8'
down_revision = 'v2r3s4t5u6v7'
branch_labels = None
depends_on = None


def upgrade():
    if op.get_bind().dialect.name == "postgresql":
        for value in ("lesson", "link", "file"):
            op.execute(f"ALTER TYPE resourcetype ADD VALUE IF NOT EXISTS '{value}'")

    op.add_column('resources', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('resources', sa.Column('file_path', sa.String(), nullable=True))
    op.add_column('resources', sa.Column('file_name', sa.String(), nullable=True))
    op.add_column('resources', sa.Column('mime_type', sa.String(), nullable=True))
    op.add_column('resources', sa.Column('course_id', backend.core.types.GUID(), nullable=True))
    op.add_column('resources', sa.Column('created_by', backend.core.types.GUID(), nullable=True))
    op.add_column('resources', sa.Column('source', sa.String(), nullable=False, server_default='repository'))
    op.create_foreign_key('fk_resources_course', 'resources', 'courses', ['course_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_resources_created_by', 'resources', 'users', ['created_by'], ['id'], ondelete='SET NULL')
    op.create_index('ix_resources_course_id', 'resources', ['course_id'])

    op.create_table(
        'course_resources',
        sa.Column('id', backend.core.types.GUID(), primary_key=True),
        sa.Column('course_id', backend.core.types.GUID(),
                  sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('resource_id', backend.core.types.GUID(),
                  sa.ForeignKey('resources.id', ondelete='CASCADE'), nullable=False),
        sa.Column('competency_id', backend.core.types.GUID(),
                  sa.ForeignKey('competencies.id', ondelete='CASCADE'), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='suggested'),
        sa.Column('source', sa.String(), nullable=False, server_default='ai'),
        sa.Column('score', sa.Float(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('decided_by', backend.core.types.GUID(),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('course_id', 'resource_id', 'competency_id', name='uq_course_resource_competency'),
    )
    op.create_index('ix_course_resources_course_id', 'course_resources', ['course_id'])


def downgrade():
    op.drop_index('ix_course_resources_course_id', table_name='course_resources')
    op.drop_table('course_resources')
    op.drop_index('ix_resources_course_id', table_name='resources')
    op.drop_constraint('fk_resources_created_by', 'resources', type_='foreignkey')
    op.drop_constraint('fk_resources_course', 'resources', type_='foreignkey')
    for col in ('source', 'created_by', 'course_id', 'mime_type', 'file_name', 'file_path', 'description'):
        op.drop_column('resources', col)
    # Postgres cannot drop enum values; the extra resourcetype values stay.
