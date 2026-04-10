# Echo Me — Family Legacy
## Complete Project Handoff Document
*Last updated: April 10, 2026*

---

## Product Overview

**Echo Me — Family Legacy** is an AI-powered legacy preservation app that creates an interactive digital persona of a loved one. Users build an "Echo" by capturing stories, memories, personality traits, voice recordings, and documents. The AI (GPT-4o) uses all of this to respond as that person in conversation — preserving their voice, wisdom, and presence for family members.

**Emotional origin:** A friend's wife is terminally ill with a 12-year-old daughter. The living intake experience is the key differentiator — capturing someone while they're still alive, not just after they're gone.

**Domain:** echome.family  
**GitHub:** https://github.com/skblackburn/echome  
**Railway URL:** https://echome-production-a33e.up.railway.app  
**Perplexity preview:** https://www.perplexity.ai/computer/a/echome-t5Uj7WvbRLGUxyuaZl0ppA

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS + shadcn/ui + wouter (hash routing) |
| Backend | Express.js (Node.js) |
| Database | PostgreSQL via Supabase + Drizzle ORM |
| AI | OpenAI GPT-4o (persona chat) |
| Voice | ElevenLabs API (voice synthesis + instant cloning) |
| Auth | Passport.js + express-session + bcryptjs |
| File uploads | multer → server/uploads/ |
| Document parsing | pdf-parse + mammoth (PDF + DOCX) |
| Hosting | Railway (backend) + Perplexity Computer (static frontend) |

---

## Environment Variables

```env
# Database (Supabase pooler connection)
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-us-west-2.pooler.supabase.com:5432/postgres

# AI
OPENAI_API_KEY=sk-proj-...  # OpenAI key named "EchoMe"

# Voice
ELEVENLABS_API_KEY=sk_...   # ElevenLabs Starter plan key
ELEVENLABS_VOICE_ID=        # optional — leave blank for default Adam voice

# Session
SESSION_SECRET=echome-family-legacy-secret-2026

# Environment
NODE_ENV=production
PORT=3000
```

> **Note:** Actual credentials are stored in Railway environment variables and in the Supabase project. Do not commit real credentials to GitHub.

---

## Supabase

- **Project:** echome
- **Host:** aws-1-us-west-2.pooler.supabase.com
- **Project ref:** hmyolzstoswtbftozxna
- **Password:** stored in Railway env vars only — retrieve from Supabase dashboard if needed
- **Plan:** Pro ($25/month)
- Tables are created automatically on first server startup via `initDb()` in `server/storage.ts`

---

## Railway Deployment

- **Project:** echome
- **Service URL:** echome-production-a33e.up.railway.app
- **Build config:** nixpacks.toml (build: `npm install && npm run build`, start: `node dist/index.cjs`)
- **Auto-deploy:** Yes — pushes to GitHub main branch trigger automatic redeployment
- **Port:** 3000 (set via PORT environment variable)
- **Status as of April 10:** Deployment issue being resolved — app builds successfully but port routing needed investigation

---

## Domain

- **Domain:** echome.family
- **Registrar:** Porkbun (~$5.60/year promo, ~$18/year renewal)
- **DNS:** Not yet pointed at Railway — next step
- **To connect:** In Porkbun DNS settings, add a CNAME record pointing echome.family to the Railway domain

---

## Project Structure

