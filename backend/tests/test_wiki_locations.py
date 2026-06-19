"""
Tests for wiki location features:
- location_subtype field on wiki articles (CRUD)
- GET /wiki/locations endpoint (tree data)
- POST /wiki/{id}/associations/as-target (reverse-direction association)
- other_article_location_subtype in WikiAssociationDisplay
- faction_org category
"""

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def campaign_id(client: TestClient, auth_headers: dict) -> str:
    resp = client.post(
        "/campaigns", json={"name": "Test Campaign"}, headers=auth_headers
    )
    assert resp.status_code == 201
    return resp.json()["id"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_article(
    client: TestClient,
    auth_headers: dict,
    campaign_id: str,
    title: str,
    category: str = "other",
    location_subtype: str | None = None,
) -> dict:
    payload: dict = {
        "campaign_id": campaign_id,
        "title": title,
        "category": category,
    }
    if location_subtype is not None:
        payload["location_subtype"] = location_subtype
    resp = client.post("/wiki", json=payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def make_location(
    client: TestClient,
    auth_headers: dict,
    campaign_id: str,
    title: str,
    subtype: str | None = None,
) -> dict:
    return make_article(client, auth_headers, campaign_id, title, "location", subtype)


def add_association(
    client: TestClient,
    auth_headers: dict,
    source_id: str,
    target_title: str,
    label: str,
    target_category: str = "location",
) -> dict:
    resp = client.post(
        f"/wiki/{source_id}/associations",
        json={
            "target_title": target_title,
            "target_category": target_category,
            "association_label": label,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def add_as_target(
    client: TestClient,
    auth_headers: dict,
    target_id: str,
    source_title: str,
    label: str,
    source_category: str = "location",
) -> dict:
    resp = client.post(
        f"/wiki/{target_id}/associations/as-target",
        json={
            "source_title": source_title,
            "source_category": source_category,
            "association_label": label,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def get_article(client: TestClient, auth_headers: dict, article_id: str) -> dict:
    resp = client.get(f"/wiki/{article_id}", headers=auth_headers)
    assert resp.status_code == 200
    return resp.json()


def get_locations(client: TestClient, auth_headers: dict, campaign_id: str) -> list[dict]:
    resp = client.get(
        "/wiki/locations", params={"campaign_id": campaign_id}, headers=auth_headers
    )
    assert resp.status_code == 200
    return resp.json()


# ---------------------------------------------------------------------------
# location_subtype field — CRUD
# ---------------------------------------------------------------------------


class TestLocationSubtype:

    def test_create_with_subtype_world(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        body = make_location(client, auth_headers, campaign_id, "Faerûn", "world")
        assert body["location_subtype"] == "world"
        assert body["category"] == "location"

    def test_create_without_subtype_is_null(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        body = make_location(client, auth_headers, campaign_id, "Somewhere")
        assert body["location_subtype"] is None

    def test_non_location_category_has_null_subtype(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        body = make_article(client, auth_headers, campaign_id, "Goblin King", "npc")
        assert body["location_subtype"] is None

    def test_all_valid_subtypes_accepted(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        for subtype in ("world", "kingdom", "city", "district", "scene"):
            body = make_location(client, auth_headers, campaign_id, f"Place {subtype}", subtype)
            assert body["location_subtype"] == subtype

    def test_subtype_returned_on_get(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        article = make_location(client, auth_headers, campaign_id, "The Realm", "kingdom")
        detail = get_article(client, auth_headers, article["id"])
        assert detail["location_subtype"] == "kingdom"

    def test_update_sets_subtype(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        article = make_location(client, auth_headers, campaign_id, "Port Nyanzaru")
        resp = client.put(
            f"/wiki/{article['id']}",
            json={
                "title": "Port Nyanzaru",
                "category": "location",
                "location_subtype": "city",
                "is_stub": False,
                "image_url": None,
                "tags": None,
                "public_content": "",
                "private_content": "",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["location_subtype"] == "city"

    def test_update_clears_subtype(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        article = make_location(client, auth_headers, campaign_id, "Waterdeep", "city")
        resp = client.put(
            f"/wiki/{article['id']}",
            json={
                "title": "Waterdeep",
                "category": "location",
                "location_subtype": None,
                "is_stub": False,
                "image_url": None,
                "tags": None,
                "public_content": "",
                "private_content": "",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["location_subtype"] is None


# ---------------------------------------------------------------------------
# GET /wiki/locations
# ---------------------------------------------------------------------------


class TestLocationsEndpoint:

    def test_empty_when_no_location_articles(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        assert get_locations(client, auth_headers, campaign_id) == []

    def test_returns_only_location_category(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        make_location(client, auth_headers, campaign_id, "The World", "world")
        make_article(client, auth_headers, campaign_id, "Goblin NPC", "npc")
        make_article(client, auth_headers, campaign_id, "Dark Lord Faction", "faction")

        locs = get_locations(client, auth_headers, campaign_id)
        titles = {a["title"] for a in locs}
        assert "The World" in titles
        assert "Goblin NPC" not in titles
        assert "Dark Lord Faction" not in titles

    def test_returns_location_subtype_on_articles(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        make_location(client, auth_headers, campaign_id, "Toril", "world")
        make_location(client, auth_headers, campaign_id, "Cormyr", "kingdom")

        by_title = {a["title"]: a for a in get_locations(client, auth_headers, campaign_id)}
        assert by_title["Toril"]["location_subtype"] == "world"
        assert by_title["Cormyr"]["location_subtype"] == "kingdom"

    def test_articles_include_associations(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        world = make_location(client, auth_headers, campaign_id, "Oerth", "world")
        kingdom = make_location(client, auth_headers, campaign_id, "Keoland", "kingdom")
        add_association(client, auth_headers, world["id"], kingdom["title"], "kingdom")

        by_title = {a["title"]: a for a in get_locations(client, auth_headers, campaign_id)}
        world_assocs = by_title["Oerth"]["associations"]
        assert len(world_assocs) == 1
        assert world_assocs[0]["other_article_title"] == "Keoland"
        assert world_assocs[0]["association_label"] == "kingdom"
        assert world_assocs[0]["direction"] == "from"

    def test_associations_include_other_article_location_subtype(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        world = make_location(client, auth_headers, campaign_id, "Oerth", "world")
        kingdom = make_location(client, auth_headers, campaign_id, "Keoland", "kingdom")
        add_association(client, auth_headers, world["id"], kingdom["title"], "kingdom")

        by_title = {a["title"]: a for a in get_locations(client, auth_headers, campaign_id)}
        assert by_title["Oerth"]["associations"][0]["other_article_location_subtype"] == "kingdom"
        assert by_title["Keoland"]["associations"][0]["other_article_location_subtype"] == "world"

    def test_results_sorted_alphabetically(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        for title in ("Zephyrland", "Arcadia", "Midara"):
            make_location(client, auth_headers, campaign_id, title, "kingdom")

        titles = [a["title"] for a in get_locations(client, auth_headers, campaign_id)]
        assert titles == sorted(titles)

    def test_route_not_shadowed_by_article_id_route(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        """GET /wiki/locations must not be captured by GET /wiki/{article_id}."""
        resp = client.get(
            "/wiki/locations", params={"campaign_id": campaign_id}, headers=auth_headers
        )
        # Should return 200 with a list, not 404 ("Article not found")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


# ---------------------------------------------------------------------------
# POST /wiki/{id}/associations/as-target
# ---------------------------------------------------------------------------


class TestAddAssociationAsTarget:

    def test_creates_incoming_association_on_target(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        world = make_location(client, auth_headers, campaign_id, "Toril", "world")
        kingdom = make_location(client, auth_headers, campaign_id, "Cormyr", "kingdom")

        add_as_target(client, auth_headers, kingdom["id"], "Toril", "kingdom")

        # Kingdom should see World as an INCOMING association
        detail = get_article(client, auth_headers, kingdom["id"])
        assoc = next(a for a in detail["associations"] if a["association_label"] == "kingdom")
        assert assoc["direction"] == "to"
        assert assoc["other_article_title"] == "Toril"
        assert assoc["other_article_id"] == world["id"]

    def test_creates_outgoing_association_on_source(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        world = make_location(client, auth_headers, campaign_id, "Toril", "world")
        kingdom = make_location(client, auth_headers, campaign_id, "Cormyr", "kingdom")

        add_as_target(client, auth_headers, kingdom["id"], "Toril", "kingdom")

        # World should see Kingdom as an OUTGOING association
        detail = get_article(client, auth_headers, world["id"])
        assoc = next(a for a in detail["associations"] if a["association_label"] == "kingdom")
        assert assoc["direction"] == "from"
        assert assoc["other_article_title"] == "Cormyr"

    def test_creates_stub_when_source_not_found(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        kingdom = make_location(client, auth_headers, campaign_id, "Cormyr", "kingdom")

        result = add_as_target(client, auth_headers, kingdom["id"], "New World", "kingdom")
        assert result["stub_created"] is True
        assert result["stub_article_id"] is not None

        stub = get_article(client, auth_headers, result["stub_article_id"])
        assert stub["title"] == "New World"
        assert stub["is_stub"] is True

    def test_no_stub_when_source_exists(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        make_location(client, auth_headers, campaign_id, "Toril", "world")
        kingdom = make_location(client, auth_headers, campaign_id, "Cormyr", "kingdom")

        result = add_as_target(client, auth_headers, kingdom["id"], "Toril", "kingdom")
        assert result["stub_created"] is False
        assert result["stub_article_id"] is None

    def test_duplicate_returns_409(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        make_location(client, auth_headers, campaign_id, "Toril", "world")
        kingdom = make_location(client, auth_headers, campaign_id, "Cormyr", "kingdom")

        add_as_target(client, auth_headers, kingdom["id"], "Toril", "kingdom")

        resp = client.post(
            f"/wiki/{kingdom['id']}/associations/as-target",
            json={"source_title": "Toril", "source_category": "location", "association_label": "kingdom"},
            headers=auth_headers,
        )
        assert resp.status_code == 409

    def test_article_not_found_returns_404(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        resp = client.post(
            "/wiki/nonexistent-id/associations/as-target",
            json={"source_title": "Toril", "source_category": "location", "association_label": "kingdom"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_produces_same_association_as_standard_endpoint(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        """as-target from Kingdom's side must create the same link as add_association from World's side."""
        world = make_location(client, auth_headers, campaign_id, "Toril", "world")
        kingdom = make_location(client, auth_headers, campaign_id, "Cormyr", "kingdom")

        add_as_target(client, auth_headers, kingdom["id"], "Toril", "kingdom")

        world_detail = get_article(client, auth_headers, world["id"])
        kingdom_detail = get_article(client, auth_headers, kingdom["id"])

        # Same physical association id seen from both sides
        assert world_detail["associations"][0]["id"] == kingdom_detail["associations"][0]["id"]
        # Exactly one association exists total (not duplicated)
        assert len(world_detail["associations"]) == 1
        assert len(kingdom_detail["associations"]) == 1


# ---------------------------------------------------------------------------
# other_article_location_subtype in association display
# ---------------------------------------------------------------------------


class TestAssociationLocationSubtype:

    def test_subtype_populated_on_both_sides_of_association(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        world = make_location(client, auth_headers, campaign_id, "Toril", "world")
        kingdom = make_location(client, auth_headers, campaign_id, "Cormyr", "kingdom")
        add_association(client, auth_headers, world["id"], kingdom["title"], "kingdom")

        world_detail = get_article(client, auth_headers, world["id"])
        kingdom_detail = get_article(client, auth_headers, kingdom["id"])

        assert world_detail["associations"][0]["other_article_location_subtype"] == "kingdom"
        assert kingdom_detail["associations"][0]["other_article_location_subtype"] == "world"

    def test_subtype_null_when_other_article_has_no_subtype(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        loc = make_location(client, auth_headers, campaign_id, "Mysterious Place")
        npc = make_article(client, auth_headers, campaign_id, "The Hermit", "npc")
        add_association(client, auth_headers, loc["id"], npc["title"], "resident", "npc")

        detail = get_article(client, auth_headers, loc["id"])
        assert detail["associations"][0]["other_article_location_subtype"] is None

    def test_subtype_null_for_non_location_category(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        world = make_location(client, auth_headers, campaign_id, "Oerth", "world")
        deity = make_article(client, auth_headers, campaign_id, "Mystra", "deity")
        add_association(client, auth_headers, world["id"], deity["title"], "patron deity", "deity")

        detail = get_article(client, auth_headers, world["id"])
        assert detail["associations"][0]["other_article_location_subtype"] is None

    def test_subtype_present_in_locations_endpoint_associations(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        world = make_location(client, auth_headers, campaign_id, "Toril", "world")
        kingdom = make_location(client, auth_headers, campaign_id, "Cormyr", "kingdom")
        add_association(client, auth_headers, world["id"], kingdom["title"], "kingdom")

        by_title = {a["title"]: a for a in get_locations(client, auth_headers, campaign_id)}
        assert by_title["Toril"]["associations"][0]["other_article_location_subtype"] == "kingdom"
        assert by_title["Cormyr"]["associations"][0]["other_article_location_subtype"] == "world"


# ---------------------------------------------------------------------------
# Full hierarchy workflow
# ---------------------------------------------------------------------------


class TestLocationHierarchyWorkflow:

    def test_world_kingdom_via_parent_editor(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        """Parent (World) adds child (Kingdom) via standard POST /associations."""
        world = make_location(client, auth_headers, campaign_id, "Toril", "world")
        kingdom = make_location(client, auth_headers, campaign_id, "Cormyr", "kingdom")
        add_association(client, auth_headers, world["id"], kingdom["title"], "kingdom")

        world_detail = get_article(client, auth_headers, world["id"])
        assoc = world_detail["associations"][0]
        assert assoc["direction"] == "from"
        assert assoc["association_label"] == "kingdom"
        assert assoc["other_article_location_subtype"] == "kingdom"

    def test_kingdom_sets_world_via_child_editor(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        """Child (Kingdom) sets its parent (World) via POST /associations/as-target."""
        world = make_location(client, auth_headers, campaign_id, "Toril", "world")
        kingdom = make_location(client, auth_headers, campaign_id, "Cormyr", "kingdom")
        add_as_target(client, auth_headers, kingdom["id"], "Toril", "kingdom")

        kingdom_detail = get_article(client, auth_headers, kingdom["id"])
        assoc = kingdom_detail["associations"][0]
        assert assoc["direction"] == "to"
        assert assoc["association_label"] == "kingdom"
        assert assoc["other_article_location_subtype"] == "world"

    def test_three_level_chain_world_kingdom_city(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        world = make_location(client, auth_headers, campaign_id, "Toril", "world")
        kingdom = make_location(client, auth_headers, campaign_id, "Cormyr", "kingdom")
        city = make_location(client, auth_headers, campaign_id, "Suzail", "city")

        add_association(client, auth_headers, world["id"], kingdom["title"], "kingdom")
        add_association(client, auth_headers, kingdom["id"], city["title"], "city")

        by_title = {a["title"]: a for a in get_locations(client, auth_headers, campaign_id)}

        # Kingdom has both a parent and a child association
        kingdom_assoc_labels = {a["association_label"] for a in by_title["Cormyr"]["associations"]}
        assert "kingdom" in kingdom_assoc_labels
        assert "city" in kingdom_assoc_labels

        # City has one incoming "city" from Kingdom
        city_assoc = by_title["Suzail"]["associations"][0]
        assert city_assoc["direction"] == "to"
        assert city_assoc["association_label"] == "city"
        assert city_assoc["other_article_title"] == "Cormyr"

    def test_five_level_full_depth(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        world = make_location(client, auth_headers, campaign_id, "Oerth", "world")
        kingdom = make_location(client, auth_headers, campaign_id, "Keoland", "kingdom")
        city = make_location(client, auth_headers, campaign_id, "Niole Dra", "city")
        district = make_location(client, auth_headers, campaign_id, "Harbor District", "district")
        scene = make_location(client, auth_headers, campaign_id, "The Rusty Anchor", "scene")

        add_association(client, auth_headers, world["id"], kingdom["title"], "kingdom")
        add_association(client, auth_headers, kingdom["id"], city["title"], "city")
        add_association(client, auth_headers, city["id"], district["title"], "district")
        add_association(client, auth_headers, district["id"], scene["title"], "scene location")

        by_title = {a["title"]: a for a in get_locations(client, auth_headers, campaign_id)}

        # Scene has exactly one incoming "scene location" association from District
        scene_assocs = by_title["The Rusty Anchor"]["associations"]
        assert len(scene_assocs) == 1
        assert scene_assocs[0]["association_label"] == "scene location"
        assert scene_assocs[0]["direction"] == "to"
        assert scene_assocs[0]["other_article_location_subtype"] == "district"

    def test_multiple_kingdoms_under_one_world(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        world = make_location(client, auth_headers, campaign_id, "Toril", "world")
        for name in ("Cormyr", "Zhentil Keep Region", "The Dalelands"):
            kingdom = make_location(client, auth_headers, campaign_id, name, "kingdom")
            add_association(client, auth_headers, world["id"], kingdom["title"], "kingdom")

        world_detail = get_article(client, auth_headers, world["id"])
        kingdom_assocs = [a for a in world_detail["associations"] if a["association_label"] == "kingdom"]
        assert len(kingdom_assocs) == 3

    def test_multiple_cities_under_one_kingdom(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        kingdom = make_location(client, auth_headers, campaign_id, "Cormyr", "kingdom")
        for name in ("Suzail", "Arabel", "Thunderstone"):
            city = make_location(client, auth_headers, campaign_id, name, "city")
            add_association(client, auth_headers, kingdom["id"], city["title"], "city")

        kingdom_detail = get_article(client, auth_headers, kingdom["id"])
        city_assocs = [a for a in kingdom_detail["associations"] if a["association_label"] == "city"]
        assert len(city_assocs) == 3

    def test_location_with_non_hierarchy_association(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        world = make_location(client, auth_headers, campaign_id, "Toril", "world")
        deity = make_article(client, auth_headers, campaign_id, "Mystra", "deity")
        add_association(client, auth_headers, world["id"], deity["title"], "patron deity", "deity")

        detail = get_article(client, auth_headers, world["id"])
        assert len(detail["associations"]) == 1
        assert detail["associations"][0]["association_label"] == "patron deity"

    def test_mixed_parent_child_and_other_associations(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        """A kingdom can link to both a parent world and an unrelated NPC."""
        world = make_location(client, auth_headers, campaign_id, "Toril", "world")
        kingdom = make_location(client, auth_headers, campaign_id, "Cormyr", "kingdom")
        npc = make_article(client, auth_headers, campaign_id, "King Azoun", "npc")

        add_as_target(client, auth_headers, kingdom["id"], "Toril", "kingdom")
        add_association(client, auth_headers, kingdom["id"], npc["title"], "ruled by", "npc")

        kingdom_detail = get_article(client, auth_headers, kingdom["id"])
        assert len(kingdom_detail["associations"]) == 2
        labels = {a["association_label"] for a in kingdom_detail["associations"]}
        assert labels == {"kingdom", "ruled by"}


# ---------------------------------------------------------------------------
# Faction/Organization category
# ---------------------------------------------------------------------------


class TestFactionOrgCategory:

    def test_create_faction_org_article(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        body = make_article(client, auth_headers, campaign_id, "The Zhentarim", "faction_org")
        assert body["category"] == "faction_org"
        assert body["location_subtype"] is None

    def test_list_filters_by_faction_org(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        make_article(client, auth_headers, campaign_id, "The Harpers", "faction_org")
        make_article(client, auth_headers, campaign_id, "Order of the Gauntlet", "faction_org")
        make_article(client, auth_headers, campaign_id, "Goblin Chief", "npc")

        resp = client.get(
            "/wiki",
            params={"campaign_id": campaign_id, "category": "faction_org"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        titles = {a["title"] for a in resp.json()}
        assert "The Harpers" in titles
        assert "Order of the Gauntlet" in titles
        assert "Goblin Chief" not in titles

    def test_faction_org_excluded_from_locations_endpoint(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        make_article(client, auth_headers, campaign_id, "City Watch", "faction_org")
        make_location(client, auth_headers, campaign_id, "Waterdeep", "city")

        locs = get_locations(client, auth_headers, campaign_id)
        titles = {a["title"] for a in locs}
        assert "Waterdeep" in titles
        assert "City Watch" not in titles

    def test_faction_org_detail_accessible(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        body = make_article(client, auth_headers, campaign_id, "Emerald Enclave", "faction_org")
        detail = get_article(client, auth_headers, body["id"])
        assert detail["category"] == "faction_org"

    def test_faction_org_can_associate_with_location(
        self, client: TestClient, auth_headers: dict, campaign_id: str
    ):
        city = make_location(client, auth_headers, campaign_id, "Waterdeep", "city")
        faction = make_article(client, auth_headers, campaign_id, "City Watch", "faction_org")
        add_association(client, auth_headers, faction["id"], city["title"], "based in", "location")

        detail = get_article(client, auth_headers, faction["id"])
        assert len(detail["associations"]) == 1
        assert detail["associations"][0]["other_article_title"] == "Waterdeep"
        assert detail["associations"][0]["association_label"] == "based in"
