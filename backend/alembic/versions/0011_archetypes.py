"""creature archetype, combat role archetype, and ability flavor tables

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-21
"""

import json
import uuid

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Tables ───────────────────────────────────────────────────────────────────

    op.create_table(
        "creature_archetypes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("typical_traits", sa.JSON(), nullable=True),
        sa.Column("damage_immunities", sa.JSON(), nullable=True),
        sa.Column("damage_resistances", sa.JSON(), nullable=True),
        sa.Column("condition_immunities", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "combat_role_archetypes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("action_weight", sa.Float(), nullable=False),
        sa.Column("hp_share_tier", sa.String(10), nullable=False),
        sa.Column("ac_profile", sa.String(15), nullable=False),
        sa.Column("damage_profile", sa.String(10), nullable=False),
        sa.Column("is_boss_eligible", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_minion", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("default_attack_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("preferred_conditions", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.CheckConstraint(
            "hp_share_tier IN ('very_low', 'low', 'medium', 'high', 'very_high')",
            name="ck_combat_role_hp_share_tier",
        ),
        sa.CheckConstraint(
            "ac_profile IN ('low', 'medium_low', 'medium', 'medium_high', 'high')",
            name="ck_combat_role_ac_profile",
        ),
        sa.CheckConstraint(
            "damage_profile IN ('very_low', 'low', 'medium', 'high', 'very_high')",
            name="ck_combat_role_damage_profile",
        ),
        sa.CheckConstraint("action_weight > 0", name="ck_combat_role_action_weight"),
    )

    op.create_table(
        "ability_flavors",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("damage_type", sa.String(50), nullable=False),
        sa.Column("is_custom", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "ability_flavor_role_mappings",
        sa.Column(
            "ability_flavor_id",
            sa.String(36),
            sa.ForeignKey("ability_flavors.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "combat_role_archetype_id",
            sa.String(36),
            sa.ForeignKey("combat_role_archetypes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    op.create_table(
        "ability_flavor_creature_mappings",
        sa.Column(
            "ability_flavor_id",
            sa.String(36),
            sa.ForeignKey("ability_flavors.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "creature_archetype_id",
            sa.String(36),
            sa.ForeignKey("creature_archetypes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    # ── Seed data ────────────────────────────────────────────────────────────────

    conn = op.get_bind()

    def uid() -> str:
        return str(uuid.uuid4())

    def js(v: list) -> str:
        return json.dumps(v)

    # ── creature_archetypes ──────────────────────────────────────────────────────

    creatures_raw = [
        (
            "Aberrant",
            "Alien entities from beyond known reality, warping existence with psychic power and eldritch biology.",
            ["Telepathy", "Aberrant Ground", "Eldritch Form", "Alien Biology"],
            [],
            ["psychic"],
            ["charmed", "frightened"],
        ),
        (
            "Beast",
            "Natural animals and magical beasts relying on instinct, claws, and pack coordination.",
            ["Pack Tactics", "Keen Senses", "Pounce", "Multiattack"],
            [], [], [],
        ),
        (
            "Celestial",
            "Divine servants of the upper planes, wielding radiant power and healing grace.",
            ["Angelic Weapons", "Divine Awareness", "Healing Touch", "Radiant Aura"],
            ["radiant"],
            ["bludgeoning", "piercing", "slashing"],
            ["charmed", "exhaustion", "frightened"],
        ),
        (
            "Construct",
            "Magically animated objects and mechanical beings, immune to biological conditions.",
            ["Immutable Form", "Magic Resistance", "Constructed Nature", "Antimagic Susceptibility"],
            ["poison", "psychic"],
            ["bludgeoning", "piercing", "slashing"],
            ["charmed", "exhaustion", "frightened", "paralyzed", "poisoned"],
        ),
        (
            "Demon",
            "Chaotic evil outsiders from the Abyss, driven by destruction and corruption.",
            ["Magic Resistance", "Demonic Resilience", "Horrifying Visage", "Corruption Aura"],
            ["fire", "poison"],
            ["cold", "lightning"],
            ["charmed", "frightened", "poisoned"],
        ),
        (
            "Devil",
            "Lawful evil outsiders from the Nine Hells, bound by infernal contracts and cold malice.",
            ["Devil's Sight", "Magic Resistance", "Infernal Contracts", "Hellish Resilience"],
            ["fire"],
            ["cold", "bludgeoning", "piercing", "slashing"],
            [],
        ),
        (
            "Dragon",
            "Ancient and powerful wyrms with breath weapons, legendary actions, and lair-shaping presence.",
            ["Legendary Resistance", "Lair Actions", "Breath Weapon", "Frightful Presence"],
            [], [],
            ["frightened"],
        ),
        (
            "Djinn/Genie",
            "Elemental spirits of incredible power, bound to elemental planes and capable of wish-granting.",
            ["Elemental Demise", "Wishes", "Planar Travel", "Elemental Command"],
            [], [], [],
        ),
        (
            "Elemental",
            "Pure manifestations of elemental matter — fire, water, air, or earth — from the Inner Planes.",
            ["Elemental Nature", "Earth Glide", "Fire Form", "Water Form"],
            [], [],
            ["exhaustion", "paralyzed", "poisoned", "petrified"],
        ),
        (
            "Fey",
            "Mystical and capricious creatures of the Feywild, masters of charm and illusion.",
            ["Fey Ancestry", "Magic Resistance", "Innate Spellcasting", "Beguiling Presence"],
            [], [],
            ["charmed"],
        ),
        (
            "Giant",
            "Towering humanoid-like creatures with tremendous strength and the power to reshape terrain.",
            ["Giant's Strength", "Rock Catching", "Rune Magic", "Siege Monster"],
            [], [], [],
        ),
        (
            "Humanoid",
            "Sentient mortal creatures of countless species, varying widely in tactics and equipment.",
            ["Pack Tactics", "Spellcasting", "Martial Tactics", "Leadership"],
            [], [], [],
        ),
        (
            "Mythic Beast",
            "Legendary creatures of myth and story, often with multiple combat phases and unique abilities.",
            ["Legendary Actions", "Mythic Trait", "Regeneration", "Frightful Presence"],
            [],
            ["bludgeoning", "piercing", "slashing"],
            ["frightened"],
        ),
        (
            "Oni/Ogre",
            "Brutal large outsiders combining supernatural power with savage cunning and regenerative vitality.",
            ["Regeneration", "Shapeshifting", "Innate Spellcasting", "Brute Force"],
            [], [], [],
        ),
        (
            "Ooze",
            "Amorphous creatures that engulf prey, dissolve organic matter, and resist most physical harm.",
            ["Amorphous", "Engulf", "Corrosive Body", "Spider Climb"],
            ["acid"], [],
            ["blinded", "charmed", "deafened", "exhaustion", "frightened", "prone"],
        ),
        (
            "Plant",
            "Animated plant life ranging from shambling mounds to vine horrors, defending natural spaces.",
            ["False Appearance", "Entangle", "Spore Release", "Regrowth"],
            [], [],
            ["blinded", "deafened"],
        ),
        (
            "Shadow",
            "Creatures born of or bound to magical darkness, draining life and thriving in shadow.",
            ["Shadow Stealth", "Strength Drain", "Sunlight Sensitivity", "Create Spawn"],
            ["necrotic"],
            ["acid", "cold", "fire", "lightning", "thunder"],
            ["exhaustion", "frightened", "grappled", "prone"],
        ),
        (
            "Undead",
            "Animated dead or undead spirits driven by negative energy, often spreading disease and fear.",
            ["Undead Fortitude", "Undead Nature", "Turn Resistance", "Create Spawn"],
            ["necrotic", "poison"], [],
            ["charmed", "exhaustion", "frightened", "poisoned"],
        ),
        (
            "Asura",
            "Corrupted celestial warriors of destruction, wielding divine power twisted toward ruin.",
            ["Divine Corruption", "Spiritual Resonance", "Celestial Resilience", "Wrath Form"],
            [],
            ["radiant", "bludgeoning", "piercing", "slashing"],
            ["charmed", "frightened"],
        ),
    ]

    creature_ids: dict[str, str] = {}
    for name, desc, traits, immunities, resistances, cond_immunities in creatures_raw:
        cid = uid()
        creature_ids[name] = cid
        conn.execute(
            sa.text(
                "INSERT INTO creature_archetypes"
                " (id, name, description, typical_traits, damage_immunities, damage_resistances, condition_immunities)"
                " VALUES (:id, :name, :desc, :traits, :imm, :res, :cond)"
            ),
            {
                "id": cid,
                "name": name,
                "desc": desc,
                "traits": js(traits),
                "imm": js(immunities),
                "res": js(resistances),
                "cond": js(cond_immunities),
            },
        )

    # ── combat_role_archetypes ───────────────────────────────────────────────────
    # (name, desc, action_weight, hp_share_tier, ac_profile, damage_profile,
    #  is_boss_eligible, is_minion, default_attack_count, preferred_conditions)
    roles_raw = [
        (
            "Bruiser",
            "Heavy melee fighter dealing sustained high damage while absorbing punishment.",
            1.0, "high", "medium", "high", False, False, 2,
            ["grappled", "prone"],
        ),
        (
            "Skirmisher",
            "Mobile combatant using hit-and-run tactics, flanking, and mobility to maximize damage.",
            0.9, "medium", "medium", "medium", False, False, 2,
            ["frightened"],
        ),
        (
            "Tank",
            "Defensive frontliner absorbing damage and protecting allies with high armor and HP.",
            0.6, "very_high", "high", "low", False, False, 1,
            ["grappled", "restrained"],
        ),
        (
            "Archer",
            "Ranged attacker delivering consistent damage from a safe distance.",
            1.0, "medium", "medium_low", "medium", False, False, 2,
            ["frightened"],
        ),
        (
            "Caster",
            "Spellcaster dealing burst damage or applying powerful magical effects.",
            1.2, "low", "low", "high", False, False, 1,
            ["blinded", "stunned"],
        ),
        (
            "Controller",
            "Tactical combatant focused on imposing conditions and disrupting the battlefield.",
            1.1, "medium", "medium", "low", False, False, 1,
            ["restrained", "stunned", "incapacitated", "frightened"],
        ),
        (
            "Assassin",
            "Burst-damage specialist striking from hiding to deal massive single-target damage.",
            1.3, "low", "medium", "very_high", False, False, 1,
            ["blinded", "poisoned"],
        ),
        (
            "Support",
            "Enabler role providing healing, buffs, or debuffs rather than direct damage.",
            0.5, "medium", "medium_low", "very_low", False, False, 1,
            ["charmed"],
        ),
        (
            "Minion",
            "Individually weak fodder creature fighting in packs to overwhelm through numbers.",
            0.3, "very_low", "low", "low", False, True, 1,
            [],
        ),
        (
            "Boss",
            "Apex predator with legendary actions, lair effects, and overwhelming presence.",
            3.0, "very_high", "medium_high", "very_high", True, False, 3,
            ["frightened", "stunned"],
        ),
        (
            "Elite",
            "Lieutenant-tier creature with boss-like toughness but operating within normal action economy.",
            1.8, "high", "medium_high", "high", True, False, 2,
            ["grappled", "frightened"],
        ),
    ]

    role_ids: dict[str, str] = {}
    for (name, desc, action_weight, hp_tier, ac_prof, dmg_prof,
         boss_eligible, is_minion, atk_count, pref_cond) in roles_raw:
        rid = uid()
        role_ids[name] = rid
        conn.execute(
            sa.text(
                "INSERT INTO combat_role_archetypes"
                " (id, name, description, action_weight, hp_share_tier, ac_profile, damage_profile,"
                "  is_boss_eligible, is_minion, default_attack_count, preferred_conditions)"
                " VALUES (:id, :name, :desc, :aw, :hp, :ac, :dmg, :boss, :minion, :atk, :cond)"
            ),
            {
                "id": rid,
                "name": name,
                "desc": desc,
                "aw": action_weight,
                "hp": hp_tier,
                "ac": ac_prof,
                "dmg": dmg_prof,
                "boss": boss_eligible,
                "minion": is_minion,
                "atk": atk_count,
                "cond": js(pref_cond),
            },
        )

    # ── ability_flavors + mappings ───────────────────────────────────────────────
    # (name, damage_type, [roles], [creatures])
    flavors_raw = [
        # Slashing
        ("Slash",        "slashing", ["Bruiser", "Skirmisher"],        ["Beast", "Humanoid"]),
        ("Claw Strike",  "slashing", ["Bruiser", "Assassin"],          ["Beast", "Dragon", "Demon"]),
        ("Blade Flurry", "slashing", ["Skirmisher", "Assassin"],       ["Humanoid", "Fey"]),
        ("Rend",         "slashing", ["Bruiser"],                      ["Beast", "Dragon", "Demon", "Giant"]),
        ("Wing Slash",   "slashing", ["Skirmisher", "Elite"],          ["Dragon", "Mythic Beast"]),
        ("Whip Crack",   "slashing", ["Skirmisher", "Controller"],     ["Fey", "Humanoid"]),
        ("Dual Strike",  "slashing", ["Skirmisher", "Assassin"],       ["Humanoid"]),
        # Piercing
        ("Bite",         "piercing", ["Bruiser"],                      ["Beast", "Dragon", "Mythic Beast"]),
        ("Gore",         "piercing", ["Bruiser"],                      ["Beast", "Mythic Beast"]),
        ("Tail Sting",   "piercing", ["Assassin"],                     ["Beast", "Demon"]),
        ("Spine Shot",   "piercing", ["Archer"],                       ["Plant", "Beast"]),
        ("Tusk Charge",  "piercing", ["Bruiser"],                      ["Beast", "Giant", "Mythic Beast"]),
        ("Spear Throw",  "piercing", ["Archer"],                       ["Humanoid", "Giant"]),
        ("Dagger Strike","piercing", ["Assassin", "Skirmisher"],       ["Humanoid"]),
        ("Maw Strike",   "piercing", ["Bruiser"],                      ["Dragon", "Mythic Beast", "Beast"]),
        # Bludgeoning
        ("Slam",         "bludgeoning", ["Bruiser", "Tank"],           ["Construct", "Giant", "Undead"]),
        ("Tail Swipe",   "bludgeoning", ["Bruiser"],                   ["Dragon", "Beast"]),
        ("Stomp",        "bludgeoning", ["Bruiser"],                   ["Giant", "Construct"]),
        ("Rock Throw",   "bludgeoning", ["Archer"],                    ["Giant"]),
        ("Tentacle Strike","bludgeoning",["Controller"],               ["Aberrant", "Ooze"]),
        ("Constrict",    "bludgeoning", ["Controller"],                ["Beast", "Ooze"]),
        ("Crush",        "bludgeoning", ["Bruiser"],                   ["Giant", "Construct", "Ooze"]),
        ("Trample",      "bludgeoning", ["Bruiser"],                   ["Giant", "Beast"]),
        ("Pummel",       "bludgeoning", ["Bruiser"],                   ["Giant", "Humanoid"]),
        ("Grapple",      "bludgeoning", ["Controller"],                ["Beast", "Giant", "Ooze"]),
        ("Flail Sweep",  "bludgeoning", ["Bruiser"],                   ["Humanoid", "Giant"]),
        ("Wing Attack",  "bludgeoning", ["Skirmisher", "Elite"],       ["Dragon", "Mythic Beast"]),
        # Fire
        ("Scorching Ray","fire",        ["Caster", "Archer"],          ["Dragon", "Elemental", "Demon"]),
        ("Hellfire Bolt","fire",        ["Caster"],                    ["Devil", "Demon"]),
        ("Fire Breath",  "fire",        ["Bruiser", "Boss"],           ["Dragon", "Elemental"]),
        ("Ember Lash",   "fire",        ["Skirmisher"],                ["Elemental", "Fey", "Demon"]),
        ("Flame Strike", "fire",        ["Caster"],                    ["Celestial", "Demon", "Dragon"]),
        # Cold
        ("Frost Bolt",   "cold",        ["Caster", "Archer"],          ["Dragon", "Elemental", "Undead"]),
        ("Arctic Breath","cold",        ["Bruiser", "Boss"],           ["Dragon", "Elemental"]),
        ("Freezing Touch","cold",       ["Controller"],                ["Undead", "Elemental"]),
        ("Ice Spike",    "cold",        ["Archer", "Caster"],          ["Elemental", "Dragon"]),
        # Lightning
        ("Lightning Strike","lightning",["Caster"],                    ["Elemental", "Dragon", "Djinn/Genie"]),
        ("Arc Bolt",     "lightning",   ["Archer", "Caster"],          ["Elemental", "Djinn/Genie"]),
        ("Storm Surge",  "lightning",   ["Caster", "Controller"],      ["Elemental", "Dragon"]),
        # Thunder
        ("Thunder Slam", "thunder",     ["Bruiser"],                   ["Giant", "Elemental"]),
        ("Sonic Boom",   "thunder",     ["Caster"],                    ["Elemental", "Dragon", "Giant"]),
        ("Roar",         "thunder",     ["Controller"],                ["Dragon", "Beast", "Giant", "Mythic Beast"]),
        # Necrotic
        ("Shadow Strike","necrotic",    ["Assassin", "Skirmisher"],    ["Shadow", "Undead"]),
        ("Life Drain",   "necrotic",    ["Controller", "Assassin"],    ["Undead", "Shadow"]),
        ("Soul Rend",    "necrotic",    ["Caster"],                    ["Undead", "Shadow", "Demon"]),
        ("Grave Bolt",   "necrotic",    ["Archer", "Caster"],          ["Undead", "Shadow"]),
        ("Wither",       "necrotic",    ["Caster", "Controller"],      ["Shadow", "Undead"]),
        # Radiant
        ("Holy Strike",  "radiant",     ["Bruiser", "Caster"],         ["Celestial"]),
        ("Radiant Bolt", "radiant",     ["Archer", "Caster"],          ["Celestial"]),
        ("Divine Smite", "radiant",     ["Bruiser"],                   ["Celestial", "Humanoid"]),
        ("Sacred Flame", "radiant",     ["Caster"],                    ["Celestial"]),
        # Poison
        ("Poison Sting", "poison",      ["Assassin"],                  ["Beast", "Plant"]),
        ("Venomous Bite","poison",      ["Assassin"],                  ["Beast", "Ooze"]),
        ("Spore Cloud",  "poison",      ["Controller"],                ["Plant", "Ooze"]),
        ("Toxic Spit",   "poison",      ["Archer"],                    ["Beast", "Ooze", "Plant"]),
        # Acid
        ("Acid Splash",  "acid",        ["Caster", "Archer"],          ["Ooze", "Elemental"]),
        ("Corrosive Strike","acid",     ["Bruiser"],                   ["Ooze", "Elemental", "Construct"]),
        ("Engulf",       "acid",        ["Controller"],                ["Ooze"]),
        ("Spit Acid",    "acid",        ["Archer"],                    ["Ooze", "Dragon", "Beast"]),
        # Psychic
        ("Mind Spike",   "psychic",     ["Caster"],                    ["Aberrant", "Fey"]),
        ("Psychic Crush","psychic",     ["Caster", "Controller"],      ["Aberrant"]),
        ("Hex",          "psychic",     ["Controller"],                ["Fey", "Demon"]),
        ("Mental Assault","psychic",    ["Caster"],                    ["Aberrant", "Humanoid"]),
        # Force
        ("Force Bolt",       "force",   ["Caster"],                    ["Aberrant", "Celestial", "Humanoid"]),
        ("Arcane Strike",    "force",   ["Caster", "Skirmisher"],      ["Humanoid", "Fey"]),
        ("Telekinetic Slam", "force",   ["Controller"],                ["Aberrant", "Djinn/Genie"]),
    ]

    for name, damage_type, role_names, creature_names in flavors_raw:
        fid = uid()
        conn.execute(
            sa.text(
                "INSERT INTO ability_flavors (id, name, damage_type, is_custom)"
                " VALUES (:id, :name, :dt, FALSE)"
            ),
            {"id": fid, "name": name, "dt": damage_type},
        )
        for role_name in role_names:
            conn.execute(
                sa.text(
                    "INSERT INTO ability_flavor_role_mappings (ability_flavor_id, combat_role_archetype_id)"
                    " VALUES (:fid, :rid)"
                ),
                {"fid": fid, "rid": role_ids[role_name]},
            )
        for creature_name in creature_names:
            conn.execute(
                sa.text(
                    "INSERT INTO ability_flavor_creature_mappings (ability_flavor_id, creature_archetype_id)"
                    " VALUES (:fid, :cid)"
                ),
                {"fid": fid, "cid": creature_ids[creature_name]},
            )


def downgrade() -> None:
    op.drop_table("ability_flavor_creature_mappings")
    op.drop_table("ability_flavor_role_mappings")
    op.drop_table("ability_flavors")
    op.drop_table("combat_role_archetypes")
    op.drop_table("creature_archetypes")
