/**
 * LinkedIn Provider abstraction.
 *
 * Every LinkedIn execution action goes through this interface.
 * The active provider is determined by the LINKEDIN_PROVIDER env var:
 *   - "mock" (default in dev) — simulates all actions
 *   - "extension" — routes through the Chrome extension
 *   - "server" — headless Chrome via Playwright
 */

export interface LinkedInProfileData {
  id: string;
  publicId?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  headline?: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  industry?: string;
  profileUrl?: string;
  avatarUrl?: string;
  about?: string;
  connectionDegree?: number;
  isPremium: boolean;
  isOpenToWork: boolean;
  isCreator: boolean;
  mutualConnections?: number;
  experience?: Array<{
    title: string;
    company: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  education?: Array<{
    school: string;
    degree?: string;
    field?: string;
    startDate?: string;
    endDate?: string;
  }>;
  skills?: string[];
  recentActivity?: Array<{
    type: string;
    text: string;
    url?: string;
    date?: string;
  }>;
  raw?: Record<string, unknown>;
}

export interface SearchResult {
  profiles: LinkedInProfileData[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
}

export interface SendResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

export interface LinkedInProvider {
  /** Search for profiles matching keywords/filters */
  searchProfiles(
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
  ): Promise<SearchResult>;

  /** Get full profile details */
  getProfile(profileUrl: string): Promise<LinkedInProfileData | null>;

  /** Send a connection request */
  sendConnectionRequest(
    profileUrl: string,
    note?: string
  ): Promise<SendResult>;

  /** Send a direct message */
  sendMessage(
    profileUrl: string,
    message: string
  ): Promise<SendResult>;

  /** Check connection status */
  getConnectionStatus(
    profileUrl: string
  ): Promise<"none" | "pending" | "connected">;

  /** Get conversations */
  getConversations?(): Promise<
    Array<{
      id: string;
      name: string;
      lastMessage: string;
      lastMessageAt: string;
      unread: boolean;
    }>
  >;

  /** Get messages in a conversation */
  getMessages?(
    conversationId: string
  ): Promise<
    Array<{
      id: string;
      body: string;
      direction: "in" | "out";
      sentAt: string;
    }>
  >;

  /** Provider name for display */
  readonly name: string;

  /** Whether this provider is mock/simulation */
  readonly isMock: boolean;
}

/**
 * Factory to get the active LinkedIn provider.
 *
 * @param deliveryMode - If "server" and a liAt cookie is provided, uses Voyager API
 * @param liAt - Optional LinkedIn session cookie for real API access
 */
export function getLinkedInProvider(deliveryMode?: string, liAt?: string): LinkedInProvider {
  // If we have a session cookie, use the Voyager API for real LinkedIn search
  if (liAt && deliveryMode !== "simulation") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { VoyagerLinkedInProvider } = require("./voyager-linkedin-provider");
      return new VoyagerLinkedInProvider(liAt);
    } catch {
      // Fall through to mock if Voyager provider fails to load
    }
  }

  const provider = process.env.LINKEDIN_PROVIDER ?? "mock";

  // Dynamic import to avoid bundling mock data in production
  switch (provider) {
    case "mock":
    default: {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { MockLinkedInProvider } = require("./mock-linkedin-provider");
      return new MockLinkedInProvider();
    }
  }
}
