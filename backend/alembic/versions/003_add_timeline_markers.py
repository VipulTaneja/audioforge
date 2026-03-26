"""Add timeline_markers table

Revision ID: 003
Revises: 002
Create Date: 2026-03-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'timeline_markers',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('time', sa.Float(), nullable=False),
        sa.Column('label', sa.String(255), nullable=True),
        sa.Column('color', sa.String(20), nullable=False, server_default='yellow'),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_timeline_markers_project_id', 'timeline_markers', ['project_id'])


def downgrade() -> None:
    op.drop_index('ix_timeline_markers_project_id', 'timeline_markers')
    op.drop_table('timeline_markers')
