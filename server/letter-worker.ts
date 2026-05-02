// ── Letter Delivery Worker ────────────────────────────────────────────────────
// Runs every 5 minutes to deliver scheduled letters whose deliver_at has passed.
// Extended for The Folder: recurring letters, sealed-until-passing, and milestone-based delivery.

import { storage } from "./storage";
import { sendLetterDeliveryEmail, sendLetterAuthorReminder } from "./email";

const DELIVERY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function deliverDueLetters(): Promise<void> {
  try {
    const dueLetters = await storage.getDueLetters();
    if (dueLetters.length === 0) return;

    console.log(`[LETTER-WORKER] Found ${dueLetters.length} letters to deliver`);

    for (const letter of dueLetters) {
      try {
        // Skip milestone-based and sealed-until-passing — those are triggered by events, not cron
        if (letter.deliveryRuleType === "milestone" || letter.deliveryRuleType === "sealed_until_passing") {
          continue;
        }

        const author = await storage.getUserById(letter.userId);
        const authorName = author?.name || "Someone";

        // Send email if we have a recipient email
        if (letter.recipientEmail) {
          await sendLetterDeliveryEmail(
            letter.recipientEmail,
            letter.recipientName,
            authorName,
            letter.title,
            letter.content,
            letter.createdAt || new Date(),
            letter.id,
          );
        }

        // Create in-app notification for the recipient if they have an account
        const recipientUserId = letter.recipientUserId
          || (letter.recipientType === "self" ? letter.userId : null);

        if (recipientUserId) {
          await storage.createNotification({
            userId: recipientUserId,
            type: "letter_delivered",
            title: `A letter from ${authorName} has arrived`,
            message: letter.title,
            referenceId: letter.id,
            read: false,
          });
        }

        if (letter.recurring) {
          // Recurring letter: schedule next year's delivery instead of marking fully delivered
          const nextDeliverAt = new Date(letter.deliverAt);
          nextDeliverAt.setFullYear(nextDeliverAt.getFullYear() + 1);
          await storage.updateFutureLetter(letter.id, {
            deliverAt: nextDeliverAt,
            // Keep status as 'scheduled' so it fires again next year
          } as any);
          console.log(`[LETTER-WORKER] Recurring letter ${letter.id} rescheduled to ${nextDeliverAt.toISOString()}`);
        } else {
          // One-time letter: mark as delivered
          await storage.updateFutureLetter(letter.id, {
            status: "delivered",
            deliveredAt: new Date(),
          } as any);
        }

        console.log(`[LETTER-WORKER] Delivered letter ${letter.id} to ${letter.recipientEmail || "in-app"}`);
      } catch (err) {
        console.error(`[LETTER-WORKER] Failed to deliver letter ${letter.id}:`, err);
        await storage.updateFutureLetter(letter.id, { status: "failed" } as any);
      }
    }
  } catch (err) {
    console.error("[LETTER-WORKER] Error checking for due letters:", err);
  }
}

async function sendUpcomingDeliveryReminders(): Promise<void> {
  try {
    const letters = await storage.getLettersNeedingReminder();
    if (letters.length === 0) return;

    console.log(`[LETTER-WORKER] Found ${letters.length} letters needing delivery reminders`);

    for (const letter of letters) {
      try {
        const author = await storage.getUserById(letter.userId);
        if (!author?.email) {
          console.warn(`[LETTER-WORKER] No email for author ${letter.userId}, skipping reminder for letter ${letter.id}`);
          continue;
        }

        await sendLetterAuthorReminder(
          author.email,
          author.name,
          letter.recipientName,
          letter.recipientEmail,
          letter.title,
          letter.deliverAt,
          letter.id,
        );

        await storage.updateFutureLetter(letter.id, { reminderSentAt: new Date() } as any);
        console.log(`[LETTER-WORKER] Sent delivery reminder for letter ${letter.id} to ${author.email}`);
      } catch (err) {
        console.error(`[LETTER-WORKER] Failed to send reminder for letter ${letter.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[LETTER-WORKER] Error checking for upcoming delivery reminders:", err);
  }
}

// Deliver sealed-until-passing letters when an Echo transfer executes
// Called from transfer execution logic
export async function deliverSealedLetters(personaId: number): Promise<number> {
  let deliveredCount = 0;
  try {
    const sealedLetters = await storage.getSealedLettersByPersona(personaId);
    if (sealedLetters.length === 0) return 0;

    console.log(`[LETTER-WORKER] Delivering ${sealedLetters.length} sealed letters for persona ${personaId}`);

    for (const letter of sealedLetters) {
      try {
        const author = await storage.getUserById(letter.userId);
        const authorName = author?.name || "Someone";

        if (letter.recipientEmail) {
          await sendLetterDeliveryEmail(
            letter.recipientEmail,
            letter.recipientName,
            authorName,
            letter.title,
            letter.content,
            letter.createdAt || new Date(),
            letter.id,
          );
        }

        const recipientUserId = letter.recipientUserId
          || (letter.recipientType === "self" ? letter.userId : null);

        if (recipientUserId) {
          await storage.createNotification({
            userId: recipientUserId,
            type: "letter_delivered",
            title: `A sealed letter from ${authorName} has been opened`,
            message: letter.title,
            referenceId: letter.id,
            read: false,
          });
        }

        await storage.updateFutureLetter(letter.id, {
          status: "delivered",
          deliveredAt: new Date(),
        } as any);

        deliveredCount++;
        console.log(`[LETTER-WORKER] Delivered sealed letter ${letter.id}`);
      } catch (err) {
        console.error(`[LETTER-WORKER] Failed to deliver sealed letter ${letter.id}:`, err);
      }
    }
  } catch (err) {
    console.error(`[LETTER-WORKER] Error delivering sealed letters for persona ${personaId}:`, err);
  }
  return deliveredCount;
}

export function startLetterDeliveryWorker(): void {
  console.log("[LETTER-WORKER] Starting letter delivery worker (every 5 minutes)");

  // Run once immediately on startup
  deliverDueLetters();
  sendUpcomingDeliveryReminders();

  // Then run every 5 minutes
  setInterval(() => {
    deliverDueLetters();
    sendUpcomingDeliveryReminders();
  }, DELIVERY_INTERVAL_MS);
}
