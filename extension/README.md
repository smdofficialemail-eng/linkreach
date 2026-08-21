# LinkReach Chrome Extension

Connects to your LinkedIn profile and executes campaigns: connection requests (with personalized notes), direct messages, and post reactions — in background tabs, human-speed. The app queues jobs; this extension polls, acts on LinkedIn, and reports back so your dashboard and inbox update live.

---

## Install (3 minutes)

1. Open Chrome → go to **`chrome://extensions`**
2. Toggle **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder inside your LinkReach project
5. Pin the LinkReach icon to the toolbar

## Pair with your app

1. Open LinkReach → **Settings → Browser extension → Generate pairing code**
2. Click the extension icon in Chrome → paste the code → click **Pair with LinkReach**
3. The popup shows **✓ Paired** and your workspace name

| Setting | Local testing | Production |
|---------|--------------|------------|
| **App URL** | `http://127.0.0.1:3001` | `https://linkreach-XXXX.vercel.app` |

The App URL field defaults to localhost — update it after deploying to Vercel.

## Run a live campaign

1. Make sure Chrome is **logged into LinkedIn** with the profile you want to send from
2. In LinkReach: **Settings → Delivery mode → Browser extension → Save settings**
3. Open a campaign → **Launch**
4. The extension picks up jobs within ~20 seconds:
   - Opens each lead's LinkedIn profile in a **background tab**
   - Clicks **Connect** and fills your personalized note
   - Reports back → funnel updates → conversation appears in **Inbox**
5. Popup shows live **SENT TODAY** counter (resets at midnight, 40/day safety cap)

## How it works

```
┌──────────────┐     poll /api/extension/jobs     ┌──────────────────────┐
│  LinkReach   │ ─────────────────────────────────│   Chrome Extension   │
│  (your app)  │                                  │   (this folder)      │
│              │  ← POST result (done/failed)      │                      │
│  queues jobs │                                  │  opens LinkedIn tab  │
│  when you    │                                  │  clicks Connect      │
│  launch a    │                                  │  fills personalized  │
│  campaign    │                                  │  note, sends         │
└──────────────┘                                  └──────────┬───────────┘
                                                             │
                                                     runs on LinkedIn
                                                     in background tabs
```

- Jobs are **claimed on fetch** (no double-send even across devices)
- Failed jobs skip the member; the campaign keeps moving
- Background tabs close automatically after each action
- A random jitter is added between actions to mimic human timing

## Safety

| Setting | Default | Notes |
|---------|---------|-------|
| **Daily send limit** | 40 | Popup counter tracks this per day |
| **Page action timeout** | 90s | Aborts if LinkedIn doesn't render |
| **Between-job delay** | ~20s | Configurable via poll interval |

**LinkedIn account risk:** any automated outreach carries some risk. Keep daily limits
conservative (5–30/day), always warm up new profiles gradually, and monitor your
LinkedIn account for restriction notices. This extension sends at human speed and uses
standard browser interactions — but no tool can eliminate all detection risk.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **Pairing failed / 401** | Code was already used (single-use). Generate a new one in Settings. |
| **Jobs queued but nothing happens** | Open popup: check it says "✓ Paired". Check Chrome is logged into LinkedIn. |
| **"Connect button not found"** | The lead may already be connected; the job is skipped automatically. |
| **"Message button not found"** | That profile may not accept InMail. Marked as failed, campaign continues. |
| **Daily limit hit** | Popup shows "MAX" badge — wait until midnight when it resets. |
| **Extension not visible** | `chrome://extensions` → make sure LinkReach is enabled and pinned. |

To see extension logs: right-click the LinkReach icon → **Manage Extension** → **Service Worker** link (for background) or **Inspect views: popup** (for popup).

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Chrome Manifest V3 config |
| `background.js` | Service worker — polls API, manages tabs, tracks daily limit |
| `content.js` | Injected on linkedin.com — performs the actual DOM interactions |
| `popup.html` / `popup.js` | Pairing UI, status, daily counter |
| `icons/` | Extension icons (generated) |
