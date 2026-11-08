"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { onSupabaseReady, supabase, supabaseLoaded } from "./supabase-browser";
import { AUTH_STORAGE_KEY, maybeSignedIn } from "./auth-storage";
import { safeNext } from "./auth-utils";

export { authErrorMessage, cleanCode, codeErrorMessage, safeNext } from "./auth-utils";

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
  const { error } = await (await supabase()).auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl(next) } });
  if (error) throw error;
}

export async function signInWithEmail(email: string, next?: string | null) {
  const { error } = await (await supabase()).auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl(next), shouldCreateUser: true },
  });
  if (error) throw error;
}

/** Inloggen met de code uit de mail (zelfde mail als de inloglink; werkt ook op een ander apparaat) */
export async function verifyEmailCode(email: string, code: string) {
  const { error } = await (await supabase()).auth.verifyOtp({ email, token: code, type: "email" });
  if (error) throw error;
}

export const signOut = async () => (await supabase()).auth.signOut();

export type SessionState = { session: Session | null; loading: boolean };

/**
 * Huidige sessie; luistert naar in- en uitloggen (ook in andere tabbladen). supabase-js wordt alleen meteen geladen
 * als er een sessie kan zijn (R34). Anders is de stand "niet ingelogd", tot iets anders de client laadt (inloggen op
 * deze pagina) of een ander tabblad inlogt.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });
  useEffect(() => {
    let alive = true;
    let stop = () => undefined as void;
    const connect = () => {
      stop();
      void supabase().then(
        (sb) => {
          if (!alive) return;
          void sb.auth.getSession().then(({ data }) => alive && setState({ session: data.session, loading: false }));
          const { data: sub } = sb.auth.onAuthStateChange((_event, session) => alive && setState({ session, loading: false }));
          stop = () => sub.subscription.unsubscribe();
        },
        () => alive && setState({ session: null, loading: false }),
      );
    };
    if (supabaseLoaded() || maybeSignedIn()) connect();
    else {
      void Promise.resolve().then(() => alive && setState({ session: null, loading: false }));
      const offReady = onSupabaseReady(connect);
      const onStorage = (e: StorageEvent) => {
        if (e.key === AUTH_STORAGE_KEY && e.newValue) connect();
      };
      window.addEventListener("storage", onStorage);
      stop = () => {
        offReady();
        window.removeEventListener("storage", onStorage);
      };
    }
    return () => {
      alive = false;
      stop();
    };
  }, []);
  return state;
}
