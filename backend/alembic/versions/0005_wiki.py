"""wiki articles and associations

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-09 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

_CATEGORIES = (
    "npc", "kingdom", "city", "location", "faction",
    "deity", "religion", "lore_event", "note", "other",
)


def upgrade() -> None:
    op.create_table(
        "wiki_articles",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("campaign_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("category", sa.Enum(*_CATEGORIES), nullable=False),
        sa.Column("is_stub", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("image_url", sa.String(1024), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("public_content", sa.Text(), nullable=False),
        sa.Column("private_content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("campaign_id", "title", name="uq_wiki_article_campaign_title"),
    )
    op.create_index("ix_wiki_articles_id", "wiki_articles", ["id"])
    op.create_index("ix_wiki_articles_campaign_id", "wiki_articles", ["campaign_id"])

    op.create_table(
        "wiki_associations",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("source_article_id", sa.Integer(), nullable=False),
        sa.Column("target_article_id", sa.Integer(), nullable=False),
        sa.Column("association_label", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["source_article_id"], ["wiki_articles.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["target_article_id"], ["wiki_articles.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_article_id", "target_article_id", "association_label",
            name="uq_wiki_assoc",
        ),
    )
    op.create_index("ix_wiki_associations_id", "wiki_associations", ["id"])


def downgrade() -> None:
    op.drop_index("ix_wiki_associations_id", table_name="wiki_associations")
    op.drop_table("wiki_associations")
    op.drop_index("ix_wiki_articles_campaign_id", table_name="wiki_articles")
    op.drop_index("ix_wiki_articles_id", table_name="wiki_articles")
    op.drop_table("wiki_articles")
