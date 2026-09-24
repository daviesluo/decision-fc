/**
 * Named teammates.
 *
 * A club is a list of numbers until it has people in it. This builds the
 * dressing room around the player: the real names who are actually there in
 * 2026, ageing forward and retiring on their own, topped up with generated
 * squad-mates whose names suit their nationality.
 *
 * The turnover is the point. Sign for Real Madrid at eighteen and you line up
 * with Bellingham and Mbappé; stay until you are thirty-six and everyone you
 * started with is gone and the names are invented. That decay is honest — the
 * table only claims to know 2026 — and it makes a long career feel long.
 */

import type { Club, MarqueePlayer, NamePool, Position, SquadMate, World } from '../types.js';
import { int, pick, rngFor, shuffle, type Rng } from '../rng.js';

const START_YEAR = 2026;

/** Age a marquee player forward, with the decline that implies. */
function ageMarquee(entry: MarqueePlayer, year: number): SquadMate | null {
  const age = entry.age + (year - START_YEAR);
  // Retirement: possible from 34, certain by 41 — and cumulative. Each age's
  // draw is checked from 34 up to the current age, so a player who retired at
  // 34 stays retired at 35; re-rolling only the current year let retired
  // legends pop back into the dressing room a season later.
  if (age >= 41) return null;
  for (let checkAge = 34; checkAge <= age; checkAge += 1) {
    const checkYear = year - (age - checkAge);
    if ((checkAge - 33) * 0.22 > deterministicUnit(`${entry.name}:${checkYear}`)) return null;
  }

  const declineYears = Math.max(0, age - 30);
  const overall = Math.max(58, entry.overall - Math.round(declineYears * 1.8));
  return { name: entry.name, position: entry.position, overall, age, countryId: entry.countryId, marquee: true };
}

/**
 * A stable 0–1 value for a string. Retirement has to be consistent across every
 * club-season lookup in a career, so it cannot come from the career's own RNG
 * stream — a squad viewed twice must not retire a player only on the second look.
 */
function deterministicUnit(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function poolFor(world: World, countryId: string): NamePool {
  return world.namePools[countryId] ?? world.namePools['default'] ?? { first: ['Alex'], last: ['Silva'] };
}

function generateName(rng: Rng, countryId: string, world: World): string {
  const pool = poolFor(world, countryId);
  if (pool.mono && rng() < 0.45) return pick(rng, pool.mono) ?? 'Silva';

  const first = pick(rng, pool.first) ?? 'Alex';
  const last = pick(rng, pool.last) ?? 'Silva';
  // Chinese names are family-name-first and unspaced.
  if (countryId === 'chn') return `${last}${first}`;
  return `${first} ${last}`;
}

/** Positions a squad should show, spread across the pitch. */
const SPINE: Position[] = ['GK', 'CB', 'CDM', 'CM', 'CAM', 'ST', 'LW', 'RW', 'LB', 'RB'];

/**
 * Build the notable names at a club in a given season.
 *
 * Deterministic in `(club, year)` rather than in career step, so the same club
 * shows the same squad whether it is being previewed on a transfer card or
 * recorded in a season the player actually spent there.
 */
export function buildSquad(world: World, club: Club, year: number, size = 4): SquadMate[] {
  const rng = rngFor(`squad:${club.id}`, `${year}`);

  const marquee = world.marquee
    .filter((entry) => entry.clubId === club.id)
    .map((entry) => ageMarquee(entry, year))
    .filter((entry): entry is SquadMate => entry !== null);

  const squad: SquadMate[] = marquee.slice(0, size);
  if (squad.length >= size) return squad;

  const nationalities = squadNationalities(world, club, rng);
  const taken = new Set(squad.map((m) => m.position));
  const openPositions = shuffle(rng, SPINE.filter((p) => !taken.has(p)));

  // Generated squad-mates sit around the club's own level, so a big club still
  // reads as a big club once the real names have aged out.
  for (const position of openPositions) {
    if (squad.length >= size) break;
    const countryId = pick(rng, nationalities) ?? 'eng';
    const spread = int(rng, -7, 4);
    squad.push({
      name: generateName(rng, countryId, world),
      position,
      overall: Math.max(48, Math.min(94, Math.round(club.reputation * 0.92) + spread)),
      age: int(rng, 20, 33),
      countryId,
      marquee: false,
    });
  }

  return squad;
}

/**
 * Which nationalities plausibly fill this squad. Home-grown dominates at small
 * clubs; the richer the club, the more the dressing room reads like an airport
 * departure board.
 */
function squadNationalities(world: World, club: Club, rng: Rng): string[] {
  const league = world.leagues.find((l) => l.id === club.leagueId);
  const home = league?.countryId ?? 'eng';
  const foreignShare = Math.min(0.75, club.wealth / 130);

  const exporters = ['bra', 'arg', 'fra', 'esp', 'por', 'ned', 'ger', 'ita', 'eng', 'sen', 'nga', 'jpn', 'kor'];
  const out: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    out.push(rng() < foreignShare ? (pick(rng, exporters) ?? home) : home);
  }
  return out;
}
