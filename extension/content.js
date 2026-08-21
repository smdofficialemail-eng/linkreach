// LinkReach content script — runs on linkedin.com.
// Executes jobs on the live LinkedIn DOM, human-speed, with retry and multi-strategy selectors.
// LinkedIn's DOM changes frequently; this uses aria-labels, data-automation-ids, and text
// content as fallback layers so one selector going stale doesn't break everything.

const BAILED_SELECTORS = {
  connect: [
    // 2026 green Connect button (primary CTA on profiles)
    'button[aria-label*="Connect" i]:not([aria-label*="Disconnect"])',
    // 2025 fallback — artdeco primary button with Connect text
    'button.artdeco-button--primary:has(span:is(:not(:empty)))',
    // Older profile layout
    'span[role="button"]:not([aria-label])',
  ],
  message: [
    'button[aria-label*="Message" i]:not([aria-label*="InMail"])',
    'button.artdeco-button--muted:has(span:text-is("Message"))',
  ],
  like: [
    'button[aria-label*="Like" i]',
    'button[aria-label*="like" i]',
  ],
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms + Math.random() * 400));
}

function jitter(baseMs) {
  return baseMs + Math.floor(Math.random() * baseMs * 0.3);
}

function log(msg) {
  console.log("[LinkReach]", msg);
}

function warn(msg) {
  console.warn("[LinkReach]", msg);
}

// ---------------------------------------------------------------------------
// Button finding — multi-strategy: try each selector, fall back to text
// ---------------------------------------------------------------------------

function findElement(selectors, textRegex, tagFilter = "button, span[role='button'], a[role='button'], div[role='button']") {
  // Strategy 1: try each CSS selector
  for (const sel of selectors) {
    try {
      const els = Array.from(document.querySelectorAll(sel));
      for (const el of els) {
        if (el.offsetParent === null) continue; // skip hidden
        if (textRegex && !textRegex.test((el.textContent || "").trim().replace(/\s+/g, " "))) continue;
        return el;
      }
    } catch { /* selector syntax not supported in this context — skip */ }
  }

  // Strategy 2: scan all interactive elements by visible text
  if (textRegex) {
    const all = Array.from(document.querySelectorAll(tagFilter));
    for (const el of all) {
      if (el.offsetParent === null) continue;
      const txt = (el.textContent || "").trim().replace(/\s+/g, " ");
      if (textRegex.test(txt)) return el;
    }

    // Strategy 3: look for the text inside aria-label on any clickable element
    const allClickable = Array.from(document.querySelectorAll("button, a, [role='button'], [tabindex]"));
    for (const el of allClickable) {
      if (el.offsetParent === null) continue;
      const aria = el.getAttribute("aria-label") || "";
      if (textRegex.test(aria)) return el;
    }
  }

  return null;
}

async function waitForElement(selectors, textRegex, timeoutMs = 12000, pollMs = 500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = findElement(selectors, textRegex);
    if (el) return el;
    await sleep(pollMs);
  }
  return null;
}

async function clickElement(selectors, textRegex, { timeoutMs = 12000, label = "element" } = {}) {
  const el = await waitForElement(selectors, textRegex, timeoutMs);
  if (!el) {
    warn(`${label} not found within ${timeoutMs}ms`);
    return false;
  }
  // Scroll into view first — some buttons only activate when visible.
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  await sleep(jitter(300));
  el.click();
  log(`Clicked ${label}: "${(el.textContent || "").trim().slice(0, 50)}"`);
  await sleep(jitter(800));
  return true;
}

// ---------------------------------------------------------------------------
// Text input helpers — handles both <textarea> and contenteditable
// ---------------------------------------------------------------------------

async function findMessageInput(timeoutMs = 10000) {
  const selectors = [
    // 2026 LinkedIn message composer — contenteditable div inside a form
    "div[contenteditable='true'][role='textbox']",
    // Older LinkedIn textarea
    "textarea[placeholder*='message' i]",
    "textarea[placeholder*='Message' i]",
    // InMail / connection note textarea
    "textarea[aria-label*='note' i]",
    "textarea[aria-label*='message' i]",
    // The artdeco modal textarea
    "textarea.artdeco-text-input",
    // Generic contenteditable in a composer
    ".msg-form__contenteditable",
  ];

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) return el;
      } catch {}
    }
    await sleep(400);
  }
  return null;
}

async function typeInField(field, text) {
  if (!field) throw new Error("No input field to type into");

  field.scrollIntoView({ behavior: "smooth", block: "center" });
  await sleep(jitter(200));
  field.focus();
  await sleep(jitter(150));

  if (field.tagName === "TEXTAREA" || field.tagName === "INPUT") {
    // React-controlled input — need to use the native setter + dispatch input event
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;

    if (nativeSetter) {
      nativeSetter.call(field, text);
    } else {
      field.value = text;
    }
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    // contenteditable — execCommand inserts at cursor and triggers React
    document.execCommand("insertText", false, text);
  }

  await sleep(jitter(400));
}

// ---------------------------------------------------------------------------
// Action: Send a connection request (with optional personalized note)
// ---------------------------------------------------------------------------

