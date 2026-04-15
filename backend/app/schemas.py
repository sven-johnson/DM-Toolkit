from datetime import date as DateType
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Character
# ---------------------------------------------------------------------------


class CharacterCreate(BaseModel):
    name: str = ""
    char_class: str = ""
    subclass: str = ""
    level: int = 1
    str_score: int = 10
    dex_score: int = 10
    con_score: int = 10
    int_score: int = 10
    wis_score: int = 10
    cha_score: int = 10
    str_mod: int = 0
    dex_mod: int = 0
    con_mod: int = 0
    int_mod: int = 0
    wis_mod: int = 0
    cha_mod: int = 0
    acrobatics: int = 0
    animal_handling: int = 0
    arcana: int = 0
    athletics: int = 0
    deception: int = 0
    history: int = 0
    insight: int = 0
    intimidation: int = 0
    investigation: int = 0
    medicine: int = 0
    nature: int = 0
    perception: int = 0
    performance: int = 0
    persuasion: int = 0
    religion: int = 0
    sleight_of_hand: int = 0
    stealth: int = 0
    survival: int = 0
    str_save: int = 0
    dex_save: int = 0
    con_save: int = 0
    int_save: int = 0
    wis_save: int = 0
    cha_save: int = 0
    ac: int = 10
    max_hp: int = 1


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    char_class: Optional[str] = None
    subclass: Optional[str] = None
    level: Optional[int] = None
    str_score: Optional[int] = None
    dex_score: Optional[int] = None
    con_score: Optional[int] = None
    int_score: Optional[int] = None
    wis_score: Optional[int] = None
    cha_score: Optional[int] = None
    str_mod: Optional[int] = None
    dex_mod: Optional[int] = None
    con_mod: Optional[int] = None
    int_mod: Optional[int] = None
    wis_mod: Optional[int] = None
    cha_mod: Optional[int] = None
    acrobatics: Optional[int] = None
    animal_handling: Optional[int] = None
    arcana: Optional[int] = None
    athletics: Optional[int] = None
    deception: Optional[int] = None
    history: Optional[int] = None
    insight: Optional[int] = None
    intimidation: Optional[int] = None
    investigation: Optional[int] = None
    medicine: Optional[int] = None
    nature: Optional[int] = None
    perception: Optional[int] = None
    performance: Optional[int] = None
    persuasion: Optional[int] = None
    religion: Optional[int] = None
    sleight_of_hand: Optional[int] = None
    stealth: Optional[int] = None
    survival: Optional[int] = None
    str_save: Optional[int] = None
    dex_save: Optional[int] = None
    con_save: Optional[int] = None
    int_save: Optional[int] = None
    wis_save: Optional[int] = None
    cha_save: Optional[int] = None
    ac: Optional[int] = None
    max_hp: Optional[int] = None


class CharacterOut(BaseModel):
    id: int
    campaign_id: int
    name: str
    char_class: str
    subclass: str
    level: int
    str_score: int
    dex_score: int
    con_score: int
    int_score: int
    wis_score: int
    cha_score: int
    str_mod: int
    dex_mod: int
    con_mod: int
    int_mod: int
    wis_mod: int
    cha_mod: int
    acrobatics: int
    animal_handling: int
    arcana: int
    athletics: int
    deception: int
    history: int
    insight: int
    intimidation: int
    investigation: int
    medicine: int
    nature: int
    perception: int
    performance: int
    persuasion: int
    religion: int
    sleight_of_hand: int
    stealth: int
    survival: int
    str_save: int
    dex_save: int
    con_save: int
    int_save: int
    wis_save: int
    cha_save: int
    ac: int
    max_hp: int

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Roll
# ---------------------------------------------------------------------------


class RollUpsert(BaseModel):
    die_result: int


class RollOut(BaseModel):
    id: int
    check_id: int
    character_id: int
    die_result: int

    model_config = {"from_attributes": True}


class SessionRollOut(BaseModel):
    id: int
    check_id: int
    character_id: int
    die_result: int
    check_type: str
    subtype: str
    dc: int

    model_config = {"from_attributes": True}


