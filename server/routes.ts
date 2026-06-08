import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import bcrypt from "bcryptjs";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import {
  insertPersonaSchema,
  insertTraitSchema,
  insertMemorySchema,
  insertChatMessageSchema,
} from "@shared/schema";
import { z } from "zod";
import type { User } from "@shared/schema";

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
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log("OpenAI client ready");
  } else {
    console.warn("OPENAI_API_KEY not set — chat will use demo responses");
  }
} catch (_e) {
  console.warn("OpenAI init failed — chat will use demo responses");
}

// ── Build AI system prompt from persona data ──────────────────────────────────
function buildSystemPrompt(
  personaId: number,
  personaName: string,
  relationship: string,
  bio: string | null,
  traits: { category: string; content: string }[],
  memories: { type: string; title: string | null; content: string; period: string | null }[],
  persona?: { spouse?: string | null; children?: string | null; pronouns?: string | null; birthPlace?: string | null; selfMode?: boolean | null; creatorName?: string | null; creatorRelationship?: string | null; creatorNote?: string | null },
  lifeStory?: {
    favoriteFood?: string | null; favoriteMusic?: string | null; favoriteSmell?: string | null;
    favoritePlace?: string | null; catchphrase?: string | null; loveLanguage?: string | null;
    humor?: string | null; hardTimes?: string | null; hometown?: string | null;
    career?: string | null; proudestMoment?: string | null; hardestPeriod?: string | null;
    wishForFamily?: string | null; whatToRemember?: string | null; unfinshedBusiness?: string | null;
  } | null
): string {
  const traitsByCategory: Record<string, string[]> = {};
  traits.forEach(t => {
    if (!traitsByCategory[t.category]) traitsByCategory[t.category] = [];
    traitsByCategory[t.category].push(t.content);
  });

  const traitText = Object.entries(traitsByCategory)
    .map(([cat, items]) => `${cat.toUpperCase()}: ${items.join("; ")}`)
    .join("\n");

  // Separate documents from regular memories — documents get much more space
  const documents = memories.filter(m => m.type === "document");
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

  // Documents get up to 3000 chars each, up to 3 documents
  const documentText = documents
    .slice(0, 3)
    .map(m => `[DOCUMENT${m.title ? ` – "${m.title}"` : ""}]\n${m.content.slice(0, 3000)}`)
    .join("\n\n");

  // Family context
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

${bio ? `ABOUT YOU:\n${bio}\n${birthPlaceText}\n` : birthPlaceText}${creatorContext}${familyText ? `YOUR FAMILY:\n${familyText}\n` : ""}YOUR PERSONALITY AND VALUES:\n${traitText || "Warm, loving, and thoughtful."}

${lifeStoryText}YOUR MEMORIES AND STORIES:\n${memoryText || "You have many cherished memories with your family."}${documentText ? `\n\nDOCUMENTS AND WRITINGS:\nThe following are writings, narratives, or documents that capture who you are. Draw on these richly in conversation:\n\n${documentText}` : ""}

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

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // SESSION & PASSPORT SETUP
  const MemStore = MemoryStore(session);
  app.use(session({
    secret: process.env.SESSION_SECRET || "echome-secret-2026",
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
    req.login({ id: user.id, email: user.email, name: user.name }, err => {
      if (err) return res.status(500).json({ error: "Login after register failed" });
      res.status(201).json({ id: user.id, email: user.email, name: user.name });
    });
  });

  app.post("/api/auth/login", async (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info?.message || "Invalid credentials" });
      req.login(user, err => {
        if (err) return next(err);
        res.json({ id: user.id, email: user.email, name: user.name });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", async (req, res) => {
    req.logout(() => res.json({ success: true }));
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Not authenticated" });
    res.json({ id: req.user!.id, email: req.user!.email, name: req.user!.name });
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

  app.get("/api/personas", async (req, res) => {
    // If authenticated, return only their personas; otherwise return all (legacy)
    if (req.isAuthenticated()) {
      const personas = await storage.getPersonasByUser(req.user!.id);
      return res.json(personas);
    }
    const personas = await storage.getPersonas();
    res.json(personas);
  });

  app.get("/api/personas/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const persona = await storage.getPersona(id);
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    res.json(persona);
  });

  app.post("/api/personas", upload.single("photo"), async (req, res) => {
    try {
      const body = req.body;
      const data = insertPersonaSchema.parse({
        name: body.name,
        relationship: body.relationship,
        birthYear: body.birthYear || null,
        bio: body.bio || null,
        photo: req.file ? req.file.filename : body.photo || null,
        pronouns: body.pronouns || null,
        birthPlace: body.birthPlace || null,
        selfMode: body.selfMode === "true" || body.selfMode === true,
        creatorName: body.creatorName || null,
        creatorRelationship: body.creatorRelationship || null,
        creatorNote: body.creatorNote || null,
        spouse: body.spouse || null,
        children: body.children || null,
        userId: req.isAuthenticated() ? req.user!.id : null,
      });
      const persona = await storage.createPersona(data);
      res.status(201).json(persona);
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  app.patch("/api/personas/:id", upload.single("photo"), async (req, res) => {
    const id = parseInt(req.params.id);
    const b = req.body;
    const updates: Record<string, unknown> = {};
    if (req.file) updates.photo = req.file.filename;
    // Explicit field mapping to ensure camelCase → schema alignment
    const fields = ["name","relationship","bio","status","spouse","children",
      "pronouns","birthYear","birthPlace","selfMode","creatorName",
      "creatorRelationship","creatorNote","deathYear","remembranceDate"];
    fields.forEach(f => { if (b[f] !== undefined) updates[f] = b[f] || null; });
    // Handle booleans
    if (b.selfMode !== undefined) updates.selfMode = b.selfMode === "true" || b.selfMode === true;
    const persona = await storage.updatePersona(id, updates);
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    res.json(persona);
  });

  app.delete("/api/personas/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deletePersona(id);
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TRAITS ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/traits", async (req, res) => {
    const traits = await storage.getTraits(parseInt(req.params.id));
    res.json(traits);
  });

  app.post("/api/personas/:id/traits", async (req, res) => {
    try {
      const data = insertTraitSchema.parse({
        ...req.body,
        personaId: parseInt(req.params.id),
      });
      const trait = await storage.createTrait(data);
      res.status(201).json(trait);
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  // Bulk replace traits for a persona
  app.put("/api/personas/:id/traits", async (req, res) => {
    const personaId = parseInt(req.params.id);
    const { traits } = req.body as { traits: { category: string; content: string }[] };
    const created = await storage.bulkReplaceTrait(personaId, traits.map(t => ({ personaId, ...t })));
    res.json(created);
  });

  app.delete("/api/traits/:id", async (req, res) => {
    await storage.deleteTrait(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMORY ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/memories", async (req, res) => {
    const memories = await storage.getMemories(parseInt(req.params.id));
    res.json(memories);
  });

  app.post("/api/personas/:id/memories", async (req, res) => {
    try {
      const data = insertMemorySchema.parse({
        ...req.body,
        personaId: parseInt(req.params.id),
      });
      const memory = await storage.createMemory(data);
      res.status(201).json(memory);
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  app.patch("/api/memories/:id", async (req, res) => {
    const memory = await storage.updateMemory(parseInt(req.params.id), req.body);
    if (!memory) return res.status(404).json({ error: "Memory not found" });
    res.json(memory);
  });

  app.delete("/api/memories/:id", async (req, res) => {
    await storage.deleteMemory(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIA ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/media", async (req, res) => {
    const mediaList = await storage.getMedia(parseInt(req.params.id));
    res.json(mediaList);
  });

  app.post("/api/personas/:id/media", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      const mediaItem = await storage.createMedia({
        personaId: parseInt(req.params.id),
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

  app.delete("/api/media/:id", async (req, res) => {
    await storage.deleteMedia(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENT IMPORT
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/personas/:id/documents", upload.single("file"), async (req, res) => {
    const personaId = parseInt(req.params.id);
    const persona = await storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { originalname, mimetype, path: filePath, size } = req.file;
    const title = (req.body.title as string) || originalname;

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
      });

      res.json(memory);
    } catch (e) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.status(500).json({ error: `Failed to parse document: ${String(e)}` });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/chat", async (req, res) => {
    const history = await storage.getChatHistory(parseInt(req.params.id));
    res.json(history);
  });

  app.post("/api/personas/:id/chat", async (req, res) => {
    const personaId = parseInt(req.params.id);
    const { message, viewerCode } = req.body as { message: string; viewerCode?: string };

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Determine chat history key — family members get their own thread
    const chatPersonaId = personaId; // future: could use viewerCode-specific thread

    // Save user message
    await storage.addChatMessage({ personaId, role: "user", content: message });

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
        lifeStory
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

    res.json({ message: assistantMsg });
  });

  app.delete("/api/personas/:id/chat", async (req, res) => {
    await storage.clearChatHistory(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFE STORY ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/life-story", async (req, res) => {
    const personaId = parseInt(req.params.id);
    const lifeStory = await storage.getLifeStory(personaId);
    res.json(lifeStory || {});
  });

  app.put("/api/personas/:id/life-story", async (req, res) => {
    const personaId = parseInt(req.params.id);
    const persona = await storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    const lifeStory = await storage.upsertLifeStory(personaId, req.body);
    res.json(lifeStory);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MILESTONE MESSAGES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/milestones", async (req, res) => {
    const milestones = await storage.getMilestones(parseInt(req.params.id));
    res.json(milestones);
  });

  app.post("/api/personas/:id/milestones", async (req, res) => {
    const personaId = parseInt(req.params.id);
    const persona = await storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    const milestone = await storage.createMilestone({ ...req.body, personaId });
    res.status(201).json(milestone);
  });

  app.delete("/api/milestones/:id", async (req, res) => {
    await storage.deleteMilestone(parseInt(req.params.id));
    res.json({ success: true });
  });

  // Generate/deliver a milestone message
  app.post("/api/milestones/:id/deliver", async (req, res) => {
    const milestone = await storage.getMilestone(parseInt(req.params.id));
    if (!milestone) return res.status(404).json({ error: "Milestone not found" });

    // If already delivered, return cached content
    if (milestone.delivered && milestone.deliveredContent) {
      return res.json({ content: milestone.deliveredContent, delivered: true });
    }

    // If prewritten, deliver immediately
    if (milestone.messageType === "prewritten" && milestone.prewrittenContent) {
      await storage.updateMilestone(milestone.id, { delivered: true, deliveredContent: milestone.prewrittenContent });
      return res.json({ content: milestone.prewrittenContent, delivered: true });
    }

    // AI-generated: build prompt from persona context
    if (!openai) return res.status(503).json({ error: "OpenAI not configured" });

    const persona = await storage.getPersona(milestone.personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });

    const traits = await storage.getTraits(milestone.personaId);
    const memories = await storage.getMemories(milestone.personaId);
    const lifeStory = await storage.getLifeStory(milestone.personaId);
    const systemPrompt = buildSystemPrompt(milestone.personaId, persona.name, persona.relationship, persona.bio, traits, memories, persona, lifeStory);

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write a heartfelt personal message to ${milestone.recipientName} for their ${milestone.occasion}. This message will be delivered on ${milestone.deliveryDate}. Make it feel genuinely personal, drawing on your relationship with ${milestone.recipientName} and what you know about this milestone in their life. Write it as a letter or note, in your own voice.` },
        ],
        max_tokens: 600,
        temperature: 0.85,
      });
      const content = completion.choices[0]?.message?.content || "I'm thinking of you on this special day.";
      await storage.updateMilestone(milestone.id, { delivered: true, deliveredContent: content });
      res.json({ content, delivered: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // Check all due milestones (called on app load)
  app.get("/api/milestones/due", async (req, res) => {
    const due = await storage.getDueMilestones();
    res.json(due);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FAMILY SHARING
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/family", async (req, res) => {
    res.json(await storage.getFamilyMembers(parseInt(req.params.id)));
  });

  app.post("/api/personas/:id/family", async (req, res) => {
    const personaId = parseInt(req.params.id);
    const persona = await storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    // Generate a simple 6-char access code
    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const member = await storage.createFamilyMember({ ...req.body, personaId, accessCode });
    res.status(201).json(member);
  });

  app.delete("/api/family/:id", async (req, res) => {
    await storage.deleteFamilyMember(parseInt(req.params.id));
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
  app.get("/api/personas/:id/contributors", async (req, res) => {
    res.json(await storage.getContributors(parseInt(req.params.id)));
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
    const apiKey = process.env.ELEVENLABS_API_KEY;
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
    const apiKey = process.env.ELEVENLABS_API_KEY;
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

  app.get("/api/personas/:id/summary", async (req, res) => {
    const personaId = parseInt(req.params.id);
    const persona = await storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });

    const traits = await storage.getTraits(personaId);
    const memories = await storage.getMemories(personaId);
    const mediaList = await storage.getMedia(personaId);

    res.json({ persona, traits, memories, media: mediaList });
  });

  return httpServer;
}
