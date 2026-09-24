/**
 * Legacy score and endings.
 *
 * The score exists to be screenshotted, so it has to be legible: every point
 * traces back to something the player can point at. Trophies are weighted by
 * how hard they actually are, and by the strength of the league they were won
 * in — a title in a weak league is worth a fraction of the same title in a
 * strong one, which is the arithmetic that makes the Saudi route a genuine
 * trade rather than a free lunch.
 */

import type { CareerState, League, Position, SeasonRecord, SeasonStats, TrophyId, World } from '../types.js';
import { clamp } from '../rng.js';

/** Base points per trophy before league-strength scaling. */
const TROPHY_POINTS: Record<TrophyId, number> = {
  world_cup: 900,
  continental_elite: 420,
  continental_nations: 380,
  club_world_cup: 180,
  league: 200,
  continental_secondary: 110,
  domestic_cup: 70,
};

const AWARD_POINTS: Record<string, number> = {
  ballon_dor: 700,
  golden_boot: 160,
  golden_glove: 160,
  // The same as the other two on purpose: the whole point of adding it was that
  // a defender's best season had no honour worth the same as a striker's.
  team_of_the_season: 55,
};

/**
 * What a season produced, before it is judged against the position's par.
 *
 * Every line here is something the position exists to do, and every position
 * contributes on at least two of them. The coefficients set the *relative*
 * worth of a tackle against a key pass against a goal; the par table below is
 * what stops those relative worths turning into a ranking of positions.
 */
function seasonOutput(stats: SeasonStats): number {
  return (
    stats.goals * 3.2 +
    stats.assists * 2.1 +
    stats.cleanSheets * 2.2 +
    stats.saves * 0.11 +
    (stats.tackles + stats.interceptions + stats.aerialsWon) * 0.08 +
    stats.keyPasses * 0.15 +
    stats.appearances * 0.35
  );
}

/**
 * Output a typical career produces per appearance, by position.
 *
 * **This is the fix for the worst unfairness the game had.** The score used to
 * be `goals × 3.2 + assists × 2.1 + appearances × 0.35`, and a career's median
 * goals run from 264 at striker to 27 at centre-back — so on identical seeds,
 * played identically, to an identical peak ability, a striker scored 3089 on
 * the achievements board and a centre-back 1536. The board ranked positions,
 * not players, and a sixteen-year-old who picked centre-back was locked out of
 * the top of a global leaderboard by a decision the game never explained.
 *
 * Meanwhile a centre-back's actual career — 4,547 tackles, interceptions and
 * headers won, 202 clean sheets — scored nothing at all, and Golden Boot and
 * Golden Glove had no defensive counterpart.
 *
 * So output is now measured against what that position normally produces. A
 * par career is worth the same everywhere and outplaying your position is what
 * earns points, which is also how anybody actually judges a footballer: 27
 * goals is a quiet season for a striker and a remarkable one for a centre-half.
 *
 * Regenerate with `pnpm par` after any change to the season simulation, and
 * `pnpm fairness --assert` fails the build if the spread reopens.
 */
const OUTPUT_PAR: Record<Position, number> = {
  GK: 1.59,
  CB: 2.07,
  LB: 2.01,
  RB: 2.01,
  CDM: 1.74,
  CM: 1.76,
  CAM: 1.74,
  // LM/RM are retired as playable positions; the par stays so a legacy save
  // that carries one still scores against its own shirt, not against 1.
  LM: 1.73,
  RM: 1.73,
  LW: 2.33,
  RW: 2.33,
  ST: 2.42,
};

/**
 * Points a par season earns, per appearance. Chosen so the median career keeps
 * roughly the output points it had before positions were normalised — the
 * point of this change is to level the positions, not to deflate the board.
 */
const PAR_POINTS_PER_APPEARANCE = 1.1;

/**
 * A full league season, in appearances, by who is playing it.
 *
 * The same numbers `sim/awards.ts` works from — "a full season here is 38–46
 * games" — read conservatively, so a genuine first-choice season reaches the
 * top of the scale rather than needing a perfect one.
 */
const FULL_SEASON_APPS = { keeper: 38, outfield: 30 } as const;

