import type { AuthGateAction } from "@/types";
import { SHIPLY_SIGN_IN_MESSAGE } from "@/lib/shiply-api-auth";

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
