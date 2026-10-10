import Link from "next/link";
import { getStats } from "@/lib/places";
import { searchHref } from "@/lib/filters";
import { PROVINCES } from "@/lib/types";
import { SearchBox } from "@/components/search-box";
import { Landscape } from "@/components/landscape";
import { Icon, type IconName } from "@/components/icons";

const nf = new Intl.NumberFormat("nl-NL");

export default async function Home() {
  const stats = await getStats();

  const intents: {
    href: string;
    icon: IconName;
    title: string;
    sub: string;
    tone: string;
  }[] = [
    {
      href: searchHref({ free: true }),
      icon: "euro",
      title: "Gratis staan",
      sub: `${stats.free} plekken`,
      tone: "bg-ember-tint text-ember",
    },
    {
      href: searchHref({ water: true }),
      icon: "waves",
      title: "Aan het water",
      sub: `${stats.water} plekken`,
      tone: "bg-lake-tint text-lake",
    },
    {
      href: searchHref({ power: true }),
      icon: "bolt",
      title: "Met stroom",
      sub: `${stats.power} plekken`,
      tone: "bg-forest-tint text-forest-deep",
    },
    {
      href: "/dichtbij",
      icon: "locate",
      title: "Dichtbij mij",
      sub: "Op afstand gesorteerd",
      tone: "bg-surface-2 text-ink",
    },
  ];

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 pt-10 pb-14 sm:px-6 md:pt-16 lg:grid-cols-[1.15fr_1fr] lg:gap-14 lg:pb-20">
          <div className="min-w-0">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-soft">
              <span className="h-2 w-2 rounded-full bg-ember" />
              {nf.format(stats.total)} camperplaatsen in heel Nederland
            </p>
            <h1 className="font-display text-[2.6rem] leading-[1.05] font-semibold text-ink sm:text-6xl lg:text-[4.2rem]">
              Waar sta je
              <br />
              <span className="text-forest italic">vannacht?</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
              Van boerenerf tot strandopgang. Typ gewoon wat je zoekt: een
              plaats, een regio of een wens. Wij maken er filters van.
            </p>
            <div className="mt-8 max-w-2xl">
              <SearchBox />
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-lift">
              <Landscape
                seed="vrijstaan-hero"
                variant={2}
                water
                van
                className="h-full w-full"
              />
            </div>
            <div className="absolute -bottom-6 -left-8 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 pr-5 shadow-lift">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-lake-tint text-lake">
                <Icon name="waves" size={22} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">
                  {stats.water} plekken aan het water
                </p>
                <p className="text-xs text-muted">meren, rivieren en de kust</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Snelle ingangen ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {intents.map((i) => (
            <li key={i.title}>
              <Link
                href={i.href}
                className="group flex h-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:border-forest hover:shadow-lift"
              >
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${i.tone}`}
                >
                  <Icon name={i.icon} size={21} />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">
                    {i.title}
                  </span>
                  <span className="block truncate text-sm text-muted">
                    {i.sub}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Provincies ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
              Kies een streek
            </h2>
            <p className="mt-2 text-ink-soft">
              Van de Waddenkust tot de Limburgse heuvels.
            </p>
          </div>
          <Link
            href="/zoeken"
            className="hidden items-center gap-1.5 text-sm font-semibold text-forest hover:underline sm:flex"
          >
            Alles op de kaart <Icon name="arrowRight" size={16} />
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[...PROVINCES]
            .sort(
              (a, b) => (stats.byProvince[b] ?? 0) - (stats.byProvince[a] ?? 0),
            )
            .map((prov, i) => (
              <li key={prov}>
                <Link
                  href={searchHref({ province: prov })}
                  className="group relative block overflow-hidden rounded-2xl shadow-card transition hover:shadow-lift"
                >
                  <Landscape
                    seed={prov}
                    variant={(i % 4) as 0 | 1 | 2 | 3}
                    water={[
                      "Zeeland",
                      "Friesland",
                      "Flevoland",
                      "Noord-Holland",
                      "Zuid-Holland",
                      "Groningen",
                    ].includes(prov)}
                    className="aspect-[3/2] w-full transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent p-3 pt-10">
                    <p className="font-display text-lg leading-tight font-semibold text-white">
                      {prov}
                    </p>
                    <p className="text-sm text-white/80">
                      {nf.format(stats.byProvince[prov] ?? 0)} plekken
                    </p>
                  </div>
                </Link>
              </li>
            ))}
        </ul>
      </section>

      {/* ── Eerlijk over de data ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6">
        <div className="grain grid gap-10 rounded-[2rem] border border-line bg-surface p-6 sm:p-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold tracking-wide text-ember uppercase">
              Eerlijk is eerlijk
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-ink">
              Wat we (nog) niet weten, zeggen we ook
            </h2>
            <p className="mt-4 leading-relaxed text-ink-soft">
              De plekken komen uit OpenStreetMap en worden stap voor stap
              aangevuld met informatie van de websites van de plekken zelf.
              Staat er &ldquo;onbekend&rdquo;? Dan weten we het echt nog niet.
              Bel of check de website voor je vertrekt.
            </p>
          </div>
          <dl className="space-y-4 self-center">
            {(
              [
                ["Website of telefoon", stats.known.contact],
                ["Prijs", stats.known.price],
                ["Aantal plekken", stats.known.spots],
                ["Openingstijden", stats.known.hours],
                ["Honden toegestaan", stats.known.dogs],
              ] as const
            ).map(([label, v]) => (
              <div key={label}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <dt className="text-ink-soft">{label}</dt>
                  <dd className="font-semibold text-ink tabular-nums">
                    {Math.round(v * 100)}% bekend
                  </dd>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-forest"
                    style={{ width: `${Math.max(2, v * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
          <p>VrijStaan · camperplaatsen in Nederland</p>
          <p>
            Kaartdata ©{" "}
            <a
              className="underline hover:text-ink"
              href="https://www.openstreetmap.org/copyright"
            >
              OpenStreetMap
            </a>
            -bijdragers · Kaarten door OpenFreeMap
          </p>
        </div>
      </footer>
    </main>
  );
}
