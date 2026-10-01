# DM Toolkit — Invite-Only Access: Implementation Spec

## How to use this document (instructions for Claude Code)

- Work through the steps **in order**. Each step is a self-contained unit: implement it, write its tests, run the **full** test suite, and only move on when everything passes.
- Commit at the end of each step with a message like `invites: step 3 — create-invite API`.
- **Do not skip tests.** Every step lists the tests it requires. New code must reach **100% line and branch coverage** (see "Coverage" below).
- Follow the project's existing conventions (folder layout, naming, auth helpers, migration tool, API client, styling, component library). Step 0 exists to discover them. When this spec conflicts with an established project pattern on a matter of style, follow the project; when it conflicts on behavior, follow this spec.
- If something in this spec is ambiguous or impossible given the existing code, stop and ask rather than guessing.


## Goals

1. The app allows new user creation on an invite-only basis
2. Invites are stored in a new `invites` table keyed by a GUID.
3. Two kinds of invite:
   - **Platform invite** (no campaign): sent by an **admin** from the Settings page. Creates a user with no campaign association; that user can create their own campaigns (i.e. a new DM).
   - **Campaign invite**: sent by a campaign **owner or game_master** from the "Manage Members" modal. The invitee joins that campaign with role `player`.
4. `users` gets a mandatory, unique `email` column.
5. One public URL handles every invite: `/invite?id=<guid>`. It shows one of:
   - **Register** form (invite email has no account yet)
   - **Join campaign** prompt (invite email already has an account; requires login)
   - **Closed beta** message (missing / invalid / expired / used invite)
6. No email sending. The inviter gets a link in a read-only text field with a **Copy** button and shares it themselves.

## Coverage

- Backend: `pytest` + `pytest-cov`. Every new/changed backend module must be at 100% line + branch coverage. Add a CI/`make`/npm script (whatever the project uses) that enforces this for the new modules, e.g. `--cov=<invites module> --cov-branch --cov-fail-under=100`.
- Frontend: Vitest + React Testing Library with `@vitest/coverage-v8`. Every new component/hook/API-client function must be at 100% line + branch coverage.
- End-to-end: Playwright (add it if not present) for the happy paths in Step 9.
- If any of these tools are missing, add and configure them in Step 0.

---

## Step 0 — Recon and test-harness baseline

**Do:**
1. Inspect the repo and write a short `docs/invites-recon.md` noting:
   - Migration tool in use (Alembic? raw SQL files? other) and how to run it.
   - How auth works (session cookie vs. JWT, where the current-user dependency lives, how `is_admin` is checked).
   - Where the `campaign_members` table/model is and how the RBAC roles (`'owner' | 'game_master' | 'player'`) are checked today.
   - Any existing registration/signup endpoint and UI.
   - Frontend routing library, API client pattern, location of the Settings page and the "Manage Members" modal.
   - Existing password rules (min length, hashing helper).
   - How the "change username" feature in the Settings page's **Account** section works end to end: the endpoint (route, method, request/response shape, validation, conflict handling, whether it requires the current password), the frontend component/form, its success/error UX, and its tests. Step 1 copies this pattern for email.
   - Existing test setup for backend and frontend (DB fixtures, test DB, factories).
2. Ensure backend tests run against an isolated test database (MySQL container or equivalent) with per-test transactional rollback or truncation.
3. Ensure frontend unit tests and coverage run.
4. Add Playwright if absent, with a config that can start backend + frontend against a seeded test DB.

**Tests:** Existing suites pass. Add one trivial smoke test per harness (backend, frontend, e2e) to prove each runs.

**Done when:** `docs/invites-recon.md` exists, all three harnesses run green from a single documented command each.

---

## Step 1 — Add `email` to `users`

Current DDL:

