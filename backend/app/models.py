from datetime import date as DateType
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    Float,
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

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    rule_system_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("rule_systems.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    rule_system: Mapped["RuleSystem | None"] = relationship("RuleSystem")
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
    members: Mapped[list["CampaignMember"]] = relationship(
        "CampaignMember",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )


class Storyline(Base):
    __tablename__ = "storylines"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    campaign_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
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

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    campaign_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[DateType | None] = mapped_column(Date, nullable=True)
    recap_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    active_storyline_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("storylines.id", ondelete="SET NULL"), nullable=True
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

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    scene_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (UniqueConstraint("session_id", "scene_id"),)

    session: Mapped["Session"] = relationship("Session", back_populates="session_scenes")
    scene: Mapped["Scene"] = relationship("Scene", back_populates="session_scenes")


class Scene(Base):
    __tablename__ = "scenes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    storyline_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("storylines.id", ondelete="CASCADE"), nullable=False
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

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    scene_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    saved_encounter_monster_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("saved_encounter_monsters.id", ondelete="SET NULL"),
        nullable=True,
    )

    scene: Mapped["Scene"] = relationship("Scene", back_populates="enemies")
    saved_encounter_monster: Mapped["SavedEncounterMonster | None"] = relationship(
        "SavedEncounterMonster"
    )


class SceneShopItem(Base):
    __tablename__ = "scene_shop_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    scene_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="gold")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    scene: Mapped["Scene"] = relationship("Scene", back_populates="shop_items")


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    campaign_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
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
    nova_damage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="characters")
    rolls: Mapped[list["Roll"]] = relationship(
        "Roll",
        back_populates="character",
        cascade="all, delete-orphan",
    )
    combat_stats: Mapped[list["CharacterStat"]] = relationship(
        "CharacterStat", back_populates="character", cascade="all, delete-orphan"
    )
    combat_skills: Mapped[list["CharacterSkill"]] = relationship(
        "CharacterSkill", back_populates="character", cascade="all, delete-orphan"
    )
    combat_turns: Mapped[list["CharacterCombatTurn"]] = relationship(
        "CharacterCombatTurn", back_populates="character", cascade="all, delete-orphan"
    )


class WikiArticle(Base):
    __tablename__ = "wiki_articles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    campaign_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
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

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source_article_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("wiki_articles.id", ondelete="CASCADE"), nullable=False
    )
    target_article_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("wiki_articles.id", ondelete="CASCADE"), nullable=False
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

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    scene_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False
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

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    check_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("checks.id", ondelete="CASCADE"), nullable=False
    )
    character_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    die_result: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (UniqueConstraint("check_id", "character_id"),)

    check: Mapped["Check"] = relationship("Check", back_populates="rolls")
    character: Mapped["Character"] = relationship("Character", back_populates="rolls")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    campaign_memberships: Mapped[list["CampaignMember"]] = relationship(
        "CampaignMember",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class CampaignMember(Base):
    __tablename__ = "campaign_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    campaign_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="player")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "campaign_id"),)

    user: Mapped["User"] = relationship("User", back_populates="campaign_memberships")
    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="members")


class GMProfile(Base):
    __tablename__ = "gm_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    lethality: Mapped["LethalitySettings"] = relationship(
        "LethalitySettings", back_populates="profile", uselist=False, cascade="all, delete-orphan"
    )
    combat_duration: Mapped["CombatDurationSettings"] = relationship(
        "CombatDurationSettings", back_populates="profile", uselist=False, cascade="all, delete-orphan"
    )
    action_economy: Mapped["ActionEconomySettings"] = relationship(
        "ActionEconomySettings", back_populates="profile", uselist=False, cascade="all, delete-orphan"
    )
    hit_rate: Mapped["HitRateSettings"] = relationship(
        "HitRateSettings", back_populates="profile", uselist=False, cascade="all, delete-orphan"
    )
    saving_throw: Mapped["SavingThrowSettings"] = relationship(
        "SavingThrowSettings", back_populates="profile", uselist=False, cascade="all, delete-orphan"
    )
    minion: Mapped["MinionSettings"] = relationship(
        "MinionSettings", back_populates="profile", uselist=False, cascade="all, delete-orphan"
    )
    warnings: Mapped["WarningSettings"] = relationship(
        "WarningSettings", back_populates="profile", uselist=False, cascade="all, delete-orphan"
    )


