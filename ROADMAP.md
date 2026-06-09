# Echo Me — Product Roadmap
*Last updated: June 9, 2026*
*Goal: Enterprise pilot running + paying clients within 6 months*

---

## How to read this

Three parallel tracks:
- **Track 1: Consumer App** — finish and polish echome.family
- **Track 2: Enterprise Build** — build the phone product
- **Track 3: Business Development** — people, conversations, relationships

Each task is marked with effort estimate and whether it needs credits (💻) or just your time (👤).

---

## MILESTONE 1 — Production Ready
*Goal: echome.family fully stable, safe to share with real users*
*Timeline: 1-2 sessions*

### Track 1: Consumer App
- [ ] 💻 Add R2 credentials to Railway — makes file uploads persistent (photos, voice recordings survive redeploys)
- [ ] 💻 Root domain redirect — echome.family → app.echome.family
- [ ] 💻 Implement onboarding disclaimer — one-time screen after registration explaining what Echo is and isn't
- [ ] 💻 Implement consent checkpoint in Create Echo flow — gentle pause for living vs. passed vs. memorial
- [ ] 💻 Add "Retire this Echo" option — pause AI without deleting memories
- [ ] 💻 Language audit — change "Speak with Norah" → "Visit Norah's Echo" etc. per guardrails
- [ ] 💻 Chat reminder — subtle note below chat input: "This Echo is a reflection, not them"
- [ ] 💻 Implement Lumen terminology (pending Chris's approval)

### Track 3: Business Development
- [ ] 👤 Share app.echome.family with Chris — get his full feedback
- [ ] 👤 Share with your friend — offer to help build Echo for his wife
- [ ] 👤 Get Cloudflare R2 account credentials (free tier covers early usage)

---

## MILESTONE 2 — First Real Users
*Goal: 5-10 beta users actively using echome.family*
*Timeline: 2-4 weeks after Milestone 1*

### Track 1: Consumer App
- [ ] 💻 Stripe integration — enforce free tier (20 message limit), upgrade flow
- [ ] 💻 Free tier message counter — track and display remaining messages
- [ ] 💻 Upgrade prompt — gentle, non-manipulative prompt when free tier runs out
- [ ] 💻 Password reset flow — users need to be able to reset forgotten passwords
- [ ] 💻 Email verification on signup
- [ ] 💻 Mobile responsive polish — test and fix on phone screen sizes

### Track 3: Business Development
- [ ] 👤 Ask Chris and friend to invite 2-3 people each
- [ ] 👤 Write the press pitch email (1 page — the origin story, the product, the ask)
- [ ] 👤 Identify 10-15 journalists who cover grief, AI, or family technology
- [ ] 👤 Send press pitches
- [ ] 👤 Post in 2-3 relevant Reddit communities (r/grief, r/Alzheimers, r/caregiver) — genuine, non-salesy

---

## MILESTONE 3 — Enterprise Pilot Ready
*Goal: Working phone demo to show Chris and OEM contacts*
*Timeline: 3-5 weeks of building*

### Track 2: Enterprise Build — Phase 1: Phone Integration
- [ ] 💻 Set up Twilio account — get a phone number ($1/month)
- [ ] 💻 Build call receiver — Twilio receives call, plays opening announcement
- [ ] 💻 Integrate OpenAI Realtime API — speech-to-speech conversation
- [ ] 💻 Wire ElevenLabs into phone call — responses in cloned voice
- [ ] 💻 Call recording with consent announcement — "this call may be recorded"
- [ ] 💻 Basic call transcript storage

### Track 2: Enterprise Build — Phase 2: Intelligence Layer
- [ ] 💻 Post-call summary generation — GPT-4o summarizes each call
- [ ] 💻 Email summary to real person after each call
- [ ] 💻 Escalation logic — "let me have [Name] call you back"
- [ ] 💻 Callback request logging and notification
- [ ] 💻 Knowledge gap detection — questions Echo couldn't answer confidently

### Track 3: Business Development
- [ ] 👤 Run internal pilot — forward Chris's Google Voice to Echo, test with real survey callbacks
- [ ] 👤 Document results — calls handled, time saved, quality of responses
- [ ] 👤 Write case study from pilot results (1 page, specific numbers)

---

## MILESTONE 4 — First Enterprise Client
*Goal: First paying enterprise contract signed*
*Timeline: 1-2 months after pilot*

### Track 2: Enterprise Build — Phase 3: Admin Dashboard
- [ ] 💻 Enterprise admin portal — separate from consumer app
- [ ] 💻 Call volume analytics and reporting
- [ ] 💻 Transcript search and filtering
- [ ] 💻 Echo management — create, update, retire
- [ ] 💻 Employee onboarding flow for enterprise
- [ ] 💻 Employee offboarding flow — Retire or Continue options
- [ ] 💻 Voice Continuation Agreement checkbox and confirmation
- [ ] 💻 Echo Transfer to echome.family button
- [ ] 💻 Knowledge Continuity Package export (transcripts, FAQ, style guide)

### Track 3: Business Development
- [ ] 👤 Approach Mercedes R&D contact — "I want to show you something"
- [ ] 👤 Present pilot case study + Enterprise Overview document
- [ ] 👤 Offer no-cost 60-day pilot to Mercedes
- [ ] 👤 Prepare pilot agreement (simple 1-page, no cost, feedback required)
- [ ] 👤 Sign first paying client (target: 3 months after pilot demo)

---

## MILESTONE 5 — Scale to 10 Clients
*Goal: $20,000-30,000/month recurring revenue*
*Timeline: 6-12 months after first client*

### Track 2: Enterprise Build — Phase 4: Multi-Echo & Routing
- [ ] 💻 Multiple Echo management per company
- [ ] 💻 Topic-based call routing
- [ ] 💻 Caller ID recognition and continuity routing
- [ ] 💻 Language detection and routing
- [ ] 💻 Role-based Echo (no personal voice — uses synthetic voice)
- [ ] 💻 Echo Pool management for large organizations

### Track 2: Enterprise Build — Phase 5: Behavioral Learning
- [ ] 💻 Real call transcript analysis pipeline
- [ ] 💻 Phrase and pattern extraction from calls
- [ ] 💻 Automatic system prompt enrichment from real calls
- [ ] 💻 ElevenLabs voice model improvement from call audio
- [ ] 💻 Echo improvement reporting dashboard

### Track 3: Business Development
- [ ] 👤 Approach BMW contact
- [ ] 👤 Approach Honda contact
- [ ] 👤 Approach JLR contact
- [ ] 👤 Approach Volvo contact
- [ ] 👤 Build your own Echo for onboarding support — handles client questions 24/7
- [ ] 👤 Hire part-time support person (when at 8-10 clients)
- [ ] 👤 Consider approaching market research firms, healthcare, legal verticals

---

## MILESTONE 6 — EchoMe Voices Launch
*Goal: First verified public Echo live*
*Timeline: After enterprise is stable, ~12-18 months*

### Track 2: Build
- [ ] 💻 Public Echo gallery page — browsable without account
- [ ] 💻 Verification and consent workflow for public figures
- [ ] 💻 Public Echo profile pages — shareable, linkable from LinkedIn etc.
- [ ] 💻 Privacy controls (what's public vs. private)
- [ ] 💻 "Ask me a professional question" interface

### Track 3: Business Development
- [ ] 👤 Have Chris complete his full Echo — first Voices candidate
- [ ] 👤 Help get Chris's book submitted to NY editor contact
- [ ] 👤 Explore Will Smith introduction through Chris
- [ ] 👤 Identify 2-3 other Voices candidates (spiritual leaders, educators, elders)
- [ ] 👤 Build verification and consent process

---

## Summary Timeline

| Milestone | What it means | Target |
|---|---|---|
| 1 — Production Ready | Safe to share with real people | 1-2 sessions |
| 2 — First Real Users | Beta users on echome.family | 2-4 weeks |
| 3 — Enterprise Pilot | Working phone demo | 5-8 weeks |
| 4 — First Client | Paying enterprise contract | 3-4 months |
| 5 — 10 Clients | ~$22,000/month net, retirement possible | 9-12 months |
| 6 — EchoMe Voices | Cultural preservation mission | 12-18 months |

---

## Next Session Priorities (in order)

1. R2 credentials in Railway (10 minutes — just needs credentials)
2. Root domain redirect (5 minutes)
3. Onboarding disclaimer (30 minutes)
4. Stripe integration (2-3 hours — biggest consumer task remaining)
5. Start Twilio phone integration (enterprise Phase 1)

---

## Revenue Targets

| Milestone | Monthly Net | Annual |
|---|---|---|
| 0 clients | $0 app + investment income | Surivival mode |
| 3 enterprise clients | ~$6,000/mo | ~$72,000 |
| 5 enterprise clients + consumer | ~$12,000/mo | ~$144,000 |
| 10 enterprise clients + consumer | ~$25,000/mo | ~$300,000 |
| 25 enterprise clients + consumer | ~$65,000/mo | ~$780,000 |

*Plus passive investment income from house sales (~$1,500-2,000/mo)*
*Plus caregiver income ($1,800/mo)*
*Plus Chris's income*

**At 10 enterprise clients you are financially independent.**

---

*This roadmap lives at skblackburn/echome/ROADMAP.md*
*Update it as tasks are completed and new ones emerge.*
*The goal is freedom — 10 clients, $22,000/month net, working 15 hours/week.*