```
echome/
├── client/
│   └── src/
│       ├── App.tsx                    — Router + AuthProvider wrapper
│       ├── lib/
│       │   ├── auth.tsx               — AuthContext, useAuth hook
│       │   └── queryClient.ts         — TanStack Query + API_BASE proxy
│       ├── components/
│       │   ├── Layout.tsx             — Shared header with back nav, dark mode, user menu
│       │   └── EchoMeLogo.tsx         — Concentric circles SVG logo
│       └── pages/
│           ├── Home.tsx               — Dashboard with Echo cards
│           ├── Login.tsx              — Email/password login
│           ├── Register.tsx           — Account creation
│           ├── CreatePersona.tsx      — 3-4 step guided Echo creation
│           ├── PersonaDashboard.tsx   — Echo detail, stats, feature cards, Echo Richness score
│           ├── EditPersona.tsx        — Edit profile, pronouns, remembrance date, delete
│           ├── MemoryIntake.tsx       — 4-tab workspace (Personality/Memories/Voice/Documents)
│           ├── Interview.tsx          — 15-question guided interview, 5 categories
│           ├── LifeStory.tsx          — Family, sensory world, how they loved, life chapters, legacy
│           ├── Chat.tsx               — AI conversation with voice playback + smart starters
│           ├── Milestones.tsx         — Future milestone messages (AI-generated or pre-written)
│           ├── FamilySharing.tsx      — Generate access codes for family members
│           ├── JoinEcho.tsx           — Enter access code to join an Echo
│           ├── Contribute.tsx         — Family members add memories with attribution
│           ├── ContributorSettings.tsx — Per-viewer content filters (by contributor + individual)
│           ├── Journal.tsx            — Conversation archive with search
│           └── not-found.tsx
├── server/
│   ├── index.ts                       — Express app setup, calls initDb() then registerRoutes()
│   ├── routes.ts                      — All API routes + passport auth + OpenAI + ElevenLabs
│   ├── storage.ts                     — PgStorage class, all async CRUD operations
│   ├── static.ts                      — Serves built frontend
│   ├── vite.ts                        — Dev server integration
│   └── uploads/                       — Local file uploads (photos, audio)
├── shared/
│   └── schema.ts                      — Drizzle PostgreSQL schema (all tables + types)
├── nixpacks.toml                      — Railway build config
├── drizzle.config.ts                  — Drizzle kit config (PostgreSQL)
├── .env.example                       — Template for all environment variables
└── HANDOFF.md                         — This file
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `users` | Accounts — email, passwordHash, name |
| `personas` | Echoes — userId, name, relationship, pronouns, bio, spouse, children, deathYear, remembranceDate |
| `traits` | Personality traits — personaId, category, content |
| `memories` | Stories, letters, journal entries, documents — with contributedBy/contributorCode for attribution |
| `media` | Voice recordings and photos |
| `life_story` | Sensory world, how they loved, life chapters, hopes & legacy |
| `milestone_messages` | Future messages — recipientName, occasion, deliveryDate, messageType (ai/prewritten) |
| `family_members` | Access codes + filter settings for each family member |
| `chat_messages` | Full conversation history per persona |

---

## All API Routes

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/personas                    — returns user's own personas if authenticated
POST   /api/personas                    — create (attaches userId if authenticated)
GET    /api/personas/:id
PATCH  /api/personas/:id
DELETE /api/personas/:id
GET    /api/personas/:id/summary

GET    /api/personas/:id/traits
POST   /api/personas/:id/traits
PUT    /api/personas/:id/traits         — bulk replace
DELETE /api/traits/:id

GET    /api/personas/:id/memories
POST   /api/personas/:id/memories
PATCH  /api/memories/:id
DELETE /api/memories/:id

GET    /api/personas/:id/media
POST   /api/personas/:id/media          — file upload
DELETE /api/media/:id

POST   /api/personas/:id/documents      — PDF/DOCX/TXT upload, text extraction

GET    /api/personas/:id/chat
POST   /api/personas/:id/chat           — accepts viewerCode for filtered responses
DELETE /api/personas/:id/chat

GET    /api/personas/:id/life-story
PUT    /api/personas/:id/life-story

GET    /api/personas/:id/milestones
POST   /api/personas/:id/milestones
DELETE /api/milestones/:id
POST   /api/milestones/:id/deliver      — generate or return AI message
GET    /api/milestones/due

GET    /api/personas/:id/family
POST   /api/personas/:id/family         — generates 6-char access code
DELETE /api/family/:id
GET    /api/family/join/:code
PUT    /api/family/settings/:code       — save filter settings
POST   /api/family/:code/memories       — contributor adds memory
GET    /api/family/:code/contributions  — get all memories contributed by this code
GET    /api/personas/:id/contributors   — list all contributors + counts

POST   /api/speak                       — ElevenLabs TTS, returns base64 audio
GET    /api/voices                      — list ElevenLabs voices
```