class LethalitySettings(Base):
    __tablename__ = "lethality_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    gm_profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("gm_profiles.id", ondelete="CASCADE"), nullable=False
    )
    threat_turns_trivial: Mapped[float] = mapped_column(Float, nullable=False, default=6.0)
    threat_turns_easy: Mapped[float] = mapped_column(Float, nullable=False, default=5.0)
    threat_turns_medium: Mapped[float] = mapped_column(Float, nullable=False, default=3.5)
    threat_turns_hard: Mapped[float] = mapped_column(Float, nullable=False, default=2.25)
    threat_turns_deadly: Mapped[float] = mapped_column(Float, nullable=False, default=1.5)
    damage_smoothing: Mapped[float] = mapped_column(Float, nullable=False, default=0.85)
    hp_smoothing: Mapped[float] = mapped_column(Float, nullable=False, default=1.10)
    one_shot_prevention_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.60)
    boss_nova_multiplier: Mapped[float] = mapped_column(Float, nullable=False, default=1.5)
    allow_player_death: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        UniqueConstraint("gm_profile_id"),
        CheckConstraint("one_shot_prevention_threshold BETWEEN 0.0 AND 1.0", name="ck_lethality_one_shot_threshold"),
        CheckConstraint("damage_smoothing > 0", name="ck_lethality_damage_smoothing"),
        CheckConstraint("hp_smoothing > 0", name="ck_lethality_hp_smoothing"),
        CheckConstraint("boss_nova_multiplier > 0", name="ck_lethality_boss_nova"),
    )

    profile: Mapped["GMProfile"] = relationship("GMProfile", back_populates="lethality")


class CombatDurationSettings(Base):
    __tablename__ = "combat_duration_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    gm_profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("gm_profiles.id", ondelete="CASCADE"), nullable=False
    )
    target_rounds_trivial: Mapped[float] = mapped_column(Float, nullable=False, default=1.5)
    target_rounds_easy: Mapped[float] = mapped_column(Float, nullable=False, default=2.5)
    target_rounds_medium: Mapped[float] = mapped_column(Float, nullable=False, default=3.5)
    target_rounds_hard: Mapped[float] = mapped_column(Float, nullable=False, default=5.0)
    target_rounds_deadly: Mapped[float] = mapped_column(Float, nullable=False, default=6.0)
    round_variance_tolerance: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)

    __table_args__ = (
        UniqueConstraint("gm_profile_id"),
        CheckConstraint("round_variance_tolerance >= 0", name="ck_combat_duration_variance"),
    )

    profile: Mapped["GMProfile"] = relationship("GMProfile", back_populates="combat_duration")


class ActionEconomySettings(Base):
    __tablename__ = "action_economy_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    gm_profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("gm_profiles.id", ondelete="CASCADE"), nullable=False
    )
    multiplier_trivial: Mapped[float] = mapped_column(Float, nullable=False, default=0.6)
    multiplier_easy: Mapped[float] = mapped_column(Float, nullable=False, default=0.8)
    multiplier_medium: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    multiplier_hard: Mapped[float] = mapped_column(Float, nullable=False, default=1.2)
    multiplier_deadly: Mapped[float] = mapped_column(Float, nullable=False, default=1.4)
    bonus_action_estimate: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    legendary_action_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lair_actions_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        UniqueConstraint("gm_profile_id"),
        CheckConstraint("bonus_action_estimate BETWEEN 0.0 AND 1.0", name="ck_action_economy_bonus_action"),
        CheckConstraint(
            "legendary_action_override IS NULL OR legendary_action_override >= 0",
            name="ck_action_economy_legendary",
        ),
    )

    profile: Mapped["GMProfile"] = relationship("GMProfile", back_populates="action_economy")