/**
 * The least of a club trophy anybody in the squad is credited with.
 *
 * Not zero. A player who spent the title-winning season injured, or came off
 * the bench in eight games, *was there* — he has the medal, and a game that
 * took it off him entirely would be wrong about football as well as mean. But
 * he did not win it the way the man who played thirty-eight did.
 */
const TROPHY_SHARE_FLOOR = 0.5;

/**
 * How much of a club trophy this season actually won.
 *
 * **This is the fix for the deepest problem the September review found.** Over
 * 400 seeds, the best way to play the game was to chase the biggest badge on
 * every card and ignore what role came with it — `ambitious` beat `shrewd`,
 * which reads the squad role against your own ability and is the decision the
 * whole squad ladder was built to pose. Badge-chasing beat role-reading, which
 * means the game's premise was decoration.
 *
 * The reason was here. A club trophy was scaled by league strength and by
 * nothing else, so the fringe player at a title-winning giant scored exactly
 * what the captain who played every game scored. Signing above your ceiling
 * cost you minutes and development and paid you a full medal anyway — and
 * medals are the largest term in the legacy score. There was no mechanism by
 * which reading a role could win, because the game was paying for the badge.
 *
 * Now a medal is worth your part in it. The same club, the same trophy, and
 * the man who played it is worth **twice** the man who watched it — the floor
 * is 0.5 and the cap is 1, so that ratio is exactly two. (This said "three
 * times" for a day, which was wrong about its own arithmetic in the file that
 * explains the largest term in the legacy score.)
 */
function trophyShare(season: SeasonRecord): number {
  const full = season.position === 'GK' ? FULL_SEASON_APPS.keeper : FULL_SEASON_APPS.outfield;
  return clamp(season.stats.appearances / full, TROPHY_SHARE_FLOOR, 1);
}

export interface LegacyBreakdown {
  key: string;
  value: number;
}

export interface LegacyResult {
  score: number;
  breakdown: LegacyBreakdown[];
}

export function computeLegacy(state: CareerState, world: World): LegacyResult {
  const leagueById = new Map<string, League>(world.leagues.map((l) => [l.id, l]));

  let trophyPoints = 0;
  let awardPoints = 0;
  let outputPoints = 0;

  for (const season of state.seasons) {
    const league = leagueById.get(season.leagueId);
    // International trophies are not diminished by where the player earns his
    // living; club trophies are.
    const domesticScale = league ? 0.35 + league.strength * 0.65 : 0.5;

    const share = trophyShare(season);
    for (const trophy of season.trophies) {
      const base = TROPHY_POINTS[trophy] ?? 50;
      const isInternational = trophy === 'world_cup' || trophy === 'continental_nations';
      // International silverware is left whole, for the reason above it and one
      // more: its denominator is a seven-game tournament, not a season, so club
      // appearances are the wrong scale and national ones are too short a
      // sample to divide by.
      trophyPoints += base * (isInternational ? 1 : domesticScale * share);
    }
    for (const award of season.awards) {
      awardPoints += (AWARD_POINTS[award] ?? 40) * (league ? 0.4 + league.strength * 0.6 : 0.6);
    }

    const scale = league ? league.strength : 0.5;
    // Judged against the position's par, so a season is worth what it was worth
    // *for a player in that shirt* — see OUTPUT_PAR.
    const par = OUTPUT_PAR[season.position] ?? 1;
    outputPoints += (seasonOutput(season.stats) / par) * PAR_POINTS_PER_APPEARANCE * scale;
    if (season.nationalStats) {
      // International football is scored the same way and for the same reason:
      // a defender's caps used to be worth a fifth of a striker's.
      outputPoints += (seasonOutput(season.nationalStats) / par) * PAR_POINTS_PER_APPEARANCE * 4.6;
    }
  }

  // Peak ability, weighted so the very top of the scale is worth chasing.
  const peakPoints = Math.pow(clamp(state.totals.peakOverall - 60, 0, 39) / 39, 1.8) * 900;

  /**
   * Longevity: seasons spent at the top of your own game.
   *
   * It used to be a flat "seasons at 80+", which sounds neutral and is not. A
   * position's rating comes out of its own attribute weighting, so a holding
   * midfielder peaks around 82 where a striker peaks around 84 — and a fixed
   * line at 80 therefore paid the striker for most of his career and the
   * midfielder for a third of it (252 points against 56, measured). That is a
   * scoring artefact, not a difference in how long either man stayed good.
   *
   * Near his own peak is what longevity actually means. The absolute floor
   * stops a career that never got good from farming it by never declining.
   */
  const primeFloor = Math.max(76, state.totals.peakOverall - 3);
  const primeSeasons = state.seasons.filter((s) => s.overallEnd >= primeFloor).length;
  const longevityPoints = primeSeasons * 28;

  // Wealth counts for very little here. It has a leaderboard of its own, and
  // letting it weigh heavily would collapse two of the three routes into one.
  const wealthPoints = Math.pow(state.totals.grossEarnings / 100_000_000, 0.7) * 45;

  // One-club careers and long spells are worth something on their own.
  const loyaltyPoints = loyaltyBonus(state.seasons);

  const penalties = state.player?.dopingBan ? -350 : 0;

  const breakdown: LegacyBreakdown[] = [
    { key: 'trophies', value: Math.round(trophyPoints) },
    { key: 'awards', value: Math.round(awardPoints) },
    { key: 'output', value: Math.round(outputPoints) },
    { key: 'peak', value: Math.round(peakPoints) },
    { key: 'longevity', value: Math.round(longevityPoints) },
    { key: 'wealth', value: Math.round(wealthPoints) },
    { key: 'loyalty', value: Math.round(loyaltyPoints) },
  ];
  if (penalties !== 0) breakdown.push({ key: 'penalties', value: Math.round(penalties) });

  const score = Math.max(0, Math.round(breakdown.reduce((sum, entry) => sum + entry.value, 0)));
  return { score, breakdown };
}

