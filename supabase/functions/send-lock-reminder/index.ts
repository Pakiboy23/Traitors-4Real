import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  ADMIN_NOT_ADMIN_ERROR,
  LOCK_REMINDER_UNAUTHORIZED,
  LOCK_REMINDER_UNAVAILABLE,
  accessTokenFromAuthorization,
  adminMembershipQuery,
  decideLockReminderCaller,
  isProjectApiKey,
} from "../../../src/utils/lockReminderAccess.ts";

/**
 * Sends a weekly lock reminder to every registered device.
 *
 * The operational problem this solves: people forget to submit before the
 * council locks, and last season that meant chasing them by hand.
 *
 * The caller must be a signed-in admin. The gateway accepts the public anon
 * key as a JWT, so this function verifies the bearer token with auth.getUser
 * and checks admin_users — the same membership the Admin tab uses — before it
 * reads a token, contacts Apple, or deletes a row. A missing or invalid JWT
 * is 401. A signed-in user who is not an admin is 403.
 *
 * Credentials come from function secrets, never the request:
 *   APNS_KEY_ID       Key ID of the APNs auth key
 *   APNS_TEAM_ID      Apple Developer team ID
 *   APNS_PRIVATE_KEY  Contents of the .p8 file, PEM including header/footer
 *   APNS_BUNDLE_ID    Defaults to com.roundtabledraft.app
 *   APNS_ENV          Must be "production" for a live send. TestFlight and the
 *                     App Store both use the production APNs host. Sandbox is
 *                     only for Xcode-signed development builds. dryRun still
 *                     works with the secret unset, so an admin can check the
 *                     audience before any key exists.
 *
 * Call with {"dryRun": true} to resolve the audience and render the message
 * without contacting Apple.
 */

const BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID") ?? "com.roundtabledraft.app";
const APNS_ENV = Deno.env.get("APNS_ENV");
const APNS_HOST =
  APNS_ENV === "production" ? "api.push.apple.com" : "api.sandbox.push.apple.com";

interface RequestBody {
  seasonId?: string;
  title?: string;
  body?: string;
  dryRun?: boolean;
  /** "all" sends to every registered iPhone. Omitted or "season" stays on one season. */
  audience?: "season" | "all";
  /**
   * Optional tap target. Only an https recap URL on the public site is
   * forwarded, so this endpoint cannot be used to push an arbitrary link.
   * The Admin Notifications form sends it on the same request as title and body.
   * Example:
   * {"title":"Week 2 recap","body":"Standings are up.","url":"https://traitorsfantasydraft.online/recap/traitors-new-blood-s1/week-2","dryRun":true}
   */
  url?: string;
}

const RECAP_HOSTS = new Set([
  "traitorsfantasydraft.online",
  "www.traitorsfantasydraft.online",
]);

