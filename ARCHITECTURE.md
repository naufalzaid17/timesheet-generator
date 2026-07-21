# Timesheet Automation Portal — Phase 2 Architecture

Phase 2 turns the Phase 1 single-page generator into a full internal portal with
role-based access control, passkeys, admin-driven dynamic templates, incremental
daily entry, SMTP delivery, and daily Web Push reminders.

```
                        ┌────────────────────────────────────────────┐
                        │            Next.js (Saweria UI)             │
   Browser  ───────────▶│  /login  /reset-password                   │
   + Service Worker     │  (admin) /users  /template-builder         │
   (Web Push)           │  (user)  /dashboard  (Handsontable grids)  │
                        └───────────────┬────────────────────────────┘
                                        │  JSON over HTTPS (Bearer JWT)
                                        ▼
                        ┌────────────────────────────────────────────┐
                        │                Go / Gin API                 │
                        │  auth (JWT + WebAuthn)   handlers           │
                        │  mailer (gomail/SMTP)    scheduler (cron)   │
                        │  push (webpush-go)       services (excelize)│
                        └───┬───────────────┬───────────────┬─────────┘
                            │               │               │
                     PostgreSQL         Mailpit/SMTP     Push Services
                     (GORM)             (email)          (browser vendors)
```

## 1. Database schema (GORM)

Defined in `backend/models/entities.go`:

| Model                  | Purpose                                                              |
| ---------------------- | ------------------------------------------------------------------- |
| `User`                 | Account + live (approved) profile, RBAC role, implements `webauthn.User`. |
| `WebAuthnCredential`   | One stored passkey per row (credential id, public key, sign count). |
| `Template`             | Admin-uploaded `.xlsx` (raw bytes stored), one may be `is_default`. |
| `CellMapping`          | Maps a semantic field → a physical cell or per-day column in a template. |
| `DailyActivity`        | One user's entry for one calendar day (unique on `user_id + date`). |
| `PushSubscription`     | Browser Web Push subscription (endpoint + keys).                    |
| `ProfileChangeRequest` | Pending self-service profile edit awaiting admin approval.          |
| `PasswordResetToken`   | Hashed token backing setup-link + forgot-password flows.            |

Migrations and the bootstrap-admin seed run in `backend/database/database.go`.

## 2. Authentication & RBAC

- **Password login** (`/api/auth/login`): username **or** email + bcrypt-checked
  password → signed JWT (`backend/auth`).
- **Passkey login** (WebAuthn assertion): `/api/auth/passkey/login/{begin,finish}`
  using `go-webauthn/webauthn`. Registration (`/api/passkey/register/*`) requires
  an existing session, so passkeys are added from the dashboard.
- **No public sign-up.** The only account-creation path is admin-only
  `POST /api/admin/users`, which emails a setup link.
- **Forgot/Reset password**: `/api/auth/forgot-password` issues a hashed,
  time-limited token emailed as a link; `/api/auth/reset-password` consumes it.
- **Route protection**: `AuthMiddleware` (Bearer JWT) + `AdminOnly` guard the
  `/api/admin/*` group. The frontend mirrors this with `Guard` on route-group
  layouts.
- **Profile approval flow**: users submit `POST /api/profile/change` →
  `ProfileChangeRequest` (status `pending`); an admin approves/rejects at
  `/api/admin/profile-changes/:id/review`, and approval copies the values onto
  the live `User`.

## 3. Dynamic template management

1. Admin uploads an `.xlsx` (`POST /api/admin/templates`). Raw bytes are stored
   on the `Template` row so generation is self-contained.
2. The workbook is parsed to a 2-D grid (`GET /api/templates/:id/grid`) and
   rendered in **Handsontable** on `/template-builder`.
3. The admin clicks a cell/column and assigns a **field** (`date`, `time_in`,
   `activity`, `meta_name`, …) with a **scope**:
   - `cell` — a single absolute cell (header metadata).
   - `daily_column` — a column whose rows repeat one-per-day, anchored at
     `start_row`; `fillable` decides whether users may edit it.
