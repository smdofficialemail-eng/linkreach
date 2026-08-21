// LinkReach extension — background service worker.
// Polls the app for queued jobs and drives the LinkedIn content script.

const DEFAULT_BASE = "http://127.0.0.1:3001";
const POLL_MS = 20000;            // 20s between batches
const ACTION_TIMEOUT_MS = 90000;  // 90s max per LinkedIn page interaction
const PAGE_LOAD_WAIT_MS = 5000;   // extra wait for LinkedIn SPA to stabilize
const RATE_LIMIT_PER_DAY = 40;    // safety cap (override from campaign settings)

// ---------------------------------------------------------------------------
// Config / storage helpers
// ---------------------------------------------------------------------------

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["baseUrl", "token", "paired", "dailySent", "dailyDate"], (cfg) => {
      resolve({
        baseUrl: cfg.baseUrl || DEFAULT_BASE,
        token: cfg.token || null,
        paired: !!cfg.token && cfg.paired !== false,
        dailySent: cfg.dailySent || 0,
        dailyDate: cfg.dailyDate || null,
      });
    });
  });
}

function resetDailyIfStale(cfg) {
  const today = new Date().toISOString().slice(0, 10);
  if (cfg.dailyDate !== today) {
    chrome.storage.local.set({ dailySent: 0, dailyDate: today });
    return 0;
  }
  return cfg.dailySent;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function api(path, options = {}) {
  const cfg = await getConfig();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (cfg.token) headers["Authorization"] = `Bearer ${cfg.token}`;
  const res = await fetch(`${cfg.baseUrl}${path}`, { ...options, headers });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!res.ok) throw new Error(`${res.status}: ${body?.error || text.slice(0, 120)}`);
  return body;
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

function setBadge(text, color) {
  try {
    chrome.action.setBadgeText({ text: String(text) });
    chrome.action.setBadgeBackgroundColor({ color });
  } catch {}
}

// ---------------------------------------------------------------------------
// LinkedIn login detection
// ---------------------------------------------------------------------------

async function isLoggedInToLinkedIn() {
  try {
    const res = await fetch("https://www.linkedin.com/feed/", {
      method: "HEAD",
      credentials: "include",
      redirect: "manual",
    });
    // 200 = logged in; 302 to /login = not logged in
    return res.status === 200 || res.type === "opaqueredirect" && !res.url?.includes("/login");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main poll cycle
// ---------------------------------------------------------------------------

let polling = false;

async function poll() {
  if (polling) return; // prevent overlapping polls
  polling = true;

  try {
    const cfg = await getConfig();
    if (!cfg.paired) {
      setBadge("", "#000000");
      return;
    }

    // Respect daily safety limit.
    const todayCount = resetDailyIfStale(cfg);
    if (todayCount >= RATE_LIMIT_PER_DAY) {
      setBadge("MAX", "#dc2626");
      return;
    }

    // Check if Chrome is logged into LinkedIn.
    const loggedIn = await isLoggedInToLinkedIn();
    if (!loggedIn) {
      setBadge("!", "#f59e0b"); // amber — LinkedIn not logged in
      return;
    }

    const batchSize = Math.min(3, RATE_LIMIT_PER_DAY - todayCount);
    const res = await api(`/api/extension/jobs?limit=${batchSize}`);
    const jobs = res?.jobs || [];

    setBadge(String(jobs.length) || "", "#4f46e5");

    for (const job of jobs) {
      if (todayCount >= RATE_LIMIT_PER_DAY) {
        // Hit limit mid-batch — report remaining jobs back as queued (by re-fetching them).
        // The server already marked them in_progress, so we don't need to do anything;
        // they'll time out and the user can re-queue tomorrow.
        setBadge("MAX", "#dc2626");
        break;
      }
      await executeJob(job);
      const newCount = todayCount + 1;
      chrome.storage.local.set({ dailySent: newCount });
    }
  } catch (err) {
    console.warn("[LinkReach] poll failed:", err.message);
    if (String(err.message).includes("401")) {
      setBadge("!", "#dc2626");
    }
  } finally {
    polling = false;
  }
}

// ---------------------------------------------------------------------------
// Execute a single job
// ---------------------------------------------------------------------------

async function executeJob(job) {
  const lead = job.lead || {};
  let url = lead.linkedinUrl;
  if (!url) {
    // Search fallback — human picks the right person.
    url = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(lead.name || "")}`;
  }
  if (!/^https?:\/\//.test(url)) {
    url = `https://www.linkedin.com${url.startsWith("/") ? url : "/" + url}`;
  }

  setBadge("…", "#4f46e5");

  let tabId = null;
  try {
    const tab = await chrome.tabs.create({ url, active: false });
    tabId = tab.id;

    // Wait for the tab to finish loading.
    await waitForTabLoaded(tabId, ACTION_TIMEOUT_MS);

    // Extra stabilization wait — LinkedIn's React app needs a moment after
    // the load event to hydrate interactive elements.
    await sleep(PAGE_LOAD_WAIT_MS);

    const result = await sendToContentScript(tabId, job, lead);

    await api(`/api/extension/jobs/${job.id}`, {
      method: "POST",
      body: JSON.stringify({
        status: result.ok ? "done" : "failed",
        note: result.note || "",
        response: result.response || "",
      }),
    });

    // Brief pause before closing — avoids LinkedIn detecting rapid tab churn.
    await sleep(2000);
  } catch (err) {
    console.warn("[LinkReach] job failed:", job.id, err.message);
    try {
      await api(`/api/extension/jobs/${job.id}`, {
        method: "POST",
        body: JSON.stringify({ status: "failed", note: String(err.message).slice(0, 500) }),
      });
    } catch { /* best effort */ }
  } finally {
    if (tabId) {
      try { await chrome.tabs.remove(tabId); } catch {}
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms + Math.random() * 300));
}

// ---------------------------------------------------------------------------
// Tab lifecycle helpers
// ---------------------------------------------------------------------------

function waitForTabLoaded(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = (id, info) => {
      if (id !== tabId) return;
      if (info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(check);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(check);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(check);
      reject(new Error("Tab load timed out"));
    }, timeoutMs);

    // Also resolve immediately if already loaded.
    chrome.tabs.get(tabId, (tab) => {
      if (tab?.status === "complete") {
        chrome.tabs.onUpdated.removeListener(check);
        resolve();
      }
    });
  });
}

