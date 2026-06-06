"""Factory for obtaining rule system implementations by slug."""
from __future__ import annotations

from .base import AbstractRuleSystem
from .dnd_5_5e import DnD55eRuleSystem

_REGISTRY: dict[str, AbstractRuleSystem] = {
    "dnd_5_5e": DnD55eRuleSystem(),
}


def get_rule_system(slug: str) -> AbstractRuleSystem:
    """Return the rule system implementation for the given slug.

    Raises ValueError if the slug is not registered.
    """
    rs = _REGISTRY.get(slug)
    if rs is None:
        raise ValueError(f"Unknown rule system: {slug!r}. Registered: {list(_REGISTRY)}")
    return rs


def get_default_rule_system() -> AbstractRuleSystem:
    """Return the default rule system (D&D 5.5e)."""
    return get_rule_system("dnd_5_5e")
