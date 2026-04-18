"""
Phonotactic Name Generator
==========================
Generates culturally-styled names based on phonotactic rules.
"""

import random
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SyllableTemplate:
    pattern: str
    weight: float = 1.0


@dataclass
class LanguageProfile:
    name: str
    display_name: str
    sound_classes: dict[str, list[tuple[str, float]]]
    syllable_templates: list[SyllableTemplate]
    transition_rules: dict[str, set[str]] = field(default_factory=dict)
    syllable_count: tuple[int, int] = (2, 3)
    capitalize_first: bool = True
    join_char: str = ""
    post_processors: list = field(default_factory=list)


class NameGenerator:
    def __init__(self, profile: LanguageProfile, seed: Optional[int] = None):
        self.profile = profile
        self.rng = random.Random(seed)

    def _weighted_choice(self, options: list[tuple[str, float]]) -> str:
        items, weights = zip(*options)
        return self.rng.choices(items, weights=weights, k=1)[0]

    def _pick_template(self) -> SyllableTemplate:
        templates = self.profile.syllable_templates
        weights = [t.weight for t in templates]
        return self.rng.choices(templates, weights=weights, k=1)[0]

    def _is_allowed(self, prev: str, candidate: str) -> bool:
        if not prev:
            return True
        forbidden = self.profile.transition_rules.get(prev, set())
        if candidate in forbidden:
            return False
        if len(prev) > 1 and prev == candidate:
            return False
        vowels = set("aeiouáéíóúäöüàèìòùâêîôûæøå")
        combined = (prev + candidate)
        consec = 0
        for ch in combined:
            if ch not in vowels:
                consec += 1
                if consec >= 3:
                    return False
            else:
                consec = 0
        return True

    def _pick_sound(self, slot: str, prev_grapheme: str = "") -> str:
        options = self.profile.sound_classes.get(slot, [])
        if not options:
            return ""
        allowed = [(g, w) for g, w in options if self._is_allowed(prev_grapheme, g)]
        if not allowed:
            allowed = options
        return self._weighted_choice(allowed)

    def _build_syllable(self, template: SyllableTemplate, prev_tail: str = "") -> tuple[str, str]:
        result = ""
        last = prev_tail
        for slot in template.pattern:
            grapheme = self._pick_sound(slot, last)
            result += grapheme
            if grapheme:
                last = grapheme
        return result, last

    def generate(self) -> str:
        p = self.profile
        syllable_count = self.rng.randint(*p.syllable_count)
        parts = []
        prev_tail = ""
        for _ in range(syllable_count):
            template = self._pick_template()
            syllable, prev_tail = self._build_syllable(template, prev_tail)
            parts.append(syllable)
        name = p.join_char.join(parts)
        for fn in p.post_processors:
            name = fn(name)
        if p.capitalize_first and name:
            name = name[0].upper() + name[1:]
        return name

    def generate_batch(self, count: int) -> list[str]:
        return [self.generate() for _ in range(count)]


def _w(graphemes: list[str], weight: float = 1.0) -> list[tuple[str, float]]:
    return [(g, weight) for g in graphemes]


def _wd(d: dict[str, float]) -> list[tuple[str, float]]:
    return list(d.items())


EN_GB = LanguageProfile(
    name="en_gb",
    display_name="British (Anglo-Saxon/Norman)",
    sound_classes={
        "C": _wd({
            "b": 2.0, "d": 2.5, "g": 2.0, "k": 2.0, "p": 1.5, "t": 3.0,
            "f": 2.0, "h": 1.5, "s": 3.0, "v": 1.0, "w": 2.0,
            "th": 1.0, "sh": 0.8, "ch": 0.6,
            "l": 2.5, "m": 2.0, "n": 2.0, "r": 2.5,
            "br": 0.5, "dr": 0.6, "gr": 0.5, "tr": 0.5,
            "sw": 0.4, "st": 0.6, "wh": 0.3,
        }),
        "V": _wd({
            "a": 3.0, "e": 3.0, "i": 2.5, "o": 2.0, "u": 1.5,
            "ea": 0.6, "ae": 0.4, "y": 0.5,
        }),
        "K": _wd({
            "d": 2.0, "n": 2.5, "r": 2.0, "s": 1.0, "t": 2.0,
            "ld": 0.6, "nd": 0.8, "rd": 0.5, "rn": 0.5,
            "th": 0.6, "": 2.5,
        }),
    },
    syllable_templates=[
        SyllableTemplate("CV",  weight=2.5),
        SyllableTemplate("CVC", weight=3.5),
        SyllableTemplate("CVK", weight=2.0),
        SyllableTemplate("VC",  weight=0.6),
        SyllableTemplate("V",   weight=0.4),
    ],
    transition_rules={
        "t": {"t"}, "d": {"d"}, "s": {"s", "sh"},
        "r": {"r", "w"}, "l": {"l"},
        "th": {"th", "d", "t"}, "n": {"n", "m"},
        "sh": {"sh", "ch"}, "ch": {"ch"},
    },
    syllable_count=(2, 3),
)

