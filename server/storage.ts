import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import type {
  Persona, InsertPersona,
  Trait, InsertTrait,
  Memory, InsertMemory,
  Media, InsertMedia,
  ChatMessage, InsertChatMessage,
} from "@shared/schema";

const sqlite = new Database("echome.db");
export const db = drizzle(sqlite, { schema });

// Auto-create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS personas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    birth_year TEXT,
    photo TEXT,
    bio TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS traits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    period TEXT,
    tags TEXT,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persona_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER
  );
`);

export interface IStorage {
  // Personas
  getPersonas(): Persona[];
  getPersona(id: number): Persona | undefined;
  createPersona(data: InsertPersona): Persona;
  updatePersona(id: number, data: Partial<InsertPersona>): Persona | undefined;
  deletePersona(id: number): void;

  // Traits
  getTraits(personaId: number): Trait[];
  createTrait(data: InsertTrait): Trait;
  updateTrait(id: number, data: Partial<InsertTrait>): Trait | undefined;
  deleteTrait(id: number): void;
  deleteTraitsByPersona(personaId: number): void;

  // Memories
  getMemories(personaId: number): Memory[];
  getMemory(id: number): Memory | undefined;
  createMemory(data: InsertMemory): Memory;
  updateMemory(id: number, data: Partial<InsertMemory>): Memory | undefined;
  deleteMemory(id: number): void;

  // Media
  getMedia(personaId: number): Media[];
  createMedia(data: InsertMedia): Media;
  deleteMedia(id: number): void;

  // Chat
  getChatHistory(personaId: number): ChatMessage[];
  addChatMessage(data: InsertChatMessage): ChatMessage;
  clearChatHistory(personaId: number): void;
}

export class SqliteStorage implements IStorage {
  // ── Personas ───────────────────────────────────────────────────────────────
  getPersonas(): Persona[] {
    return db.select().from(schema.personas)
      .orderBy(desc(schema.personas.createdAt)).all();
  }

  getPersona(id: number): Persona | undefined {
    return db.select().from(schema.personas)
      .where(eq(schema.personas.id, id)).get();
  }

  createPersona(data: InsertPersona): Persona {
    return db.insert(schema.personas).values({
      ...data,
      createdAt: new Date(),
    }).returning().get();
  }

  updatePersona(id: number, data: Partial<InsertPersona>): Persona | undefined {
    return db.update(schema.personas).set(data)
      .where(eq(schema.personas.id, id)).returning().get();
  }

  deletePersona(id: number): void {
    db.delete(schema.personas).where(eq(schema.personas.id, id)).run();
  }

  // ── Traits ─────────────────────────────────────────────────────────────────
  getTraits(personaId: number): Trait[] {
    return db.select().from(schema.traits)
      .where(eq(schema.traits.personaId, personaId)).all();
  }

  createTrait(data: InsertTrait): Trait {
    return db.insert(schema.traits).values(data).returning().get();
  }

  updateTrait(id: number, data: Partial<InsertTrait>): Trait | undefined {
    return db.update(schema.traits).set(data)
      .where(eq(schema.traits.id, id)).returning().get();
  }

  deleteTrait(id: number): void {
    db.delete(schema.traits).where(eq(schema.traits.id, id)).run();
  }

  deleteTraitsByPersona(personaId: number): void {
    db.delete(schema.traits).where(eq(schema.traits.personaId, personaId)).run();
  }

  // ── Memories ───────────────────────────────────────────────────────────────
  getMemories(personaId: number): Memory[] {
    return db.select().from(schema.memories)
      .where(eq(schema.memories.personaId, personaId))
      .orderBy(desc(schema.memories.createdAt)).all();
  }

  getMemory(id: number): Memory | undefined {
    return db.select().from(schema.memories)
      .where(eq(schema.memories.id, id)).get();
  }

  createMemory(data: InsertMemory): Memory {
    return db.insert(schema.memories).values({
      ...data,
      createdAt: new Date(),
    }).returning().get();
  }

  updateMemory(id: number, data: Partial<InsertMemory>): Memory | undefined {
    return db.update(schema.memories).set(data)
      .where(eq(schema.memories.id, id)).returning().get();
  }

  deleteMemory(id: number): void {
    db.delete(schema.memories).where(eq(schema.memories.id, id)).run();
  }

  // ── Media ──────────────────────────────────────────────────────────────────
  getMedia(personaId: number): Media[] {
    return db.select().from(schema.media)
      .where(eq(schema.media.personaId, personaId))
      .orderBy(desc(schema.media.createdAt)).all();
  }

  createMedia(data: InsertMedia): Media {
    return db.insert(schema.media).values({
      ...data,
      createdAt: new Date(),
    }).returning().get();
  }

  deleteMedia(id: number): void {
    db.delete(schema.media).where(eq(schema.media.id, id)).run();
  }

  // ── Chat ───────────────────────────────────────────────────────────────────
  getChatHistory(personaId: number): ChatMessage[] {
    return db.select().from(schema.chatMessages)
      .where(eq(schema.chatMessages.personaId, personaId))
      .orderBy(schema.chatMessages.createdAt).all();
  }

  addChatMessage(data: InsertChatMessage): ChatMessage {
    return db.insert(schema.chatMessages).values({
      ...data,
      createdAt: new Date(),
    }).returning().get();
  }

  clearChatHistory(personaId: number): void {
    db.delete(schema.chatMessages)
      .where(eq(schema.chatMessages.personaId, personaId)).run();
  }
}

export const storage = new SqliteStorage();