---

## Key Features Built

### Authentication
- Email + password registration and login
- Session-based auth (passport-local + express-session, 30-day sessions)
- Passwords hashed with bcryptjs (12 rounds)
- Protected routes redirect to /login
- User menu with name + logout in every page header

### Echo Creation (3-4 step flow)
- Step 1: For someone I love vs For myself
- Step 2: Name, pronouns (she/her · he/him · they/them), birth year, birthplace, relationship, bio, photo
- Step 3: About the creator (name, relationship, why building this Echo) OR Review screen for self
- Step 4 (conditional): If creator has contributed memories to another Echo via access code, offered to import them

### Memory Intake (4 tabs)
- **Personality** — traits with rich example prompts, category-specific placeholders
- **Memories** — perspective picker (their own words vs my memory of them), period of *their* life label
- **Voice** — up to 5 recordings, guidance on quality, audio playback
- **Documents** — PDF/DOCX/TXT upload, text extracted and stored as memory

### Guided Interview
- 15 questions across 5 categories: Childhood, Values, Relationships, Personality, Legacy
- Progress tracking, dot navigation, category jump links

### Life Story
- 5 sections: Family (spouse + children list), Sensory World, How They Loved, Life Chapters, Hopes & Legacy
- All fields feed directly into AI system prompt
- Spouse field handles complex relationships (narrative format)

### AI Chat (GPT-4o)
- Rich system prompt: bio, pronouns, family, traits, life story, memories, documents
- Documents get 3,000 chars each (vs 800 for regular memories)
- Third-person memories labeled as "[memory about you]" so AI uses them as context not first-person
- Contributor memories tagged with contributor name
- Smart conversation starters based on actual Echo content
- "Suggest" button shows starters at any point in conversation
- Voice playback via ElevenLabs (base64 audio, works through iframe proxy)
- viewerCode param filters memories per family member's settings

### Milestone Messages
- Pre-written (exact words delivered verbatim) or AI-generated (Echo writes it on the day)
- Delivery date, recipient name, occasion
- Due milestones show as banner on persona dashboard
- Delivered messages cached after first generation

### Family Sharing + Contributor System
- Generate unique 6-char access codes per family member
- Family members join via "Join with access code" on home screen
- Each family member gets private conversation thread
- Contributors can add memories tagged with their name + access code
- **Two-level filter system:** contributor toggle (show/hide all by person) + individual memory override
- AI only sees memories enabled by that viewer's filter settings
- When a contributor creates their own Echo, offered to import their contributed memories

### Echo Richness Score
- Calculated from: bio, pronouns, birth year, spouse, traits count, memories count, documents, voice recordings
- Shown as percentage bar with label (Just getting started / Good foundation / Rich & detailed)

### Conversation Journal
- Full transcript archive grouped by date
- Search bar filters conversations by keyword
- Expandable date groups showing full message bubbles

### Anniversary Reminders
- Set remembrance date in Edit Profile
- Gentle banner appears on that date when opening persona dashboard

### Edit Profile
- Full edit of all persona fields including remembrance date, death year
- Danger zone with permanent delete

---

## Design System

- **Palette:** Warm candlelight — cream surfaces (`38 30% 96%`), dusty rose/mauve primary (`340 28% 42%`)
- **Display font:** Zodiak (Fontshare)
- **Body font:** General Sans (Fontshare)
- **Custom utilities:** `.echo-glow`, `.echo-glow-hover`, `.paper-surface`, `.breathing`, `.message-in`
- **Dark mode:** Fully implemented, toggles via header button
- **Hash routing:** All routes use `/#/path` format (iframe sandbox compatibility)
- **No localStorage/cookies:** All state in React or PostgreSQL — sandbox safe

---

## Commands

