/**
 * Server-side LinkedIn session manager.
 * Uses Playwright to run headless Chrome, log into LinkedIn,
 * and perform actions (connect, message, etc.).
 *
 * Sessions are stored in a local directory so the browser doesn't
 * need to re-login on every worker cycle.
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import path from "path";
import fs from "fs";

const SESSION_DIR = path.join(process.cwd(), ".linkedin-sessions");
const LOGIN_URL = "https://www.linkedin.com/login";
const FEED_URL = "https://www.linkedin.com/feed/";

// Ensure session directory exists.
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

function getSessionPath(accountId: string): string {
  return path.join(SESSION_DIR, accountId);
}

/**
 * Login to LinkedIn using stored credentials.
 * Returns a BrowserContext with an active session, or throws on failure.
 */
export async function loginLinkedIn(
  accountId: string,
  email: string,
  password: string
): Promise<{ context: BrowserContext; page: Page }> {
  const sessionPath = getSessionPath(accountId);

  // Try to restore a saved session first.
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

  let context: BrowserContext;

  // Check if we have a saved session.
  const storageStatePath = path.join(sessionPath, "state.json");
  if (fs.existsSync(storageStatePath)) {
    try {
      context = await browser.newContext({
        storageState: storageStatePath,
        viewport: { width: 1920, height: 1080 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      });
      const page = await context.newPage();

      // Check if the session is still valid by visiting the feed.
      await page.goto(FEED_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);

      // If we're redirected to login, the session expired.
      if (page.url().includes("/login")) {
        console.log(`[LinkedIn] Session expired for ${accountId}, re-logging in...`);
        await context.close();
        await browser.close();
        return loginLinkedInFresh(accountId, email, password);
      }

      console.log(`[LinkedIn] Session restored for ${accountId}`);
      return { context, page };
    } catch (err) {
      console.log(`[LinkedIn] Session restore failed for ${accountId}: ${err}`);
      try { await context!.close(); } catch {}
      await browser.close();
      return loginLinkedInFresh(accountId, email, password);
    }
  }

  // No saved session — fresh login.
  return loginLinkedInFresh(accountId, email, password);
}

async function loginLinkedInFresh(
  accountId: string,
  email: string,
  password: string
): Promise<{ context: BrowserContext; page: Page }> {
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

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });

  // Remove webdriver detection markers.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    // Remove Playwright/Chromium automation flags.
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  });

  const page = await context.newPage();
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Fill in credentials.
  await page.fill('input[name="session_key"]', email, { timeout: 10000 });
  await page.waitForTimeout(jitter(300, 600));
  await page.fill('input[name="session_password"]', password, { timeout: 10000 });
  await page.waitForTimeout(jitter(500, 1000));

  // Click sign in.
  await page.click('button[type="submit"]', { timeout: 10000 });
  await page.waitForTimeout(5000);

  // Check for CAPTCHA or security challenges.
  const url = page.url();
  if (url.includes("/checkpoint") || url.includes("/challenge")) {
    console.warn(`[LinkedIn] CAPTCHA/challenge detected for ${accountId} — manual intervention required`);
    await browser.close();
    throw new Error("CAPTCHA detected — LinkedIn is asking for manual verification. Try again later or solve it manually.");
  }

  // Check for 2FA.
  if (url.includes("/checkpoint/login") && (await page.$('input[name="pin"]'))) {
    console.warn(`[LinkedIn] 2FA required for ${accountId}`);
    await browser.close();
    throw new Error("Two-factor authentication is required. Disable 2FA on this LinkedIn account or enter the code manually.");
  }

  // Check if login succeeded.
  if (url.includes("/login") || url.includes("/checkpoint")) {
    const errorEl = await page.$(".form__error, .login-form__error, #error-for-username, #error-for-password");
    const errorText = errorEl ? await errorEl.textContent() : "Unknown login error";
    await browser.close();
    throw new Error(`LinkedIn login failed: ${errorText}`);
  }

  // Login succeeded — save the session.
  const sessionPath = getSessionPath(accountId);
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }
  await context.storageState({ path: path.join(sessionPath, "state.json") });
  console.log(`[LinkedIn] Login successful for ${accountId}, session saved`);

  return { context, page };
}

/**
 * Perform a LinkedIn action using a headless browser session.
 */
