"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth";
import {
  readExpenses,
  readTrip,
  readVehicle,
  useExpenses,
  useSharedLink,
  useTrip,
  useVehicle,
  writeExpenses,
  writeTrip,
  writeVehicle,
} from "@/lib/store";
import { mergeExpenses, type Expense } from "@/lib/expenses";
import { cleanVehicle, hasVehicle, type Vehicle } from "@/lib/vehicle";
import { supabase, toJson } from "@/lib/supabase-browser";
import { mergeTrips, sameTrip, type Stop } from "@/lib/trip-merge";
import { StorageNotice } from "./storage-notice";

/** Na een mislukte poging opnieuw proberen na zoveel tijd (en eerder bij weer online of terug in beeld) */
const RETRY_MS = 30_000;

type Retry = { tick: number; later: () => void };

/**
 * Signaal om het opnieuw te proberen: telt op als het toestel weer online is, als de pagina weer in beeld komt, en
 * na RETRY_MS als een poging mislukte (`later`).
 */
function useRetry(): Retry {
  const [tick, setTick] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const bump = () => {
      if (document.visibilityState !== "hidden") setTick((t) => t + 1);
    };
    window.addEventListener("online", bump);
    document.addEventListener("visibilitychange", bump);
    return () => {
      window.removeEventListener("online", bump);
      document.removeEventListener("visibilitychange", bump);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const later = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      setTick((t) => t + 1);
    }, RETRY_MS);
  }, []);
  return { tick, later };
}

/** Houdt "Mijn reis" en "Mijn camper" gelijk tussen dit toestel en het account (alleen als je bent ingelogd) */
export function TripSync() {
  const { tick, later } = useRetry();
  const { stops } = useTrip();
  const [vehicle] = useVehicle();
  const { list } = useExpenses();
  return (
    <>
      <AccountSync spec={TRIP} value={stops} tick={tick} later={later} />
      <AccountSync spec={VEHICLE} value={vehicle} tick={tick} later={later} />
      <AccountSync spec={EXPENSES} value={list} tick={tick} later={later} />
      <SharedTripSync tick={tick} later={later} />
      <StorageNotice />
    </>
  );
}

type Result = { error: unknown };

/**
 * Hoe één soort gegevens met het account wordt gelijkgehouden. Na inloggen: account ophalen (`pull`), samenvoegen
 * met wat er op dat moment op dit toestel staat (`merge`), en zo nodig terugschrijven (`push`). Daarna gaan
 * wijzigingen op dit toestel kort uitgesteld naar het account.
 */
type SyncSpec<T> = {
  read: () => T;
  write: (v: T) => void;
  same: (a: T, b: T) => boolean;
  pull: (userId: string) => PromiseLike<{ data: unknown; error: unknown }>;
  /** `remote` is de rij uit het account, of null als die er nog niet is */
  merge: (local: T, remote: unknown) => { next: T; push: boolean };
  push: (userId: string, value: T) => PromiseLike<Result>;
};

const now = () => new Date().toISOString();

/** Reis: samenvoegen (toestel eerst, daarna wat alleen in het account staat) */
const TRIP: SyncSpec<Stop[]> = {
  read: readTrip,
  write: writeTrip,
  same: sameTrip,
  pull: (userId) => supabase().from("user_trips").select("stops").eq("user_id", userId).maybeSingle(),
  merge: (local, remote) => {
    const stops = (remote as { stops?: unknown } | null)?.stops;
    const next = mergeTrips(local, stops);
    return { next, push: !remote || !sameTrip(next, mergeTrips([], stops)) };
  },
  push: (userId, stops) => supabase().from("user_trips").upsert({ user_id: userId, stops: toJson(stops), updated_at: now() }),
};

const sameVehicle = (a: Vehicle, b: Vehicle) => JSON.stringify(cleanVehicle(a)) === JSON.stringify(cleanVehicle(b));

/** Camper: staat er op dit toestel niets, dan nemen we het account over; anders gaat dit toestel voor */
const VEHICLE: SyncSpec<Vehicle> = {
  read: readVehicle,
  write: writeVehicle,
  same: sameVehicle,
  pull: (userId) => supabase().from("user_vehicles").select("data").eq("user_id", userId).maybeSingle(),
  merge: (local, remote) => {
    const theirs = cleanVehicle((remote as { data?: unknown } | null)?.data);
    if (!hasVehicle(local) && hasVehicle(theirs)) return { next: theirs, push: false };
    return { next: local, push: hasVehicle(local) && !sameVehicle(local, theirs) };
  },
  push: (userId, v) => supabase().from("user_vehicles").upsert({ user_id: userId, data: toJson(cleanVehicle(v)), updated_at: now() }),
};

const sameExpenses = (a: Expense[], b: Expense[]) => JSON.stringify(a) === JSON.stringify(b);

/** Uitgaven: samenvoegen op id (toestel wint), daarna wijzigingen doorzetten */
const EXPENSES: SyncSpec<Expense[]> = {
  read: readExpenses,
  write: writeExpenses,
  same: sameExpenses,
  pull: (userId) => supabase().from("user_expenses").select("entries").eq("user_id", userId).maybeSingle(),
  merge: (local, remote) => {
    const entries = (remote as { entries?: unknown } | null)?.entries;
    const next = mergeExpenses(local, entries);
    return { next, push: !remote || !sameExpenses(next, mergeExpenses([], entries)) };
  },
  push: (userId, entries) => supabase().from("user_expenses").upsert({ user_id: userId, entries: toJson(entries), updated_at: now() }),
};

