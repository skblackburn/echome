import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Personas ────────────────────────────────────────────────────────────────
export const personas = sqliteTable("personas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(), // "mother", "father", "grandmother", etc.
  birthYear: text("birth_year"),
  photo: text("photo"), // filename or URL
  bio: text("bio"), // short biography
  status: text("status").notNull().default("active"), // "active" | "archived"
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const insertPersonaSchema = createInsertSchema(personas).omit({
  id: true,
  createdAt: true,
});
export type InsertPersona = z.infer<typeof insertPersonaSchema>;
export type Persona = typeof personas.$inferSelect;

// ─── Traits / Personality ────────────────────────────────────────────────────
export const traits = sqliteTable("traits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personaId: integer("persona_id").notNull(),
  category: text("category").notNull(), // "value", "belief", "personality", "saying", "advice"
  content: text("content").notNull(),
});

export const insertTraitSchema = createInsertSchema(traits).omit({ id: true });
export type InsertTrait = z.infer<typeof insertTraitSchema>;
export type Trait = typeof traits.$inferSelect;

// ─── Memories / Stories ───────────────────────────────────────────────────────
export const memories = sqliteTable("memories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personaId: integer("persona_id").notNull(),
  type: text("type").notNull(), // "story", "letter", "journal", "message"
  title: text("title"),
  content: text("content").notNull(),
  period: text("period"), // "childhood", "young adult", "parenthood", "later life"
  tags: text("tags"), // JSON array stored as text
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const insertMemorySchema = createInsertSchema(memories).omit({
  id: true,
  createdAt: true,
});
export type InsertMemory = z.infer<typeof insertMemorySchema>;
export type Memory = typeof memories.$inferSelect;

// ─── Media (audio recordings, photos) ────────────────────────────────────────
export const media = sqliteTable("media", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personaId: integer("persona_id").notNull(),
  type: text("type").notNull(), // "audio", "photo", "document"
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const insertMediaSchema = createInsertSchema(media).omit({
  id: true,
  createdAt: true,
});
export type InsertMedia = z.infer<typeof insertMediaSchema>;
export type Media = typeof media.$inferSelect;

// ─── Chat Messages ────────────────────────────────────────────────────────────
export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personaId: integer("persona_id").notNull(),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
