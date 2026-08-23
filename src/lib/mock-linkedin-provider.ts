import type {
  LinkedInProvider,
  LinkedInProfileData,
  SearchResult,
  SendResult,
} from "./linkedin-provider";

/**
 * Mock LinkedIn provider for development and testing.
 *
 * Generates realistic simulated profiles, connection requests,
 * and messages. Every action is tracked and returns believable results.
 *
 * Active when LINKEDIN_PROVIDER=mock (default).
 */

const MOCK_PROFILES: LinkedInProfileData[] = [
  {
    id: "mock-1",
    publicId: "sarah-chen",
    firstName: "Sarah",
    lastName: "Chen",
    fullName: "Sarah Chen",
    headline: "VP of Marketing at TechScale | Growth & Brand Strategy",
    company: "TechScale",
    jobTitle: "VP of Marketing",
    location: "San Francisco, CA",
    industry: "Technology",
    profileUrl: "https://www.linkedin.com/in/sarah-chen",
    avatarUrl: undefined,
    about:
      "Passionate about building scalable marketing engines. 12+ years in B2B SaaS. Previously at HubSpot and Salesforce.",
    connectionDegree: 2,
    isPremium: true,
    isOpenToWork: false,
    isCreator: true,
    mutualConnections: 14,
    experience: [
      {
        title: "VP of Marketing",
        company: "TechScale",
        startDate: "2022-03",
        description: "Leading a team of 25 across content, demand gen, and brand.",
      },
      {
        title: "Director of Growth Marketing",
        company: "HubSpot",
        startDate: "2019-01",
        endDate: "2022-02",
        description: "Scaled inbound pipeline from $5M to $28M ARR.",
      },
    ],
    education: [
      {
        school: "Stanford University",
        degree: "MBA",
        field: "Marketing",
        startDate: "2015",
        endDate: "2017",
      },
    ],
    skills: ["Marketing Strategy", "Demand Generation", "SEO", "Content Marketing", "Analytics"],
    recentActivity: [
      { type: "post", text: "The future of B2B marketing is community-led. Here's why...", date: "2d ago" },
      { type: "like", text: "Liked an article about AI in marketing", date: "3d ago" },
    ],
  },
  {
    id: "mock-2",
    publicId: "james-rodriguez",
    firstName: "James",
    lastName: "Rodriguez",
    fullName: "James Rodriguez",
    headline: "CEO & Co-founder at CloudNest | YC W23",
    company: "CloudNest",
    jobTitle: "CEO & Co-founder",
    location: "Austin, TX",
    industry: "Cloud Computing",
    profileUrl: "https://www.linkedin.com/in/james-rodriguez",
    avatarUrl: undefined,
    about:
      "Building the next-gen cloud infrastructure platform. Former AWS engineer. Angel investor.",
    connectionDegree: 1,
    isPremium: true,
    isOpenToWork: false,
    isCreator: false,
    mutualConnections: 8,
    experience: [
      {
        title: "CEO & Co-founder",
        company: "CloudNest",
        startDate: "2023-01",
        description: "Building developer-first cloud tooling. Raised $12M Series A.",
      },
      {
        title: "Senior Software Engineer",
        company: "Amazon Web Services",
        startDate: "2018-06",
        endDate: "2022-12",
        description: "Core contributor to Lambda and ECS.",
      },
    ],
    education: [
      {
        school: "MIT",
        degree: "BS",
        field: "Computer Science",
        startDate: "2014",
        endDate: "2018",
      },
    ],
    skills: ["Cloud Architecture", "AWS", "Kubernetes", "TypeScript", "Leadership"],
  },
  {
    id: "mock-3",
    publicId: "priya-patel",
    firstName: "Priya",
    lastName: "Patel",
    fullName: "Priya Patel",
    headline: "Head of People at Dataflow | HR Tech Enthusiast",
    company: "Dataflow",
    jobTitle: "Head of People",
    location: "London, UK",
    industry: "Human Resources",
    profileUrl: "https://www.linkedin.com/in/priya-patel",
    avatarUrl: undefined,
    about:
      "Building world-class teams in fast-growth startups. Passionate about employee experience and DEI.",
    connectionDegree: 2,
    isPremium: false,
    isOpenToWork: false,
    isCreator: true,
    mutualConnections: 5,
    experience: [
      {
        title: "Head of People",
        company: "Dataflow",
        startDate: "2021-09",
        description: "Scaled team from 30 to 200+. Built L&D programs and remote-first culture.",
      },
    ],
    education: [
      {
        school: "London School of Economics",
        degree: "MSc",
        field: "Organizational Psychology",
      },
    ],
    skills: ["Recruiting", "Employee Engagement", "DEI", "HR Strategy", "Compensation"],
    recentActivity: [
      { type: "post", text: "Remote work isn't just about location — it's about trust and outcomes.", date: "1d ago" },
    ],
  },
  {
    id: "mock-4",
    publicId: "alex-nakamura",
    firstName: "Alex",
    lastName: "Nakamura",
    fullName: "Alex Nakamura",
    headline: "Product Manager at Stripe | Fintech & Payments",
    company: "Stripe",
    jobTitle: "Senior Product Manager",
    location: "New York, NY",
    industry: "Financial Services",
    profileUrl: "https://www.linkedin.com/in/alex-nakamura",
    avatarUrl: undefined,
    about:
      "Product leader focused on payments infrastructure and developer tools. Previously at Square and Plaid.",
    connectionDegree: 3,
    isPremium: true,
    isOpenToWork: false,
    isCreator: false,
    mutualConnections: 3,
    experience: [
      {
        title: "Senior Product Manager",
        company: "Stripe",
        startDate: "2022-06",
        description: "Leading Stripe Connect for marketplaces and platforms.",
      },
      {
        title: "Product Manager",
        company: "Square",
        startDate: "2019-03",
        endDate: "2022-05",
        description: "Launched Square for Restaurants and Retail.",
      },
    ],
    skills: ["Product Management", "Payments", "Fintech", "User Research", "SQL"],
  },
  {
    id: "mock-5",
    publicId: "elena-petrova",
    firstName: "Elena",
    lastName: "Petrova",
    fullName: "Elena Petrova",
    headline: "Engineering Manager at Notion | Building for Builders",
    company: "Notion",
    jobTitle: "Engineering Manager",
    location: "Berlin, Germany",
    industry: "Software",
    profileUrl: "https://www.linkedin.com/in/elena-petrova",
    avatarUrl: undefined,
    about:
      "Leading a team of 12 engineers. Focused on collaboration features and real-time editing infrastructure.",
    connectionDegree: 2,
    isPremium: false,
    isOpenToWork: false,
    isCreator: true,
    mutualConnections: 11,
    experience: [
      {
        title: "Engineering Manager",
        company: "Notion",
        startDate: "2021-04",
        description: "Managing the collaboration engine team. Shipped real-time multiplayer editing.",
      },
    ],
    skills: ["Engineering Management", "React", "TypeScript", "Distributed Systems", "Team Building"],
  },
  {
    id: "mock-6",
    publicId: "marcus-webb",
    firstName: "Marcus",
    lastName: "Webb",
    fullName: "Marcus Webb",
    headline: "Founder at GrowthLab | B2B SaaS Consultant",
    company: "GrowthLab",
    jobTitle: "Founder",
    location: "Toronto, Canada",
    industry: "Management Consulting",
    profileUrl: "https://www.linkedin.com/in/marcus-webb",
    avatarUrl: undefined,
    about:
      "Helping B2B SaaS companies scale from $1M to $10M ARR. Former VP Sales at Outreach.",
    connectionDegree: 1,
    isPremium: true,
    isOpenToWork: false,
    isCreator: false,
    mutualConnections: 22,
    experience: [
      {
        title: "Founder",
        company: "GrowthLab",
        startDate: "2020-01",
        description: "Consulting for 50+ B2B SaaS companies on GTM strategy.",
      },
      {
        title: "VP of Sales",
        company: "Outreach",
        startDate: "2017-03",
        endDate: "2019-12",
        description: "Built sales team from 5 to 80+ AEs.",
      },
    ],
    skills: ["Sales Leadership", "GTM Strategy", "SaaS", "Revenue Operations", "Consulting"],
  },
  {
    id: "mock-7",
    publicId: "aisha-khan",
    firstName: "Aisha",
    lastName: "Khan",
    fullName: "Aisha Khan",
    headline: "Data Science Lead at Metricly | AI & Analytics",
    company: "Metricly",
    jobTitle: "Data Science Lead",
    location: "Mumbai, India",
    industry: "Analytics",
    profileUrl: "https://www.linkedin.com/in/aisha-khan",
    avatarUrl: undefined,
    about:
      "Building ML-powered analytics products. Published researcher in NLP and time-series forecasting.",
    connectionDegree: 2,
    isPremium: false,
    isOpenToWork: true,
    isCreator: true,
    mutualConnections: 7,
    experience: [
      {
        title: "Data Science Lead",
        company: "Metricly",
        startDate: "2022-08",
        description: "Leading a team of 6 data scientists. Built predictive churn model reducing churn 23%.",
      },
    ],
    skills: ["Machine Learning", "Python", "NLP", "Analytics", "Deep Learning"],
  },
  {
    id: "mock-8",
    publicId: "david-lee",
    firstName: "David",
    lastName: "Lee",
    fullName: "David Lee",
    headline: "CTO at ScaleUp | Ex-Google, Ex-Meta",
    company: "ScaleUp",
    jobTitle: "CTO",
    location: "Singapore",
    industry: "Technology",
    profileUrl: "https://www.linkedin.com/in/david-lee",
    avatarUrl: undefined,
    about:
      "20 years in software engineering. Led teams at Google and Meta before co-founding ScaleUp.",
    connectionDegree: 3,
    isPremium: true,
    isOpenToWork: false,
    isCreator: false,
    mutualConnections: 4,
    experience: [
      {
        title: "CTO",
        company: "ScaleUp",
        startDate: "2023-01",
        description: "Building enterprise AI platform. 200+ engineers.",
      },
      {
        title: "Staff Engineer",
        company: "Google",
        startDate: "2014-01",
        endDate: "2022-12",
        description: "Tech lead for Google Cloud AI APIs.",
      },
    ],
    skills: ["System Architecture", "AI/ML", "Distributed Systems", "Go", "Python"],
  },
  {
    id: "mock-9",
    publicId: "lisa-wang",
    firstName: "Lisa",
    lastName: "Wang",
    fullName: "Lisa Wang",
    headline: "Director of Partnerships at ZoomInfo | B2B Data",
    company: "ZoomInfo",
    jobTitle: "Director of Partnerships",
    location: "Seattle, WA",
    industry: "Information Technology",
    profileUrl: "https://www.linkedin.com/in/lisa-wang",
    avatarUrl: undefined,
    about:
      "Building strategic partnerships that drive revenue. Expert in B2B data ecosystem.",
    connectionDegree: 1,
    isPremium: true,
    isOpenToWork: false,
    isCreator: false,
    mutualConnections: 19,
    experience: [
      {
        title: "Director of Partnerships",
        company: "ZoomInfo",
        startDate: "2021-06",
        description: "Managing 100+ technology partnerships generating $15M+ annual revenue.",
      },
    ],
    skills: ["Partnerships", "B2B", "Data Strategy", "Business Development", "Revenue Growth"],
  },
  {
    id: "mock-10",
    publicId: "omar-hassan",
    firstName: "Omar",
    lastName: "Hassan",
    fullName: "Omar Hassan",
    headline: "Growth Lead at Canva | Design-First GTM",
    company: "Canva",
    jobTitle: "Growth Lead",
    location: "Sydney, Australia",
    industry: "Design",
    profileUrl: "https://www.linkedin.com/in/omar-hassan",
    avatarUrl: undefined,
    about:
      "Driving Canva's enterprise growth across APAC. Previously led growth at Figma.",
    connectionDegree: 2,
    isPremium: false,
    isOpenToWork: false,
    isCreator: true,
    mutualConnections: 6,
    experience: [
      {
        title: "Growth Lead, Enterprise",
        company: "Canva",
        startDate: "2023-03",
        description: "Scaling Canva for Teams in APAC. 40% YoY enterprise revenue growth.",
      },
    ],
    skills: ["Growth Marketing", "Product-Led Growth", "Enterprise Sales", "APAC Markets"],
  },
];