/** Supabase geeft een fout meestal terug als `{ error }`, maar een netwerkfout kan ook een afwijzing zijn */
async function attempt(run: () => PromiseLike<Result>): Promise<boolean> {
  try {
    const { error } = await run();
    return !error;
  } catch {
    return false;
  }
}

function AccountSync<T>({ spec, value, tick, later }: { spec: SyncSpec<T>; value: T } & Retry) {
  const { session } = useSession();
  const userId = session?.user.id;
  // Voor welke gebruiker het ophalen en samenvoegen gelukt is; pas daarna gaan wijzigingen naar het account
  const [pulledFor, setPulledFor] = useState<string | null>(null);
  // Wat het account zeker heeft (alleen gezet na een geslaagde schrijfactie)
  const lastPushed = useRef<T | null>(null);

  // Na inloggen: account ophalen, samenvoegen en het resultaat op beide plekken zetten. Mislukt het ophalen, dan
  // later opnieuw (bij weer online, terug in beeld of na RETRY_MS).
  useEffect(() => {
    if (!userId || pulledFor === userId) return;
    let alive = true;
    void (async () => {
      let pulled: { data: unknown; error: unknown };
      try {
        pulled = await spec.pull(userId);
      } catch (error) {
        pulled = { data: null, error };
      }
      if (!alive) return;
      if (pulled.error) return later();
      // Wat er nú op dit toestel staat: de bezoeker kan tijdens het ophalen iets hebben gewijzigd
      const local = spec.read();
      const { next, push } = spec.merge(local, pulled.data ?? null);
      if (!spec.same(next, local)) spec.write(next);
      lastPushed.current = null;
      if (!push) lastPushed.current = next;
      else if (await attempt(() => spec.push(userId, next))) lastPushed.current = next;
      else later(); // het effect hieronder probeert het opnieuw
      if (alive) setPulledFor(userId);
    })();
    return () => {
      alive = false;
    };
  }, [spec, userId, pulledFor, tick, later]);

  // Wijzigingen op dit toestel (kort uitgesteld) naar het account; pas na succes geldt iets als verstuurd
  useEffect(() => {
    if (!userId || pulledFor !== userId) return;
    if (lastPushed.current !== null && spec.same(lastPushed.current, value)) return;
    const t = setTimeout(() => {
      // Altijd de actuele waarde versturen, ook als er intussen nog iets veranderde
      const current = spec.read();
      void attempt(() => spec.push(userId, current)).then((ok) => {
        if (ok) lastPushed.current = current;
        else later();
      });
    }, 800);
    return () => clearTimeout(t);
  }, [spec, userId, pulledFor, value, tick, later]);

  return null;
}

/**
 * Gedeelde reis: de reis in de database is leidend. Wijzigingen van de anderen komen realtime binnen en vervangen
 * de reis op dit toestel; eigen wijzigingen gaan kort uitgesteld naar de database (laatste wijziging wint).
 */
function SharedTripSync({ tick, later }: Retry) {
  const { session } = useSession();
  const userId = session?.user.id;
  const [link, setLink] = useSharedLink();
  const { stops } = useTrip();
  // Voor welke gedeelde reis de eerste stand binnen is
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  // Wat de database zeker heeft, en wat we nu versturen (om onze eigen wijziging in de realtime-stroom te herkennen)
  const lastSynced = useRef<Stop[] | null>(null);
  const sending = useRef<Stop[] | null>(null);
  const tripId = userId ? link?.id : undefined;

  // Eerste stand ophalen; mislukt dat, dan later opnieuw
  useEffect(() => {
    if (!tripId || loadedFor === tripId) return;
    let alive = true;
    supabase()
      .from("shared_trips")
      .select("stops")
      .eq("id", tripId)
      .maybeSingle()
      .then(
        ({ data, error }) => {
          if (!alive) return;
          if (error) return later();
          // Geen toegang meer (verlaten of verwijderd): koppeling losmaken, je eigen reis blijft staan
          if (!data) return setLink(null);
          const next = mergeTrips([], data.stops);
          lastSynced.current = next;
          writeTrip(next);
          setLoadedFor(tripId);
        },
        () => alive && later(),
      );
    return () => {
      alive = false;
    };
  }, [tripId, loadedFor, tick, later, setLink]);

  // Wijzigingen van de anderen
  useEffect(() => {
    if (!tripId) return;
    const sb = supabase();
    const channel = sb
      .channel(`reis-${tripId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shared_trips", filter: `id=eq.${tripId}` }, (payload) => {
        const remote = mergeTrips([], (payload.new as { stops?: unknown }).stops);
        if (lastSynced.current && sameTrip(remote, lastSynced.current)) return;
        if (sending.current && sameTrip(remote, sending.current)) return;
        lastSynced.current = remote;
        writeTrip(remote);
      })
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [tripId]);

  // Eigen wijzigingen naar de database; pas na succes geldt de reis als gedeeld
  useEffect(() => {
    if (!tripId || loadedFor !== tripId || !lastSynced.current || sameTrip(lastSynced.current, stops)) return;
    const t = setTimeout(() => {
      const current = readTrip();
      sending.current = current;
      void attempt(() => supabase().from("shared_trips").update({ stops: toJson(current) }).eq("id", tripId)).then((ok) => {
        if (ok) lastSynced.current = current;
        else later();
        if (sending.current === current) sending.current = null;
      });
    }, 500);
    return () => clearTimeout(t);
  }, [stops, tripId, loadedFor, tick, later]);

  return null;
}
