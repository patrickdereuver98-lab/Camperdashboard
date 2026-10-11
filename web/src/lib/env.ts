// Publieke Supabase-gegevens: de URL en de publishable key zijn bedoeld om in de browser te staan
// (Row Level Security beschermt de data). Overschrijfbaar via .env.local.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qkrmthrhwmmmwswmfgwc.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_EGEUx5L3Df4w18_DgmtbHw_6RUoglht";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vrijstaan.nl";

/** Zonder netwerk bouwen (CI, afgeschermde omgevingen): gebruik de meegeleverde snapshot. */
export const OFFLINE_BUILD = process.env.VRIJSTAAN_OFFLINE === "1";
