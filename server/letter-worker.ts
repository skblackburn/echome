// ── Letter Delivery Worker ────────────────────────────────────────────────────
// Runs every 5 minutes to deliver scheduled letters whose deliver_at has passed.

import { storage } from "./storage";
import { sendLetterDeliveryEmail } from "./email";

const DELIVERY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function deliverDueLetters(): Promise<void> {
  try {
    const dueLetters = await storage.getDueLetters();
    if (dueLetters.length === 0) return;

    console.log(`[LETTER-WORKER] Found ${dueLetters.length} letters to deliver`);

    for (const letter of dueLetters) {
      try {
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

        // Mark as delivered
        await storage.updateFutureLetter(letter.id, {
          status: "delivered",
          deliveredAt: new Date(),
        } as any);

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

export function startLetterDeliveryWorker(): void {
  console.log("[LETTER-WORKER] Starting letter delivery worker (every 5 minutes)");

  // Run once immediately on startup
  deliverDueLetters();

  // Then run every 5 minutes
  setInterval(deliverDueLetters, DELIVERY_INTERVAL_MS);
}
