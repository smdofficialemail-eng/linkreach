"use client";

import { useState, useTransition, useCallback } from "react";
import {
  searchProfilesAction,
  selectProfileAction,
  deselectProfileAction,
  bulkSelectAction,
  addProfilesToCampaignAction,
  getProfilePreviewAction,
} from "./actions";
import type { LinkedInProfile } from "@prisma/client";

type Tab =
  | "discover"
  | "profiles"
  | "selected"
  | "queue"
  | "sent"
  | "connections"
  | "replies";

const TABS: { key: Tab; label: string; count?: number }[] = [
  { key: "discover", label: "Discover" },
  { key: "profiles", label: "Profiles" },
  { key: "selected", label: "Selected" },
  { key: "queue", label: "Queue" },
  { key: "sent", label: "Sent" },
  { key: "connections", label: "Connections" },
  { key: "replies", label: "Replies" },
];

interface Props {
  workspaceId: string;
  workspaceName: string;
  initialProfiles: LinkedInProfile[];
  initialSelections: string[];
  campaigns: { id: string; name: string; status: string }[];
  accounts: { id: string; name: string }[];
  blacklistedIds: string[];
  deliveryMode: string;
}

interface ProfilePreview extends LinkedInProfile {
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
  }>;
  skills?: string[];
  recentActivity?: Array<{
    type: string;
    text: string;
    date?: string;
  }>;
}

