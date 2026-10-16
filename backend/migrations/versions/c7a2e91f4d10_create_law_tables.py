"""create law tables

Revision ID: c7a2e91f4d10
Revises: b01bd3b844c2
Create Date: 2026-10-16 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = 'c7a2e91f4d10'
down_revision: Union[str, Sequence[str], None] = 'b01bd3b844c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    postgres = op.get_context().dialect.name == "postgresql"
    if postgres:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table('laws',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('kind', sa.String(), nullable=False),
    sa.Column('title', sa.String(), nullable=False),
    sa.Column('long_title', sa.Text(), nullable=True),
    sa.Column('url', sa.String(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('law_sections',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('law_id', sa.String(), nullable=False),
    sa.Column('label', sa.String(), nullable=False),
    sa.Column('part', sa.Integer(), nullable=False),
    sa.Column('heading', sa.String(), nullable=True),
    sa.Column('marginal_note', sa.String(), nullable=True),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('embedding', Vector(384), nullable=False),
    sa.ForeignKeyConstraint(['law_id'], ['laws.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_law_sections_law_id'), 'law_sections', ['law_id'], unique=False)
    if postgres:
        # Approximate nearest-neighbour index for cosine search.
        op.execute(
            "CREATE INDEX ix_law_sections_embedding ON law_sections "
            "USING hnsw (embedding vector_cosine_ops)"
        )
        # See the first migration: block Supabase's public REST API from these tables.
        op.execute("ALTER TABLE laws ENABLE ROW LEVEL SECURITY")
        op.execute("ALTER TABLE law_sections ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('law_sections')
    op.drop_table('laws')
