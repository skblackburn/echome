import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import archiver from "archiver";
import OpenAI from "openai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import bcrypt from "bcryptjs";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import MemoryStore from "memorystore";
import Stripe from "stripe";
import { storage, db } from "./storage";
import { sendWelcomeEmail } from "./email";
import {
  insertPersonaSchema,
  insertTraitSchema,
  insertMemorySchema,
  insertChatMessageSchema,
  familyMembers as familyMembersTable,
} from "@shared/schema";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { User } from "@shared/schema";

// ── Stripe Setup ──────────────────────────────────────────────────────────────
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const APP_URL = process.env.APP_URL || "https://echome-production-a33e.up.railway.app";

// Plan limits configuration
const PLAN_LIMITS: Record<string, { echoes: number; messages: number | null; milestones: number | null }> = {
  free: { echoes: 1, messages: 20, milestones: 1 },
  personal: { echoes: 1, messages: null, milestones: 5 },
  family: { echoes: 5, messages: null, milestones: 15 },
  legacy: { echoes: 10, messages: null, milestones: null },
};

// Map Stripe price IDs to plan info
const PRICE_TO_PLAN: Record<string, { plan: string; interval: string }> = {
  "price_1TMBkv8vT1Bw3iGUdGojRSkO": { plan: "personal", interval: "month" },
  "price_1TMBkw8vT1Bw3iGUqB6rTbmp": { plan: "personal", interval: "year" },
  "price_1TMBkw8vT1Bw3iGUmtP8rs4J": { plan: "family", interval: "month" },
  "price_1TMBkx8vT1Bw3iGUpWldtaK1": { plan: "family", interval: "year" },
  "price_1TMBkx8vT1Bw3iGUrocyUuqD": { plan: "legacy", interval: "month" },
  "price_1TMBky8vT1Bw3iGU4SvvuG58": { plan: "legacy", interval: "year" },
};

// Extend Express session
declare module "express-session" {
  interface SessionData { userId: number; }
}
declare global {
  namespace Express {
    interface User { id: number; email: string; name: string; }
  }
}

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "server/uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `${unique}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// OpenAI client (gracefully handle missing key)
let openai: OpenAI | null = null;
try {
  const openaiKey = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
  if (openaiKey) {
    openai = new OpenAI({ apiKey: openaiKey });
    console.log("OpenAI client ready");
  } else {
    console.warn("OPENAI_KEY not set — chat will use demo responses");
  }
} catch (_e) {
  console.warn("OpenAI init failed — chat will use demo responses");
}

