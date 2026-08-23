"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateLeadTags } from "../actions";

const SUGGESTED_TAGS = [
  "decision-maker",
  "warm-lead",
  "cold-lead",
  "follow-up",
  "enterprise",
  "startup",
  "saas",
  "fintech",
  "healthcare",
  "e-commerce",
  "high-priority",
  "vip",
];

export function TagManager({ leadId, tags }: { leadId: string; tags: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newTag, setNewTag] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addTag = (tag: string) => {
    if (!tag.trim() || tags.includes(tag.trim())) return;
    const updated = [...tags, tag.trim()];
    startTransition(async () => {
      await updateLeadTags(leadId, updated);
      setNewTag("");
      setShowSuggestions(false);
      router.refresh();
    });
  };

  const removeTag = (tag: string) => {
    const updated = tags.filter((t) => t !== tag);
    startTransition(async () => {
      await updateLeadTags(leadId, updated);
      router.refresh();
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(newTag);
    }
  };

  const availableSuggestions = SUGGESTED_TAGS.filter((t) => !tags.includes(t));

  return (
    <div className="space-y-3">
      {/* Current Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-600/15 px-3 py-1 text-xs font-semibold text-brand-300"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                disabled={pending}
                className="ml-0.5 rounded-full p-0.5 transition hover:bg-white/10"
                aria-label={`Remove ${tag}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add Tag Input */}
      <div className="relative">
        <input
          value={newTag}
          onChange={(e) => {
            setNewTag(e.target.value);
            setShowSuggestions(e.target.value.length > 0);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder="Add a tag…"
          className="input text-sm"
        />
        {showSuggestions && availableSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-ink-850 p-1.5 shadow-pop">
            {availableSuggestions
              .filter((t) => t.includes(newTag.toLowerCase()))
              .slice(0, 8)
              .map((tag) => (
                <button
                  key={tag}
                  onClick={() => addTag(tag)}
                  className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-300 transition hover:bg-white/5"
                >
                  {tag}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
