# MyCDRecords API

A CD/album registration REST API built with **Express + TypeScript**. It lets users catalog albums, write and vote on reviews, follow other users, build custom lists/collections, and earn badges through gamification. Music metadata is powered by the **MusicBrainz** and **Spotify** APIs.

## Features

- 🔐 **Authentication** — JWT access tokens, refresh tokens, email verification, and password reset.
- 👤 **Profiles & Users** — User accounts with public profiles.
- 🛡️ **Admin** — Role-based admin actions (bans, moderation).
- 💿 **Music data** — Artist, album, and track search via MusicBrainz.
- 🎧 **Spotify integration** — Enriched album/track data from the Spotify API.
- ⭐ **Reviews & Votes** — Rate and review albums; upvote/downvote reviews.
- 🤝 **Social** — Follow/unfollow other users.
- 📋 **Lists** — Create custom collections of albums.
- 🏆 **Gamification** — Badges and achievements awarded to users.
- 🧭 **Recommendations** — Personalized suggestions.
- 🚦 **Rate limiting** — Redis-backed with an in-memory fallback.
- 📚 **API docs** — Interactive Swagger UI.

## Tech Stack

- **Runtime:** Node.js 18+
- **Language:** TypeScript
- **Framework:** Express 4
- **Database:** MySQL (via `mysql2`)
- **Cache / Rate limiting:** Redis (via `ioredis`, optional)
- **Validation:** Zod
- **Auth:** JSON Web Tokens (`jsonwebtoken`), `bcrypt`
- **Logging:** Winston + Morgan
- **Docs:** `swagger-jsdoc` + `swagger-ui-express`
- **Testing:** Jest, ts-jest, Supertest

## Prerequisites

- **Node.js** 18 or newer (and npm)
- **MySQL** server (a reachable instance for the database)
- **Redis** — optional; if `REDIS_URL` is not set, rate limiting falls back to an in-memory store
- **Docker** — optional, for containerized runs

## Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd myCDrecords-server

# 2. Install dependencies
npm install

# 3. Create your environment file from the example
Copy-Item .env.example .env
# then edit .env and fill in your own values
```

The API cannot authenticate users until `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`,
`MYSQL_PASSWORD` and `MYSQL_DATABASE` point to a reachable MySQL instance.
For local development with a self-signed certificate, keep
`MYSQL_SSL_REJECT_UNAUTHORIZED=false`. In production, provide a trusted
`MYSQL_SSL_CA` and use `MYSQL_SSL_REJECT_UNAUTHORIZED=true`.

## Environment Variables

Configure these in your `.env` file (see [.env.example](.env.example) for the full template):

| Variable | Description |
| --- | --- |
| `MYSQL_HOST` | MySQL host |
| `MYSQL_PORT` | MySQL port (e.g. `3306`) |
| `MYSQL_USER` | MySQL username |
| `MYSQL_PASSWORD` | MySQL password |
| `MYSQL_DATABASE` | Database name (e.g. `mycdrecords`) |
| `PORT` | HTTP port the server listens on (default `3004`) |
| `DOMAIN` | Base domain of the server |
| `NODE_ENV` | `development`, `production`, or `test` |
| `JWT_SECRET` | Secret for signing access tokens |
| `ADMIN_EMAILS` | Comma-separated emails granted admin role |
| `FRONTEND_URL` | Frontend origin (used for CORS and links) |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Spotify API credentials |

## Running Locally

Development mode (auto-reload with nodemon):

```bash
npm run dev
```

Development mode for the API and React client together (run from this folder):

```bash
npm run all-dev
```

The API runs on `http://localhost:3004` and the client uses Vite on `http://localhost:5173` (or the next available port).

Production build and start:

```bash
npm run build   # compiles TypeScript into dist/
npm start       # runs node dist/server.js
```

On startup the app connects to MySQL and **automatically creates all required tables** (and seeds default badges). Once running:

- API base URL: `http://localhost:3004`
- Swagger docs: `http://localhost:3004/docs`

> The default port is `3004`; override it with the `PORT` variable in `.env`.

## Docker

A `Dockerfile` is provided (based on `node:18-alpine`):

```bash
# Build the image
docker build -t mycdrecords-server .

# Run the container (map the container's port 3000 to a host port)
docker run --env-file .env -p 3000:3000 mycdrecords-server
```

## Running Tests

### Experimental PyTorch recommendations in the feed

