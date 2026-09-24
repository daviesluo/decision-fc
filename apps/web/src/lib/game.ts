/**
 * The bridge between the pure engine and React.
 *
 * Deliberately thin. All rules live in `@bg/engine`; this file only holds the
 * current state, persists it, and exposes the three actions the UI needs. If
 * the WeChat build ends up needing a different renderer, this is roughly the
 * only file that has to be rewritten.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { WORLD } from '@bg/content';
import {
  createCareer,
  decide as engineDecide,
  indexWorld,
  type WorldIndex,
  makeSeed,
  selectIdentity as engineSelectIdentity,
  type CareerState,
  type Club,
  type IdentityInput,
  type Pace,
  type SeasonRecord,
} from '@bg/engine';
import { KEYS } from './storage';

// v2: identity gained a player type, and the engine's development model was
// rebuilt — a v1 save cannot be replayed by this engine.
const SAVE_KEY = KEYS.save;

/**
 * The world as it started.
 *
 * Good enough for anything that only needs a club's identity — its name, its
 * crest, its colours, none of which a career changes. Anything that depends on
 * *where a club currently plays* or *who currently manages it* must go through
 * `indexFor(state)` instead, because a career records both against itself.
 */
export const INDEX = indexWorld(WORLD);

/** The world as this career has changed it: divisions, and managers. */
export function indexFor(state: CareerState): WorldIndex {
  return indexWorld(WORLD, state.leagueMoves, state.managerChanges);
}

const CLUB_IDS = new Set(WORLD.clubs.map((c) => c.id));

/**
 * Engine params carry club *ids*; swap them for names in the active locale at
 * render time. Everything else in the params object passes through untouched.
 */
export function localizeParams(
  params: Record<string, string | number> | undefined,
  clubName: (club: Club) => string,
  t?: (key: string) => string,
  /** Whose competition a `{trophy}` slot refers to. */
  context: { clubId?: string | null; countryId?: string | null } = {},
  /** Country id → display name, for the cards that name one. */
  countryName?: (id: string) => string,
): Record<string, string | number> {
  if (!params) return {};
  const out: Record<string, string | number> = { ...params };
  // Read the club id before it is replaced by a name, so a card that names a
  // club also names that club's cup.
  const trophyClubId =
    context.clubId ?? (typeof params.club === 'string' && CLUB_IDS.has(params.club) ? params.club : null);
  for (const key of ['club', 'loanClub']) {
    const value = out[key];
    if (typeof value === 'string' && CLUB_IDS.has(value)) out[key] = clubName(INDEX.club(value));
  }
  // Key-moment cards name the competition on the line; months stamp the card.
  if (t && typeof out.trophy === 'string') {
    out.trophy = trophyName(out.trophy, t, { clubId: trophyClubId, countryId: context.countryId });
  }
  // The summer's international tournament, named from his nationality: the
  // World Cup, the Euros, the Asian Cup, the Copa América. Same resolver as
  // `trophy`, because it is the same kind of thing — a slot whose real name
  // depends on who is playing in it.
  if (t && typeof out.tournament === 'string') {
    out.tournament = trophyName(out.tournament, t, { clubId: trophyClubId, countryId: context.countryId });
  }
  if (t && typeof out.month === 'string') out.month = t(`months.${out.month}`);
  // Countries are ids in the engine and names on screen, same as clubs. The
  // nationality-switch card names two of them at once.
  if (countryName) {
    for (const key of ['country', 'newCountry']) {
      const value = out[key];
      if (typeof value === 'string') out[key] = countryName(value);
    }
  }
  // A squad role is an engine id like `fringe`, and every id that reaches the
  // screen has to be looked up. The effect lines did this and the outcome
  // lines did not, so the first outcome to carry a `{role}` slot printed the
  // raw id — caught by `verify:ui`, which is exactly what that check is for.
  // Doing it here rather than at the call site means the next one cannot
  // reintroduce it.
  if (t && typeof out.role === 'string') out.role = t(`rolesInline.${out.role}`);
  // A manager's system, same story: the window that opens because the manager
  // has been sacked names what they played and what they play now, and both
  // arrive as engine ids (`gegenpress`, `possession`).
  if (t) {
    for (const key of ['from', 'to']) {
      const value = out[key];
      if (typeof value === 'string') out[key] = t(`managerStyles.${value}`);
    }
  }
  return out;
}

