#!/usr/bin/env node
/**
 * Download club badge images from TheSportsDB into apps/web/public/crests/.
 *
 * Run by hand, never by the build. It skips files that already exist, so it
 * tops up after roster changes. See docs/crests.md and
 * apps/web/public/crests/README.md.
 *
 *   node tools/crests-fetch-tsdb.mjs           # download all missing
 *   node tools/crests-fetch-tsdb.mjs man-city  # just one club
 *
 * Matching: search TheSportsDB by our club name (with a hand-kept alias table
 * for the names that differ), then filter by sport and expected country so
 * "Al Shabab" resolves to the Saudi club and not one of its namesakes.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CREST_DIR = join(root, 'apps/web/public/crests');
const API = 'https://www.thesportsdb.com/api/v1/json/3';

/** Country each league's clubs should resolve to, to disambiguate name clashes. */
const LEAGUE_COUNTRY = {
  'eng.1': 'England', 'eng.2': 'England',
  'esp.1': 'Spain', 'esp.2': 'Spain',
  'ita.1': 'Italy', 'ita.2': 'Italy',
  'ger.1': 'Germany', 'ger.2': 'Germany',
  'fra.1': 'France', 'fra.2': 'France',
  'por.1': 'Portugal',
  'ned.1': 'Netherlands',
  'bel.1': 'Belgium',
  'ksa.1': 'Saudi Arabia',
  'usa.1': 'United States',
  'jpn.1': 'Japan',
  'chn.1': 'China',
};

/**
 * Clubs whose federation is not the country of the league they play in.
 *
 * TheSportsDB files a team under its own nation, so the country filter — the
 * thing that stops "Al Hilal" resolving to Wau, Sudan — was throwing away the
 * right club: Wrexham is Welsh and plays in the English pyramid. The search
 * found it every time; `pickTeam` then dropped it.
 */
const ALT_COUNTRY = {
  wrexham: 'Wales',
};

/** Our display name → the name TheSportsDB indexes the club under. */
const ALIASES = {
  kashima: 'Kashima Antlers',
  'sheff-utd': 'Sheffield United',
  'west-brom': 'West Bromwich Albion',
  rayo: 'Rayo Vallecano',
  alaves: 'Deportivo Alaves',
  'las-palmas': 'UD Las Palmas',
  valladolid: 'Real Valladolid',
  koeln: 'FC Koln',
  'union-b': 'Union Berlin',
  lautern: 'Kaiserslautern',
  elversberg: 'SV Elversberg',
  'le-havre': 'Le Havre AC',
  'le-mans': 'Le Mans',
  'paris-fc': 'Paris FC',
  montpellier: 'Montpellier HSC',
  'union-sg': 'Royale Union Saint-Gilloise',
  'rio-ave': 'Rio Ave',
  brighton: 'Brighton and Hove Albion',
  wolves: 'Wolverhampton Wanderers',
  bournemouth: 'AFC Bournemouth',
  forest: 'Nottingham Forest',
  atletico: 'Atletico Madrid',
  athletic: 'Athletic Bilbao',
  deportivo: 'Deportivo La Coruna',
  malaga: 'Malaga',
  'sporting-g': 'Sporting Gijon',
  inter: 'Inter Milan',
  roma: 'AS Roma',
  bayern: 'Bayern Munich',
  gladbach: 'Borussia Monchengladbach',
  hoffenheim: 'Hoffenheim',
  'st-pauli': 'St. Pauli',
  hertha: 'Hertha BSC',
  duesseldorf: 'Fortuna Dusseldorf',
  nuernberg: '1. FC Nurnberg',
  karlsruher: 'Karlsruher SC',
  paderborn: 'SC Paderborn 07',
  psg: 'Paris Saint-Germain',
  marseille: 'Marseille',
  monaco: 'Monaco',
  lyon: 'Lyon',
  nice: 'Nice',
  rennes: 'Rennes',
  lens: 'Lens',
  nantes: 'Nantes',
  strasbourg: 'Strasbourg',
  brest: 'Brest',
  'saint-e': 'Saint-Etienne',
  bordeaux: 'Bordeaux',
  caen: 'Caen',
  guingamp: 'Guingamp',
  amiens: 'Amiens',
  troyes: 'Troyes',
  grenoble: 'Grenoble',
  ajaccio: 'AC Ajaccio',
  porto: 'FC Porto',
  braga: 'Braga',
  'vitoria-g': 'Vitoria Guimaraes',
  famalicao: 'Famalicao',
  estoril: 'Estoril Praia',
  psv: 'PSV Eindhoven',
  twente: 'Twente',
  utrecht: 'Utrecht',
  heerenveen: 'Heerenveen',
  genk: 'Genk',
  gent: 'Gent',
  antwerp: 'Antwerp',
  standard: 'Standard Liege',
  westerlo: 'Westerlo',
  hsv: 'Hamburger SV',
  mainz: 'Mainz 05',
  'al-hilal': 'Al-Hilal',
  'al-nassr': 'Al-Nassr',
  'al-ittihad': 'Al-Ittihad',
  'al-ahli-s': 'Al-Ahli Saudi',
  'al-qadsiah': 'Al-Qadisiyah',
  'al-shabab': 'Al Shabab',
  'al-ettifaq': 'Al-Ettifaq',
  lafc: 'Los Angeles FC',
  seattle: 'Seattle Sounders',
  'ny-red': 'New York Red Bulls',
  marinos: 'Yokohama F. Marinos',
  zhejiang: 'Zhejiang Professional',
  lille: 'Lille OSC',
  'shanghai-p': 'Shanghai Port',
  'beijing-g': 'Beijing Guoan',
};

