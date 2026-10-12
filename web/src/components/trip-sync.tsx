"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/lib/auth";
import { useTrip } from "@/lib/store";
import { supabase } from "@/lib/supabase-browser";
import { mergeTrips, sameTrip, type Stop } from "@/lib/trip-merge";

/** Houdt "Mijn reis" gelijk tussen dit toestel en het account (alleen als je bent ingelogd) */
export function TripSync() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { stops, replace } = useTrip();
  const pulled = useRef<string | null>(null);
  const lastPushed = useRef<Stop[] | null>(null);

  // Na inloggen: account ophalen, samenvoegen en het resultaat op beide plekken zetten
  useEffect(() => {
    if (!userId || pulled.current === userId) return;
    let alive = true;
    void (async () => {
      const sb = supabase();
      const { data, error } = await sb.from("user_trips").select("stops").eq("user_id", userId).maybeSingle();
      if (!alive || error) return;
      const merged = mergeTrips(stops, data?.stops);
      if (!sameTrip(merged, stops)) replace(merged);
      if (!data || !sameTrip(merged, mergeTrips([], data.stops))) {
        await sb.from("user_trips").upsert({ user_id: userId, stops: merged, updated_at: new Date().toISOString() });
      }
      lastPushed.current = merged;
      pulled.current = userId;
    })();
    return () => {
      alive = false;
    };
    // Alleen bij een nieuwe gebruiker; latere wijzigingen gaan via het effect hieronder
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Wijzigingen op dit toestel (kort uitgesteld) naar het account
  useEffect(() => {
    if (!userId || pulled.current !== userId) return;
    if (lastPushed.current && sameTrip(lastPushed.current, stops)) return;
    const t = setTimeout(() => {
      lastPushed.current = stops;
      void supabase().from("user_trips").upsert({ user_id: userId, stops, updated_at: new Date().toISOString() });
    }, 800);
    return () => clearTimeout(t);
  }, [stops, userId]);

  useEffect(() => {
    if (!userId) pulled.current = null;
  }, [userId]);

  return null;
}
