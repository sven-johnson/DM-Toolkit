from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from ..auth import verify_token
from ..database import get_db
from ..models import Scene, SceneEnemy, SceneShopItem
from ..schemas import (
    SceneEnemyCreate,
    SceneEnemyOut,
    SceneEnemyUpdate,
    SceneOut,
    SceneShopItemCreate,
    SceneShopItemOut,
    SceneShopItemUpdate,
    SceneUpdate,
)

router = APIRouter()

SCENE_TYPES = {"story", "puzzle", "combat", "shop"}


@router.put("/{scene_id}", response_model=SceneOut)
def update_scene(
    scene_id: int,
    body: SceneUpdate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Scene:
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")

    data = body.model_dump(exclude_none=True)

    # When scene_type changes, clear non-applicable type-specific data
    new_type = data.get("scene_type")
    if new_type and new_type != scene.scene_type:
        if new_type not in SCENE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid scene_type: {new_type}"
            )
        if new_type != "combat":
            for enemy in scene.enemies:
                db.delete(enemy)
        if new_type != "shop":
            for item in scene.shop_items:
                db.delete(item)
        if new_type != "puzzle":
            scene.puzzle_clues = None
            scene.puzzle_solution = None

    for key, value in data.items():
        setattr(scene, key, value)

    db.commit()
    db.refresh(scene)
    return scene


@router.delete("/{scene_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scene(
    scene_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    db.delete(scene)
    db.commit()


# ---------------------------------------------------------------------------
# Enemies
# ---------------------------------------------------------------------------


@router.post(
    "/{scene_id}/enemies",
    response_model=SceneEnemyOut,
    status_code=status.HTTP_201_CREATED,
)
def add_enemy(
    scene_id: int,
    body: SceneEnemyCreate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> SceneEnemy:
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    order_index = db.query(SceneEnemy).filter(SceneEnemy.scene_id == scene_id).count()
    enemy = SceneEnemy(scene_id=scene_id, order_index=order_index, **body.model_dump())
    db.add(enemy)
    db.commit()
    db.refresh(enemy)
    return enemy


@router.put("/{scene_id}/enemies/{enemy_id}", response_model=SceneEnemyOut)
def update_enemy(
    scene_id: int,
    enemy_id: int,
    body: SceneEnemyUpdate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> SceneEnemy:
    enemy = (
        db.query(SceneEnemy)
        .filter(SceneEnemy.id == enemy_id, SceneEnemy.scene_id == scene_id)
        .first()
    )
    if not enemy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enemy not found")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(enemy, key, value)
    db.commit()
    db.refresh(enemy)
    return enemy


@router.delete("/{scene_id}/enemies/{enemy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_enemy(
    scene_id: int,
    enemy_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    enemy = (
        db.query(SceneEnemy)
        .filter(SceneEnemy.id == enemy_id, SceneEnemy.scene_id == scene_id)
        .first()
    )
    if not enemy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enemy not found")
    db.delete(enemy)
    db.commit()


# ---------------------------------------------------------------------------
# Shop items
# ---------------------------------------------------------------------------


@router.post(
    "/{scene_id}/shop-items",
    response_model=SceneShopItemOut,
    status_code=status.HTTP_201_CREATED,
)
def add_shop_item(
    scene_id: int,
    body: SceneShopItemCreate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> SceneShopItem:
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    order_index = db.query(SceneShopItem).filter(SceneShopItem.scene_id == scene_id).count()
    item = SceneShopItem(scene_id=scene_id, order_index=order_index, **body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{scene_id}/shop-items/{item_id}", response_model=SceneShopItemOut)
def update_shop_item(
    scene_id: int,
    item_id: int,
    body: SceneShopItemUpdate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> SceneShopItem:
    item = (
        db.query(SceneShopItem)
        .filter(SceneShopItem.id == item_id, SceneShopItem.scene_id == scene_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop item not found")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{scene_id}/shop-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shop_item(
    scene_id: int,
    item_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    item = (
        db.query(SceneShopItem)
        .filter(SceneShopItem.id == item_id, SceneShopItem.scene_id == scene_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop item not found")
    db.delete(item)
    db.commit()
