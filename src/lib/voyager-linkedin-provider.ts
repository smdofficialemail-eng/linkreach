/**
 * Voyager-based LinkedIn Provider
 *
 * Uses LinkedIn's internal Voyager API for real profile search.
 * Requires a valid li_at session cookie stored in the LinkedinAccount.
 */

import {
  type LinkedInProvider,
  type LinkedInProfileData,
  type SearchResult,
  type SendResult,
} from "./linkedin-provider";
import {
  searchProfiles as voyagerSearch,
  getProfile as voyagerGetProfile,
  sendConnectionRequest as voyagerSendConnection,
  sendMessage as voyagerSendMessage,
  type VoyagerProfile,
} from "./linkedin-voyager";

export class VoyagerLinkedInProvider implements LinkedInProvider {
  readonly name = "LinkedIn Voyager API";
  readonly isMock = false;

  private liAt: string;

  constructor(liAt: string) {
    this.liAt = liAt;
  }

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
    const keywords = options?.keywords || query;

    try {
      const result = await voyagerSearch(this.liAt, keywords, {
        location: options?.location,
        title: options?.title,
        company: options?.company,
        connectionDegree: options?.connectionDegree,
        limit: options?.limit || 25,
        start: options?.offset || 0,
      });

      return {
        profiles: result.results.map((p) => this.toProfileData(p)),
        total: result.total,
        hasMore: result.results.length === (options?.limit || 25),
        nextOffset: (options?.offset || 0) + result.results.length,
      };
    } catch (error) {
      console.error("[Voyager] Search failed:", error);
      throw error;
    }
  }

  async getProfile(profileUrl: string): Promise<LinkedInProfileData | null> {
    try {
      const profile = await voyagerGetProfile(this.liAt, profileUrl);
      if (!profile) return null;
      return this.toProfileData(profile);
    } catch (error) {
      console.error("[Voyager] Profile fetch failed:", error);
      return null;
    }
  }

  async sendConnectionRequest(
    profileUrl: string,
    note?: string
  ): Promise<SendResult> {
    try {
      const result = await voyagerSendConnection(this.liAt, profileUrl, note);
      return {
        success: result.success,
        error: result.success ? undefined : result.message,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async sendMessage(
    profileUrl: string,
    message: string
  ): Promise<SendResult> {
    try {
      const result = await voyagerSendMessage(this.liAt, profileUrl, message);
      return {
        success: result.success,
        error: result.success ? undefined : result.message,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async getConnectionStatus(
    _profileUrl: string
  ): Promise<"none" | "pending" | "connected"> {
    // Voyager API can check connection status, but for now return "none"
    return "none";
  }

  /** Convert Voyager profile to our internal format */
  private toProfileData(p: VoyagerProfile): LinkedInProfileData {
    const nameParts = [p.firstName, p.lastName].filter(Boolean);
    const fullName = nameParts.join(" ") || "LinkedIn User";

    return {
      id: p.urn || p.publicId || "",
      publicId: p.publicId,
      firstName: p.firstName || "",
      lastName: p.lastName || "",
      fullName,
      headline: p.headline || "",
      company: p.company || "",
      jobTitle: p.title || "",
      location: p.location || "",
      profileUrl: p.profileUrl || "",
      avatarUrl: p.avatarUrl || "",
      connectionDegree: p.connectionDegree,
      isPremium: p.isPremium || false,
      isOpenToWork: p.isOpenToWork || false,
      isCreator: false,
    };
  }
}