`GET /api/recommendations` uses the authenticated account's saved choice.
`GET/PUT /api/recommendations/engine` reads/saves `{ "enabled": boolean }`;
the PUT body is strict and never accepts a user ID. Disabled by default,
the setting selects the bundled `artist-bpr-fictional-v1` model when enabled;
otherwise requests use `f11b-v1`. The deprecated `engine` query is ignored.
Responses include `mlEnabled` even when inference falls back.
Migration 010 adds `recommendation_preferences.ml_enabled` with default 0
and runs at startup after migration 006. Restart the API before using the new
client. Existing taste preferences are preserved; prior URL choices are not
silently converted into saved activation. This setting is not pilot training consent.
Training uses only 24 fictional profiles / 72 manually simulated artist
interactions. Published JSON includes artist vectors, SHA-256 and Python/Node
conformance scores, not real or fictional user embeddings.

```powershell
npm run ml:catalog:seed
npm run ml:catalog:verify
npm run ml:engine:migrate
npm run build
npm test -- --runInBand
```

`ml:engine:migrate` applies/checks migration 010 twice and verifies its disabled
default without reading account data. It requires the existing preferences table
(migration 006) and ALTER permission, and closes its pool on completion.

The seed uses official MusicBrainz browse requests with independently identified
artist MBIDs, existing throttling/backoff, and core/CC0 fields only; no tags or
Spotify. Wikidata/P434 supplies lookup identities, not affinity data. Existing
catalog records are not overwritten. No user/account/review fixtures are inserted.
The verified MySQL catalog contains 244 albums; the compiled runtime produced
different 10-item rankings for two fictional profiles without reading real users.

Inference reads only the authenticated actor's own MusicBrainz-linked ratings,
favorites, dismissals and explicit artist preferences. Exact names from the
24-artist vocabulary are supported; genres and aliases are not ML features.
Ratings override favorites, 3 is neutral and 1/2 push away. Profile vectors and
ML rankings are discarded after the response, never used to update model weights.
Candidates require affinity >= 0.35, exclude known/dismissed albums and allow at
most two albums per artist. There is no HTTP Python service or new dependency.

`ml.status=active` identifies an actual ML ranking. `cold_start`/`no_candidates`
identify an explicit fallback to the original engine; version and reasons always
describe the engine used. Invalid model/checksum/parity/storage returns
`503 ML_UNAVAILABLE`. See route Swagger for the complete contract.

Activate ML in the feed or **Configurações → Recomendações**, then open
`http://localhost:5173/recommendations`, choose supported artists
in **Ajuste seu gosto**, add and save. No external artist search is needed in this
mode. Once enabled, the checkbox disappears outside settings. The choice follows
the account across navigation, reload and login; profile vectors are still ephemeral.

