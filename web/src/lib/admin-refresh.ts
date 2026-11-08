/** RPC's in beheer die publieke gegevens wijzigen; overige RPC's lezen alleen */
const CHANGING_RPC = /\/rest\/v1\/rpc\/(admin_(apply|reject|set|take|merge|mark)[a-z_]*|check_departure)(\?|$)/;

/**
 * Wijzigt dit verzoek aan Supabase (`base` = projectadres) iets wat de publieke site laat zien: een schrijfactie op
 * een tabel of in de opslag, of een wijzigende beheer-RPC? Dan ververst beheer de caches van de site (R36).
 */
export function changesPublicData(base: string, url: string, method: string): boolean {
  if (url.startsWith(`${base}/rest/v1/rpc/`)) return CHANGING_RPC.test(url);
  if (!url.startsWith(`${base}/rest/v1/`) && !url.startsWith(`${base}/storage/v1/`)) return false;
  const m = method.toUpperCase();
  return m !== "GET" && m !== "HEAD";
}
