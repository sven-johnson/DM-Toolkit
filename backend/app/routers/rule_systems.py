from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from ..database import get_db
from ..models import RuleSystem, SkillDefinition, StatDefinition
from ..schemas import RuleSystemOut

router = APIRouter()


class StatDefinitionOut(BaseModel):
    id: int; slug: str; name: str; abbreviation: str
    stat_type: str; has_modifier: bool; modifier_formula: str | None; sort_order: int
    model_config = {"from_attributes": True}


class SkillDefinitionOut(BaseModel):
    id: int; slug: str; name: str; governing_stat_id: int | None; sort_order: int
    model_config = {"from_attributes": True}


@router.get("", response_model=list[RuleSystemOut])
def list_rule_systems(db: DBSession = Depends(get_db)) -> list[RuleSystem]:
    return db.query(RuleSystem).order_by(RuleSystem.id).all()


@router.get("/{rule_system_id}/stat-definitions", response_model=list[StatDefinitionOut])
def list_stat_definitions(rule_system_id: int, db: DBSession = Depends(get_db)):
    if not db.query(RuleSystem).filter(RuleSystem.id == rule_system_id).first():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rule system not found")
    return (
        db.query(StatDefinition)
        .filter(StatDefinition.rule_system_id == rule_system_id)
        .order_by(StatDefinition.sort_order)
        .all()
    )


@router.get("/{rule_system_id}/skill-definitions", response_model=list[SkillDefinitionOut])
def list_skill_definitions(rule_system_id: int, db: DBSession = Depends(get_db)):
    if not db.query(RuleSystem).filter(RuleSystem.id == rule_system_id).first():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rule system not found")
    return (
        db.query(SkillDefinition)
        .filter(SkillDefinition.rule_system_id == rule_system_id)
        .order_by(SkillDefinition.sort_order)
        .all()
    )