function loyaltyBonus(seasons: readonly SeasonRecord[]): number {
  if (seasons.length === 0) return 0;
  const counts = new Map<string, number>();
  // A loan season still belongs to the parent club: going out at nineteen and
  // coming back must not read as two moves.
  for (const season of seasons) {
    const club = season.onLoanFrom ?? season.clubId;
    counts.set(club, (counts.get(club) ?? 0) + 1);
  }
  const longest = Math.max(...counts.values());
  const oneClub = counts.size === 1 ? 220 : 0;
  return longest >= 8 ? longest * 14 + oneClub : oneClub;
}

// ---------------------------------------------------------------------------
// Endings
// ---------------------------------------------------------------------------

export interface Ending {
  id: string;
  /**
   * How rare this ending is meant to be. Higher wins when several fit, so the
   * list can be read in any order and still resolve the same way. See the
   * comment on `ENDINGS`.
   */
  rarity: number;
  when: (state: CareerState, legacy: number, world: World, reasonKey: string) => boolean;
}

const has = (state: CareerState, trophy: TrophyId, count = 1) =>
  state.seasons.reduce((n, s) => n + s.trophies.filter((t) => t === trophy).length, 0) >= count;

const awardCount = (state: CareerState, award: string) =>
  state.seasons.reduce((n, s) => n + s.awards.filter((a) => a === award).length, 0);

/** Clubs he actually belonged to; a loan season still counts as the parent's. */
const clubsPlayedFor = (state: CareerState) =>
  new Set(state.seasons.map((s) => s.onLoanFrom ?? s.clubId));

/** Countries he played league football in. */
const countriesPlayedIn = (state: CareerState, world: World) => {
  const leagues = new Map(world.leagues.map((l) => [l.id, l]));
  return new Set(state.seasons.map((s) => leagues.get(s.leagueId)?.countryId).filter(Boolean));
};

/**
 * Countries he actually *moved* to — loans excluded.
 *
 * `homegrown` is "never left home", and it was reached by 0.04% of careers:
 * one in twenty-five hundred, for an ending written, translated and then never
 * seen. The cause was not the fourteen-season requirement, it was the loan
 * ladder: 95% of careers go out on loan, the ladder's second rung is a big-five
 * second division, and a season there counted as a country he had played in. So
 * a nineteen-year-old sent to Germany for one year could never be homegrown,
 * whatever he did with the next eighteen seasons.
 *
 * A loan is not leaving. The club still owns him, he comes back, and no
 * supporter would say a player who spent a season on loan abroad at twenty had
 * left the country. Counting where he was *contracted* is both the truer
 * reading and the one that makes the ending exist.
 */
