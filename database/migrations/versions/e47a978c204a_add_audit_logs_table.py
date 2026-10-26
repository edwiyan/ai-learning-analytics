"""add_audit_logs_table

Revision ID: e47a978c204a
Revises: 5bd1c872d986
Create Date: 2026-05-15 19:25:17.357831

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e47a978c204a'
down_revision: Union[str, None] = '5bd1c872d986'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Must drop FK constraint before altering column type
    op.drop_constraint('audit_logs_user_id_fkey', 'audit_logs', type_='foreignkey')

    op.alter_column('audit_logs', 'id',
               existing_type=sa.UUID(),
               type_=sa.String(length=36),
               existing_nullable=False,
               postgresql_using='id::text')
    op.alter_column('audit_logs', 'user_id',
               existing_type=sa.UUID(),
               type_=sa.String(length=36),
               existing_nullable=True,
               postgresql_using='user_id::text')

    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_audit_logs_user_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_action'), table_name='audit_logs')

    op.alter_column('audit_logs', 'user_id',
               existing_type=sa.String(length=36),
               type_=sa.UUID(),
               existing_nullable=True,
               postgresql_using='user_id::uuid')
    op.alter_column('audit_logs', 'id',
               existing_type=sa.String(length=36),
               type_=sa.UUID(),
               existing_nullable=False,
               postgresql_using='id::uuid')

    op.create_foreign_key('audit_logs_user_id_fkey', 'audit_logs', 'users', ['user_id'], ['id'])
