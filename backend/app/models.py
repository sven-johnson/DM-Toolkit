from datetime import date as DateType
from datetime import datetime

from sqlalchemy import (
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


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[DateType | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    scenes: Mapped[list["Scene"]] = relationship(
        "Scene",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="Scene.order_index",
    )


class Scene(Base):
    __tablename__ = "scenes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    session: Mapped["Session"] = relationship("Session", back_populates="scenes")
    checks: Mapped[list["Check"]] = relationship(
        "Check",
        back_populates="scene",
        cascade="all, delete-orphan",
        order_by="Check.order_index",
    )


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
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

    rolls: Mapped[list["Roll"]] = relationship(
        "Roll",
        back_populates="character",
        cascade="all, delete-orphan",
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
