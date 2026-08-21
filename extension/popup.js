// LinkReach popup logic.

const $ = (id) => document.getElementById(id);

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ["baseUrl", "token", "workspaceName", "paired", "dailySent", "dailyDate"],
      resolve
    );
  });
}

async function render() {
  const cfg = await getConfig();
  const paired = !!cfg.token && cfg.paired !== false;
  const today = new Date().toISOString().slice(0, 10);
  const daily = cfg.dailyDate === today ? (cfg.dailySent || 0) : 0;

  // State badge
  const badge = $("stateBadge");
  badge.textContent = paired ? "● Paired" : "Not paired";
  badge.className = "badge " + (paired ? "ok" : "off");

  // Sections
  $("pairSection").classList.toggle("hidden", paired);
  $("pairedSection").classList.toggle("hidden", !paired);

  // Fill form
  $("baseUrl").value = cfg.baseUrl || "http://127.0.0.1:3001";

  if (paired) {
    $("workspaceName").textContent = `Connected to ${cfg.workspaceName || "your workspace"}`;
    $("dailyCount").textContent = `${daily}`;
  }
}

// Pair
$("pairBtn").addEventListener("click", async () => {
  const baseUrl = $("baseUrl").value.trim().replace(/\/+$/, "");
  const code = $("code").value.trim().toUpperCase();
  const status = $("pairStatus");
  status.className = "status";
  status.textContent = "Pairing…";

  if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
    status.className = "status err";
    status.textContent = "Enter a valid app URL (http://… or https://…).";
    return;
  }
  if (!/^[A-Z2-9]{8}$/.test(code)) {
    status.className = "status err";
    status.textContent = "Enter the 8-character pairing code from Settings.";
    return;
  }

  try {
    const ua = navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] || "Chrome";
    const res = await fetch(`${baseUrl}/api/extension/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, browser: ua }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);

    await chrome.storage.local.set({
      baseUrl,
      token: body.token,
      workspaceName: body.workspaceName,
      paired: true,
      dailySent: 0,
      dailyDate: new Date().toISOString().slice(0, 10),
    });

    status.className = "status ok";
    status.textContent = "✓ Paired successfully!";
    render();

    // Trigger an immediate poll.
    chrome.runtime.sendMessage({ type: "LINKREACH_POLL_NOW" });
  } catch (err) {
    status.className = "status err";
    status.textContent = `Pairing failed: ${err.message}`;
  }
});

// Unpair
$("unpairBtn").addEventListener("click", async () => {
  await chrome.storage.local.remove(["token", "workspaceName", "paired"]);
  render();
});

render();