const countriesSignedIn = (state: CareerState, world: World) => {
  const leagues = new Map(world.leagues.map((l) => [l.id, l]));
  const clubs = new Map(world.clubs.map((c) => [c.id, c]));
  return new Set(
    state.seasons
      .map((s) => {
        // On loan: the country of the club that owns him, not the one he is at.
        const ownerId = s.onLoanFrom ?? s.clubId;
        const owner = clubs.get(ownerId);
        const leagueId = s.onLoanFrom ? owner?.leagueId : s.leagueId;
        return leagueId ? leagues.get(leagueId)?.countryId : undefined;
      })
      .filter(Boolean),
  );
};

/** Caps: the national appearances a career actually accumulated. */
const caps = (state: CareerState) =>
  state.seasons.reduce((n, s) => n + (s.nationalStats?.appearances ?? 0), 0);

/**
 * The fourteen endings became twenty-four, and the order stopped mattering.
 *
 * It used to be "first match in list order wins", which quietly hid the rarest
 * outcomes behind the broadest ones. Measured over 2,000 careers,
 * `serial_winner` was reached in 24% and shown in 3%, and a player banned for
 * doping who had won enough retired as *Serial Winner*, because the ban sat
 * below the honours in the list.
 *
 * `rarity` says what an ending is worth being told about, and the resolver
 * takes the highest that fits. Three rules decide the number:
 *
 *   90+  the career is defined by this and nothing else can outrank it — the
 *        ban, the treble of trebles
 *   50–89 a headline: a World Cup, three Ballons d'Or, one badge for twenty years
 *   1–49  a shape of career rather than a headline, down to the fallback at 0
 *
 * Adding an ending means picking a number in that scale, not finding the right
 * line to insert it on. `pnpm fairness` reports how often each one is reached
 * against how often it is shown, and fails the build when a reachable ending is
 * being swallowed.
 */