class HitRateSettings(Base):
    __tablename__ = "hit_rate_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    gm_profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("gm_profiles.id", ondelete="CASCADE"), nullable=False
    )
    monster_hit_rate_trivial: Mapped[float] = mapped_column(Float, nullable=False, default=0.40)
    monster_hit_rate_easy: Mapped[float] = mapped_column(Float, nullable=False, default=0.50)
    monster_hit_rate_medium: Mapped[float] = mapped_column(Float, nullable=False, default=0.60)
    monster_hit_rate_hard: Mapped[float] = mapped_column(Float, nullable=False, default=0.65)
    monster_hit_rate_deadly: Mapped[float] = mapped_column(Float, nullable=False, default=0.70)
    player_hit_rate_trivial: Mapped[float] = mapped_column(Float, nullable=False, default=0.75)
    player_hit_rate_easy: Mapped[float] = mapped_column(Float, nullable=False, default=0.65)
    player_hit_rate_medium: Mapped[float] = mapped_column(Float, nullable=False, default=0.55)
    player_hit_rate_hard: Mapped[float] = mapped_column(Float, nullable=False, default=0.50)
    player_hit_rate_deadly: Mapped[float] = mapped_column(Float, nullable=False, default=0.45)

    __table_args__ = (
        UniqueConstraint("gm_profile_id"),
        CheckConstraint(
            "monster_hit_rate_trivial BETWEEN 0.0 AND 1.0"
            " AND monster_hit_rate_easy BETWEEN 0.0 AND 1.0"
            " AND monster_hit_rate_medium BETWEEN 0.0 AND 1.0"
            " AND monster_hit_rate_hard BETWEEN 0.0 AND 1.0"
            " AND monster_hit_rate_deadly BETWEEN 0.0 AND 1.0",
            name="ck_hit_rate_monster",
        ),
        CheckConstraint(
            "player_hit_rate_trivial BETWEEN 0.0 AND 1.0"
            " AND player_hit_rate_easy BETWEEN 0.0 AND 1.0"
            " AND player_hit_rate_medium BETWEEN 0.0 AND 1.0"
            " AND player_hit_rate_hard BETWEEN 0.0 AND 1.0"
            " AND player_hit_rate_deadly BETWEEN 0.0 AND 1.0",
            name="ck_hit_rate_player",
        ),
    )

    profile: Mapped["GMProfile"] = relationship("GMProfile", back_populates="hit_rate")


class SavingThrowSettings(Base):
    __tablename__ = "saving_throw_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    gm_profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("gm_profiles.id", ondelete="CASCADE"), nullable=False
    )
    save_dc_base: Mapped[int] = mapped_column(Integer, nullable=False, default=8)
    save_dc_proficiency_scaling: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    save_dc_difficulty_bonus: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    __table_args__ = (
        UniqueConstraint("gm_profile_id"),
        CheckConstraint("save_dc_base >= 0", name="ck_saving_throw_dc_base"),
        CheckConstraint("save_dc_difficulty_bonus >= 0", name="ck_saving_throw_dc_bonus"),
    )

    profile: Mapped["GMProfile"] = relationship("GMProfile", back_populates="saving_throw")


class MinionSettings(Base):
    __tablename__ = "minion_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    gm_profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("gm_profiles.id", ondelete="CASCADE"), nullable=False
    )
    minion_one_hit_kill: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    minion_hp_fraction: Mapped[float] = mapped_column(Float, nullable=False, default=0.25)
    minion_damage_fraction: Mapped[float] = mapped_column(Float, nullable=False, default=0.40)

    __table_args__ = (
        UniqueConstraint("gm_profile_id"),
        CheckConstraint("minion_hp_fraction BETWEEN 0.0 AND 1.0", name="ck_minion_hp_fraction"),
        CheckConstraint("minion_damage_fraction BETWEEN 0.0 AND 1.0", name="ck_minion_damage_fraction"),
    )

    profile: Mapped["GMProfile"] = relationship("GMProfile", back_populates="minion")


class WarningSettings(Base):
    __tablename__ = "warning_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    gm_profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("gm_profiles.id", ondelete="CASCADE"), nullable=False
    )
    warn_nova_threshold: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    warn_one_shot_risk: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    warn_action_economy_imbalance: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    warn_round_duration_deviation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_math: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (UniqueConstraint("gm_profile_id"),)

    profile: Mapped["GMProfile"] = relationship("GMProfile", back_populates="warnings")


class CreatureArchetype(Base):
    __tablename__ = "creature_archetypes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    typical_traits: Mapped[list | None] = mapped_column(JSON, nullable=True)
    damage_immunities: Mapped[list | None] = mapped_column(JSON, nullable=True)
    damage_resistances: Mapped[list | None] = mapped_column(JSON, nullable=True)
    condition_immunities: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    ability_flavor_mappings: Mapped[list["AbilityFlavorCreatureMapping"]] = relationship(
        "AbilityFlavorCreatureMapping", back_populates="creature_archetype", cascade="all, delete-orphan"
    )


