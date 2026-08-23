/**
 * LinkedIn Voyager API Client
 *
 * Uses LinkedIn's internal Voyager API (same endpoints the website uses)
 * to search profiles, get profile details, and perform actions.
 *
 * Requires a valid LinkedIn session cookie (li_at).
 *
 * WARNING: This uses unofficial LinkedIn endpoints. Use at your own risk.
 * LinkedIn may change these endpoints without notice.
 */

export interface VoyagerProfile {
  urn: string;
  firstName: string;
  lastName: string;
  headline: string;
  location: string;
  profileUrl: string;
  avatarUrl?: string;
  connectionDegree?: number;
  isPremium?: boolean;
  isOpenToWork?: boolean;
  company?: string;
  title?: string;
  publicId?: string;
}

export interface VoyagerSearchResult {
  results: VoyagerProfile[];
  total: number;
  searchId?: string;
}

// Required headers for Voyager API requests
function getHeaders(liAt: string, csrfToken?: string) {
  return {
    "Cookie": `li_at=${liAt};${csrfToken ? ` JSESSIONID="${csrfToken}"` : ""}`,
    "Accept": "application/json",
    "x-restli-protocol-version": "2.0.0",
    "x-li-lang": "en_US",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "x-li-page-instance": "voyager-feed",
    "x-li-track": JSON.stringify({
      clientVersion: "1.13.0",
      deviceFormFactor: "DESKTOP",
      mpName: "voyager-web",
    }),
  };
}

/**
 * Search LinkedIn profiles using the Voyager search API.
 *
 * @param liAt - The li_at session cookie value
 * @param keywords - Search keywords (e.g., "founders india")
 * @param options - Optional filters
 */
export async function searchProfiles(
  liAt: string,
  keywords: string,
  options?: {
    location?: string;
    industry?: string;
    title?: string;
    company?: string;
    connectionDegree?: string;
    limit?: number;
    start?: number;
  }
): Promise<VoyagerSearchResult> {
  // Build search parameters
  const searchParams = new URLSearchParams();
  searchParams.set("keywords", keywords);
  searchParams.set("origin", "FACETED_SEARCH");

  if (options?.location) {
    searchParams.set("geoUrn", options.location);
  }
  if (options?.title) {
    searchParams.set("title", options.title);
  }
  if (options?.company) {
    searchParams.set("company", options.company);
  }
  if (options?.connectionDegree) {
    searchParams.set("connectionOf", options.connectionDegree);
  }

  const start = options?.start || 0;
  const count = options?.limit || 25;
  searchParams.set("start", String(start));
  searchParams.set("count", String(count));

  // Use the search API endpoint
  const url = `https://www.linkedin.com/voyager/api/search/cluster?${searchParams.toString()}`;

  try {
    const response = await fetch(url, {
      headers: getHeaders(liAt),
      method: "GET",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("LinkedIn session expired. Please reconnect your LinkedIn account.");
      }
      throw new Error(`LinkedIn API error: ${response.status}`);
    }

    const data = await response.json();
    return parseSearchResults(data);
  } catch (error) {
    console.error("[Voyager] Search failed:", error);
    throw error;
  }
}

/**
 * Get detailed profile information from LinkedIn.
 *
 * @param liAt - The li_at session cookie value
 * @param profileUrl - LinkedIn profile URL or public ID
 */