/** Keep in step with sanitizePushDeepLink in src/utils/pushDeepLink.ts. */
const sanitizeDeepLink = (input: unknown): string | null => {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!RECAP_HOSTS.has(url.hostname)) return null;
  if (!url.pathname.startsWith("/recap/")) return null;
  url.hash = "";
  return url.toString();
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** Strips the PEM armour and decodes the base64 body to DER bytes. */
const pemToPkcs8 = (pem: string): Uint8Array => {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

/**
 * Builds the APNs provider token.
 *
 * ES256 over the .p8 key. Web Crypto returns the raw r||s signature APNs
 * expects, so no DER unwrapping is needed here.
 */
const buildProviderToken = async (
  privateKeyPem: string,
  keyId: string,
  teamId: string
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(privateKeyPem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const header = base64url(
    encoder.encode(JSON.stringify({ alg: "ES256", kid: keyId }))
  );
  const claims = base64url(
    encoder.encode(
      JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })
    )
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(`${header}.${claims}`)
  );

  return `${header}.${claims}.${base64url(new Uint8Array(signature))}`;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Use POST." });
  }

  // The anon key is public and the gateway treats it as a valid JWT. Reject
  // it, and the service-role key, before creating a client or touching a table.
  const accessToken = accessTokenFromAuthorization(req.headers.get("Authorization"));
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? null;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? null;
  if (!accessToken || isProjectApiKey(accessToken, anonKey, serviceRoleKey)) {
    return json(401, { error: LOCK_REMINDER_UNAUTHORIZED });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Pass the bearer token in. getUser() with no argument would look at the
  // service-role session, which is not the caller.
  const verified = await supabase.auth.getUser(accessToken);
  const verifiedUserId = verified.data.user?.id ?? null;
  let membership: ReturnType<typeof adminMembershipQuery> | null = null;
  if (verified.error || !verifiedUserId) {
    console.error(
      "Verifying the caller failed:",
      verified.error?.message ?? "no user"
    );
  } else {
    const query = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", verifiedUserId)
      .maybeSingle();
    if (query.error) {
      // Logged, not returned: Postgres error text can describe the schema.
      console.error("Admin membership check failed:", query.error.message);
    }
    membership = adminMembershipQuery(query.data, query.error);
  }

  const decision = decideLockReminderCaller({
    accessToken,
    anonKey,
    serviceRoleKey,
    user: verifiedUserId ? { id: verifiedUserId } : null,
    userError: Boolean(verified.error) || !verifiedUserId,
    membership,
  });

  switch (decision.status) {
    case "unauthorized":
      return json(401, { error: LOCK_REMINDER_UNAUTHORIZED });
    case "forbidden":
      return json(403, { error: ADMIN_NOT_ADMIN_ERROR });
    case "unavailable":
      return json(500, { error: LOCK_REMINDER_UNAVAILABLE });
    case "admin":
      break;
    default: {
      const unreachable: never = decision;
      throw new Error(`Unhandled caller decision: ${JSON.stringify(unreachable)}`);
    }
  }

  let payload: RequestBody = {};
  try {
    payload = (await req.json()) as RequestBody;
  } catch {
    // An empty body is fine; every field is optional.
  }

  // Default to the season currently in play rather than making the caller
  // know which one that is.
  let seasonId = payload.seasonId ?? null;
  if (!seasonId) {
    const { data } = await supabase
      .from("seasons")
      .select("season_id")
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(1);
    seasonId = data?.[0]?.season_id ?? null;
  }

  let query = supabase.from("push_tokens").select("token, platform");
  if (payload.audience !== "all" && seasonId) query = query.eq("season_id", seasonId);
  const { data: tokens, error } = await query;

  if (error) {
    // Logged, not returned: Postgres error text can describe the schema.
    console.error("Reading push tokens failed:", error.message);
    return json(500, { error: "Could not read the device list." });
  }

  const title = payload.title ?? "Council closes soon";
  const body =
    payload.body ?? "Get your banishment and murder calls in before the lock.";
  const audience = (tokens ?? []).filter((row) => row.platform === "ios");
  const suppliedUrl = typeof payload.url === "string" ? payload.url.trim() : "";
  const deepLink = suppliedUrl ? sanitizeDeepLink(suppliedUrl) : null;
  if (suppliedUrl && !deepLink) {
    return json(400, {
      error: "url must be an https recap link on traitorsfantasydraft.online.",
    });
  }

  const scope = payload.audience === "all" ? "all" : "season";

  if (payload.dryRun) {
    return json(200, {
      dryRun: true,
      seasonId,
      scope,
      audience: audience.length,
      notification: {
        title,
        body,
        ...(deepLink ? { url: deepLink } : {}),
      },
    });
  }

  // TestFlight and App Store both talk to api.push.apple.com. Sending live
  // against sandbox from a production-signed binary returns BadDeviceToken,
  // which this function then deletes — wiping every registered device.
  if (APNS_ENV !== "production") {
    return json(503, {
      error: "APNs environment is not production.",
      env: APNS_ENV ?? "(unset)",
      hint: "TestFlight and App Store both use the production APNs host. Set APNS_ENV=production, then retry. Sandbox is only for Xcode-signed development builds. dryRun still works without this secret.",
    });
  }

  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const privateKey = Deno.env.get("APNS_PRIVATE_KEY");

  const missing = [
    !keyId && "APNS_KEY_ID",
    !teamId && "APNS_TEAM_ID",
    !privateKey && "APNS_PRIVATE_KEY",
  ].filter(Boolean);

  // Fail loudly and specifically. A reminder that silently does not send is
  // worse than one that errors, because nobody finds out until after the lock.
  if (missing.length > 0) {
    return json(503, {
      error: "APNs is not configured.",
      missing,
      hint: "Set these as Edge Function secrets, then retry.",
    });
  }

  let providerToken: string;
  try {
    providerToken = await buildProviderToken(privateKey!, keyId!, teamId!);
  } catch (cause) {
    // The cause goes to the function logs rather than the response, for the
    // same reason. The hint is our own text and says everything a caller
    // actually needs to fix it.
    console.error("Signing the APNs provider token failed:", cause);
    return json(500, {
      error: "Could not sign the APNs provider token.",
      hint: "APNS_PRIVATE_KEY must be the full .p8 contents including the BEGIN and END lines.",
    });
  }

  const notification = JSON.stringify({
    aps: {
      alert: { title, body },
      sound: "default",
      "interruption-level": "time-sensitive",
    },
    seasonId,
    ...(deepLink ? { url: deepLink } : {}),
  });

  const stale: string[] = [];
  let delivered = 0;
  const failures: Array<{ reason: string; status: number }> = [];

  for (const row of audience) {
    const response = await fetch(`https://${APNS_HOST}/3/device/${row.token}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${providerToken}`,
        "apns-topic": BUNDLE_ID,
        "apns-push-type": "alert",
        "apns-priority": "10",
      },
      body: notification,
    });

    if (response.ok) {
      delivered += 1;
      continue;
    }

    const detail = await response.text().catch(() => "");
    let reason = detail;
    try {
      reason = JSON.parse(detail).reason ?? detail;
    } catch {
      // Non-JSON error bodies are reported as-is.
    }

    // Apple reports a device that uninstalled or re-registered. Keeping these
    // rows means every future send wastes a request and skews the counts.
    if (response.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered") {
      stale.push(row.token);
    } else {
      failures.push({ reason: String(reason), status: response.status });
    }
  }

  if (stale.length > 0) {
    await supabase.from("push_tokens").delete().in("token", stale);
  }

  return json(200, {
    seasonId,
    attempted: audience.length,
    delivered,
    pruned: stale.length,
    failures,
  });
});
