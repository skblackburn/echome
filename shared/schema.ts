import { pgTable, text, integer, boolean, timestamp, serial, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan").notNull().default("free"),
  planInterval: text("plan_interval"),
  planExpiresAt: timestamp("plan_expires_at"),
  totalMessagesSent: integer("total_messages_sent").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── Personas ────────────────────────────────────────────────────────────────
export const personas = pgTable("personas", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(),
  birthYear: text("birth_year"),
  photo: text("photo"),
  bio: text("bio"),
  spouse: text("spouse"),
  children: text("children"),
  pronouns: text("pronouns"),
  birthPlace: text("birth_place"),
  selfMode: boolean("self_mode").default(false),
  creatorName: text("creator_name"),
  creatorRelationship: text("creator_relationship"),
  creatorNote: text("creator_note"),
  deathYear: text("death_year"),
  remembranceDate: text("remembrance_date"),
  passingDate: text("passing_date"),
  isLiving: boolean("is_living").default(true),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPersonaSchema = createInsertSchema(personas).omit({ id: true, createdAt: true });
export type InsertPersona = z.infer<typeof insertPersonaSchema>;
export type Persona = typeof personas.$inferSelect;

// ─── Traits ──────────────────────────────────────────────────────────────────
export const traits = pgTable("traits", {
  id: serial("id").primaryKey(),
  personaId: integer("persona_id").notNull(),
  category: text("category").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertTraitSchema = createInsertSchema(traits).omit({ id: true, createdAt: true });
export type InsertTrait = z.infer<typeof insertTraitSchema>;
export type Trait = typeof traits.$inferSelect;

// ─── Memories ────────────────────────────────────────────────────────────────
export const memories = pgTable("memories", {
  id: serial("id").primaryKey(),
  personaId: integer("persona_id").notNull(),
  type: text("type").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  period: text("period"),
  tags: text("tags"),
  documentType: text("document_type").default("voice"),
  contributedBy: text("contributed_by"),
  contributorCode: text("contributor_code"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertMemorySchema = createInsertSchema(memories).omit({ id: true, createdAt: true });
export type InsertMemory = z.infer<typeof insertMemorySchema>;
export type Memory = typeof memories.$inferSelect;

// ─── Media ───────────────────────────────────────────────────────────────────
export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  personaId: integer("persona_id").notNull(),
  type: text("type").notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertMediaSchema = createInsertSchema(media).omit({ id: true, createdAt: true });
export type InsertMedia = z.infer<typeof insertMediaSchema>;
export type Media = typeof media.$inferSelect;

// ─── Life Story ───────────────────────────────────────────────────────────────
export const lifeStory = pgTable("life_story", {
  id: serial("id").primaryKey(),
  personaId: integer("persona_id").notNull().unique(),
  favoriteFood: text("favorite_food"),
  favoriteMusic: text("favorite_music"),
  favoriteSmell: text("favorite_smell"),
  favoritePlace: text("favorite_place"),
  catchphrase: text("catchphrase"),
  loveLanguage: text("love_language"),
  humor: text("humor"),
  hardTimes: text("hard_times"),
  hometown: text("hometown"),
  career: text("career"),
  proudestMoment: text("proudest_moment"),
  hardestPeriod: text("hardest_period"),
  wishForFamily: text("wish_for_family"),
  whatToRemember: text("what_to_remember"),
  unfinshedBusiness: text("unfinished_business"),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertLifeStorySchema = createInsertSchema(lifeStory).omit({ id: true, updatedAt: true });
export type InsertLifeStory = z.infer<typeof insertLifeStorySchema>;
export type LifeStory = typeof lifeStory.$inferSelect;

// ─── Milestone Messages ───────────────────────────────────────────────────────
export const milestoneMessages = pgTable("milestone_messages", {
  id: serial("id").primaryKey(),
  personaId: integer("persona_id").notNull(),
  userId: integer("user_id"),
  title: text("title").notNull(),
  occasion: text("occasion").notNull(),
  recipientName: text("recipient_name").notNull(),
  recipientEmail: text("recipient_email"),
  messagePrompt: text("message_prompt"),
  generatedMessage: text("generated_message"),
  scheduledDate: text("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time").notNull().default("09:00"),
  timezone: text("timezone").default("America/New_York"),
  isRecurring: boolean("is_recurring").default(false),
  status: text("status").notNull().default("scheduled"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertMilestoneSchema = createInsertSchema(milestoneMessages).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Milestone = typeof milestoneMessages.$inferSelect;

// ─── Family Members ───────────────────────────────────────────────────────────
export const familyMembers = pgTable("family_members", {
  id: serial("id").primaryKey(),
  personaId: integer("persona_id").notNull(),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(),
  accessCode: text("access_code").notNull(),
  birthYear: integer("birth_year"),
  note: text("note"),
  filterSettings: text("filter_settings").default("{}"),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({ id: true, createdAt: true });
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type FamilyMember = typeof familyMembers.$inferSelect;

// ─── Chat Messages ────────────────────────────────────────────────────────────
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  personaId: integer("persona_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// ─── Writing Styles ──────────────────────────────────────────────────────────
export const writingStyles = pgTable("writing_styles", {
  id: serial("id").primaryKey(),
  personaId: integer("persona_id").notNull().unique(),
  sentenceStructure: text("sentence_structure"),
  vocabularyLevel: text("vocabulary_level"),
  punctuationHabits: text("punctuation_habits"),
  toneAndEmotion: text("tone_and_emotion"),
  commonPhrases: text("common_phrases"),
  formality: text("formality"),
  narrativeStyle: text("narrative_style"),
  quirks: text("quirks"),
  overallSummary: text("overall_summary"),
  analyzedDocumentCount: integer("analyzed_document_count").default(0),
  lastAnalyzedAt: timestamp("last_analyzed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertWritingStyleSchema = createInsertSchema(writingStyles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWritingStyle = z.infer<typeof insertWritingStyleSchema>;
export type WritingStyle = typeof writingStyles.$inferSelect;