export function OutreachClient({
  workspaceId,
  workspaceName,
  initialProfiles: _initialProfiles,
  initialSelections,
  campaigns,
  accounts,
  blacklistedIds,
  deliveryMode,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("discover");
  const [profiles, setProfiles] = useState<LinkedInProfile[]>(_initialProfiles as unknown as LinkedInProfile[]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSelections)
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchUrl, setSearchUrl] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [previewProfile, setPreviewProfile] =
    useState<ProfilePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Bulk selection
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulkBar, setShowBulkBar] = useState(false);
  const [showAddCampaign, setShowAddCampaign] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [connectionNote, setConnectionNote] = useState(
    "{{first_name}}, I came across your profile and thought it would be valuable to connect."
  );
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: string;
    count: number;
    profile?: LinkedInProfile;
  } | null>(null);

  // Filters
  const [degreeFilter, setDegreeFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState("");

  const handleSearch = useCallback(async (overrideQuery?: string) => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const query = overrideQuery || searchUrl || searchQuery;
      if (!query || query.trim().length === 0) {
        setSearchError("Please enter a search query.");
        return;
      }
      const result = await searchProfilesAction(query, workspaceId);
      if (result.error) {
        setSearchError(result.error);
        return;
      }
      setProfiles(result.profiles as unknown as LinkedInProfile[]);
      setSearchResultCount(result.total);
      setActiveTab("profiles");
    } catch (err) {
      console.error("Search failed:", err);
      setSearchError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }, [searchUrl, searchQuery, workspaceId]);

  const handleSelectProfile = useCallback(
    async (profileId: string) => {
      if (selectedIds.has(profileId)) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(profileId);
          return next;
        });
        await deselectProfileAction(workspaceId, profileId);
      } else {
        setSelectedIds((prev) => new Set(prev).add(profileId));
        await selectProfileAction(workspaceId, profileId);
      }
    },
    [selectedIds, workspaceId]
  );

  const handlePreview = useCallback(
    async (profile: LinkedInProfile) => {
      setPreviewLoading(true);
      try {
        const detailed = await getProfilePreviewAction(profile.profileUrl ?? "");
        setPreviewProfile(detailed ? ({ ...detailed, ...profile } as ProfilePreview) : { ...profile } as ProfilePreview);
      } catch {
        setPreviewProfile({ ...profile });
      } finally {
        setPreviewLoading(false);
      }
    },
    []
  );

  const handleBulkToggle = (id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setShowBulkBar(true);
  };

  const handleSelectAll = () => {
    const filtered = getFilteredProfiles();
    const allIds = new Set(filtered.map((p) => p.id));
    setBulkSelected(allIds);
    setShowBulkBar(true);
  };

  const handleDeselectAll = () => {
    setBulkSelected(new Set());
    setShowBulkBar(false);
  };

  const handleBulkAddToCampaign = () => {
    if (!selectedCampaign || bulkSelected.size === 0) return;
    startTransition(async () => {
      await addProfilesToCampaignAction(
        workspaceId,
        selectedCampaign,
        Array.from(bulkSelected),
        connectionNote
      );
      setShowAddCampaign(false);
      setBulkSelected(new Set());
      setShowBulkBar(false);
      setSelectedCampaign("");
    });
  };

  const handleBulkBlacklist = async () => {
    if (bulkSelected.size === 0) return;
    for (const id of bulkSelected) {
      await fetch("/api/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, profileId: id, reason: "manual" }),
      }).catch(() => {});
    }
    setBulkSelected(new Set());
    setShowBulkBar(false);
  };

  const getFilteredProfiles = () => {
    let filtered = profiles;
    if (degreeFilter !== "all") {
      filtered = filtered.filter(
        (p) => String(p.connectionDegree) === degreeFilter
      );
    }
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          (p.headline ?? "").toLowerCase().includes(q) ||
          (p.company ?? "").toLowerCase().includes(q)
      );
    }
    return filtered;
  };

  const filteredProfiles = getFilteredProfiles();

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Outreach
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Discover profiles, select leads, and launch outreach campaigns.
            {deliveryMode === "simulation" && (
              <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-300">
                MOCK MODE
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <span className="rounded-full bg-brand-600/15 px-4 py-2 text-sm font-bold text-brand-300">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-white/8 pb-px">
        {TABS.map((tab) => {
          const count =
            tab.key === "selected"
              ? selectedIds.size
              : tab.key === "profiles"
                ? profiles.length
                : undefined;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? "border-b-2 border-brand-400 bg-white/5 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
              {count !== undefined && count > 0 && (
                <span className="ml-1.5 rounded-full bg-white/10 px-2 py-0.5 text-xs">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Discover Tab */}
      {activeTab === "discover" && (
        <div className="space-y-4">
          {/* LinkedIn URL Input */}
          <div className="card p-6 shadow-card">
            <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-slate-400">
              LinkedIn Search
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              Paste a LinkedIn search URL or enter keywords to discover profiles.
            </p>
            <div className="flex gap-3">
              <input
                value={searchUrl}
                onChange={(e) => setSearchUrl(e.target.value)}
                placeholder="https://www.linkedin.com/search/results/people/?keywords=..."
                className="input flex-1"
              />
              <button
                onClick={() => handleSearch()}
                disabled={isSearching || (!searchUrl && !searchQuery)}
                className="btn-primary px-6 py-2"
              >
                {isSearching ? "Searching…" : "Search"}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-slate-600">or</span>
              <div className="flex flex-1 gap-2">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch(e.currentTarget.value)}
                  placeholder="Enter keywords: performance marketing, startup founder, VP Sales..."
                  className="input flex-1"
                />
              </div>
            </div>
            {searchError && (
              <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {searchError}
              </div>
            )}
          </div>

          {/* Quick Search Suggestions */}
          <div className="card p-6 shadow-card">
            <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-slate-400">
              Quick Search Suggestions
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                "VP Marketing",
                "Startup Founder",
                "Head of Sales",
                "Product Manager",
                "Engineering Manager",
                "Data Science",
                "CEO",
                "CTO",
                "Growth Lead",
                "HR Director",
              ].map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setSearchQuery(term);
                    handleSearch(term);
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:border-brand-400 hover:text-white"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          {/* Import Sources */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-5 shadow-card">
              <h3 className="text-sm font-bold text-white">CSV Import</h3>
              <p className="mt-1 text-xs text-slate-500">
                Upload a CSV with LinkedIn profile URLs
              </p>
              <button className="btn-secondary mt-3 px-4 py-2 text-xs">
                Upload CSV
              </button>
            </div>
            <div className="card p-5 shadow-card">
              <h3 className="text-sm font-bold text-white">
                Sales Navigator
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Import saved leads from Sales Navigator
              </p>
              <button className="btn-secondary mt-3 px-4 py-2 text-xs">
                Connect
              </button>
            </div>
            <div className="card p-5 shadow-card">
              <h3 className="text-sm font-bold text-white">Manual Entry</h3>
              <p className="mt-1 text-xs text-slate-500">
                Add individual profile URLs
              </p>
              <button className="btn-secondary mt-3 px-4 py-2 text-xs">
                Add Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profiles Tab */}
      {activeTab === "profiles" && (
        <div className="flex gap-0">
          {/* Profile List */}
          <div className={`${previewProfile ? "w-1/2" : "w-full"} transition-all`}>
            {/* Search/Filter bar */}
            <div className="mb-4 flex items-center gap-3">
              <input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter profiles..."
                className="input flex-1"
              />
              <select
                value={degreeFilter}
                onChange={(e) => setDegreeFilter(e.target.value)}
                className="input w-40"
              >
                <option value="all">All degrees</option>
                <option value="1">1st degree</option>
                <option value="2">2nd degree</option>
                <option value="3">3rd degree</option>
              </select>
              <span className="text-sm text-slate-500">
                {filteredProfiles.length} profile
                {filteredProfiles.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Profile Cards */}
            {filteredProfiles.length === 0 ? (
              <div className="card p-16 text-center shadow-card">
                <p className="font-extrabold text-slate-300">
                  No profiles found
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Try the Discover tab to search for profiles.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProfiles.map((profile) => {
                  const isSelected = selectedIds.has(profile.id);
                  const isBlacklisted = blacklistedIds.includes(profile.id);
                  return (
                    <div
                      key={profile.id}
                      className={`card flex items-center gap-4 p-4 shadow-card transition hover:border-brand-500/30 ${
                        previewProfile?.id === profile.id
                          ? "border-brand-500/50 ring-1 ring-brand-500/25"
                          : ""
                      } ${isBlacklisted ? "opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={bulkSelected.has(profile.id)}
                        onChange={() => handleBulkToggle(profile.id)}
                        className="size-4 rounded border-white/20 bg-ink-800"
                      />
                      {/* Avatar */}
                      {profile.avatarUrl ? (
                        <img
                          src={profile.avatarUrl}
                          alt={profile.fullName}
                          className="size-12 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-ink-600 to-ink-700 text-lg font-extrabold text-slate-200">
                          {profile.firstName?.charAt(0) ??
                            profile.fullName.charAt(0)}
                        </span>
                      )}

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-extrabold text-white">
                            {profile.fullName}
                          </p>
                          {profile.isPremium && (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                              PREMIUM
                            </span>
                          )}
                          {profile.isOpenToWork && (
                            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                              OPEN TO WORK
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-slate-400">
                          {profile.headline ?? ""}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-600">
                          {profile.location && <span>{profile.location}</span>}
                          {profile.connectionDegree && (
                            <span>
                              {profile.connectionDegree}
                              {profile.connectionDegree === 1
                                ? "st"
                                : profile.connectionDegree === 2
                                  ? "nd"
                                  : "rd"}{" "}
                              degree
                            </span>
                          )}
                          {profile.mutualConnections && (
                            <span>
                              {profile.mutualConnections} mutual
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => handlePreview(profile)}
                          className="btn-ghost px-3 py-1.5 text-xs"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => handleSelectProfile(profile.id)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                            isSelected
                              ? "bg-brand-600 text-white"
                              : "bg-white/5 text-slate-300 hover:bg-white/10"
                          }`}
                        >
                          {isSelected ? "Selected ✓" : "Select"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Profile Preview Drawer */}
          {previewProfile && (
            <div className="sticky top-0 h-[calc(100vh-8rem)] w-1/2 overflow-y-auto border-l border-white/8 pl-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
                  Profile Preview
                </h3>
                <button
                  onClick={() => setPreviewProfile(null)}
                  className="text-slate-500 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {previewLoading ? (
                <div className="card p-8 text-center shadow-card">
                  <p className="text-sm text-slate-400">Loading profile...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Profile Header */}
                  <div className="card p-5 shadow-card">
                    <div className="flex items-start gap-4">
                      {previewProfile.avatarUrl ? (
                        <img
                          src={previewProfile.avatarUrl}
                          alt={previewProfile.fullName}
                          className="size-16 shrink-0 rounded-2xl object-cover"
                        />
                      ) : (
                        <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-extrabold text-white">
                          {previewProfile.firstName?.charAt(0) ??
                            previewProfile.fullName.charAt(0)}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-extrabold text-white">
                          {previewProfile.fullName}
                        </h2>
                        <p className="text-sm text-slate-300">
                          {previewProfile.headline ?? ""}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {previewProfile.location && (
                            <span>{previewProfile.location}</span>
                          )}
                          {previewProfile.connectionDegree && (
                            <span>
                              · {previewProfile.connectionDegree}
                              {previewProfile.connectionDegree === 1
                                ? "st"
                                : "nd"}{" "}
                              degree
                            </span>
                          )}
                          {previewProfile.isPremium && (
                            <span className="text-amber-400">· Premium</span>
                          )}
                          {previewProfile.isOpenToWork && (
                            <span className="text-emerald-400">
                              · Open to Work
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {previewProfile.profileUrl && (
                        <a
                          href={previewProfile.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary px-3 py-1.5 text-xs"
                        >
                          View on LinkedIn ↗
                        </a>
                      )}
                      <button
                        onClick={() => {
                          handleSelectProfile(previewProfile.id);
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                          selectedIds.has(previewProfile.id)
                            ? "bg-brand-600 text-white"
                            : "btn-secondary"
                        }`}
                      >
                        {selectedIds.has(previewProfile.id)
                          ? "Remove from Selected"
                          : "Add to Leads"}
                      </button>
                      <button
                        onClick={() => {
                          setConfirmAction({
                            type: "connection_request",
                            count: 1,
                            profile: previewProfile,
                          });
                          setShowConfirmModal(true);
                        }}
                        className="btn-primary px-3 py-1.5 text-xs"
                      >
                        Send Connection
                      </button>
                      <button className="btn-ghost px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">
                        Blacklist
                      </button>
                    </div>
                  </div>

                  {/* About */}
                  {previewProfile.about && (
                    <div className="card p-5 shadow-card">
                      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                        About
                      </h3>
                      <p className="text-sm leading-relaxed text-slate-300">
                        {previewProfile.about}
                      </p>
                    </div>
                  )}

                  {/* Experience */}
                  {(previewProfile as ProfilePreview).experience &&
                    (previewProfile as ProfilePreview).experience!.length >
                      0 && (
                      <div className="card p-5 shadow-card">
                        <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                          Experience
                        </h3>
                        <div className="space-y-4">
                          {(previewProfile as ProfilePreview).experience!.map(
                            (exp, i) => (
                              <div
                                key={i}
                                className="border-l-2 border-brand-500/30 pl-4"
                              >
                                <p className="text-sm font-bold text-white">
                                  {exp.title}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {exp.company}
                                </p>
                                {(exp.startDate || exp.endDate) && (
                                  <p className="text-[11px] text-slate-600">
                                    {exp.startDate ?? ""} –{" "}
                                    {exp.endDate ?? "Present"}
                                  </p>
                                )}
                                {exp.description && (
                                  <p className="mt-1 text-xs text-slate-500">
                                    {exp.description}
                                  </p>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {/* Education */}
                  {(previewProfile as ProfilePreview).education &&
                    (previewProfile as ProfilePreview).education!.length >
                      0 && (
                      <div className="card p-5 shadow-card">
                        <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                          Education
                        </h3>
                        <div className="space-y-3">
                          {(previewProfile as ProfilePreview).education!.map(
                            (edu, i) => (
                              <div key={i}>
                                <p className="text-sm font-bold text-white">
                                  {edu.school}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {[edu.degree, edu.field]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {/* Skills */}
                  {(previewProfile as ProfilePreview).skills &&
                    (previewProfile as ProfilePreview).skills!.length > 0 && (
                      <div className="card p-5 shadow-card">
                        <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                          Skills
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {(previewProfile as ProfilePreview).skills!.map(
                            (skill, i) => (
                              <span
                                key={i}
                                className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300"
                              >
                                {skill}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {/* Recent Activity */}
                  {(previewProfile as ProfilePreview).recentActivity &&
                    (previewProfile as ProfilePreview).recentActivity!.length >
                      0 && (
                      <div className="card p-5 shadow-card">
                        <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                          Recent Activity
                        </h3>
                        <div className="space-y-2">
                          {(previewProfile as ProfilePreview).recentActivity!.map(
                            (act, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-2 rounded-lg bg-white/3 p-3"
                              >
                                <span className="mt-0.5 text-xs text-slate-600">
                                  {act.type === "post" ? "📝" : "👍"}
                                </span>
                                <div>
                                  <p className="text-xs text-slate-300">
                                    {act.text}
                                  </p>
                                  {act.date && (
                                    <p className="text-[11px] text-slate-600">
                                      {act.date}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Selected Tab */}
      {activeTab === "selected" && (
        <div className="space-y-4">
          {selectedIds.size === 0 ? (
            <div className="card p-16 text-center shadow-card">
              <p className="font-extrabold text-slate-300">
                No profiles selected
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Go to Profiles and select profiles to add them here.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400">
                  {selectedIds.size} profile{selectedIds.size !== 1 ? "s" : ""}{" "}
                  selected
                </span>
                <button
                  onClick={() => setShowAddCampaign(true)}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  Add to Campaign
                </button>
                <button
                  onClick={() => {
                    setBulkSelected(new Set(selectedIds));
                    setShowBulkBar(true);
                    setActiveTab("profiles");
                  }}
                  className="btn-secondary px-4 py-2 text-sm"
                >
                  View Selected
                </button>
              </div>
              <div className="space-y-2">
                {profiles
                  .filter((p) => selectedIds.has(p.id))
                  .map((profile) => (
                    <div
                      key={profile.id}
                      className="card flex items-center gap-4 p-4 shadow-card"
                    >
                      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-ink-600 to-ink-700 text-lg font-extrabold text-slate-200">
                        {profile.firstName?.charAt(0) ??
                          profile.fullName.charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-white">
                          {profile.fullName}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {profile.headline ?? ""}
                        </p>
                      </div>
                      <button
                        onClick={() => handleSelectProfile(profile.id)}
                        className="btn-ghost px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Queue / Sent / Connections / Replies — placeholder tabs */}
      {(["queue", "sent", "connections", "replies"] as Tab[]).includes(
        activeTab
      ) && (
        <div className="card p-16 text-center shadow-card">
          <p className="font-extrabold text-slate-300">
            {activeTab === "queue" && "No queued actions"}
            {activeTab === "sent" && "No sent actions yet"}
            {activeTab === "connections" && "No connections yet"}
            {activeTab === "replies" && "No replies yet"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {activeTab === "queue" &&
              "Actions will appear here once you launch a campaign."}
            {activeTab === "sent" &&
              "Sent connection requests and messages will appear here."}
            {activeTab === "connections" &&
              "Accepted connections will appear here."}
            {activeTab === "replies" &&
              "Lead replies will appear here and stop follow-up sequences."}
          </p>
        </div>
      )}

      {/* Bulk Action Bar */}
      {showBulkBar && bulkSelected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-white/10 bg-ink-800 px-6 py-4 shadow-2xl">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-white">
              {bulkSelected.size} selected
            </span>
            <button
              onClick={() => setShowAddCampaign(true)}
              className="btn-primary px-4 py-2 text-sm"
            >
              Add to Campaign
            </button>
            <button
              onClick={handleBulkBlacklist}
              className="btn-ghost px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
            >
              Blacklist
            </button>
            <button
              onClick={handleDeselectAll}
              className="text-sm text-slate-400 hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Add to Campaign Modal */}
      {showAddCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-lg font-extrabold text-white">
              Add to Campaign
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {bulkSelected.size} profile{bulkSelected.size !== 1 ? "s" : ""}{" "}
              will be added.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="label">Select Campaign</label>
                <select
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  className="input"
                >
                  <option value="">Choose a campaign...</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Connection Note</label>
                <textarea
                  value={connectionNote}
                  onChange={(e) => setConnectionNote(e.target.value)}
                  className="input h-24 resize-none"
                  placeholder="Connection request message..."
                />
                <p className="mt-1 text-[11px] text-slate-600">
                  Variables: {"{{first_name}}"}, {"{{last_name}}"},{" "}
                  {"{{company}}"}, {"{{job_title}}"}, {"{{location}}"}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddCampaign(false);
                  setBulkSelected(new Set());
                }}
                className="btn-ghost px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAddToCampaign}
                disabled={!selectedCampaign || isPending}
                className="btn-primary px-5 py-2 text-sm"
              >
                {isPending ? "Adding..." : "Add to Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-extrabold text-white">
              Send Connection Request
            </h3>
            {confirmAction.profile && (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/5 p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-600/25 text-sm font-extrabold text-brand-300">
                  {confirmAction.profile.firstName?.charAt(0) ?? "?"}
                </span>
                <div>
                  <p className="text-sm font-bold text-white">
                    {confirmAction.profile.fullName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {confirmAction.profile.headline ?? ""}
                  </p>
                </div>
              </div>
            )}
            <div className="mt-4 rounded-xl bg-white/5 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Connection Note
              </p>
              <p className="mt-1 text-sm text-slate-300">{connectionNote}</p>
            </div>
            {accounts.length > 0 && (
              <div className="mt-3 rounded-xl bg-white/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Account
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  {accounts[0].name}
                </p>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmAction(null);
                }}
                className="btn-ghost px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Queue the connection request
                  setShowConfirmModal(false);
                  setConfirmAction(null);
                }}
                className="btn-primary px-5 py-2 text-sm"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
