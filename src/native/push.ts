import { Capacitor } from "@capacitor/core";
import { supabase } from "../lib/supabase";
import { logger } from "../utils/logger";
import {
  buildPushRegistrationEvent,
  describeUnknownError,
  isStoreErrorWorthRecording,
  redactPushToken,
  shouldRecordNativeGate,
  type PushRegistrationEventType,
} from "../utils/pushRegistrationEvents";
import { buildPushTokenRecord, type PushPlatform } from "../utils/pushTokens";

/**
 * Device push registration.
 *
 * This is the native capability the iOS build exists for. A weekly appointment
 * game lives or dies on people remembering to submit before the council locks,
 * and chasing them by hand was the main operational cost of last season.
 *
 * Everything here no-ops on the web, so the same code path is safe in the
 * browser build. Registration steps are also written to
 * push_registration_events so a TestFlight build can be diagnosed without a
 * Mac; those inserts never block app load.
 */

let registered = false;

export const isNativePush = (): boolean => Capacitor.isNativePlatform();

const currentPlatform = (): PushPlatform => {
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android" ? platform : "web";
};

const pageProtocol = (): string =>
  typeof window !== "undefined" ? window.location.protocol : "";

const recordRegistrationEvent = (input: {
  eventType: PushRegistrationEventType;
  detail?: Record<string, unknown>;
  seasonId?: string | null;
}) => {
  try {
    const row = buildPushRegistrationEvent({
      eventType: input.eventType,
      platform: currentPlatform(),
      detail: input.detail ?? {},
      seasonId: input.seasonId ?? null,
    });
    if (!row) return;

    // Fire-and-forget. Do not chain .select() — there is no public SELECT
    // policy, and Prefer: return=representation can look like a failure even
    // when the insert landed.
    void (async () => {
      try {
        await supabase.from("push_registration_events").insert(row);
      } catch {
        // Diagnostics must never take the app down.
      }
    })();
  } catch {
    // Same: building the row is best-effort.
  }
};

const storeToken = async (
  token: string,
  context: {
    seasonId?: string | null;
    email?: string | null;
  },
) => {
  const record = buildPushTokenRecord({
    token,
    platform: currentPlatform(),
    seasonId: context.seasonId ?? null,
    email: context.email ?? null,
  });

  if (!record) {
    // An empty token means registration reported success without a usable
    // value, which happens when provisioning is wrong. Storing it would leave a
    // row that can never receive anything.
    logger.warn("Push registration returned an unusable token; not storing.");
    return;
  }

  const { error } = await supabase.from("push_tokens").insert(record);

  // A duplicate is the normal case on every relaunch: the device keeps its
  // token, so the row already exists. Anything else is worth surfacing.
  if (error && isStoreErrorWorthRecording(error.code)) {
    logger.warn("Storing push token failed:", error.message);
    recordRegistrationEvent({
      eventType: "store_error",
      seasonId: context.seasonId,
      detail: {
        code: error.code ?? null,
        message: describeUnknownError(error),
        ...redactPushToken(token),
      },
    });
  }
};

/**
 * Asks for permission and registers the device.
 *
 * Safe to call more than once; only the first call on a native platform does
 * any work. Returns whether the device ended up registered.
 */
export const registerForPush = async (
  context: {
    seasonId?: string | null;
    email?: string | null;
  } = {},
): Promise<boolean> => {
  if (!isNativePush()) {
    if (
      shouldRecordNativeGate({
        isNative: false,
        protocol: pageProtocol(),
        pluginAvailable: Capacitor.isPluginAvailable("PushNotifications"),
      })
    ) {
      recordRegistrationEvent({
        eventType: "native_gate",
        seasonId: context.seasonId,
        detail: {
          reason: "not_native",
          protocol: pageProtocol(),
          pluginAvailable: Capacitor.isPluginAvailable("PushNotifications"),
        },
      });
    }
    return false;
  }

  if (registered) return false;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let permission = await PushNotifications.checkPermissions();
    let requested = false;
    if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
      permission = await PushNotifications.requestPermissions();
      requested = true;
    }

    recordRegistrationEvent({
      eventType: "permission_check",
      seasonId: context.seasonId,
      detail: { receive: permission.receive, requested },
    });

    if (permission.receive !== "granted") {
      logger.warn("Push permission not granted.");
      recordRegistrationEvent({
        eventType: "permission_denied",
        seasonId: context.seasonId,
        detail: { receive: permission.receive, requested },
      });
      return false;
    }

    await PushNotifications.addListener("registration", (token) => {
      recordRegistrationEvent({
        eventType: "registration_success",
        seasonId: context.seasonId,
        detail: {
          usable: Boolean(
            buildPushTokenRecord({
              token: token.value,
              platform: currentPlatform(),
            }),
          ),
          ...redactPushToken(token.value),
        },
      });
      void storeToken(token.value, context);
    });

    await PushNotifications.addListener("registrationError", (error) => {
      logger.warn("Push registration error:", error);
      recordRegistrationEvent({
        eventType: "registration_error",
        seasonId: context.seasonId,
        detail: {
          message: describeUnknownError(error),
          phase: "registrationError",
        },
      });
    });

    await PushNotifications.register();
    registered = true;
    recordRegistrationEvent({
      eventType: "register_invoked",
      seasonId: context.seasonId,
      detail: { registered: true },
    });
    return true;
  } catch (error) {
    // Never let a notification problem stop the app from loading.
    logger.warn("Push registration failed:", error);
    recordRegistrationEvent({
      eventType: "registration_error",
      seasonId: context.seasonId,
      detail: {
        message: describeUnknownError(error),
        phase: "registerForPush",
      },
    });
    return false;
  }
};

/** Test seam: registration is remembered per session, which breaks test isolation. */
export const resetPushRegistrationForTests = () => {
  registered = false;
};
