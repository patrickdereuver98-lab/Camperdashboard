"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/lib/auth";
import { useExpenses, useSharedLink, useTrip, useVehicle } from "@/lib/store";
import { mergeExpenses, type Expense } from "@/lib/expenses";
import { cleanVehicle, hasVehicle, type Vehicle } from "@/lib/vehicle";
import { supabase, toJson } from "@/lib/supabase-browser";
import { mergeTrips, sameTrip, type Stop } from "@/lib/trip-merge";

/**
 * Een Supabase-query wordt pas verstuurd als je hem afwacht of `.then()` aanroept. Voor "versturen en vergeten"
 * (de uitgestelde synchronisatie) dus altijd via deze helper, nooit met een losse `void`.
 */
function send(query: PromiseLike<unknown>) {
  query.then(
    () => undefined,
    () => undefined,
  );
}

/** Houdt "Mijn reis" en "Mijn camper" gelijk tussen dit toestel en het account (alleen als je bent ingelogd) */
export function TripSync() {
  return (
    <>
      <TripSyncInner />
      <VehicleSync />
      <ExpenseSync />
      <SharedTripSync />
    </>
  );
}

const sameVehicle = (a: Vehicle, b: Vehicle) => JSON.stringify(cleanVehicle(a)) === JSON.stringify(cleanVehicle(b));

/** Camper: staat er op dit toestel niets, dan nemen we het account over; anders gaat dit toestel voor */
function VehicleSync() {
  const { session } = useSession();
  const userId = session?.user.id;
  const [vehicle, setVehicle] = useVehicle();
  const pulled = useRef<string | null>(null);
  const lastPushed = useRef<Vehicle | null>(null);

  useEffect(() => {
    if (!userId || pulled.current === userId) return;
    let alive = true;
    void (async () => {
      const sb = supabase();
      const { data, error } = await sb.from("user_vehicles").select("data").eq("user_id", userId).maybeSingle();
      if (!alive || error) return;
      const remote = cleanVehicle(data?.data);
      if (!hasVehicle(vehicle) && hasVehicle(remote)) {
        setVehicle(remote);
        lastPushed.current = remote;
      } else if (hasVehicle(vehicle) && !sameVehicle(vehicle, remote)) {
        await sb.from("user_vehicles").upsert({ user_id: userId, data: toJson(cleanVehicle(vehicle)), updated_at: new Date().toISOString() });
        lastPushed.current = vehicle;
      } else lastPushed.current = vehicle;
      pulled.current = userId;
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!userId || pulled.current !== userId) return;
    if (lastPushed.current && sameVehicle(lastPushed.current, vehicle)) return;
    const t = setTimeout(() => {
      lastPushed.current = vehicle;
      send(supabase().from("user_vehicles").upsert({ user_id: userId, data: toJson(cleanVehicle(vehicle)), updated_at: new Date().toISOString() }));
    }, 800);
    return () => clearTimeout(t);
  }, [vehicle, userId]);

  useEffect(() => {
    if (!userId) pulled.current = null;
  }, [userId]);

  return null;
}

const sameExpenses = (a: Expense[], b: Expense[]) => JSON.stringify(a) === JSON.stringify(b);

/** Uitgaven: samenvoegen op id (toestel wint), daarna wijzigingen doorzetten */
function ExpenseSync() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { list, replace } = useExpenses();
  const pulled = useRef<string | null>(null);
  const lastPushed = useRef<Expense[] | null>(null);

  useEffect(() => {
    if (!userId || pulled.current === userId) return;
    let alive = true;
    void (async () => {
      const sb = supabase();
      const { data, error } = await sb.from("user_expenses").select("entries").eq("user_id", userId).maybeSingle();
      if (!alive || error) return;
      const merged = mergeExpenses(list, data?.entries);
      if (!sameExpenses(merged, list)) replace(merged);
      if (!data || !sameExpenses(merged, mergeExpenses([], data.entries))) {
        await sb.from("user_expenses").upsert({ user_id: userId, entries: toJson(merged), updated_at: new Date().toISOString() });
      }
      lastPushed.current = merged;
      pulled.current = userId;
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!userId || pulled.current !== userId) return;
    if (lastPushed.current && sameExpenses(lastPushed.current, list)) return;
    const t = setTimeout(() => {
      lastPushed.current = list;
      send(supabase().from("user_expenses").upsert({ user_id: userId, entries: toJson(list), updated_at: new Date().toISOString() }));
    }, 800);
    return () => clearTimeout(t);
  }, [list, userId]);

  useEffect(() => {
    if (!userId) pulled.current = null;
  }, [userId]);

  return null;
}

/**
 * Gedeelde reis: de reis in de database is leidend. Wijzigingen van de anderen komen realtime binnen en vervangen
 * de reis op dit toestel; eigen wijzigingen gaan kort uitgesteld naar de database (laatste wijziging wint).
 */
function SharedTripSync() {
  const { session } = useSession();
  const userId = session?.user.id;
  const [link, setLink] = useSharedLink();
  const { stops, replace } = useTrip();
  const lastSynced = useRef<Stop[] | null>(null);
  const tripId = userId ? link?.id : undefined;

  useEffect(() => {
    if (!tripId) return;
    let alive = true;
    const sb = supabase();
    const apply = (remote: unknown) => {
      const next = mergeTrips([], remote);
      lastSynced.current = next;
      replace(next);
    };
    void sb
      .from("shared_trips")
      .select("stops")
      .eq("id", tripId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive || error) return;
        // Geen toegang meer (verlaten of verwijderd): koppeling losmaken, je eigen reis blijft staan
        if (!data) return setLink(null);
        apply(data.stops);
      });
    const channel = sb
      .channel(`reis-${tripId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shared_trips", filter: `id=eq.${tripId}` }, (payload) => {
        const remote = mergeTrips([], (payload.new as { stops?: unknown }).stops);
        if (lastSynced.current && sameTrip(remote, lastSynced.current)) return;
        apply(remote);
      })
      .subscribe();
    return () => {
      alive = false;
      void sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  useEffect(() => {
    if (!tripId || !lastSynced.current || sameTrip(lastSynced.current, stops)) return;
    const t = setTimeout(() => {
      lastSynced.current = stops;
      send(supabase().from("shared_trips").update({ stops: toJson(stops) }).eq("id", tripId));
    }, 500);
    return () => clearTimeout(t);
  }, [stops, tripId]);

  return null;
}

function TripSyncInner() {
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
      send(supabase().from("user_trips").upsert({ user_id: userId, stops: toJson(stops), updated_at: new Date().toISOString() }));
    }, 800);
    return () => clearTimeout(t);
  }, [stops, userId]);

  useEffect(() => {
    if (!userId) pulled.current = null;
  }, [userId]);

  return null;
}