class CombatRoleArchetype(Base):
    __tablename__ = "combat_role_archetypes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_weight: Mapped[float] = mapped_column(Float, nullable=False)
    hp_share_tier: Mapped[str] = mapped_column(String(10), nullable=False)
    ac_profile: Mapped[str] = mapped_column(String(15), nullable=False)
    damage_profile: Mapped[str] = mapped_column(String(10), nullable=False)
    is_boss_eligible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_minion: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    default_attack_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    preferred_conditions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "hp_share_tier IN ('very_low', 'low', 'medium', 'high', 'very_high')",
            name="ck_combat_role_hp_share_tier",
        ),
        CheckConstraint(
            "ac_profile IN ('low', 'medium_low', 'medium', 'medium_high', 'high')",
            name="ck_combat_role_ac_profile",
        ),
        CheckConstraint(
            "damage_profile IN ('very_low', 'low', 'medium', 'high', 'very_high')",
            name="ck_combat_role_damage_profile",
        ),
        CheckConstraint("action_weight > 0", name="ck_combat_role_action_weight"),
    )

    ability_flavor_mappings: Mapped[list["AbilityFlavorRoleMapping"]] = relationship(
        "AbilityFlavorRoleMapping", back_populates="combat_role_archetype", cascade="all, delete-orphan"
    )


class AbilityFlavor(Base):
    __tablename__ = "ability_flavors"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    damage_type: Mapped[str] = mapped_column(String(50), nullable=False)
    is_custom: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    role_mappings: Mapped[list["AbilityFlavorRoleMapping"]] = relationship(
        "AbilityFlavorRoleMapping", back_populates="ability_flavor", cascade="all, delete-orphan"
    )
    creature_mappings: Mapped[list["AbilityFlavorCreatureMapping"]] = relationship(
        "AbilityFlavorCreatureMapping", back_populates="ability_flavor", cascade="all, delete-orphan"
    )


class AbilityFlavorRoleMapping(Base):
    __tablename__ = "ability_flavor_role_mappings"

    ability_flavor_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ability_flavors.id", ondelete="CASCADE"), primary_key=True
    )
    combat_role_archetype_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("combat_role_archetypes.id", ondelete="CASCADE"), primary_key=True
    )

    ability_flavor: Mapped["AbilityFlavor"] = relationship("AbilityFlavor", back_populates="role_mappings")
    combat_role_archetype: Mapped["CombatRoleArchetype"] = relationship(
        "CombatRoleArchetype", back_populates="ability_flavor_mappings"
    )


class AbilityFlavorCreatureMapping(Base):
    __tablename__ = "ability_flavor_creature_mappings"

    ability_flavor_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ability_flavors.id", ondelete="CASCADE"), primary_key=True
    )
    creature_archetype_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("creature_archetypes.id", ondelete="CASCADE"), primary_key=True
    )

    ability_flavor: Mapped["AbilityFlavor"] = relationship("AbilityFlavor", back_populates="creature_mappings")
    creature_archetype: Mapped["CreatureArchetype"] = relationship(
        "CreatureArchetype", back_populates="ability_flavor_mappings"
    )


class EncounterTemplate(Base):
    __tablename__ = "encounter_templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_custom: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    slots: Mapped[list["EncounterTemplateSlot"]] = relationship(
        "EncounterTemplateSlot",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="EncounterTemplateSlot.sort_order",
    )


class EncounterTemplateSlot(Base):
    __tablename__ = "encounter_template_slots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    encounter_template_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("encounter_templates.id", ondelete="CASCADE"), nullable=False
    )
    combat_role_archetype_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("combat_role_archetypes.id", ondelete="RESTRICT"), nullable=False
    )
    default_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    template: Mapped["EncounterTemplate"] = relationship("EncounterTemplate", back_populates="slots")
    combat_role: Mapped["CombatRoleArchetype"] = relationship("CombatRoleArchetype")


