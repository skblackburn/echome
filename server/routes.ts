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
import { sendWelcomeEmail, sendHeirInvitationEmail, sendTransferExecutedEmail, sendHeirClaimedEmail, sendLetterDeliveryEmail } from "./email";
import { deliverSealedLetters } from "./letter-worker";
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
import crypto from "crypto";
import type { User } from "@shared/schema";

// ── Stripe Setup ──────────────────────────────────────────────────────────────
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const APP_URL = process.env.APP_URL || "https://echome-production-a33e.up.railway.app";

// Plan limits configuration
const PLAN_LIMITS: Record<string, { echoes: number; messages: number | null; milestones: number | null; heirs: number; reflections: number | null; voiceEntries: number | null; photoMemories: number | null }> = {
  free: { echoes: 1, messages: 20, milestones: 1, heirs: 1, reflections: 3, voiceEntries: 5, photoMemories: 3 },
  personal: { echoes: 1, messages: null, milestones: 5, heirs: 3, reflections: null, voiceEntries: null, photoMemories: null },
  family: { echoes: 5, messages: null, milestones: 15, heirs: 5, reflections: null, voiceEntries: null, photoMemories: null },
  legacy: { echoes: 10, messages: null, milestones: null, heirs: 10, reflections: null, voiceEntries: null, photoMemories: null },
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

// Configure multer for voice journal audio uploads
const ALLOWED_AUDIO_TYPES = ["audio/mp3", "audio/mpeg", "audio/m4a", "audio/mp4", "audio/wav", "audio/wave", "audio/webm", "audio/ogg"];
const audioUploadDir = path.join(process.cwd(), "uploads/journal-audio");
if (!fs.existsSync(audioUploadDir)) fs.mkdirSync(audioUploadDir, { recursive: true });

const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, audioUploadDir);
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname) || ".webm";
      cb(null, `${unique}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB (Whisper limit)
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_AUDIO_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid audio format. Supported: mp3, m4a, wav, webm, ogg"));
    }
  },
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
  familyMembersList?: { name: string; relationship: string; birthYear?: number | null; note?: string | null }[],
  sharedHeirsList?: { name: string; relationship: string }[],
  originalCreatorName?: string,
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

${sharedHeirsList && sharedHeirsList.length > 0 ? `
SHARED ECHO CONTEXT:
This Echo was originally created by ${originalCreatorName || "the creator"} and has been shared with ${sharedHeirsList.map(h => `${h.name} (${h.relationship})`).join(", ")}. It contains contributions from multiple people who knew ${personaName}. Each contribution is tagged with who shared it. When responding, draw from all available perspectives, prioritizing ${personaName}'s own words (self perspective) and blending others' memories naturally.
` : ""}GUIDELINES:
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

// Access control helper — checks if a user can access a persona (owner OR claimed heir)
// action: 'read' | 'write' | 'admin'
// Returns { allowed: boolean; isOwner: boolean; isHeir: boolean; heir?: EchoHeir; accessLevel?: string }
async function canAccessPersona(userId: number, personaId: number, action: "read" | "write" | "admin"): Promise<{
  allowed: boolean; isOwner: boolean; isHeir: boolean;
  heir?: import("@shared/schema").EchoHeir; accessLevel?: string;
}> {
  const persona = await storage.getPersona(personaId);
  if (!persona) return { allowed: false, isOwner: false, isHeir: false };

  // Direct owner always has full access
  if (persona.userId === userId) {
    return { allowed: true, isOwner: true, isHeir: false, accessLevel: "admin" };
  }

  // Check if user is a claimed heir
  const heirs = await storage.getHeirsByPersona(personaId);
  const heirRecord = heirs.find(h => h.heirUserId === userId && h.status === "claimed");
  if (!heirRecord) return { allowed: false, isOwner: false, isHeir: false };

  // SECURITY: Heirs only get access AFTER a transfer has been executed.
  // Being "claimed" just means they accepted the invitation — access requires
  // the creator (or a scheduled trigger) to actually execute the transfer.
  const transfers = await storage.getTransfersByPersona(personaId);
  const hasExecutedTransfer = transfers.some(t => t.status === "executed");
  if (!hasExecutedTransfer) {
    return { allowed: false, isOwner: false, isHeir: true, heir: heirRecord, accessLevel: heirRecord.accessLevel || "full" };
  }

  const heirAccessLevel = heirRecord.accessLevel || "full";
  if (action === "admin") {
    // Only owner can perform admin actions
    return { allowed: false, isOwner: false, isHeir: true, heir: heirRecord, accessLevel: heirAccessLevel };
  }
  if (action === "write" && heirAccessLevel === "read_only") {
    return { allowed: false, isOwner: false, isHeir: true, heir: heirRecord, accessLevel: heirAccessLevel };
  }
  // read_only heirs can read; full heirs can read and write
  return { allowed: true, isOwner: false, isHeir: true, heir: heirRecord, accessLevel: heirAccessLevel };
}

// Verify persona access — replaces verifyPersonaOwnership for endpoints that heirs can also access
async function verifyPersonaAccess(req: Request, res: Response, action: "read" | "write" | "admin"): Promise<{
  persona: import("@shared/schema").Persona; access: Awaited<ReturnType<typeof canAccessPersona>>;
} | null> {
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
  const access = await canAccessPersona(req.user!.id, personaId, action);
  if (!access.allowed) {
    res.status(403).json({ error: "Not authorized" });
    return null;
  }
  return { persona, access };
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
  // USER PREFERENCES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/user/preferences", requireAuth, async (req, res) => {
    const prefs = await storage.getUserPreferences(req.user!.id);
    res.json(prefs);
  });

  app.put("/api/user/preferences", requireAuth, async (req, res) => {
    const allowedFields = [
      "aiChatEnabled", "aiReflectionsEnabled", "aiPhotoPromptsEnabled",
      "aiVoiceTranscriptionEnabled", "aiWritingStyleEnabled",
      "emailLetterDelivery", "emailMilestones", "emailMarketing",
    ];
    const updates: Record<string, boolean> = {};
    for (const key of allowedFields) {
      if (typeof req.body[key] === "boolean") {
        updates[key] = req.body[key];
      }
    }
    const prefs = await storage.updateUserPreferences(req.user!.id, updates);
    res.json(prefs);
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

      // Journal entries
      const journalEntries = await storage.getJournalEntriesByUser(userId, 100000, 0);
      if (journalEntries.length > 0) {
        archive.append(JSON.stringify(journalEntries.map(j => ({
          title: j.title,
          content: j.content,
          entryDate: j.entryDate,
          mood: j.mood,
          includedInEcho: j.includedInEcho,
          reflectionCount: j.reflectionCount,
          aiReflections: j.aiReflections,
          createdAt: j.createdAt,
        })), null, 2), { name: `${folderName}/journal-entries.json` });
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
    const ownPersonas = await storage.getPersonasByUser(req.user!.id);
    // Also fetch inherited personas (where user is a claimed heir AND transfer has been executed)
    const heirRecords = await storage.getHeirsByUserId(req.user!.id);
    const claimedHeirs = heirRecords.filter(h => h.status === "claimed");
    const inheritedPersonas: (import("@shared/schema").Persona & { _heirAccess?: string; _isInherited?: boolean })[] = [];
    for (const heir of claimedHeirs) {
      // Skip if already owned
      if (ownPersonas.some(p => p.id === heir.personaId)) continue;
      // SECURITY: Only show inherited echoes after the transfer has been executed
      const transfers = await storage.getTransfersByPersona(heir.personaId);
      if (!transfers.some(t => t.status === "executed")) continue;
      const persona = await storage.getPersona(heir.personaId);
      if (persona) {
        inheritedPersonas.push({ ...persona, _heirAccess: heir.accessLevel, _isInherited: true });
      }
    }
    res.json([...ownPersonas, ...inheritedPersonas]);
  });

  app.get("/api/personas/:id", requireAuth, async (req, res) => {
    const result = await verifyPersonaAccess(req, res, "read");
    if (!result) return;
    const data: any = { ...result.persona };
    if (result.access.isHeir) {
      data._heirAccess = result.access.accessLevel;
      data._isInherited = true;
    }
    res.json(data);
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
    const result = await verifyPersonaAccess(req, res, "read");
    if (!result) return;
    const traits = await storage.getTraits(result.persona.id);
    res.json(traits);
  });

  app.post("/api/personas/:id/traits", requireAuth, async (req, res) => {
    const result = await verifyPersonaAccess(req, res, "write");
    if (!result) return;
    try {
      const { access } = result;
      const data = insertTraitSchema.parse({
        ...req.body,
        personaId: result.persona.id,
        contributorUserId: req.user!.id,
        contributorRelationship: access.isHeir && access.heir ? (access.heir.heirRelationship || "heir") : "creator",
        perspectiveType: access.isHeir ? "other" : "self",
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
    const result = await verifyPersonaAccess(req, res, "read");
    if (!result) return;
    const memories = await storage.getMemories(result.persona.id);
    res.json(memories);
  });

  app.post("/api/personas/:id/memories", requireAuth, async (req, res) => {
    const result = await verifyPersonaAccess(req, res, "write");
    if (!result) return;
    try {
      const { access } = result;
      const data = insertMemorySchema.parse({
        ...req.body,
        personaId: result.persona.id,
        contributorUserId: req.user!.id,
        contributorRelationship: access.isHeir && access.heir ? (access.heir.heirRelationship || "heir") : "creator",
        perspectiveType: access.isHeir ? "other" : (req.body.documentType === "character" ? "other" : "self"),
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
    const result = await verifyPersonaAccess(req, res, "read");
    if (!result) return;
    const mediaList = await storage.getMedia(result.persona.id);
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
    // AI feature gate
    const stylePrefs = await storage.getUserPreferences(req.user!.id);
    if (!stylePrefs.aiWritingStyleEnabled) {
      return res.status(403).json({ error: "Writing style analysis is not enabled. Turn it on in Settings.", feature: "ai_writing_style", settings_url: "/settings" });
    }

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
    const result = await verifyPersonaAccess(req, res, "read");
    if (!result) return;
    const { access } = result;
    // Heirs get their own private chat history
    if (access.isHeir) {
      const history = await storage.getChatHistoryForHeir(result.persona.id, req.user!.id);
      return res.json(history);
    }
    // Owner gets their own history (messages without heir_user_id or with their own user id)
    const allHistory = await storage.getChatHistory(result.persona.id);
    const ownerHistory = allHistory.filter(m => !m.heirUserId || m.heirUserId === req.user!.id);
    res.json(ownerHistory);
  });

  app.post("/api/personas/:id/chat", requireAuth, async (req, res) => {
    const personaId = parseInt(req.params.id);
    const access = await canAccessPersona(req.user!.id, personaId, "read");
    if (!access.allowed) return res.status(403).json({ error: "Not authorized" });

    // AI feature gate
    const chatPrefs = await storage.getUserPreferences(req.user!.id);
    if (!chatPrefs.aiChatEnabled) {
      return res.status(403).json({ error: "AI Echo chat is not enabled. Turn it on in Settings.", feature: "ai_chat", settings_url: "/settings" });
    }

    const { message, viewerCode } = req.body as { message: string; viewerCode?: string };

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Tier enforcement: check monthly message limit for free tier users (only for non-heir users)
    if (access.isOwner) {
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
    }

    // Save user message with heir_user_id for per-heir privacy
    const heirUserId = access.isHeir ? req.user!.id : null;
    await storage.addChatMessage({
      personaId, role: "user", content: message,
      heirUserId: heirUserId,
      contributorUserId: req.user!.id,
      contributorRelationship: access.isHeir && access.heir ? (access.heir.heirRelationship || "heir") : "creator",
      perspectiveType: access.isHeir ? "other" : "self",
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

    // Get per-user chat history (heir gets their own, owner gets theirs)
    let chatHistory;
    if (access.isHeir) {
      chatHistory = await storage.getChatHistoryForHeir(personaId, req.user!.id);
    } else {
      const allHistory = await storage.getChatHistory(personaId);
      chatHistory = allHistory.filter(m => !m.heirUserId || m.heirUserId === req.user!.id);
    }

    const lifeStory = await storage.getLifeStory(personaId);
    const writingStyle = await storage.getWritingStyle(personaId);
    const familyMembersList = await storage.getFamilyMembers(personaId);

    // For shared Echoes, get heir list for multi-contributor prompt
    let heirsList: { name: string; relationship: string }[] = [];
    if (persona.isShared) {
      const heirs = await storage.getHeirsByPersona(personaId);
      heirsList = heirs.filter(h => h.status === "claimed").map(h => ({
        name: h.heirName || h.heirEmail,
        relationship: h.heirRelationship || "heir",
      }));
    }

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
        familyMembersList.map(fm => ({ name: fm.name, relationship: fm.relationship, birthYear: fm.birthYear, note: fm.note })),
        persona.isShared ? heirsList : undefined,
        persona.isShared ? (persona.creatorName || "the creator") : undefined,
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

    // Save assistant response (tagged with heir_user_id for privacy)
    const assistantMsg = await storage.addChatMessage({
      personaId,
      role: "assistant",
      content: reply,
      heirUserId: heirUserId,
    });

    // Increment message count for tier tracking
    if (access.isOwner) {
      await storage.incrementMessageCount(req.user!.id);
    }

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
    const result = await verifyPersonaAccess(req, res, "read");
    if (!result) return;
    const lifeStory = await storage.getLifeStory(result.persona.id);
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
  // ECHO HEIRS & TRANSFER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  // List heirs for a persona (only creator can see)
  app.get("/api/personas/:id/heirs", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    const heirs = await storage.getHeirsByPersona(persona.id);
    res.json(heirs);
  });

  // Add a new heir designation
  app.post("/api/personas/:id/heirs", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;

    const { email, name, relationship, accessLevel, personalMessage } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    // Tier limit check
    const user = await storage.getUserById(req.user!.id);
    if (user) {
      const plan = user.plan || "free";
      const limits = PLAN_LIMITS[plan];
      const currentCount = await storage.getHeirCountByPersona(persona.id);
      if (currentCount >= limits.heirs) {
        return res.status(403).json({
          error: `You've reached your heir limit (${limits.heirs}) on the ${plan} plan. Upgrade to add more heirs.`,
          code: "HEIR_LIMIT",
          currentCount,
          limit: limits.heirs,
          plan,
        });
      }
    }

    // Check for duplicate email
    const existingHeirs = await storage.getHeirsByPersona(persona.id);
    if (existingHeirs.some(h => h.heirEmail.toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({ error: "This email has already been designated as an heir" });
    }

    const claimToken = crypto.randomUUID();
    const heir = await storage.createHeir({
      personaId: persona.id,
      creatorUserId: req.user!.id,
      heirEmail: email.toLowerCase().trim(),
      heirName: name || null,
      heirRelationship: relationship || null,
      accessLevel: accessLevel === "read_only" ? "read_only" : "full",
      status: "pending",
      claimToken,
    });

    // Send invitation email
    const creatorName = user?.name || persona.creatorName || "Someone";
    sendHeirInvitationEmail(email, name, persona.name, creatorName, claimToken, personalMessage).catch(err =>
      console.error("Heir invitation email failed:", err)
    );

    res.status(201).json(heir);
  });

  // Update heir details
  app.put("/api/personas/:id/heirs/:heirId", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    const heirId = parseInt(req.params.heirId);
    const heir = await storage.getHeirById(heirId);
    if (!heir || heir.personaId !== persona.id) return res.status(404).json({ error: "Heir not found" });

    const { name, relationship, accessLevel } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.heirName = name;
    if (relationship !== undefined) updates.heirRelationship = relationship;
    if (accessLevel !== undefined) updates.accessLevel = accessLevel === "read_only" ? "read_only" : "full";

    const updated = await storage.updateHeir(heirId, updates);
    res.json(updated);
  });

  // Remove an heir (only if pending)
  app.delete("/api/personas/:id/heirs/:heirId", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    const heirId = parseInt(req.params.heirId);
    const heir = await storage.getHeirById(heirId);
    if (!heir || heir.personaId !== persona.id) return res.status(404).json({ error: "Heir not found" });
    if (heir.status !== "pending") return res.status(400).json({ error: "Can only remove pending heirs" });
    await storage.deleteHeir(heirId);
    res.json({ success: true });
  });

  // Get heir limits info
  app.get("/api/personas/:id/heirs/limits", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    const user = await storage.getUserById(req.user!.id);
    const plan = user?.plan || "free";
    const limits = PLAN_LIMITS[plan];
    const currentCount = await storage.getHeirCountByPersona(persona.id);
    res.json({ plan, limit: limits.heirs, current: currentCount, remaining: Math.max(0, limits.heirs - currentCount) });
  });

  // ── Transfer Management ─────────────────────────────────────────────────

  // Set up / update transfer settings
  app.post("/api/personas/:id/transfer", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;

    const { trigger, scheduledDate } = req.body as { trigger: string; scheduledDate?: string };
    if (!["manual", "scheduled", "on_passing"].includes(trigger)) {
      return res.status(400).json({ error: "Invalid trigger type" });
    }
    if (trigger === "scheduled" && !scheduledDate) {
      return res.status(400).json({ error: "Scheduled date is required for scheduled transfers" });
    }

    // Cancel any existing pending transfer
    const existing = await storage.getTransfersByPersona(persona.id);
    for (const t of existing.filter(t => t.status === "pending")) {
      await storage.updateTransfer(t.id, { status: "cancelled" });
    }

    const transfer = await storage.createTransfer({
      personaId: persona.id,
      transferTrigger: trigger,
      scheduledDate: scheduledDate || null,
      status: "pending",
    });

    res.status(201).json(transfer);
  });

  // Get transfer settings for a persona
  app.get("/api/personas/:id/transfer", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    const transfers = await storage.getTransfersByPersona(persona.id);
    const activeTransfer = transfers.find(t => t.status === "pending") || null;
    res.json({ transfer: activeTransfer, history: transfers });
  });

  // Execute a manual transfer now
  app.post("/api/personas/:id/transfer/execute", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;

    const heirs = await storage.getHeirsByPersona(persona.id);
    if (heirs.length === 0) return res.status(400).json({ error: "No heirs designated" });

    // Mark persona as shared
    await storage.updatePersona(persona.id, {
      isShared: true,
      originalCreatorId: persona.userId,
    } as any);

    // Update any pending transfer to executed
    const transfers = await storage.getTransfersByPersona(persona.id);
    for (const t of transfers.filter(t => t.status === "pending")) {
      await storage.updateTransfer(t.id, { status: "executed", executedAt: new Date() });
    }

    // If no transfer existed, create one for tracking
    if (!transfers.some(t => t.status === "pending")) {
      await storage.createTransfer({
        personaId: persona.id,
        transferTrigger: "manual",
        status: "executed",
        executedAt: new Date(),
      });
    }

    // Send transfer emails to all heirs
    for (const heir of heirs) {
      sendTransferExecutedEmail(heir.heirEmail, heir.heirName, persona.name, heir.claimToken).catch(err =>
        console.error(`Transfer email failed for heir ${heir.id}:`, err)
      );
    }

    // Deliver sealed-until-passing letters
    deliverSealedLetters(persona.id).catch(err =>
      console.error(`Sealed letter delivery failed for persona ${persona.id}:`, err)
    );

    res.json({ success: true, message: "Transfer executed" });
  });

  // Cancel a pending transfer
  app.post("/api/personas/:id/transfer/cancel", requireAuth, async (req, res) => {
    const persona = await verifyPersonaOwnership(req, res);
    if (!persona) return;
    const transfers = await storage.getTransfersByPersona(persona.id);
    for (const t of transfers.filter(t => t.status === "pending")) {
      await storage.updateTransfer(t.id, { status: "cancelled" });
    }
    res.json({ success: true });
  });

  // ── Heir Claim Flow ─────────────────────────────────────────────────────

  // Preview a claim (public — no auth required to see basic info)
  app.get("/api/heirs/claim/:token", async (req, res) => {
    const heir = await storage.getHeirByToken(req.params.token);
    if (!heir) return res.status(404).json({ error: "Invalid or expired claim link" });
    const persona = await storage.getPersona(heir.personaId);
    if (!persona) return res.status(404).json({ error: "Echo not found" });
    const creator = await storage.getUserById(heir.creatorUserId);
    res.json({
      heirId: heir.id,
      personaName: persona.name,
      personaRelationship: persona.relationship,
      personaAvatarUrl: (persona as any).avatarUrl,
      creatorName: creator?.name || persona.creatorName || "Someone",
      heirName: heir.heirName,
      heirEmail: heir.heirEmail,
      accessLevel: heir.accessLevel,
      status: heir.status,
    });
  });

  // Claim an inheritance (requires auth)
  app.post("/api/heirs/claim/:token", requireAuth, async (req, res) => {
    const heir = await storage.getHeirByToken(req.params.token);
    if (!heir) return res.status(404).json({ error: "Invalid or expired claim link" });
    if (heir.status === "claimed") return res.status(400).json({ error: "Already claimed" });
    if (heir.status === "declined") return res.status(400).json({ error: "This invitation was declined" });

    // Link heir to authenticated user.
    // SECURITY: Claiming records who accepted the invitation, but does NOT grant access.
    // Access is only granted after a transfer is executed (manual, scheduled, or on_passing).
    // The persona is marked isShared only when the transfer fires, not when an heir claims.
    await storage.updateHeir(heir.id, {
      heirUserId: req.user!.id,
      status: "claimed",
      claimedAt: new Date(),
    });

    const persona = await storage.getPersona(heir.personaId);

    // Notify creator and other heirs
    if (persona) {
      const claimerUser = await storage.getUserById(req.user!.id);
      const claimerName = claimerUser?.name || heir.heirName || "Someone";
      const creator = await storage.getUserById(heir.creatorUserId);
      if (creator) {
        sendHeirClaimedEmail(creator.email, creator.name, claimerName, heir.heirRelationship, persona.name).catch(err =>
          console.error("Heir claimed email to creator failed:", err)
        );
      }
      // Notify other claimed heirs
      const allHeirs = await storage.getHeirsByPersona(heir.personaId);
      for (const otherHeir of allHeirs) {
        if (otherHeir.id === heir.id || otherHeir.status !== "claimed" || !otherHeir.heirUserId) continue;
        const otherUser = await storage.getUserById(otherHeir.heirUserId);
        if (otherUser) {
          sendHeirClaimedEmail(otherUser.email, otherUser.name, claimerName, heir.heirRelationship, persona.name).catch(err =>
            console.error(`Heir claimed email to other heir ${otherHeir.id} failed:`, err)
          );
        }
      }
    }

    res.json({ success: true, personaId: heir.personaId });
  });

  // Decline an inheritance (requires auth)
  app.post("/api/heirs/claim/:token/decline", requireAuth, async (req, res) => {
    const heir = await storage.getHeirByToken(req.params.token);
    if (!heir) return res.status(404).json({ error: "Invalid or expired claim link" });
    if (heir.status !== "pending") return res.status(400).json({ error: "Can only decline pending invitations" });
    await storage.updateHeir(heir.id, { status: "declined", heirUserId: req.user!.id });
    res.json({ success: true });
  });

  // ── Forking ─────────────────────────────────────────────────────────────

  app.post("/api/personas/:id/fork", requireAuth, async (req, res) => {
    const personaId = parseInt(req.params.id);
    const access = await canAccessPersona(req.user!.id, personaId, "read");
    if (!access.allowed || !access.isHeir) {
      return res.status(403).json({ error: "Only heirs can fork an Echo" });
    }

    const persona = await storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });

    // Check the heir's own echo limit
    const user = await storage.getUserById(req.user!.id);
    if (user) {
      const plan = user.plan || "free";
      const limits = PLAN_LIMITS[plan];
      const existingPersonas = await storage.getPersonasByUser(user.id);
      if (existingPersonas.length >= limits.echoes) {
        return res.status(403).json({
          error: `You've reached your Echo limit (${limits.echoes}) on the ${plan} plan. Upgrade to fork.`,
          code: "ECHO_LIMIT",
        });
      }
    }

    // Create forked persona (copy all base fields)
    const forkedPersona = await storage.createPersona({
      userId: req.user!.id,
      name: persona.name,
      relationship: persona.relationship,
      birthYear: persona.birthYear,
      photo: persona.photo,
      bio: persona.bio,
      spouse: persona.spouse,
      children: persona.children,
      pronouns: persona.pronouns,
      birthPlace: (persona as any).birthPlace,
      avatarUrl: (persona as any).avatarUrl,
      selfMode: persona.selfMode,
      creatorName: persona.creatorName,
      creatorRelationship: persona.creatorRelationship,
      creatorNote: persona.creatorNote,
      deathYear: (persona as any).deathYear,
      remembranceDate: (persona as any).remembranceDate,
      passingDate: (persona as any).passingDate,
      isLiving: (persona as any).isLiving,
      isShared: false,
      originalCreatorId: persona.userId,
      parentPersonaId: persona.id,
      contributorUserId: req.user!.id,
      contributorRelationship: access.heir?.heirRelationship || "heir",
      perspectiveType: "other",
    } as any);

    // Copy traits
    const traits = await storage.getTraits(personaId);
    for (const trait of traits) {
      await storage.createTrait({
        personaId: forkedPersona.id,
        category: trait.category,
        content: trait.content,
        contributorUserId: trait.contributorUserId,
        contributorRelationship: trait.contributorRelationship,
        perspectiveType: trait.perspectiveType,
      });
    }

    // Copy memories (but NOT chat history)
    const memories = await storage.getMemories(personaId);
    for (const memory of memories) {
      await storage.createMemory({
        personaId: forkedPersona.id,
        type: memory.type,
        title: memory.title,
        content: memory.content,
        period: memory.period,
        tags: memory.tags,
        documentType: memory.documentType,
        contributedBy: memory.contributedBy,
        contributorCode: memory.contributorCode,
        contributorUserId: memory.contributorUserId,
        contributorRelationship: memory.contributorRelationship,
        perspectiveType: memory.perspectiveType,
      });
    }

    // Copy life story
    const lifeStory = await storage.getLifeStory(personaId);
    if (lifeStory) {
      await storage.upsertLifeStory(forkedPersona.id, {
        favoriteFood: lifeStory.favoriteFood,
        favoriteMusic: lifeStory.favoriteMusic,
        favoriteSmell: lifeStory.favoriteSmell,
        favoritePlace: lifeStory.favoritePlace,
        catchphrase: lifeStory.catchphrase,
        loveLanguage: lifeStory.loveLanguage,
        humor: lifeStory.humor,
        hardTimes: lifeStory.hardTimes,
        hometown: lifeStory.hometown,
        career: lifeStory.career,
        proudestMoment: lifeStory.proudestMoment,
        hardestPeriod: lifeStory.hardestPeriod,
        wishForFamily: lifeStory.wishForFamily,
        whatToRemember: lifeStory.whatToRemember,
        unfinshedBusiness: lifeStory.unfinshedBusiness,
        contributorUserId: lifeStory.contributorUserId,
        contributorRelationship: lifeStory.contributorRelationship,
        perspectiveType: lifeStory.perspectiveType,
      });
    }

    // Copy writing style
    const writingStyle = await storage.getWritingStyle(personaId);
    if (writingStyle) {
      await storage.upsertWritingStyle(forkedPersona.id, {
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
        contributorUserId: writingStyle.contributorUserId,
        contributorRelationship: writingStyle.contributorRelationship,
        perspectiveType: writingStyle.perspectiveType,
      });
    }

    // Copy family members
    const familyMems = await storage.getFamilyMembers(personaId);
    for (const fm of familyMems) {
      const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await storage.createFamilyMember({
        personaId: forkedPersona.id,
        name: fm.name,
        relationship: fm.relationship,
        accessCode,
        birthYear: fm.birthYear,
        note: fm.note,
        contributorUserId: fm.contributorUserId,
        contributorRelationship: fm.contributorRelationship,
        perspectiveType: fm.perspectiveType,
      });
    }

    res.status(201).json(forkedPersona);
  });

  // ── Scheduled Transfer Processor ────────────────────────────────────────

  app.post("/api/transfers/process-scheduled", async (req, res) => {
    const today = new Date().toISOString().split("T")[0];
    const results: { personaId: number; trigger: string; status: string }[] = [];

    // Process scheduled transfers
    const scheduledTransfers = await storage.getPendingScheduledTransfers(today);
    for (const transfer of scheduledTransfers) {
      try {
        const persona = await storage.getPersona(transfer.personaId);
        if (!persona) continue;

        await storage.updatePersona(transfer.personaId, {
          isShared: true,
          originalCreatorId: persona.userId,
        } as any);
        await storage.updateTransfer(transfer.id, { status: "executed", executedAt: new Date() });

        const heirs = await storage.getHeirsByPersona(transfer.personaId);
        for (const heir of heirs) {
          sendTransferExecutedEmail(heir.heirEmail, heir.heirName, persona.name, heir.claimToken).catch(err =>
            console.error(`Scheduled transfer email failed for heir ${heir.id}:`, err)
          );
        }
        deliverSealedLetters(transfer.personaId).catch(err =>
          console.error(`Sealed letter delivery failed for persona ${transfer.personaId}:`, err)
        );
        results.push({ personaId: transfer.personaId, trigger: "scheduled", status: "executed" });
      } catch (e) {
        console.error(`Scheduled transfer failed for persona ${transfer.personaId}:`, e);
        results.push({ personaId: transfer.personaId, trigger: "scheduled", status: "failed" });
      }
    }

    // Process on-passing transfers
    const onPassingTransfers = await storage.getPendingOnPassingTransfers();
    for (const transfer of onPassingTransfers) {
      try {
        const persona = await storage.getPersona(transfer.personaId);
        if (!persona) continue;
        // Check if persona has passing date and is marked as not living
        if (!(persona as any).isLiving && (persona as any).passingDate) {
          const passingDate = (persona as any).passingDate;
          if (passingDate <= today) {
            await storage.updatePersona(transfer.personaId, {
              isShared: true,
              originalCreatorId: persona.userId,
            } as any);
            await storage.updateTransfer(transfer.id, { status: "executed", executedAt: new Date() });

            const heirs = await storage.getHeirsByPersona(transfer.personaId);
            for (const heir of heirs) {
              sendTransferExecutedEmail(heir.heirEmail, heir.heirName, persona.name, heir.claimToken).catch(err =>
                console.error(`On-passing transfer email failed for heir ${heir.id}:`, err)
              );
            }
            deliverSealedLetters(transfer.personaId).catch(err =>
              console.error(`Sealed letter delivery failed for persona ${transfer.personaId}:`, err)
            );
            results.push({ personaId: transfer.personaId, trigger: "on_passing", status: "executed" });
          }
        }
      } catch (e) {
        console.error(`On-passing transfer failed for persona ${transfer.personaId}:`, e);
        results.push({ personaId: transfer.personaId, trigger: "on_passing", status: "failed" });
      }
    }

    res.json({ processed: results.length, results });
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
  // JOURNAL
  // ═══════════════════════════════════════════════════════════════════════════

  // Create journal entry
  app.post("/api/journal", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const { title, content, entryDate, mood, includedInEcho, echoPersonaId } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }

    const today = new Date().toISOString().split("T")[0];
    const entry = await storage.createJournalEntry({
      userId,
      title: title || null,
      content: content.trim(),
      entryDate: entryDate || today,
      mood: mood || null,
      includedInEcho: !!includedInEcho,
      echoPersonaId: echoPersonaId || null,
      linkedMemoryId: null,
      reflectionCount: 0,
      aiReflections: null,
    });

    // If included in Echo, create a linked memory
    if (includedInEcho && echoPersonaId) {
      const persona = await storage.getPersona(echoPersonaId);
      if (persona && persona.userId === userId) {
        const memory = await storage.createMemory({
          personaId: echoPersonaId,
          type: "document",
          title: title || `Journal: ${entry.entryDate}`,
          content: content.trim(),
          period: null,
          tags: null,
          documentType: "voice",
          contributedBy: null,
          contributorCode: null,
          contributorUserId: userId,
          contributorRelationship: "self",
          perspectiveType: "self",
        });
        await storage.updateJournalEntry(entry.id, { linkedMemoryId: memory.id });
        entry.linkedMemoryId = memory.id;
      }
    }

    res.json(entry);
  });

  // List journal entries (paginated)
  app.get("/api/journal", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const entries = await storage.getJournalEntriesByUser(userId, limit, offset);
    const total = await storage.getJournalEntryCountByUser(userId);

    res.json({
      entries,
      pagination: { limit, offset, total, hasMore: offset + limit < total },
    });
  });

  // Journal stats
  app.get("/api/journal/stats", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const allEntries = await storage.getJournalEntriesByUser(userId, 10000, 0);
    const total = allEntries.length;
    const reflectionsThisMonth = await storage.getMonthlyReflectionCount(userId);

    // Calculate streak (consecutive days with entries, ending today or yesterday)
    let streak = 0;
    if (total > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dates = new Set(allEntries.map(e => e.entryDate));
      const todayStr = today.toISOString().split("T")[0];
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      // Start from today or yesterday
      let checkDate = new Date(today);
      if (!dates.has(todayStr) && dates.has(yesterdayStr)) {
        checkDate = new Date(yesterday);
      } else if (!dates.has(todayStr)) {
        streak = 0;
      }

      if (dates.has(checkDate.toISOString().split("T")[0])) {
        while (dates.has(checkDate.toISOString().split("T")[0])) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
    }

    // Entries this week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const weekStr = startOfWeek.toISOString().split("T")[0];
    const thisWeek = allEntries.filter(e => e.entryDate >= weekStr).length;

    // Entries this month
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisMonth = allEntries.filter(e => e.entryDate.startsWith(monthStr)).length;

    res.json({ total, streak, reflectionsThisMonth, thisWeek, thisMonth });
  });

  // Get user's owned personas (for Echo selection in journal)
  app.get("/api/journal/personas", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const personas = await storage.getPersonasByUser(userId);
    const active = personas.filter(p => p.status === "active");
    res.json(active.map(p => ({ id: p.id, name: p.name, selfMode: p.selfMode })));
  });

  // Get single journal entry
  app.get("/api/journal/:id", requireAuth, async (req, res) => {
    const entryId = parseInt(req.params.id);
    if (isNaN(entryId)) return res.status(400).json({ error: "Invalid entry ID" });

    const entry = await storage.getJournalEntryById(entryId);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    if (entry.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });

    res.json(entry);
  });

  // Update journal entry
  app.put("/api/journal/:id", requireAuth, async (req, res) => {
    const entryId = parseInt(req.params.id);
    if (isNaN(entryId)) return res.status(400).json({ error: "Invalid entry ID" });

    const entry = await storage.getJournalEntryById(entryId);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    if (entry.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });

    const userId = req.user!.id;
    const { title, content, entryDate, mood, includedInEcho, echoPersonaId } = req.body;

    const updateData: Partial<import("@shared/schema").InsertJournalEntry> = {};
    if (title !== undefined) updateData.title = title || null;
    if (content !== undefined) updateData.content = content.trim();
    if (entryDate !== undefined) updateData.entryDate = entryDate;
    if (mood !== undefined) updateData.mood = mood || null;
    if (includedInEcho !== undefined) updateData.includedInEcho = !!includedInEcho;
    if (echoPersonaId !== undefined) updateData.echoPersonaId = echoPersonaId || null;

    // Handle Echo inclusion changes
    const wasIncluded = entry.includedInEcho;
    const willBeIncluded = includedInEcho !== undefined ? !!includedInEcho : wasIncluded;
    const newPersonaId = echoPersonaId !== undefined ? echoPersonaId : entry.echoPersonaId;

    // Removed from Echo
    if (wasIncluded && !willBeIncluded && entry.linkedMemoryId) {
      await storage.deleteMemory(entry.linkedMemoryId);
      updateData.linkedMemoryId = null;
    }
    // Added to Echo (new)
    else if (!wasIncluded && willBeIncluded && newPersonaId) {
      const persona = await storage.getPersona(newPersonaId);
      if (persona && persona.userId === userId) {
        const finalContent = content !== undefined ? content.trim() : entry.content;
        const finalTitle = title !== undefined ? title : entry.title;
        const memory = await storage.createMemory({
          personaId: newPersonaId,
          type: "document",
          title: finalTitle || `Journal: ${entry.entryDate}`,
          content: finalContent,
          period: null,
          tags: null,
          documentType: "voice",
          contributedBy: null,
          contributorCode: null,
          contributorUserId: userId,
          contributorRelationship: "self",
          perspectiveType: "self",
        });
        updateData.linkedMemoryId = memory.id;
      }
    }
    // Still included — update the linked memory content
    else if (wasIncluded && willBeIncluded && entry.linkedMemoryId) {
      const memUpdate: Partial<import("@shared/schema").InsertMemory> = {};
      if (content !== undefined) memUpdate.content = content.trim();
      if (title !== undefined) memUpdate.title = title || `Journal: ${entry.entryDate}`;
      if (Object.keys(memUpdate).length > 0) {
        await storage.updateMemory(entry.linkedMemoryId, memUpdate);
      }
    }

    const updated = await storage.updateJournalEntry(entryId, updateData);
    res.json(updated);
  });

  // Delete journal entry
  app.delete("/api/journal/:id", requireAuth, async (req, res) => {
    const entryId = parseInt(req.params.id);
    if (isNaN(entryId)) return res.status(400).json({ error: "Invalid entry ID" });

    const entry = await storage.getJournalEntryById(entryId);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    if (entry.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });

    // Remove linked memory from Echo if exists
    if (entry.linkedMemoryId) {
      await storage.deleteMemory(entry.linkedMemoryId);
    }

    await storage.deleteJournalEntry(entryId);
    res.json({ success: true });
  });

  // AI Reflection on journal entry
  app.post("/api/journal/:id/reflect", requireAuth, async (req, res) => {
    const entryId = parseInt(req.params.id);
    if (isNaN(entryId)) return res.status(400).json({ error: "Invalid entry ID" });

    // AI feature gate
    const reflectPrefs = await storage.getUserPreferences(req.user!.id);
    if (!reflectPrefs.aiReflectionsEnabled) {
      return res.status(403).json({ error: "AI reflections are not enabled. Turn them on in Settings.", feature: "ai_reflections", settings_url: "/settings" });
    }

    const entry = await storage.getJournalEntryById(entryId);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    if (entry.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });

    const userId = req.user!.id;
    const user = await storage.getUserById(userId);
    const plan = user?.plan || "free";

    // Check tier limits for free users
    if (plan === "free") {
      const monthlyReflections = await storage.getMonthlyReflectionCount(userId);
      if (monthlyReflections >= 3) {
        return res.status(403).json({
          error: "You've used all 3 AI reflections this month. Upgrade for unlimited reflections.",
          code: "REFLECTION_LIMIT",
          used: monthlyReflections,
          limit: 3,
          plan,
        });
      }
    }

    if (!openai) {
      // Demo fallback
      const demoQuestions = [
        "What would make tomorrow feel different from today?",
        "What surprised you most about how you felt?",
        "If you could tell someone about this moment, who would it be and why?",
        "What part of this are you still turning over in your mind?",
        "What would you want to remember about today, a year from now?",
      ];
      const question = demoQuestions[Math.floor(Math.random() * demoQuestions.length)];

      // Save reflection
      const reflections = entry.aiReflections ? JSON.parse(entry.aiReflections) : [];
      reflections.push({ question, timestamp: new Date().toISOString() });
      await storage.updateJournalEntry(entryId, {
        reflectionCount: (entry.reflectionCount || 0) + 1,
        aiReflections: JSON.stringify(reflections),
      });

      return res.json({ question });
    }

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a gentle, thoughtful companion helping someone reflect on their journal entry. Ask ONE meaningful follow-up question that invites deeper introspection. Be warm, never clinical. Don't give advice. Don't be too heavy. Just help them think more deeply. Keep it to 1-2 sentences.",
          },
          {
            role: "user",
            content: `Here is my journal entry:\n\n${entry.content}`,
          },
        ],
        max_tokens: 150,
        temperature: 0.8,
      });

      const question = completion.choices[0]?.message?.content?.trim() || "What part of this feels most important to you right now?";

      // Save reflection
      const reflections = entry.aiReflections ? JSON.parse(entry.aiReflections) : [];
      reflections.push({ question, timestamp: new Date().toISOString() });
      await storage.updateJournalEntry(entryId, {
        reflectionCount: (entry.reflectionCount || 0) + 1,
        aiReflections: JSON.stringify(reflections),
      });

      res.json({ question });
    } catch (err) {
      console.error("AI reflection error:", err);
      res.status(500).json({ error: "Failed to generate reflection" });
    }
  });

  // ── Voice Journal: upload audio ──────────────────────────────────────────
  app.post("/api/journal/voice", requireAuth, audioUpload.single("file"), async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUserById(userId);
      const plan = user?.plan || "free";

      // Tier limit check
      const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
      if (limits.voiceEntries !== null) {
        const monthlyVoice = await storage.getMonthlyVoiceEntryCount(userId);
        if (monthlyVoice >= limits.voiceEntries) {
          // Clean up uploaded file
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(403).json({
            error: `You've used all ${limits.voiceEntries} voice entries this month. Upgrade for unlimited voice journaling.`,
            code: "VOICE_LIMIT",
            used: monthlyVoice,
            limit: limits.voiceEntries,
            plan,
          });
        }
      }

      if (!req.file) {
        return res.status(400).json({ error: "No audio file uploaded" });
      }

      // Move file to user-specific directory
      const userDir = path.join(process.cwd(), "uploads/journal-audio", String(userId));
      if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
      const finalPath = path.join(userDir, req.file.filename);
      fs.renameSync(req.file.path, finalPath);

      const audioUrl = `/uploads/journal-audio/${userId}/${req.file.filename}`;
      const durationSeconds = req.body.duration ? parseInt(req.body.duration) : null;
      const today = new Date().toISOString().split("T")[0];

      // Check voice transcription preference
      const voicePrefs = await storage.getUserPreferences(userId);
      const transcriptionEnabled = voicePrefs.aiVoiceTranscriptionEnabled;

      // Create entry — if transcription disabled, store audio without calling Whisper
      const entry = await storage.createJournalEntry({
        userId,
        title: req.body.title || null,
        content: transcriptionEnabled ? "(Transcribing...)" : "",
        entryDate: req.body.entryDate || today,
        mood: req.body.mood || null,
        includedInEcho: false,
        echoPersonaId: null,
        linkedMemoryId: null,
        reflectionCount: 0,
        aiReflections: null,
        audioUrl,
        audioDurationSeconds: durationSeconds,
        transcriptionStatus: transcriptionEnabled ? "pending" : "disabled",
        entryType: "voice",
      });

      // Return entry immediately, transcribe async
      res.json(entry);

      // Async transcription (only if AI transcription is enabled)
      if (openai && transcriptionEnabled) {
        try {
          const audioStream = fs.createReadStream(finalPath);
          const transcription = await openai.audio.transcriptions.create({
            model: "whisper-1",
            file: audioStream,
          });
          const transcript = transcription.text || "";
          await storage.updateJournalEntry(entry.id, {
            content: transcript,
            transcriptionStatus: "completed",
          });

          // If the user wanted to include in Echo (passed via body)
          if (req.body.includedInEcho === "true" && req.body.echoPersonaId) {
            const personaId = parseInt(req.body.echoPersonaId);
            const persona = await storage.getPersona(personaId);
            if (persona && persona.userId === userId && transcript.trim()) {
              const memory = await storage.createMemory({
                personaId,
                type: "document",
                title: req.body.title || `Voice Journal: ${entry.entryDate}`,
                content: transcript.trim(),
                period: null,
                tags: null,
                documentType: "voice",
                contributedBy: null,
                contributorCode: null,
                contributorUserId: userId,
                contributorRelationship: "self",
                perspectiveType: "self",
              });
              await storage.updateJournalEntry(entry.id, {
                includedInEcho: true,
                echoPersonaId: personaId,
                linkedMemoryId: memory.id,
              });
            }
          }
        } catch (err) {
          console.error("Whisper transcription error:", err);
          await storage.updateJournalEntry(entry.id, {
            content: "(Transcription failed)",
            transcriptionStatus: "failed",
          });
        }
      } else {
        // No OpenAI client — mark as failed
        await storage.updateJournalEntry(entry.id, {
          content: "(Transcription unavailable — OpenAI not configured)",
          transcriptionStatus: "failed",
        });
      }
    } catch (err: any) {
      console.error("Voice upload error:", err);
      res.status(500).json({ error: err.message || "Voice upload failed" });
    }
  });

  // ── Voice Journal: serve audio file ──────────────────────────────────────
  app.get("/api/journal/audio/:entryId", requireAuth, async (req, res) => {
    const entryId = parseInt(req.params.entryId);
    if (isNaN(entryId)) return res.status(400).json({ error: "Invalid entry ID" });

    const entry = await storage.getJournalEntryById(entryId);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    if (entry.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });
    if (!entry.audioUrl) return res.status(404).json({ error: "No audio for this entry" });

    const filePath = path.join(process.cwd(), entry.audioUrl);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Audio file not found" });

    res.sendFile(filePath);
  });

  // ── Voice Journal: retranscribe ──────────────────────────────────────────
  app.post("/api/journal/:id/retranscribe", requireAuth, async (req, res) => {
    const entryId = parseInt(req.params.id);
    if (isNaN(entryId)) return res.status(400).json({ error: "Invalid entry ID" });

    // AI feature gate
    const retransPrefs = await storage.getUserPreferences(req.user!.id);
    if (!retransPrefs.aiVoiceTranscriptionEnabled) {
      return res.status(403).json({ error: "Voice transcription is not enabled. Turn it on in Settings.", feature: "ai_voice_transcription", settings_url: "/settings" });
    }

    const entry = await storage.getJournalEntryById(entryId);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    if (entry.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });
    if (!entry.audioUrl) return res.status(400).json({ error: "No audio file to transcribe" });
    if (!openai) return res.status(503).json({ error: "Transcription service not available" });

    const filePath = path.join(process.cwd(), entry.audioUrl);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Audio file not found" });

    await storage.updateJournalEntry(entryId, { transcriptionStatus: "pending" });

    try {
      const audioStream = fs.createReadStream(filePath);
      const transcription = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file: audioStream,
      });
      const transcript = transcription.text || "";
      const updated = await storage.updateJournalEntry(entryId, {
        content: transcript,
        transcriptionStatus: "completed",
      });

      // Update linked memory if exists
      if (entry.linkedMemoryId && transcript.trim()) {
        await storage.updateMemory(entry.linkedMemoryId, { content: transcript.trim() });
      }

      res.json(updated);
    } catch (err) {
      console.error("Retranscribe error:", err);
      await storage.updateJournalEntry(entryId, { transcriptionStatus: "failed" });
      res.status(500).json({ error: "Retranscription failed" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LETTERS TO THE FUTURE
  // ═══════════════════════════════════════════════════════════════════════════

  // Create letter
  app.post("/api/letters", requireAuth, async (req, res) => {
    try {
      const { title, content, recipientType, recipientUserId, recipientHeirId, recipientName, recipientEmail, deliverAt,
              personaId, deliveryRuleType, deliveryMilestone, recurring, isSealed } = req.body;

      const ruleType = deliveryRuleType || "date";
      const validRuleTypes = ["date", "milestone", "sealed_until_passing", "browsable_anytime"];
      if (!validRuleTypes.includes(ruleType)) {
        return res.status(400).json({ error: `deliveryRuleType must be one of: ${validRuleTypes.join(", ")}` });
      }

      if (!title || !content || !recipientType) {
        return res.status(400).json({ error: "title, content, and recipientType are required" });
      }

      // deliverAt required for date-based; for browsable/milestone/sealed we use a far-future placeholder
      let deliverDate: Date;
      if (ruleType === "date" && deliverAt) {
        deliverDate = new Date(deliverAt);
        if (isNaN(deliverDate.getTime())) return res.status(400).json({ error: "Invalid deliverAt date" });
        if (deliverDate <= new Date()) return res.status(400).json({ error: "deliverAt must be in the future" });
        const maxDate = new Date(); maxDate.setFullYear(maxDate.getFullYear() + 100);
        if (deliverDate > maxDate) return res.status(400).json({ error: "deliverAt cannot be more than 100 years in the future" });
      } else if (ruleType === "date") {
        return res.status(400).json({ error: "deliverAt is required for date delivery rule" });
      } else {
        // Non-date rules: set a placeholder far-future date
        deliverDate = new Date("2099-12-31T00:00:00Z");
      }

      if (!["self", "heir", "custom_email"].includes(recipientType)) {
        return res.status(400).json({ error: "recipientType must be 'self', 'heir', or 'custom_email'" });
      }

      if (ruleType === "milestone" && !deliveryMilestone) {
        return res.status(400).json({ error: "deliveryMilestone is required when deliveryRuleType is 'milestone'" });
      }

      // Verify persona ownership if personaId provided
      if (personaId) {
        const persona = await storage.getPersona(personaId);
        if (!persona || persona.userId !== req.user!.id) {
          return res.status(403).json({ error: "Not authorized for this persona" });
        }
      }

      // Resolve recipient email for self
      let resolvedEmail = recipientEmail || null;
      let resolvedUserId = recipientUserId || null;
      if (recipientType === "self") {
        const user = await storage.getUserById(req.user!.id);
        resolvedEmail = user?.email || null;
        resolvedUserId = req.user!.id;
      } else if (recipientType === "heir" && recipientHeirId) {
        const heir = await storage.getHeirById(recipientHeirId);
        if (heir) {
          resolvedEmail = heir.heirEmail;
          resolvedUserId = heir.heirUserId || null;
        }
      }

      // For browsable_anytime, mark as delivered immediately
      const status = ruleType === "browsable_anytime" ? "delivered" : "scheduled";

      const letter = await storage.createFutureLetter({
        userId: req.user!.id,
        title,
        content,
        recipientType,
        recipientUserId: resolvedUserId,
        recipientHeirId: recipientHeirId || null,
        recipientName: recipientName || null,
        recipientEmail: resolvedEmail,
        deliverAt: deliverDate,
        deliveredAt: status === "delivered" ? new Date() : null,
        status,
        personaId: personaId || null,
        deliveryRuleType: ruleType,
        deliveryMilestone: deliveryMilestone || null,
        recurring: recurring || false,
        isSealed: isSealed || false,
      });

      res.status(201).json(letter);
    } catch (err) {
      console.error("Create letter error:", err);
      res.status(500).json({ error: "Failed to create letter" });
    }
  });

  // List user's letters
  app.get("/api/letters", requireAuth, async (req, res) => {
    const letters = await storage.getFutureLettersByUser(req.user!.id);
    res.json(letters);
  });

  // Get letters inbox (delivered to current user)
  app.get("/api/letters/inbox", requireAuth, async (req, res) => {
    const letters = await storage.getLettersInbox(req.user!.id);
    res.json(letters);
  });

  // Get single letter
  app.get("/api/letters/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid letter ID" });

    const letter = await storage.getFutureLetterById(id);
    if (!letter) return res.status(404).json({ error: "Letter not found" });

    // Author can always see their letters; recipients can see after delivery
    const isAuthor = letter.userId === req.user!.id;
    const isRecipient = letter.recipientUserId === req.user!.id;
    const user = await storage.getUserById(req.user!.id);
    const isEmailRecipient = user?.email && letter.recipientEmail?.toLowerCase() === user.email.toLowerCase();

    if (!isAuthor && !(isRecipient || isEmailRecipient)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Recipients can only see delivered letters
    if (!isAuthor && letter.status !== "delivered") {
      return res.status(403).json({ error: "Letter not yet delivered" });
    }

    res.json(letter);
  });

  // Update letter (only while scheduled)
  app.put("/api/letters/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid letter ID" });

    const letter = await storage.getFutureLetterById(id);
    if (!letter) return res.status(404).json({ error: "Letter not found" });
    if (letter.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });
    if (letter.status !== "scheduled") return res.status(400).json({ error: "Can only edit scheduled letters" });

    const { title, content, recipientType, recipientUserId, recipientHeirId, recipientName, recipientEmail, deliverAt } = req.body;

    if (deliverAt) {
      const deliverDate = new Date(deliverAt);
      if (isNaN(deliverDate.getTime())) return res.status(400).json({ error: "Invalid deliverAt date" });
      if (deliverDate <= new Date()) return res.status(400).json({ error: "deliverAt must be in the future" });
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() + 100);
      if (deliverDate > maxDate) return res.status(400).json({ error: "deliverAt cannot be more than 100 years in the future" });
    }

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (recipientType !== undefined) updates.recipientType = recipientType;
    if (recipientUserId !== undefined) updates.recipientUserId = recipientUserId;
    if (recipientHeirId !== undefined) updates.recipientHeirId = recipientHeirId;
    if (recipientName !== undefined) updates.recipientName = recipientName;
    if (recipientEmail !== undefined) updates.recipientEmail = recipientEmail;
    if (deliverAt !== undefined) updates.deliverAt = new Date(deliverAt);

    // Re-resolve email for self type
    if (updates.recipientType === "self" || (!updates.recipientType && letter.recipientType === "self")) {
      const user = await storage.getUserById(req.user!.id);
      updates.recipientEmail = user?.email || null;
      updates.recipientUserId = req.user!.id;
    }

    const updated = await storage.updateFutureLetter(id, updates);
    res.json(updated);
  });

  // Cancel/delete letter (only while scheduled)
  app.delete("/api/letters/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid letter ID" });

    const letter = await storage.getFutureLetterById(id);
    if (!letter) return res.status(404).json({ error: "Letter not found" });
    if (letter.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });
    if (letter.status !== "scheduled") return res.status(400).json({ error: "Can only cancel scheduled letters" });

    await storage.updateFutureLetter(id, { status: "cancelled" } as any);
    res.json({ success: true });
  });

  // Get unread notification count for letters
  app.get("/api/letters/notifications/unread", requireAuth, async (req, res) => {
    const count = await storage.getUnreadNotificationCount(req.user!.id);
    res.json({ count });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHOTO MEMORIES
  // ═══════════════════════════════════════════════════════════════════════════

  // Configure multer for photo memory uploads (jpg/png/webp, max 10MB)
  const photoUploadDir = path.join(process.cwd(), "uploads/photo-memories");
  if (!fs.existsSync(photoUploadDir)) fs.mkdirSync(photoUploadDir, { recursive: true });

  const photoUpload = multer({
    storage: multer.diskStorage({
      destination: (req: any, _file: any, cb: any) => {
        const userId = req.user?.id || "unknown";
        const userDir = path.join(photoUploadDir, String(userId));
        if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
        cb(null, userDir);
      },
      filename: (_req: any, file: any, cb: any) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${unique}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => {
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error("Only jpg, png, and webp images are allowed"));
    },
  });

  // POST /api/photo-memories — upload photo, generate AI questions
  app.post("/api/photo-memories", requireAuth, photoUpload.single("photo"), async (req, res) => {
    const userId = req.user!.id;
    const personaId = parseInt(req.body.personaId);
    if (isNaN(personaId)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "personaId is required" });
    }

    // Verify persona ownership
    const persona = await storage.getPersona(personaId);
    if (!persona || persona.userId !== userId) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: "Not authorized" });
    }

    if (!req.file) return res.status(400).json({ error: "No photo uploaded" });

    // Tier limit check (free = 3 lifetime)
    const user = await storage.getUserById(userId);
    const plan = user?.plan || "free";
    const limits = PLAN_LIMITS[plan];
    if (limits.photoMemories !== null) {
      const count = await storage.getPhotoMemoryCountByUser(userId);
      if (count >= limits.photoMemories) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({
          error: `Photo memory limit (${limits.photoMemories}) reached on the ${plan} plan. Upgrade to create more.`,
          code: "PHOTO_MEMORY_LIMIT",
          current: count,
          limit: limits.photoMemories,
          plan,
        });
      }
    }

    const photoUrl = `/uploads/photo-memories/${userId}/${req.file.filename}`;

    // Check AI photo prompts preference
    const photoPrefs = await storage.getUserPreferences(userId);
    const aiPhotoEnabled = photoPrefs.aiPhotoPromptsEnabled;

    // Generate AI questions from the photo (only if AI photo prompts are enabled)
    let aiPrompts: string[] = [];
    try {
      if (openai && aiPhotoEnabled) {
        const imageBuffer = fs.readFileSync(req.file.path);
        const base64 = imageBuffer.toString("base64");
        const mimeType = req.file.mimetype || "image/jpeg";

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{
            role: "user",
            content: [
              {
                type: "text",
                text: "Look at this photo. The user wants to preserve memories about it. Generate 4-5 thoughtful, open-ended questions that would help them describe what was happening, who's in it, and why it's meaningful. Avoid yes/no questions. Return a JSON object with a \"questions\" key containing an array of question strings.",
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
            ],
          }],
          response_format: { type: "json_object" },
          max_tokens: 500,
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          aiPrompts = parsed.questions || parsed.prompts || [];
        }
      }
    } catch (err) {
      console.error("Vision API error:", err);
    }

    // Fallback questions if AI didn't work or wasn't enabled
    if (aiPrompts.length === 0) {
      aiPrompts = [
        "What was happening when this photo was taken?",
        "Who is in this photo and what is your relationship to them?",
        "What emotions does this photo bring up for you?",
        "Why is this moment meaningful to you?",
        "What details in this photo stand out most to you?",
      ];
    }

    const photoMemory = await storage.createPhotoMemory({
      userId,
      personaId,
      photoUrl,
      aiPrompts,
      userResponses: null,
      status: "draft",
      linkedMemoryId: null,
    });

    res.status(201).json(photoMemory);
  });

  // GET /api/photo-memories/limits — tier limit info (must be before /:id)
  app.get("/api/photo-memories/limits", requireAuth, async (req, res) => {
    const user = await storage.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const plan = user.plan || "free";
    const limits = PLAN_LIMITS[plan];
    const count = await storage.getPhotoMemoryCountByUser(user.id);
    res.json({
      plan,
      limit: limits.photoMemories,
      current: count,
      remaining: limits.photoMemories === null ? null : Math.max(0, limits.photoMemories - count),
    });
  });

  // PUT /api/photo-memories/:id — save responses & complete
  app.put("/api/photo-memories/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const photoMemory = await storage.getPhotoMemoryById(id);
    if (!photoMemory) return res.status(404).json({ error: "Not found" });
    if (photoMemory.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });

    const { userResponses, status } = req.body;
    const updates: Record<string, unknown> = {};
    if (userResponses !== undefined) updates.userResponses = userResponses;

    if (status === "complete") {
      updates.status = "complete";

      // Create a linked memory document for the persona
      const responses = userResponses || photoMemory.userResponses || [];
      const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      let memoryContent = `Photo memory — ${date}\n[photo attached: ${photoMemory.photoUrl}]\n\n`;
      for (const r of responses as Array<{ question: string; answer: string }>) {
        if (r.question && r.answer) {
          memoryContent += `Q: ${r.question}\nA: ${r.answer}\n\n`;
        }
      }

      const memory = await storage.createMemory({
        personaId: photoMemory.personaId,
        type: "document",
        title: `Photo memory — ${date}`,
        content: memoryContent.trim(),
        period: "general",
        tags: null,
        documentType: "character",
        contributorUserId: req.user!.id,
        contributorRelationship: "creator",
        perspectiveType: "self",
      });

      updates.linkedMemoryId = memory.id;
    }

    const updated = await storage.updatePhotoMemory(id, updates as any);
    res.json(updated);
  });

  // GET /api/photo-memories — list user's photo memories (with optional persona filter)
  app.get("/api/photo-memories", requireAuth, async (req, res) => {
    const all = await storage.getPhotoMemoriesByUser(req.user!.id);
    const personaId = req.query.personaId ? parseInt(req.query.personaId as string) : null;
    const filtered = personaId ? all.filter(pm => pm.personaId === personaId) : all;
    res.json(filtered);
  });

  // GET /api/photo-memories/:id — single photo memory
  app.get("/api/photo-memories/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const pm = await storage.getPhotoMemoryById(id);
    if (!pm) return res.status(404).json({ error: "Not found" });
    if (pm.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });
    res.json(pm);
  });

  // GET /api/photo-memories/photo/:id — serve photo with auth
  app.get("/api/photo-memories/photo/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const pm = await storage.getPhotoMemoryById(id);
    if (!pm) return res.status(404).json({ error: "Not found" });
    if (pm.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });

    const filePath = path.join(process.cwd(), pm.photoUrl);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Photo file not found" });
    res.sendFile(filePath);
  });

  // DELETE /api/photo-memories/:id — delete photo memory (and linked memory doc)
  app.delete("/api/photo-memories/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const pm = await storage.getPhotoMemoryById(id);
    if (!pm) return res.status(404).json({ error: "Not found" });
    if (pm.userId !== req.user!.id) return res.status(403).json({ error: "Not authorized" });

    // Delete linked memory document if exists
    if (pm.linkedMemoryId) {
      await storage.deleteMemory(pm.linkedMemoryId);
    }

    // Delete photo file
    const filePath = path.join(process.cwd(), pm.photoUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await storage.deletePhotoMemory(id);
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // THE FOLDER
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/personas/:id/folder — aggregated folder contents
  app.get("/api/personas/:id/folder", requireAuth, async (req, res) => {
    const result = await verifyPersonaAccess(req, res, "read");
    if (!result) return;
    const { persona } = result;

    const [letters, storiesList, documents, photoMems] = await Promise.all([
      storage.getLettersByPersona(persona.id),
      storage.getStoriesByPersona(persona.id),
      storage.getMemories(persona.id),
      storage.getPhotoMemoriesByPersona(persona.id),
    ]);

    // Build unified timeline with type discriminators
    const timeline: any[] = [
      ...letters.map(l => ({ ...l, _type: "letter", _sortDate: l.createdAt })),
      ...storiesList.map(s => ({ ...s, _type: "story", _sortDate: s.createdAt })),
      ...documents.filter(d => d.type === "document").map(d => ({ ...d, _type: "document", _sortDate: d.createdAt })),
      ...photoMems.map(p => ({ ...p, _type: "photo", _sortDate: p.createdAt })),
    ].sort((a, b) => {
      const da = new Date(b._sortDate || 0).getTime();
      const db2 = new Date(a._sortDate || 0).getTime();
      return da - db2;
    });

    res.json({
      persona,
      letters,
      stories: storiesList,
      documents: documents.filter(d => d.type === "document"),
      photos: photoMems,
      timeline,
    });
  });

  // POST /api/personas/:id/letters — convenience: create letter with persona_id pre-set
  app.post("/api/personas/:id/letters", requireAuth, async (req, res) => {
    const result = await verifyPersonaAccess(req, res, "write");
    if (!result) return;
    // Inject personaId into body and forward to the main letters endpoint
    req.body.personaId = result.persona.id;
    req.body.recipientType = req.body.recipientType || "self";
    // Call the same logic as POST /api/letters
    try {
      const { title, content, recipientType, deliverAt,
              deliveryRuleType, deliveryMilestone, recurring, isSealed } = req.body;
      const ruleType = deliveryRuleType || "browsable_anytime";
      const validRuleTypes = ["date", "milestone", "sealed_until_passing", "browsable_anytime"];
      if (!validRuleTypes.includes(ruleType)) {
        return res.status(400).json({ error: `deliveryRuleType must be one of: ${validRuleTypes.join(", ")}` });
      }
      if (!title || !content) {
        return res.status(400).json({ error: "title and content are required" });
      }
      let deliverDate: Date;
      if (ruleType === "date" && deliverAt) {
        deliverDate = new Date(deliverAt);
        if (isNaN(deliverDate.getTime())) return res.status(400).json({ error: "Invalid deliverAt date" });
        if (deliverDate <= new Date()) return res.status(400).json({ error: "deliverAt must be in the future" });
      } else if (ruleType === "date") {
        return res.status(400).json({ error: "deliverAt is required for date delivery rule" });
      } else {
        deliverDate = new Date("2099-12-31T00:00:00Z");
      }
      if (ruleType === "milestone" && !deliveryMilestone) {
        return res.status(400).json({ error: "deliveryMilestone is required for milestone delivery rule" });
      }
      const user = await storage.getUserById(req.user!.id);
      const status = ruleType === "browsable_anytime" ? "delivered" : "scheduled";
      const letter = await storage.createFutureLetter({
        userId: req.user!.id,
        title,
        content,
        recipientType: recipientType || "self",
        recipientUserId: req.user!.id,
        recipientHeirId: null,
        recipientName: user?.name || null,
        recipientEmail: user?.email || null,
        deliverAt: deliverDate,
        deliveredAt: status === "delivered" ? new Date() : null,
        status,
        personaId: result.persona.id,
        deliveryRuleType: ruleType,
        deliveryMilestone: deliveryMilestone || null,
        recurring: recurring || false,
        isSealed: isSealed || false,
      });
      res.status(201).json(letter);
    } catch (err) {
      console.error("Create persona letter error:", err);
      res.status(500).json({ error: "Failed to create letter" });
    }
  });

  // ── Stories ─────────────────────────────────────────────────────────────
  app.post("/api/personas/:id/stories", requireAuth, async (req, res) => {
    const result = await verifyPersonaAccess(req, res, "write");
    if (!result) return;
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: "title and content are required" });
    const story = await storage.createStory({
      userId: req.user!.id,
      personaId: result.persona.id,
      title,
      content,
    });
    res.status(201).json(story);
  });

  app.get("/api/personas/:id/stories", requireAuth, async (req, res) => {
    const result = await verifyPersonaAccess(req, res, "read");
    if (!result) return;
    const storiesList = await storage.getStoriesByPersona(result.persona.id);
    res.json(storiesList);
  });

  app.get("/api/stories/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid story ID" });
    const story = await storage.getStoryById(id);
    if (!story) return res.status(404).json({ error: "Story not found" });
    // Check access: author or heir with access to the persona
    if (story.userId !== req.user!.id) {
      const access = await canAccessPersona(req.user!.id, story.personaId, "read");
      if (!access.allowed) return res.status(403).json({ error: "Not authorized" });
    }
    res.json(story);
  });

  app.put("/api/stories/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid story ID" });
    const story = await storage.getStoryById(id);
    if (!story) return res.status(404).json({ error: "Story not found" });
    if (story.userId !== req.user!.id) return res.status(403).json({ error: "Only the author can edit" });
    const { title, content } = req.body;
    const updated = await storage.updateStory(id, { title, content });
    res.json(updated);
  });

  app.delete("/api/stories/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid story ID" });
    const story = await storage.getStoryById(id);
    if (!story) return res.status(404).json({ error: "Story not found" });
    if (story.userId !== req.user!.id) return res.status(403).json({ error: "Only the author can delete" });
    await storage.deleteStory(id);
    res.json({ success: true });
  });

  // ── Milestones Observed ─────────────────────────────────────────────────
  app.post("/api/milestones", requireAuth, async (req, res) => {
    try {
      const { milestoneType, personaId, note } = req.body;
      if (!milestoneType) return res.status(400).json({ error: "milestoneType is required" });

      const observed = await storage.createMilestoneObserved({
        userId: req.user!.id,
        personaId: personaId || null,
        milestoneType,
        note: note || null,
      });

      // Find and deliver milestone-bound letters
      // Look across all personas where this user is an heir
      const heirs = await storage.getHeirsByUserId(req.user!.id);
      let deliveredCount = 0;
      for (const heir of heirs) {
        if (heir.status !== "claimed") continue;
        const transfers = await storage.getTransfersByPersona(heir.personaId);
        const hasExecutedTransfer = transfers.some(t => t.status === "executed");
        if (!hasExecutedTransfer) continue;

        const matchingLetters = await storage.getLettersByMilestone(heir.personaId, milestoneType);
        for (const letter of matchingLetters) {
          const author = await storage.getUserById(letter.userId);
          const authorName = author?.name || "Someone";

          // Send email if recipient has email
          if (letter.recipientEmail) {
            await sendLetterDeliveryEmail(
              letter.recipientEmail, letter.recipientName, authorName,
              letter.title, letter.content, letter.createdAt || new Date(), letter.id,
            );
          }

          // In-app notification
          await storage.createNotification({
            userId: req.user!.id,
            type: "letter_delivered",
            title: `A letter from ${authorName} has arrived — for your ${milestoneType}`,
            message: letter.title,
            referenceId: letter.id,
            read: false,
          });

          await storage.updateFutureLetter(letter.id, { status: "delivered", deliveredAt: new Date() } as any);
          deliveredCount++;
        }
      }

      // Also check if personaId was provided directly (for persona owner marking milestones)
      if (personaId) {
        const matchingLetters = await storage.getLettersByMilestone(personaId, milestoneType);
        for (const letter of matchingLetters) {
          if (letter.status !== "scheduled") continue;
          const author = await storage.getUserById(letter.userId);
          const authorName = author?.name || "Someone";
          const recipientId = letter.recipientUserId || letter.userId;

          if (letter.recipientEmail) {
            await sendLetterDeliveryEmail(
              letter.recipientEmail, letter.recipientName, authorName,
              letter.title, letter.content, letter.createdAt || new Date(), letter.id,
            );
          }

          await storage.createNotification({
            userId: recipientId,
            type: "letter_delivered",
            title: `A letter from ${authorName} has arrived — for your ${milestoneType}`,
            message: letter.title,
            referenceId: letter.id,
            read: false,
          });

          await storage.updateFutureLetter(letter.id, { status: "delivered", deliveredAt: new Date() } as any);
          deliveredCount++;
        }
      }

      res.status(201).json({ observed, deliveredLetters: deliveredCount });
    } catch (err) {
      console.error("Create milestone observed error:", err);
      res.status(500).json({ error: "Failed to record milestone" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONA SUMMARY (all data in one request)
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/summary", requireAuth, async (req, res) => {
    const result = await verifyPersonaAccess(req, res, "read");
    if (!result) return;
    const { persona } = result;

    const traits = await storage.getTraits(persona.id);
    const memories = await storage.getMemories(persona.id);
    const mediaList = await storage.getMedia(persona.id);

    res.json({ persona, traits, memories, media: mediaList });
  });

  return httpServer;
}
