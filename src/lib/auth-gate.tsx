"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthGateAction } from "@/types";

type AuthGateContextValue = {
  isSignedIn: boolean;
  pendingAction: AuthGateAction | null;
  openGate: (action: AuthGateAction) => boolean;
  closeGate: () => void;
  signInDemo: () => void;
  signOut: () => void;
};

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

const ACTION_COPY: Record<AuthGateAction, { title: string; body: string }> = {
  "save-route": {
    title: "Save this route",
    body: "Create a free account to save routes, get alerts, and keep your trip history.",
  },
  "report-alert": {
    title: "Report an incident",
    body: "Sign in so other drivers know who posted — and so we can keep the feed trustworthy.",
  },
  "ask-ai": {
    title: "Ask the trucker AI",
    body: "Try one free answer as a guest. Create an account for more questions and trip history.",
  },
  "join-community": {
    title: "Join the community",
    body: "Create a free account to post, follow stops, and talk with drivers on your corridor.",
  },
};

export function getAuthGateCopy(action: AuthGateAction) {
  return ACTION_COPY[action];
}

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [pendingAction, setPendingAction] = useState<AuthGateAction | null>(
    null,
  );

  const openGate = useCallback(
    (action: AuthGateAction) => {
      if (isSignedIn) return true;
      setPendingAction(action);
      return false;
    },
    [isSignedIn],
  );

  const closeGate = useCallback(() => setPendingAction(null), []);
  const signInDemo = useCallback(() => {
    setIsSignedIn(true);
    setPendingAction(null);
  }, []);
  const signOut = useCallback(() => setIsSignedIn(false), []);

  const value = useMemo(
    () => ({
      isSignedIn,
      pendingAction,
      openGate,
      closeGate,
      signInDemo,
      signOut,
    }),
    [isSignedIn, pendingAction, openGate, closeGate, signInDemo, signOut],
  );

  return (
    <AuthGateContext.Provider value={value}>{children}</AuthGateContext.Provider>
  );
}

export function useAuthGate() {
  const ctx = useContext(AuthGateContext);
  if (!ctx) {
    throw new Error("useAuthGate must be used within AuthGateProvider");
  }
  return ctx;
}