Original serving delivery: 385 API tests / 40 suites (8 existing skipped), build
and real MySQL 14-check homologation. The account-setting adjustment passed build
and 27 targeted HTTP/SQL/migration tests. Migration 010 was applied and checked
twice on the configured MySQL without reading account data.
The [ML package](https://github.com/Henrique-Montrezor/myCDrecords-ml#readme)
documents retraining/publication and the synthetic evaluation limits.
Real-user quality remains unmeasured; the consented real-training pilot below
is separate and does not authorize publication of real-user model weights.

### ML0: isolated synthetic readiness diagnostic

The [PyTorch roadmap](../ML-ROADMAP.md) starts with data eligibility and
measurement, not model training. Run the initial diagnostic from this package:

```powershell
npm run ml:readiness -- --synthetic
```

This command uses an internal deterministic fixture only: three synthetic users,
five catalog identities and six ratings. It does not initialize the application,
read `.env`, connect to MySQL/Redis, request provider data, import files or write
datasets. Unsupported or missing arguments produce an error and exit code 2.
No new dependency is required.

The report contains aggregates, not user/album IDs:

- `coverage`: distinct rated albums / declared catalog albums.
- `density`: distinct user/album ratings / (users with ratings × catalog albums).
- `ratingsPerUser`: minimum, maximum and average among users with ratings only.
- `overlap`: albums rated >= 4 by at least two users and distinct users sharing
  such an album; this is not a count of user pairs.
- `updatedRows`: rows whose update time exceeds creation time, not proof that
  the rating value changed.
- `period`: first creation and last update among the current snapshot rows.

Empty inputs produce zero ratios and null period boundaries, never an approval.
The CLI always reports `promotionAllowed: false`,
`realWorldQuality: "not_measured"` and
`temporalEvaluation: "blocked_missing_event_history"`. Passing this diagnostic
does not validate recommendation relevance or reconstruct deleted/edited events.
The synthetic schema is not an import contract or proof of provenance for real
records; only the internal fixture is accepted by the CLI.

The pilot is isolated and intended to remain compatible with future commercial
use. Spotify content and MusicBrainz tags/genre associations without validated
licensing are excluded. Real data collection/export remains a separate, gated
roadmap step.

### Synthetic PyTorch laboratory in the application

The [ML package guide](../myCDrecords-ml/README.md) documents setup, training and
validation. Once its synthetic snapshot has been generated, run from this API:

```powershell
npm run ml:lab
```

This starts a separate development entry of the existing Express package at
`http://localhost:3005/api/recommendations/lab`, bound to loopback. It does not
load `.env`, initialize the main app/database or train on HTTP requests.
No login, cookies or real catalog data are used. Production startup is refused;
the endpoint is not mounted in the main API.

With the Vite client running, open
`http://localhost:5173/recommendations/lab` to compare saved PyTorch/BPR and
popularity rankings for 12 synthetic profiles. The page is development-only and
isolated from the real session provider. Existing recommendations are unchanged.

Missing/invalid snapshots return explicit 503 errors, not invented suggestions.
The response is validated and `no-store`; scores are not probabilities.
Synthetic success does not establish relevance for real users or authorize ML
promotion.

### Real-data pilot preflight and synthetic exchange

```powershell
npm run ml:preflight
npm run ml:export:rehearsal -- --synthetic
```

The preflight prints the owner's pilot decisions and outstanding blockers. It
deliberately exits **1** while blocked (unsupported arguments: **2**), without
starting the app, loading `.env` or accessing a database/provider. The current
decision is an internal, explicit opt-in pilot using prospective independent
ratings, with 30-day event retention. The owner has declared specific, optional,
revocable consent and an approved confidential policy, which was not requested
or inspected. These declarations do not establish legal compliance; linked
ratings may be personal data.

The static preflight covers **persisted real models and serving**, not the
running collection state or the separate private in-memory trainer.
`realDataAllowed=false` and `promotionAllowed=false` refer to that scope.
Confidential policy references need not be shared. Collection uses separate,
default-off runtime controls below.

### Private real training and MySQL verification

```powershell
npm run ml:mysql:diagnose
npm run ml:mysql:verify
npm run ml:pilot:migrate
npm run ml:train:real
```

Diagnosis exposes only DNS/TCP/protocol status, never endpoint or credentials.
Verification creates a unique `mycdrecords_ml_tests_<uuid>` schema and runs real
008/009 migrations and transaction/consent/expiry/locking checks with disposable
fixtures. Application data is untouched. The schema/public notice archive are
retained; all test rows are rolled back. Requires CREATE DATABASE privilege and
at least two pool connections. `migrate` explicitly applies only additive ML
migrations in the configured application database; it never enables collection.

Training reads only retained prospective independent events with an active
account, matching unwithdrawn receipt for **ml-pilot-v2** and core/CC0 ledger.
It sends per-run pseudonyms and closed fields to local PyTorch through stdin,
without inherited DB/provider credentials. Datasets, maps, weights and individual
rankings are never saved. Real timestamps retain six decimals; sequences retain
BIGINT precision. Global time cuts (60/20/20), validation-only epoch selection,
held-out test and popularity baseline reuse the temporal/BPR core.

After training, Node rechecks DB generation and the exact eligible rows before
accepting the aggregate result. Empty/inadequate history, expiry, withdrawal,
oversized inputs or database failures produce explicit nonzero errors.
Only private aggregate run results are stored under the ML package's ignored
`artifacts` directory; failure replaces the current result with a blocked status.
This does not publish to the visual lab or production recommendations.

**Actual execution on 2026-11-16:** after an initial transient connection failure
(`ETIMEDOUT`/`MYSQL_GREETING_TIMEOUT`), real MySQL verification passed all **14
checks**. Additive migrations 008/009 were then applied in the configured
application database. Real training returned **`NO_ELIGIBLE_EVENTS`**: zero
eligible authorized events, so no real model was trained. No receipts were
fabricated and old reviews were not backfilled. TLS and `.env` were not changed.
Code verification: 376 tests/38 API suites, API/test types and build passed;
20 Python tests passed, including the disposable Node-to-PyTorch bridge.
See the [training guide](../myCDrecords-ml/README.md) for the closed contract and
pilot size limits. No confidential document is needed by these commands.

The exchange command prints only the built-in synthetic event fixture as JSON.
It rejects missing/unsupported arguments and never accepts user IDs, SQL,
input files or `--real`. The [ML guide](../myCDrecords-ml/README.md) documents
piping this strict contract into PyTorch through `temporal --synthetic --stdin`.
Review text, images, tags, account identifiers and provider content are excluded.
The synthetic exchange is a rehearsal, not a way to relabel real data.

### ML1b: optional prospective rating collection

The [pilot controls](src/modules/recommendations/recommendations.pilot.controls.ts)
now run on review creation/rating updates, owner/moderator deletion and account
ban transactions. **Collection is off by default.** Normal registration,
existing reviews and public-review acknowledgements never enroll anyone.
Only invited, active accounts with a matching unwithdrawn consent receipt and
verified independent album eligibility can contribute.

[Migrations 008](src/mysql2/migrations/008-ml-pilot-controls.ts) and
[009](src/mysql2/migrations/009-ml-pilot-collection.ts) are registered in the
normal bootstrap after users/recommendation tables. Restarting the main API
will apply these additive changes using its usual migration privileges.
No backfill, automatic invitations or invented acknowledgements are performed.
Migration 009 archives the exact public notice JSON: changing its contents
under the same version fails startup instead of overwriting consent evidence.

The [router](src/modules/recommendations/recommendations.pilot.routes.ts) is
mounted under `/api/recommendations/pilot` and documented in Swagger:

| Method | Contract |
| --- | --- |
| GET `/notice` | Public, no SQL; full versioned notice, purpose, data, retention, withdrawal and contact |
| GET `/participation` | Authenticated own status: invited, participating, closed, noticeVersion |
| PUT `/participation` | Strict `{ accepted: true, noticeVersion: "ml-pilot-v2" }`; invited authenticated account only |
| DELETE `/participation` | No body fields; withdraws only the authenticated subject, including while collection is disabled |

Authenticated responses are `private, no-store`. GET/PUT return 503
`ML_PILOT_BLOCKED` before SQL while the runtime gate is closed. Extra body
fields, refused permission, registration-only and draft versions are rejected;
when disabled, the availability gate takes precedence over body validation.
Withdrawal removes pilot events, closes active receipts and invalidates the
generation atomically. It does not delete public reviews. Rejoining requires a
fresh explicit acknowledgement; previous withdrawal receipts are retained
until their own expiry, not overwritten.

The public notice is `ml-pilot-v2`, held by Administradores - MyCDRecords,
contact `Contato@MyCDRecords.com`; its immutable content is in
[pilot.collection](src/modules/recommendations/recommendations.pilot.collection.ts)
and the database notice archive. This is a separate public summary, not a copy
of the confidential document. The operator must check that this exact notice
matches the approved policy before enabling it. This delivery does not certify
the policy or the contact's operation. Version v1 explicitly excluded training
in its stage; it is not rewritten or treated as authorization for v2. Participants
must explicitly acknowledge v2 before contributing to real memory training.

Only newly created independent ratings are captured. Editing a pre-enrollment
or otherwise untracked review does not start collection. Rating updates require
a still-retained event from the current participation; text-only edits create
no ML event. After that stream's 30-day window expires, editing the old review
does not recreate history. Owner/moderator deletion erases that album's events
and invalidates the generation rather than retaining deleted ratings. A rating
edit while collection is paused removes stale collected ratings. Ban withdraws
participation; unban does not restore permission.

The recorder receives only internal IDs, rating, server UUID and database UTC
timestamps/sequence; no review text, titles, covers, tags or Spotify content.
Raw account IDs remain private in MySQL; they are not anonymized and cannot be
fed to the Python package. UUID format alone does not establish provenance.

#### Private local activation (operator only)

**No real account/rating records or confidential document were inspected.**
Real isolated MySQL verification passed; application ML migrations were applied,
and the authorized export query returned no eligible events.
First homologate migrations, concurrent consent/write/withdrawal, expiry and
failure/rollback on an authorized isolated MySQL with disposable fixtures.
Do not treat SQL mocks as real MySQL certification.

1. Review `GET /api/recommendations/pilot/notice` and ensure the contact works.
2. Provision and monitor an independent durable scheduler, at least every
   minute, for `node dist\modules\recommendations\recommendations.pilot.manage.cli.js purge`,
   including periods when the API is stopped. Use the built API directory as
   its working directory; this command does not require development dependencies.
   Secure its credentials and working directory. Define deletion for replicas,
   logs/backups/restores; a confirmation flag does not implement these controls.
3. Only after these checks, configure locally (never send credentials, policy
   contents or real records to AI tools):

   ```dotenv
   ML_PILOT_COLLECTION_ENABLED=true
   ML_PILOT_NOTICE_APPROVED_VERSION=ml-pilot-v2
   ML_PILOT_DURABLE_RETENTION_CONFIRMED=true
   ```

4. Restart the main API. Bootstrap validates/archives the notice and performs
   cleanup before allowing collection. A process-local 60-second cleanup loop
   also runs while paused; failure blocks new collection until a successful
   cleanup. Expiry is server-owned; physical removal is periodic, not a promise
   of exact-clock deletion. If the required durable retention/backup controls
   cannot be operated, **leave collection disabled**.
5. Prepare invitations and independently verified core/CC0 album eligibility
   through the private CLI, not an HTTP endpoint. Replace placeholders locally:

   ```powershell
   npm run ml:pilot:manage -- --help
   npm run ml:pilot:manage -- invite --user-id ID_INTERNO
   npm run ml:pilot:manage -- album --album-id MBID_VERIFICADO --evidence REFERENCIA_PRIVADA --first-available-at ISO_UTC_COM_EVIDENCIA --confirm-independent-core-cc0
   ```

   The attestation is the operator's responsibility, not automated license
   verification. Existing eligibility is not silently overwritten. A correction
   requires explicit revocation (which erases its events) before registration.
6. Each participant reads the notice and submits their own authenticated PUT
   in Swagger (`http://localhost:3004/docs`) or another trusted API client.
   Administrators cannot give consent by supplying somebody else's ID.
   An invitation alone collects nothing. This slice adds **API participation,
   not a new frontend consent form**.

Pause new collection by setting `ML_PILOT_COLLECTION_ENABLED=false` and
restarting the API; withdrawal, expiry and deletion remain available.
`revoke-album --album-id MBID_VERIFICADO` removes eligibility and its events.
`close --confirm-end` permanently closes this pilot in the database, deletes
events and starts the 30-day post-closure receipt period; restarting with flags
enabled does not reopen it. These are private destructive operations: run only
with explicit operator authorization. Successful CLI output contains status or
cleanup counts, not user records; keep error logs private as well.

Retention keeps receipts throughout participation and deletes withdrawn
receipts/participation records after 30 days. The public notice archive contains
no individual acknowledgements and remains available as version evidence.
A generation change does not erase weights or make a model forget. Real
exports, pseudonymization, derivative-file cleanup and real ML publication are
still blocked; do not send these rows to the synthetic-only Python importer.
After restoring a backup, keep collection disabled and close/quarantine this
pilot before reopening application traffic; never restore old consent as a
fresh authorization. Account-deletion/derivative invalidation and recovery
must be integrated before any future real model can be published.
See the [roadmap](../ML-ROADMAP.md) for validation evidence and remaining gates.

Validation for this slice: API typecheck/build and **368 tests in 36 suites**
passed with `npm test -- --runInBand --testPathIgnorePatterns=mysql.test.ts`;
the private CLI help also ran without database access. Ordinary tests mock
dotenv and the database; the two explicitly opt-in MySQL suites keep their
local credential loading but were excluded from this run. This does **not**
certify real MySQL migration/locking or activate collection. No UI/Python code
was changed or revalidated.

### API test suite

The project uses Jest with ts-jest and Supertest (unit and integration tests under `src/tests/`).

```bash
npm test              # run the full test suite
npm run test:watch    # run tests in watch mode
npm run test:coverage # run tests with a coverage report
```

## API Overview

### Public-review acknowledgement on password registration

`POST /api/auth/register` now requires this object in addition to the existing
username, email, password and password confirmation:

```json
{
  "publicReviewNotice": {
    "accepted": true,
    "version": "public-reviews-v1"
  }
}
```

Archived notice **`public-reviews-v1`**, introduced on 2026-11-16:

> Entendo que minhas reviews serão públicas e que não devo publicar dados pessoais meus ou de terceiros.

This acknowledges publication only. It is not consent for model training, a
general privacy policy, or a waiver of the application's legal responsibilities.
Keep this version's text immutable; a changed notice needs a new version and
coordinated API/client deployment.

Missing/refused acknowledgements, unsupported versions and extra fields inside
the acknowledgement return HTTP 400 before account creation. Old clients are
not automatically opted in: update the client together with the API.

Migration `007-public-review-notice` runs through `createUserTable` on the next
main API startup. It additively creates nullable
`users.public_review_notice_version` and
`users.public_review_notice_accepted_at` columns, resuming after a partial run.
Account creation writes the version and database UTC time in the same INSERT;
neither IP nor a client-supplied acceptance timestamp is recorded.

Deploy/restart the API with the existing schema migration privileges before
using the new registration flow. Existing accounts are not backfilled. The
legacy OAuth account-creation path remains unchanged and receives no invented
acknowledgement; this slice does not certify that flow.

Validation used mocked MySQL queries/migrations and HTTP integration tests;
the migration was **not run against a real database** during this change.
Real-data ML gates remain blocked.

All routes are mounted under `/api`. Explore and try them via the Swagger UI at `/docs`.

| Base path | Description |
| --- | --- |
| `/api/auth` | Registration, login, tokens, verification, password reset |
| `/api/user` | User account management |
| `/api/profile` | User profiles |
| `/api/admin` | Admin/moderation actions |
| `/api/artist` | Artist search (MusicBrainz) |
| `/api/albuns` | Album search (MusicBrainz) |
| `/api/musics` | Track search (MusicBrainz) |
| `/api/spotify` | Spotify-enriched data |
| `/api/reviews` | Album reviews |
| `/api/social` | Follows and votes |
| `/api/lists` | Custom lists/collections |
| `/api/gamification` | Badges and achievements |
| `/api/recommendations` | Personalized recommendations |

## Curadoria do Descobrir (F8b)

Esta fatia usa exclusivamente metadados MusicBrainz e notas editoriais locais.
Não importa histórico nem conteúdo Spotify e não gera recomendações pessoais ou charts.

### Persistência

- A inicialização executa a migração aditiva e repetível em `src/mysql2/migrations/001-discovery.ts`, depois da tabela de usuários. O usuário MySQL precisa de permissão de DDL.
- `album_catalog` mantém identidade interna e unicidade por `(source, external_id)`, créditos, data/tipo, tags normalizadas, URL da fonte e `observed_at`. Não junta discos por título, edições ou IDs Spotify.
- Consultas bem-sucedidas a `GET /api/albums/discover` atualizam o lote consultado em uma escrita bulk; uma falha de persistência retorna 503, não sucesso incompleto.
- `observed_at` registra a observação local, não uma atualização confirmada no provedor. O adaptador MusicBrainz usa o cache existente de 60 segundos. Não há job agendado, importação massiva nem fan-out por card nesta fatia.
- As tabelas `discovery_selection` e `discovery_selection_items` guardam publicação, revisão, responsável, notas e ordem. A migração não apaga seleções, semeia escolhas ou concede acesso administrativo.
- A migração pode ser repetida após interrupção, pois DDL MySQL tem commit implícito. Isso não substitui um runner global versionado, backups ou plano de rollback de produção; não remover tabelas como procedimento de recuperação.

### Publicar uma seleção

Usar uma conta **já autorizada como administradora** e autenticação existente.
As rotas estão documentadas no Swagger em `/docs`; não salvar tokens nos exemplos ou no repositório.

1. Consultar o catálogo pelo Descobrir ou importar um release-group específico com `POST /api/admin/discovery/catalog/{albumId}`. O ID deve ser um MBID UUID, não um ID de edição/release nem de Spotify. A importação verifica o álbum no MusicBrainz e não o publica.
2. Ler `GET /api/albums/discover/selection` e obter a revisão atual.
3. Enviar `PUT /api/admin/discovery/selection` com a revisão lida e até **6 álbuns distintos**, em ordem, cada um com nota de **1 a 800 caracteres**. O primeiro recebe destaque. Exemplo de formato (substituir a revisão e o MBID pelos valores reais):

```json
{
  "revision": 0,
  "items": [
    {
      "albumId": "737dc6a9-b343-4084-9c0a-206d3e538abb",
      "note": "Explique o motivo desta escolha editorial."
    }
  ]
}
```

4. A resposta contém a nova `revision`. A publicação troca todos os itens numa transação: conflito ou falha não deixa seleção parcial. Em **409**, reler e reconciliar a seleção; não sobrescrever automaticamente. Em **404**, importar o álbum ausente antes de tentar novamente.
5. Para despublicar, enviar explicitamente `{ "revision": <revisão atual>, "items": [] }`. Não há periodicidade semanal automática nem painel visual administrativo nesta fatia.

Leitura pública: `{ sectionId, kind, title, source, status, revision, updatedAt, curator, items }`.
Cada item contém `{ album, note }`; os álbuns declaram `source: "musicbrainz"`.
`status` é `ready` ou `empty`; falha de banco é **503**, não uma seleção vazia falsa.
`updatedAt` é a data da publicação. O frontend exibe autoria e data, com retry independente do catálogo.
Publicação e importação exigem autenticação (401) e admin existente (403); payload inválido retorna 400, provedor indisponível 502 e armazenamento indisponível 503.

Respeitar as [licenças dos dados MusicBrainz](https://musicbrainz.org/doc/About/Data_License):
dados centrais são CC0; dados suplementares, incluindo tags, têm condições adicionais (BY-NC-SA).
Esta implementação não certifica uso comercial desses dados. Capas são do Cover Art Archive e mantêm direitos próprios; preservar atribuição e imagem intacta, com fallback para indisponibilidade.

## Listas sociais (F9)

- A inicialização executa `src/mysql2/migrations/002-list-saves.ts` após listas e itens. Migração aditiva/repetível, sem dados artificiais; requer permissão de DDL.
- `GET /api/lists/explore` exige login. Query estrita: `scope=popular|following|friends|mine|saved`, `q` com até 100 caracteres, `sort=popular|recent`, `page=1..10000`; página fixa de 20. Padrões: `popular`, busca vazia, `popular`, página 1. `following` é follow unilateral; `friends` exige reciprocidade. Somente `mine` inclui listas privadas.
- Resposta: `{ items, total, page, pageSize, totalPages, mode }`. Cada lista inclui autoria, contagem global, `is_saved`, `save_count` e até 4 prévias ordenadas. Uma consulta batch limitada constrói as prévias, sem carregar 1000 itens nem fazer HTTP por card.
- Popularidade: pessoas distintas que salvaram nos últimos **30 dias**, mínimo **3 terceiros**, sem o autor. Desempate por salvos, criação e ID decrescentes. Se o conjunto filtrado não tiver amostra, `mode=recent`, claramente identificado no client. Uma página além do fim não muda para outro conjunto. Ordenação recente: criação/ID decrescentes.
- `PUT /api/lists/{id}/saved` e `DELETE` na mesma rota são idempotentes para listas existentes. `PUT` repetido não atualiza `created_at`; não copia discos nem segue o autor. Autenticação 401; lista ausente 404; salvar privada 403; salvar a própria pública 400.
- Salvar bloqueia a lista em transação. Tornar privada atualiza visibilidade e limpa salvos na mesma transação; falha reverte ambos. Exclusão usa FK com cascade. Todas as leituras verificam a visibilidade atual e todas as respostas de listas usam `Cache-Control: no-store`; não há cache novo de prévias.
- `GET /api/lists/{id}?page=1` continua público para listas públicas e restrito ao dono para privadas. **Mudança de contrato:** retorna no máximo **24 itens**, `item_count` global, `page`, `pageSize`, `totalPages`, `username` e `is_saved`. Client migrado para paginação; consumidores externos devem iterar páginas. Ordem estável: posição (null como zero), criação e ID crescentes.
- Janela fixa de 30 dias explicitamente rotulada, sem selector de período nesta fatia. Foto/banner próprios e reordenação continuam no F10.
- As novas prévias e o detalhe no client só exibem imagens CAA/Archive.org ligadas a MBID; imagens Spotify/sem proveniência confirmada usam fallback. Não é uma certificação do legado nem permissão para reutilizar conteúdo Spotify em recomendações.

### Verificação opcional em MySQL isolado

Os testes regulares cobrem contrato HTTP, autorização, parâmetros SQL, transações e rollback com mocks. `lists-discovery.mysql.test.ts` fica **desativado por padrão** e exige um banco de teste **já provisionado e autorizado**, diferente do banco da aplicação, com nome `mycdrecords_list_tests_<sufixo>`. Ele não cria/remove bancos. Cria tabelas e substitui fixtures **somente nesse banco dedicado**; não apontar para dados reais.

```powershell
$env:LIST_DISCOVERY_MYSQL_TESTS = "true"
$env:LIST_DISCOVERY_MYSQL_DATABASE = "mycdrecords_list_tests_local"
npm test -- --runInBand src/tests/integration/lists-discovery.mysql.test.ts
Remove-Item Env:\LIST_DISCOVERY_MYSQL_TESTS
Remove-Item Env:\LIST_DISCOVERY_MYSQL_DATABASE
```

O cenário MySQL F9 cobre follow unilateral/mútuo, amostra exata, timestamps idempotentes, privacidade e 1000 itens. A execução exige autorização do operador; testes com mocks não substituem essa evidência.

## Identidade e ordem das listas (F10)

Decisões confirmadas: foto e capa próprias guardadas no **MySQL**, e numeração como **posição livre da curadoria**, não classificação. Não há drag-and-drop nem ordenação automática.

### Migração, imagens e autorização

- Inicialização aditiva/repetível `003-list-identity.ts`, após listas/itens/salvos: `lists.order_revision`, `lists.image_revision` e `list_images`. Não reescreve ordens existentes, importa imagens antigas nem semeia conteúdo. Executar a inicialização/migração de forma serial no deploy, como as demais migrações locais.
- `list_images` usa `(list_id, kind)` como chave, `MEDIUMBLOB` e FK cascade; bytes ficam no banco, não em `/uploads`, base64 de JSON, URL pública ou serviço externo. Backups e restauração do MySQL precisam incluir essa tabela. São até duas imagens, cada uma limitada a 2 MiB após processamento; monitorar crescimento do banco/backups antes de escala. Não foi provisionado storage externo.
- `PUT /api/lists/{id}/images/{kind}` recebe corpo binário JPEG/PNG/WebP; `kind=thumbnail|banner`. Apenas o dono altera ou remove. A assinatura é conferida e o **sharp** decodifica de verdade: 64–8000 pixels por lado, até 16 megapixels, imagem estática; arquivo truncado/danificado é rejeitado. Regrava JPEG sem metadados/EXIF, recortado no centro para 512×512 ou 1600×480. Dependência nova justificada pela validação de dimensões/decodificação e descarte de metadados, não pela confiança em MIME/nome.
- Limite de entrada da API **2 MiB**. O client reaproveita `prepareImage`/`ImageUpload` para aceitar origem de até 20 MB e enviar uma versão reprocessada; servidor repete a validação independentemente do client. Imagens devem ser próprias ou licenciadas para publicação; não subir/reutilizar conteúdo Spotify.
- `GET` na mesma rota entrega somente JPEG autorizado. Lista pública aceita anônimo; privada apenas o dono. A condição de visibilidade protege os bytes no SQL e é repetida a cada requisição; `no-store`/`nosniff`, sem tokens na URL. O client usa o `request` autenticado, cria URL de objeto apenas em memória e a revoga ao substituir/desmontar.
- `DELETE` na mesma rota remove a imagem (idempotente se já ausente). Upload/substituição/remoção e avanço de `image_revision` ficam numa transação com bloqueio do pai. Tornar privada muda imediatamente a autorização dos próximos downloads; excluir lista remove os bytes via FK. Como qualquer conteúdo já visto, não é possível apagar cópias que terceiros tenham baixado antes da mudança de visibilidade.
- Todos os metadados de lista incluem `has_thumbnail`, `has_banner` (0/1), `image_revision` e `order_revision`. Não incluem blobs nem caminhos de arquivo. Client normaliza os indicadores e usa fallback de capas permitidas/estado vazio na ausência de foto própria. Capa/banner é opcional e não substitui descrição, autoria ou título.
- Erros: 400 parâmetros; 401 login; 403 dono/visibilidade; 404 lista/imagem ausente; 413 vazio ou acima de 2 MiB; 415 assinatura/formato/corpo incompatível; 422 dimensões/animação/decodificação inválida. Falha de banco não vira sucesso ou imagem vazia.

### Ordem livre, revisão e páginas

`PUT /api/lists/{id}/order`:

```json
{ "revision": 3, "itemId": 42, "toPosition": 1000 }
```

- `itemId` é o ID numérico do item da lista, não o ID externo do álbum. `toPosition` é global e começa em **1**; deve estar entre 1 e a contagem atual. Resposta `{ revision, page }`, página com 24 itens.
- Comparar `revision` com `order_revision` sob `FOR UPDATE` da lista. Ordem desatualizada retorna **409** antes de alterar itens. O client preserva a ordem exibida, desabilita novas tentativas com revisão antiga e oferece atualizar; não sobrescreve silenciosamente.
- A transação lê somente IDs ordenados no servidor (não envia a lista inteira ao navegador), move um ID, normaliza `position` em base zero e grava as posições com um único `UPDATE CASE`, junto do avanço da revisão. Empates legados são resolvidos pela mesma ordem estável de criação/ID. Não duplica/remove álbuns; mover para a posição atual é no-op.
- Adicionar/remover itens também bloqueia o pai e incrementa a revisão somente em alterações reais. Inclusão sem `position` agora **acrescenta ao fim**, em vez do antigo default 0. `position` explícito em base zero continua aceito por compatibilidade; o client usa o endpoint de movimento para organizar.
- UI com modo compacto “Organizar álbuns”, acima/abaixo e posição global, alvos 44px, anúncio de sucesso, foco restaurado no item e navegação para a página de destino. Persistência pessimista: só anuncia sucesso após a API; falha não altera a ordem local. Sem promessa de movimentação otimista ou suporte a arrastar.

### Testes MySQL F10 sem outro banco

`lists-identity.mysql.test.ts` usa **somente tabelas TEMPORARY** de uma conexão exclusiva e as destrói ao fechar essa conexão. Não cria/remove banco, não altera registros/tabelas persistentes, não semeia listas na aplicação e não depende da homologação F9 acima. Exige conexão MySQL e permissão `CREATE TEMPORARY TABLES`; não trocar por tabelas persistentes para contornar falta de permissão.

```powershell
$env:LIST_IDENTITY_MYSQL_TESTS = "true"
npm test -- --runInBand src/tests/integration/lists-identity.mysql.test.ts
Remove-Item Env:\LIST_IDENTITY_MYSQL_TESTS
```

Cobre 1000 itens e unicidade, revisão obsoleta sem sobrescrita, append/remoção e upload HTTP real → sharp → MySQL → nova leitura binária autorizada, inclusive bloqueio anônimo/terceiros e substituição/remoção. Não substitui teste de concorrência em duas conexões nem um ensaio de restauração de backup/produção.

## Project Structure

```
src/
  app.ts             # Express app setup, middleware, route mounting, DB init
  server.ts          # HTTP server bootstrap
  docs/              # Swagger configuration
  middlewares/       # Auth and error-handling middleware
  modules/           # Feature modules (auth, user, profile, albuns)
  mysql2/            # Database connection and table creation
  tests/             # Unit and integration tests
  utils/             # Logger, cache, rate limiter, Redis client, helpers
```

## License

This project is licensed under the [MIT License](LICENSE).

## Author

Henrique Montrezor
