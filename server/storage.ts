import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
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
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    )`;

  await client`
    CREATE TABLE IF NOT EXISTS traits (
      id SERIAL PRIMARY KEY,
      persona_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`;

  await client`
    CREATE TABLE IF NOT EXISTS memories (
      id SERIAL PRIMARY KEY,
      persona_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      period TEXT,
      tags TEXT,
      contributed_by TEXT,
      contributor_code TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`;

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
      updated_at TIMESTAMP DEFAULT NOW()
    )`;

  await client`
    CREATE TABLE IF NOT EXISTS milestone_messages (
      id SERIAL PRIMARY KEY,
      persona_id INTEGER NOT NULL,
      recipient_name TEXT NOT NULL,
      occasion TEXT NOT NULL,
      delivery_date TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'ai',
      prewritten_content TEXT,
      delivered BOOLEAN DEFAULT FALSE,
      delivered_content TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`;

  await client`
    CREATE TABLE IF NOT EXISTS family_members (
      id SERIAL PRIMARY KEY,
      persona_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      relationship TEXT NOT NULL,
      access_code TEXT NOT NULL,
      filter_settings TEXT DEFAULT '{}',
      last_active_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`;

  await client`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      persona_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`;

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
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`;

  console.log("Database tables ready");
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
  getMilestone(id: number): Promise<Milestone | undefined>;
  createMilestone(data: InsertMilestone): Promise<Milestone>;
  updateMilestone(id: number, data: Partial<Milestone>): Promise<Milestone | undefined>;
  deleteMilestone(id: number): Promise<void>;
  getDueMilestones(): Promise<Milestone[]>;

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

  // Account management
  updateUserStatus(userId: number, status: string): Promise<User | undefined>;
  deleteAllUserData(userId: number): Promise<void>;
  deleteUser(userId: number): Promise<void>;

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
    return db.select().from(schema.milestoneMessages).where(eq(schema.milestoneMessages.personaId, personaId)).orderBy(schema.milestoneMessages.deliveryDate);
  }
  async getMilestone(id: number): Promise<Milestone | undefined> {
    return db.select().from(schema.milestoneMessages).where(eq(schema.milestoneMessages.id, id)).then(r => r[0]);
  }
  async createMilestone(data: InsertMilestone): Promise<Milestone> {
    const [m] = await db.insert(schema.milestoneMessages).values(data).returning();
    return m;
  }
  async updateMilestone(id: number, data: Partial<Milestone>): Promise<Milestone | undefined> {
    const [m] = await db.update(schema.milestoneMessages).set(data).where(eq(schema.milestoneMessages.id, id)).returning();
    return m;
  }
  async deleteMilestone(id: number): Promise<void> {
    await db.delete(schema.milestoneMessages).where(eq(schema.milestoneMessages.id, id));
  }
  async getDueMilestones(): Promise<Milestone[]> {
    const today = new Date().toISOString().split("T")[0];
    const all = await db.select().from(schema.milestoneMessages).where(eq(schema.milestoneMessages.delivered, false));
    return all.filter(m => m.deliveryDate <= today);
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

  // ── Account Management ───────────────────────────────────────────────────
  async updateUserStatus(userId: number, status: string): Promise<User | undefined> {
    const [user] = await db.update(schema.users).set({ status }).where(eq(schema.users.id, userId)).returning();
    return user;
  }

  async deleteAllUserData(userId: number): Promise<void> {
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
}

export const storage = new PgStorage();
