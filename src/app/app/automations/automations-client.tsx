"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { processJobs, cancelJob, retryJob } from "./actions";

type Job = {
  id: string;
  action: string;
  status: string;
  payload: unknown;
  error: string | null;
  claimedAt: Date | null;
  createdAt: Date;
  campaignName: string | null;
};

type Scheduled = {
  id: string;
  action: string;
  status: string;
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  attempts: number;
  lastError: string | null;
  leadName: string;
  campaignName: string;
};

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-amber-500/15 text-amber-400",
  in_progress: "bg-blue-500/15 text-blue-400",
  done: "bg-emerald-500/15 text-emerald-400",
  failed: "bg-red-500/15 text-red-400",
  running: "bg-blue-500/15 text-blue-400",
  success: "bg-emerald-500/15 text-emerald-400",
  retrying: "bg-orange-500/15 text-orange-400",
  cancelled: "bg-slate-500/15 text-slate-400",
};

const ACTION_LABELS: Record<string, string> = {
  connect: "🤝 Connection Request",
  message: "💬 Send Message",
  follow_up: "🔄 Follow-up",
  reaction: "❤️ React",
  profile_view: "👁 Profile View",
  connection_request: "🤝 Connection Request",
};

function timeAgo(date: Date) {
  const now = Date.now();
  const d = new Date(date).getTime();
  const diff = now - d;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function AutomationsClient({
  jobs,
  scheduled,
}: {
  jobs: Job[];
  scheduled: Scheduled[];
}) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [tab, setTab] = useState<"jobs" | "scheduled">("jobs");

  const handleProcessJobs = async () => {
    setProcessing(true);
    try {
      const result = await processJobs();
      if (result?.processed) {
        alert(`Processed ${result.processed} job(s)`);
      }
      router.refresh();
    } catch {
      alert("Error processing jobs");
    }
    setProcessing(false);
  };

  const handleCancel = async (jobId: string) => {
    await cancelJob(jobId);
    router.refresh();
  };

  const handleRetry = async (jobId: string) => {
    await retryJob(jobId);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Tabs + Process button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-white/10 bg-ink-800/50 p-1">
          <button
            onClick={() => setTab("jobs")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              tab === "jobs" ? "bg-brand-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Extension Jobs ({jobs.length})
          </button>
          <button
            onClick={() => setTab("scheduled")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              tab === "scheduled" ? "bg-brand-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Scheduled Actions ({scheduled.length})
          </button>
        </div>
        <button
          onClick={handleProcessJobs}
          disabled={processing}
          className="btn-primary flex items-center gap-2 px-5 py-2.5"
        >
          {processing ? (
            <>
              <span className="animate-spin">⏳</span> Processing…
            </>
          ) : (
            <>⚡ Process Queue</>
          )}
        </button>
      </div>

      {/* Extension Jobs */}
      {tab === "jobs" && (
        <div className="rounded-xl border border-white/8 bg-ink-800/40">
          {jobs.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-4xl">📭</p>
              <p className="mt-3 text-sm font-bold text-slate-400">No jobs in the queue</p>
              <p className="mt-1 text-xs text-slate-500">
                Launch a campaign to start queuing jobs
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-4 px-5 py-3 transition hover:bg-white/[0.02]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">
                        {ACTION_LABELS[job.action] || job.action}
                      </span>
                      {job.campaignName && (
                        <span className="text-xs text-slate-500">
                          · {job.campaignName}
                        </span>
                      )}
                    </div>
                    {job.error && (
                      <p className="mt-1 text-xs text-red-400">{job.error}</p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-500">
                      {timeAgo(job.createdAt)}
                      {job.claimedAt && ` · claimed ${timeAgo(job.claimedAt)}`}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      STATUS_COLORS[job.status] || "bg-slate-500/15 text-slate-400"
                    }`}
                  >
                    {job.status}
                  </span>
                  <div className="flex gap-1">
                    {job.status === "failed" && (
                      <button
                        onClick={() => handleRetry(job.id)}
                        className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-400 hover:border-brand-400 hover:text-brand-300"
                      >
                        Retry
                      </button>
                    )}
                    {job.status === "queued" && (
                      <button
                        onClick={() => handleCancel(job.id)}
                        className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-400 hover:border-red-400 hover:text-red-300"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scheduled Actions */}
      {tab === "scheduled" && (
        <div className="rounded-xl border border-white/8 bg-ink-800/40">
          {scheduled.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-4xl">📅</p>
              <p className="mt-3 text-sm font-bold text-slate-400">No scheduled actions</p>
              <p className="mt-1 text-xs text-slate-500">
                Actions will appear here when campaigns create follow-ups
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {scheduled.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center gap-4 px-5 py-3 transition hover:bg-white/[0.02]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">
                        {ACTION_LABELS[action.action] || action.action}
                      </span>
                      <span className="text-xs text-slate-400">
                        → {action.leadName}
                      </span>
                      <span className="text-xs text-slate-500">
                        · {action.campaignName}
                      </span>
                    </div>
                    {action.lastError && (
                      <p className="mt-1 text-xs text-red-400">{action.lastError}</p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-500">
                      Scheduled: {new Date(action.scheduledAt).toLocaleString()}
                      {action.attempts > 0 && ` · attempts: ${action.attempts}`}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      STATUS_COLORS[action.status] || "bg-slate-500/15 text-slate-400"
                    }`}
                  >
                    {action.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
