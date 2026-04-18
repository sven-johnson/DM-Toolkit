from datetime import date as DateType
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    uuid: Mapped[str] = mapped_column(String(36), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    storylines: Mapped[list["Storyline"]] = relationship(
        "Storyline",
        back_populates="campaign",
        cascade="all, delete-orphan",
        order_by="Storyline.order_index",
    )
    sessions: Mapped[list["Session"]] = relationship(
        "Session",
        back_populates="campaign",
        cascade="all, delete-orphan",
        order_by="Session.created_at.desc()",
    )
    characters: Mapped[list["Character"]] = relationship(
        "Character",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )


class Storyline(Base):
    __tablename__ = "storylines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    uuid: Mapped[str] = mapped_column(String(36), nullable=False, unique=True)
    campaign_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="storylines")
    scenes: Mapped[list["Scene"]] = relationship(
        "Scene",
        back_populates="storyline",
        cascade="all, delete-orphan",
        order_by="Scene.order_index",
    )


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    uuid: Mapped[str] = mapped_column(String(36), nullable=False, unique=True)
    campaign_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[DateType | None] = mapped_column(Date, nullable=True)
    recap_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    active_storyline_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("storylines.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="sessions")
    active_storyline: Mapped["Storyline | None"] = relationship("Storyline")
    session_scenes: Mapped[list["SessionScene"]] = relationship(
        "SessionScene",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="SessionScene.order_index",
    )

    @property
    def scenes(self) -> list["Scene"]:
        return [ss.scene for ss in self.session_scenes if ss.scene is not None]


class SessionScene(Base):
    __tablename__ = "session_scenes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    scene_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (UniqueConstraint("session_id", "scene_id"),)

    session: Mapped["Session"] = relationship("Session", back_populates="session_scenes")
    scene: Mapped["Scene"] = relationship("Scene", back_populates="session_scenes")


class Scene(Base):
    __tablename__ = "scenes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    uuid: Mapped[str] = mapped_column(String(36), nullable=False, unique=True)
    storyline_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("storylines.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    dm_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    scene_type: Mapped[str] = mapped_column(String(20), nullable=False, default="story")
    puzzle_clues: Mapped[str | None] = mapped_column(Text, nullable=True)
    puzzle_solution: Mapped[str | None] = mapped_column(Text, nullable=True)
    music_cue: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    storyline: Mapped["Storyline"] = relationship("Storyline", back_populates="scenes")
    session_scenes: Mapped[list["SessionScene"]] = relationship(
        "SessionScene",
        back_populates="scene",
        cascade="all, delete-orphan",
    )
    checks: Mapped[list["Check"]] = relationship(
        "Check",
        back_populates="scene",
        cascade="all, delete-orphan",
        order_by="Check.order_index",
    )
    enemies: Mapped[list["SceneEnemy"]] = relationship(
        "SceneEnemy",
        back_populates="scene",
        cascade="all, delete-orphan",
        order_by="SceneEnemy.order_index",
    )
    shop_items: Mapped[list["SceneShopItem"]] = relationship(
        "SceneShopItem",
        back_populates="scene",
        cascade="all, delete-orphan",
        order_by="SceneShopItem.order_index",
    )


class SceneEnemy(Base):
    __tablename__ = "scene_enemies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    scene_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    scene: Mapped["Scene"] = relationship("Scene", back_populates="enemies")


class SceneShopItem(Base):
    __tablename__ = "scene_shop_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    scene_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="gold")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    scene: Mapped["Scene"] = relationship("Scene", back_populates="shop_items")


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    campaign_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    char_class: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    subclass: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Ability scores
    str_score: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    dex_score: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    con_score: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    int_score: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    wis_score: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    cha_score: Mapped[int] = mapped_column(Integer, nullable=False, default=10)

    # Ability modifiers
    str_mod: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dex_mod: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    con_mod: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    int_mod: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    wis_mod: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cha_mod: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Skill modifiers
    acrobatics: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    animal_handling: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    arcana: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    athletics: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    deception: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    history: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    insight: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    intimidation: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    investigation: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    medicine: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    nature: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    perception: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    performance: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    persuasion: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    religion: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sleight_of_hand: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stealth: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    survival: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Saving throw modifiers
    str_save: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dex_save: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    con_save: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    int_save: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    wis_save: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cha_save: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Combat stats
    ac: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    max_hp: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="characters")
    rolls: Mapped[list["Roll"]] = relationship(
        "Roll",
        back_populates="character",
        cascade="all, delete-orphan",
    )


class WikiArticle(Base):
    __tablename__ = "wiki_articles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    campaign_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    is_stub: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    public_content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    private_content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (UniqueConstraint("campaign_id", "title"),)

    outbound_associations: Mapped[list["WikiAssociation"]] = relationship(
        "WikiAssociation",
        foreign_keys="WikiAssociation.source_article_id",
        back_populates="source_article",
        cascade="all, delete-orphan",
    )
    inbound_associations: Mapped[list["WikiAssociation"]] = relationship(
        "WikiAssociation",
        foreign_keys="WikiAssociation.target_article_id",
        back_populates="target_article",
        cascade="all, delete-orphan",
    )


class WikiAssociation(Base):
    __tablename__ = "wiki_associations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source_article_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("wiki_articles.id", ondelete="CASCADE"), nullable=False
    )
    target_article_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("wiki_articles.id", ondelete="CASCADE"), nullable=False
    )
    association_label: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("source_article_id", "target_article_id", "association_label"),
    )

    source_article: Mapped["WikiArticle"] = relationship(
        "WikiArticle",
        foreign_keys=[source_article_id],
        back_populates="outbound_associations",
    )
    target_article: Mapped["WikiArticle"] = relationship(
        "WikiArticle",
        foreign_keys=[target_article_id],
        back_populates="inbound_associations",
    )


class Check(Base):
    __tablename__ = "checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    scene_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False
    )
    check_type: Mapped[str] = mapped_column(String(50), nullable=False)
    subtype: Mapped[str] = mapped_column(String(100), nullable=False)
    dc: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    character_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    scene: Mapped["Scene"] = relationship("Scene", back_populates="checks")
    rolls: Mapped[list["Roll"]] = relationship(
        "Roll",
        back_populates="check",
        cascade="all, delete-orphan",
    )


class Roll(Base):
    __tablename__ = "rolls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    check_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("checks.id", ondelete="CASCADE"), nullable=False
    )
    character_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    die_result: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (UniqueConstraint("check_id", "character_id"),)

    check: Mapped["Check"] = relationship("Check", back_populates="rolls")
    character: Mapped["Character"] = relationship("Character", back_populates="rolls")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