export async function getProfile(
  liAt: string,
  profileUrl: string
): Promise<VoyagerProfile | null> {
  // Extract public ID from URL
  const publicId = extractPublicId(profileUrl);
  if (!publicId) return null;

  const url = `https://www.linkedin.com/voyager/api/identity/profiles/${publicId}`;

  try {
    const response = await fetch(url, {
      headers: getHeaders(liAt),
      method: "GET",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return parseProfileData(data);
  } catch (error) {
    console.error("[Voyager] Profile fetch failed:", error);
    return null;
  }
}

/**
 * Send a connection request via Voyager API.
 */
export async function sendConnectionRequest(
  liAt: string,
  profileUrl: string,
  note?: string
): Promise<{ success: boolean; message: string }> {
  const publicId = extractPublicId(profileUrl);
  if (!publicId) {
    return { success: false, message: "Invalid profile URL" };
  }

  // First get the profile to find the tracking ID
  const profile = await getProfile(liAt, profileUrl);
  if (!profile) {
    return { success: false, message: "Could not fetch profile" };
  }

  const url = `https://www.linkedin.com/voyager/api/growth/nodes/INVITE_TO_CONNECT`;

  const body: Record<string, unknown> = {
    invitedProfileId: profile.urn,
    invitationType: "CONNECTION",
  };

  if (note) {
    body.message = note;
  }

  try {
    const response = await fetch(url, {
      headers: {
        ...getHeaders(liAt),
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return { success: false, message: `LinkedIn API error: ${response.status}` };
    }

    return { success: true, message: "Connection request sent" };
  } catch (error) {
    return { success: false, message: String(error) };
  }
}

/**
 * Send a message via Voyager API.
 */
export async function sendMessage(
  liAt: string,
  profileUrl: string,
  message: string
): Promise<{ success: boolean; message: string }> {
  const publicId = extractPublicId(profileUrl);
  if (!publicId) {
    return { success: false, message: "Invalid profile URL" };
  }

  const url = `https://www.linkedin.com/voyager/api/messaging/conversations?action=create`;

  const body = {
    recipientUrn: `urn:li:fsd_profile:${publicId}`,
    messageBody: message,
  };

  try {
    const response = await fetch(url, {
      headers: {
        ...getHeaders(liAt),
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return { success: false, message: `LinkedIn API error: ${response.status}` };
    }

    return { success: true, message: "Message sent" };
  } catch (error) {
    return { success: false, message: String(error) };
  }
}

// ---- Helper functions ----

function extractPublicId(urlOrId: string): string | null {
  // Handle direct public IDs
  if (!urlOrId.includes("/") && !urlOrId.includes("linkedin.com")) {
    return urlOrId;
  }

  // Handle URLs like https://www.linkedin.com/in/username/
  const match = urlOrId.match(/linkedin\.com\/in\/([^/?]+)/);
  if (match) return match[1];

  return null;
}

function parseSearchResults(data: unknown): VoyagerSearchResult {
  const results: VoyagerProfile[] = [];

  try {
    const responseData = data as Record<string, unknown>;
    const elements = (responseData.elements as unknown[]) || [];

    for (const element of elements) {
      const el = element as Record<string, unknown>;
      const items = (el.items as unknown[]) || [];

      for (const item of items) {
        const profile = parseSearchItem(item);
        if (profile) results.push(profile);
      }
    }
  } catch {
    // Parse error — return empty results
  }

  return { results, total: results.length };
}

function parseSearchItem(item: unknown): VoyagerProfile | null {
  try {
    const i = item as Record<string, unknown>;
    const result = i.result ?? i;
    const r = result as Record<string, unknown>;

    const publicIdentity = r.publicIdentity ?? r;
    const pi = publicIdentity as Record<string, unknown>;
    const profilePicture = r.profilePicture ?? r;

    // Extract URN and public ID
    const urn = String(r.urn || r.trackingUrn || pi.urn || "");
    const publicId = String(pi.publicId || r.publicId || r.vmid || "");

    // Get name parts
    const firstName = String(pi.firstName || r.firstName || "");
    const lastName = String(pi.lastName || r.lastName || "");
    const occupations = r.occupations as Record<string, unknown> | undefined;
    const headline = String(r.headline || occupations?.headline || "");
    const location = String(r.location || r.geoLocation || r.locationName || "");

    // Get avatar
    const pic = profilePicture as Record<string, unknown>;
    const displayImageRaw = pic?.displayImage ?? pic?.rootUrl;
    const displayImage = typeof displayImageRaw === "string" ? displayImageRaw : undefined;

    // Get connection info
    const degree = r.connectionDegree ?? r.degree;

    if (!firstName && !lastName) return null;

    return {
      urn,
      firstName,
      lastName,
      headline,
      location,
      profileUrl: publicId ? `https://www.linkedin.com/in/${publicId}/` : "",
      avatarUrl: displayImage,
      connectionDegree: typeof degree === "number" ? degree : undefined,
      isPremium: Boolean(r.premiumSubscriber || r.isPremium),
      isOpenToWork: Boolean(r.openToWork || r.showOpenToWork),
      company: String(r.company || r.currentCompany || "") || undefined,
      title: String(r.title || r.currentTitle || "") || undefined,
      publicId,
    };
  } catch {
    return null;
  }
}

function parseProfileData(data: unknown): VoyagerProfile | null {
  try {
    const d = data as Record<string, unknown>;
    const firstName = String(d.firstName || "");
    const lastName = String(d.lastName || "");
    const headline = String(d.headline || "");
    const publicId = String(d.publicId || d.vanityName || "");
    const geoLoc = d.geoLocation as Record<string, unknown> | undefined;
    const location = String(d.locationName || geoLoc?.full || "");

    const pic = d.profilePicture as Record<string, unknown> | undefined;
    const displayImage = pic?.displayImage as string | undefined;

    return {
      urn: String(d.urn || ""),
      firstName,
      lastName,
      headline,
      location,
      profileUrl: publicId ? `https://www.linkedin.com/in/${publicId}/` : "",
      avatarUrl: displayImage,
      isPremium: Boolean(d.premiumSubscriber),
      publicId,
    };
  } catch {
    return null;
  }
}
