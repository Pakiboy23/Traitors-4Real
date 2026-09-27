import type { Metadata } from "next";
import ResetPasswordClient from "./ResetPasswordClient";

export const metadata: Metadata = {
  title: "Reset password — Round Table Draft",
  description: "Set a new admin password for Round Table Draft.",
  robots: { index: false, follow: false },
};

/**
 * File route, not a client rewrite. next.config.ts has no rewrites, so a
 * direct load and a refresh of /reset-password are this page on Vercel.
 */
export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