/**
 * The real name of a competition, which is a function of where it was won.
 *
 * The engine only ever stores the *slot* — `domestic_cup`, `continental_elite`
 * — because the slot is what the rules and the leaderboard compare. The name
 * is a display concern, and getting it right is most of what makes a career
 * table read like a real one: the same slot is the FA Cup at Arsenal, the
 * Copa del Rey at Sevilla and the Emperor's Cup at Kashima.
 *
 * `clubId` names the club competitions; `countryId` (the player's nationality)
 * names the international ones. Unknown ids fall back to the generic label
 * rather than throwing — a save made against an older content pack must still
 * render.
 */
export function trophyName(
  trophy: string,
  t: (key: string) => string,
  context: { clubId?: string | null; countryId?: string | null },
): string {
  const clubCountry = (() => {
    try {
      return context.clubId ? INDEX.countryOfClub(context.clubId).id : null;
    } catch {
      return null;
    }
  })();
  const confederationOf = (id: string | null) => {
    try {
      return id ? INDEX.country(id).confederation : 'UEFA';
    } catch {
      return 'UEFA';
    }
  };

  switch (trophy) {
    case 'domestic_cup':
      return clubCountry ? t(`cups.${clubCountry}`) : t('trophies.domestic_cup');
    case 'continental_elite':
      return t(`continentalCups.${confederationOf(clubCountry)}.elite`);
    case 'continental_secondary':
      return t(`continentalCups.${confederationOf(clubCountry)}.secondary`);
    // International silverware follows the player, not the club.
    case 'continental_nations':
      return t(`nationsCups.${confederationOf(context.countryId ?? null)}`);
    default:
      return t(`trophies.${trophy}`);
  }
}

/**
 * A club's standing, said the way it is true where the club actually plays.
 *
 * `clubStanding` returns `european` for the qualification band of any top
 * flight, but only a UEFA club plays in Europe. An AFC or CONCACAF side that
 * finishes high enters *its* continental competition, so a Chinese Super League
 * club must read "continental places", never "European places" — the thing a
 * player rightly asked about seeing on a 中超 offer.
 */
export function standingName(
  clubId: string | null,
  standing: string,
  t: (key: string) => string,
): string {
  if (standing === 'european') {
    const confederation = (() => {
      try {
        return clubId ? INDEX.countryOfClub(clubId).confederation : 'UEFA';
      } catch {
        return 'UEFA';
      }
    })();
    if (confederation !== 'UEFA') return t('standings.continental');
  }
  return t(`standings.${standing}`);
}

/**
 * What a save is on disk: the career, plus the build of the rules it was played
 * under.
 *
 * The stamp exists because the leaderboard verifies a submission by replaying
 * `seed + identity + decisions` through the engine *on the server*. A career
 * begun before a balance change and finished after it therefore replays to
 * different numbers than the player watched happen, and the server rejects a
 * run nobody cheated on — the player loses a completed career and is told
 * nothing. With the stamp the app can see it coming and say so up front.
 *
 * Deliberately not a reason to throw the career away. A save is internally
 * consistent whatever the engine does next; only its *submission* is spoiled.
 */
interface SaveFile {
  engine: string;
  state: CareerState;
}

export interface LoadedSave {
  state: CareerState;
  /** False when the rules changed under this career — see `SaveFile`. */
  rankable: boolean;
}

/**
 * The guards, separated from the storage they usually read.
 *
 * Everything that decides whether a save is usable is here and is pure, so it
 * can be tested against a hand-written string rather than through a browser: a
 * v1 save, a save naming a club the roster dropped, a save from a different
 * engine, a truncated one. Those four branches are the difference between
 * resuming a career and crashing on it, and none of them were covered.
 */
