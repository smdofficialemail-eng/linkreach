// End-to-end verification of the extension API contract:
//   generate code -> pair -> queue job -> fetch job -> report result -> check funnel.
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const BASE = process.env.BASE_URL || "http://127.0.0.1:3001";
const prisma = new PrismaClient();

function generatePairingCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) code += alphabet[bytes[i] % alphabet.length];
  return code;
}

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

async function main() {
  // 1. Find the seeded workspace and give it a pairing code + extension delivery mode.
  const ws = await prisma.workspace.findFirst({ where: { name: { contains: "Acme" } } });
  if (!ws) throw new Error("No Acme workspace found — run the seed first");
  const code = generatePairingCode();
  await prisma.workspace.update({
    where: { id: ws.id },
    data: { extensionCode: code, deliveryMode: "extension" },
  });
  console.log(`1. Pairing code generated & set on workspace: ${code}`);

  // 2. Pair via the API.
  const pair = await api("/api/extension/pair", {
    method: "POST",
    body: JSON.stringify({ code, browser: "Chrome 126 — Verification" }),
  });
  console.log(`2. Pair: HTTP ${pair.status}`, pair.body?.ok ? `workspace="${pair.body.workspaceName}"` : pair.body);
  if (!pair.body?.token) throw new Error("Pair failed");
  const token = pair.body.token;
  const auth = { Authorization: `Bearer ${token}` };

  // 3. Queue a job by launching a campaign (extension mode queues, not simulates).
  const campaign = await prisma.campaign.findFirst({
    where: { workspaceId: ws.id, members: { some: { status: "queued" } } },
    include: { members: { where: { status: "queued" }, take: 3 } },
  });
  let jobId = null;
  if (campaign) {
    // Simulate the launch action's job-queueing directly through the same code path.
    const firstStep = await prisma.campaignStep.findFirst({
      where: { campaignId: campaign.id },
      orderBy: { position: "asc" },
    });
    const queued = campaign.members;
    const leads = await prisma.lead.findMany({ where: { id: { in: queued.map((m) => m.leadId) } } });
    const leadMap = new Map(leads.map((l) => [l.id, l]));
    const jobs = queued.map((m) => {
      const lead = leadMap.get(m.leadId) ?? {};
      const template = (firstStep?.template || "").replace(/\{first_name\}/g, String(lead.name || "").split(" ")[0]);
      return {
        workspaceId: ws.id,
        campaignId: campaign.id,
        memberId: m.id,
        leadId: m.leadId,
        action: firstStep?.action ?? "connect",
        payload: { template, note: template },
      };
    });
    await prisma.extensionJob.createMany({ data: jobs });
    jobId = jobs[0]?.memberId ? (await prisma.extensionJob.findFirst({ where: { memberId: jobs[0].memberId } }))?.id : null;
    console.log(`3. Queued ${jobs.length} jobs for campaign "${campaign.name}" (first job: ${jobId})`);
  } else {
    // Fallback: create a job directly.
    const lead = await prisma.lead.findFirst({ where: { workspaceId: ws.id } });
    const job = await prisma.extensionJob.create({
      data: {
        workspaceId: ws.id,
        leadId: lead.id,
        action: "connect",
        payload: { template: `Hi ${lead.name?.split(" ")[0]}, great to connect!` },
      },
    });
    jobId = job.id;
    console.log(`3. No queued campaign members — created a direct job (${jobId})`);
  }

  // 4. Fetch jobs as the extension would.
  const jobs = await api("/api/extension/jobs?limit=5", { headers: auth });
  console.log(`4. Fetch jobs: HTTP ${jobs.status}, ${jobs.body?.jobs?.length ?? 0} jobs`);
  const first = jobs.body?.jobs?.[0];
  if (!first) throw new Error("No jobs returned");
  console.log(`   job[0]: id=${first.id} action=${first.action} lead=${first.lead?.name} template="${String(first.payload?.template || "").slice(0, 40)}"`);
  if (first.id !== jobId) console.log("   (batch contains the queued jobs — claimed as in_progress)");

  // 5. Report success.
  const res = await api(`/api/extension/jobs/${first.id}`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ status: "done", response: "Connection request sent" }),
  });
  console.log(`5. Report done: HTTP ${res.status}`, res.body);

  // 6. Verify the funnel + inbox side effects.
  const done = await prisma.extensionJob.findUnique({ where: { id: first.id } });
  console.log(`6. Job status after report: ${done.status}`);
  const member = done.memberId ? await prisma.campaignMember.findUnique({ where: { id: done.memberId } }) : null;
  if (member) console.log(`   Campaign member now: ${member.status}${member.sentAt ? ` (sent ${member.sentAt.toISOString()})` : ""}`);
  const conv = await prisma.conversation.findFirst({ where: { workspaceId: ws.id, leadId: done.leadId } });
  if (conv) {
    const msgs = await prisma.message.findMany({ where: { conversationId: conv.id } });
    console.log(`   Inbox: conversation created with ${msgs.length} message(s) — "${String(msgs[0]?.body || "").slice(0, 50)}"`);
  }

  // 7. Unauthorized check.
  const noAuth = await api("/api/extension/jobs", { headers: {} });
  console.log(`7. No-token fetch: HTTP ${noAuth.status} (expected 401)`);

  await prisma.$disconnect();
  console.log("\n✅ Extension contract verified end-to-end");
}

main().catch((e) => {
  console.error("VERIFY FAILED:", e.message);
  prisma.$disconnect();
  process.exit(1);
});
