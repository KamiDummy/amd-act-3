"""add law jurisdiction and section anchor

Revision ID: e5f1a3c9b207
Revises: c7a2e91f4d10
Create Date: 2026-10-17 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f1a3c9b207'
down_revision: Union[str, Sequence[str], None] = 'c7a2e91f4d10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # The server default fills in the federal laws already loaded.
    op.add_column(
        'laws',
        sa.Column('jurisdiction', sa.String(), server_default='federal', nullable=False),
    )
    op.add_column('law_sections', sa.Column('anchor', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('law_sections', 'anchor')
    op.drop_column('laws', 'jurisdiction')