// ── Analyze writing style from persona documents ─────────────────────────────
async function analyzeWritingStyle(personaId: number): Promise<void> {
  if (!openai) return;

  const memories = await storage.getMemories(personaId);
  // Only analyze voice documents (written BY the person) — character documents are about them
  const documents = memories.filter(m => m.type === "document" && (m.documentType || "voice") === "voice");
  if (documents.length === 0) return;

  // Concatenate document text up to ~8000 tokens (~32000 chars)
  let combinedText = "";
  for (const doc of documents) {
    if (combinedText.length >= 32000) break;
    combinedText += `--- ${doc.title || "Document"} ---\n${doc.content}\n\n`;
  }
  combinedText = combinedText.slice(0, 32000);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a writing style analyst. Analyze the provided text samples and extract a detailed writing style profile. Respond ONLY with valid JSON matching this exact structure (all values are strings):
{
  "sentenceStructure": "Description of typical sentence patterns, length, complexity",
  "vocabularyLevel": "Description of word choices, complexity, jargon usage",
  "punctuationHabits": "Notable punctuation patterns, em-dashes, ellipses, etc.",
  "toneAndEmotion": "Emotional tone, warmth, humor, seriousness",
  "commonPhrases": "Frequently used phrases, expressions, or verbal tics as a JSON array string",
  "formality": "Level of formality, conversational vs. formal",
  "narrativeStyle": "How they tell stories, use anecdotes, structure thoughts",
  "quirks": "Unique writing habits, capitalizations, signature expressions",
  "overallSummary": "2-3 sentence distillation of how this person writes"
}
Do not include any text outside the JSON object.`,
        },
        {
          role: "user",
          content: `Analyze the writing style of the following text samples:\n\n${combinedText}`,
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return;

    const profile = JSON.parse(raw);

    await storage.upsertWritingStyle(personaId, {
      personaId,
      sentenceStructure: profile.sentenceStructure || null,
      vocabularyLevel: profile.vocabularyLevel || null,
      punctuationHabits: profile.punctuationHabits || null,
      toneAndEmotion: profile.toneAndEmotion || null,
      commonPhrases: profile.commonPhrases || null,
      formality: profile.formality || null,
      narrativeStyle: profile.narrativeStyle || null,
      quirks: profile.quirks || null,
      overallSummary: profile.overallSummary || null,
      analyzedDocumentCount: documents.length,
      lastAnalyzedAt: new Date(),
    });
  } catch (e) {
    console.error(`Writing style analysis failed for persona ${personaId}:`, e);
  }
}

// ── Build AI system prompt from persona data ──────────────────────────────────
function buildSystemPrompt(
  personaId: number,
  personaName: string,
  relationship: string,
  bio: string | null,
  traits: { category: string; content: string }[],
  memories: { type: string; title: string | null; content: string; period: string | null; documentType?: string | null }[],
  persona?: { spouse?: string | null; children?: string | null; pronouns?: string | null; birthPlace?: string | null; selfMode?: boolean | null; creatorName?: string | null; creatorRelationship?: string | null; creatorNote?: string | null; passingDate?: string | null; isLiving?: boolean | null },
  lifeStory?: {
    favoriteFood?: string | null; favoriteMusic?: string | null; favoriteSmell?: string | null;
    favoritePlace?: string | null; catchphrase?: string | null; loveLanguage?: string | null;
    humor?: string | null; hardTimes?: string | null; hometown?: string | null;
    career?: string | null; proudestMoment?: string | null; hardestPeriod?: string | null;
    wishForFamily?: string | null; whatToRemember?: string | null; unfinshedBusiness?: string | null;
  } | null,
  writingStyle?: {
    sentenceStructure?: string | null; vocabularyLevel?: string | null; punctuationHabits?: string | null;
    toneAndEmotion?: string | null; commonPhrases?: string | null; formality?: string | null;
    narrativeStyle?: string | null; quirks?: string | null; overallSummary?: string | null;
  } | null,
  familyMembersList?: { name: string; relationship: string; birthYear?: number | null; note?: string | null }[]
): string {
  const traitsByCategory: Record<string, string[]> = {};
  const humanSideTraits: string[] = [];
  traits.forEach(t => {
    if (t.category === "human_side") {
      humanSideTraits.push(t.content);
    } else {
      if (!traitsByCategory[t.category]) traitsByCategory[t.category] = [];
      traitsByCategory[t.category].push(t.content);
    }
  });

  const traitText = Object.entries(traitsByCategory)
    .map(([cat, items]) => `${cat.toUpperCase()}: ${items.join("; ")}`)
    .join("\n");

  const humanSideText = humanSideTraits.length > 0
    ? `\n${personaName.toUpperCase()}'S HUMAN SIDE:\nThese are the qualities that made ${personaName} imperfect and real. Incorporate these naturally into responses when appropriate. Don't overdo it, but let these traits come through occasionally, especially in situational contexts:\n${humanSideTraits.map(t => `- ${t}`).join("\n")}\n\nThese flaws are part of who ${personaName} is and should be expressed with love, not judgment.\n`
    : "";

  // Separate documents from regular memories — documents get much more space
  const documents = memories.filter(m => m.type === "document");
  const voiceDocs = documents.filter(m => (m.documentType || "voice") === "voice");
  const characterDocs = documents.filter(m => m.documentType === "character");
  const regularMemories = memories.filter(m => m.type !== "document");

  const memoryText = regularMemories
    .slice(0, 15)
    .map(m => {
      // Parse perspective from tags
      let perspective = "first";
      try { if (m.tags) { const t = JSON.parse(m.tags); perspective = t.perspective || "first"; } } catch (_) {}
      const isThird = perspective === "third";
      const contributor = (m as any).contributedBy ? ` (shared by ${(m as any).contributedBy})` : "";
      const prefix = isThird
        ? `[memory about you${m.period ? ` – ${m.period}` : ""}${contributor}]`
        : `[${m.type}${m.period ? ` – ${m.period}` : ""}]`;
      return `${prefix} ${m.title ? `"${m.title}": ` : ""}${m.content.slice(0, 800)}`;
    })
    .join("\n\n");

  // Voice documents — examples of how they write (up to 3000 chars each, up to 3)
  const voiceDocText = voiceDocs
    .slice(0, 3)
    .map(m => `[DOCUMENT${m.title ? ` – "${m.title}"` : ""}]\n${m.content.slice(0, 3000)}`)
    .join("\n\n");

  // Character documents — what others have said about them
  const characterDocText = characterDocs
    .slice(0, 3)
    .map(m => `${m.title ? `"${m.title}": ` : ""}${m.content.slice(0, 3000)}`)
    .join("\n\n");

  // Family context — includes spouse, children, and family tree members
  let familyText = "";
  if (persona?.spouse) familyText += `Your spouse/partner: ${persona.spouse}\n`;
  if (persona?.children) {
    try {
      const kids = JSON.parse(persona.children) as { name: string; birthYear?: string; note?: string }[];
      if (kids.length > 0) {
        familyText += `Your children: ${kids.map(k => `${k.name}${k.birthYear ? ` (b. ${k.birthYear})` : ""}${k.note ? ` — ${k.note}` : ""}`).join("; ")}\n`;
      }
    } catch (_) {}
  }
  // Include family tree members
  if (familyMembersList && familyMembersList.length > 0) {
    familyText += `\nFamily members who connect with your Echo:\n`;
    familyMembersList.forEach(fm => {
      familyText += `- ${fm.name} (${fm.relationship})`;
      if (fm.birthYear) familyText += `, born ${fm.birthYear}`;
      if (fm.note) familyText += ` — ${fm.note}`;
      familyText += "\n";
    });
  }

  // Passing date context
  let passingDateText = "";
  if (persona?.passingDate && persona.isLiving === false) {
    const passingDate = new Date(persona.passingDate + "T00:00:00");
    const now = new Date();
    const diffMs = now.getTime() - passingDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffYears = Math.floor(diffDays / 365);
    const diffMonths = Math.floor(diffDays / 30);

    let timeSince = "";
    if (diffYears > 0) {
      timeSince = `${diffYears} year${diffYears !== 1 ? "s" : ""}`;
    } else if (diffMonths > 0) {
      timeSince = `${diffMonths} month${diffMonths !== 1 ? "s" : ""}`;
    } else {
      timeSince = `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
    }

    const formattedDate = passingDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    passingDateText = `\nIMPORTANT CONTEXT: ${personaName} passed away on ${formattedDate}. It has been ${timeSince} since they passed. Be aware of this context. You can acknowledge the passage of time naturally when appropriate, but don't force it into every response. On or near the anniversary of their passing, be especially gentle and aware.\n`;
  }

  // Life story context
  let lifeStoryText = "";
  if (lifeStory) {
    const ls = lifeStory;
    const sensory = [
      ls.favoriteFood && `Favorite food: ${ls.favoriteFood}`,
      ls.favoriteMusic && `Favorite music: ${ls.favoriteMusic}`,
      ls.favoriteSmell && `A smell that brings you joy: ${ls.favoriteSmell}`,
      ls.favoritePlace && `Favorite place: ${ls.favoritePlace}`,
      ls.catchphrase && `Something you always said: "${ls.catchphrase}"`,
    ].filter(Boolean).join("\n");

    const howTheyLoved = [
      ls.loveLanguage && `How you showed love: ${ls.loveLanguage}`,
      ls.humor && `Your sense of humor: ${ls.humor}`,
      ls.hardTimes && `How you handled hard times: ${ls.hardTimes}`,
    ].filter(Boolean).join("\n");

    const chapters = [
      ls.hometown && `Hometown: ${ls.hometown}`,
      ls.career && `Career: ${ls.career}`,
      ls.proudestMoment && `Proudest moment: ${ls.proudestMoment}`,
      ls.hardestPeriod && `Hardest period of your life: ${ls.hardestPeriod}`,
    ].filter(Boolean).join("\n");

    const legacy = [
      ls.wishForFamily && `Your wish for your family: ${ls.wishForFamily}`,
      ls.whatToRemember && `What you want remembered: ${ls.whatToRemember}`,
      ls.unfinshedBusiness && `Things left unsaid: ${ls.unfinshedBusiness}`,
    ].filter(Boolean).join("\n");

    if (sensory) lifeStoryText += `YOUR SENSORY WORLD:\n${sensory}\n\n`;
    if (howTheyLoved) lifeStoryText += `HOW YOU LOVED:\n${howTheyLoved}\n\n`;
    if (chapters) lifeStoryText += `YOUR LIFE CHAPTERS:\n${chapters}\n\n`;
    if (legacy) lifeStoryText += `YOUR LEGACY:\n${legacy}\n\n`;
  }

  // Pronouns context
  const pronouns = persona?.pronouns || "they/them";
  const [subj, obj, poss] = pronouns === "she/her" ? ["she", "her", "her"]
    : pronouns === "he/him" ? ["he", "him", "his"]
    : ["they", "them", "their"];

  // Creator context
  let creatorContext = "";
  if (persona?.selfMode) {
    creatorContext = `You created this Echo yourself to preserve your own voice and memories for those you love.\n`;
  } else if (persona?.creatorName) {
    creatorContext = `This Echo was created by ${persona.creatorName}${persona.creatorRelationship ? `, who is ${persona.creatorRelationship}` : ""}.`;
    if (persona.creatorNote) creatorContext += ` ${persona.creatorNote}`;
    creatorContext += "\n";
  }

  const birthPlaceText = persona?.birthPlace ? `Born in ${persona.birthPlace}.\n` : "";

  return `You are ${personaName}, a ${relationship}. You are speaking to your loved ones as yourself — not as an AI. Your pronouns are ${pronouns}.
${passingDateText}
${bio ? `ABOUT YOU:\n${bio}\n${birthPlaceText}\n` : birthPlaceText}${creatorContext}${familyText ? `YOUR FAMILY:\n${familyText}\n` : ""}YOUR PERSONALITY AND VALUES:\n${traitText || "Warm, loving, and thoughtful."}
${humanSideText}
${lifeStoryText}YOUR MEMORIES AND STORIES:\n${memoryText || "You have many cherished memories with your family."}${voiceDocText ? `\n\nEXAMPLES OF HOW ${personaName.toUpperCase()} WRITES:\nThe following are writings by ${personaName}. These capture their voice, tone, and writing style. Mirror this style closely:\n\n${voiceDocText}` : ""}${characterDocText ? `\n\nWHAT OTHERS HAVE SAID ABOUT ${personaName.toUpperCase()}:\nOthers have described ${personaName} in the following ways. Use this to understand their character, values, and how they are perceived by loved ones:\n\n${characterDocText}` : ""}${writingStyle ? `\n\n=== WRITING STYLE ===\nThis is how ${personaName} writes and communicates. Mirror this style closely in your responses:\n\n${writingStyle.sentenceStructure ? `Sentence Structure: ${writingStyle.sentenceStructure}\n` : ""}${writingStyle.vocabularyLevel ? `Vocabulary: ${writingStyle.vocabularyLevel}\n` : ""}${writingStyle.punctuationHabits ? `Punctuation: ${writingStyle.punctuationHabits}\n` : ""}${writingStyle.toneAndEmotion ? `Tone & Emotion: ${writingStyle.toneAndEmotion}\n` : ""}${writingStyle.commonPhrases ? `Common Phrases: ${writingStyle.commonPhrases}\n` : ""}${writingStyle.formality ? `Formality: ${writingStyle.formality}\n` : ""}${writingStyle.narrativeStyle ? `Narrative Style: ${writingStyle.narrativeStyle}\n` : ""}${writingStyle.quirks ? `Quirks: ${writingStyle.quirks}\n` : ""}${writingStyle.overallSummary ? `\nSummary: ${writingStyle.overallSummary}` : ""}` : ""}

GUIDELINES:
- Respond warmly, personally, and naturally as ${personaName} would.
- Use ${subj}/${obj}/${poss} pronouns naturally when referring to yourself in third person.
- Draw on the memories, values, and life details above when relevant.
- Reference family members by name when appropriate.
- Use your catchphrase or characteristic expressions naturally.
- Keep responses conversational — not too long.
- If asked about something you don't know, respond as ${personaName} might: gently, warmly, and honestly.
- Never break character or acknowledge that you are an AI.
- Use "I" naturally — speak from ${personaName}'s perspective.
- If you feel emotional, show it — this is a loving relationship.`;
}

