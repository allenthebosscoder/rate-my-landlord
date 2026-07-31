# RateMyLandlord

A site for tenants to rate and review landlords and property management companies, similar in spirit to Glassdoor but for rental housing.

The project has two parts:

- **Backend** (repo root) — a [Quarkus](https://quarkus.io/) REST API backed by PostgreSQL, with Flyway-managed migrations.
- **Frontend** ([`rate-my-landlord/`](rate-my-landlord/)) — a [Next.js](https://nextjs.org/) app that renders the UI and proxies API calls to the backend.

## Prerequisites

- Java 25+ and Maven (the bundled `./mvnw` wrapper will download the right Maven version for you)
- PostgreSQL running locally with a `ratemylandlord` database
- Node.js 20+

## Backend setup

1. Create the database (empty is fine — Flyway creates the schema on startup):

   ```shell
   createdb ratemylandlord
   ```

2. Config lives in `src/main/resources/application.properties`, entirely via environment variables with dev-friendly defaults (`postgres` / `password` on `localhost:5432`, CORS wide open). Nothing needs editing to run locally; see [`.env.example`](.env.example) for what to override for a real deployment (a managed Postgres URL, real credentials, a locked-down `CORS_ORIGINS`).

3. Run the API in dev mode:

   ```shell
   ./mvnw quarkus:dev
   ```

   The API listens on `http://localhost:8080`. The Quarkus Dev UI is available at `http://localhost:8080/q/dev/` while running in dev mode.

### Database migrations

Schema changes go through Flyway migrations in `src/main/resources/db/migration/` (`V1__*.sql`, `V2__*.sql`, ...) — Hibernate is set to `validate` mode, so it checks the entities match what Flyway created but never touches the schema itself. Restarting the app does **not** wipe data.

To add a column or table: write a new `V{n}__description.sql` migration rather than editing an old one. Note the existing schema's column-naming quirk (Hibernate's default naming here): regular columns are lowercased with no underscores (`passwordhash`, `isreported`), but foreign-key/association columns do get `_id` (`owner_id`, `landlord_id`). Match that unless you add an explicit `@Column(name = ...)` on the entity field.

### Authentication

Accounts are username/password (bcrypt-hashed) with opaque, server-side session tokens (not JWTs — revocable on logout, no signing-key management). Send `Authorization: Bearer <token>` on any authenticated request. An email is required at registration (not just for login) since it's what password reset is sent to.

**Admin bootstrap**: set `ADMIN_USERNAMES` (comma-separated) to the usernames that should be admins — they get promoted on registration, or on their next login if the account already exists. Leave it unset for local dev and the first account ever registered becomes admin instead, so there's always someone who can moderate without extra setup. Set the allowlist before any real deployment: with it unset, whoever registers first on a public site becomes admin, which is fine on your laptop and not fine in the open.

Admins can moderate reported reviews and delete any review, not just their own.

Login, register, and forgot-password are rate-limited per IP (in-memory — fine for one instance, would need a shared store like Redis behind a load balancer). Creating a review is rate-limited per account.

| Method | Path                     | Description                                              |
| ------ | ------------------------ | ---------------------------------------------------------|
| POST   | `/auth/register`         | Create an account (username, email, password required), returns `{token, username, isAdmin}` |
| POST   | `/auth/login`            | Log in, returns `{token, username, isAdmin}`              |
| POST   | `/auth/logout`           | Revoke the current token                                  |
| POST   | `/auth/forgot-password`  | Email a reset link if the email has an account (always returns the same generic response either way, to avoid leaking which emails are registered) |
| POST   | `/auth/reset-password`   | `{token, newPassword}` — token is single-use, expires in 60 minutes, and resetting revokes all of that account's existing sessions |

Password reset email is mocked by default (`MAIL_MOCK=true`) — nothing is actually sent, and the reset link is logged instead (`grep "Password reset requested" ` on the backend output), so the whole flow works locally with zero setup. Set `MAIL_MOCK=false` and fill in real SMTP details in `.env` to actually send mail.

### API reference

All endpoints are rooted at `/reviews`. Endpoints marked 🔒 require `Authorization: Bearer <token>`; 🔒👑 requires an admin token.

| Method | Path                        | Description                                              |
| ------ | --------------------------- | ---------------------------------------------------------|
| GET    | `/reviews`                   | List all reviews (include a token to get `myVote` per review) |
| POST   | `/reviews` 🔒                 | Create a review (creates the landlord/property if new)   |
| GET    | `/reviews/{id}`               | Get a single review                                      |
| PUT    | `/reviews/{id}` 🔒 (owner)    | Update your own review                                    |
| DELETE | `/reviews/{id}` 🔒 (owner/admin) | Delete a review                                       |
| POST   | `/reviews/{id}/helpful` 🔒    | Toggle a helpful vote (one per user; opposite vote switches it) |
| POST   | `/reviews/{id}/unhelpful` 🔒  | Toggle an unhelpful vote                                   |
| POST   | `/reviews/{id}/report` 🔒     | Flag a review as reported                                  |
| GET    | `/reviews/reported` 🔒👑      | List reported reviews                                      |
| POST   | `/reviews/{id}/dismiss-report` 🔒👑 | Clear a review's reported flag                       |

Ratings are clamped to `1.0`–`5.0` in half-star increments.

### Dev-only review seeder

`POST /dev/seed-reviews?count=30` generates randomized test reviews, weighted toward a handful of landlords rather than spread evenly. Only wired up in the `dev` build profile (`@IfBuildProfile("dev")`) — it doesn't exist in a packaged build. The frontend exposes it as a "🎲 Seed Reviews" button in the nav, itself only rendered when `NODE_ENV === "development"`.

### Packaging

```shell
./mvnw package
```

This produces `target/quarkus-app/quarkus-run.jar`, run with:

```shell
java -jar target/quarkus-app/quarkus-run.jar
```

To build an über-jar instead: `./mvnw package -Dquarkus.package.jar.type=uber-jar`.

## Frontend setup

```shell
cd rate-my-landlord
npm install
npm run dev
```

The app runs on `http://localhost:3000` and proxies to the backend at the `BACKEND_URL` environment variable (defaults to `http://localhost:8080`; see [`rate-my-landlord/.env.example`](rate-my-landlord/.env.example)). Country/state/city lookups for the review form come from the public [Countries Now API](https://countriesnow.space/).

Other useful scripts (run from `rate-my-landlord/`):

```shell
npm run build   # production build
npm run start   # run a production build
npm run lint    # eslint
```

## Known gaps before this is a real production deployment

- No automated tests, CI, or error monitoring.
- No email *verification* — forgot-password proves you control an inbox, but nothing checks the email is real at signup.
- Session tokens live in `localStorage` (readable by injected scripts); production-grade auth would want httpOnly cookies instead.
- Rate limiting is in-memory, per-instance — fine for one server, not for a horizontally-scaled deployment (would need Redis or similar behind it).
- `GET /reviews` returns everything with no pagination.
- No Terms of Service / content policy — worth having before real users can be named in reviews.
- No real hosting/domain/TLS — this is still local-only (`localhost:8080` / `localhost:3000`).
- No Google/social sign-in — password-only for now by choice, to avoid the added complexity (nullable passwords, external OAuth client setup) until it's actually needed.
- Landlord identity has no dedup/verification — "Sunrise Property Management" typed two different ways becomes two different profiles, silently fragmenting reviews.

## Project structure

```
src/main/java/org/acme/
├── AppUser.java                        # entity (accounts)
├── AuthToken.java                      # entity (session tokens)
├── PasswordResetToken.java             # entity (single-use, 60-min reset tokens)
├── RateLimiter.java                    # in-memory sliding-window limiter (CDI bean)
├── Landlord.java                       # entity
├── Property.java                       # entity
├── Review.java                         # entity
├── ReviewVote.java                     # entity (one helpful/unhelpful vote per user per review)
└── resource/
    ├── AuthResource.java                # /auth/* endpoints
    ├── ReviewResource.java              # /reviews/* endpoints
    └── DevSeedResource.java             # dev-only /dev/seed-reviews

src/main/resources/db/migration/        # Flyway migrations

rate-my-landlord/
├── app/page.tsx                        # main UI (browse, write reviews, moderation)
├── app/layout.tsx                      # root layout
└── app/api/**                          # route handlers that proxy to the backend
```
