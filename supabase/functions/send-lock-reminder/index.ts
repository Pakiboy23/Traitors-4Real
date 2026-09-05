import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Sends a weekly lock reminder to every registered device.
 *
 * The operational problem this solves: people forget to submit before the
 * council locks, and last season that meant chasing them by hand.
 *
 * Credentials come from function secrets, never the request:
 *   APNS_KEY_ID       Key ID of the APNs auth key
 *   APNS_TEAM_ID      Apple Developer team ID
 *   APNS_PRIVATE_KEY  Contents of the .p8 file, PEM including header/footer
 *   APNS_BUNDLE_ID    Defaults to com.roundtabledraft.app
 *   APNS_ENV          Must be "production" for a live send. TestFlight and the
 *                     App Store both use the production APNs host. Sandbox is
 *                     only for Xcode-signed development builds. dryRun still
 *                     works with the secret unset, so the audience can be
 *                     checked before any key exists.
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
}

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
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
  if (req.method !== "POST") {
    return json(405, { error: "Use POST." });
  }

  let payload: RequestBody = {};
  try {
    payload = (await req.json()) as RequestBody;
  } catch {
    // An empty body is fine; every field is optional.
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

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
  if (seasonId) query = query.eq("season_id", seasonId);
  const { data: tokens, error } = await query;

  if (error) {
    // Logged, not returned: Postgres error text can describe the schema, and
    // the anon key is public so anyone can reach this endpoint.
    console.error("Reading push tokens failed:", error.message);
    return json(500, { error: "Could not read the device list." });
  }

  const title = payload.title ?? "Council closes soon";
  const body =
    payload.body ?? "Get your banishment and murder calls in before the lock.";
  const audience = (tokens ?? []).filter((row) => row.platform === "ios");

  if (payload.dryRun) {
    return json(200, {
      dryRun: true,
      seasonId,
      audience: audience.length,
      notification: { title, body },
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
