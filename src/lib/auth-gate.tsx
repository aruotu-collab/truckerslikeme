"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import type { AuthGateAction } from "@/types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { userLooksAdmin } from "@/lib/admin-shared";

type AuthGateContextValue = {
  isSignedIn: boolean;
  isAdmin: boolean;
  isPro: boolean;
  user: User | null;
  loading: boolean;
  configured: boolean;
  pendingAction: AuthGateAction | null;
  openGate: (action: AuthGateAction) => boolean;
  closeGate: () => void;
  signOut: () => Promise<void>;
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
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  const [pendingAction, setPendingAction] = useState<AuthGateAction | null>(
    null,
  );

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setPendingAction(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [configured]);

  const isSignedIn = Boolean(user);
  const isAdmin = userLooksAdmin(user);
  const isPro = isAdmin; // Admin unlocks Pro capabilities site-wide

  const openGate = useCallback(
    (action: AuthGateAction) => {
      if (isSignedIn) return true;
      setPendingAction(action);
      return false;
    },
    [isSignedIn],
  );

  const closeGate = useCallback(() => setPendingAction(null), []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      isSignedIn,
      isAdmin,
      isPro,
      user,
      loading,
      configured,
      pendingAction,
      openGate,
      closeGate,
      signOut,
    }),
    [
      isSignedIn,
      isAdmin,
      isPro,
      user,
      loading,
      configured,
      pendingAction,
      openGate,
      closeGate,
      signOut,
    ],
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
