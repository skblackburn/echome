# Echo Me — Family Legacy
## Complete Project Handoff Document
*Last updated: June 9, 2026*

---

## Product Overview

**Echo Me — Family Legacy** is a platform for preserving the voices, stories, and presence of people you love. The Folder is the core product — letters, stories, voice notes, photos, and milestone messages. An optional AI Echo can be added to allow family members to have conversations with a preserved persona. AI is off by default and clearly labeled as optional.

**Three product lines:**
1. **echome.family** — consumer app, private family legacy preservation
2. **EchoMe Voices** — public figures and wisdom-keepers (future)
3. **EchoMe Enterprise** — institutional knowledge and phone systems for companies (in planning)

**Emotional origin:** A friend's wife is terminally ill with a 12-year-old daughter. The living intake experience — capturing someone while they're still alive — is the key differentiator.

**Domain:** echome.family (registered at Porkbun, ~$5.60/yr promo, renews annually)
**GitHub:** https://github.com/skblackburn/echome
**Railway URL:** https://echome-production-a33e.up.railway.app
**Custom domain:** https://app.echome.family (live and working as of June 9, 2026)
**Perplexity preview:** https://www.perplexity.ai/computer/a/echome-t5Uj7WvbRLGUxyuaZl0ppA

---

## Current App State (June 2026)

The app is the **full May 2026 version** — 47 pages, Folder-first design, AI optional. This is the correct and most complete version.

**Key features built:**
- Landing page with Pricing, FAQ, Sign in, Start your Folder nav
- Full authentication (email/password, sessions, 30-day login)
- The Folder — letters, stories, voice notes, photos
- Future letters — write now, deliver on a future date or milestone
- AI Echo (optional, off by default) — GPT-4o persona with rich intake
- Guided Interview (15 questions, 5 categories)
- Life Story (sensory world, family, life chapters, legacy)
- Voice synthesis via ElevenLabs
- Document upload (PDF, DOCX, TXT) with text extraction
- Family sharing with access codes
- Contributor system with attribution and per-viewer filters
- Milestone messages (AI-generated or pre-written)
- Conversation journal with search
- Echo Richness score
- Edit persona profile (pronouns, remembrance date, death year)
- Pricing page (Personal $9/mo, Family $15/mo, Legacy $22/mo)
- FAQ page
- Privacy page
- Settings and account management
- Onboarding flow
- Photo memories
- Journal with editor
- Cloudflare R2 storage integration (configured but needs R2 credentials)
- Letter delivery worker (runs every 5 minutes, handles scheduled delivery)

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
| File uploads | multer → local disk (ephemeral on Railway — needs R2) |
| Document parsing | pdf-parse + mammoth |
| Email | Configured (letter delivery worker) |
| Storage | Cloudflare R2 (configured, needs credentials) |
| Hosting | Railway (backend) |

---

## Credentials & Environment Variables

All credentials are stored in Railway environment variables. Retrieve from Railway dashboard if needed.

```env
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-us-west-2.pooler.supabase.com:5432/postgres
OPENAI_API_KEY=sk-proj-...        # OpenAI key named "EchoMe"
ELEVENLABS_API_KEY=sk_...         # ElevenLabs Starter plan
SESSION_SECRET=echome-family-legacy-secret-2026
NODE_ENV=production
PORT=3000
# R2 storage (not yet configured in Railway):
# R2_ACCOUNT_ID=
# R2_ACCESS_KEY_ID=
# R2_SECRET_ACCESS_KEY=
# R2_BUCKET_NAME=
```

---

## Supabase

- **Project:** echome
- **Host:** aws-1-us-west-2.pooler.supabase.com
- **Project ref:** hmyolzstoswtbftozxna
- **Plan:** Pro ($25/month — approved by employer)
- **Tables:** Auto-created on first server startup via `initDb()` + 13 migration files
- **Data:** Persistent — all user data survives session and server restarts

---

## Railway Deployment

- **Project:** echome (project name: pacific-respect)
- **Service URL:** echome-production-a33e.up.railway.app
- **Custom domain:** app.echome.family (verified, DNS configured in Porkbun)
- **Auto-deploy:** Yes — pushes to GitHub main branch trigger automatic redeployment
- **Port:** 3000 (set via PORT environment variable)
- **Build:** nixpacks.toml — `npm install && npm run build`, start: `node dist/index.cjs`
- **Status:** Live and working as of June 9, 2026

**Note:** File uploads go to local disk on Railway which is ephemeral (lost on redeploy). R2 credentials need to be added to Railway env vars to make uploads persistent. The R2 integration code is already written — just needs credentials.

---

## DNS Configuration (Porkbun)

| Type | Host | Value |
|---|---|---|
| ALIAS | app.echome.family | tdhdxig1.up.railway.app |
| TXT | _railway-verify.app.echome.family | railway-verify=[hash] |
| MX | echome.family | fwd1.porkbun.com (prio 10) |
| MX | echome.family | fwd2.porkbun.com (prio 20) |
| TXT | echome.family | v=spf1 include:_spf.porkbun.com ~all |

**Note:** Root domain echome.family does not yet redirect to app.echome.family. To fix: add a redirect in Porkbun or a CNAME for the root domain pointing at Railway.

---

## Project Structure (Key Files)