class MonsterStatBlock(Base):
    __tablename__ = "monster_stat_blocks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    creature_archetype_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("creature_archetypes.id", ondelete="SET NULL"), nullable=True
    )
    combat_role_archetype_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("combat_role_archetypes.id", ondelete="RESTRICT"), nullable=False
    )
    gm_profile_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("gm_profiles.id", ondelete="SET NULL"), nullable=True
    )
    is_boss: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    level_tier: Mapped[int] = mapped_column(Integer, nullable=False)
    hp: Mapped[int] = mapped_column(Integer, nullable=False)
    ac: Mapped[int] = mapped_column(Integer, nullable=False)
    attack_bonus: Mapped[int] = mapped_column(Integer, nullable=False)
    save_dc: Mapped[int] = mapped_column(Integer, nullable=False)
    speed: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    str_score: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    dex_score: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    con_score: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    int_score: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    wis_score: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    cha_score: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    damage_immunities: Mapped[list | None] = mapped_column(JSON, nullable=True)
    damage_resistances: Mapped[list | None] = mapped_column(JSON, nullable=True)
    condition_immunities: Mapped[list | None] = mapped_column(JSON, nullable=True)
    has_legendary_actions: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    legendary_action_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    has_lair_actions: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    actions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    legendary_actions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    lair_actions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    is_saved_template: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("level_tier BETWEEN 1 AND 4", name="ck_monster_level_tier"),
        CheckConstraint("hp >= 1", name="ck_monster_hp"),
        CheckConstraint("ac >= 0", name="ck_monster_ac"),
        CheckConstraint("legendary_action_count >= 0", name="ck_monster_legendary_action_count"),
    )

    creature_archetype: Mapped["CreatureArchetype | None"] = relationship("CreatureArchetype")
    combat_role: Mapped["CombatRoleArchetype"] = relationship("CombatRoleArchetype")
    gm_profile: Mapped["GMProfile | None"] = relationship("GMProfile")
    encounter_uses: Mapped[list["SavedEncounterMonster"]] = relationship(
        "SavedEncounterMonster", back_populates="monster_stat_block"
    )


class SavedEncounter(Base):
    __tablename__ = "saved_encounters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    encounter_template_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("encounter_templates.id", ondelete="SET NULL"), nullable=True
    )
    gm_profile_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("gm_profiles.id", ondelete="SET NULL"), nullable=True
    )
    difficulty: Mapped[str] = mapped_column(String(10), nullable=False)
    party_size: Mapped[int] = mapped_column(Integer, nullable=False)
    party_avg_level: Mapped[int] = mapped_column(Integer, nullable=False)
    party_avg_hp: Mapped[float] = mapped_column(Float, nullable=False)
    party_total_hp: Mapped[float] = mapped_column(Float, nullable=False)
    party_lowest_hp: Mapped[int] = mapped_column(Integer, nullable=False)
    party_avg_ac: Mapped[float] = mapped_column(Float, nullable=False)
    party_nova_damage: Mapped[float] = mapped_column(Float, nullable=False)
    party_sustained_damage: Mapped[float] = mapped_column(Float, nullable=False)
    expected_rounds: Mapped[float] = mapped_column(Float, nullable=False)
    expected_rounds_min: Mapped[float] = mapped_column(Float, nullable=False)
    expected_rounds_max: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "difficulty IN ('trivial', 'easy', 'medium', 'hard', 'deadly')",
            name="ck_saved_encounter_difficulty",
        ),
        CheckConstraint("party_size >= 1", name="ck_saved_encounter_party_size"),
    )

    encounter_template: Mapped["EncounterTemplate | None"] = relationship("EncounterTemplate")
    gm_profile: Mapped["GMProfile | None"] = relationship("GMProfile")
    encounter_monsters: Mapped[list["SavedEncounterMonster"]] = relationship(
        "SavedEncounterMonster",
        back_populates="saved_encounter",
        cascade="all, delete-orphan",
        order_by="SavedEncounterMonster.sort_order",
    )


class SavedEncounterMonster(Base):
    __tablename__ = "saved_encounter_monsters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    saved_encounter_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("saved_encounters.id", ondelete="CASCADE"), nullable=False
    )
    monster_stat_block_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("monster_stat_blocks.id", ondelete="RESTRICT"), nullable=False
    )
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    saved_encounter: Mapped["SavedEncounter"] = relationship("SavedEncounter", back_populates="encounter_monsters")
    monster_stat_block: Mapped["MonsterStatBlock"] = relationship("MonsterStatBlock", back_populates="encounter_uses")


# ── Rule System Abstraction ───────────────────────────────────────────────────

class RuleSystem(Base):
    __tablename__ = "rule_systems"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(64), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    stat_definitions: Mapped[list["StatDefinition"]] = relationship(
        "StatDefinition", back_populates="rule_system", cascade="all, delete-orphan"
    )
    skill_definitions: Mapped[list["SkillDefinition"]] = relationship(
        "SkillDefinition", back_populates="rule_system", cascade="all, delete-orphan"
    )
    combat_ability_definitions: Mapped[list["CombatAbilityDefinition"]] = relationship(
        "CombatAbilityDefinition", back_populates="rule_system", cascade="all, delete-orphan"
    )


