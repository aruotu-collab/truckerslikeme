import type { AuthGateAction } from "@/types";
import { SHIPLY_SIGN_IN_MESSAGE } from "@/lib/shiply-auth-shared";

export type ShiplyApiPayload = {
  error?: string;
  requiresAuth?: boolean;
};

export function openShiplyAuthGate(
  openGate: (action: AuthGateAction) => boolean,
): boolean {
  return !openGate("shiply-connect");
}

export function handleShiplyApiAuth(
  data: ShiplyApiPayload,
  openGate: (action: AuthGateAction) => boolean,
): boolean {
  if (data.requiresAuth) {
    openGate("shiply-connect");
    return true;
  }
  return false;
}

export function shiplyApiErrorMessage(
  data: ShiplyApiPayload,
  fallback: string,
): string {
  return data.error || fallback || SHIPLY_SIGN_IN_MESSAGE;
}

export type ShiplyConnectUi = {
  /** True when the button should be disabled (not clickable). */
  disabled: boolean;
  hint: string | null;
  buttonLabel: string;
};

/** Explains why Connect Shiply is disabled or what sign-in is for. */
export function shiplyConnectUi(opts: {
  startReady: boolean;
  isSignedIn: boolean;
  busy: boolean;
  startHint?: string;
}): ShiplyConnectUi {
  const { startReady, isSignedIn, busy } = opts;
  const startHint =
    opts.startHint ?? "Set your starting location above first.";

  if (busy) {
    return {
      disabled: true,
      hint: null,
      buttonLabel: "Opening…",
    };
  }

  if (!startReady) {
    const signInNote = !isSignedIn
      ? " A free account is also required to connect Shiply."
      : "";
    return {
      disabled: true,
      hint: `${startHint}${signInNote}`,
      buttonLabel: isSignedIn ? "Connect Shiply →" : "Scan Shiply →",
    };
  }

  if (!isSignedIn) {
    return {
      disabled: false,
      hint: null,
      buttonLabel: "Scan Shiply →",
    };
  }

  return {
    disabled: false,
    hint: null,
    buttonLabel: "Connect Shiply →",
  };
}

export function requiresSignInForIngestSource(
  source: "scan" | "screenshot" | "manual" | "paste",
): boolean {
  return source === "scan";
}
