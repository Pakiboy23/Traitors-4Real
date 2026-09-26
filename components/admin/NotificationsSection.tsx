import React, { useState } from "react";
import { supabase, supabaseUrl } from "../../src/lib/supabase";
import { PremiumButton, PremiumField } from "../../src/ui/premium";
import {
  buildPushRequest,
  pushDraftKey,
  type PushAudience,
  type PushDraft,
} from "../../src/utils/pushBroadcast";

interface Preview {
  key: string;
  audience: number;
  scope: "all" | "season";
  seasonId: string | null;
  title: string;
  body: string;
  url?: string;
}

interface SendResult {
  attempted: number;
  delivered: number;
  failures: number;
}

const readCount = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const errorMessage = (error: unknown, payload: unknown): string => {
  if (payload && typeof payload === "object" && "error" in payload) {
    const message = (payload as { error?: unknown }).error;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return "The notification could not be sent.";
};

const NotificationsSection: React.FC<{ suggestedUrl?: string }> = ({ suggestedUrl }) => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [audience, setAudience] = useState<PushAudience>("all");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"preview" | "send" | null>(null);

  const draft: PushDraft = { title, body, audience, url };
  const draftKey = pushDraftKey(draft);
  const previewMatches = preview?.key === draftKey;

  const invoke = async (dryRun: boolean) => {
    const request = buildPushRequest(draft, dryRun);
    const { data, error: invokeError } = await supabase.functions.invoke(
      "send-lock-reminder",
      { body: request }
    );
    if (invokeError) {
      throw new Error(errorMessage(invokeError, data));
    }
    return data as Record<string, unknown>;
  };

  const previewNotification = async () => {
    setPending("preview");
    setError(null);
    setResult(null);
    try {
      const data = await invoke(true);
      const notification = (data.notification ?? {}) as {
        title?: string;
        body?: string;
        url?: string;
      };
      setPreview({
        key: draftKey,
        audience: readCount(data.audience),
        scope: data.scope === "all" ? "all" : "season",
        seasonId: typeof data.seasonId === "string" ? data.seasonId : null,
        title: notification.title ?? title.trim(),
        body: notification.body ?? body.trim(),
        url: typeof notification.url === "string" ? notification.url : undefined,
      });
    } catch (cause) {
      setPreview(null);
      setError(errorMessage(cause, null));
    } finally {
      setPending(null);
    }
  };

  const sendNotification = async () => {
    setPending("send");
    setError(null);
    try {
      const data = await invoke(false);
      setResult({
        attempted: readCount(data.attempted),
        delivered: readCount(data.delivered),
        failures: Array.isArray(data.failures) ? data.failures.length : 0,
      });
      setPreview(null);
    } catch (cause) {
      setError(errorMessage(cause, null));
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="soft-card rounded-3xl p-5 md:p-6 space-y-5">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
          Push
        </p>
        <h3 className="headline text-2xl">Send a notification</h3>
        <p className="text-sm text-[color:var(--text-muted)]">
          Writes the lock-screen title and message, previews who would get it, then sends.
          A recap link opens that page when the phone is on a build that handles it.
          {!supabaseUrl ? " Supabase is not configured in this build." : ""}
        </p>
      </div>

      <PremiumField
        label="Title"
        value={title}
        maxLength={80}
        placeholder="Week 1 recap"
        onChange={(event) => setTitle(event.target.value)}
      />
      <label className="premium-field-wrap">
        <span className="premium-field-label">Message</span>
        <textarea
          className="premium-field min-h-24"
          value={body}
          maxLength={180}
          placeholder="Madeline was banished. Kim was murdered."
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <PremiumField
        label="Opens this link"
        value={url}
        placeholder="https://traitorsfantasydraft.online/recap/…"
        onChange={(event) => setUrl(event.target.value)}
      />
      {suggestedUrl && url.trim() !== suggestedUrl ? (
        <button
          type="button"
          className="text-sm font-semibold text-[color:var(--accent-strong)]"
          onClick={() => setUrl(suggestedUrl)}
        >
          Use this week's recap link
        </button>
      ) : null}
      <label className="premium-field-wrap">
        <span className="premium-field-label">Who receives it</span>
        <select
          className="premium-select"
          value={audience}
          onChange={(event) => setAudience(event.target.value as PushAudience)}
        >
          <option value="all">Every registered iPhone</option>
          <option value="season">Phones registered to this season</option>
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        <PremiumButton
          type="button"
          variant="secondary"
          disabled={pending !== null}
          onClick={() => {
            void previewNotification();
          }}
        >
          {pending === "preview" ? "Checking…" : "Preview"}
        </PremiumButton>
        <PremiumButton
          type="button"
          variant="primary"
          disabled={!previewMatches || pending !== null}
          onClick={() => {
            void sendNotification();
          }}
        >
          {pending === "send" ? "Sending…" : "Send"}
        </PremiumButton>
      </div>

      {preview && (
        <div className="premium-inline-alert" role="status">
          {preview.audience}{" "}
          {preview.audience === 1 ? "phone would get" : "phones would get"} “{preview.title}” —{" "}
          {preview.body}
          {preview.url ? ` Opens ${preview.url}.` : ""}
          {preview.scope === "season" && preview.seasonId
            ? ` Season ${preview.seasonId}.`
            : ""}
        </div>
      )}
      {result && (
        <div className="premium-inline-alert" role="status">
          Delivered {result.delivered} of {result.attempted}.
          {result.failures > 0 ? ` ${result.failures} failed.` : ""}
        </div>
      )}
      {error && (
        <div className="premium-inline-alert premium-inline-alert-warning" role="alert">
          {error}
        </div>
      )}
    </section>
  );
};

export default NotificationsSection;