4. Mappings are saved atomically (`POST /api/admin/templates/:id/mappings`),
   replacing the prior set. Users can never reach any template-write route.

## 4. Daily entry & restricted monthly grid

- **Daily modal** (`DailyModal`): friendly "Today's Activity" / past-date entry,
  upserted via `POST /api/activities` (unique on `user_id + date`).
- **Monthly grid**: `/dashboard` renders one row per calendar day in
  Handsontable. `cells()` marks a column read-only unless its field is a
  `fillable` `daily_column` in the default template mapping. Edits auto-save.

## 5. File generation & SMTP delivery

`POST /api/timesheet/generate`:

1. Loads the chosen (or default) template + its mappings.
2. `services.GenerateFromTemplate` injects metadata cells and writes each day's
   activity down the mapped daily columns using `excelize`.
3. **Row trimming**: days beyond the month's length are cleared, so a fixed
   31-row template block is trimmed to the real month length.
4. The `.xlsx` is streamed back for direct download **and** emailed to the
   user's registered address as an attachment (async, via `gomail`/SMTP).

## 6. Web Push daily reminder

- **VAPID**: `push.Service` uses configured keys or generates a pair at boot
  (logged for pinning). Public key served at `/api/push/vapid-public-key`.
- **Subscription**: `/api/push/subscribe` persists the browser subscription.
- **Scheduler**: `robfig/cron/v3` with `cron.WithLocation(Asia/Jakarta)` fires
  `0 17 * * *` — **17:00 WIB daily** — and pushes
  "Waktunya isi timesheet hari ini!" to every active user with no entry for the
  day, via `SherClockHolmes/webpush-go`.
- **Service worker** (`frontend/public/sw.js`): handles `push` and
  `notificationclick`, showing a native notification and focusing/opening the
  dashboard.

## 7. Deployment

- `docker-compose.yml`: PostgreSQL, pgAdmin (DBeaver can also attach on 5432),
  Mailpit (SMTP + web UI on 8025), backend, frontend.
- Multi-stage `Dockerfile` builds the static Next export and the Go binary into
  one image (`STATIC_FILES_PATH` serves the frontend).
- `deploy_and_commit.sh`: validates a Conventional Commit, commits + pushes,
  SSHes to `192.168.0.2:222`, **scans upward from port 2000** for a free port on
  the host, and brings the stack up there.

## API surface (summary)

| Method & path                              | Auth   | Purpose                        |
| ------------------------------------------ | ------ | ------------------------------ |
| `POST /api/auth/login`                     | public | Password login                 |
| `POST /api/auth/passkey/login/{begin,finish}` | public | Passkey login               |
| `POST /api/auth/forgot-password`           | public | Request reset link             |
| `POST /api/auth/reset-password`            | public | Set new password via token     |
| `GET  /api/me`                             | user   | Current profile                |
| `POST /api/profile/change`                 | user   | Submit profile change (pending)|
| `POST /api/passkey/register/{begin,finish}`| user   | Add a passkey                  |
| `POST /api/activities`                     | user   | Upsert a day                   |
| `GET  /api/activities?year&month`          | user   | Month view                     |
| `POST /api/timesheet/generate`             | user   | Generate + email `.xlsx`       |
| `GET  /api/templates`                      | user   | List templates + mappings      |
| `GET  /api/templates/:id/grid`             | user   | Parsed grid for Handsontable   |
| `POST /api/push/subscribe`                 | user   | Save push subscription         |
| `GET  /api/admin/users` / `POST`           | admin  | List / create users            |
| `PATCH|DELETE /api/admin/users/:id`        | admin  | Update / delete user           |
| `GET  /api/admin/profile-changes`          | admin  | Pending profile changes        |
| `POST /api/admin/profile-changes/:id/review` | admin| Approve / reject               |
| `POST /api/admin/templates`                | admin  | Upload template                |
| `POST /api/admin/templates/:id/mappings`   | admin  | Save cell mappings             |