```sql
CREATE TABLE `users` (
  `username` varchar(64) NOT NULL,
  `hashed_password` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (now()),
  `id` varchar(36) NOT NULL,
  `is_admin` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

**Do:**
1. Migration (single migration, three phases, reversible):
   1. `ADD COLUMN email varchar(255) NULL` after `username`.
   2. Backfill existing rows with a unique placeholder: `CONCAT(username, '@placeholder.invalid')`. (`.invalid` is a reserved TLD, so these can never be real addresses.)
   3. `MODIFY email varchar(255) NOT NULL` and add `UNIQUE KEY uq_users_email (email)`.
   - Downgrade drops the unique key and the column.
2. Update the User model/schema to include `email` (required).
3. Add a shared helper `normalize_email(value: str) -> str` that trims whitespace and lowercases. **All** writes and lookups of email go through it.
4. **Self-service email change** in the Settings page's **Account** section, so users (including those with placeholder emails) can set their own address.
   - **Follow the existing "change username" pattern exactly** (documented in `docs/invites-recon.md`): mirror its endpoint shape, auth requirements (e.g. if username change requires the current password, so does email change), validation flow, conflict handling, frontend component structure, success/error messaging, and test structure. Where the username implementation has a reusable form/hook, reuse or generalize it rather than duplicating.
   - Email-specific rules on top of that pattern: validate format (Pydantic `EmailStr`), normalize with `normalize_email`, enforce uniqueness (409 "This email is already in use." on conflict, matching the username-conflict response shape). Changing to your own current email is a no-op success.
   - Show the user's current email in the Account section. If it ends in `@placeholder.invalid`, show it as "Not set" with a prompt to add one.
5. Do **not** expose `email` in any endpoint that returns other users' data to non-admins (e.g. campaign member lists). A user may see their own email.

**Tests (backend):**
- Migration upgrade on a DB with pre-existing users → every user has a unique `@placeholder.invalid` email; column is NOT NULL; unique index exists.
- Migration downgrade removes the column cleanly.
- `normalize_email` trims and lowercases; idempotent.
- Inserting a user without email fails; duplicate email (differing only by case) fails.
- Email-change endpoint: mirror every test the username-change endpoint has, plus: success, normalization applied, invalid format → 422, duplicate (including case-only difference) → 409, unchanged email → success, unauthenticated → 401 (and wrong current password → the same error the username flow returns, if it requires one).
- Member-list (or equivalent) responses do not include other users' emails for non-admins.

**Tests (frontend):**
- Account section: mirror every test the change-username UI has, plus: current email displayed; placeholder email displayed as "Not set" with prompt; successful change updates the displayed value; 409 shows the conflict message; invalid format blocked client-side.

**Done when:** Migration runs up/down cleanly, all tests green, coverage at 100% for new code.

---

## Step 2 — `invites` table and model

**Do:** Create the table via migration:

```sql
CREATE TABLE `invites` (
  `id` varchar(36) NOT NULL,                 -- GUID (uuid4), used in the invite URL
  `email` varchar(255) NOT NULL,             -- normalized invitee email
  `campaign_id` varchar(36) NULL,            -- NULL = platform invite; match campaigns.id type
  `role` enum('owner','game_master','player') NULL,
  `invited_by_user_id` varchar(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (now()),
  `expires_at` datetime NOT NULL,
  `accepted_at` datetime NULL,
  `accepted_by_user_id` varchar(36) NULL,
  PRIMARY KEY (`id`),
  KEY `ix_invites_email` (`email`),
  KEY `ix_invites_campaign` (`campaign_id`),
  CONSTRAINT `fk_invites_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invites_inviter` FOREIGN KEY (`invited_by_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invites_accepted_by` FOREIGN KEY (`accepted_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ck_invites_campaign_role` CHECK (
    (`campaign_id` IS NULL AND `role` IS NULL) OR
    (`campaign_id` IS NOT NULL AND `role` IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

- Adjust `campaign_id` type and the campaigns table/column name to match the actual schema found in Step 0. If the role column on `campaign_members` uses a different type than `enum`, match it.
- Invite lifetime: `INVITE_TTL_DAYS` config value, default **14**.
- Invites are **single-use**: valid only when `accepted_at IS NULL` and `expires_at > now()`.

Create an `invites` service module with pure-ish functions (all DB access via the project's session pattern):

- `create_invite(db, *, email, inviter, campaign_id=None, role=None) -> Invite`
- `get_valid_invite(db, invite_id) -> Invite | None` — returns `None` for malformed GUID, not found, expired, or already accepted.
- `mark_accepted(db, invite, user_id)` — must be **atomic**: `UPDATE invites SET accepted_at=now(), accepted_by_user_id=:uid WHERE id=:id AND accepted_at IS NULL`; if 0 rows affected, raise `InviteAlreadyUsed`. Callers use this inside the same transaction as the user/membership insert so a double-submit cannot create two accounts.

**Tests (backend):**
- Check constraint: campaign without role and role without campaign both rejected.
- `create_invite` sets a uuid4 id, normalized email, `expires_at = created_at + TTL`.
- `get_valid_invite` returns `None` for: non-GUID string, unknown GUID, expired, accepted. Returns the invite otherwise. Use a controllable clock/freezegun for expiry.
- `mark_accepted` succeeds once; a second call raises `InviteAlreadyUsed`.
- Deleting a campaign cascades its invites.

---

## Step 3 — Create-invite API

**Endpoint:** `POST /api/invites` (authenticated)

Request:
```json
{ "email": "someone@example.com", "campaign_id": "optional-uuid" }
```

Response `201`:
```json
{ "id": "<guid>", "email": "someone@example.com", "campaign_id": null, "role": null, "expires_at": "..." }
```

The backend returns the GUID only. The **frontend** builds the link as `${window.location.origin}/invite?id=<guid>` so it is always correct for the deployed frontend domain.

**Authorization & rules:**

| Case | Who may call | Role stored |
|---|---|---|
| No `campaign_id` (platform invite) | `is_admin` only | `NULL` |
| With `campaign_id` | admin, or a member of that campaign with role `owner` or `game_master` | `player` (always; ignore/forbid any client-supplied role) |

Validation, in this order:
1. Email format (Pydantic `EmailStr`) → 422 on failure. Normalize.
2. Authorization per table → 403 (404 if the campaign doesn't exist).
3. Platform invite and a user with this email **already exists** → 409 `{"detail": "A user with this email already exists."}`.
4. Campaign invite and the user with this email is **already a member** of the campaign → 409 `{"detail": "This user is already a member of this campaign."}`.
5. If an unexpired, unaccepted invite already exists for the same `(email, campaign_id)` pair, **return that existing invite** with `200` instead of creating a duplicate.

**Tests (backend):** one test per row/branch above, including:
- admin platform invite → 201
- non-admin platform invite → 403
- GM campaign invite → 201 with role `player`
- owner campaign invite → 201
- player of that campaign → 403
- GM of a *different* campaign → 403
- admin campaign invite for any campaign → 201
- nonexistent campaign → 404
- unauthenticated → 401
- invalid email → 422
- email normalization (mixed case/whitespace stored lowercase-trimmed)
- existing user + platform invite → 409
- existing member + campaign invite → 409
- existing non-member user + campaign invite → 201 (this is the "join" path)
- duplicate pending invite → returns same id, 200
- expired prior invite → new invite created
- client-supplied `role: "owner"` is ignored or rejected (pick one, test it)

---

## Step 4 — Public invite lookup, registration, and closing open signup

### 4a. `GET /api/invites/{invite_id}` (no auth required)

- Invalid / unknown / expired / accepted → `404` with a generic body `{"detail": "invalid_invite"}`. Never reveal *why* it's invalid.
- Valid → `200`:

```json
{
  "mode": "register" | "join",
  "email": "someone@example.com",
  "campaign_name": "Name or null"
}
```

- `mode` is `"join"` when a user with the invite's email already exists **and** the invite has a `campaign_id`; otherwise `"register"`.
- (A platform invite whose email has since been registered is effectively dead → treat as invalid → 404.)

### 4b. `POST /api/invites/{invite_id}/register` (no auth required)

Request:
```json
{ "email": "...", "username": "...", "password": "...", "confirm_password": "..." }
```

Rules:
- Invite must be valid and in `register` mode → else 404 `invalid_invite`.
- **Email is the user's choice** — it does *not* have to match the invite's email. The invite's email only determines who the link was sent to and whether the page shows register vs. join. Validate format (`EmailStr`), normalize, and if a user with that email already exists → 409 `{"detail": "This email is already in use."}`.
- Username: reuse existing username validation if present; otherwise 3–64 chars, `[A-Za-z0-9_-]`. Taken → 409 `{"detail": "Username is already taken."}`.
- Password: reuse existing rules if present; otherwise min 8 chars. `password != confirm_password` → 422.
- In **one transaction**: insert user (hashed with the existing helper, `is_admin = false`), `mark_accepted`, and if the invite has `campaign_id`, insert `campaign_members(user_id, campaign_id, role)`.
- On success: log the user in using the existing auth mechanism (set session cookie / return token exactly as the login endpoint does) and return `201` with the same payload shape the login endpoint returns.
- Concurrent double submit: exactly one succeeds; the other gets 404 `invalid_invite` (or 409 on username), and no orphan user exists.

### 4c. Close open registration

- Remove or disable any existing public signup endpoint (return 404 or 403) and remove its UI route/links. If removing it would break existing tests, update those tests to assert it is now disabled.
- If there is an admin-only or seed-script path to create the first admin, keep it and document it in the recon file.

**Tests (backend):**
- GET: each invalid variant → identical 404 body; valid platform invite → `register`; valid campaign invite for new email → `register` with campaign_name; valid campaign invite for existing email → `join`; platform invite for now-existing email → 404.
- Register: happy path (platform) creates user with no memberships and logs in; happy path (campaign) creates user + `player` membership; email different from the invite's email → succeeds and the user is stored with the *submitted* email; submitted email normalized; submitted email already in use → 409; invalid email format → 422; username taken → 409; password mismatch → 422; short password → 422; invalid invite → 404; reused invite → 404; `join`-mode invite → 404; transaction rollback leaves no user when membership insert fails (simulate failure); concurrent submit simulation leaves exactly one user.
- Old signup endpoint is disabled.

---

## Step 5 — Accept campaign invite (existing users)

**Endpoint:** `POST /api/invites/{invite_id}/accept` (authenticated)

Rules:
- Invite must be valid, have a `campaign_id`, and be in `join` mode → else 404 `invalid_invite`.
- The logged-in user's email must equal the invite email → else 403 `{"detail": "This invitation was sent to a different account."}`.
- Already a member → mark invite accepted anyway and return 200 (idempotent, no duplicate row).
- Otherwise, in one transaction: insert `campaign_members` with the invite's role, `mark_accepted`. Return `200` `{ "campaign_id": "..." }`.

"Ignore" needs **no** endpoint — the invite simply stays pending until it expires.

**Tests (backend):** happy path; unauthenticated → 401; wrong user → 403; invalid/expired/used → 404; platform invite → 404; already a member → 200 and still exactly one membership row; second accept → 404.

---

## Step 6 — Frontend: `/invite` page — closed beta + register mode

**Route:** `/invite` — public (must **not** be behind the auth guard). Reads `id` from the query string.

**Behavior:**
1. No `id` → render the closed-beta message immediately (no API call).
2. `id` present → show a loading state, call `GET /api/invites/{id}`.
3. 404 or any error → closed-beta message:
   > **This app is currently in closed beta and requires an invitation to join.**
4. `mode: "register"` → render the registration form:
   - **Email address**: pre-filled from the invite as a convenience, but **fully editable**. The user may sign up with any email.
   - **Username**
   - **Password** (type=password)
   - **Confirm password** (type=password)
   - If `campaign_name` is present, show a line above the form: "You've been invited to join **{campaign_name}**."
   - **Create account** button — disabled until all fields are non-empty and password === confirm password. Show inline "Passwords do not match" when both are filled and differ.
   - On submit: disable button, show progress, `POST /api/invites/{id}/register`.
   - On 201: store auth exactly as the login flow does, then navigate to the campaign (if `campaign_id`) or home.
   - On 409/422/400: show the server's `detail` inline, re-enable the form, keep entered values (clear password fields is fine).
   - On 404: switch to the closed-beta message.
5. `mode: "join"` → handled in Step 7 (render a placeholder until then).

Put the API calls in the project's API-client layer (`getInvite`, `registerWithInvite`) so they're unit-testable with mocked fetch.

**Tests (frontend, Vitest + RTL, mocked API):**
- no `id` → beta message, API not called
- 404 → beta message
- network error → beta message
- loading state shown while pending
- register mode renders all four fields, email pre-filled and editable
- editing the email field submits the edited value, not the invite's email
- campaign name line shown only when present
- button disabled with empty fields; disabled when passwords differ; mismatch text shown; enabled when valid
- submit calls API with correct payload and invite id
- success → auth stored + navigation to correct destination (both platform and campaign cases)
- 409 → error shown, form re-enabled
- 404 on submit → beta message
- double-click submits only once
- API-client functions: correct URL, method, body, error mapping

---

## Step 7 — Frontend: `/invite` page — join mode

**Behavior** when `GET` returns `mode: "join"`:
1. If not logged in → redirect to the login page with a return URL back to `/invite?id=<guid>` (use the project's existing redirect mechanism; add one if absent). After login, the user lands back on this page.
2. If logged in → render:
   > **You have been invited to join {campaign_name}**

   with two buttons:
   - **Accept** → `POST /api/invites/{id}/accept`; on 200 navigate to that campaign (or home if there's no campaign page route); on 403 show "This invitation was sent to a different account." with a link home; on 404 show the closed-beta message.
   - **Ignore** → navigate to the home page. No API call.

**Tests (frontend):**
- join mode while logged out → redirect with correct return URL
- join mode while logged in → message with campaign name and both buttons
- Accept → API called, navigation on success
- Accept 403 → wrong-account message
- Accept 404 → beta message
- Accept button disabled while request in flight
- Ignore → navigates home, accept API not called
- login flow honors the return URL (test in the login component's tests)

---

## Step 8 — Frontend: Invite tool (Settings page + Manage Members modal)

Build one reusable component, e.g. `<InviteCreator campaignId?: string />`.

**UI:**
- Email input (type=email, required) + **Invite** button (disabled while empty/invalid or while submitting).
- On submit: `POST /api/invites` with `{ email, campaign_id }`.
- On success: show a read-only text input containing `${window.location.origin}/invite?id=<guid>` and a **Copy** button.
  - Copy uses `navigator.clipboard.writeText`; on success the button briefly reads "Copied!".
  - Fallback if the Clipboard API is unavailable or rejects: select the input's text and show "Press Ctrl/Cmd+C to copy".
  - Helper text: "Send this link to the person you're inviting. It expires in 14 days and can be used once." (Use the `expires_at` from the response rather than hardcoding 14 if convenient.)
- On 409: show the server `detail` inline.
- On 403/other: show a generic error.
- Allow creating another invite afterward (clear email, keep or replace the link).

**Placement:**
- **Settings page** — section titled "Invite a Game Master", rendered **only** for `is_admin` users. Uses `<InviteCreator />` with no campaign id.
- **Manage Members modal** — section titled "Invite a Player", rendered only when the current user is an admin or has role `owner`/`game_master` in that campaign. Uses `<InviteCreator campaignId={campaign.id} />`.

**Tests (frontend):**
- component: button disabled states; submit payload with and without campaign id; link built from `window.location.origin`; copy success → "Copied!"; clipboard rejection → fallback text + input selected; 409 shows detail; generic error; can create a second invite
- Settings page: section visible for admin, absent for non-admin
- Manage Members modal: visible for owner, game_master, admin; absent for player

---

## Step 9 — End-to-end tests (Playwright)

Seed a test DB with: one admin, one GM who owns a campaign, one existing non-member user.

Scenarios:
1. **Admin invites a new GM:** admin logs in → Settings → creates invite → copies link → new browser context opens link → registers → lands home logged in → can create a campaign.
2. **GM invites a brand-new player:** GM → Manage Members → invite new email → new context opens link → sees campaign name → changes the pre-filled email to a different address → registers → lands in campaign as player → Manage Members invite tool not visible to them.
3. **GM invites an existing user:** link opened while logged out → redirected to login → logs in → returned to invite → Accept → in campaign as player.
4. **Ignore:** existing user opens a join link → Ignore → home; not a member.
5. **Reuse blocked:** a used link shows the closed-beta message.
6. **No/garbage id:** `/invite` and `/invite?id=nope` show the closed-beta message.
7. **Open signup gone:** the old signup route is unreachable.
8. **Change email:** a logged-in user goes to Settings → Account, changes their email, reloads, and sees the new value.

---

## Out of scope (do not build now)

- Sending emails
- Listing / revoking pending invites in the UI
- Logging in by email, password reset by email, email verification (the email field exists now to enable sending later)
- Inviting co-GMs (`game_master` role) via the UI — the data model supports it, the UI always uses `player`
- Rate limiting invite creation (note it as a follow-up in the recon file)