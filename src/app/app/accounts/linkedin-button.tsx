"use client";

/**
 * LinkedInConnectButton — opens /api/auth/linkedin in a popup window
 * so the user can authorize without leaving the Accounts page.
 */
export function LinkedInConnectButton() {
  const handleConnect = () => {
    const width = 600;
    const height = 700;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    const popup = window.open(
      "/api/auth/linkedin",
      "linkedin-oauth",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    // Poll for the popup to close — when it does, the callback has run.
    const poll = setInterval(() => {
      if (popup?.closed) {
        clearInterval(poll);
        // Reload the page to show the newly connected account.
        window.location.reload();
      }
    }, 500);
  };

  return (
    <div className="card p-6 shadow-card">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-4">
          {/* LinkedIn logo (inline SVG) */}
          <div className="flex size-12 items-center justify-center rounded-xl bg-[#0a66c2]">
            <svg className="size-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-extrabold text-white">Login with LinkedIn</p>
            <p className="text-xs text-slate-400">
              Connect your LinkedIn profile to import your name, photo, and headline.
              <br />
              <span className="text-slate-500">
                Requires a LinkedIn app at{" "}
                <a
                  href="https://www.linkedin.com/developers/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-400 underline"
                >
                  linkedin.com/developers/apps
                </a>
              </span>
            </p>
          </div>
        </div>
        <button onClick={handleConnect} className="btn-primary flex items-center gap-2 px-5 py-2.5">
          <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          Connect LinkedIn
        </button>
      </div>
    </div>
  );
}
