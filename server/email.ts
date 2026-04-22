// ── Email Utility ─────────────────────────────────────────────────────────────
// Stub email delivery — logs to console for now.
// Replace sendEmail() internals with nodemailer/SendGrid when ready.

const APP_URL = process.env.APP_URL || "https://echome-production-a33e.up.railway.app";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  console.log(`[EMAIL] To: ${options.to}`);
  console.log(`[EMAIL] Subject: ${options.subject}`);
  console.log(`[EMAIL] Body preview: ${options.html.replace(/<[^>]*>/g, "").slice(0, 200)}...`);
}

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f0e8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f0e8;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background-color:#fffdf8;border-radius:12px;overflow:hidden;border:1px solid #e8e0d4;">
        <!-- Header -->
        <tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #f0e8dc;">
          <h1 style="margin:0;font-size:24px;font-weight:600;color:#3d2e24;font-family:Georgia,'Times New Roman',serif;">Echo Me</h1>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:32px 40px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 40px 32px;text-align:center;border-top:1px solid #f0e8dc;">
          <p style="margin:0;font-size:12px;color:#9a8d82;">
            <a href="${APP_URL}/#/faq" style="color:#8b5e6b;text-decoration:none;">FAQ</a> &nbsp;·&nbsp;
            <a href="${APP_URL}/#/privacy" style="color:#8b5e6b;text-decoration:none;">Privacy</a>
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:#b5a99a;">© ${new Date().getFullYear()} Echo Me. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#3d2e24;font-family:Georgia,'Times New Roman',serif;">
      Welcome, ${name}!
    </h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5c4a3f;">
      Echo Me helps you create living memories of the people you love. Start by creating your first Echo — answer a few questions about someone special, and watch their voice come to life.
    </p>
    <h3 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#3d2e24;font-family:Georgia,'Times New Roman',serif;">
      Get started in 3 steps:
    </h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="padding:10px 0;font-size:15px;line-height:1.5;color:#5c4a3f;">
        <span style="display:inline-block;width:28px;height:28px;border-radius:50%;background-color:#8b5e6b;color:white;text-align:center;line-height:28px;font-size:13px;font-weight:600;margin-right:10px;vertical-align:middle;">1</span>
        <strong>Create an Echo</strong> — choose someone whose voice you want to preserve
      </td></tr>
      <tr><td style="padding:10px 0;font-size:15px;line-height:1.5;color:#5c4a3f;">
        <span style="display:inline-block;width:28px;height:28px;border-radius:50%;background-color:#8b5e6b;color:white;text-align:center;line-height:28px;font-size:13px;font-weight:600;margin-right:10px;vertical-align:middle;">2</span>
        <strong>Answer personality questions</strong> — share what makes them unique
      </td></tr>
      <tr><td style="padding:10px 0;font-size:15px;line-height:1.5;color:#5c4a3f;">
        <span style="display:inline-block;width:28px;height:28px;border-radius:50%;background-color:#8b5e6b;color:white;text-align:center;line-height:28px;font-size:13px;font-weight:600;margin-right:10px;vertical-align:middle;">3</span>
        <strong>Start a conversation</strong> — hear their voice come alive
      </td></tr>
    </table>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}" style="display:inline-block;padding:12px 32px;background-color:#8b5e6b;color:white;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
        Open Echo Me
      </a>
    </div>
    <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#7a6d63;font-style:italic;text-align:center;">
      Every voice matters. Thank you for preserving the ones you love.
    </p>`;

  await sendEmail({
    to: email,
    subject: "Welcome to Echo Me — let's preserve the voices that matter",
    html: emailLayout(content),
  });
}

// ── Phase 2: Heir / Transfer Emails ────────────────────────────────────────

export async function sendHeirInvitationEmail(
  heirEmail: string,
  heirName: string | null,
  personaName: string,
  creatorName: string,
  claimToken: string,
  personalMessage?: string,
): Promise<void> {
  const claimUrl = `${APP_URL}/#/heirs/claim/${claimToken}`;
  const greeting = heirName ? `Dear ${heirName}` : "Hello";
  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#3d2e24;font-family:Georgia,'Times New Roman',serif;">
      ${greeting},
    </h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5c4a3f;">
      ${creatorName} has chosen you to inherit access to <strong>${personaName}'s Echo</strong> — a living collection of memories, stories, and conversations that keeps ${personaName}'s voice alive.
    </p>
    ${personalMessage ? `
    <div style="margin:16px 0;padding:16px 20px;border-left:3px solid #8b5e6b;background-color:#faf7f4;border-radius:0 8px 8px 0;">
      <p style="margin:0;font-size:14px;line-height:1.5;color:#5c4a3f;font-style:italic;">"${personalMessage}"</p>
      <p style="margin:8px 0 0;font-size:13px;color:#7a6d63;">— ${creatorName}</p>
    </div>
    ` : ""}
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5c4a3f;">
      Echo Me helps families preserve the voices of the people they love. When you claim this Echo, you'll be able to:
    </p>
    <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.8;color:#5c4a3f;">
      <li>Have conversations with ${personaName}'s Echo, powered by their memories and personality</li>
      <li>See the stories, documents, and family history that have been shared</li>
      <li>Add your own memories and perspectives</li>
    </ul>
    <div style="text-align:center;margin:24px 0;">
      <a href="${claimUrl}" style="display:inline-block;padding:12px 32px;background-color:#8b5e6b;color:white;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
        Claim Your Access
      </a>
    </div>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#9a8d82;text-align:center;">
      This invitation was sent by ${creatorName} through Echo Me.
    </p>`;

  await sendEmail({
    to: heirEmail,
    subject: `You've been chosen to inherit ${personaName}'s Echo`,
    html: emailLayout(content),
  });
}

export async function sendTransferExecutedEmail(
  heirEmail: string,
  heirName: string | null,
  personaName: string,
  claimToken: string,
): Promise<void> {
  const claimUrl = `${APP_URL}/#/heirs/claim/${claimToken}`;
  const greeting = heirName ? `Dear ${heirName}` : "Hello";
  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#3d2e24;font-family:Georgia,'Times New Roman',serif;">
      ${greeting},
    </h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5c4a3f;">
      <strong>${personaName}'s Echo</strong> has been shared with you. This Echo carries their voice, memories, and the love they wanted to pass along.
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#5c4a3f;">
      Whenever you're ready, you can claim access and begin exploring everything that's been preserved.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${claimUrl}" style="display:inline-block;padding:12px 32px;background-color:#8b5e6b;color:white;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
        Open ${personaName}'s Echo
      </a>
    </div>
    <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#7a6d63;font-style:italic;text-align:center;">
      Their voice lives on through the people who love them.
    </p>`;

  await sendEmail({
    to: heirEmail,
    subject: `${personaName}'s Echo is now shared with you`,
    html: emailLayout(content),
  });
}

