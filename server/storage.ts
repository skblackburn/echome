import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, and, lte } from "drizzle-orm";
import * as schema from "@shared/schema";
import * as fs from "fs";
import * as path from "path";
import type {
  Persona, InsertPersona,
  Trait, InsertTrait,
  Memory, InsertMemory,
  Media, InsertMedia,
  ChatMessage, InsertChatMessage,
  LifeStory, InsertLifeStory,
  Milestone, InsertMilestone,
  FamilyMember, InsertFamilyMember,
  WritingStyle, InsertWritingStyle,
  EchoHeir, InsertEchoHeir,
  EchoTransfer, InsertEchoTransfer,
  JournalEntry, InsertJournalEntry,
  FutureLetter, InsertFutureLetter,
  Notification, InsertNotification,
  PhotoMemory, InsertPhotoMemory,
  User,
} from "@shared/schema";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required. Set it to your Supabase connection string.");
}

const client = postgres(DATABASE_URL, { ssl: "require" });
export const db = drizzle(client, { schema });

// ── Create all tables if they don't exist ─────────────────────────────────────
export async function initDb() {
  await client`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      plan_interval TEXT,
      plan_expires_at TIMESTAMP,
      total_messages_sent INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    )`;

  // Add subscription columns if they don't exist (for existing databases)
  await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`.catch(() => {});
  await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`.catch(() => {});
  await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'`.catch(() => {});
  await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_interval TEXT`.catch(() => {});
  await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP`.catch(() => {});
  await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_messages_sent INTEGER NOT NULL DEFAULT 0`.catch(() => {});
  await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`.catch(() => {});

  await client`
    CREATE TABLE IF NOT EXISTS personas (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      name TEXT NOT NULL,
      relationship TEXT NOT NULL,
      birth_year TEXT,
      photo TEXT,
      bio TEXT,
      spouse TEXT,
      children TEXT,
      pronouns TEXT,
      birth_place TEXT,
      self_mode BOOLEAN DEFAULT FALSE,
      creator_name TEXT,
      creator_relationship TEXT,
      creator_note TEXT,
      death_year TEXT,
      remembrance_date TEXT,
      passing_date TEXT,
      is_living BOOLEAN DEFAULT TRUE,
      status TEXT NOT NULL DEFAULT 'active',
      contributor_user_id INTEGER,
      contributor_relationship TEXT,
      perspective_type TEXT DEFAULT 'self',
      created_at TIMESTAMP DEFAULT NOW()
    )`;

  // Add new persona columns if they don't exist
  await client`ALTER TABLE personas ADD COLUMN IF NOT EXISTS passing_date TEXT`.catch(() => {});
  await client`ALTER TABLE personas ADD COLUMN IF NOT EXISTS is_living BOOLEAN DEFAULT TRUE`.catch(() => {});
  await client`ALTER TABLE personas ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER`.catch(() => {});
  await client`ALTER TABLE personas ADD COLUMN IF NOT EXISTS contributor_relationship TEXT`.catch(() => {});
  await client`ALTER TABLE personas ADD COLUMN IF NOT EXISTS perspective_type TEXT DEFAULT 'self'`.catch(() => {});

  await client`
    CREATE TABLE IF NOT EXISTS traits (
      id SERIAL PRIMARY KEY,
      persona_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      contributor_user_id INTEGER,
      contributor_relationship TEXT,
      perspective_type TEXT DEFAULT 'self',
      created_at TIMESTAMP DEFAULT NOW()
    )`;

  await client`ALTER TABLE traits ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER`.catch(() => {});
  await client`ALTER TABLE traits ADD COLUMN IF NOT EXISTS contributor_relationship TEXT`.catch(() => {});
  await client`ALTER TABLE traits ADD COLUMN IF NOT EXISTS perspective_type TEXT DEFAULT 'self'`.catch(() => {});

  await client`
    CREATE TABLE IF NOT EXISTS memories (
      id SERIAL PRIMARY KEY,
      persona_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      period TEXT,
      tags TEXT,
      document_type TEXT DEFAULT 'voice',
      contributed_by TEXT,
      contributor_code TEXT,
      contributor_user_id INTEGER,
      contributor_relationship TEXT,
      perspective_type TEXT DEFAULT 'self',
      created_at TIMESTAMP DEFAULT NOW()
    )`;

  // Add new memory columns if they don't exist
  await client`ALTER TABLE memories ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'voice'`.catch(() => {});
  await client`ALTER TABLE memories ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER`.catch(() => {});
  await client`ALTER TABLE memories ADD COLUMN IF NOT EXISTS contributor_relationship TEXT`.catch(() => {});
  await client`ALTER TABLE memories ADD COLUMN IF NOT EXISTS perspective_type TEXT DEFAULT 'self'`.catch(() => {});

  await client`
    CREATE TABLE IF NOT EXISTS media (
      id SERIAL PRIMARY KEY,
      persona_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`;

  await client`
    CREATE TABLE IF NOT EXISTS life_story (
      id SERIAL PRIMARY KEY,
      persona_id INTEGER NOT NULL UNIQUE,
      favorite_food TEXT,
      favorite_music TEXT,
      favorite_smell TEXT,
      favorite_place TEXT,
      catchphrase TEXT,
      love_language TEXT,
      humor TEXT,
      hard_times TEXT,
      hometown TEXT,
      career TEXT,
      proudest_moment TEXT,
      hardest_period TEXT,
      wish_for_family TEXT,
      what_to_remember TEXT,
      unfinished_business TEXT,
      contributor_user_id INTEGER,
      contributor_relationship TEXT,
      perspective_type TEXT DEFAULT 'self',
      updated_at TIMESTAMP DEFAULT NOW()
    )`;

  await client`ALTER TABLE life_story ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER`.catch(() => {});
  await client`ALTER TABLE life_story ADD COLUMN IF NOT EXISTS contributor_relationship TEXT`.catch(() => {});
  await client`ALTER TABLE life_story ADD COLUMN IF NOT EXISTS perspective_type TEXT DEFAULT 'self'`.catch(() => {});

  await client`
    CREATE TABLE IF NOT EXISTS milestone_messages (
      id SERIAL PRIMARY KEY,
      persona_id INTEGER NOT NULL,
      user_id INTEGER,
      title TEXT NOT NULL,
      occasion TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      recipient_email TEXT,
      message_prompt TEXT,
      generated_message TEXT,
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL DEFAULT '09:00',
      timezone TEXT DEFAULT 'America/New_York',
      is_recurring BOOLEAN DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'scheduled',
      delivered_at TIMESTAMP,
      contributor_user_id INTEGER,
      contributor_relationship TEXT,
      perspective_type TEXT DEFAULT 'self',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`;

  // Migrate old milestone_messages table to new schema (add columns if they don't exist)
  await client`ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS user_id INTEGER`.catch(() => {});
  await client`ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS title TEXT`.catch(() => {});
  await client`ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS recipient_email TEXT`.catch(() => {});
  await client`ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS message_prompt TEXT`.catch(() => {});
  await client`ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS generated_message TEXT`.catch(() => {});
  await client`ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS scheduled_date TEXT`.catch(() => {});
  await client`ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS scheduled_time TEXT NOT NULL DEFAULT '09:00'`.catch(() => {});
  await client`ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York'`.catch(() => {});
  await client`ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE`.catch(() => {});
  await client`ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled'`.catch(() => {});
  await client`ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP`.catch(() => {});
  await client`ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`.catch(() => {});
  await client`ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER`.catch(() => {});
  await client`ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS contributor_relationship TEXT`.catch(() => {});
  await client`ALTER TABLE milestone_messages ADD COLUMN IF NOT EXISTS perspective_type TEXT DEFAULT 'self'`.catch(() => {});

  await client`
    CREATE TABLE IF NOT EXISTS family_members (
      id SERIAL PRIMARY KEY,
      persona_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      relationship TEXT NOT NULL,
      access_code TEXT NOT NULL,
      birth_year INTEGER,
      note TEXT,
      filter_settings TEXT DEFAULT '{}',
      last_active_at TIMESTAMP,
      contributor_user_id INTEGER,
      contributor_relationship TEXT,
      perspective_type TEXT DEFAULT 'self',
      created_at TIMESTAMP DEFAULT NOW()
    )`;

  // Add new family member columns if they don't exist
  await client`ALTER TABLE family_members ADD COLUMN IF NOT EXISTS birth_year INTEGER`.catch(() => {});
  await client`ALTER TABLE family_members ADD COLUMN IF NOT EXISTS note TEXT`.catch(() => {});
  await client`ALTER TABLE family_members ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER`.catch(() => {});
  await client`ALTER TABLE family_members ADD COLUMN IF NOT EXISTS contributor_relationship TEXT`.catch(() => {});
  await client`ALTER TABLE family_members ADD COLUMN IF NOT EXISTS perspective_type TEXT DEFAULT 'self'`.catch(() => {});

  await client`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      persona_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      contributor_user_id INTEGER,
      contributor_relationship TEXT,
      perspective_type TEXT DEFAULT 'self',
      created_at TIMESTAMP DEFAULT NOW()
    )`;

  await client`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER`.catch(() => {});
  await client`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS contributor_relationship TEXT`.catch(() => {});
  await client`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS perspective_type TEXT DEFAULT 'self'`.catch(() => {});

  await client`
    CREATE TABLE IF NOT EXISTS writing_styles (
      id SERIAL PRIMARY KEY,
      persona_id INTEGER NOT NULL UNIQUE,
      sentence_structure TEXT,
      vocabulary_level TEXT,
      punctuation_habits TEXT,
      tone_and_emotion TEXT,
      common_phrases TEXT,
      formality TEXT,
      narrative_style TEXT,
      quirks TEXT,
      overall_summary TEXT,
      analyzed_document_count INTEGER DEFAULT 0,
      last_analyzed_at TIMESTAMP,
      contributor_user_id INTEGER,
      contributor_relationship TEXT,
      perspective_type TEXT DEFAULT 'self',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`;

  await client`ALTER TABLE writing_styles ADD COLUMN IF NOT EXISTS contributor_user_id INTEGER`.catch(() => {});
  await client`ALTER TABLE writing_styles ADD COLUMN IF NOT EXISTS contributor_relationship TEXT`.catch(() => {});
  await client`ALTER TABLE writing_styles ADD COLUMN IF NOT EXISTS perspective_type TEXT DEFAULT 'self'`.catch(() => {});

  // ── Phase 2: Echo Heirs & Transfers ──────────────────────────────────────
  await client`
    CREATE TABLE IF NOT EXISTS echo_heirs (
      id SERIAL PRIMARY KEY,
      persona_id INTEGER NOT NULL,
      creator_user_id INTEGER NOT NULL,
      heir_email TEXT NOT NULL,
      heir_user_id INTEGER,
      heir_name TEXT,
      heir_relationship TEXT,
      access_level TEXT NOT NULL DEFAULT 'full',
      status TEXT NOT NULL DEFAULT 'pending',
      claim_token TEXT NOT NULL UNIQUE,
      claimed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`;

  await client`
    CREATE TABLE IF NOT EXISTS echo_transfers (
      id SERIAL PRIMARY KEY,
      persona_id INTEGER NOT NULL,
      transfer_trigger TEXT NOT NULL,
      scheduled_date TEXT,
      executed_at TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )`;

  await client`ALTER TABLE personas ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE`.catch(() => {});
  await client`ALTER TABLE personas ADD COLUMN IF NOT EXISTS original_creator_id INTEGER`.catch(() => {});
  await client`ALTER TABLE personas ADD COLUMN IF NOT EXISTS parent_persona_id INTEGER`.catch(() => {});
  await client`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS heir_user_id INTEGER`.catch(() => {});

  // ── Journal Entries ─────────────────────────────────────────────────────
  await client`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      mood TEXT,
      included_in_echo BOOLEAN DEFAULT FALSE,
      echo_persona_id INTEGER,
      linked_memory_id INTEGER,
      reflection_count INTEGER NOT NULL DEFAULT 0,
      ai_reflections TEXT,
      audio_url TEXT,
      audio_duration_seconds INTEGER,
      transcription_status TEXT DEFAULT 'none',
      entry_type TEXT DEFAULT 'text',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`;

  // Voice journaling columns (idempotent migration for existing DBs)
  await client`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS audio_url TEXT`.catch(() => {});
  await client`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS audio_duration_seconds INTEGER`.catch(() => {});
  await client`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS transcription_status TEXT DEFAULT 'none'`.catch(() => {});
  await client`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS entry_type TEXT DEFAULT 'text'`.catch(() => {});

  // ── Future Letters ─────────────────────────────────────────────────────
  await client`
    CREATE TABLE IF NOT EXISTS future_letters (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      recipient_type TEXT NOT NULL,
      recipient_user_id INTEGER,
      recipient_heir_id INTEGER,
      recipient_name TEXT,
      recipient_email TEXT,
      deliver_at TIMESTAMP NOT NULL,
      delivered_at TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'scheduled',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`;

  // ── Notifications ──────────────────────────────────────────────────────
  await client`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      reference_id INTEGER,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )`;

  // ── Photo Memories ─────────────────────────────────────────────────────
  await client`
    CREATE TABLE IF NOT EXISTS photo_memories (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      persona_id INTEGER NOT NULL,
      photo_url TEXT NOT NULL,
      photo_thumbnail_url TEXT,
      ai_prompts JSONB,
      user_responses JSONB,
      status TEXT NOT NULL DEFAULT 'draft',
      linked_memory_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`;

  console.log("Database tables ready");

  // ── Auto-run pending SQL migrations ────────────────────────────────────
  await client`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Find migrations directory — try cwd first, then relative to this file
  let migrationsDir = path.resolve(process.cwd(), "migrations");
  if (!fs.existsSync(migrationsDir)) {
    migrationsDir = path.resolve(__dirname, "../migrations");
  }
  if (!fs.existsSync(migrationsDir)) {
    console.warn("migrations/ directory not found, skipping migration runner");
    return;
  }

  const sqlFiles = fs.readdirSync(migrationsDir)
    .filter((f: string) => f.endsWith(".sql"))
    .sort();

  if (sqlFiles.length === 0) {
    console.log("No SQL migration files found");
    return;
  }

  const applied = await client`SELECT filename FROM _migrations`;
  const appliedSet = new Set(applied.map((r: { filename: string }) => r.filename));

  for (const file of sqlFiles) {
    if (appliedSet.has(file)) continue;

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8").trim();
    if (!sql) {
      console.log(`Skipping empty migration: ${file}`);
      continue;
    }

    try {
      await client.begin(async (tx) => {
        await tx.unsafe(sql);
        await tx`INSERT INTO _migrations (filename) VALUES (${file})`;
      });
      console.log(`Applied migration: ${file}`);
    } catch (err: any) {
      // Forgive "already exists" errors — the DB state is already correct
      const pgCode = err?.code;
      if (pgCode === "42701" || pgCode === "42710" || pgCode === "42P07") {
        console.warn(`Migration ${file} skipped (already exists): ${err.message}`);
        // Still mark as applied so we don't retry
        await client`INSERT INTO _migrations (filename) VALUES (${file}) ON CONFLICT DO NOTHING`;
      } else {
        console.error(`Migration ${file} FAILED:`, err);
        throw err;
      }
    }
  }

  console.log("All migrations up to date");
}

export interface IStorage {
  // Users
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(data: { email: string; passwordHash: string; name: string }): Promise<User>;

  // Personas
  getPersonas(): Promise<Persona[]>;
  getPersonasByUser(userId: number): Promise<Persona[]>;
  getPersona(id: number): Promise<Persona | undefined>;
  createPersona(data: InsertPersona): Promise<Persona>;
  updatePersona(id: number, data: Partial<InsertPersona>): Promise<Persona | undefined>;
  deletePersona(id: number): Promise<void>;

  // Traits
  getTraits(personaId: number): Promise<Trait[]>;
  createTrait(data: InsertTrait): Promise<Trait>;
  bulkReplaceTrait(personaId: number, traits: InsertTrait[]): Promise<Trait[]>;
  deleteTrait(id: number): Promise<void>;

  // Memories
  getMemories(personaId: number): Promise<Memory[]>;
  getMemoryById(id: number): Promise<Memory | undefined>;
  createMemory(data: InsertMemory): Promise<Memory>;
  updateMemory(id: number, data: Partial<InsertMemory>): Promise<Memory | undefined>;
  deleteMemory(id: number): Promise<void>;

  // Media
  getMedia(personaId: number): Promise<Media[]>;
  createMedia(data: InsertMedia): Promise<Media>;
  deleteMedia(id: number): Promise<void>;

  // Chat
  getChatHistory(personaId: number): Promise<ChatMessage[]>;
  addChatMessage(data: InsertChatMessage): Promise<ChatMessage>;
  clearChatHistory(personaId: number): Promise<void>;

  // Life Story
  getLifeStory(personaId: number): Promise<LifeStory | undefined>;
  upsertLifeStory(personaId: number, data: Partial<InsertLifeStory>): Promise<LifeStory>;

  // Milestones
  getMilestones(personaId: number): Promise<Milestone[]>;
  getMilestonesByUser(userId: number): Promise<Milestone[]>;
  getMilestone(id: number): Promise<Milestone | undefined>;
  createMilestone(data: InsertMilestone): Promise<Milestone>;
  updateMilestone(id: number, data: Partial<Milestone>): Promise<Milestone | undefined>;
  deleteMilestone(id: number): Promise<void>;
  getDueMilestones(): Promise<Milestone[]>;
  getActiveMilestoneCountByUser(userId: number): Promise<number>;

  // Family Members
  getFamilyMembers(personaId: number): Promise<FamilyMember[]>;
  createFamilyMember(data: InsertFamilyMember): Promise<FamilyMember>;
  deleteFamilyMember(id: number): Promise<void>;
  getFamilyMemberByCode(accessCode: string): Promise<FamilyMember | undefined>;
  updateFamilyMemberSettings(accessCode: string, filterSettings: object): Promise<FamilyMember | undefined>;
  touchFamilyMember(accessCode: string): Promise<void>;
  getContributors(personaId: number): Promise<{ code: string; name: string; count: number }[]>;

  // Writing Styles
  getWritingStyle(personaId: number): Promise<WritingStyle | undefined>;
  upsertWritingStyle(personaId: number, data: Partial<InsertWritingStyle>): Promise<WritingStyle>;

  // Echo Heirs
  getHeirsByPersona(personaId: number): Promise<EchoHeir[]>;
  getHeirByToken(claimToken: string): Promise<EchoHeir | undefined>;
  getHeirById(id: number): Promise<EchoHeir | undefined>;
  getHeirsByUserId(userId: number): Promise<EchoHeir[]>;
  createHeir(data: InsertEchoHeir): Promise<EchoHeir>;
  updateHeir(id: number, data: Partial<EchoHeir>): Promise<EchoHeir | undefined>;
  deleteHeir(id: number): Promise<void>;
  getHeirCountByPersona(personaId: number): Promise<number>;

  // Echo Transfers
  getTransfersByPersona(personaId: number): Promise<EchoTransfer[]>;
  getTransferById(id: number): Promise<EchoTransfer | undefined>;
  createTransfer(data: InsertEchoTransfer): Promise<EchoTransfer>;
  updateTransfer(id: number, data: Partial<EchoTransfer>): Promise<EchoTransfer | undefined>;
  getPendingScheduledTransfers(today: string): Promise<EchoTransfer[]>;
  getPendingOnPassingTransfers(): Promise<EchoTransfer[]>;

  // Chat with heir support
  getChatHistoryForHeir(personaId: number, heirUserId: number): Promise<ChatMessage[]>;

  // Persona management
  deleteAllPersonaData(personaId: number): Promise<void>;

  // Account management
  updateUserStatus(userId: number, status: string): Promise<User | undefined>;
  deleteAllUserData(userId: number): Promise<void>;
  deleteUser(userId: number): Promise<void>;

  // Journal Entries
  getJournalEntriesByUser(userId: number, limit?: number, offset?: number): Promise<JournalEntry[]>;
  getJournalEntryById(id: number): Promise<JournalEntry | undefined>;
  createJournalEntry(data: InsertJournalEntry): Promise<JournalEntry>;
  updateJournalEntry(id: number, data: Partial<InsertJournalEntry>): Promise<JournalEntry | undefined>;
  deleteJournalEntry(id: number): Promise<void>;
  getJournalEntryCountByUser(userId: number): Promise<number>;
  getMonthlyReflectionCount(userId: number): Promise<number>;

  // Future Letters
  createFutureLetter(data: InsertFutureLetter): Promise<FutureLetter>;
  getFutureLettersByUser(userId: number): Promise<FutureLetter[]>;
  getFutureLetterById(id: number): Promise<FutureLetter | undefined>;
  updateFutureLetter(id: number, data: Partial<InsertFutureLetter>): Promise<FutureLetter | undefined>;
  deleteFutureLetter(id: number): Promise<void>;
  getDueLetters(): Promise<FutureLetter[]>;
  getLettersInbox(userId: number): Promise<FutureLetter[]>;

  // Notifications
  createNotification(data: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: number): Promise<number>;
  markNotificationRead(id: number): Promise<void>;

  // Photo Memories
  getPhotoMemoriesByUser(userId: number): Promise<PhotoMemory[]>;
  getPhotoMemoryById(id: number): Promise<PhotoMemory | undefined>;
  getPhotoMemoryCountByUser(userId: number): Promise<number>;
  createPhotoMemory(data: InsertPhotoMemory): Promise<PhotoMemory>;
  updatePhotoMemory(id: number, data: Partial<InsertPhotoMemory>): Promise<PhotoMemory | undefined>;
  deletePhotoMemory(id: number): Promise<void>;

  // Subscriptions
  updateUserSubscription(userId: number, data: Partial<{
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    plan: string;
    planInterval: string | null;
    planExpiresAt: Date | null;
  }>): Promise<User | undefined>;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;
  incrementMessageCount(userId: number): Promise<void>;
  getMonthlyMessageCount(userId: number): Promise<number>;
}

export class PgStorage implements IStorage {
  // ── Users ─────────────────────────────────────────────────────────────────
  async getUserByEmail(email: string): Promise<User | undefined> {
    return db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase().trim())).then(r => r[0]);
  }
  async getUserById(id: number): Promise<User | undefined> {
    return db.select().from(schema.users).where(eq(schema.users.id, id)).then(r => r[0]);
  }
  async createUser(data: { email: string; passwordHash: string; name: string }): Promise<User> {
    const [user] = await db.insert(schema.users).values({
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash,
      name: data.name,
    }).returning();
    return user;
  }

  // ── Personas ──────────────────────────────────────────────────────────────
  async getPersonas(): Promise<Persona[]> {
    return db.select().from(schema.personas).orderBy(desc(schema.personas.createdAt));
  }
  async getPersonasByUser(userId: number): Promise<Persona[]> {
    return db.select().from(schema.personas).where(eq(schema.personas.userId, userId)).orderBy(desc(schema.personas.createdAt));
  }
  async getPersona(id: number): Promise<Persona | undefined> {
    return db.select().from(schema.personas).where(eq(schema.personas.id, id)).then(r => r[0]);
  }
  async createPersona(data: InsertPersona): Promise<Persona> {
    const [p] = await db.insert(schema.personas).values(data).returning();
    return p;
  }
  async updatePersona(id: number, data: Partial<InsertPersona>): Promise<Persona | undefined> {
    const [p] = await db.update(schema.personas).set(data).where(eq(schema.personas.id, id)).returning();
    return p;
  }
  async deletePersona(id: number): Promise<void> {
    await db.delete(schema.personas).where(eq(schema.personas.id, id));
  }

  // ── Traits ────────────────────────────────────────────────────────────────
  async getTraits(personaId: number): Promise<Trait[]> {
    return db.select().from(schema.traits).where(eq(schema.traits.personaId, personaId));
  }
  async createTrait(data: InsertTrait): Promise<Trait> {
    const [t] = await db.insert(schema.traits).values(data).returning();
    return t;
  }
  async bulkReplaceTrait(personaId: number, traits: InsertTrait[]): Promise<Trait[]> {
    await db.delete(schema.traits).where(eq(schema.traits.personaId, personaId));
    if (traits.length === 0) return [];
    return db.insert(schema.traits).values(traits).returning();
  }
  async deleteTrait(id: number): Promise<void> {
    await db.delete(schema.traits).where(eq(schema.traits.id, id));
  }

  // ── Memories ─────────────────────────────────────────────────────────────
  async getMemories(personaId: number): Promise<Memory[]> {
    return db.select().from(schema.memories).where(eq(schema.memories.personaId, personaId)).orderBy(desc(schema.memories.createdAt));
  }
  async getMemoryById(id: number): Promise<Memory | undefined> {
    return db.select().from(schema.memories).where(eq(schema.memories.id, id)).then(r => r[0]);
  }
  async createMemory(data: InsertMemory): Promise<Memory> {
    const [m] = await db.insert(schema.memories).values(data).returning();
    return m;
  }
  async updateMemory(id: number, data: Partial<InsertMemory>): Promise<Memory | undefined> {
    const [m] = await db.update(schema.memories).set(data).where(eq(schema.memories.id, id)).returning();
    return m;
  }
  async deleteMemory(id: number): Promise<void> {
    await db.delete(schema.memories).where(eq(schema.memories.id, id));
  }

  // ── Media ─────────────────────────────────────────────────────────────────
  async getMedia(personaId: number): Promise<Media[]> {
    return db.select().from(schema.media).where(eq(schema.media.personaId, personaId)).orderBy(desc(schema.media.createdAt));
  }
  async createMedia(data: InsertMedia): Promise<Media> {
    const [m] = await db.insert(schema.media).values(data).returning();
    return m;
  }
  async deleteMedia(id: number): Promise<void> {
    await db.delete(schema.media).where(eq(schema.media.id, id));
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  async getChatHistory(personaId: number): Promise<ChatMessage[]> {
    return db.select().from(schema.chatMessages).where(eq(schema.chatMessages.personaId, personaId)).orderBy(schema.chatMessages.createdAt);
  }
  async addChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const [m] = await db.insert(schema.chatMessages).values(data).returning();
    return m;
  }
  async clearChatHistory(personaId: number): Promise<void> {
    await db.delete(schema.chatMessages).where(eq(schema.chatMessages.personaId, personaId));
  }

  // ── Life Story ────────────────────────────────────────────────────────────
  async getLifeStory(personaId: number): Promise<LifeStory | undefined> {
    return db.select().from(schema.lifeStory).where(eq(schema.lifeStory.personaId, personaId)).then(r => r[0]);
  }
  async upsertLifeStory(personaId: number, data: Partial<InsertLifeStory>): Promise<LifeStory> {
    const existing = await this.getLifeStory(personaId);
    if (existing) {
      const [ls] = await db.update(schema.lifeStory).set({ ...data, updatedAt: new Date() }).where(eq(schema.lifeStory.personaId, personaId)).returning();
      return ls;
    } else {
      const [ls] = await db.insert(schema.lifeStory).values({ ...data, personaId, updatedAt: new Date() } as InsertLifeStory).returning();
      return ls;
    }
  }

  // ── Milestones ────────────────────────────────────────────────────────────
  async getMilestones(personaId: number): Promise<Milestone[]> {
    return db.select().from(schema.milestoneMessages).where(eq(schema.milestoneMessages.personaId, personaId)).orderBy(schema.milestoneMessages.scheduledDate);
  }
  async getMilestonesByUser(userId: number): Promise<Milestone[]> {
    return db.select().from(schema.milestoneMessages).where(eq(schema.milestoneMessages.userId, userId)).orderBy(schema.milestoneMessages.scheduledDate);
  }
  async getMilestone(id: number): Promise<Milestone | undefined> {
    return db.select().from(schema.milestoneMessages).where(eq(schema.milestoneMessages.id, id)).then(r => r[0]);
  }
  async createMilestone(data: InsertMilestone): Promise<Milestone> {
    const [m] = await db.insert(schema.milestoneMessages).values(data).returning();
    return m;
  }
  async updateMilestone(id: number, data: Partial<Milestone>): Promise<Milestone | undefined> {
    const [m] = await db.update(schema.milestoneMessages).set({ ...data, updatedAt: new Date() }).where(eq(schema.milestoneMessages.id, id)).returning();
    return m;
  }
  async deleteMilestone(id: number): Promise<void> {
    await db.delete(schema.milestoneMessages).where(eq(schema.milestoneMessages.id, id));
  }
  async getDueMilestones(): Promise<Milestone[]> {
    const today = new Date().toISOString().split("T")[0];
    const all = await db.select().from(schema.milestoneMessages).where(eq(schema.milestoneMessages.status, "scheduled"));
    return all.filter(m => m.scheduledDate <= today);
  }
  async getActiveMilestoneCountByUser(userId: number): Promise<number> {
    const all = await db.select().from(schema.milestoneMessages).where(eq(schema.milestoneMessages.userId, userId));
    return all.filter(m => m.status === "scheduled").length;
  }

  // ── Family Members ────────────────────────────────────────────────────────
  async getFamilyMembers(personaId: number): Promise<FamilyMember[]> {
    return db.select().from(schema.familyMembers).where(eq(schema.familyMembers.personaId, personaId));
  }
  async createFamilyMember(data: InsertFamilyMember): Promise<FamilyMember> {
    const [m] = await db.insert(schema.familyMembers).values(data).returning();
    return m;
  }
  async deleteFamilyMember(id: number): Promise<void> {
    await db.delete(schema.familyMembers).where(eq(schema.familyMembers.id, id));
  }
  async getFamilyMemberByCode(accessCode: string): Promise<FamilyMember | undefined> {
    return db.select().from(schema.familyMembers).where(eq(schema.familyMembers.accessCode, accessCode)).then(r => r[0]);
  }
  async updateFamilyMemberSettings(accessCode: string, filterSettings: object): Promise<FamilyMember | undefined> {
    const [m] = await db.update(schema.familyMembers).set({ filterSettings: JSON.stringify(filterSettings) }).where(eq(schema.familyMembers.accessCode, accessCode)).returning();
    return m;
  }
  async touchFamilyMember(accessCode: string): Promise<void> {
    await db.update(schema.familyMembers).set({ lastActiveAt: new Date() }).where(eq(schema.familyMembers.accessCode, accessCode));
  }
  async getContributors(personaId: number): Promise<{ code: string; name: string; count: number }[]> {
    const mems = await db.select().from(schema.memories).where(eq(schema.memories.personaId, personaId));
    const map: Record<string, { name: string; count: number }> = {};
    mems.forEach(m => {
      if (m.contributorCode && m.contributedBy) {
        if (!map[m.contributorCode]) map[m.contributorCode] = { name: m.contributedBy, count: 0 };
        map[m.contributorCode].count++;
      }
    });
    return Object.entries(map).map(([code, v]) => ({ code, name: v.name, count: v.count }));
  }

  // ── Writing Styles ───────────────────────────────────────────────────────
  async getWritingStyle(personaId: number): Promise<WritingStyle | undefined> {
    return db.select().from(schema.writingStyles).where(eq(schema.writingStyles.personaId, personaId)).then(r => r[0]);
  }
  async upsertWritingStyle(personaId: number, data: Partial<InsertWritingStyle>): Promise<WritingStyle> {
    const existing = await this.getWritingStyle(personaId);
    if (existing) {
      const [ws] = await db.update(schema.writingStyles).set({ ...data, updatedAt: new Date() }).where(eq(schema.writingStyles.personaId, personaId)).returning();
      return ws;
    } else {
      const [ws] = await db.insert(schema.writingStyles).values({ ...data, personaId, updatedAt: new Date() } as InsertWritingStyle).returning();
      return ws;
    }
  }

  // ── Echo Heirs ───────────────────────────────────────────────────────────
  async getHeirsByPersona(personaId: number): Promise<EchoHeir[]> {
    return db.select().from(schema.echoHeirs).where(eq(schema.echoHeirs.personaId, personaId)).orderBy(desc(schema.echoHeirs.createdAt));
  }
  async getHeirByToken(claimToken: string): Promise<EchoHeir | undefined> {
    return db.select().from(schema.echoHeirs).where(eq(schema.echoHeirs.claimToken, claimToken)).then(r => r[0]);
  }
  async getHeirById(id: number): Promise<EchoHeir | undefined> {
    return db.select().from(schema.echoHeirs).where(eq(schema.echoHeirs.id, id)).then(r => r[0]);
  }
  async getHeirsByUserId(userId: number): Promise<EchoHeir[]> {
    return db.select().from(schema.echoHeirs).where(eq(schema.echoHeirs.heirUserId, userId));
  }
  async createHeir(data: InsertEchoHeir): Promise<EchoHeir> {
    const [h] = await db.insert(schema.echoHeirs).values(data).returning();
    return h;
  }
  async updateHeir(id: number, data: Partial<EchoHeir>): Promise<EchoHeir | undefined> {
    const [h] = await db.update(schema.echoHeirs).set(data).where(eq(schema.echoHeirs.id, id)).returning();
    return h;
  }
  async deleteHeir(id: number): Promise<void> {
    await db.delete(schema.echoHeirs).where(eq(schema.echoHeirs.id, id));
  }
  async getHeirCountByPersona(personaId: number): Promise<number> {
    const heirs = await db.select().from(schema.echoHeirs).where(eq(schema.echoHeirs.personaId, personaId));
    return heirs.length;
  }

  // ── Echo Transfers ──────────────────────────────────────────────────────
  async getTransfersByPersona(personaId: number): Promise<EchoTransfer[]> {
    return db.select().from(schema.echoTransfers).where(eq(schema.echoTransfers.personaId, personaId)).orderBy(desc(schema.echoTransfers.createdAt));
  }
  async getTransferById(id: number): Promise<EchoTransfer | undefined> {
    return db.select().from(schema.echoTransfers).where(eq(schema.echoTransfers.id, id)).then(r => r[0]);
  }
  async createTransfer(data: InsertEchoTransfer): Promise<EchoTransfer> {
    const [t] = await db.insert(schema.echoTransfers).values(data).returning();
    return t;
  }
  async updateTransfer(id: number, data: Partial<EchoTransfer>): Promise<EchoTransfer | undefined> {
    const [t] = await db.update(schema.echoTransfers).set(data).where(eq(schema.echoTransfers.id, id)).returning();
    return t;
  }
  async getPendingScheduledTransfers(today: string): Promise<EchoTransfer[]> {
    const all = await db.select().from(schema.echoTransfers).where(eq(schema.echoTransfers.status, "pending"));
    return all.filter(t => t.transferTrigger === "scheduled" && t.scheduledDate && t.scheduledDate <= today);
  }
  async getPendingOnPassingTransfers(): Promise<EchoTransfer[]> {
    const all = await db.select().from(schema.echoTransfers).where(eq(schema.echoTransfers.status, "pending"));
    return all.filter(t => t.transferTrigger === "on_passing");
  }

  // ── Chat with heir support ──────────────────────────────────────────────
  async getChatHistoryForHeir(personaId: number, heirUserId: number): Promise<ChatMessage[]> {
    const all = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.personaId, personaId)).orderBy(schema.chatMessages.createdAt);
    return all.filter(m => m.heirUserId === heirUserId);
  }

  // ── Journal Entries ──────────────────────────────────────────────────────
  async getJournalEntriesByUser(userId: number, limit = 20, offset = 0): Promise<JournalEntry[]> {
    const all = await db.select().from(schema.journalEntries)
      .where(eq(schema.journalEntries.userId, userId))
      .orderBy(desc(schema.journalEntries.entryDate));
    return all.slice(offset, offset + limit);
  }
  async getJournalEntryById(id: number): Promise<JournalEntry | undefined> {
    return db.select().from(schema.journalEntries).where(eq(schema.journalEntries.id, id)).then(r => r[0]);
  }
  async createJournalEntry(data: InsertJournalEntry): Promise<JournalEntry> {
    const [entry] = await db.insert(schema.journalEntries).values(data).returning();
    return entry;
  }
  async updateJournalEntry(id: number, data: Partial<InsertJournalEntry>): Promise<JournalEntry | undefined> {
    const [entry] = await db.update(schema.journalEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.journalEntries.id, id))
      .returning();
    return entry;
  }
  async deleteJournalEntry(id: number): Promise<void> {
    await db.delete(schema.journalEntries).where(eq(schema.journalEntries.id, id));
  }
  async getJournalEntryCountByUser(userId: number): Promise<number> {
    const all = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.userId, userId));
    return all.length;
  }
  async getMonthlyReflectionCount(userId: number): Promise<number> {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const result = await client`
      SELECT COALESCE(SUM(reflection_count), 0) as count
      FROM journal_entries
      WHERE user_id = ${userId}
        AND created_at >= ${firstOfMonth}
    `;
    return parseInt(result[0]?.count || "0", 10);
  }
  async getMonthlyVoiceEntryCount(userId: number): Promise<number> {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const result = await client`
      SELECT COUNT(*) as count
      FROM journal_entries
      WHERE user_id = ${userId}
        AND entry_type = 'voice'
        AND created_at >= ${firstOfMonth}
    `;
    return parseInt(result[0]?.count || "0", 10);
  }

  // ── Future Letters ───────────────────────────────────────────────────────
  async createFutureLetter(data: InsertFutureLetter): Promise<FutureLetter> {
    const [letter] = await db.insert(schema.futureLetters).values(data).returning();
    return letter;
  }
  async getFutureLettersByUser(userId: number): Promise<FutureLetter[]> {
    return db.select().from(schema.futureLetters).where(eq(schema.futureLetters.userId, userId)).orderBy(desc(schema.futureLetters.createdAt));
  }
  async getFutureLetterById(id: number): Promise<FutureLetter | undefined> {
    return db.select().from(schema.futureLetters).where(eq(schema.futureLetters.id, id)).then(r => r[0]);
  }
  async updateFutureLetter(id: number, data: Partial<InsertFutureLetter>): Promise<FutureLetter | undefined> {
    const [letter] = await db.update(schema.futureLetters).set({ ...data, updatedAt: new Date() }).where(eq(schema.futureLetters.id, id)).returning();
    return letter;
  }
  async deleteFutureLetter(id: number): Promise<void> {
    await db.delete(schema.futureLetters).where(eq(schema.futureLetters.id, id));
  }
  async getDueLetters(): Promise<FutureLetter[]> {
    return db.select().from(schema.futureLetters)
      .where(and(eq(schema.futureLetters.status, "scheduled"), lte(schema.futureLetters.deliverAt, new Date())));
  }
  async getLettersInbox(userId: number): Promise<FutureLetter[]> {
    // Letters delivered to this user (recipient_user_id matches) or to their email
    const user = await this.getUserById(userId);
    if (!user) return [];
    const all = await db.select().from(schema.futureLetters).where(eq(schema.futureLetters.status, "delivered"));
    return all.filter(l =>
      l.recipientUserId === userId ||
      (l.recipientType === "self" && l.userId === userId) ||
      (user.email && l.recipientEmail?.toLowerCase() === user.email.toLowerCase())
    ).sort((a, b) => {
      const da = a.deliveredAt?.getTime() || 0;
      const db2 = b.deliveredAt?.getTime() || 0;
      return db2 - da;
    });
  }

  // ── Notifications ──────────────────────────────────────────────────────
  async createNotification(data: InsertNotification): Promise<Notification> {
    const [n] = await db.insert(schema.notifications).values(data).returning();
    return n;
  }
  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return db.select().from(schema.notifications).where(eq(schema.notifications.userId, userId)).orderBy(desc(schema.notifications.createdAt));
  }
  async getUnreadNotificationCount(userId: number): Promise<number> {
    const all = await db.select().from(schema.notifications)
      .where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.read, false)));
    return all.length;
  }
  async markNotificationRead(id: number): Promise<void> {
    await db.update(schema.notifications).set({ read: true }).where(eq(schema.notifications.id, id));
  }

  // ── Photo Memories ──────────────────────────────────────────────────────
  async getPhotoMemoriesByUser(userId: number): Promise<PhotoMemory[]> {
    return db.select().from(schema.photoMemories).where(eq(schema.photoMemories.userId, userId)).orderBy(desc(schema.photoMemories.createdAt));
  }
  async getPhotoMemoryById(id: number): Promise<PhotoMemory | undefined> {
    return db.select().from(schema.photoMemories).where(eq(schema.photoMemories.id, id)).then(r => r[0]);
  }
  async getPhotoMemoryCountByUser(userId: number): Promise<number> {
    const all = await db.select().from(schema.photoMemories).where(eq(schema.photoMemories.userId, userId));
    return all.length;
  }
  async createPhotoMemory(data: InsertPhotoMemory): Promise<PhotoMemory> {
    const [pm] = await db.insert(schema.photoMemories).values(data).returning();
    return pm;
  }
  async updatePhotoMemory(id: number, data: Partial<InsertPhotoMemory>): Promise<PhotoMemory | undefined> {
    const [pm] = await db.update(schema.photoMemories).set({ ...data, updatedAt: new Date() }).where(eq(schema.photoMemories.id, id)).returning();
    return pm;
  }
  async deletePhotoMemory(id: number): Promise<void> {
    await db.delete(schema.photoMemories).where(eq(schema.photoMemories.id, id));
  }

  // ── Persona Data Purge ────────────────────────────────────────────────────
  async deleteAllPersonaData(personaId: number): Promise<void> {
    await db.delete(schema.chatMessages).where(eq(schema.chatMessages.personaId, personaId));
    await db.delete(schema.memories).where(eq(schema.memories.personaId, personaId));
    await db.delete(schema.media).where(eq(schema.media.personaId, personaId));
    await db.delete(schema.traits).where(eq(schema.traits.personaId, personaId));
    await db.delete(schema.lifeStory).where(eq(schema.lifeStory.personaId, personaId));
    await db.delete(schema.milestoneMessages).where(eq(schema.milestoneMessages.personaId, personaId));
    await db.delete(schema.familyMembers).where(eq(schema.familyMembers.personaId, personaId));
    await db.delete(schema.writingStyles).where(eq(schema.writingStyles.personaId, personaId));
    await db.delete(schema.echoHeirs).where(eq(schema.echoHeirs.personaId, personaId));
    await db.delete(schema.echoTransfers).where(eq(schema.echoTransfers.personaId, personaId));
    await db.delete(schema.photoMemories).where(eq(schema.photoMemories.personaId, personaId));
    await db.delete(schema.personas).where(eq(schema.personas.id, personaId));
  }

  // ── Account Management ───────────────────────────────────────────────────
  async updateUserStatus(userId: number, status: string): Promise<User | undefined> {
    const [user] = await db.update(schema.users).set({ status }).where(eq(schema.users.id, userId)).returning();
    return user;
  }

  async deleteAllUserData(userId: number): Promise<void> {
    // Delete future letters, notifications, and photo memories
    await db.delete(schema.futureLetters).where(eq(schema.futureLetters.userId, userId));
    await db.delete(schema.notifications).where(eq(schema.notifications.userId, userId));
    await db.delete(schema.photoMemories).where(eq(schema.photoMemories.userId, userId));

    // Delete journal entries
    await db.delete(schema.journalEntries).where(eq(schema.journalEntries.userId, userId));

    // Get all personas belonging to this user
    const userPersonas = await this.getPersonasByUser(userId);
    const personaIds = userPersonas.map(p => p.id);

    // Delete all data associated with each persona
    for (const pid of personaIds) {
      await db.delete(schema.chatMessages).where(eq(schema.chatMessages.personaId, pid));
      await db.delete(schema.memories).where(eq(schema.memories.personaId, pid));
      await db.delete(schema.media).where(eq(schema.media.personaId, pid));
      await db.delete(schema.traits).where(eq(schema.traits.personaId, pid));
      await db.delete(schema.lifeStory).where(eq(schema.lifeStory.personaId, pid));
      await db.delete(schema.milestoneMessages).where(eq(schema.milestoneMessages.personaId, pid));
      await db.delete(schema.familyMembers).where(eq(schema.familyMembers.personaId, pid));
      await db.delete(schema.writingStyles).where(eq(schema.writingStyles.personaId, pid));
      await db.delete(schema.echoHeirs).where(eq(schema.echoHeirs.personaId, pid));
      await db.delete(schema.echoTransfers).where(eq(schema.echoTransfers.personaId, pid));
      await db.delete(schema.personas).where(eq(schema.personas.id, pid));
    }
  }

  async deleteUser(userId: number): Promise<void> {
    await db.delete(schema.users).where(eq(schema.users.id, userId));
  }

  // ── Subscriptions ────────────────────────────────────────────────────────
  async updateUserSubscription(userId: number, data: Partial<{
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    plan: string;
    planInterval: string | null;
    planExpiresAt: Date | null;
  }>): Promise<User | undefined> {
    const [user] = await db.update(schema.users).set(data).where(eq(schema.users.id, userId)).returning();
    return user;
  }
  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    return db.select().from(schema.users).where(eq(schema.users.stripeCustomerId, customerId)).then(r => r[0]);
  }
  async incrementMessageCount(userId: number): Promise<void> {
    const user = await this.getUserById(userId);
    if (user) {
      await db.update(schema.users).set({ totalMessagesSent: (user.totalMessagesSent ?? 0) + 1 }).where(eq(schema.users.id, userId));
    }
  }
  async getMonthlyMessageCount(userId: number): Promise<number> {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const result = await client`
      SELECT COUNT(*) as count
      FROM chat_messages cm
      INNER JOIN personas p ON cm.persona_id = p.id
      WHERE p.user_id = ${userId}
        AND cm.role = 'user'
        AND cm.created_at >= ${firstOfMonth}
    `;
    return parseInt(result[0]?.count || "0", 10);
  }
}

export const storage = new PgStorage();
