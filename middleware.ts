import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Security middleware — runs on every request.
 *
 * 1. Security headers (CSP, X-Frame-Options, etc.)
 * 2. Auth guard on /app/* routes
 * 3. Rate limiting on login/register/API
 * 4. CSRF protection on state-changing requests
 */

// Routes that don't need authentication
const PUBLIC_ROUTES = ["/login", "/register", "/api/auth"];

// Rate limit key: IP + path prefix
function getRateLimitKey(request: NextRequest, prefix: string): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  return `${ip}:${prefix}`;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // ── Security Headers ──────────────────────────────────────────────
  // CSP is set in next.config.ts to avoid breaking Next.js internals
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  // ── CSRF Protection ───────────────────────────────────────────────
  // Block state-changing requests (POST/PUT/DELETE) without proper origin
  if (["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");

    // Allow requests from same origin or from Next.js server actions
    const isNextAction = request.headers.get("next-action") !== null;
    const isSameOrigin = !origin || origin.includes(host || "");

    if (!isSameOrigin && !isNextAction && !pathname.startsWith("/api/auth")) {
      return NextResponse.json(
        { error: "CSRF validation failed" },
        { status: 403 }
      );
    }
  }

  // ── Rate Limiting ─────────────────────────────────────────────────
  if (pathname.startsWith("/api/auth/linkedin")) {
    // LinkedIn OAuth — generous since it's redirect-based
    const key = getRateLimitKey(request, "linkedin-oauth");
    const { allowed } = rateLimit(key, 10, 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
  }

  if (pathname === "/api/auth/register" || pathname.includes("register")) {
    const key = getRateLimitKey(request, "register");
    const { allowed } = rateLimit(key, RATE_LIMITS.register.limit, RATE_LIMITS.register.windowMs);
    if (!allowed) {
      return NextResponse.json({ error: "Too many registration attempts. Please try again later." }, { status: 429 });
    }
  }

  // ── Auth Guard ────────────────────────────────────────────────────
  // Protect all /app/* and /api/* routes (except public ones)
  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const isAppRoute = pathname.startsWith("/app");
  const isApiRoute = pathname.startsWith("/api") && !isPublic;

  if (isAppRoute || isApiRoute) {
    // Check for session cookie (NextAuth v5 uses authjs.session-token)
    const sessionCookie = request.cookies.get("authjs.session-token")
      || request.cookies.get("__Secure-authjs.session-token")
      || request.cookies.get("next-auth.session-token")
      || request.cookies.get("__Secure-next-auth.session-token");

    if (!sessionCookie?.value) {
      if (isAppRoute) {
        // Redirect to login for page requests
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }
      // Return 401 for API requests
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
