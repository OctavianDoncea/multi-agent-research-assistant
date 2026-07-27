"""web page cache

Revision ID: 0002_web_page_cache
Revises: 0001_init
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '0002_web_page_cache'
down_revision = '0001_init'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'web_page_cache',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('url', sa.Text(), nullable=False, unique=True),
        sa.Column('fetched_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('context_text', sa.Text(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
    )

def downgrade() -> None:
    op.drop_table('web_page_cache')