function sendToContentScript(tabId, job, lead) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Content script did not respond in time"));
    }, ACTION_TIMEOUT_MS);

    const handler = (msg) => {
      if (msg?.type === "LINKREACH_RESULT") {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(handler);
        resolve(msg.result || { ok: false, note: "Empty result from content script" });
      }
    };
    chrome.runtime.onMessage.addListener(handler);

    chrome.tabs.sendMessage(tabId, { type: "LINKREACH_ACT", job, lead }, (resp) => {
      if (chrome.runtime.lastError) {
        // Content script not injected yet — retry after a delay.
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { type: "LINKREACH_ACT", job, lead }, (resp2) => {
            if (chrome.runtime.lastError) {
              clearTimeout(timeout);
              chrome.runtime.onMessage.removeListener(handler);
              reject(new Error(`Content script unavailable: ${chrome.runtime.lastError.message}`));
            } else {
              clearTimeout(timeout);
              chrome.runtime.onMessage.removeListener(handler);
              resolve(resp2 || { ok: false, note: "No response from content script" });
            }
          });
        }, 4000);
        return;
      }
      // If the content script returned a result synchronously (unlikely but possible).
      if (resp) {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(handler);
        resolve(resp);
      }
      // Otherwise wait for the LINKREACH_RESULT message.
    });
  });
}

// ---------------------------------------------------------------------------
// Lifecycle: start polling on install and via alarms
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("linkreach-poll", { periodInMinutes: 0.5 });
  poll();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "linkreach-poll") poll();
});

// Also poll on an interval (alarms have a minimum of 0.5 min; setInterval
// provides a tighter 20s cycle).
setInterval(poll, POLL_MS);

// Handle messages from the popup (Ping, Poll Now).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "LINKREACH_PING") {
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === "LINKREACH_POLL_NOW") {
    poll().then(() => sendResponse({ ok: true }));
    return true;
  }
});
