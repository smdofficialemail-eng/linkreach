"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { signIn, signOut } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { auditAuth } from "@/lib/audit";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  workspace: z.string().min(1, "Workspace name is required"),
});

export async function registerAction(_prev: unknown, formData: FormData) {
  // Rate limit: 3 registrations per hour per IP
  const rl = rateLimit("register", RATE_LIMITS.register.limit, RATE_LIMITS.register.windowMs);
  if (!rl.allowed) return { error: "Too many registration attempts. Please try again later." };

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    workspace: formData.get("workspace"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const slug = `${parsed.data.workspace
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}-${Math.random().toString(36).slice(2, 7)}`;

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      memberships: {
        create: {
          role: "owner",
          workspace: {
            create: {
              name: parsed.data.workspace,
              slug,
              lists: {
                create: [
                  { name: "Outbound prospects", color: "#4f46e5" },
                  { name: "Warm network", color: "#0ea5e9" },
                ],
              },
            },
          },
        },
      },
    },
  });

  try {
    await signIn("credentials", { email, password: parsed.data.password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created, but automatic sign-in failed. Please log in." };
    }
  }

  redirect("/app");
}

export async function loginAction(_prev: unknown, formData: FormData) {
  // Rate limit: 5 login attempts per 15 min per IP
  const rl = rateLimit("login", RATE_LIMITS.login.limit, RATE_LIMITS.login.windowMs);
  if (!rl.allowed) return { error: "Too many login attempts. Please try again in 15 minutes." };

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      await auditAuth("auth.login_failed", "unknown", String(formData.get("email") || ""));
      return { error: "Invalid email or password." };
    }
    throw error;
  }
  // Audit successful login
  const loginEmail = String(formData.get("email") || "");
  const loginUser = await prisma.user.findUnique({ where: { email: loginEmail.toLowerCase() } });
  if (loginUser) await auditAuth("auth.login", loginUser.id, loginEmail);
  redirect("/app");
}

export async function logoutAction() {
  // Audit logout (user id from session)
  const { getSession } = await import("@/lib/app");
  const session = await getSession();
  if (session?.user?.id) {
    await auditAuth("auth.logout", session.user.id, session.user.email || "unknown");
  }
  await signOut({ redirect: false });
  redirect("/login");
}
