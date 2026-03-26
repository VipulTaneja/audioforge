"""Add stem_type and parent_asset_id to assets

Revision ID: 002_add_asset_columns
Revises: 001_initial
Create Date: 2026-03-24

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '002_add_asset_columns'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('assets', sa.Column('stem_type', sa.String(50), nullable=True))
    op.add_column('assets', sa.Column('parent_asset_id', sa.UUID(as_uuid=True), nullable=True))
    op.add_column('assets', sa.Column('s3_key_preview', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('assets', 's3_key_preview')
    op.drop_column('assets', 'parent_asset_id')
    op.drop_column('assets', 'stem_type')
