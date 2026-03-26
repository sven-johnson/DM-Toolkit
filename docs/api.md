# DM Toolkit — API Reference

Base URL: `http://localhost:8000` (or the value of `VITE_API_URL`)

All endpoints except `POST /auth/login` require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

---

## Authentication

### `POST /auth/login`

Exchange credentials for a JWT access token.

**Request body**
```json
{
  "username": "admin",
  "password": "changeme"
}
```

**Response `200`**
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

**Response `401`** — Invalid credentials.

---

## Sessions

### `GET /sessions`

Return all sessions, newest first.

**Response `200`**
```json
[
  {
    "id": 1,
    "title": "Session 1 — The Ruined Watchtower",
    "date": "2026-03-15",
    "created_at": "2026-03-15T18:00:00"
  }
]
```

---

### `POST /sessions`

Create a new session.

**Request body**
```json
{
  "title": "Session 2 — The Sunken Temple",
  "date": "2026-03-22"
}
```
`date` is optional and may be `null`.

**Response `201`** — Returns the created session object.

---

### `GET /sessions/{session_id}`

Return a single session with its scenes, ordered by `order_index`.

**Response `200`**
```json
{
  "id": 1,
  "title": "Session 1",
  "date": null,
  "created_at": "2026-03-15T18:00:00",
  "scenes": [
    {
      "id": 3,
      "session_id": 1,
      "title": "Opening — The Market",
      "body": "The party arrives at dusk...",
      "order_index": 0,
      "created_at": "2026-03-15T18:05:00",
      "updated_at": "2026-03-15T18:10:00"
    }
  ]
}
```

**Response `404`** — Session not found.

---

### `PUT /sessions/{session_id}`

Update a session's title and/or date. Only provided fields are changed.

**Request body**
```json
{
  "title": "Session 1 — Revised Title",
  "date": "2026-03-16"
}
```

**Response `200`** — Returns the updated session object.

**Response `404`** — Session not found.

---

### `DELETE /sessions/{session_id}`

Delete a session and all its scenes (cascades automatically).

**Response `204`** — No content.

**Response `404`** — Session not found.

---

## Scenes

### `POST /sessions/{session_id}/scenes`

Add a new scene to a session. The scene is appended at the end (highest `order_index`).

**Request body**
```json
{
  "title": "Encounter — Ambush at the Bridge",
  "body": "Read-aloud text goes here..."
}
```
`body` defaults to `""`.

**Response `201`** — Returns the created scene object.

**Response `404`** — Session not found.

---

### `PUT /sessions/{session_id}/scenes/reorder`

Reorder scenes within a session by supplying scene IDs in the desired order. `order_index` values are updated to match the array position.

**Request body**
```json
{
  "scene_ids": [5, 3, 7, 1]
}
```

**Response `204`** — No content.

> Note: scene IDs not belonging to the session are silently ignored.

---

### `PUT /scenes/{scene_id}`

Update a scene's title and/or body. Only provided fields are changed.

**Request body**
```json
{
  "title": "Updated Scene Title",
  "body": "Updated markdown content..."
}
```

**Response `200`** — Returns the updated scene object.

**Response `404`** — Scene not found.

---

### `DELETE /scenes/{scene_id}`

Delete a single scene.

**Response `204`** — No content.

**Response `404`** — Scene not found.

---

## Common error shape

```json
{
  "detail": "Human-readable error message"
}
```

HTTP status codes used: `200`, `201`, `204`, `401`, `404`.
