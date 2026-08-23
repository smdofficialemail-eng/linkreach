/**
 * LinkedIn Voyager API Client
 *
 * Uses LinkedIn's internal Voyager API with the OAuth access token
 * to search profiles and perform actions.
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
}

/**
 * Make an authenticated request to LinkedIn's Voyager API.
 */
async function voyagerRequest(
  accessToken: string,
  url: string,
  options?: { method?: string; body?: unknown }
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "Accept": "application/json",
    "x-restli-protocol-version": "2.0.0",
    "x-li-lang": "en_US",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  if (options?.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method: options?.method || "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("LinkedIn session expired. Please reconnect your LinkedIn account.");
    }
    throw new Error(`LinkedIn API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Search LinkedIn profiles using the Voyager API with OAuth token.
 *
 * @param accessToken - LinkedIn OAuth access token
 * @param keywords - Search keywords
 * @param options - Optional filters
 */
export async function searchProfiles(
  accessToken: string,
  keywords: string,
  options?: {
    location?: string;
    title?: string;
    company?: string;
    connectionDegree?: string;
    limit?: number;
    start?: number;
  }
): Promise<VoyagerSearchResult> {
  // Build search URL with query parameters
  const params = new URLSearchParams();
  params.set("keywords", keywords);
  params.set("origin", "FACETED_SEARCH");

  if (options?.location) params.set("geoUrn", options.location);
  if (options?.title) params.set("title", options.title);
  if (options?.company) params.set("company", options.company);

  const start = options?.start || 0;
  const count = options?.limit || 25;
  params.set("start", String(start));
  params.set("count", String(count));

  const url = `https://www.linkedin.com/voyager/api/search/cluster?${params.toString()}`;

  try {
    const data = await voyagerRequest(accessToken, url);
    return parseSearchResults(data);
  } catch (error) {
    console.error("[Voyager] Search failed:", error);
    throw error;
  }
}

/**
 * Get detailed profile information.
 *
 * @param accessToken - LinkedIn OAuth access token
 * @param profileUrl - LinkedIn profile URL or public ID
 */
export async function getProfile(
  accessToken: string,
  profileUrl: string
): Promise<VoyagerProfile | null> {
  const publicId = extractPublicId(profileUrl);
  if (!publicId) return null;

  const url = `https://www.linkedin.com/voyager/api/identity/profiles/${publicId}`;

  try {
    const data = await voyagerRequest(accessToken, url);
    return parseProfileData(data);
  } catch (error) {
    console.error("[Voyager] Profile fetch failed:", error);
    return null;
  }
}

/**
 * Send a connection request.
 */
export async function sendConnectionRequest(
  accessToken: string,
  profileUrl: string,
  note?: string
): Promise<{ success: boolean; message: string }> {
  const profile = await getProfile(accessToken, profileUrl);
  if (!profile) return { success: false, message: "Could not fetch profile" };

  const url = `https://www.linkedin.com/voyager/api/growth/nodes/INVITE_TO_CONNECT`;

  const body: Record<string, unknown> = {
    invitedProfileId: profile.urn,
    invitationType: "CONNECTION",
  };
  if (note) body.message = note;

  try {
    await voyagerRequest(accessToken, url, { method: "POST", body });
    return { success: true, message: "Connection request sent" };
  } catch (error) {
    return { success: false, message: String(error) };
  }
}

/**
 * Send a message.
 */
export async function sendMessage(
  accessToken: string,
  profileUrl: string,
  message: string
): Promise<{ success: boolean; message: string }> {
  const publicId = extractPublicId(profileUrl);
  if (!publicId) return { success: false, message: "Invalid profile URL" };

  const url = `https://www.linkedin.com/voyager/api/messaging/conversations?action=create`;

  const body = {
    recipientUrn: `urn:li:fsd_profile:${publicId}`,
    messageBody: message,
  };

  try {
    await voyagerRequest(accessToken, url, { method: "POST", body });
    return { success: true, message: "Message sent" };
  } catch (error) {
    return { success: false, message: String(error) };
  }
}

// ---- Helpers ----

function extractPublicId(urlOrId: string): string | null {
  if (!urlOrId.includes("/") && !urlOrId.includes("linkedin.com")) {
    return urlOrId;
  }
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
    const result = (i.result as Record<string, unknown>) ?? i;
    const r = result as Record<string, unknown>;

    const publicIdentity = (r.publicIdentity as Record<string, unknown>) ?? r;
    const pi = publicIdentity as Record<string, unknown>;
    const profilePicture = (r.profilePicture as Record<string, unknown>) ?? r;

    const urn = String(r.urn || r.trackingUrn || pi.urn || "");
    const publicId = String(pi.publicId || r.publicId || r.vmid || "");

    const firstName = String(pi.firstName || r.firstName || "");
    const lastName = String(pi.lastName || r.lastName || "");

    const occupations = r.occupations as Record<string, unknown> | undefined;
    const headline = String(r.headline || occupations?.headline || "");
    const location = String(r.location || r.geoLocation || r.locationName || "");

    const displayImageRaw = profilePicture?.displayImage ?? profilePicture?.rootUrl;
    const displayImage = typeof displayImageRaw === "string" ? displayImageRaw : undefined;

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
    const displayImageRaw = pic?.displayImage;
    const displayImage = typeof displayImageRaw === "string" ? displayImageRaw : undefined;

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
