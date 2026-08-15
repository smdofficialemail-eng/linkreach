const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const EMAIL = "owner@acme.test";
const PASSWORD = "password123";

const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000);
const daysAgo = (d) => new Date(Date.now() - d * 24 * 3600 * 1000);

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log("Seed already applied — skipping.");
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const workspace = await prisma.workspace.create({
    data: {
      name: "Acme Growth",
      slug: "acme-growth-" + Math.random().toString(36).slice(2, 7),
      lists: {
        create: [
          { name: "Outbound prospects", color: "#6366f1" },
          { name: "Warm network", color: "#0ea5e9" },
          { name: "Event — SaaS Meetup", color: "#8b5cf6" },
        ],
      },
      members: {
        create: {
          role: "owner",
          user: {
            create: { name: "Test Owner", email: EMAIL, passwordHash },
          },
        },
      },
    },
    include: { lists: true },
  });

  const daniel = await prisma.linkedinAccount.create({
    data: {
      workspaceId: workspace.id,
      name: "Daniel Chen",
      headline: "Founder @ Acme Growth",
      profileUrl: "https://linkedin.com/in/danielchen",
      dailyLimit: 60,
    },
  });
  await prisma.linkedinAccount.create({
    data: {
      workspaceId: workspace.id,
      name: "Emily Johnson",
      headline: "SDR Team Lead @ Acme Growth",
      profileUrl: "https://linkedin.com/in/emilyjohnson",
      dailyLimit: 45,
    },
  });

  const leadsData = [
    { name: "Sarah Mitchell", headline: "VP Marketing @ Dataflow", company: "Dataflow", location: "San Francisco, CA", status: "replied" },
    { name: "James Rodriguez", headline: "Head of Growth @ Looply", company: "Looply", location: "Austin, TX", status: "accepted" },
    { name: "Priya Patel", headline: "Director of Sales @ Cloudnest", company: "Cloudnest", location: "New York, NY", status: "booked" },
    { name: "Marcus Webb", headline: "Founder @ Stackline", company: "Stackline", location: "London, UK", status: "contacted" },
    { name: "Aisha Khan", headline: "RevOps @ Metricly", company: "Metricly", location: "Toronto, CA", status: "new" },
    { name: "Tom O'Brien", headline: "CRO @ Bluepeak", company: "Bluepeak", location: "Chicago, IL", status: "negative" },
    { name: "Elena Petrova", headline: "Marketing Lead @ Orbitals", company: "Orbitals", location: "Berlin, DE", status: "booked" },
    { name: "David Kim", headline: "Sales Manager @ Panelbase", company: "Panelbase", location: "Seattle, WA", status: "new" },
  ];

  const outboundList = workspace.lists[0];
  const leads = [];
  for (let i = 0; i < leadsData.length; i++) {
    const d = leadsData[i];
    leads.push(
      await prisma.lead.create({
        data: {
          workspaceId: workspace.id,
          name: d.name,
          headline: d.headline,
          company: d.company,
          linkedinUrl: "https://linkedin.com/in/" + d.name.toLowerCase().replace(/[^a-z]+/g, "-"),
          location: d.location,
          email: d.name.toLowerCase().replace(/[^a-z]+/g, ".") + "@" + d.company.toLowerCase() + ".com",
          source: i < 3 ? "csv" : "manual",
          status: d.status,
          listId: outboundList.id,
          tags: i % 3 === 0 ? ["saas", "north-america"] : ["saas"],
        },
      })
    );
  }

  const campaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: "Q3 SDR Outreach — Connections",
      type: "outbound",
      kind: "connections",
      status: "running",
      linkedinAccountId: daniel.id,
      dailyLimit: 30,
      minDelayMin: 4,
      maxDelayMin: 9,
      smartTimezone: true,
      aiPersonalization: true,
      steps: {
        create: [
          {
            position: 0,
            action: "connect",
            daysAfter: 0,
            template: "Hi {first_name}, I noticed {company} is growing fast. I have an idea for {company} that could save the sales team hours each week. Worth connecting?",
            variables: [
              { name: "first_name", value: "{{first_name}}" },
              { name: "company", value: "{{company}}" },
            ],
          },
          {
            position: 1,
            action: "message",
            daysAfter: 1,
            template: "Thanks for connecting, {first_name}! Curious — how is {company} handling outbound prospecting right now?",
            variables: [
              { name: "first_name", value: "{{first_name}}" },
              { name: "company", value: "{{company}}" },
            ],
          },
          {
            position: 2,
            action: "follow_up",
            daysAfter: 3,
            template: "Following up on my last note, {first_name}. If it's helpful, happy to share a 5-minute Loom walking through what we built. No pressure either way!",
            variables: [{ name: "first_name", value: "{{first_name}}" }],
          },
        ],
      },
    },
    include: { steps: true },
  });

  const statusMap = [
    { lead: leads[0], status: "replied", sent: daysAgo(5), accepted: daysAgo(4), replied: hoursAgo(20) },
    { lead: leads[1], status: "accepted", sent: daysAgo(3), accepted: daysAgo(2) },
    { lead: leads[2], status: "booked", sent: daysAgo(6), accepted: daysAgo(5), replied: daysAgo(4), booked: hoursAgo(30) },
    { lead: leads[3], status: "sent", sent: daysAgo(1) },
    { lead: leads[4], status: "queued" },
    { lead: leads[6], status: "booked", sent: daysAgo(7), accepted: daysAgo(6), replied: daysAgo(5), booked: daysAgo(2) },
  ];

  for (const row of statusMap) {
    await prisma.campaignMember.create({
      data: {
        campaignId: campaign.id,
        leadId: row.lead.id,
        status: row.status,
        stepIndex: row.status === "replied" || row.status === "booked" ? 2 : row.status === "accepted" ? 1 : 0,
        sentAt: row.sent ?? null,
        acceptedAt: row.accepted ?? null,
        repliedAt: row.replied ?? null,
        bookedAt: row.booked ?? null,
        nextRunAt: row.status === "queued" ? new Date(Date.now() + 2 * 3600 * 1000) : null,
      },
    });
  }

  // Conversations + messages for replied/booked leads
  for (const row of statusMap.filter((r) => ["replied", "booked"].includes(r.status))) {
    const conv = await prisma.conversation.create({
      data: {
        workspaceId: workspace.id,
        linkedinAccountId: daniel.id,
        leadId: row.lead.id,
        lastMessageAt: hoursAgo(3),
      },
    });
    await prisma.message.createMany({
      data: [
        { conversationId: conv.id, direction: "out", body: "Hi " + row.lead.name.split(" ")[0] + ", thanks for connecting!", sentAt: row.accepted ?? hoursAgo(90) },
        { conversationId: conv.id, direction: "in", body: "Hey, thanks for reaching out — this is timely for us. What did you have in mind?", sentAt: hoursAgo(4) },
        { conversationId: conv.id, direction: "out", body: "Great to hear! Would a quick 15-min call this week work for you?", sentAt: hoursAgo(3) },
      ],
    });
  }

  const activityData = [
    { type: "imported", message: `Imported 3 leads from CSV into ${outboundList.name}` },
    { type: "sent", message: "Connection request sent to Marcus Webb via Daniel Chen" },
    { type: "accepted", message: "James Rodriguez accepted your connection request" },
    { type: "replied", message: "Sarah Mitchell replied to your message" },
    { type: "booked", message: "Call booked with Priya Patel for Friday 10:00 AM" },
    { type: "sent", message: "Follow-up message sent to Sarah Mitchell" },
  ];
  for (let i = 0; i < activityData.length; i++) {
    const a = activityData[i];
    await prisma.activityLog.create({
      data: {
        workspaceId: workspace.id,
        campaignId: campaign.id,
        type: a.type,
        message: a.message,
        createdAt: hoursAgo(2 + i * 5),
      },
    });
  }

  console.log("Seed complete:");
  console.log("  workspace:", workspace.name);
  console.log("  login:", EMAIL, "/", PASSWORD);
  console.log("  leads:", leads.length, "| accounts: 2 | campaign:", campaign.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