class RollHistoryItem(BaseModel):
    id: int
    die_result: int
    character_id: int
    check_id: int
    check_type: str
    subtype: str
    dc: int
    character_ids: list[int]
    scene_id: int
    scene_title: str
    session_id: Optional[int] = None
    session_title: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Check
# ---------------------------------------------------------------------------


class CheckCreate(BaseModel):
    scene_id: int
    check_type: str
    subtype: str
    dc: int = 10
    character_ids: list[int] = []


class CheckUpdate(BaseModel):
    check_type: Optional[str] = None
    subtype: Optional[str] = None
    dc: Optional[int] = None
    character_ids: Optional[list[int]] = None
    order_index: Optional[int] = None


class CheckOut(BaseModel):
    id: int
    scene_id: int
    check_type: str
    subtype: str
    dc: int
    character_ids: list[int]
    order_index: int

    model_config = {"from_attributes": True}


class CheckWithRolls(CheckOut):
    rolls: list[RollOut] = []


# ---------------------------------------------------------------------------
# Scene enemies & shop items
# ---------------------------------------------------------------------------


class SceneEnemyCreate(BaseModel):
    name: str = ""
    quantity: int = 1


class SceneEnemyUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[int] = None


class SceneEnemyOut(BaseModel):
    id: int
    scene_id: int
    name: str
    quantity: int
    order_index: int

    model_config = {"from_attributes": True}


class SceneShopItemCreate(BaseModel):
    name: str = ""
    description: str = ""
    price: int = 0
    currency: str = "gold"


class SceneShopItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[int] = None
    currency: Optional[str] = None


class SceneShopItemOut(BaseModel):
    id: int
    scene_id: int
    name: str
    description: Optional[str]
    price: int
    currency: str
    order_index: int

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Scene
# ---------------------------------------------------------------------------


class SceneCreate(BaseModel):
    title: str
    body: str = ""
    dm_notes: str = ""
    scene_type: str = "story"


class SceneUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    dm_notes: Optional[str] = None
    scene_type: Optional[str] = None
    puzzle_clues: Optional[str] = None
    puzzle_solution: Optional[str] = None


class SceneOut(BaseModel):
    id: int
    uuid: str
    storyline_id: int
    title: str
    body: str
    dm_notes: Optional[str]
    scene_type: str
    puzzle_clues: Optional[str]
    puzzle_solution: Optional[str]
    order_index: int
    created_at: datetime
    updated_at: datetime
    checks: list[CheckWithRolls] = []
    enemies: list[SceneEnemyOut] = []
    shop_items: list[SceneShopItemOut] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Storyline
# ---------------------------------------------------------------------------


class StorylineCreate(BaseModel):
    title: str
    description: Optional[str] = None


class StorylineUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class StorylineOut(BaseModel):
    id: int
    uuid: str
    campaign_id: int
    title: str
    description: Optional[str]
    order_index: int
    created_at: datetime

    model_config = {"from_attributes": True}


class StorylineWithScenes(StorylineOut):
    scenes: list[SceneOut] = []


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------


class SessionCreate(BaseModel):
    title: str
    date: Optional[DateType] = None
    storyline_id: Optional[int] = None


class SessionUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[DateType] = None
    recap_notes: Optional[str] = None
    active_storyline_id: Optional[int] = None


class SessionOut(BaseModel):
    id: int
    uuid: str
    campaign_id: int
    title: str
    date: Optional[DateType]
    recap_notes: Optional[str]
    active_storyline_id: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionWithScenes(SessionOut):
    scenes: list[SceneOut] = []


# ---------------------------------------------------------------------------
# Campaign
# ---------------------------------------------------------------------------


class CampaignCreate(BaseModel):
    name: str


class CampaignUpdate(BaseModel):
    name: Optional[str] = None


class CampaignOut(BaseModel):
    id: int
    uuid: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CampaignWithRelations(CampaignOut):
    storylines: list[StorylineOut] = []


# ---------------------------------------------------------------------------
# Reorder
# ---------------------------------------------------------------------------


class SceneReorder(BaseModel):
    scene_ids: list[int]


class CheckReorder(BaseModel):
    check_ids: list[int]


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    username: str


class UpdateUsernameRequest(BaseModel):
    current_password: str
    new_username: str


class UpdatePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


# ---------------------------------------------------------------------------
# Wiki
# ---------------------------------------------------------------------------