export function readSave(raw: string | null, engineBuild: string): LoadedSave | null {
  try {
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveFile | CareerState;
    // Saves written before the stamp existed are read as unstamped rather than
    // discarded: still playable, just not verifiable.
    const stamped = 'state' in parsed && 'engine' in parsed;
    const state = (stamped ? (parsed as SaveFile).state : parsed) as CareerState;
    const engine = stamped ? (parsed as SaveFile).engine : null;

    // A save from an older schema is discarded rather than migrated: at this
    // stage a wrong-shaped save would fail deep inside the engine, and a lost
    // in-progress career is a far smaller cost than an unexplained crash.
    if (state?.version !== 1) return null;
    // A save can also outlive the content pack it was made against. Any club
    // id the current roster no longer knows would throw deep inside a render,
    // so such a save is discarded on the same reasoning.
    const ids = [
      state.contract?.clubId,
      state.loan?.clubId,
      state.loan?.parentClubId,
      ...(state.seasons ?? []).map((s) => s.clubId),
    ];
    if (ids.some((id) => typeof id === 'string' && !CLUB_IDS.has(id))) return null;
    return { state, rankable: engine === engineBuild };
  } catch {
    return null;
  }
}

function load(): LoadedSave | null {
  try {
    return readSave(localStorage.getItem(SAVE_KEY), __ENGINE_BUILD__);
  } catch {
    /* private mode, or storage disabled entirely */
    return null;
  }
}

function persist(state: CareerState | null) {
  try {
    if (state === null) localStorage.removeItem(SAVE_KEY);
    else {
      const file: SaveFile = { engine: __ENGINE_BUILD__, state };
      localStorage.setItem(SAVE_KEY, JSON.stringify(file));
    }
  } catch {
    /* storage full or blocked — the career simply will not survive a reload */
  }
}

/** Wipe the save without going through React — the crash screen's escape hatch. */
export function discardSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* nothing more to do; the reload will simply find it again */
  }
}

export function useGame() {
  const [loaded] = useState(load);
  const [state, setState] = useState<CareerState | null>(loaded?.state ?? null);
  // A career started in this session is by definition played under the engine
  // that is running, so only a resumed save can be unrankable — and once the
  // player starts a new one, it stops being true.
  const [rankable, setRankable] = useState(loaded ? loaded.rankable : true);

  useEffect(() => {
    persist(state);
  }, [state]);

  const start = useCallback((pace: Pace, seed?: string) => {
    setRankable(true);
    // A given seed makes a given career: same starting attributes, same deck,
    // same clubs, same rolls. That is what the daily challenge is built on, and
    // it costs nothing to support because replayability from a seed is already
    // the property the leaderboard's anti-cheat depends on.
    setState(createCareer(seed ?? makeSeed(Date.now() + Math.floor(Math.random() * 1e6)), pace));
  }, []);

  const chooseIdentity = useCallback((identity: IdentityInput) => {
    setState((current) => (current ? engineSelectIdentity(current, identity, WORLD) : current));
  }, []);

  const decide = useCallback((optionId: string) => {
    setState((current) => (current ? engineDecide(current, optionId, WORLD) : current));
  }, []);

  const reset = useCallback(() => setState(null), []);

  const derived = useMemo(() => {
    if (!state?.contract) return { club: null, league: null, country: null };
    // Through the career's own view, not the world's opening one: the header
    // shows what the club currently is, and both its division and its manager
    // can have changed since kick-off. Reading the static index made the UI
    // disagree with the engine about tactical fit.
    const index = indexFor(state);
    const club = index.club(state.contract.clubId);
    return {
      club,
      league: index.leagueOfClub(club.id),
      country: state.player ? index.country(state.player.countryId) : null,
    };
    // `state` is a fresh object after every decision; the four fields below are
    // everything this body reads, and depending on the whole state would rebuild
    // the world index on every card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state?.contract?.clubId,
    state?.player?.countryId,
    state?.leagueMoves,
    state?.managerChanges,
  ]);

  return { state, rankable, start, chooseIdentity, decide, reset, ...derived };
}

/**
 * Percentile against the global field.
 *
 * Until the leaderboard service exists, this is a local approximation built
 * from the balance sweep's observed distributions, so the summary screen is
 * complete and the shape of the number is right. It is replaced by a real
 * query — not re-tuned — when the backend lands; the anchors below are the
 * contract that endpoint has to satisfy.
 */