class StatDefinition(Base):
    __tablename__ = "stat_definitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rule_system_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("rule_systems.id", ondelete="CASCADE"), nullable=False
    )
    slug: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    abbreviation: Mapped[str] = mapped_column(String(16), nullable=False)
    stat_type: Mapped[str] = mapped_column(
        Enum("ability_score", "derived", "resource", "custom", name="stat_type_enum"),
        nullable=False,
    )
    has_modifier: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    modifier_formula: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("rule_system_id", "slug", name="uq_stat_definition_rs_slug"),
    )

    rule_system: Mapped["RuleSystem"] = relationship("RuleSystem", back_populates="stat_definitions")
    governed_skills: Mapped[list["SkillDefinition"]] = relationship(
        "SkillDefinition", back_populates="governing_stat"
    )


class SkillDefinition(Base):
    __tablename__ = "skill_definitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rule_system_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("rule_systems.id", ondelete="CASCADE"), nullable=False
    )
    slug: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    governing_stat_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("stat_definitions.id", ondelete="SET NULL"), nullable=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("rule_system_id", "slug", name="uq_skill_definition_rs_slug"),
    )

    rule_system: Mapped["RuleSystem"] = relationship("RuleSystem", back_populates="skill_definitions")
    governing_stat: Mapped["StatDefinition | None"] = relationship(
        "StatDefinition", back_populates="governed_skills"
    )


class CombatAbilityDefinition(Base):
    __tablename__ = "combat_ability_definitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rule_system_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("rule_systems.id", ondelete="CASCADE"), nullable=False
    )
    slug: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    ability_category: Mapped[str] = mapped_column(
        Enum("attack", "spell", "feature", "cantrip", "resource", name="ability_category_enum"),
        nullable=False,
    )
    is_nova_eligible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_sustained_eligible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("rule_system_id", "slug", name="uq_combat_ability_definition_rs_slug"),
    )

    rule_system: Mapped["RuleSystem"] = relationship("RuleSystem", back_populates="combat_ability_definitions")


# ── Character Combat Tables ───────────────────────────────────────────────────

class CharacterStat(Base):
    __tablename__ = "character_stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    character_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    stat_definition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stat_definitions.id", ondelete="CASCADE"), nullable=False
    )
    value: Mapped[int] = mapped_column(Integer, nullable=False)
    override_modifier: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("character_id", "stat_definition_id", name="uq_character_stat"),
    )

    character: Mapped["Character"] = relationship("Character", back_populates="combat_stats")
    stat_definition: Mapped["StatDefinition"] = relationship("StatDefinition")


class CharacterSkill(Base):
    __tablename__ = "character_skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    character_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    skill_definition_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("skill_definitions.id", ondelete="CASCADE"), nullable=False
    )
    proficiency_type: Mapped[str] = mapped_column(
        Enum("none", "half", "full", "expertise", name="skill_proficiency_enum"),
        nullable=False,
        default="none",
    )
    additional_bonus: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("character_id", "skill_definition_id", name="uq_character_skill"),
    )

    character: Mapped["Character"] = relationship("Character", back_populates="combat_skills")
    skill_definition: Mapped["SkillDefinition"] = relationship("SkillDefinition")


# ── Turn-based damage templates ───────────────────────────────────────────────

class CharacterCombatTurn(Base):
    __tablename__ = "character_combat_turns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    character_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    turn_type: Mapped[str] = mapped_column(
        Enum("nova", "sustained", "variant", name="turn_type_enum"),
        nullable=False,
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    character: Mapped["Character"] = relationship("Character", back_populates="combat_turns")
    line_items: Mapped[list["CharacterCombatTurnLineItem"]] = relationship(
        "CharacterCombatTurnLineItem",
        back_populates="turn",
        cascade="all, delete-orphan",
        order_by="CharacterCombatTurnLineItem.sort_order",
    )


class CharacterCombatTurnLineItem(Base):
    __tablename__ = "character_combat_turn_line_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    turn_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("character_combat_turns.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    dice_notation: Mapped[str | None] = mapped_column(String(30), nullable=True)
    average_damage: Mapped[float] = mapped_column(Float, nullable=False)
    is_bonus_action: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    turn: Mapped["CharacterCombatTurn"] = relationship("CharacterCombatTurn", back_populates="line_items")
