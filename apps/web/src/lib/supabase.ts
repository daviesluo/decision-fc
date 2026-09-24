/**
 * Where the backend is, and the key that is meant to be public.
 *
 * Both the leaderboard and the funnel counters talk to the same project, and
 * they each used to carry their own copy of these two constants. One copy, so
 * a project move is one edit and the two can never disagree about which
 * database they are writing to.
 *
 * The anon key is designed to be public: it identifies the project, not a
 * person, and it grants nothing on its own. Every table has row level security
 * on with no policies, so this key cannot read or write a single row directly —
 * the leaderboard is written by the edge function with the service role, and
 * the funnel counters only through one definer function that takes an event
 * name and returns nothing. See `packages/backend/sql/`.
 */
export const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  'https://dyuilyooirtpfyqplfve.supabase.co';

export const SUPABASE_ANON_KEY: string =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5dWlseW9vaXJ0cGZ5cXBsZnZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTI2MjQsImV4cCI6MjA5NDc4ODYyNH0.-JBC17ANObqRGEvEdJljgnxkbt6erOEvOlkFUkfKrx0';

/**
 * The hosts whose traffic is real.
 *
 * `decisionfc.com` is the site; `html-classic.itch.zone` is the iframe itch.io
 * serves the uploaded build from, and the people playing there are players like
 * any other. `www.decisionfc.com` has no DNS record today and is listed for the
 * day it does — the same reason `AD_HOSTS` lists it. Everything else —
 * localhost, a branch preview, a CI runner — is not, and this list is what
 * keeps it out of the numbers.
 *
 * That last part is not hypothetical. `tools/verify-ui.mjs` plays a career to
 * retirement in two languages at four window sizes on every push; without this
 * check, every CI run would post a few dozen finished careers into the funnel
 * and the completion rate would be measuring the test suite.
 */
const REAL_HOSTS = ['decisionfc.com', 'www.decisionfc.com', 'html-classic.itch.zone'];

export function onRealHost(): boolean {
  return typeof location !== 'undefined' && REAL_HOSTS.includes(location.hostname);
}