const DISTRIBUTIONS = {
  // Regenerated from `pnpm balance --assert` at 20,000 careers, against the
  // engine as it now runs. These are the sweep's own output — it prints the
  // anchors ready to paste — and they have to be re-pasted whenever a change
  // moves the distribution, or the summary screen quietly grades every player
  // against a game that no longer exists.
  //
  // This round: **a medal is worth your part in it, and minutes buy
  // development.** A club trophy used to be scaled by league strength and
  // nothing else, so the fringe player at a title-winning giant scored exactly
  // what the captain scored; and a player who never played still developed at
  // full rate until he was twenty-four. Between them those two were the reason
  // chasing the biggest badge beat reading the squad role — the game paid for
  // the badge and charged nothing for the bench.
  //
  // Both terms are the largest in the score, so the whole curve came down at
  // every anchor: the median career lands at 1,584 legacy against 1,750, and
  // the very top at 10,350 against 10,532. Wealth and value moved the other
  // way (716.3M against 730.6M at the tail is noise; the middle is up, because
  // a player who plays is a player who is bought). Every ending that needs a
  // long prime got rarer with it, `goat` included: 0.25% against 0.45%.
  //
  // Re-read on 2026-09-23 after every transfer window started carrying a club
  // whose football suits the player: every anchor within 1% of the last read
  // (the middle 1,496 → 1,500, the 90th 3,048 → 3,072).
  legacy: [0, 600, 861, 1105, 1319, 1500, 1679, 1877, 2131, 2485, 3072, 10357],
  wealth: [0.39e6, 14.7e6, 26.6e6, 39.4e6, 52.6e6, 66.7e6, 82.2e6, 100.5e6, 123.7e6, 158.6e6, 218.3e6, 728.5e6],
  // Peak market value, not cumulative fees: the third board measures the most
  // a club would ever have paid for you, the way a Transfermarkt profile does.
  value: [0.13e6, 4.9e6, 8.6e6, 14e6, 18e6, 24e6, 30e6, 40e6, 47e6, 60e6, 77e6, 196e6],
} as const;

export type BoardKey = keyof typeof DISTRIBUTIONS;

/** Returns the top-N% the value falls in, plus an illustrative global rank. */
export function percentileFor(board: BoardKey, value: number): { percent: number; rank: number } {
  const anchors = DISTRIBUTIONS[board];
  const step = 100 / (anchors.length - 1);
  let below = 0;
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const low = anchors[i]!;
    const high = anchors[i + 1]!;
    if (value <= high) {
      const within = high === low ? 1 : (value - low) / (high - low);
      below = (i + within) * step;
      break;
    }
    below = (i + 1) * step;
  }
  const top = Math.max(0.01, Math.min(100, 100 - below));
  // A plausible population size keeps the rank readable before real data.
  const POPULATION = 2_480_000;
  return { percent: Number(top.toFixed(top < 1 ? 2 : 1)), rank: Math.max(1, Math.round((top / 100) * POPULATION)) };
}

/**
 * The three or four decisions this career actually turned on.
 *
 * A twenty-season career is thirty-odd cards, and listing them back is a log,
 * not a story. This picks out the moments a player would themselves name if
 * asked how it went — and every one is derived from what the seasons *record*,
 * not from which option id was tapped, so it stays true when the deck changes.
 *
 * Ordered by age, because the point is to read as a life rather than a ranking.
 */
export interface TurningPoint {
  age: number;
  kind: 'academy' | 'move' | 'injury' | 'peak';
  clubId: string | null;
  /** Filled per kind; the caller turns these into a sentence. */
  detail: { rating?: number; from?: string; to?: string; cost?: number; trophies?: number };
}

