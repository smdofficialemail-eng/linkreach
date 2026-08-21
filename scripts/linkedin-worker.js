/**
 * LinkReach LinkedIn Worker
 *
 * Polls the database for queued extension jobs, executes them via
 * headless Chrome (Playwright), and reports results back.
 *
 * Usage:
 *   node scripts/linkedin-worker.js
 *
 * Environment:
 *   DATABASE_URL  — Neon/Postgres connection string
 *   AUTH_SECRET   — encryption key for stored passwords
 *   WORKER_POLL_MS — poll interval (default 30000)
 */

const { PrismaClient } = require("@prisma/client");
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const POLL_MS = parseInt(process.env.WORKER_POLL_MS || "30000", 10);
const SESSION_DIR = path.join(process.cwd(), ".linkedin-sessions");
const LOGIN_URL = "https://www.linkedin.com/login";
const FEED_URL = "https://www.linkedin.com/feed/";
const MAX_ACTIONS_PER_DAY = 15;

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

const prisma = new PrismaClient();
let running = false;

// ---------------------------------------------------------------------------
// Encryption (mirror of src/lib/crypto.ts)
// ---------------------------------------------------------------------------

const crypto = require("crypto");
const ALGORITHM = "aes-256-gcm";

function getKey() {
  const secret = process.env.AUTH_SECRET || "linkreach-dev-secret-change-in-production";
  return crypto.scryptSync(secret, "linkreach-linkedin-salt", 32);
}

function decrypt(encryptedBase64) {
  const key = getKey();
  const buf = Buffer.from(encryptedBase64, "base64");
  const iv = buf.subarray(0, 16);
  const authTag = buf.subarray(16, 32);
  const ciphertext = buf.subarray(32);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: 16 });
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext, undefined, "utf8") + decipher.final("utf8");
}

// ---------------------------------------------------------------------------
// Jitter helpers
// ---------------------------------------------------------------------------

function jitter(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

function getSessionPath(accountId) {
  return path.join(SESSION_DIR, accountId);
}

async function getLinkedInSession(account, email, password) {
  const sessionPath = getSessionPath(account.id);
  const statePath = path.join(sessionPath, "state.json");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--window-size=1920,1080",
    ],
  });

  let context;
  let page;

  // Try restoring saved session first.
  if (fs.existsSync(statePath)) {
    try {
      context = await browser.newContext({
        storageState: statePath,
        viewport: { width: 1920, height: 1080 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      });
      page = await context.newPage();
      await page.goto(FEED_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);

      if (!page.url().includes("/login")) {
        console.log(`[Worker] Session restored for ${account.name}`);
        return { browser, context, page };
      }
      console.log(`[Worker] Session expired for ${account.name}, re-logging in...`);
      await context.close();
    } catch (err) {
      console.log(`[Worker] Session restore failed for ${account.name}: ${err.message}`);
      try { await context.close(); } catch {}
    }
  }

  // Fresh login.
  context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  page = await context.newPage();
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Fill credentials.
  await page.fill('input[name="session_key"]', email, { timeout: 10000 });
  await sleep(jitter(300, 600));
  await page.fill('input[name="session_password"]', password, { timeout: 10000 });
  await sleep(jitter(500, 1000));

  // Click sign in.
  await page.click('button[type="submit"]', { timeout: 10000 });
  await page.waitForTimeout(5000);

  const url = page.url();
  if (url.includes("/checkpoint") || url.includes("/challenge")) {
    await browser.close();
    throw new Error("CAPTCHA detected — try again later or disable security challenges");
  }
  if (url.includes("/login") || url.includes("/checkpoint")) {
    const errEl = await page.$(".form__error, .login-form__error, #error-for-username, #error-for-password");
    const errText = errEl ? await errEl.textContent() : "Unknown error";
    await browser.close();
    throw new Error(`Login failed: ${errText}`);
  }

  // Save session.
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });
  await context.storageState({ path: statePath });
  console.log(`[Worker] Login successful for ${account.name}`);

  return { browser, context, page };
}

// ---------------------------------------------------------------------------
// Action execution
// ---------------------------------------------------------------------------

