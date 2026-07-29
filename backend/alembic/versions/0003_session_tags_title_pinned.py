"""session title/tags/pinned

Revision ID: 0003_session_tags_title_pinned
Revises: 0002_web_page_cache
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0003_session_tags_title_pinned'
down_revision = '0002_web_page_cache'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('research_sessions', sa.Column('title', sa.Text(), nullable=True))
    op.add_column('research_sessions', sa.Column('tags', postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")))
    op.add_column('research_sessions', sa.Column('pinned', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.alter_column('research_sessions', 'tags', server_default=None)
    op.alter_column('research_sessions', 'pinned', server_default=None)

def downgrade() -> None:
    op.drop_column('research_sessions', 'pinned')
    op.drop_column('research_sessions', 'tags')
    op.drop_column('research_sessions', 'title')