// Simulated conversations for inbox testing
const MOCK_CONVERSATIONS = [
  {
    leadName: "Sarah Chen",
    company: "TechScale",
    messages: [
      { direction: "out" as const, body: "Hi Sarah, I noticed you're building an amazing team at TechScale. Would love to connect and exchange ideas about B2B marketing.", sentAt: "3d ago" },
      { direction: "in" as const, body: "Thanks for reaching out! Always happy to connect with fellow marketers.", sentAt: "2d ago" },
      { direction: "out" as const, body: "That's great! I've been working on some demand gen strategies that might be relevant to your team. Would you be open to a quick chat?", sentAt: "1d ago" },
    ],
  },
  {
    leadName: "Marcus Webb",
    company: "GrowthLab",
    messages: [
      { direction: "out" as const, body: "Hi Marcus, your GTM framework post really resonated with me. We're going through a similar transformation.", sentAt: "5d ago" },
      { direction: "in" as const, body: "Glad it helped! What stage is your company at? Happy to share some war stories.", sentAt: "4d ago" },
    ],
  },
];

let _jobCounter = 1000;

export class MockLinkedInProvider implements LinkedInProvider {
  readonly name = "Mock LinkedIn (Development)";
  readonly isMock = true;

  async searchProfiles(
    query: string,
    options?: {
      keywords?: string;
      location?: string;
      company?: string;
      title?: string;
      industry?: string;
      connectionDegree?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<SearchResult> {
    // Simulate network delay
    await delay(800);

    let filtered = [...MOCK_PROFILES];

    // Filter by search query — split into keywords, match if ANY keyword matches
    if (query && query.length > 0) {
      const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
      if (keywords.length > 0) {
        filtered = filtered.filter((p) => {
          const haystack = [
            p.fullName,
            p.headline ?? "",
            p.company ?? "",
            p.location ?? "",
            p.industry ?? "",
            p.about ?? "",
            p.jobTitle ?? "",
          ].join(" ").toLowerCase();
          return keywords.some((kw) => haystack.includes(kw));
        });
      }
    }

    // Filter by specific fields
    if (options?.location) {
      const loc = options.location.toLowerCase();
      filtered = filtered.filter((p) =>
        (p.location ?? "").toLowerCase().includes(loc)
      );
    }
    if (options?.company) {
      const co = options.company.toLowerCase();
      filtered = filtered.filter((p) =>
        (p.company ?? "").toLowerCase().includes(co)
      );
    }
    if (options?.title) {
      const t = options.title.toLowerCase();
      filtered = filtered.filter((p) =>
        (p.headline ?? "").toLowerCase().includes(t) ||
        (p.jobTitle ?? "").toLowerCase().includes(t)
      );
    }
    if (options?.industry) {
      const ind = options.industry.toLowerCase();
      filtered = filtered.filter((p) =>
        (p.industry ?? "").toLowerCase().includes(ind)
      );
    }
    if (options?.connectionDegree) {
      filtered = filtered.filter(
        (p) => String(p.connectionDegree) === options.connectionDegree
      );
    }

    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const page = filtered.slice(offset, offset + limit);

    return {
      profiles: page,
      total: filtered.length,
      hasMore: offset + limit < filtered.length,
      nextOffset: offset + limit,
    };
  }

  async getProfile(profileUrl: string): Promise<LinkedInProfileData | null> {
    await delay(500);
    // Find by URL or publicId
    const match = MOCK_PROFILES.find(
      (p) =>
        p.profileUrl === profileUrl ||
        p.publicId === profileUrl ||
        profileUrl.includes(p.publicId ?? "")
    );
    return match ?? null;
  }

  async sendConnectionRequest(
    profileUrl: string,
    note?: string
  ): Promise<SendResult> {
    await delay(1200);
    _jobCounter++;
    return {
      success: true,
      jobId: `mock-job-${_jobCounter}`,
    };
  }

  async sendMessage(
    profileUrl: string,
    message: string
  ): Promise<SendResult> {
    await delay(1000);
    _jobCounter++;
    return {
      success: true,
      jobId: `mock-job-${_jobCounter}`,
    };
  }

  async getConnectionStatus(
    profileUrl: string
  ): Promise<"none" | "pending" | "connected"> {
    await delay(300);
    // Randomly return connected or pending for demo
    const hash = profileUrl.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    if (hash % 3 === 0) return "connected";
    if (hash % 3 === 1) return "pending";
    return "none";
  }

  async getConversations() {
    await delay(400);
    return MOCK_CONVERSATIONS.map((c, i) => ({
      id: `conv-${i}`,
      name: c.leadName,
      lastMessage: c.messages[c.messages.length - 1].body,
      lastMessageAt: c.messages[c.messages.length - 1].sentAt,
      unread: i === 1,
    }));
  }

  async getMessages(conversationId: string) {
    await delay(300);
    const idx = parseInt(conversationId.replace("conv-", ""), 10);
    const conv = MOCK_CONVERSATIONS[idx];
    if (!conv) return [];
    return conv.messages.map((m, i) => ({
      id: `msg-${idx}-${i}`,
      body: m.body,
      direction: m.direction,
      sentAt: m.sentAt,
    }));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