function readClubs() {
  const source = readFileSync(join(root, 'packages/content/src/data/clubs.ts'), 'utf8');
  const rows = [...source.matchAll(/\['([a-z0-9-]+)',\s*'([a-z]{3}\.\d)',\s*'([^']+)',\s*'([^']+)'/g)];
  return rows.map(([, id, league, name, shortName]) => ({ id, league, name, shortName }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchTeams(name) {
  // Two quirks of this endpoint, both found the hard way: %20-encoded spaces
  // return empty results (it wants +), and hyphens inside multi-word names
  // return empty results too (query "Saint Etienne", match "Saint-Étienne").
  const query = encodeURIComponent(name.replace(/-/g, ' ')).replace(/%20/g, '+');
  const url = `${API}/searchteams.php?t=${query}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data.teams ?? [];
}

/** Strip accents so "Málaga" and "Malaga" compare equal. */
const fold = (s) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

function pickTeam(teams, club) {
  const country = LEAGUE_COUNTRY[club.league];
  const soccer = teams.filter(
    (t) =>
      t.strSport === 'Soccer' &&
      t.strBadge &&
      t.strGender !== 'Female' &&
      !/women|ladies|juniors|reserves|fabril|\bii\b/i.test(t.strTeam ?? ''),
  );
  const wanted = fold(ALIASES[club.id] ?? club.name);
  const exact = (pool) => pool.find((t) => fold(t.strTeam) === wanted);
  const contains = (pool) =>
    pool.find((t) => fold(t.strTeam).includes(wanted) || wanted.includes(fold(t.strTeam)));
  // A wrong-country club with a similar name is exactly how "Al Hilal" once
  // resolved to Wau, Sudan and "HSV" to HSV Hoek: never cross the country
  // line, and never take an arbitrary first result.
  if (country) {
    const allowed = [country, ALT_COUNTRY[club.id]].filter(Boolean).map(fold);
    const inCountry = soccer.filter((t) => allowed.includes(fold(t.strCountry)));
    return exact(inCountry) ?? contains(inCountry) ?? null;
  }
  return exact(soccer) ?? contains(soccer) ?? null;
}

async function fetchCrest(club) {
  const target = join(CREST_DIR, `${club.id}.png`);
  if (existsSync(target)) return 'exists';

  const queries = [ALIASES[club.id] ?? club.name, club.name, club.shortName];
  let team = null;
  for (const query of [...new Set(queries)]) {
    const teams = await searchTeams(query);
    team = pickTeam(teams, club);
    if (team) break;
    await sleep(2100);
  }
  if (!team) return 'no-match';

  // The /small suffix serves a 200px render — covers a 42px display at 3x DPR
  // and keeps the whole set under ten megabytes.
  const image = await fetch(`${team.strBadge}/small`);
  if (!image.ok) {
    const fallback = await fetch(team.strBadge);
    if (!fallback.ok) return `image-http-${image.status}`;
    writeFileSync(target, Buffer.from(await fallback.arrayBuffer()));
    return `ok (${team.strTeam})`;
  }
  writeFileSync(target, Buffer.from(await image.arrayBuffer()));
  return `ok (${team.strTeam})`;
}

mkdirSync(CREST_DIR, { recursive: true });
const only = process.argv[2];
const clubs = readClubs().filter((c) => !only || c.id === only);

let ok = 0;
let skipped = 0;
const failures = [];
for (const club of clubs) {
  try {
    const result = await fetchCrest(club);
    if (result === 'exists') skipped += 1;
    else if (result.startsWith('ok')) {
      ok += 1;
      console.log(`  ✓ ${club.id.padEnd(14)} ${result}`);
    } else {
      failures.push(club.id);
      console.log(`  ✗ ${club.id.padEnd(14)} ${result}`);
    }
  } catch (error) {
    failures.push(club.id);
    console.log(`  ✗ ${club.id.padEnd(14)} ${(error && error.message) || error}`);
  }
  // Stay well under the free tier's rate limit.
  await sleep(2100);
}
console.log(`\ndownloaded ${ok}, already present ${skipped}, failed ${failures.length}`);
if (failures.length) console.log(`failed: ${failures.join(', ')}`);
