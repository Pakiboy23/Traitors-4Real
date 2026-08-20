import { Capacitor } from "@capacitor/core";
import { supabase } from "../lib/supabase";
import { logger } from "../utils/logger";
import { buildPushTokenRecord, type PushPlatform } from "../utils/pushTokens";

/**
 * Device push registration.
 *
 * This is the native capability the iOS build exists for. A weekly appointment
 * game lives or dies on people remembering to submit before the council locks,
 * and chasing them by hand was the main operational cost of last season.
 *
 * Everything here no-ops on the web, so the same code path is safe in the
 * browser build.
 */

let registered = false;

export const isNativePush = (): boolean => Capacitor.isNativePlatform();

const currentPlatform = (): PushPlatform => {
  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android" ? platform : "web";
};

const storeToken = async (token: string, context: {
  seasonId?: string | null;
  email?: string | null;
}) => {
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
  if (error && error.code !== "23505") {
    logger.warn("Storing push token failed:", error.message);
  }
};

/**
 * Asks for permission and registers the device.
 *
 * Safe to call more than once; only the first call on a native platform does
 * any work. Returns whether the device ended up registered.
 */
export const registerForPush = async (context: {
  seasonId?: string | null;
  email?: string | null;
} = {}): Promise<boolean> => {
  if (!isNativePush() || registered) return false;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== "granted") {
      logger.warn("Push permission not granted.");
      return false;
    }

    await PushNotifications.addListener("registration", (token) => {
      void storeToken(token.value, context);
    });

    await PushNotifications.addListener("registrationError", (error) => {
      logger.warn("Push registration error:", error);
    });

    await PushNotifications.register();
    registered = true;
    return true;
  } catch (error) {
    // Never let a notification problem stop the app from loading.
    logger.warn("Push registration failed:", error);
    return false;
  }
};

/** Test seam: registration is remembered per session, which breaks test isolation. */
export const resetPushRegistrationForTests = () => {
  registered = false;
};