```
echome/
├── client/src/
│   ├── App.tsx                    — Router, AuthProvider, all routes
│   ├── lib/auth.tsx               — AuthContext, useAuth hook
│   ├── lib/queryClient.ts         — TanStack Query + API_BASE proxy
│   ├── components/
│   │   ├── Layout.tsx             — Shared header, dark mode, user menu
│   │   ├── EchoMeLogo.tsx         — Concentric circles SVG logo
│   │   ├── HeirSettings.tsx       — Echo heir/transfer management
│   │   └── TransferSettings.tsx   — Echo transfer to echome.family
│   └── pages/ (47 pages — see full list in git)
├── server/
│   ├── index.ts                   — Express setup, calls initDb()
│   ├── routes.ts                  — All API routes + auth + OpenAI + ElevenLabs
│   ├── storage.ts                 — PgStorage class, all async CRUD
│   ├── email.ts                   — Email sending (letter delivery)
│   ├── letter-worker.ts           — Scheduled letter delivery worker
│   └── uploads/                   — Local file uploads (ephemeral)
├── shared/schema.ts               — Drizzle PostgreSQL schema
├── migrations/                    — 13 SQL migration files
├── nixpacks.toml                  — Railway build config
├── HANDOFF.md                     — This file
├── ENTERPRISE_VISION.md           — Enterprise product vision and build plan
└── dist/                          — Built output (committed for Railway)
```

---

## Guardrails & Product Philosophy

A comprehensive guardrails document was provided in May 2026. Key principles:

- **Folder first, AI optional and off by default**
- Echo is an approximation, not the person — never imply resurrection or immortality
- No therapy, no legal/medical claims
- Consent required — don't encourage creating Echoes of living people without their knowledge
- Gentle dependency guardrails — don't encourage all-day chatting
- No dark patterns, no guilt-based upsells
- User data never used to train models or for advertising
- Support Echo "retirement" (pause without deleting) as well as deletion
- Cultural sensitivity — Echo Me won't be right for everyone

**Mapped implementation plan exists** — onboarding disclaimer, consent checkpoint in create flow, language audit, chat reminder, gentle check-in after 15+ messages, "Retire this Echo" option.

---

## Product Vocabulary

| Term | Meaning |
|---|---|
| **Echo** | The AI persona built from a person's content |
| **Lumen** | The real person the Echo is built from (proposed — not yet implemented) |
| **Folder** | The collection of letters, stories, photos, voice notes |
| **EchoMe Voices** | Public figures sharing their wisdom (future product) |
| **EchoMe Enterprise** | Institutional knowledge / phone systems (in planning) |

**Note:** "Lumen" is proposed as the term for the real person behind an Echo. Chris (fiancé) is reviewing. Once approved, implement throughout the app and AI system prompt.

---

## Pricing (Consumer)

| Plan | Monthly | Annual | Echoes | Messages |
|---|---|---|---|---|
| Free | $0 | — | 1 | 20 total |
| Personal | $9/mo | $89/yr | 1 | Unlimited |
| Family | $15/mo | $149/yr | 5 | Unlimited |
| Legacy | $22/mo | $219/yr | 10 | Unlimited |

Annual = "Save 2 months." Lifetime plan deferred until 6 months of user data.

---

## EchoMe Enterprise (In Planning — See ENTERPRISE_VISION.md)

Key concept: Companies deploy AI phone assistants built from real employees' voices and knowledge. Transparently labeled. The Echo announces itself as an AI from the first word.

**Pilot target:** Chris's survey callback problem — SVP getting flooded with survey respondent callbacks, Echo answers in his voice.

**OEM pipeline:** Mercedes (R&D head + leadership team — warmest relationship), BMW, Honda, JLR, Volvo. All existing clients of the company. Approach one at a time after pilot demo is ready.

**Phone stack:** Twilio + OpenAI Realtime API + ElevenLabs
**Build estimate:** 3-4 months for full product, 3-5 weeks for working pilot demo

**Pricing:** $1,500/month base + $0.15/minute usage
**Your cost:** $0.10/minute
**Margin:** ~50% on usage + healthy base fee margin

**Knowledge Continuity Package:** Premium add-on when employees leave — structured export of institutional knowledge ($1,500-5,000 one-time). Voice clone stays inside Echo Me (never exported).

**Echo portability:** Employees can transfer their Echo to echome.family when they leave — automatic consumer acquisition at zero cost.

---

## Next Steps (Priority Order)

### Immediate
1. **Add R2 credentials to Railway** — makes file uploads persistent (photos, voice recordings don't disappear on redeploy)
2. **Root domain redirect** — make echome.family redirect to app.echome.family

### Short term
3. **Implement Lumen terminology** once Chris approves — update system prompt and key copy
4. **Implement guardrails** — onboarding disclaimer, consent checkpoint, chat reminder, retire option
5. **Stripe payment integration** — enforce free tier limits, upgrade flow

### Enterprise (when credits allow)
6. **Twilio phone integration** — Phase 1 of enterprise build
7. **Run pilot with Chris** — survey callback use case
8. **Prepare enterprise one-pager** — for Mercedes and other OEM conversations

---

## Key People & Context

- **Creator:** Shaunak Blackburn — data analyst/product developer, San Diego CA → moving to Washington state
- **Fiancé:** Chris — SVP at research company, former police officer, author of unpublished true crime book, connected to Will Smith, deep wisdom and rich life experience. First Lumen candidate for EchoMe Voices. First enterprise pilot candidate.
- **Friend:** Terminally ill wife with 12-year-old daughter — the origin story and most urgent use case
- **OEM contacts:** Mercedes (R&D head + leadership), BMW, Honda, JLR, Volvo — all existing clients

---

## Known Issues / Pending

- File uploads ephemeral on Railway (R2 credentials needed)
- Root domain echome.family doesn't redirect to app.echome.family
- Lumen terminology not yet implemented in app
- Guardrails mapped but not yet built
- Stripe not yet integrated (pricing page exists, no payment processing)
- R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME needed in Railway env vars

---

*GitHub repository skblackburn/echome is the source of truth. All credentials in Railway environment variables. Data in Supabase project hmyolzstoswtbftozxna.*
