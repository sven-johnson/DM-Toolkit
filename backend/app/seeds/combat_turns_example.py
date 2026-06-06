"""Seed example combat turns for the four campaign characters.

Idempotent — characters that already have turns are skipped.
Characters not found in the database are skipped with a warning.

Usage:
  cd backend
  python -m app.seeds.combat_turns_example
"""
from __future__ import annotations

import sys
from dataclasses import dataclass, field


# ── Turn specification data ────────────────────────────────────────────────────

@dataclass
class LineItemSpec:
    name: str
    average_damage: float
    dice_notation: str | None = None
    is_bonus_action: bool = False
    notes: str | None = None


@dataclass
class TurnSpec:
    name: str
    turn_type: str               # nova | sustained | variant
    is_primary: bool
    items: list[LineItemSpec] = field(default_factory=list)
    notes: str | None = None


CHARACTER_TURNS: dict[str, list[TurnSpec]] = {
    "Dutch": [
        TurnSpec(
            name="Nova",
            turn_type="nova",
            is_primary=True,
            notes="Best combo: Inflict Wounds on action, Spiritual Weapon as bonus",
            items=[
                LineItemSpec("Inflict Wounds L3",   27.5, dice_notation="5d10"),
                LineItemSpec("Spiritual Weapon L2", 16.5, dice_notation="3d8+3", is_bonus_action=True),
            ],
        ),
        TurnSpec(
            name="Sustained — Spirit Up",
            turn_type="sustained",
            is_primary=True,
            notes="Spiritual Weapon already concentration — maintain and melee",
            items=[
                LineItemSpec("Dutch's Dominating Flail", 6.5,  dice_notation="1d8+2"),
                LineItemSpec("Spiritual Weapon L2",      16.5, dice_notation="3d8+3", is_bonus_action=True),
            ],
        ),
        TurnSpec(
            name="Sustained — No Concentration",
            turn_type="variant",
            is_primary=False,
            notes="When concentration is needed for something else",
            items=[
                LineItemSpec("Dutch's Dominating Flail", 6.5, dice_notation="1d8+2"),
            ],
        ),
    ],

    "Tom Goes": [
        TurnSpec(
            name="Nova",
            turn_type="nova",
            is_primary=True,
            notes="Nick mastery: both dagger attacks are part of the Attack action",
            items=[
                LineItemSpec("Dagger 1 (Nick — Attack action)", 6.5,  dice_notation="1d4+4"),
                LineItemSpec("Dagger 2 (Nick — same action)",   6.5,  dice_notation="1d4+4"),
                LineItemSpec("Sneak Attack",                    10.5, dice_notation="3d6",
                             notes="On one hit per turn when ally adjacent or Steady Aim used"),
                LineItemSpec("Bonus action attack (Dual Wielder)", 6.5, dice_notation="1d4+4",
                             is_bonus_action=True),
            ],
        ),
        TurnSpec(
            name="Sustained",
            turn_type="sustained",
            is_primary=True,
            notes="Tom's nova and sustained are nearly identical — no spell slots",
            items=[
                LineItemSpec("Dagger 1 (Nick)", 6.5,  dice_notation="1d4+4"),
                LineItemSpec("Dagger 2 (Nick)", 6.5,  dice_notation="1d4+4"),
                LineItemSpec("Sneak Attack",    10.5, dice_notation="3d6",
                             notes="Sneak Attack available every turn with consistent ally positioning"),
                LineItemSpec("Bonus action attack", 6.5, dice_notation="1d4+4", is_bonus_action=True),
            ],
        ),
    ],

    "LADO": [
        TurnSpec(
            name="Nova",
            turn_type="nova",
            is_primary=True,
            notes="LADO is primarily utility/support — damage is modest. "
                  "Nova with a spell slot: Dissonant Whispers L2 (3d6 avg 10.5) "
                  "or Thunderwave L2 instead of Starry Wisp.",
            items=[
                LineItemSpec("Starry Wisp",                           9.0, dice_notation="2d8",
                             notes="Best single-target attack cantrip, spell attack +7"),
                LineItemSpec("Unarmed Strike (Dance + Bardic Insp.)", 6.5, dice_notation="1d8+2",
                             is_bonus_action=True,
                             notes="Agile Strikes: spend Bardic Inspiration for unarmed as bonus action"),
            ],
        ),
        TurnSpec(
            name="Sustained",
            turn_type="sustained",
            is_primary=True,
            notes="Reliable every turn, no resource cost",
            items=[
                LineItemSpec("Starry Wisp", 9.0, dice_notation="2d8"),
            ],
        ),
        TurnSpec(
            name="Nova — Spell Slot",
            turn_type="variant",
            is_primary=False,
            items=[
                LineItemSpec("Dissonant Whispers L2", 10.5, dice_notation="3d6",
                             notes="WIS 15 save — good against low-WIS targets"),
                LineItemSpec("Unarmed Strike (Agile Strikes)", 6.5, dice_notation="1d8+2",
                             is_bonus_action=True),
            ],
        ),
    ],

    "Verso": [
        TurnSpec(
            name="Nova — Spirit Active",
            turn_type="nova",
            is_primary=True,
            notes="Requires action to summon spirit AND cast Burning Hands via Enhanced Bond "
                  "— 2-action combo only possible via the spirit's ruling",
            items=[
                LineItemSpec("Summon Wildfire Spirit", 17.5,
                             notes="Action to summon: spirit deals 2d6 on appear (avg 7), "
                                   "each nearby creature Dex save DC 13 or 1d6+3 fire. "
                                   "Use avg 10.5 for one target hit."),
                LineItemSpec("Burning Hands L3 (Enhanced Bond)", 22.0, dice_notation="5d6+1d8",
                             notes="Enhanced Bond: fire spells can originate from spirit and add 1d8 "
                                   "while spirit active. 5d6 avg 17.5 + 1d8 avg 4.5 = 22. "
                                   "Dex save DC 13 half."),
            ],
        ),
        TurnSpec(
            name="Nova — No Spirit",
            turn_type="nova",
            is_primary=False,
            items=[
                LineItemSpec("Scorching Ray L3", 21.0, dice_notation="6d6",
                             notes="3 rays × 2d6, spell attack +5 each. Avg assumes all hit."),
            ],
        ),
        TurnSpec(
            name="Sustained — Spirit Active",
            turn_type="sustained",
            is_primary=True,
            items=[
                LineItemSpec("Produce Flame", 9.0, dice_notation="2d8",
                             notes="Cantrip, ranged spell attack +5, 60ft range"),
                LineItemSpec("Spirit command", 6.5, dice_notation="1d6+3",
                             is_bonus_action=True,
                             notes="Bonus action to command spirit each turn: Dex save DC 13 or 1d6+3 fire"),
            ],
        ),
        TurnSpec(
            name="Sustained — No Spirit",
            turn_type="sustained",
            is_primary=False,
            items=[
                LineItemSpec("Produce Flame", 9.0, dice_notation="2d8"),
            ],
        ),
    ],
}


