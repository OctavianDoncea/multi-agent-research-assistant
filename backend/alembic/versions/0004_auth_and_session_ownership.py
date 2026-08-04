"""auth users/sessions + research ownership/is_public

Revision ID: 0004_auth_and_session_ownership
Revises: 0003_session_tags_title_pinned
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0004_auth_and_session_ownership'
down_revision = '0003_session_tags_title_pinned'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('email', sa.String(length=320), nullable=False),
        sa.Column('password_hash', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    op.create_table(
        'auth_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_auth_sessions_user_id', 'auth_sessions', ['user_id'])
    op.create_index('ix_auth_sessions_token_hash', 'auth_sessions', ['token_hash'], unique=True)

    op.add_column('research_sessions', sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column(
        'research_sessions',
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.create_foreign_key(
        'fk_research_sessions_user_id_users',
        'research_sessions',
        'users',
        ['user_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_index('ix_research_sessions_user_id', 'research_sessions', ['user_id'])

    # Preserve existing shareable links
    op.execute(sa.text('UPDATE research_sessions SET is_public = true'))
    op.alter_column('research_sessions', 'is_public', server_default=None)


def downgrade() -> None:
    op.drop_index('ix_research_sessions_user_id', table_name='research_sessions')
    op.drop_constraint('fk_research_sessions_user_id_users', 'research_sessions', type_='foreignkey')
    op.drop_column('research_sessions', 'is_public')
    op.drop_column('research_sessions', 'user_id')

    op.drop_index('ix_auth_sessions_token_hash', table_name='auth_sessions')
    op.drop_index('ix_auth_sessions_user_id', table_name='auth_sessions')
    op.drop_table('auth_sessions')

    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')
