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
cp .env.example .env
# then edit .env and fill in your own values
```

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

The project uses Jest with ts-jest and Supertest (unit and integration tests under `src/tests/`).

```bash
npm test              # run the full test suite
npm run test:watch    # run tests in watch mode
npm run test:coverage # run tests with a coverage report
```

## API Overview

All routes are mounted under `/api`. Explore and try them via the Swagger UI at `/docs`.

| Base path | Description |
| --- | --- |
| `/api/auth` | Registration, login, tokens, verification, password reset |
| `/api/user` | User account management |
| `/api/profile` | User profiles |
| `/api/admin` | Admin/moderation actions |
| `/api/artistas` | Artist search (MusicBrainz) |
| `/api/albuns` | Album search (MusicBrainz) |
| `/api/musicas` | Track search (MusicBrainz) |
| `/api/spotify` | Spotify-enriched data |
| `/api/reviews` | Album reviews |
| `/api/social` | Follows and votes |
| `/api/lists` | Custom lists/collections |
| `/api/gamification` | Badges and achievements |
| `/api/recommendations` | Personalized recommendations |

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