FR = LanguageProfile(
    name="fr",
    display_name="French (Romance/Gallic)",
    sound_classes={
        "C": _wd({
            "b": 1.5, "d": 2.0, "f": 1.5, "g": 1.0,
            "l": 3.0, "m": 2.5, "n": 2.5, "p": 2.0, "r": 2.5,
            "s": 2.5, "t": 2.5, "v": 1.5,
            "ch": 1.0, "qu": 0.8,
            "bl": 0.4, "fl": 0.4, "pl": 0.5, "tr": 0.6,
            "br": 0.4, "cr": 0.4, "pr": 0.5,
        }),
        "V": _wd({
            "a": 3.0, "e": 3.5, "i": 2.5, "o": 2.0, "u": 2.0,
            "é": 2.0, "è": 0.8,
            "ou": 1.2, "oi": 0.8,
            "ai": 0.8, "au": 0.6,
        }),
        "N": _wd({
            "n": 3.0, "m": 1.5,
            "": 3.0, "e": 1.5,
        }),
    },
    syllable_templates=[
        SyllableTemplate("CV",  weight=5.0),
        SyllableTemplate("CVN", weight=2.0),
        SyllableTemplate("CVC", weight=1.0),
        SyllableTemplate("V",   weight=0.8),
    ],
    transition_rules={
        "r": {"r"}, "l": {"l"},
        "qu": {"qu"}, "ch": {"ch"},
        "n": {"n"}, "m": {"m"},
    },
    syllable_count=(2, 3),
)

JA = LanguageProfile(
    name="ja",
    display_name="Japanese (Yamato/Sino-Japanese)",
    sound_classes={
        "C": _wd({
            "k": 3.0, "s": 2.5, "t": 3.0, "n": 3.0, "h": 2.5,
            "m": 3.0, "y": 1.0, "r": 3.0, "w": 0.8,
            "g": 1.5, "z": 0.8, "d": 1.5, "b": 1.0,
            "sh": 1.5, "ch": 1.0, "ts": 0.6,
            "ky": 0.5, "ry": 0.6, "my": 0.4, "ny": 0.4, "hy": 0.3,
        }),
        "V": _wd({
            "a": 3.5, "i": 3.0, "u": 2.5, "e": 2.5, "o": 2.5,
        }),
        "N": _wd({
            "": 5.0,
            "n": 2.0,
        }),
    },
    syllable_templates=[
        SyllableTemplate("CV",  weight=7.0),
        SyllableTemplate("CVN", weight=1.5),
        SyllableTemplate("V",   weight=1.5),
    ],
    transition_rules={
        "n": {"n", "y", "i"},
        "sh": {"sh", "ch"}, "ch": {"ch", "sh"},
        "ts": {"ts", "s"},
        "w": {"w", "i", "u"}, "y": {"y", "i"},
    },
    syllable_count=(2, 4),
)

DE = LanguageProfile(
    name="de",
    display_name="German (Germanic)",
    sound_classes={
        "C": _wd({
            "b": 2.0, "d": 2.0, "f": 2.0, "g": 2.5, "h": 2.0,
            "k": 2.5, "l": 2.5, "m": 2.5, "n": 2.0, "p": 1.5,
            "r": 2.5, "s": 2.5, "t": 3.0, "v": 1.0, "w": 2.0, "z": 1.0,
            "sch": 0.8, "ch": 0.6,
            "br": 0.5, "dr": 0.5, "fr": 0.5, "gr": 0.6, "tr": 0.6,
            "bl": 0.4, "fl": 0.4, "gl": 0.3, "kl": 0.3,
        }),
        "V": _wd({
            "a": 3.0, "e": 3.5, "i": 2.5, "o": 2.0, "u": 2.0,
            "ä": 0.8, "ö": 0.6, "ü": 0.6,
            "ei": 1.0, "au": 0.8, "ie": 0.8,
        }),
        "N": _wd({
            "n": 3.0, "m": 1.5, "nd": 0.8,
        }),
        "K": _wd({
            "d": 2.0, "g": 1.5, "k": 1.0, "r": 2.5, "t": 2.0,
            "ld": 0.6, "nd": 0.8, "rd": 0.5, "rg": 0.5,
            "": 2.0,
        }),
    },
    syllable_templates=[
        SyllableTemplate("CV",  weight=2.5),
        SyllableTemplate("CVC", weight=3.5),
        SyllableTemplate("CVN", weight=2.0),
        SyllableTemplate("CVK", weight=1.5),
        SyllableTemplate("V",   weight=0.5),
        SyllableTemplate("VC",  weight=0.6),
    ],
    transition_rules={
        "sch": {"sch", "ch"}, "ch": {"ch", "sch"},
        "r": {"r"}, "l": {"l"},
        "n": {"n", "m"}, "m": {"m"},
        "nd": {"n", "d"}, "ng": {"g", "k", "ng"},
    },
    syllable_count=(2, 3),
)

PROFILES: dict[str, LanguageProfile] = {
    "en_gb": EN_GB,
    "fr":    FR,
    "ja":    JA,
    "de":    DE,
}


def get_profile(name: str) -> LanguageProfile:
    if name not in PROFILES:
        raise ValueError(f"Unknown profile '{name}'. Available: {list(PROFILES.keys())}")
    return PROFILES[name]


def generate_name(profile_name: str, seed: Optional[int] = None) -> str:
    profile = get_profile(profile_name)
    gen = NameGenerator(profile, seed=seed)
    return gen.generate()


def generate_names(profile_name: str, count: int = 10, seed: Optional[int] = None) -> list[str]:
    profile = get_profile(profile_name)
    gen = NameGenerator(profile, seed=seed)
    return gen.generate_batch(count)