```bash
# Development
cd /home/user/workspace/echome
DATABASE_URL="..." OPENAI_API_KEY="..." ELEVENLABS_API_KEY="..." npm run dev

# Production build
npm run build

# Start production server
DATABASE_URL="..." OPENAI_API_KEY="..." ELEVENLABS_API_KEY="..." SESSION_SECRET="..." NODE_ENV=production node dist/index.cjs

# Push to GitHub
git add -A && git commit -m "message" && git push origin main
```

---

## Pending / Next Steps

### Immediate
- [ ] Resolve Railway port issue (app builds but returns 502 — PORT=3000 set, investigating)
- [ ] Point echome.family DNS at Railway (Porkbun CNAME record)
- [ ] Test full flow on live Railway URL

### Short term
- [ ] Stripe payment integration (Personal $9/mo, Family $15/mo, Legacy $22/mo — annual versions save 2 months)
- [ ] Free tier enforcement (1 Echo, 20 messages total)
- [ ] Edit memories (inline edit on memory cards)
- [ ] PIN protection per Echo

### Product roadmap
- [ ] EchoMe Voices — verified public figures, curated gallery, free public access
- [ ] Mobile app (React Native)
- [ ] RAG for long documents (chunk + retrieve most relevant sections)
- [ ] Voice cloning flow (upload recording → ElevenLabs → set voice_id on persona)
- [ ] Echo completeness suggestions (specific missing items shown to user)
- [ ] Mobile-responsive polish pass

---

## Pricing (Finalized)

| Plan | Monthly | Annual | Echoes | Messages |
|---|---|---|---|---|
| Free | $0 | — | 1 | 20 total |
| Personal | $9/mo | $89/yr | 1 | Unlimited |
| Family | $15/mo | $149/yr | 5 | Unlimited |
| Legacy | $22/mo | $219/yr | 10 | Unlimited |

Annual shown as "Save 2 months." Lifetime plan to be evaluated after 6 months of user data.

---

## Brand

- **App name:** Echo Me — Family Legacy
- **Domain:** echome.family
- **Tagline options:** "Some voices are too important to lose." / "Preserve the people you love."
- **App Store name:** Echo Me (two words — "EchoMe" as one word is taken)
- **Logo:** Concentric circles SVG (EchoMeLogo component)

---

## EchoMe Voices (Future Product Line)

Public-facing gallery of verified public figures who have completed their own Echo. Key principles:
- **Invite-only, white-glove** — not self-serve. Every public Echo is a partnership.
- **Identity verification required** — signed consent agreement, confirmed identity before publishing
- **Values-based curation** — for people whose primary legacy is wisdom, service, healing, creativity, or knowledge. Not fame or power.
- **No voice cloning** for public figures — legal risk. Text only, or self-recorded voice.
- **Tagline:** "Some voices are too important to lose."

First Echo candidate: Creator's boyfriend — former police officer, author of unpublished true crime book about murder of two children, connected to Will Smith who offered to buy the story rights. Man of deep wisdom and vision.

Second Echo candidate: Will Smith — existing relationship through the book story, public redemption journey, deeply searched figure.

---

## Key People & Context

- **Creator:** Shaunak Blackburn — data analyst/product developer, San Diego CA, email: shaunakblackburn@gmail.com
- **Motivation:** Friend's wife is terminally ill with a 12-year-old daughter. Built to capture her voice before it's too late.
- **Boyfriend:** Former police officer, true crime author, man of deep wisdom. First candidate for EchoMe Voices.
- **Test persona:** Norah Kealoha (Taenorahle) — full life story built as test case. Content saved in Word documents.

---

## Known Issues / Quirks

- `better-sqlite3` was replaced with `postgres` — all storage methods are now async (await required everywhere)
- Railway deployment: nixpacks.toml added, PORT=3000 set, still investigating 502 on custom domain
- Session memory store (MemoryStore) is used — for production scale, consider Redis
- File uploads go to `server/uploads/` — not persisted on Railway (ephemeral filesystem). Should migrate to Supabase Storage for production
- The `unfinshedBusiness` field in life_story has a typo (missing 'i') — harmless but worth fixing eventually

---

*This document was generated April 10, 2026. The GitHub repository at skblackburn/echome is the source of truth for all code.*
