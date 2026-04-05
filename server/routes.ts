import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import { storage } from "./storage";
import {
  insertPersonaSchema,
  insertTraitSchema,
  insertMemorySchema,
  insertChatMessageSchema,
} from "@shared/schema";
import { z } from "zod";

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
  }
} catch (_e) {
  console.warn("OpenAI API key not set — chat will use demo responses");
}

// ── Build AI system prompt from persona data ──────────────────────────────────
function buildSystemPrompt(
  personaId: number,
  personaName: string,
  relationship: string,
  bio: string | null,
  traits: { category: string; content: string }[],
  memories: { type: string; title: string | null; content: string; period: string | null }[]
): string {
  const traitsByCategory: Record<string, string[]> = {};
  traits.forEach(t => {
    if (!traitsByCategory[t.category]) traitsByCategory[t.category] = [];
    traitsByCategory[t.category].push(t.content);
  });

  const traitText = Object.entries(traitsByCategory)
    .map(([cat, items]) => `${cat.toUpperCase()}: ${items.join("; ")}`)
    .join("\n");

  const memoryText = memories
    .slice(0, 20) // limit context
    .map(m => `[${m.type}${m.period ? ` – ${m.period}` : ""}] ${m.title ? `"${m.title}": ` : ""}${m.content.slice(0, 500)}`)
    .join("\n\n");

  return `You are ${personaName}, a ${relationship}. You are speaking to your loved ones as yourself — not as an AI.

${bio ? `ABOUT YOU:\n${bio}\n\n` : ""}YOUR PERSONALITY AND VALUES:\n${traitText || "Warm, loving, and thoughtful."}

YOUR MEMORIES AND STORIES:\n${memoryText || "You have many cherished memories with your family."}

GUIDELINES:
- Respond warmly, personally, and naturally as ${personaName} would.
- Draw on the memories and values above when relevant.
- Keep responses conversational — not too long.
- If asked about something you don't know, respond as ${personaName} might: gently, warmly, and honestly.
- Never break character or acknowledge that you are an AI.
- Use "I" naturally — speak from ${personaName}'s perspective.
- If you feel emotional, show it — this is a loving relationship.`;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ── Serve uploaded files ────────────────────────────────────────────────────
  app.use("/uploads", (req, res, next) => {
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

  app.get("/api/personas", (_req, res) => {
    const personas = storage.getPersonas();
    res.json(personas);
  });

  app.get("/api/personas/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const persona = storage.getPersona(id);
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    res.json(persona);
  });

  app.post("/api/personas", upload.single("photo"), (req, res) => {
    try {
      const data = insertPersonaSchema.parse({
        ...req.body,
        photo: req.file ? req.file.filename : req.body.photo,
      });
      const persona = storage.createPersona(data);
      res.status(201).json(persona);
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  app.patch("/api/personas/:id", upload.single("photo"), (req, res) => {
    const id = parseInt(req.params.id);
    const updates: Record<string, unknown> = { ...req.body };
    if (req.file) updates.photo = req.file.filename;
    const persona = storage.updatePersona(id, updates);
    if (!persona) return res.status(404).json({ error: "Persona not found" });
    res.json(persona);
  });

  app.delete("/api/personas/:id", (req, res) => {
    const id = parseInt(req.params.id);
    storage.deletePersona(id);
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TRAITS ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/traits", (req, res) => {
    const traits = storage.getTraits(parseInt(req.params.id));
    res.json(traits);
  });

  app.post("/api/personas/:id/traits", (req, res) => {
    try {
      const data = insertTraitSchema.parse({
        ...req.body,
        personaId: parseInt(req.params.id),
      });
      const trait = storage.createTrait(data);
      res.status(201).json(trait);
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  // Bulk replace traits for a persona
  app.put("/api/personas/:id/traits", (req, res) => {
    const personaId = parseInt(req.params.id);
    const { traits } = req.body as { traits: { category: string; content: string }[] };
    storage.deleteTraitsByPersona(personaId);
    const created = traits.map(t => storage.createTrait({ personaId, ...t }));
    res.json(created);
  });

  app.delete("/api/traits/:id", (req, res) => {
    storage.deleteTrait(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMORY ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/memories", (req, res) => {
    const memories = storage.getMemories(parseInt(req.params.id));
    res.json(memories);
  });

  app.post("/api/personas/:id/memories", (req, res) => {
    try {
      const data = insertMemorySchema.parse({
        ...req.body,
        personaId: parseInt(req.params.id),
      });
      const memory = storage.createMemory(data);
      res.status(201).json(memory);
    } catch (e) {
      res.status(400).json({ error: String(e) });
    }
  });

  app.patch("/api/memories/:id", (req, res) => {
    const memory = storage.updateMemory(parseInt(req.params.id), req.body);
    if (!memory) return res.status(404).json({ error: "Memory not found" });
    res.json(memory);
  });

  app.delete("/api/memories/:id", (req, res) => {
    storage.deleteMemory(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIA ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/media", (req, res) => {
    const mediaList = storage.getMedia(parseInt(req.params.id));
    res.json(mediaList);
  });

  app.post("/api/personas/:id/media", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      const mediaItem = storage.createMedia({
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

  app.delete("/api/media/:id", (req, res) => {
    storage.deleteMedia(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/chat", (req, res) => {
    const history = storage.getChatHistory(parseInt(req.params.id));
    res.json(history);
  });

  app.post("/api/personas/:id/chat", async (req, res) => {
    const personaId = parseInt(req.params.id);
    const { message } = req.body as { message: string };

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Save user message
    storage.addChatMessage({ personaId, role: "user", content: message });

    // Build context
    const persona = storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });

    const traits = storage.getTraits(personaId);
    const memories = storage.getMemories(personaId);
    const chatHistory = storage.getChatHistory(personaId);

    // Generate response
    let reply: string;

    if (openai) {
      const systemPrompt = buildSystemPrompt(
        personaId,
        persona.name,
        persona.relationship,
        persona.bio,
        traits,
        memories
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
        max_tokens: 500,
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
    const assistantMsg = storage.addChatMessage({
      personaId,
      role: "assistant",
      content: reply,
    });

    res.json({ message: assistantMsg });
  });

  app.delete("/api/personas/:id/chat", (req, res) => {
    storage.clearChatHistory(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONA SUMMARY (all data in one request)
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/personas/:id/summary", (req, res) => {
    const personaId = parseInt(req.params.id);
    const persona = storage.getPersona(personaId);
    if (!persona) return res.status(404).json({ error: "Persona not found" });

    const traits = storage.getTraits(personaId);
    const memories = storage.getMemories(personaId);
    const mediaList = storage.getMedia(personaId);

    res.json({ persona, traits, memories, media: mediaList });
  });

  return httpServer;
}