# ── Seed function ──────────────────────────────────────────────────────────────

def seed_combat_turns() -> None:
    """Seed example combat turns.  Idempotent — safe to call repeatedly."""
    import os
    from pathlib import Path

    # Load .env if not already set (for running outside uvicorn)
    if not os.environ.get("DATABASE_URL"):
        env_path = Path(__file__).parent.parent.parent / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip())

    from ..database import get_db
    from ..models import Character, CharacterCombatTurn, CharacterCombatTurnLineItem

    db = next(get_db())
    try:
        for char_name, turns_spec in CHARACTER_TURNS.items():
            char = db.query(Character).filter(Character.name == char_name).first()
            if not char:
                print(f"  SKIP  {char_name!r} — not found in database", file=sys.stderr)
                continue

            existing = db.query(CharacterCombatTurn).filter(
                CharacterCombatTurn.character_id == char.id
            ).count()
            if existing > 0:
                print(f"  SKIP  {char_name!r} — already has {existing} turn(s)")
                continue

            for sort_idx, spec in enumerate(turns_spec):
                turn = CharacterCombatTurn(
                    character_id=char.id,
                    name=spec.name,
                    turn_type=spec.turn_type,
                    is_primary=spec.is_primary,
                    notes=spec.notes,
                    sort_order=sort_idx,
                )
                db.add(turn)
                db.flush()

                for item_idx, item in enumerate(spec.items):
                    db.add(CharacterCombatTurnLineItem(
                        turn_id=turn.id,
                        name=item.name,
                        dice_notation=item.dice_notation,
                        average_damage=item.average_damage,
                        is_bonus_action=item.is_bonus_action,
                        notes=item.notes,
                        sort_order=item_idx,
                    ))

            db.commit()
            totals = ", ".join(
                f"{s.name}={sum(i.average_damage for i in s.items):.1f}"
                for s in turns_spec
                if s.is_primary
            )
            print(f"  OK    {char_name!r} — seeded {len(turns_spec)} turn(s). Primary totals: {totals}")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding combat turns…")
    seed_combat_turns()
    print("Done.")