/**
 * The season a career is remembered for — one definition, for every screen.
 *
 * There were two, and they disagreed on the same page. The summary's header
 * weighted the rating by the division so heavily that a 36-year-old's last
 * year — six starts, rated 6.76, in the Bundesliga — beat a 44-game 7.37
 * season in the Championship, while the Turning points sheet a tap below
 * named the 7.37. Found by playing a goalkeeper to retirement on an emulated
 * iPhone on 2026-09-23.
 *
 * What a fan remembers is a season he actually played, played well, at a
 * level that meant something:
 *
 *   · **Half a season at least** — 19 league games for a keeper, 15 for anyone
 *     else (the same full seasons the legacy score uses). A cameo year is not
 *     "the one", however well the cameo went. Only if no season reaches that
 *     does the bar drop to ten games.
 *   · **Rating leads.** The division adds up to 0.6 and silverware and awards
 *     a little more, scaled by the division — enough to separate two seasons
 *     that were rated alike, never enough to turn a worse season into the best.
 *   · **A spin-off league is only ever "the one" when the whole career was
 *     there** — a twilight year in the Gulf is not the peak of a European
 *     career because the football was easier.
 */
export function bestSeasonOf(state: CareerState): SeasonRecord | null {
  const index = indexFor(state);
  const leagueOf = (id: string) => {
    try {
      return index.league(id);
    } catch {
      return null;
    }
  };
  const played = state.seasons.filter((s) => !s.suspended);
  const half = (s: SeasonRecord) => (s.position === 'GK' ? 19 : 15);
  let pool = played.filter((s) => s.stats.appearances >= half(s));
  if (pool.length === 0) pool = played.filter((s) => s.stats.appearances >= 10);
  if (pool.length === 0) return null;
  const core = pool.filter((s) => leagueOf(s.leagueId)?.market !== 'spinoff');
  if (core.length > 0) pool = core;
  const score = (s: SeasonRecord) => {
    const strength = leagueOf(s.leagueId)?.strength ?? 0.5;
    return s.stats.rating + 0.6 * strength + (0.3 * s.trophies.length + 0.25 * s.awards.length) * strength;
  };
  return pool.reduce<SeasonRecord | null>((best, s) => (!best || score(s) > score(best) ? s : best), null);
}

export function turningPoints(state: CareerState): TurningPoint[] {
  const seasons = state.seasons;
  if (seasons.length === 0) return [];
  const index = indexFor(state);
  const repOf = (clubId: string) => {
    try {
      return index.club(clubId).reputation;
    } catch {
      return 0;
    }
  };

  const points: TurningPoint[] = [];

  // Where it started. Always worth a line — it is the one card every career has.
  const first = seasons[0]!;
  points.push({ age: first.age, kind: 'academy', clubId: first.clubId, detail: {} });

  // The move that changed the most. Loans are excluded: a loan is somewhere you
  // were sent, and this is about somewhere you chose.
  let bestMove: { season: (typeof seasons)[number]; from: string; jump: number } | null = null;
  for (let i = 1; i < seasons.length; i += 1) {
    const season = seasons[i]!;
    const previous = seasons[i - 1]!;
    if (season.clubId === previous.clubId || season.onLoanFrom !== null) continue;
    const jump = repOf(season.clubId) - repOf(previous.clubId);
    if (!bestMove || jump > bestMove.jump) bestMove = { season, from: previous.clubId, jump };
  }
  if (bestMove && bestMove.jump > 4) {
    // What it was worth: silverware from that club, from that season on.
    const trophies = seasons
      .filter((s) => s.index >= bestMove!.season.index && s.clubId === bestMove!.season.clubId)
      .reduce((sum, s) => sum + s.trophies.length, 0);
    points.push({
      age: bestMove.season.age,
      kind: 'move',
      clubId: bestMove.season.clubId,
      detail: { from: bestMove.from, to: bestMove.season.clubId, trophies },
    });
  }

  // The injury that never fully healed, if there was one.
  const hurt = seasons
    .filter((s) => s.injuryLasting > 0)
    .sort((a, b) => b.injuryLasting - a.injuryLasting)[0];
  if (hurt) {
    points.push({
      age: hurt.age,
      kind: 'injury',
      clubId: hurt.clubId,
      detail: { cost: state.totals.lastingInjuryDamage },
    });
  }

  // The year that was *the* year — the same one the summary's header names.
  const peak = bestSeasonOf(state);
  if (peak) {
    points.push({ age: peak.age, kind: 'peak', clubId: peak.clubId, detail: { rating: peak.stats.rating } });
  }

  return points.sort((a, b) => a.age - b.age);
}
