// Slimste volgorde: de volgorde van de stops met de kortste totale rijtijd. Werkt op een tabel met rijtijden tussen
// alle punten (/api/matrix), of als die er niet is op hemelsbrede afstanden. Tot 12 vrije stops exact (Held-Karp),
// daarboven dichtstbijzijnde eerst met verbeteringen (2-opt en or-opt).

export interface OptimizeInput {
  /** cost[i][j]: kosten van punt i naar punt j (rijtijd in seconden of afstand); null = onbekend */
  cost: (number | null)[][];
  /** Index van een vast beginpunt (ligt niet in de te ordenen stops), of null */
  start: number | null;
  /** Index van een vast eindpunt, of null. Gelijk aan start = rondreis */
  end: number | null;
  /** Indices van de stops die we mogen ordenen */
  stops: number[];
}

const BIG = 1e12;

function costFn(cost: (number | null)[][]) {
  return (a: number, b: number) => {
    const v = cost[a]?.[b];
    return v === null || v === undefined || !Number.isFinite(v) ? BIG : v;
  };
}

/** Totale kosten van een volgorde met de vaste punten erbij */
export function routeCost(input: Pick<OptimizeInput, "cost" | "start" | "end">, order: number[]): number {
  const c = costFn(input.cost);
  const path = [...(input.start !== null ? [input.start] : []), ...order, ...(input.end !== null ? [input.end] : [])];
  let sum = 0;
  for (let i = 1; i < path.length; i++) sum += c(path[i - 1], path[i]);
  return sum;
}

function heldKarp(input: OptimizeInput): number[] {
  const c = costFn(input.cost);
  const { stops, start, end } = input;
  const n = stops.length;
  const full = 1 << n;
  const dp = new Float64Array(full * n).fill(Infinity);
  const parent = new Int8Array(full * n).fill(-1);
  for (let i = 0; i < n; i++) dp[(1 << i) * n + i] = start !== null ? c(start, stops[i]) : 0;
  for (let mask = 1; mask < full; mask++) {
    for (let last = 0; last < n; last++) {
      if (!(mask & (1 << last))) continue;
      const cur = dp[mask * n + last];
      if (cur === Infinity) continue;
      for (let next = 0; next < n; next++) {
        if (mask & (1 << next)) continue;
        const m2 = mask | (1 << next);
        const v = cur + c(stops[last], stops[next]);
        if (v < dp[m2 * n + next]) {
          dp[m2 * n + next] = v;
          parent[m2 * n + next] = last;
        }
      }
    }
  }
  let best = Infinity;
  let bestLast = 0;
  for (let last = 0; last < n; last++) {
    const v = dp[(full - 1) * n + last] + (end !== null ? c(stops[last], end) : 0);
    if (v < best) {
      best = v;
      bestLast = last;
    }
  }
  const order: number[] = [];
  let mask = full - 1;
  let last = bestLast;
  while (last >= 0) {
    order.push(stops[last]);
    const p = parent[mask * n + last];
    mask &= ~(1 << last);
    last = p;
  }
  return order.reverse();
}

function nearest(input: OptimizeInput, first: number | null): number[] {
  const c = costFn(input.cost);
  const rest = input.stops.filter((s) => s !== first);
  const out = first !== null ? [first] : [];
  let cur = first ?? input.start;
  while (rest.length) {
    let bi = 0;
    if (cur !== null) for (let i = 1; i < rest.length; i++) if (c(cur, rest[i]) < c(cur, rest[bi])) bi = i;
    const [next] = rest.splice(bi, 1);
    out.push(next);
    cur = next;
  }
  return out;
}

function improve(input: OptimizeInput, order: number[]): number[] {
  let best = [...order];
  let bestCost = routeCost(input, best);
  let better = true;
  let rounds = 0;
  while (better && rounds++ < 200) {
    better = false;
    // 2-opt: een stuk omdraaien
    for (let i = 0; i < best.length - 1; i++)
      for (let k = i + 1; k < best.length; k++) {
        const cand = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const v = routeCost(input, cand);
        if (v < bestCost - 1e-9) {
          best = cand;
          bestCost = v;
          better = true;
        }
      }
    // or-opt: één stop ergens anders neerzetten
    for (let i = 0; i < best.length; i++)
      for (let j = 0; j < best.length; j++) {
        if (i === j) continue;
        const cand = [...best];
        const [x] = cand.splice(i, 1);
        cand.splice(j, 0, x);
        const v = routeCost(input, cand);
        if (v < bestCost - 1e-9) {
          best = cand;
          bestCost = v;
          better = true;
        }
      }
  }
  return best;
}

/** Beste volgorde van `stops` (als indices in de tabel) */
export function optimizeOrder(input: OptimizeInput): number[] {
  if (input.stops.length <= 1) return [...input.stops];
  if (input.stops.length <= 12) return heldKarp(input);
  // Zonder vast beginpunt: elke stop als begin proberen
  const firsts = input.start !== null ? [null] : input.stops;
  let best: number[] = [];
  let bestCost = Infinity;
  for (const f of firsts) {
    const cand = improve(input, nearest(input, f));
    const v = routeCost(input, cand);
    if (v < bestCost) {
      best = cand;
      bestCost = v;
    }
  }
  return best;
}

/** Tabel met hemelsbrede afstanden (km), als de rijtijden niet beschikbaar zijn */
export function crowTable(points: { lat: number; lng: number }[], dist: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => number) {
  return points.map((a) => points.map((b) => dist(a, b)));
}
