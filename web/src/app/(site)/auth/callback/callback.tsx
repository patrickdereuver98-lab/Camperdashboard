"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { authErrorMessage, safeNext } from "@/lib/auth";
import { supabase } from "@/lib/supabase-browser";

/** Terugkomst van Google/Apple/Facebook of de magic link: de client wisselt ?code= in, daarna door naar `next` */
export function Callback() {
  const params = useSearchParams();
  const router = useRouter();
  const providerError = params.get("error_description") ?? params.get("error");
  const [err, setErr] = useState<string | null>(providerError ? authErrorMessage(providerError) : null);

  useEffect(() => {
    if (providerError) return;
    const next = safeNext(params.get("next"));
    const sb = supabase();
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      router.replace(next);
    };
    // getSession wacht tot de client de code uit de URL heeft ingewisseld
    void sb.auth.getSession().then(({ data, error }) => {
      if (data.session) go();
      else if (error) setErr(authErrorMessage(error.message));
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => session && event === "SIGNED_IN" && go());
    const timeout = setTimeout(() => !done && setErr(authErrorMessage("expired")), 10_000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [params, providerError, router]);

  if (err)
    return (
      <>
        <h1 className="font-display text-3xl font-semibold">Inloggen lukte niet</h1>
        <p role="alert" className="mt-3 text-lg text-ink-2">{err}</p>
        <Link href="/inloggen" className="mt-6 inline-flex h-12 items-center rounded-xl bg-forest px-5 font-semibold text-on-forest">
          Opnieuw proberen
        </Link>
      </>
    );
  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Je wordt ingelogd…</h1>
      <p className="mt-3 text-ink-2" role="status">Een ogenblik geduld.</p>
    </>
  );
}
