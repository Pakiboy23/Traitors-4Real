import { capturedRecoveryHref } from "./capturedRecoveryHref";
import { supabase } from "./supabase";
import { PASSWORD_RECOVERY_STORAGE_KEY } from "../utils/passwordReset";

export { capturedRecoveryHref };

let listening = false;
let recoveryEventSeen = false;

const rememberRecovery = (): void => {
  recoveryEventSeen = true;
  try {
    sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, "1");
  } catch {
    // Private mode can reject sessionStorage. The in-memory flag still
    // covers this document; a refresh in that mode has to request a new link.
  }
};

export const passwordRecoveryEventSeen = (): boolean => {
  if (recoveryEventSeen) return true;
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export const markPasswordRecovery = (): void => {
  rememberRecovery();
};

export const clearPasswordRecovery = (): void => {
  recoveryEventSeen = false;
  try {
    sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
  } catch {
    // Ignore. The in-memory flag is already cleared.
  }
};

/**
 * Subscribe before initialize() finishes parsing the URL.
 *
 * PASSWORD_RECOVERY is dispatched from a timer after the session is saved.
 * A listener registered in useEffect can miss it. Registering at module
 * evaluation, immediately after the client module loads, is early enough:
 * the URL parse awaits a user lookup before it notifies.
 */
export const ensurePasswordRecoveryListener = (): void => {
  if (listening || typeof window === "undefined") return;
  listening = true;
  supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") rememberRecovery();
  });
};

ensurePasswordRecoveryListener();