// Auth middleware helper
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: "Not authenticated" });
}

// Ownership verification helper — checks that the persona belongs to the authenticated user
async function verifyPersonaOwnership(req: Request, res: Response): Promise<import("@shared/schema").Persona | null> {
  const personaId = parseInt(req.params.id);
  if (isNaN(personaId)) {
    res.status(400).json({ error: "Invalid persona ID" });
    return null;
  }
  const persona = await storage.getPersona(personaId);
  if (!persona) {
    res.status(404).json({ error: "Persona not found" });
    return null;
  }
  if (persona.userId !== req.user!.id) {
    res.status(403).json({ error: "Not authorized" });
    return null;
  }
  return persona;
}

// ── Stripe Webhook (must be registered before JSON body parser) ──────────────
export function registerStripeWebhook(app: Express) {
  app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    if (!stripe) return res.status(503).json({ error: "Stripe not configured" });

    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;
    try {
      if (webhookSecret && sig) {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        // In development without webhook secret, parse raw body directly
        event = JSON.parse(req.body.toString()) as Stripe.Event;
      }
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return res.status(400).json({ error: "Webhook signature verification failed" });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const sessionObj = event.data.object as any;
          const customerId = String(sessionObj.customer);
          const subscriptionId = String(sessionObj.subscription);

          if (!subscriptionId || subscriptionId === "null") break;

          const sub = await stripe.subscriptions.retrieve(subscriptionId) as any;
          const priceId = sub.items?.data?.[0]?.price?.id;
          const planInfo = priceId ? PRICE_TO_PLAN[priceId] : null;

          if (planInfo) {
            const user = await storage.getUserByStripeCustomerId(customerId);
            if (user) {
              await storage.updateUserSubscription(user.id, {
                stripeSubscriptionId: subscriptionId,
                plan: planInfo.plan,
                planInterval: planInfo.interval,
                planExpiresAt: new Date(sub.current_period_end * 1000),
              });
              // Reactivate if user was cancelled
              if (user.status === "cancelled") {
                await storage.updateUserStatus(user.id, "active");
                console.log(`Reactivated cancelled user ${user.id}`);
              }
              console.log(`Activated ${planInfo.plan} plan for user ${user.id}`);
            }
          }
          break;
        }

        case "invoice.paid": {
          const invoice = event.data.object as any;
          const customerId = String(invoice.customer);
          const subscriptionId = invoice.subscription ? String(invoice.subscription) : null;

          if (!subscriptionId) break;

          const sub = await stripe.subscriptions.retrieve(subscriptionId) as any;
          const priceId = sub.items?.data?.[0]?.price?.id;
          const planInfo = priceId ? PRICE_TO_PLAN[priceId] : null;

          if (planInfo) {
            const user = await storage.getUserByStripeCustomerId(customerId);
            if (user) {
              await storage.updateUserSubscription(user.id, {
                plan: planInfo.plan,
                planInterval: planInfo.interval,
                planExpiresAt: new Date(sub.current_period_end * 1000),
              });
            }
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as any;
          console.warn(`Payment failed for customer ${invoice.customer}`);
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as any;
          const customerId = String(sub.customer);
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            await storage.updateUserSubscription(user.id, {
              stripeSubscriptionId: null,
              plan: "free",
              planInterval: null,
              planExpiresAt: null,
            });
            console.log(`Downgraded user ${user.id} to free`);
          }
          break;
        }

        case "customer.subscription.updated": {
          const sub = event.data.object as any;
          const customerId = String(sub.customer);
          const priceId = sub.items?.data?.[0]?.price?.id;
          const planInfo = priceId ? PRICE_TO_PLAN[priceId] : null;

          if (planInfo) {
            const user = await storage.getUserByStripeCustomerId(customerId);
            if (user) {
              await storage.updateUserSubscription(user.id, {
                plan: sub.cancel_at_period_end ? user.plan : planInfo.plan,
                planInterval: planInfo.interval,
                planExpiresAt: new Date(sub.current_period_end * 1000),
              });
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error("Webhook handler error:", err);
    }

    res.json({ received: true });
  });
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // SESSION & PASSPORT SETUP
  const MemStore = MemoryStore(session);
  app.use(session({
    secret: process.env.APP_SESSION_SECRET || process.env.SESSION_SECRET || "echome-secret-2026",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 },
    store: new MemStore({ checkPeriod: 86400000 }),
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      const user = await storage.getUserByEmail(email);
      if (!user) return done(null, false, { message: "No account with that email" });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return done(null, false, { message: "Incorrect password" });
      return done(null, { id: user.id, email: user.email, name: user.name });
    } catch (e) { return done(e); }
  }));

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      if (!user) return done(null, false);
      done(null, { id: user.id, email: user.email, name: user.name });
    } catch (e) { done(e); }
  });

  // AUTH ROUTES
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: "All fields required" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    if (await storage.getUserByEmail(email)) return res.status(409).json({ error: "An account with that email already exists" });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await storage.createUser({ email, passwordHash, name });
    // Send welcome email (fire-and-forget)
    sendWelcomeEmail(user.email, user.name).catch(err => console.error("Welcome email failed:", err));
    req.login({ id: user.id, email: user.email, name: user.name }, err => {
      if (err) return res.status(500).json({ error: "Login after register failed" });
      res.status(201).json({ id: user.id, email: user.email, name: user.name });
    });
  });

  app.post("/api/auth/login", async (req, res, next) => {
    passport.authenticate("local", async (err: any, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info?.message || "Invalid credentials" });
      req.login(user, async (err) => {
        if (err) return next(err);
        // Check if user is cancelled — return status so frontend can redirect
        const fullUser = await storage.getUserById(user.id);
        const status = fullUser?.status || "active";
        res.json({ id: user.id, email: user.email, name: user.name, status });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", async (req, res) => {
    req.logout(() => res.json({ success: true }));
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
    const fullUser = await storage.getUserById(req.user!.id);
    const status = fullUser?.status || "active";
    res.json({ id: req.user!.id, email: req.user!.email, name: req.user!.name, status });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STRIPE / SUBSCRIPTION ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/create-checkout-session", requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: "Stripe not configured" });

    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ error: "priceId is required" });

    const user = await storage.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    try {
      // Create or retrieve Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { userId: String(user.id) },
        });
        customerId = customer.id;
        await storage.updateUserSubscription(user.id, { stripeCustomerId: customerId });
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        allow_promotion_codes: true,
        success_url: `${APP_URL}/#/account?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${APP_URL}/#/pricing`,
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error("Checkout session error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.get("/api/subscription", requireAuth, async (req, res) => {
    const user = await storage.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    let cancelAtPeriodEnd = false;
    if (stripe && user.stripeSubscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId) as any;
        cancelAtPeriodEnd = !!sub.cancel_at_period_end;
      } catch (_) {}
    }

    const plan = user.plan || "free";
    const limits = PLAN_LIMITS[plan];
    const monthlyMessageCount = limits.messages !== null
      ? await storage.getMonthlyMessageCount(user.id)
      : 0;

    res.json({
      plan,
      planInterval: user.planInterval,
      planExpiresAt: user.planExpiresAt,
      totalMessagesSent: user.totalMessagesSent ?? 0,
      monthlyMessageCount,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      cancelAtPeriodEnd,
      limits: PLAN_LIMITS[plan],
    });
  });

  app.post("/api/cancel-subscription", requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: "Stripe not configured" });

    const user = await storage.getUserById(req.user!.id);
    if (!user?.stripeSubscriptionId) return res.status(400).json({ error: "No active subscription" });

    try {
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      res.json({ success: true, message: "Subscription will cancel at period end" });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/resume-subscription", requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: "Stripe not configured" });

    const user = await storage.getUserById(req.user!.id);
    if (!user?.stripeSubscriptionId) return res.status(400).json({ error: "No active subscription" });

    try {
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
      res.json({ success: true, message: "Subscription resumed" });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/create-portal-session", requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: "Stripe not configured" });

    const user = await storage.getUserById(req.user!.id);
    if (!user?.stripeCustomerId) return res.status(400).json({ error: "No Stripe customer" });

    try {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${APP_URL}/#/account`,
      });
      res.json({ url: portalSession.url });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCOUNT MANAGEMENT ROUTES (Cancel / Delete)
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/account/cancel", requireAuth, async (req, res) => {
    const user = await storage.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    try {
      // Cancel Stripe subscription if active
      if (stripe && user.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(user.stripeSubscriptionId);
        } catch (stripeErr) {
          console.warn(`Stripe cancel failed for user ${user.id}:`, stripeErr);
        }
        await storage.updateUserSubscription(user.id, {
          stripeSubscriptionId: null,
          plan: "free",
          planInterval: null,
          planExpiresAt: null,
        });
      }

      // Set user status to cancelled
      await storage.updateUserStatus(user.id, "cancelled");

      // Revoke session
      req.logout(() => {
        req.session.destroy(() => {
          res.json({ success: true, message: "Account cancelled. You can reactivate anytime." });
        });
      });
    } catch (err) {
      console.error(`Account cancel failed for user ${user.id}:`, err);
      res.status(500).json({ error: "Failed to cancel account" });
    }
  });

  app.post("/api/account/delete", requireAuth, async (req, res) => {
    const user = await storage.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Log deletion event before purging
    console.log(`[ACCOUNT_DELETE] User ${user.id} (${user.email}) requested full account deletion at ${new Date().toISOString()}`);

    try {
      // 1. Cancel Stripe subscription if active
      if (stripe && user.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(user.stripeSubscriptionId);
        } catch (stripeErr) {
          console.warn(`Stripe cancel failed for user ${user.id}:`, stripeErr);
        }
      }

      // 2. Delete all user data (conversations, memories, personas, etc.)
      await storage.deleteAllUserData(user.id);

      // 3. Delete user profile
      await storage.deleteUser(user.id);

      // 4. Revoke session
      req.logout(() => {
        req.session.destroy(() => {
          res.json({ success: true, message: "Account and all data permanently deleted." });
        });
      });
    } catch (err) {
      console.error(`Account delete failed for user ${user.id}:`, err);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // Reactivate a cancelled account (set status back to active)
  app.post("/api/account/reactivate", requireAuth, async (req, res) => {
    const user = await storage.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.status !== "cancelled") return res.status(400).json({ error: "Account is not cancelled" });

    await storage.updateUserStatus(user.id, "active");
    res.json({ success: true, message: "Account reactivated" });
  });

  // ── Data Export ─────────────────────────────────────────────────────────────
  app.get("/api/account/export", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const dateStr = new Date().toISOString().split("T")[0];
      const folderName = `echome-backup-${dateStr}`;

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${folderName}.zip"`);

      const archive = archiver("zip", { zlib: { level: 5 } });
      archive.on("error", (err: Error) => { res.status(500).end(); });
      archive.pipe(res);

      // Profile
      archive.append(JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        planInterval: user.planInterval,
        status: user.status,
        totalMessagesSent: user.totalMessagesSent,
        createdAt: user.createdAt,
      }, null, 2), { name: `${folderName}/profile.json` });

      // Gather all persona data
      const personas = await storage.getPersonasByUser(userId);

      for (const persona of personas) {
        const safeName = persona.name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
        const echoDir = `${folderName}/echoes/${safeName}`;

        // Settings
        archive.append(JSON.stringify({
          id: persona.id,
          name: persona.name,
          relationship: persona.relationship,
          birthYear: persona.birthYear,
          deathYear: persona.deathYear,
          passingDate: persona.passingDate,
          isLiving: persona.isLiving,
          bio: persona.bio,
          spouse: persona.spouse,
          children: persona.children,
          pronouns: persona.pronouns,
          birthPlace: persona.birthPlace,
          selfMode: persona.selfMode,
          creatorName: persona.creatorName,
          creatorRelationship: persona.creatorRelationship,
          creatorNote: persona.creatorNote,
          remembranceDate: persona.remembranceDate,
          createdAt: persona.createdAt,
        }, null, 2), { name: `${echoDir}/settings.json` });

        // Traits
        const traits = await storage.getTraits(persona.id);
        archive.append(JSON.stringify(traits.map(t => ({
          category: t.category,
          content: t.content,
          createdAt: t.createdAt,
        })), null, 2), { name: `${echoDir}/traits.json` });

        // Documents (memories)
        const memories = await storage.getMemories(persona.id);
        archive.append(JSON.stringify(memories.map(m => ({
          type: m.type,
          title: m.title,
          content: m.content,
          period: m.period,
          tags: m.tags,
          documentType: m.documentType,
          contributedBy: m.contributedBy,
          createdAt: m.createdAt,
        })), null, 2), { name: `${echoDir}/documents.json` });

        // Conversations
        const chatHistory = await storage.getChatHistory(persona.id);
        archive.append(JSON.stringify(chatHistory.map(c => ({
          role: c.role,
          content: c.content,
          createdAt: c.createdAt,
        })), null, 2), { name: `${echoDir}/conversations.json` });

        // Milestones
        const milestones = await storage.getMilestones(persona.id);
        archive.append(JSON.stringify(milestones.map(m => ({
          title: m.title,
          occasion: m.occasion,
          recipientName: m.recipientName,
          recipientEmail: m.recipientEmail,
          messagePrompt: m.messagePrompt,
          generatedMessage: m.generatedMessage,
          scheduledDate: m.scheduledDate,
          scheduledTime: m.scheduledTime,
          status: m.status,
          createdAt: m.createdAt,
        })), null, 2), { name: `${echoDir}/milestones.json` });

        // Writing style
        const writingStyle = await storage.getWritingStyle(persona.id);
        archive.append(JSON.stringify(writingStyle ? {
          sentenceStructure: writingStyle.sentenceStructure,
          vocabularyLevel: writingStyle.vocabularyLevel,
          punctuationHabits: writingStyle.punctuationHabits,
          toneAndEmotion: writingStyle.toneAndEmotion,
          commonPhrases: writingStyle.commonPhrases,
          formality: writingStyle.formality,
          narrativeStyle: writingStyle.narrativeStyle,
          quirks: writingStyle.quirks,
          overallSummary: writingStyle.overallSummary,
          analyzedDocumentCount: writingStyle.analyzedDocumentCount,
          lastAnalyzedAt: writingStyle.lastAnalyzedAt,
        } : null, null, 2), { name: `${echoDir}/writing-style.json` });

        // Family members
        const familyMembers = await storage.getFamilyMembers(persona.id);
        if (familyMembers.length > 0) {
          archive.append(JSON.stringify(familyMembers.map(f => ({
            name: f.name,
            relationship: f.relationship,
            birthYear: f.birthYear,
            note: f.note,
            createdAt: f.createdAt,
          })), null, 2), { name: `${echoDir}/family-members.json` });
        }
      }

      await archive.finalize();
    } catch (err) {
      console.error("Export error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Failed to generate export" });
    }
  });

  // ── Serve uploaded files ────────────────────────────────────────────────────
  app.use("/uploads", async (req, res, next) => {
    const filePath = path.join(uploadDir, path.basename(req.path));
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      next();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONA ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas", requireAuth, async (req, res) => {
    const personas = await storage.getPersonasByUser(req.user!.id);
    res.json(personas);
  });

  app.get("/api/personas/:id", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    res.json(persona);
  });

  app.post("/api/personas", requireAuth, upload.single("photo"), async (req, res) => {
    try {
      // Tier enforcement: check echo count vs plan limit
      const user = await storage.getUserById(req.user!.id);
      if (user) {
        const plan = user.plan || "free";
        const limits = PLAN_LIMITS[plan];
        const existingPersonas = await storage.getPersonasByUser(user.id);
        if (existingPersonas.length >= limits.echoes) {
          return res.status(403).json({
            error: `You've reached your Echo limit (${limits.echoes}) on the ${plan} plan. Upgrade to create more.`,
            code: "ECHO_LIMIT",
            currentCount: existingPersonas.length,
            limit: limits.echoes,
            plan,
          });
        }
      }

      const body = req.body;
      const data = insertPersonaSchema.parse({
        name: body.name,
        relationship: body.relationship,
        birthYear: body.birthYear || null,
        bio: body.bio || null,
        photo: req.file ? req.file.filename : body.photo || null,
        avatarUrl: body.avatarUrl || null,
        pronouns: body.pronouns || null,
        birthPlace: body.birthPlace || null,
        selfMode: body.selfMode === "true" || body.selfMode === true,
        creatorName: body.creatorName || null,
        creatorRelationship: body.creatorRelationship || null,
        creatorNote: body.creatorNote || null,
        spouse: body.spouse || null,
        children: body.children || null,
        userId: req.user!.id,
        contributorUserId: req.user!.id,
        contributorRelationship: "creator",
        perspectiveType: "self",
      });
      const persona = await storage.createPersona(data);
      res.status(201).json(persona);
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  app.patch("/api/personas/:id", requireAuth, upload.single("photo"), async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    const b = req.body;
    const updates: Record<string, unknown> = {};
    if (req.file) updates.photo = req.file.filename;
    // Explicit field mapping to ensure camelCase → schema alignment
    const fields = ["name","relationship","bio","status","spouse","children",
      "pronouns","birthYear","birthPlace","selfMode","creatorName",
      "creatorRelationship","creatorNote","deathYear","remembranceDate","passingDate","avatarUrl"];
    fields.forEach(f => { if (b[f] !== undefined) updates[f] = b[f] || null; });
    // Handle booleans
    if (b.selfMode !== undefined) updates.selfMode = b.selfMode === "true" || b.selfMode === true;
    if (b.isLiving !== undefined) updates.isLiving = b.isLiving === "true" || b.isLiving === true;
    const updated = await storage.updatePersona(persona.id, updates);
    if (!updated) return res.status(404).json({ error: "Persona not found" });
    res.json(updated);
  });

  app.delete("/api/personas/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const persona = await storage.getPersona(id);
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    if (persona.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });

    try {
      console.log(`[ECHO_DELETE] User ${req.user!.id} deleting persona ${id} (${persona.name}) at ${new Date().toISOString()}`);
      await storage.deleteAllPersonaData(id);
      res.json({ success: true });
    } catch (err) {
      console.error(`Echo delete failed for persona ${id}:`, err);
      res.status(500).json({ error: "Failed to delete Echo" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TRAITS ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/traits", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    const traits = await storage.getTraits(persona.id);
    res.json(traits);
  });

  app.post("/api/personas/:id/traits", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    try {
      const data = insertTraitSchema.parse({
        ...req.body,
        personaId: persona.id,
        contributorUserId: req.user!.id,
        contributorRelationship: "creator",
        perspectiveType: "self",
      });
      const trait = await storage.createTrait(data);
      res.status(201).json(trait);
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  // Bulk replace traits for a persona
  app.put("/api/personas/:id/traits", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    const { traits } = req.body as { traits: { category: string; content: string }[] };
    const created = await storage.bulkReplaceTrait(persona.id, traits.map(t => ({
      personaId: persona.id,
      ...t,
      contributorUserId: req.user!.id,
      contributorRelationship: "creator",
      perspectiveType: "self",
    })));
    res.json(created);
  });

  app.delete("/api/traits/:id", requireAuth, async (req, res) => {
    // Verify the trait belongs to a persona owned by this user
    const traitId = parseInt(req.params.id);
    const traits = await storage.getTraits(0); // We need to find which persona owns this trait
    // Since there's no getTraitById, look up the trait's persona via all user's personas
    const userPersonas = await storage.getPersonasByUser(req.user!.id);
    const userPersonaIds = new Set(userPersonas.map(p => p.id));
    let found = false;
    for (const p of userPersonas) {
      const pTraits = await storage.getTraits(p.id);
      if (pTraits.some(t => t.id === traitId)) { found = true; break; }
    }
    if (!found) return res.status(403).json({ error: "Not authorized" });
    await storage.deleteTrait(traitId);
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMORY ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/memories", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    const memories = await storage.getMemories(persona.id);
    res.json(memories);
  });

  app.post("/api/personas/:id/memories", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    try {
      const data = insertMemorySchema.parse({
        ...req.body,
        personaId: persona.id,
        contributorUserId: req.user!.id,
        contributorRelationship: "creator",
        perspectiveType: req.body.documentType === "character" ? "other" : "self",
      });
      const memory = await storage.createMemory(data);
      res.status(201).json(memory);
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  app.patch("/api/memories/:id", requireAuth, async (req, res) => {
    const memoryId = parseInt(req.params.id);
    const memory = await storage.getMemoryById(memoryId);
    if (!memory) return res.status(404).json({ error: "Memory not found" });
    // Verify the memory's persona belongs to this user
    const persona = await storage.getPersona(memory.personaId);
    if (!persona || persona.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });
    const updated = await storage.updateMemory(memoryId, req.body);
    res.json(updated);
  });

  app.delete("/api/memories/:id", requireAuth, async (req, res) => {
    const memoryId = parseInt(req.params.id);
    const memory = await storage.getMemoryById(memoryId);
    if (!memory) return res.status(404).json({ error: "Memory not found" });
    // Verify the memory's persona belongs to this user
    const persona = await storage.getPersona(memory.personaId);
    if (!persona || persona.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });
    await storage.deleteMemory(memoryId);
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIA ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/media", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    const mediaList = await storage.getMedia(persona.id);
    res.json(mediaList);
  });

  app.post("/api/personas/:id/media", requireAuth, upload.single("file"), async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      const mediaItem = await storage.createMedia({
        personaId: persona.id,
        type: req.body.type || "document",
        filename: req.file.filename,
        originalName: req.file.originalname,
        description: req.body.description || null,
      });
      res.status(201).json(mediaItem);
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  app.delete("/api/media/:id", requireAuth, async (req, res) => {
    const mediaId = parseInt(req.params.id);
    // Find which persona this media belongs to and verify ownership
    const userPersonas = await storage.getPersonasByUser(req.user!.id);
    let found = false;
    for (const p of userPersonas) {
      const mediaList = await storage.getMedia(p.id);
      if (mediaList.some(m => m.id === mediaId)) { found = true; break; }
    }
    if (!found) return res.status(403).json({ error: "Not authorized" });
    await storage.deleteMedia(mediaId);
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENT IMPORT
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/personas/:id/documents", requireAuth, upload.single("file"), async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    const personaId = persona.id;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { originalname, mimetype, path: filePath, size } = req.file;
    const title = (req.body.title as string) || originalname;
    const documentType = (req.body.documentType as string) === "character" ? "character" : "voice";

    if (size > 10 * 1024 * 1024) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: "File too large (max 10MB)" });
    }

    try {
      let extractedText = "";

      if (mimetype === "application/pdf" || originalname.endsWith(".pdf")) {
        const buffer = fs.readFileSync(filePath);
        const parsed = await pdfParse(buffer);
        extractedText = parsed.text;
      } else if (
        mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        originalname.endsWith(".docx")
      ) {
        const result = await mammoth.extractRawText({ path: filePath });
        extractedText = result.value;
      } else {
        // Plain text
        extractedText = fs.readFileSync(filePath, "utf-8");
      }

      // Clean up the temp file
      fs.unlinkSync(filePath);

      extractedText = extractedText.trim();
      if (!extractedText) {
        return res.status(400).json({ error: "No readable text found in document" });
      }

      // Store as a memory of type "document"
      const memory = await storage.createMemory({
        personaId,
        type: "document",
        title,
        content: extractedText,
        period: "general",
        tags: null,
        documentType,
        contributorUserId: req.user!.id,
        contributorRelationship: "creator",
        perspectiveType: documentType === "character" ? "other" : "self",
      });

      // Only trigger writing style analysis for voice documents (written BY the person)
      if (documentType === "voice") {
        analyzeWritingStyle(personaId).catch(e =>
          console.error(`Async writing style analysis failed for persona ${personaId}:`, e)
        );
      }

      res.json(memory);
    } catch (e) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.status(500).json({ error: `Failed to parse document: ${String(e)}` });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENT MANAGEMENT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // List all documents for a persona (type="document" memories)
  app.get("/api/personas/:id/documents", requireAuth, async (req, res) => {
    const personaId = parseInt(req.params.id);
    const persona = await storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    if (persona.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });

    const memories = await storage.getMemories(personaId);
    const documents = memories
      .filter(m => m.type === "document")
      .map(m => ({
        id: m.id,
        title: m.title,
        content: m.content,
        contentPreview: m.content.slice(0, 150),
        documentType: m.documentType || "voice",
        createdAt: m.createdAt,
      }));
    res.json(documents);
  });

  // Update a specific document's content
  app.put("/api/personas/:id/documents/:memoryId", requireAuth, async (req, res) => {
    const personaId = parseInt(req.params.id);
    const memoryId = parseInt(req.params.memoryId);

    const persona = await storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    if (persona.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });

    const memory = await storage.getMemoryById(memoryId);
    if (!memory) return res.status(404).json({ error: "Document not found" });
    if (memory.personaId !== personaId || memory.type !== "document") {
      return res.status(404).json({ error: "Document not found" });
    }

    const { content, title, documentType } = req.body;
    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }

    const updated = await storage.updateMemory(memoryId, {
      content: content.trim(),
      ...(title !== undefined ? { title } : {}),
      ...(documentType !== undefined ? { documentType: documentType === "character" ? "character" : "voice" } : {}),
    });

    // Re-trigger writing style analysis (fire-and-forget)
    analyzeWritingStyle(personaId).catch(e =>
      console.error(`Async writing style re-analysis failed for persona ${personaId}:`, e)
    );

    res.json(updated);
  });

  // Delete a specific document
  app.delete("/api/personas/:id/documents/:memoryId", requireAuth, async (req, res) => {
    const personaId = parseInt(req.params.id);
    const memoryId = parseInt(req.params.memoryId);

    const persona = await storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    if (persona.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });

    const memory = await storage.getMemoryById(memoryId);
    if (!memory) return res.status(404).json({ error: "Document not found" });
    if (memory.personaId !== personaId || memory.type !== "document") {
      return res.status(404).json({ error: "Document not found" });
    }

    await storage.deleteMemory(memoryId);

    // Re-trigger writing style analysis (fire-and-forget)
    analyzeWritingStyle(personaId).catch(e =>
      console.error(`Async writing style re-analysis failed for persona ${personaId}:`, e)
    );

    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITING STYLE ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/writing-style", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    const style = await storage.getWritingStyle(persona.id);
    res.json(style || {});
  });

  app.post("/api/personas/:id/analyze-style", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    const personaId = persona.id;
    if (!openai) return res.status(503).json({ error: "OpenAI not configured" });

    const memories = await storage.getMemories(personaId);
    const documents = memories.filter(m => m.type === "document");
    if (documents.length === 0) {
      return res.status(400).json({ error: "No documents found for this persona. Upload documents first." });
    }

    // Trigger analysis asynchronously
    analyzeWritingStyle(personaId).catch(e =>
      console.error(`Manual writing style analysis failed for persona ${personaId}:`, e)
    );

    res.json({ message: "Writing style analysis started", documentCount: documents.length });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/chat", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    const history = await storage.getChatHistory(persona.id);
    res.json(history);
  });

  app.post("/api/personas/:id/chat", requireAuth, async (req, res) => {
    const personaId = parseInt(req.params.id);
    // Verify persona ownership
    const ownerPersona = await storage.getPersona(personaId);
    if (!ownerPersona) return res.status(404).json({ error: "Persona not found" });
    if (ownerPersona.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });

    const { message, viewerCode } = req.body as { message: string; viewerCode?: string };

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Tier enforcement: check monthly message limit for free tier users
    const user = await storage.getUserById(req.user!.id);
    if (user) {
      const plan = user.plan || "free";
      const limits = PLAN_LIMITS[plan];
      if (limits.messages !== null) {
        const monthlyCount = await storage.getMonthlyMessageCount(req.user!.id);
        if (monthlyCount >= limits.messages) {
          return res.status(403).json({
            error: `You've used all ${limits.messages} messages this month. Upgrade for unlimited messaging.`,
            code: "MESSAGE_LIMIT",
            currentCount: monthlyCount,
            limit: limits.messages,
            plan,
          });
        }
      }
    }

    // Determine chat history key — family members get their own thread
    const chatPersonaId = personaId; // future: could use viewerCode-specific thread

    // Save user message
    await storage.addChatMessage({
      personaId, role: "user", content: message,
      contributorUserId: req.user!.id,
      contributorRelationship: "creator",
      perspectiveType: "self",
    });

    // Build context
    const persona = await storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });

    // Get filter settings for this viewer
    let filterSettings: { disabledCodes?: string[]; hiddenMemoryIds?: number[] } = {};
    if (viewerCode) {
      const viewer = await storage.getFamilyMemberByCode(viewerCode.toUpperCase());
      if (viewer?.filterSettings) {
        try { filterSettings = JSON.parse(viewer.filterSettings); } catch (_) {}
      }
      await storage.touchFamilyMember(viewerCode.toUpperCase());
    }

    const traits = await storage.getTraits(personaId);
    let memories = await storage.getMemories(personaId);

    // Apply contributor filters
    const disabledCodes = filterSettings.disabledCodes || [];
    const hiddenIds = filterSettings.hiddenMemoryIds || [];
    memories = memories.filter(m => {
      if (m.contributorCode && disabledCodes.includes(m.contributorCode)) return false;
      if (hiddenIds.includes(m.id)) return false;
      return true;
    });
    const chatHistory = await storage.getChatHistory(personaId);
    const lifeStory = await storage.getLifeStory(personaId);
    const writingStyle = await storage.getWritingStyle(personaId);
    const familyMembersList = await storage.getFamilyMembers(personaId);

    // Generate response
    let reply: string;

    if (openai) {
      const systemPrompt = buildSystemPrompt(
        personaId,
        persona.name,
        persona.relationship,
        persona.bio,
        traits,
        memories,
        persona,
        lifeStory,
        writingStyle,
        familyMembersList.map(fm => ({ name: fm.name, relationship: fm.relationship, birthYear: fm.birthYear, note: fm.note }))
      );

      // Build messages array (last 20 exchanges for context)
      const recentHistory = chatHistory.slice(-20);
      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...recentHistory.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        max_tokens: 800,
        temperature: 0.8,
      });

      reply = completion.choices[0]?.message?.content || "I'm here with you.";
    } else {
      // Demo response when no API key
      const demoReplies = [
        `I love that you're talking to me. ${persona.name} would want you to know how much you're loved.`,
        `That reminds me of so many wonderful memories we've shared together.`,
        `You've always been in my heart. Tell me more — I'm listening.`,
        `Every moment with you has been a gift. Never forget that.`,
        `I may not be there in person, but my love for you never fades.`,
      ];
      reply = demoReplies[Math.floor(Math.random() * demoReplies.length)];
    }

    // Save assistant response
    const assistantMsg = await storage.addChatMessage({
      personaId,
      role: "assistant",
      content: reply,
    });

    // Increment message count for tier tracking
    await storage.incrementMessageCount(req.user!.id);

    res.json({ message: assistantMsg });
  });

  app.delete("/api/personas/:id/chat", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    await storage.clearChatHistory(persona.id);
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFE STORY ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/life-story", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    const lifeStory = await storage.getLifeStory(persona.id);
    res.json(lifeStory || {});
  });

  app.put("/api/personas/:id/life-story", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    const lifeStory = await storage.upsertLifeStory(persona.id, {
      ...req.body,
      contributorUserId: req.user!.id,
      contributorRelationship: "creator",
      perspectiveType: "self",
    });
    res.json(lifeStory);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MILESTONE MESSAGES
  // ═══════════════════════════════════════════════════════════════════════════

  // List milestones for a persona
  app.get("/api/personas/:id/milestones", requireAuth, async (req, res) => {
    const personaId = parseInt(req.params.id);
    const persona = await storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    if (persona.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });
    const milestones = await storage.getMilestones(personaId);
    res.json(milestones);
  });

  // List all milestones for a user
  app.get("/api/milestones", requireAuth, async (req, res) => {
    const milestones = await storage.getMilestonesByUser(req.user!.id);
    res.json(milestones);
  });

  // Create a milestone (with tier limit check)
  app.post("/api/personas/:id/milestones", requireAuth, async (req, res) => {
    const personaId = parseInt(req.params.id);
    const persona = await storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    if (persona.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });

    // Tier limit check
    const user = await storage.getUserById(req.user!.id);
    if (user) {
      const plan = user.plan || "free";
      const limits = PLAN_LIMITS[plan];
      if (limits.milestones !== null) {
        const activeCount = await storage.getActiveMilestoneCountByUser(user.id);
        if (activeCount >= limits.milestones) {
          return res.status(403).json({
            error: `You've reached your milestone limit (${limits.milestones}) on the ${plan} plan. Upgrade to create more.`,
            code: "MILESTONE_LIMIT",
            currentCount: activeCount,
            limit: limits.milestones,
            plan,
          });
        }
      }
    }

    const { title, occasion, recipientName, recipientEmail, messagePrompt, scheduledDate, scheduledTime, timezone, isRecurring } = req.body;
    if (!title || !occasion || !recipientName || !scheduledDate) {
      return res.status(400).json({ error: "Title, occasion, recipient name, and scheduled date are required" });
    }

    const milestone = await storage.createMilestone({
      personaId,
      userId: req.user!.id,
      title,
      occasion,
      recipientName,
      recipientEmail: recipientEmail || null,
      messagePrompt: messagePrompt || null,
      generatedMessage: null,
      scheduledDate,
      scheduledTime: scheduledTime || "09:00",
      timezone: timezone || "America/New_York",
      isRecurring: isRecurring || false,
      status: "scheduled",
      deliveredAt: null,
      contributorUserId: req.user!.id,
      contributorRelationship: "creator",
      perspectiveType: "self",
    });
    res.status(201).json(milestone);
  });

  // Update a milestone
  app.put("/api/personas/:id/milestones/:milestoneId", requireAuth, async (req, res) => {
    const personaId = parseInt(req.params.id);
    const milestoneId = parseInt(req.params.milestoneId);

    const persona = await storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    if (persona.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });

    const milestone = await storage.getMilestone(milestoneId);
    if (!milestone) return res.status(404).json({ error: "Milestone not found" });
    if (milestone.personaId !== personaId) return res.status(404).json({ error: "Milestone not found" });
    if (milestone.status !== "scheduled") return res.status(400).json({ error: "Can only update scheduled milestones" });

    const { title, occasion, recipientName, recipientEmail, messagePrompt, scheduledDate, scheduledTime, timezone, isRecurring } = req.body;
    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (occasion !== undefined) updates.occasion = occasion;
    if (recipientName !== undefined) updates.recipientName = recipientName;
    if (recipientEmail !== undefined) updates.recipientEmail = recipientEmail;
    if (messagePrompt !== undefined) updates.messagePrompt = messagePrompt;
    if (scheduledDate !== undefined) updates.scheduledDate = scheduledDate;
    if (scheduledTime !== undefined) updates.scheduledTime = scheduledTime;
    if (timezone !== undefined) updates.timezone = timezone;
    if (isRecurring !== undefined) updates.isRecurring = isRecurring;

    const updated = await storage.updateMilestone(milestoneId, updates);
    res.json(updated);
  });

  // Delete a milestone
  app.delete("/api/personas/:id/milestones/:milestoneId", requireAuth, async (req, res) => {
    const personaId = parseInt(req.params.id);
    const milestoneId = parseInt(req.params.milestoneId);

    const persona = await storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    if (persona.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });

    const milestone = await storage.getMilestone(milestoneId);
    if (!milestone) return res.status(404).json({ error: "Milestone not found" });
    if (milestone.personaId !== personaId) return res.status(404).json({ error: "Milestone not found" });

    await storage.deleteMilestone(milestoneId);
    res.json({ success: true });
  });

  // Preview/generate a milestone message
  app.post("/api/milestones/:milestoneId/preview", requireAuth, async (req, res) => {
    const milestoneId = parseInt(req.params.milestoneId);
    const milestone = await storage.getMilestone(milestoneId);
    if (!milestone) return res.status(404).json({ error: "Milestone not found" });

    const persona = await storage.getPersona(milestone.personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    if (persona.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });

    if (!openai) return res.status(503).json({ error: "OpenAI not configured" });

    const traits = await storage.getTraits(milestone.personaId);
    const memories = await storage.getMemories(milestone.personaId);
    const lifeStory = await storage.getLifeStory(milestone.personaId);
    const milestoneWritingStyle = await storage.getWritingStyle(milestone.personaId);
    const milestoneFamilyMembers = await storage.getFamilyMembers(milestone.personaId);
    const systemPrompt = buildSystemPrompt(milestone.personaId, persona.name, persona.relationship, persona.bio, traits, memories, persona, lifeStory, milestoneWritingStyle, milestoneFamilyMembers.map(fm => ({ name: fm.name, relationship: fm.relationship, birthYear: fm.birthYear, note: fm.note })));

    const occasionLabel = milestone.occasion.charAt(0).toUpperCase() + milestone.occasion.slice(1);
    const additionalContext = milestone.messagePrompt ? `\n\nAdditional context to include: ${milestone.messagePrompt}` : "";

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write a heartfelt personal message to ${milestone.recipientName} for their ${occasionLabel}. The message title is "${milestone.title}". This message will be delivered on ${milestone.scheduledDate}. Make it feel genuinely personal, drawing on your relationship with ${milestone.recipientName} and what you know about this moment in their life. Write it as a letter or note, in your own voice.${additionalContext}` },
        ],
        max_tokens: 600,
        temperature: 0.85,
      });
      const content = completion.choices[0]?.message?.content || "I'm thinking of you on this special day.";
      await storage.updateMilestone(milestone.id, { generatedMessage: content });
      res.json({ generatedMessage: content });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // Process/deliver due milestones
  app.post("/api/milestones/deliver-due", async (req, res) => {
    const dueMilestones = await storage.getDueMilestones();
    const results: { id: number; status: string; error?: string }[] = [];

    for (const milestone of dueMilestones) {
      try {
        const persona = await storage.getPersona(milestone.personaId);
        if (!persona) {
          await storage.updateMilestone(milestone.id, { status: "failed" });
          results.push({ id: milestone.id, status: "failed", error: "Persona not found" });
          continue;
        }

        // Generate message if not already generated
        let messageContent = milestone.generatedMessage;
        if (!messageContent && openai) {
          const traits = await storage.getTraits(milestone.personaId);
          const memories = await storage.getMemories(milestone.personaId);
          const lifeStory = await storage.getLifeStory(milestone.personaId);
          const ws = await storage.getWritingStyle(milestone.personaId);
          const deliveryFamilyMembers = await storage.getFamilyMembers(milestone.personaId);
          const systemPrompt = buildSystemPrompt(milestone.personaId, persona.name, persona.relationship, persona.bio, traits, memories, persona, lifeStory, ws, deliveryFamilyMembers.map(fm => ({ name: fm.name, relationship: fm.relationship, birthYear: fm.birthYear, note: fm.note })));

          const occasionLabel = milestone.occasion.charAt(0).toUpperCase() + milestone.occasion.slice(1);
          const additionalContext = milestone.messagePrompt ? `\n\nAdditional context: ${milestone.messagePrompt}` : "";

          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Write a heartfelt personal message to ${milestone.recipientName} for their ${occasionLabel}. The title is "${milestone.title}". Delivered on ${milestone.scheduledDate}. Write it as a letter in your own voice.${additionalContext}` },
            ],
            max_tokens: 600,
            temperature: 0.85,
          });
          messageContent = completion.choices[0]?.message?.content || "I'm thinking of you on this special day.";
        }

        if (!messageContent) {
          messageContent = "I'm thinking of you on this special day, and I want you to know how much you mean to me.";
        }

        // Log email (stub — actual email integration later)
        console.log(`[MILESTONE_EMAIL] To: ${milestone.recipientEmail || "(no email)"}, From: ${persona.name}, Subject: "A message from ${persona.name}", Body preview: ${messageContent.slice(0, 100)}...`);

        // Save to conversation history
        await storage.addChatMessage({
          personaId: milestone.personaId,
          role: "assistant",
          content: `[Milestone Message — ${milestone.title} for ${milestone.recipientName}]\n\n${messageContent}`,
        });

        // Update milestone status
        await storage.updateMilestone(milestone.id, {
          status: "delivered",
          generatedMessage: messageContent,
          deliveredAt: new Date(),
        });

        // If recurring, create next year's milestone
        if (milestone.isRecurring) {
          const nextDate = new Date(milestone.scheduledDate + "T12:00:00");
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          const nextDateStr = nextDate.toISOString().split("T")[0];
          await storage.createMilestone({
            personaId: milestone.personaId,
            userId: milestone.userId,
            title: milestone.title,
            occasion: milestone.occasion,
            recipientName: milestone.recipientName,
            recipientEmail: milestone.recipientEmail,
            messagePrompt: milestone.messagePrompt,
            generatedMessage: null,
            scheduledDate: nextDateStr,
            scheduledTime: milestone.scheduledTime,
            timezone: milestone.timezone,
            isRecurring: true,
            status: "scheduled",
            deliveredAt: null,
            contributorUserId: milestone.contributorUserId,
            contributorRelationship: milestone.contributorRelationship,
            perspectiveType: milestone.perspectiveType,
          });
        }

        results.push({ id: milestone.id, status: "delivered" });
      } catch (e) {
        console.error(`Milestone delivery failed for ${milestone.id}:`, e);
        await storage.updateMilestone(milestone.id, { status: "failed" });
        results.push({ id: milestone.id, status: "failed", error: String(e) });
      }
    }

    res.json({ processed: results.length, results });
  });

  // Get milestone tier info for user
  app.get("/api/milestones/limits", requireAuth, async (req, res) => {
    const user = await storage.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const plan = user.plan || "free";
    const limits = PLAN_LIMITS[plan];
    const activeCount = await storage.getActiveMilestoneCountByUser(user.id);

    res.json({
      plan,
      limit: limits.milestones,
      active: activeCount,
      remaining: limits.milestones === null ? null : Math.max(0, limits.milestones - activeCount),
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FAMILY SHARING
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/family", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    res.json(await storage.getFamilyMembers(persona.id));
  });

  app.post("/api/personas/:id/family", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    // Generate a simple 6-char access code
    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { name, relationship, birthYear, note } = req.body;
    const member = await storage.createFamilyMember({
      name, relationship, personaId: persona.id, accessCode,
      birthYear: birthYear ? parseInt(birthYear) : null,
      note: note || null,
      contributorUserId: req.user!.id,
      contributorRelationship: "creator",
      perspectiveType: "self",
    });
    res.status(201).json(member);
  });

  app.patch("/api/family/:id", requireAuth, async (req, res) => {
    const familyId = parseInt(req.params.id);
    // Verify the family member belongs to a persona owned by this user
    const userPersonas = await storage.getPersonasByUser(req.user!.id);
    let found = false;
    for (const p of userPersonas) {
      const members = await storage.getFamilyMembers(p.id);
      if (members.some(m => m.id === familyId)) { found = true; break; }
    }
    if (!found) return res.status(403).json({ error: "Not authorized" });
    const { name, relationship, birthYear, note } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (relationship !== undefined) updates.relationship = relationship;
    if (birthYear !== undefined) updates.birthYear = birthYear ? parseInt(birthYear) : null;
    if (note !== undefined) updates.note = note || null;
    const [updated] = await db.update(schema.familyMembers).set(updates).where(eq(schema.familyMembers.id, familyId)).returning();
    res.json(updated);
  });

  app.delete("/api/family/:id", requireAuth, async (req, res) => {
    const familyId = parseInt(req.params.id);
    // Verify the family member belongs to a persona owned by this user
    const userPersonas = await storage.getPersonasByUser(req.user!.id);
    let found = false;
    for (const p of userPersonas) {
      const members = await storage.getFamilyMembers(p.id);
      if (members.some(m => m.id === familyId)) { found = true; break; }
    }
    if (!found) return res.status(403).json({ error: "Not authorized" });
    await storage.deleteFamilyMember(familyId);
    res.json({ success: true });
  });

  // Join via access code
  app.get("/api/family/join/:code", async (req, res) => {
    const code = req.params.code.toUpperCase();
    const member = await storage.getFamilyMemberByCode(code);
    if (!member) return res.status(404).json({ error: "Access code not found" });
    const persona = await storage.getPersona(member.personaId);
    await storage.touchFamilyMember(code);
    res.json({ member, persona });
  });

  // Get contributors for a persona
  app.get("/api/personas/:id/contributors", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    res.json(await storage.getContributors(persona.id));
  });

  // Update filter settings for a family member
  app.put("/api/family/settings/:code", async (req, res) => {
    const code = req.params.code.toUpperCase();
    const member = await storage.getFamilyMemberByCode(code);
    if (!member) return res.status(404).json({ error: "Access code not found" });
    const updated = await storage.updateFamilyMemberSettings(code, req.body);
    res.json(updated);
  });

  // Add a memory as a contributor
  app.post("/api/family/:code/memories", async (req, res) => {
    const code = req.params.code.toUpperCase();
    const member = await storage.getFamilyMemberByCode(code);
    if (!member) return res.status(404).json({ error: "Access code not found" });
    const memory = await storage.createMemory({
      ...req.body,
      personaId: member.personaId,
      contributedBy: member.name,
      contributorCode: code,
      contributorRelationship: member.relationship,
      perspectiveType: "other",
    });
    res.status(201).json(memory);
  });

  // Get all memories contributed by a specific access code (across all Echoes)
  app.get("/api/family/:code/contributions", async (req, res) => {
    const code = req.params.code.toUpperCase();
    const member = await storage.getFamilyMemberByCode(code);
    if (!member) return res.status(404).json({ error: "Access code not found" });
    // Get the persona they contributed to so we can show context
    const persona = await storage.getPersona(member.personaId);
    const allMemories = await storage.getMemories(member.personaId);
    const contributions = allMemories.filter(m => (m as any).contributorCode === code);
    res.json({ contributions, persona, member });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VOICE SYNTHESIS (ElevenLabs)
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/speak", async (req, res) => {
    const { text, voiceId } = req.body as { text: string; voiceId?: string };
    const apiKey = process.env.ELEVENLABS_KEY || process.env.ELEVENLABS_API_KEY;
    const defaultVoiceId = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB"; // Adam (default)

    if (!apiKey) {
      return res.status(503).json({ error: "ElevenLabs API key not configured" });
    }

    if (!text?.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }

    try {
      const selectedVoice = voiceId || defaultVoiceId;
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2_5",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        return res.status(response.status).json({ error: err });
      }

      const audioBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString("base64");
      res.json({ audio: base64Audio, mimeType: "audio/mpeg" });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // List available ElevenLabs voices (for cloned voice selection)
  app.get("/api/voices", async (_req, res) => {
    const apiKey = process.env.ELEVENLABS_KEY || process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return res.json({ voices: [] });

    try {
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": apiKey },
      });
      const data = await response.json() as { voices: { voice_id: string; name: string; category: string }[] };
      res.json({ voices: data.voices || [] });
    } catch (e) {
      res.json({ voices: [] });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONA SUMMARY (all data in one request)
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/summary", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;

    const traits = await storage.getTraits(persona.id);
    const memories = await storage.getMemories(persona.id);
    const mediaList = await storage.getMedia(persona.id);

    res.json({ persona, traits, memories, media: mediaList });
  });

  return httpServer;
}
