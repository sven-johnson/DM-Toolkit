import re
import uuid as uuid_lib
from typing import Optional

import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session as DBSession

from ..auth import verify_token
from ..database import get_db
from ..models import Campaign, Character
from ..schemas import CharacterCreate, CharacterOut, CharacterUpdate


def _parse_signed_int(s: str) -> int:
    m = re.search(r"([+-]?\d+)", s.strip())
    return int(m.group(1)) if m else 0


def parse_dnd_beyond_pdf(content: bytes) -> dict:
    """
    Parse a D&D Beyond character sheet PDF using PyMuPDF coordinate-based lookup.

    Confirmed against the actual 2024 D&D Beyond export (standard template).
    PyMuPDF extracts both template labels AND filled character values as text,
    unlike pdfplumber which only sees the template layer.

    Coordinate system: x0/y0 = top-left of bounding box, y increases downward.
    Page is standard letter size (~612 × 792 pts).

    Confirmed coordinate regions (with ±8 pt tolerance applied):
      Name box:         x=40-270,  y=50-90   (top-left, above CHARACTER NAME)
      Class+Level box:  x=265-460, y=45-75   (e.g. "Druid 4")
      Ability scores:   x=40-75,   y=label_y+5  to label_y+28  (bare integer)
      Ability mods:     x=40-75,   y=label_y+30 to label_y+58  (signed integer)
      Saving throws:    x=108-130, y=save_label_y±8             (signed integer)
      Skills:           x=108-130, y=skill_label_y±8            (signed integer)
      AC:               x=340-375, y=148-182  (between ARMOR and CLASS labels)
      Max HP:           x=425-465, y=148-165  (just below "Max HP" label)

    Subclass is extracted from the features text on page 2.
    """
    doc = fitz.open(stream=content, filetype="pdf")
    page1 = doc[0]
    words = page1.get_text("words")  # (x0, y0, x1, y1, text, block, line, word)

    def calc_mod(score: int) -> int:
        return (score - 10) // 2

    def find_in_box(
        x_min: float, x_max: float, y_min: float, y_max: float,
        pattern: str | None = None,
    ) -> str:
        """Return first word (sorted by y, then x) in the given rectangle."""
        hits: list[tuple[float, float, str]] = []
        for w in words:
            wx0, wy0, _, _, text = w[0], w[1], w[2], w[3], w[4]
            if x_min <= wx0 <= x_max and y_min <= wy0 <= y_max:
                if pattern is None or re.fullmatch(pattern, text):
                    hits.append((wy0, wx0, text))
        hits.sort()
        return hits[0][2] if hits else ""

    def find_all_in_box(
        x_min: float, x_max: float, y_min: float, y_max: float,
    ) -> list[str]:
        """Return all words (sorted by y, then x) in the given rectangle."""
        hits: list[tuple[float, float, str]] = []
        for w in words:
            wx0, wy0, _, _, text = w[0], w[1], w[2], w[3], w[4]
            if x_min <= wx0 <= x_max and y_min <= wy0 <= y_max:
                hits.append((wy0, wx0, text))
        hits.sort()
        return [h[2] for h in hits]

    # ── Name ──────────────────────────────────────────────────────────────
    # The character name sits in the large box at top-left (x<270, y<90).
    # Exclude words that are all-caps template labels.
    name = ""
    for w in sorted(words, key=lambda w: (w[1], w[0])):
        wx0, wy0, _, _, text = w[0], w[1], w[2], w[3], w[4]
        if wx0 < 270 and 45 < wy0 < 90 and not re.match(r"^[A-Z\s&]+$", text):
            name = text
            break

    # ── Class + Level ─────────────────────────────────────────────────────
    # "Druid 4" sits in the header box at x~270-460, y~45-75
    class_words = find_all_in_box(265, 460, 45, 75)
    char_class, level = "", 1
    class_str = " ".join(w for w in class_words if not re.match(r"^[A-Z\s&/]+$", w))
    m = re.match(r"^(.+?)\s+(\d{1,2})$", class_str.strip())
    if m:
        char_class = m.group(1).strip()
        level = int(m.group(2))

    # ── Ability scores + modifiers ────────────────────────────────────────
    # Ability label y0 positions (confirmed from real PDF):
    ABILITY_LABEL_Y: dict[str, float] = {
        "str": 149, "dex": 226, "con": 302,
        "int": 379, "wis": 455, "cha": 532,
    }
    scores: dict[str, int] = {}
    mods: dict[str, int] = {}

    for key, ly in ABILITY_LABEL_Y.items():
        # Score: bare integer, x=40-75, slightly below label
        s = find_in_box(40, 75, ly + 4, ly + 28, r"\d+")
        scores[key] = int(s) if s else 10
        # Modifier: signed integer, x=40-75, further below label
        mod_s = find_in_box(40, 75, ly + 29, ly + 58, r"[+-]\d+")
        mods[key] = int(mod_s) if mod_s else calc_mod(scores[key])

    # ── Saving throws ─────────────────────────────────────────────────────
    # The save modifier sits just to the left of the save name label (x~108-130).
    # Save name label y0 positions (confirmed):
    SAVE_LABEL_Y: dict[str, float] = {
        "str_save": 134, "dex_save": 147, "con_save": 161,
        "int_save": 174, "wis_save": 188, "cha_save": 201,
    }
    saves: dict[str, int] = {}
    for key, ly in SAVE_LABEL_Y.items():
        s = find_in_box(108, 130, ly - 5, ly + 10, r"[+-]?\d+")
        saves[key] = int(s) if s else 0

    # ── Skills ────────────────────────────────────────────────────────────
    # Skill modifier sits just to the left of the skill name label (x~108-130).
    # Skill label y0 positions (confirmed):
    SKILL_LABEL_Y: dict[str, float] = {
        "acrobatics":    304, "animal_handling": 317, "arcana":      331,
        "athletics":     344, "deception":       358, "history":     371,
        "insight":       385, "intimidation":    398, "investigation": 412,
        "medicine":      425, "nature":          439, "perception":  452,
        "performance":   466, "persuasion":      479, "religion":    493,
        "sleight_of_hand": 506, "stealth":       520, "survival":    533,
    }
    skills: dict[str, int] = {}
    for key, ly in SKILL_LABEL_Y.items():
        s = find_in_box(108, 130, ly - 5, ly + 10, r"[+-]?\d+")
        skills[key] = int(s) if s else 0

    # ── Armor Class ───────────────────────────────────────────────────────
    # AC value sits between ARMOR (y~142) and CLASS (y~182) labels, x~340-375.
    ac_s = find_in_box(340, 375, 148, 182, r"\d+")
    ac = int(ac_s) if ac_s else 10

    # ── Max HP ────────────────────────────────────────────────────────────
    # Max HP value sits just below the "Max HP" label (y~140), x~425-465.
    hp_s = find_in_box(425, 465, 148, 165, r"\d+")
    max_hp = int(hp_s) if hp_s else 1

    # ── Subclass ──────────────────────────────────────────────────────────
    # D&D Beyond puts "* <Class> Subclass" then "| <SubclassName>" on page 2.
    subclass = ""
    if len(doc) > 1:
        page2_lines = doc[1].get_text().splitlines()
        for i, ln in enumerate(page2_lines):
            if re.search(r"subclass", ln, re.IGNORECASE):
                for j in range(i + 1, min(i + 6, len(page2_lines))):
                    m2 = re.match(r"^\|\s+(.+?)(?:\s*\(.*\))?\s*$", page2_lines[j].strip())
                    if m2:
                        subclass = m2.group(1).strip()
                        break
            if subclass:
                break

    return {
        "name": name,
        "char_class": char_class,
        "subclass": subclass,
        "level": level,
        "str_score": scores["str"], "str_mod": mods["str"],
        "dex_score": scores["dex"], "dex_mod": mods["dex"],
        "con_score": scores["con"], "con_mod": mods["con"],
        "int_score": scores["int"], "int_mod": mods["int"],
        "wis_score": scores["wis"], "wis_mod": mods["wis"],
        "cha_score": scores["cha"], "cha_mod": mods["cha"],
        **skills,
        **saves,
        "ac": ac,
        "max_hp": max_hp,
    }