export async function performAction(
  accountId: string,
  email: string,
  password: string,
  action: string,
  leadUrl: string,
  message: string
): Promise<{ ok: boolean; note: string }> {
  let context: BrowserContext | null = null;

  try {
    const { context: ctx, page } = await loginLinkedIn(accountId, email, password);
    context = ctx;

    // Navigate to the lead's profile.
    await page.goto(leadUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(jitter(2000, 4000));

    switch (action) {
      case "connect":
        return await doConnect(page, message);
      case "message":
      case "follow_up":
        return await doMessage(page, message);
      case "reaction":
        return await doReaction(page);
      default:
        return { ok: false, note: `Unknown action: ${action}` };
    }
  } catch (err) {
    return { ok: false, note: String(err) };
  } finally {
    // Save session and close context (not the browser — it's reused).
    if (context) {
      try {
        const sessionPath = getSessionPath(accountId);
        const statePath = path.join(sessionPath, "state.json");
        await context.storageState({ path: statePath });
      } catch {}
      await context.close();
    }
  }
}

// ---------------------------------------------------------------------------
// Action implementations using Playwright selectors
// ---------------------------------------------------------------------------

async function doConnect(page: Page, message: string): Promise<{ ok: boolean; note: string }> {
  // Find the Connect button using multiple selectors.
  const connectBtn =
    (await page.$('button[aria-label*="Connect" i]:not([aria-label*="Disconnect"])')) ||
    (await page.$('button:has-text("Connect"):not(:has-text("Disconnect"))'));

  if (!connectBtn) {
    // Check if already connected.
    const pending = await page.$('button:has-text("Pending"), button:has-text("Following")');
    if (pending) return { ok: false, note: "Already connected or pending" };
    return { ok: false, note: "Connect button not found" };
  }

  await connectBtn.click();
  await page.waitForTimeout(jitter(1500, 2500));

  // If there's a "Personalize invite" or "Add a note" button, click it.
  if (message) {
    const personalizeBtn =
      (await page.$('button:has-text("Personalize invite")')) ||
      (await page.$('button:has-text("Add a note")'));
    if (personalizeBtn) {
      await personalizeBtn.click();
      await page.waitForTimeout(jitter(800, 1500));
    }

    // Fill the message.
    const input =
      (await page.$('textarea[aria-label*="note" i]')) ||
      (await page.$('textarea[aria-label*="message" i]')) ||
      (await page.$('div[contenteditable="true"][role="textbox"]'));

    if (input) {
      await input.focus();
      await page.waitForTimeout(200);
      if (await input.getAttribute("contenteditable")) {
        await page.keyboard.type(message, { delay: jitter(30, 80) });
      } else {
        await input.fill(message);
      }
    }
  }

  // Click Send.
  const sendBtn =
    (await page.$('button:has-text("Send")')) ||
    (await page.$('button:has-text("Send without a note")')) ||
    (await page.$('button:has-text("Send invite")'));

  if (sendBtn) {
    await sendBtn.click();
    await page.waitForTimeout(jitter(1000, 2000));
  }

  return { ok: true, note: message ? "Connection request sent with note" : "Connection request sent" };
}

async function doMessage(page: Page, message: string): Promise<{ ok: boolean; note: string }> {
  // Find the Message button.
  const msgBtn =
    (await page.$('button[aria-label*="Message" i]')) ||
    (await page.$('button:has-text("Message")'));

  if (!msgBtn) return { ok: false, note: "Message button not found" };

  await msgBtn.click();
  await page.waitForTimeout(jitter(2000, 3000));

  // Wait for the message composer.
  const input =
    (await page.$('div[contenteditable="true"][role="textbox"]')) ||
    (await page.$('textarea[placeholder*="message" i]')) ||
    (await page.$('.msg-form__contenteditable'));

  if (!input) return { ok: false, note: "Message input not found" };

  await input.focus();
  await page.waitForTimeout(200);
  if (await input.getAttribute("contenteditable")) {
    await page.keyboard.type(message, { delay: jitter(30, 80) });
  } else {
    await input.fill(message);
  }
  await page.waitForTimeout(jitter(500, 1000));

  // Send.
  const sendBtn =
    (await page.$('button[aria-label*="Send" i]')) ||
    (await page.$('button:has-text("Send")'));

  if (sendBtn) {
    await sendBtn.click();
  } else {
    await page.keyboard.press("Enter");
  }

  await page.waitForTimeout(jitter(800, 1500));
  return { ok: true, note: "Message sent" };
}

async function doReaction(page: Page): Promise<{ ok: boolean; note: string }> {
  const likeBtn =
    (await page.$('button[aria-label*="Like" i]')) ||
    (await page.$('button:has-text("Like")'));

  if (!likeBtn) return { ok: false, note: "Like button not found" };

  await likeBtn.click();
  await page.waitForTimeout(jitter(500, 1000));
  return { ok: true, note: "Liked" };
}

function jitter(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min);
}
