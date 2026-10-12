"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase-browser";
import { safeNext } from "./auth-utils";

export { authErrorMessage, safeNext } from "./auth-utils";

export type OAuthProvider = "google" | "apple" | "facebook";

export const PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "apple", label: "Apple" },
  { id: "facebook", label: "Facebook" },
];

export function callbackUrl(next?: string | null) {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
}

export async function signInWithProvider(provider: OAuthProvider, next?: string | null) {
  const { error } = await supabase().auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl(next) } });
  if (error) throw error;
}

export async function signInWithEmail(email: string, next?: string | null) {
  const { error } = await supabase().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl(next), shouldCreateUser: true },
  });
  if (error) throw error;
}

export const signOut = () => supabase().auth.signOut();

export type SessionState = { session: Session | null; loading: boolean };

/** Huidige sessie; luistert naar in- en uitloggen (ook in andere tabbladen) */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });
  useEffect(() => {
    const sb = supabase();
    let alive = true;
    void sb.auth.getSession().then(({ data }) => alive && setState({ session: data.session, loading: false }));
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => alive && setState({ session, loading: false }));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return state;
}
