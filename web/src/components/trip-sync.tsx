"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/lib/auth";
import { useTrip, useVehicle } from "@/lib/store";
import { cleanVehicle, hasVehicle, type Vehicle } from "@/lib/vehicle";
import { supabase } from "@/lib/supabase-browser";
import { mergeTrips, sameTrip, type Stop } from "@/lib/trip-merge";

/** Houdt "Mijn reis" en "Mijn camper" gelijk tussen dit toestel en het account (alleen als je bent ingelogd) */
export function TripSync() {
  return (
    <>
      <TripSyncInner />
      <VehicleSync />
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
        await sb.from("user_vehicles").upsert({ user_id: userId, data: cleanVehicle(vehicle), updated_at: new Date().toISOString() });
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
      void supabase().from("user_vehicles").upsert({ user_id: userId, data: cleanVehicle(vehicle), updated_at: new Date().toISOString() });
    }, 800);
    return () => clearTimeout(t);
  }, [vehicle, userId]);

  useEffect(() => {
    if (!userId) pulled.current = null;
  }, [userId]);

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
      void supabase().from("user_trips").upsert({ user_id: userId, stops, updated_at: new Date().toISOString() });
    }, 800);
    return () => clearTimeout(t);
  }, [stops, userId]);

  useEffect(() => {
    if (!userId) pulled.current = null;
  }, [userId]);

  return null;
}