export const ENDINGS: readonly Ending[] = [
  /* Defined by one thing. A ban is the first line of the obituary whatever else
     the career held, which is why it outranks every honour below it. */
  { id: 'disgraced', rarity: 95, when: (s) => s.player?.dopingBan ?? false },

  /* The headlines. */
  /*
   * The greatest, and reachable.
   *
   * It read `legacy ≥ 6500 && three Ballon d'Ors && a World Cup`, and all three
   * at once is 0.035% of careers — one player in three thousand, which is not
   * "rare", it is "nobody will ever see this". The target is ten times
   * that, and the shape below is what gets there without cheapening it: **three
   * Ballon d'Ors, or two and a World Cup**, on a legacy in the top one per cent.
   * A World Cup is a tournament a career gets four or five shots at and a
   * nation has to be good enough to reach — making it mandatory meant an
   * Icelandic Messi could not be the greatest, which is the wrong reason to be
   * shut out. Measured at **0.350%** over 8,000 random-play careers.
   *
   * **The score bar is 5,300, not 6,000, since 2026-09-23**, and only the bar
   * moved. Making a medal worth the minutes behind it took about a tenth off
   * every legacy score (median 1,750 → 1,584), and the GOAT rate fell with it
   * to 0.25% — the game's hardest ending made harder as a side effect of a fix
   * to something else. It was put back. 5,300 is the old bar
   * scaled by the same tenth and measures **0.355%** over 20,000 careers, on
   * target. The award condition was left alone on purpose: it alone caps the
   * rate at 0.40% whatever the bar, so going higher would mean changing what a
   * GOAT *is*, which nobody asked for.
   */
  { id: 'goat', rarity: 90, when: (s, l) => l >= 5300 && (awardCount(s, 'ballon_dor') >= 3 || (awardCount(s, 'ballon_dor') >= 2 && has(s, 'world_cup'))) },
  { id: 'ballon_dor_winner', rarity: 82, when: (s) => awardCount(s, 'ballon_dor') >= 1 },
  { id: 'world_champion', rarity: 78, when: (s) => has(s, 'world_cup') },
  { id: 'continental_king', rarity: 74, when: (s) => has(s, 'continental_elite', 2) },
  { id: 'one_club_legend', rarity: 70, when: (s) => clubsPlayedFor(s).size === 1 && s.seasons.length >= 12 },
  {
    /* Champion in three different countries — the thing only a genuinely
       itinerant great manages, and the opposite of the journeyman below. */
    id: 'continental_nomad',
    rarity: 66,
    when: (s, _l, world) => {
      const leagues = new Map(world.leagues.map((x) => [x.id, x]));
      const countries = new Set(
        s.seasons.filter((x) => x.trophies.includes('league')).map((x) => leagues.get(x.leagueId)?.countryId),
      );
      return countries.size >= 3;
    },
  },
  {
    /**
     * A career's worth of caps — the one honour a player earns entirely away
     * from his club.
     *
     * **Ranked 46 rather than 62, and that is the fix for a whole family of
     * endings nobody was seeing.** A hundred caps happens in 21% of careers
     * here, which makes it the second most common outcome in the game — and it
     * sat in the rarity order among the headlines, above five-time champions,
     * three-hundred-goal forwards and record-breaking keepers. So it swallowed
     * them: `serial_winner` was reached by 0.08% of careers not because
     * winning five leagues is rare but because a player who does it almost
     * certainly also has a hundred caps, and this outranked him.
     *
     * An ending one career in five reaches is not a headline in this game
     * whatever it is in football. It belongs where it is now: above the shapes
     * of career, below the things that actually distinguish one great career
     * from another. A player whose caps are the notable thing still gets it.
     */
    id: 'centurion',
    rarity: 46,
    when: (s) => caps(s) >= 100,
  },
  {
    /* Three hundred goals is a forward's monument, and it is reachable only by
       a forward — which is the point: the board should not be the only place a
       striker's career is told. */
    id: 'goal_machine',
    rarity: 58,
    when: (s) => s.totals.goals >= 300,
  },
  {
    /* The keeper's equivalent, and the reason it exists: a goalkeeper could
       previously retire only into the generic endings. */
    id: 'the_wall',
    rarity: 57,
    when: (s) => s.player?.position === 'GK' && s.totals.cleanSheets >= 180,
  },
  {
    /**
     * Kept winning, for years.
     *
     * It was `legacy >= 3200`, which is about the top one per cent of careers —
     * and it was reached by 0.08% of them, because a career that good has
     * almost certainly also got a Ballon d'Or, a World Cup, two European Cups
     * or a hundred caps, and every one of those outranks it. An ending whose
     * condition is "a very high score" is an ending permanently in the shadow
     * of every ending that is a *thing that happened*.
     *
     * So it is now a thing that happened: league titles in five separate
     * seasons. That is what a serial winner is — not the best player in the
     * game, the one who was in the winning side again and again — and it can
     * be true of a career that never won an individual honour, which is
     * exactly when this ending should be the one that fits.
     */
    id: 'serial_winner',
    rarity: 54,
    when: (s) => s.seasons.filter((x) => x.trophies.includes('league')).length >= 5,
  },
  { id: 'oil_baron', rarity: 50, when: (s) => s.totals.grossEarnings >= 250_000_000 },

  /* Shapes of career. */
  {
    /* Four cups and never the league: the specialist, and a real archetype. */
    id: 'cup_specialist',
    rarity: 44,
    when: (s) => has(s, 'domestic_cup', 3) && !has(s, 'league'),
  },
  { id: 'late_bloomer', rarity: 42, when: (s) => s.totals.peakOverall >= 84 && s.seasons.slice(0, 8).every((x) => x.overallEnd < 76) },
  {
    /* Peaked at twenty and never went further. The mirror of the late bloomer,
       and the more common of the two in real football. */
    id: 'boy_wonder',
    rarity: 40,
    /* Seventy-six by twenty, not seventy-eight. The bar was set when a boy on
       a bench developed as fast as one playing every week; now that minutes
       scale development, an eighteen-year-old genuinely ahead of his peers
       reaches a lower number, and this ending fell to 0.17% of careers. The
       story is unchanged — good very young, and that was as good as it got. */
    when: (s) =>
      s.seasons.some((x) => x.age <= 20 && x.overallEnd >= 76) &&
      s.totals.peakOverall < 86 &&
      s.seasons.length >= 12,
  },
  { id: 'glass_talent', rarity: 38, when: (s) => s.seasons.filter((x) => x.injuryWeeks > 12).length >= 4 && s.totals.peakOverall >= 80 },
  {
    /* Came back from an injury that took real ability away and still peaked. */
    id: 'comeback',
    rarity: 36,
    when: (s) => s.totals.lastingInjuryDamage >= 4 && s.totals.peakOverall >= 82,
  },
  {
    /* Went up, and went up again: the lower-league career that climbs. */
    id: 'promotion_hero',
    rarity: 34,
    when: (s) => s.seasons.filter((x) => x.promoted).length >= 3,
  },
  {
    /* Seven countries. A shape of career, not an honour — hence below the
       three-country champion, which is one.
     *
     * The gate was five, and `pnpm balance` put this ending on **27.32%** of
     * careers: more than one in four players finished a twenty-season career
     * and was told the notable thing about it was that he had moved abroad a
     * few times. Five countries over twenty seasons is what an ordinary career
     * does, not a shape worth naming — the same fault `journeyman` was fixed
     * for. Seven is a player who never stopped. */
    id: 'globetrotter',
    rarity: 30,
    when: (s, _l, world) => countriesPlayedIn(s, world).size >= 6,
  },
  {
    /* Never left home. Common enough to sit low, and a real story: the player
       who was offered the move every summer and never took it. */
    id: 'homegrown',
    rarity: 28,
    /* Twelve seasons, not fourteen. Even with loans no longer counting against
       it this ending reached 0.17% of careers, and twelve seasons without ever
       signing abroad is the same story — the player who was offered the move
       every summer and never took it. */
    when: (s, _l, world) => countriesSignedIn(s, world).size === 1 && s.seasons.length >= 12,
  },
  { id: 'nearly_man', rarity: 26, when: (s, l) => l >= 1500 && s.totals.trophies === 0 },
  {
    /* Eight dressing rooms and nothing in the cabinet.
     *
     * The old gate was six clubs and nothing else, which **90.75% of careers**
     * cleared — an ending that nearly everyone qualifies for is a default
     * wearing a name. A journeyman is not simply somebody who moved; he is
     * somebody who kept moving and never settled anywhere long enough to win. */
    id: 'journeyman',
    rarity: 22,
    when: (s) => clubsPlayedFor(s).size >= 8 && s.totals.trophies === 0,
  },
  { id: 'solid_pro', rarity: 12, when: (s, l) => l >= 700 },
  {
    /**
     * The career that stopped because nobody would register him.
     *
     * Written first as "retired before thirty with fewer than eight seasons",
     * which cannot happen: a career starts at sixteen and the walk-away is
     * gated at thirty-five, so it was an ending the engine could never produce
     * — exactly the fault `docs/fairness-review.md` §3 bans on a card. The
     * honest version is the reason the machine already records: the window
     * found nobody, at any age, and that is where it ended.
     */
    id: 'frozen_out',
    rarity: 8,
    when: (s, _l, _w, reason) => reason === 'retirement.no_offers',
  },
  { id: 'squad_player', rarity: 0, when: () => true },
];

/**
 * The best-fitting ending, which is the rarest one whose condition holds.
 *
 * Deliberately not "the first that matches": that made the order of the array
 * load-bearing, and a broad ending added above a narrow one silently took it
 * out of the game. `world` is passed because several endings are about *where*
 * a career happened, and the league a season was played in only becomes a
 * country through the world.
 */
export function resolveEnding(
  state: CareerState,
  legacy: number,
  world: World,
  reasonKey: string,
): string {
  let best: Ending | null = null;
  for (const ending of ENDINGS) {
    if (!ending.when(state, legacy, world, reasonKey)) continue;
    if (!best || ending.rarity > best.rarity) best = ending;
  }
  return best?.id ?? 'squad_player';
}