async function doConnect(job, lead) {
  const note = String(job.payload?.template || job.payload?.note || "");
  log(`Connect: ${lead?.name || "unknown"} — note: "${note.slice(0, 40)}"${note.length > 40 ? "…" : ""}`);

  // Step 1: Find and click the Connect button
  const clicked = await clickElement(
    BAILED_SELECTORS.connect,
    /Connect/i,
    { timeoutMs: 15000, label: "Connect button" }
  );
  if (!clicked) {
    // Check if the person is already connected
    const alreadyConnected = findElement(
      [],
      /^(Following|Pending|Message)$/i,
      "button, span[role='button'], a[role='button']"
    );
    if (alreadyConnected) {
      return { ok: false, note: "Already connected or pending" };
    }
    throw new Error("Connect button not found — profile may have restricted connection requests");
  }

  await sleep(jitter(1200));

  // Step 2: Look for the note/personalize modal
  if (note) {
    // Newer LinkedIn: "Personalize invite" or "Add a note" button appears in a modal
    const personalizeBtn = await waitForElement(
      [],
      /(Personalize invite|Add a note|Add a note to your invite)/i,
      6000
    );
    if (personalizeBtn) {
      personalizeBtn.click();
      log("Clicked Personalize/Add note button");
      await sleep(jitter(1000));
    }

    const input = await findMessageInput(6000);
    if (input) {
      await typeInField(input, note);
      log("Note filled");
    } else {
      warn("Could not find message input — sending without note");
    }
  }

  // Step 3: Confirm send
  const sendBtn = await clickElement(
    [],
    /^(Send|Send without a note|Send invite)$/i,
    { timeoutMs: 6000, label: "Send button" }
  );
  if (!sendBtn) {
    // Some connection flows auto-send when you click Connect (no modal).
    // Check if the Connect button is gone — that means it went through.
    await sleep(1000);
    const connectStillThere = findElement(BAILED_SELECTORS.connect, /Connect/i);
    if (!connectStillThere) {
      log("No send modal — connection likely went through directly");
      return { ok: true, response: note || "Connection request sent (auto)" };
    }
    throw new Error("Send button not found in modal — connection may not have gone through");
  }

  await sleep(jitter(600));

  // Step 4: Verify — check for success indicators
  const successIndicators = ["Pending", "Following", "Invitation sent"];
  for (const txt of successIndicators) {
    if (findElement([], new RegExp(txt, "i"), "button, span, p")) {
      log(`Confirmed: ${txt}`);
      return { ok: true, response: note || `Connection request sent — status: ${txt}` };
    }
  }

  // If no explicit success indicator, assume it worked if the modal is gone.
  log("No explicit success indicator — assuming request sent");
  return { ok: true, response: note || "Connection request sent" };
}

// ---------------------------------------------------------------------------
// Action: Send a direct message
// ---------------------------------------------------------------------------

async function doMessage(job, lead) {
  const note = String(job.payload?.template || job.payload?.note || "");
  log(`Message: ${lead?.name || "unknown"} — "${note.slice(0, 40)}"${note.length > 40 ? "…" : ""}`);

  // Step 1: Find and click the Message button on the profile
  const clicked = await clickElement(
    BAILED_SELECTORS.message,
    /Message/i,
    { timeoutMs: 12000, label: "Message button" }
  );
  if (!clicked) {
    throw new Error("Message button not found — profile may not accept messages");
  }

  await sleep(jitter(1500));

  // Step 2: Wait for the message composer to appear (LinkedIn opens a popup/flyout)
  const input = await findMessageInput(8000);
  if (!input) throw new Error("Message input not found after clicking Message");

  await typeInField(input, note);
  log("Message typed");

  // Step 3: Send — look for the send button (often an icon, not text)
  await sleep(jitter(300));

  // Try the explicit Send text button first
  const sendBtn = await clickElement(
    [],
    /^Send$/i,
    { timeoutMs: 3000, label: "Send button" }
  );

  if (!sendBtn) {
    // LinkedIn's message composer often uses an icon button — find the button
    // adjacent to the input, or the one with aria-label containing "Send"
    const iconSend = findElement(
      ["button[aria-label*='Send' i]", "button[aria-label*='send' i]"],
      null
    );
    if (iconSend) {
      iconSend.click();
      log("Clicked icon send button");
    } else {
      // Fallback: press Enter
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      log("Sent via Enter key fallback");
    }
  }

  await sleep(jitter(800));
  return { ok: true, response: note };
}

// ---------------------------------------------------------------------------
// Action: Like / react to a post
// ---------------------------------------------------------------------------

async function doReaction(job, lead) {
  log(`Like: ${lead?.name || "unknown"}`);

  // Look for a Like button on the page (assumes we're on the lead's post)
  const liked = await clickElement(
    BAILED_SELECTORS.like,
    /Like/i,
    { timeoutMs: 10000, label: "Like button" }
  );

  if (!liked) {
    throw new Error("Like button not found — may need to scroll to a post first");
  }

  await sleep(jitter(500));
  return { ok: true, response: "Liked" };
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

async function runJob(job, lead) {
  const action = (job.action || "connect").toLowerCase();
  log(`Dispatching: ${action} for ${lead?.name || "lead"} (${lead?.linkedinUrl || "no URL"})`);

  // Ensure the page has fully rendered — LinkedIn is a SPA and lazy-loads
  // interactive elements. Wait for a stable DOM before acting.
  await sleep(jitter(2000));

  switch (action) {
    case "connect":
      return doConnect(job, lead);
    case "message":
    case "follow_up":
      return doMessage(job, lead);
    case "reaction":
      return doReaction(job, lead);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ---------------------------------------------------------------------------
// Message listener from background script
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "LINKREACH_ACT") {
    runJob(msg.job, msg.lead)
      .then((result) => sendResponse(result))
      .catch((err) => {
        warn(`Job failed: ${err.message}`);
        sendResponse({ ok: false, note: String(err.message || err) });
      });
    return true; // async — we call sendResponse later
  }
});