async function doConnect(page, message) {
  const connectBtn =
    (await page.$('button[aria-label*="Connect" i]:not([aria-label*="Disconnect"])')) ||
    (await page.$('button:has-text("Connect"):not(:has-text("Disconnect"))'));

  if (!connectBtn) {
    const pending = await page.$('button:has-text("Pending"), button:has-text("Following")');
    if (pending) return { ok: false, note: "Already connected or pending" };
    return { ok: false, note: "Connect button not found" };
  }

  await connectBtn.click();
  await sleep(jitter(1500, 2500));

  if (message) {
    const personalizeBtn =
      (await page.$('button:has-text("Personalize invite")')) ||
      (await page.$('button:has-text("Add a note")'));
    if (personalizeBtn) {
      await personalizeBtn.click();
      await sleep(jitter(800, 1500));
    }

    const input =
      (await page.$('textarea[aria-label*="note" i]')) ||
      (await page.$('textarea[aria-label*="message" i]')) ||
      (await page.$('div[contenteditable="true"][role="textbox"]'));

    if (input) {
      await input.focus();
      await sleep(200);
      const isContentEditable = await input.getAttribute("contenteditable");
      if (isContentEditable) {
        await page.keyboard.type(message, { delay: jitter(30, 80) });
      } else {
        await input.fill(message);
      }
    }
  }

  const sendBtn =
    (await page.$('button:has-text("Send")')) ||
    (await page.$('button:has-text("Send without a note")')) ||
    (await page.$('button:has-text("Send invite")'));

  if (sendBtn) {
    await sendBtn.click();
    await sleep(jitter(1000, 2000));
  }

  return { ok: true, note: message ? "Connection request sent with note" : "Connection request sent" };
}

async function doMessage(page, message) {
  const msgBtn =
    (await page.$('button[aria-label*="Message" i]')) ||
    (await page.$('button:has-text("Message")'));

  if (!msgBtn) return { ok: false, note: "Message button not found" };

  await msgBtn.click();
  await sleep(jitter(2000, 3000));

  const input =
    (await page.$('div[contenteditable="true"][role="textbox"]')) ||
    (await page.$('textarea[placeholder*="message" i]')) ||
    (await page.$('.msg-form__contenteditable'));

  if (!input) return { ok: false, note: "Message input not found" };

  await input.focus();
  await sleep(200);
  const isContentEditable = await input.getAttribute("contenteditable");
  if (isContentEditable) {
    await page.keyboard.type(message, { delay: jitter(30, 80) });
  } else {
    await input.fill(message);
  }
  await sleep(jitter(500, 1000));

  const sendBtn =
    (await page.$('button[aria-label*="Send" i]')) ||
    (await page.$('button:has-text("Send")'));

  if (sendBtn) {
    await sendBtn.click();
  } else {
    await page.keyboard.press("Enter");
  }

  await sleep(jitter(800, 1500));
  return { ok: true, note: "Message sent" };
}

async function doReaction(page) {
  const likeBtn =
    (await page.$('button[aria-label*="Like" i]')) ||
    (await page.$('button:has-text("Like")'));

  if (!likeBtn) return { ok: false, note: "Like button not found" };

  await likeBtn.click();
  await sleep(jitter(500, 1000));
  return { ok: true, note: "Liked" };
}

// ---------------------------------------------------------------------------
// Job processing
// ---------------------------------------------------------------------------