router = APIRouter()


@router.post(
    "/campaigns/{campaign_id}/characters",
    response_model=CharacterOut,
    status_code=status.HTTP_201_CREATED,
)
def create_character(
    campaign_id: int,
    body: CharacterCreate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Character:
    if not db.query(Campaign).filter(Campaign.id == campaign_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    character = Character(campaign_id=campaign_id, **body.model_dump())
    db.add(character)
    db.commit()
    db.refresh(character)
    return character


@router.get("/{character_id}", response_model=CharacterOut)
def get_character(
    character_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Character:
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
    return character


@router.put("/{character_id}", response_model=CharacterOut)
def update_character(
    character_id: int,
    body: CharacterUpdate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Character:
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(character, key, value)
    db.commit()
    db.refresh(character)
    return character


@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_character(
    character_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
    db.delete(character)
    db.commit()


@router.post("/import-pdf", response_model=CharacterOut, status_code=status.HTTP_201_CREATED)
async def import_character_pdf(
    campaign_id: int = Form(...),
    character_id: Optional[int] = Form(None),
    pdf_file: UploadFile = File(...),
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Character:
    """
    Parse a D&D Beyond character sheet PDF and create or overwrite a character.

    Form fields:
      campaign_id   – target campaign (required)
      character_id  – if provided, overwrite that character; else create new
      pdf_file      – the PDF file upload
    """
    if not db.query(Campaign).filter(Campaign.id == campaign_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    contents = await pdf_file.read()
    try:
        parsed = parse_dnd_beyond_pdf(contents)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not parse PDF: {exc}",
        ) from exc

    if character_id is not None:
        character = db.query(Character).filter(Character.id == character_id).first()
        if not character:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
        for key, value in parsed.items():
            setattr(character, key, value)
        db.commit()
        db.refresh(character)
        return character

    character = Character(campaign_id=campaign_id, **parsed)
    db.add(character)
    db.commit()
    db.refresh(character)
    return character