export async function sendLetterDeliveryEmail(
  recipientEmail: string,
  recipientName: string | null,
  authorName: string,
  letterTitle: string,
  letterContent: string,
  writtenAt: Date,
  letterId: number,
): Promise<void> {
  const greeting = recipientName ? `Dear ${recipientName}` : "Hello";
  const writtenDate = writtenAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#3d2e24;font-family:Georgia,'Times New Roman',serif;">
      ${greeting},
    </h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5c4a3f;">
      A letter from <strong>${authorName}</strong> has arrived — it was written on ${writtenDate} and scheduled to reach you today.
    </p>
    <div style="margin:20px 0;padding:20px 24px;border-left:3px solid #8b5e6b;background-color:#faf7f4;border-radius:0 8px 8px 0;">
      <h3 style="margin:0 0 12px;font-size:17px;font-weight:600;color:#3d2e24;font-family:Georgia,'Times New Roman',serif;">
        ${letterTitle}
      </h3>
      <div style="margin:0;font-size:14px;line-height:1.7;color:#5c4a3f;white-space:pre-wrap;">${letterContent}</div>
    </div>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#9a8d82;font-style:italic;">
      This message was written on ${writtenDate} and scheduled to arrive today.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/#/letters/inbox" style="display:inline-block;padding:12px 32px;background-color:#8b5e6b;color:white;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
        View in Echo Me
      </a>
    </div>`;

  await sendEmail({
    to: recipientEmail,
    subject: `A letter from ${authorName} — scheduled for today`,
    html: emailLayout(content),
  });
}

export async function sendHeirClaimedEmail(
  recipientEmail: string,
  recipientName: string | null,
  claimerName: string,
  claimerRelationship: string | null,
  personaName: string,
): Promise<void> {
  const greeting = recipientName ? `Hi ${recipientName}` : "Hello";
  const relationshipText = claimerRelationship ? ` (${claimerRelationship})` : "";
  const content = `
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#3d2e24;font-family:Georgia,'Times New Roman',serif;">
      ${greeting},
    </h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5c4a3f;">
      <strong>${claimerName}</strong>${relationshipText} has claimed access to <strong>${personaName}'s Echo</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#5c4a3f;">
      They can now have conversations with ${personaName}'s Echo and explore the memories and stories that have been preserved. The Echo continues to grow with each person who contributes to it.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}" style="display:inline-block;padding:12px 32px;background-color:#8b5e6b;color:white;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
        Open Echo Me
      </a>
    </div>`;

  await sendEmail({
    to: recipientEmail,
    subject: `${claimerName} has claimed access to ${personaName}'s Echo`,
    html: emailLayout(content),
  });
}