async function processJob(job) {
  const lead = await prisma.lead.findUnique({ where: { id: job.leadId } });
  if (!lead) {
    console.log(`[Worker] Lead ${job.leadId} not found — skipping job ${job.id}`);
    return;
  }

  const account = job.linkedinAccountId
    ? await prisma.linkedinAccount.findUnique({ where: { id: job.linkedinAccountId } })
    : await prisma.linkedinAccount.findFirst({ where: { workspaceId: job.workspaceId, status: "active" } });

  if (!account || !account.linkedinLogin || !account.passwordEnc) {
    console.log(`[Worker] No LinkedIn credentials for workspace ${job.workspaceId} — skipping`);
    return;
  }

  // Check daily limit.
  const today = new Date().toISOString().slice(0, 10);
  if (account.sentTodayDate !== today) {
    await prisma.linkedinAccount.update({
      where: { id: account.id },
      data: { sentToday: 0, sentTodayDate: today },
    });
    account.sentToday = 0;
  }

  if (account.sentToday >= MAX_ACTIONS_PER_DAY) {
    console.log(`[Worker] Daily limit reached for ${account.name} (${account.sentToday}/${MAX_ACTIONS_PER_DAY})`);
    return;
  }

  // Warm-up check.
  if (account.warmupDay < 14) {
    const warmupLimit = Math.min(3 + account.warmupDay, MAX_ACTIONS_PER_DAY);
    if (account.sentToday >= warmupLimit) {
      console.log(`[Worker] Warm-up limit for day ${account.warmupDay}: ${account.sentToday}/${warmupLimit}`);
      return;
    }
  }

  // Decrypt password and perform action.
  const password = decrypt(account.passwordEnc);
  const profile = lead.linkedinUrl || "";
  if (!profile) {
    console.log(`[Worker] No LinkedIn URL for lead ${lead.name} — skipping`);
    return;
  }

  let context, page, browser;
  try {
    const session = await getLinkedInSession(account, account.linkedinLogin, password);
    browser = session.browser;
    context = session.context;
    page = session.page;

    const payload = job.payload || {};
    const message = payload.template || payload.note || "";

    let result;
    switch (job.action) {
      case "connect":
        result = await doConnect(page, message);
        break;
      case "message":
      case "follow_up":
        result = await doMessage(page, message);
        break;
      case "reaction":
        result = await doReaction(page);
        break;
      default:
        result = { ok: false, note: `Unknown action: ${job.action}` };
    }

    // Update job status.
    await prisma.extensionJob.update({
      where: { id: job.id },
      data: {
        status: result.ok ? "done" : "failed",
        error: result.ok ? null : result.note,
      },
    });

    // Update account counters.
    await prisma.linkedinAccount.update({
      where: { id: account.id },
      data: {
        sentToday: account.sentToday + 1,
        lastSessionAt: new Date(),
        sessionStatus: "logged_in",
      },
    });

    // Update campaign member status.
    if (job.memberId && result.ok) {
      const member = await prisma.campaignMember.findUnique({ where: { id: job.memberId } });
      if (member) {
        const update = {};
        if (member.status === "queued") {
          update.status = "sent";
          update.sentAt = new Date();
        } else if (member.status === "sent") {
          update.status = "accepted";
          update.acceptedAt = new Date();
        }
        if (Object.keys(update).length) {
          await prisma.campaignMember.update({ where: { id: job.memberId }, data: update });
        }
      }
    }

    // Create conversation + message.
    if (result.ok) {
      let conv = await prisma.conversation.findFirst({
        where: { workspaceId: job.workspaceId, leadId: job.leadId },
      });
      if (!conv) {
        conv = await prisma.conversation.create({
          data: {
            workspaceId: job.workspaceId,
            linkedinAccountId: account.id,
            leadId: job.leadId,
            lastMessageAt: new Date(),
          },
        });
      }
      const msgText = (job.payload?.template || job.payload?.note || `${job.action} executed`).slice(0, 4000);
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          direction: "out",
          body: msgText,
          status: "sent",
          sentAt: new Date(),
        },
      });
      await prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date() } });

      await prisma.activityLog.create({
        data: {
          workspaceId: job.workspaceId,
          campaignId: job.campaignId,
          type: "sent",
          message: `${lead.name} — ${job.action} executed via server automation`,
        },
      });
    }

    console.log(`[Worker] Job ${job.id}: ${result.ok ? "✓" : "✗"} ${result.note}`);
  } catch (err) {
    console.error(`[Worker] Job ${job.id} error: ${err.message}`);
    await prisma.extensionJob.update({
      where: { id: job.id },
      data: { status: "failed", error: err.message.slice(0, 500) },
    });
    await prisma.linkedinAccount.update({
      where: { id: account.id },
      data: { sessionStatus: "session_expired" },
    });
  } finally {
    if (context) try { await context.close(); } catch {}
    if (browser) try { await browser.close(); } catch {}
  }
}

// ---------------------------------------------------------------------------
// Main poll loop
// ---------------------------------------------------------------------------

async function poll() {
  if (running) return;
  running = true;

  try {
    const jobs = await prisma.extensionJob.findMany({
      where: { status: "queued" },
      orderBy: { createdAt: "asc" },
      take: 3,
    });

    if (jobs.length) {
      console.log(`[Worker] Processing ${jobs.length} job(s)...`);
    }

    for (const job of jobs) {
      // Mark as in-progress.
      await prisma.extensionJob.update({
        where: { id: job.id },
        data: { status: "in_progress", claimedAt: new Date() },
      });

      await processJob(job);

      // Delay between jobs (human-speed).
      await sleep(jitter(4000, 9000));
    }
  } catch (err) {
    console.error("[Worker] Poll error:", err.message);
  } finally {
    running = false;
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  console.log("[Worker] LinkReach LinkedIn Worker started");
  console.log(`[Worker] Polling every ${POLL_MS / 1000}s, max ${MAX_ACTIONS_PER_DAY} actions/day`);
  console.log(`[Worker] Database: ${process.env.DATABASE_URL?.split("@")[1]?.split("?")[0] || "configured"}`);

  // Initial poll.
  await poll();

  // Continuous polling.
  setInterval(poll, POLL_MS);
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});
