"""add email to users

Revision ID: 0021
Revises: 0020
Create Date: 2026-10-01
"""

import sqlalchemy as sa
from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email", sa.String(255), nullable=True))
    op.execute(
        "UPDATE users SET email = LOWER(CONCAT(username, '@placeholder.invalid')) WHERE email IS NULL"
    )
    op.alter_column("users", "email", existing_type=sa.String(255), nullable=False)
    op.create_unique_constraint("uq_users_email", "users", ["email"])


def downgrade() -> None:
    op.drop_constraint("uq_users_email", "users", type_="unique")
    op.drop_column("users", "email")