class WikiArticleCreate(BaseModel):
    campaign_id: int
    title: str
    category: str = "other"
    is_stub: bool = False
    image_url: Optional[str] = None
    tags: Optional[list[str]] = None
    public_content: str = ""
    private_content: str = ""


class WikiArticleUpdate(BaseModel):
    title: str
    category: str
    is_stub: bool
    image_url: Optional[str]
    tags: Optional[list[str]]
    public_content: str
    private_content: str


class WikiArticleOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    campaign_id: int
    title: str
    category: str
    is_stub: bool
    image_url: Optional[str]
    tags: Optional[list[str]]
    public_content: str
    private_content: str
    created_at: datetime
    updated_at: datetime


class WikiSearchResult(BaseModel):
    id: int
    title: str
    category: str
    tags: Optional[list[str]] = None
    is_stub: bool
    snippet: Optional[str] = None


class WikiAssociationDisplay(BaseModel):
    id: int
    association_label: str
    other_article_id: int
    other_article_title: str
    other_article_category: str
    direction: str  # 'from' (this article is source) | 'to' (this article is target)


class WikiArticleDetail(WikiArticleOut):
    associations: list[WikiAssociationDisplay] = []


class WikiAddAssociationRequest(BaseModel):
    target_title: str
    target_category: str = "other"
    association_label: str


class WikiAddAssociationResult(BaseModel):
    association_id: int
    stub_created: bool
    stub_article_id: Optional[int] = None


class WikiImportAssociation(BaseModel):
    target_title: str
    target_category: str = "other"
    association_label: str


class WikiImportArticle(BaseModel):
    title: str
    category: str = "other"
    is_stub: bool = False
    image_url: Optional[str] = None
    tags: Optional[list[str]] = None
    public_content: str = ""
    private_content: str = ""
    associations: list[WikiImportAssociation] = []


class WikiImportRequest(BaseModel):
    campaign_id: int
    articles: list[WikiImportArticle]


class WikiImportResult(BaseModel):
    created: int
    updated: int
    stubs_created: int
    errors: list[str]


class WikiExportAssociation(BaseModel):
    target_title: str
    target_category: str
    association_label: str


class WikiExportArticle(BaseModel):
    title: str
    category: str
    is_stub: bool
    image_url: Optional[str]
    tags: Optional[list[str]]
    public_content: str
    private_content: str
    associations: list[WikiExportAssociation]


class WikiExportResponse(BaseModel):
    campaign_id: int
    articles: list[WikiExportArticle]


# ---------------------------------------------------------------------------
# Storyline import/export
# ---------------------------------------------------------------------------


class StorylineExportEnemy(BaseModel):
    name: str
    quantity: int


class StorylineExportShopItem(BaseModel):
    name: str
    description: Optional[str] = None
    price: int
    currency: str


class StorylineExportScene(BaseModel):
    title: str
    body: str
    dm_notes: Optional[str] = None
    scene_type: str
    puzzle_clues: Optional[str] = None
    puzzle_solution: Optional[str] = None
    enemies: list[StorylineExportEnemy] = []
    shop_items: list[StorylineExportShopItem] = []


class StorylineExportItem(BaseModel):
    title: str
    description: Optional[str] = None
    scenes: list[StorylineExportScene] = []


class StorylineExportResponse(BaseModel):
    campaign_id: int
    storylines: list[StorylineExportItem]


# Import uses the same scene/storyline shape as export
class StorylineImportScene(BaseModel):
    title: str
    body: str = ""
    dm_notes: Optional[str] = None
    scene_type: str = "story"
    puzzle_clues: Optional[str] = None
    puzzle_solution: Optional[str] = None
    enemies: list[StorylineExportEnemy] = []
    shop_items: list[StorylineExportShopItem] = []


class StorylineImportItem(BaseModel):
    title: str
    description: Optional[str] = None
    scenes: list[StorylineImportScene] = []


class StorylineImportRequest(BaseModel):
    campaign_id: int
    storylines: list[StorylineImportItem]


class StorylineImportResult(BaseModel):
    storylines_created: int
    storylines_updated: int
    scenes_created: int
    scenes_updated: int
    errors: list[str] = []
