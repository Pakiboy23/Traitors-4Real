import { sanitizePushDeepLink } from "./pushDeepLink";

export type PushAudience = "season" | "all";

export interface PushDraft {
  title: string;
  body: string;
  audience: PushAudience;
  /** Optional recap URL. Blank means the notification opens the app as usual. */
  url?: string;
}

export interface PushRequestBody {
  title: string;
  body: string;
  audience?: "all";
  dryRun?: true;
  url?: string;
}

const TITLE_LIMIT = 80;
const BODY_LIMIT = 180;

/** Builds the Edge Function body. Empty copy is rejected so a blank form cannot send the function's default reminder. */
export const buildPushRequest = (
  draft: PushDraft,
  dryRun: boolean
): PushRequestBody => {
  const title = draft.title.trim();
  const body = draft.body.trim();

  if (!title || !body) {
    throw new Error("Add a title and a message before sending.");
  }
  if (title.length > TITLE_LIMIT || body.length > BODY_LIMIT) {
    throw new Error(`Keep the title under ${TITLE_LIMIT} characters and the message under ${BODY_LIMIT}.`);
  }

  const rawUrl = typeof draft.url === "string" ? draft.url.trim() : "";
  const url = rawUrl ? sanitizePushDeepLink(rawUrl) : null;
  if (rawUrl && !url) {
    throw new Error("Use an https recap link on traitorsfantasydraft.online.");
  }

  return {
    title,
    body,
    ...(draft.audience === "all" ? { audience: "all" as const } : {}),
    ...(dryRun ? { dryRun: true as const } : {}),
    ...(url ? { url } : {}),
  };
};

export const pushDraftKey = (draft: PushDraft): string => {
  const title = draft.title.trim();
  const body = draft.body.trim();
  const url = typeof draft.url === "string" ? draft.url.trim() : "";
  return `${draft.audience}\n${title}\n${body}\n${url}`;
};
