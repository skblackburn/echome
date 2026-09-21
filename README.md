# EchoMe — family legacy preservation

EchoMe helps families capture and keep the memories, stories, voices, and documents of the people who matter to them. Live at [app.echome.family](https://app.echome.family).

## What it does

- **Folder-first structure** — every person gets a Folder, and every upload path flows through it. Category tabs act as filters, not separate silos.
- **Memories, documents, and letters** — photos, audio, text memories, typed documents, and future letters that can be scheduled for later delivery.
- **Guided onboarding** — new accounts are walked through creating a Folder and their first two memories before any AI feature is mentioned.
- **Echo, opt-in only** — an optional AI reflection of a person, built through an eight-step intake (about them, personality and values, life story, guided interview, memories, voice, writing, preview). Users see an ethics and limitations explainer before they can start, and can retire an Echo later.
- **Transcription** — Whisper transcribes uploaded audio so spoken memories become searchable text.

## Architecture

| Layer | Stack |
| --- | --- |
| Frontend | React + Vite, TypeScript, Tailwind, Radix UI |
| Backend | Express, TypeScript, Passport auth |
| Data | Supabase/PostgreSQL via Drizzle ORM |
| Sessions | Postgres-backed store (`connect-pg-simple`) |
| Storage | Cloudflare R2, Sharp image processing |
| AI | OpenAI, Whisper transcription |
| Hosting | Railway |

## Engineering decisions worth calling out

- **Sessions in Postgres, not memory.** In-memory sessions meant every deploy logged users out, and registration could inherit stale session state. Sessions moved to a `user_sessions` table, and registration explicitly destroys any existing session first.
- **Deletion cascades are explicit.** Deleting an Echo removes dependent future letters and resend rows before the persona itself, so deletion never leaves orphaned records.
- **Navigation before polish.** A test pass prioritized predictable movement over visual redesign: back buttons follow the Dashboard → Folder → memory tree, create and upload screens return to the Folder that launched them, and duplicate actions were removed.
- **Progressive disclosure.** AI features stay hidden until there is enough material for them to be meaningful and the user has explicitly asked for them.
- **Public and authenticated routes are cleanly split.** `/` is marketing; `/dashboard` is the app. Auth flows and in-app actions never bounce users back to the marketing page.

## Running locally

```bash
npm install
npm run db:push   # push the Drizzle schema
npm run dev       # dev server
```

Requires a PostgreSQL connection string, Cloudflare R2 credentials, and an OpenAI API key in the environment.

## Status

Active development, single maintainer, direct-to-main. Roadmap and handoff notes are in [ROADMAP.md](ROADMAP.md) and [HANDOFF.md](HANDOFF.md); the planned B2B direction is in [ENTERPRISE_OVERVIEW.md](ENTERPRISE_OVERVIEW.md).

## License

MIT
