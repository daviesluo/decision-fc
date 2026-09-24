/**
 * Club silverware.
 *
 * A competition awards exactly one trophy a season, so a club's chance of
 * winning it is its **share of its own field** — not a number read off an
 * absolute table. That distinction is the whole design here, and getting it
 * wrong is not a tuning error but an arithmetic one: the first version used a
 * global reputation ladder, which handed England 4.7 league titles a season
 * (Brighton and Villa winning the Premier League, Villarreal collecting six
 * European Cups) while Belgium — whose best club is mid-table by world
 * standards — was awarded almost none, even though somebody wins it every
 * year.
 *
 * Shares are computed once per world and normalised to sum to one across each
 * field, so the arithmetic is right by construction. Only then does the
 * player's own quality move the number, and only within tight bounds.
 */

import type { Club, League, SeasonModifiers, TrophyId, World } from '../types.js';
import { chance, clamp, remap, type Rng } from '../rng.js';
import { starterBar } from '../model/role.js';
import { clubStanding, type ClubStanding } from '../model/market.js';

export interface TrophyContext {
  club: Club;
  league: League;
  modifiers: SeasonModifiers;
  /** Set when the player's club also entered a continental competition. */
  continental: 'elite' | 'secondary' | null;
  /** The player's current overall — a superstar drags a club's odds up. */
  playerOverall: number;
  /** Normalised shares for every competition; see `trophyField`. */
  field: TrophyField;
  /**
   * Where the club stands in the division it is playing in **this season** —
   * `clubStanding(club, league.id, world)`, computed by the caller because
   * this module has no `World`. Drives relegation and promotion, which used
   * to be read off absolute reputation: a promoted club of reputation 70+
   * could never be relegated from the top flight, when going straight back
   * down is the most common thing that happens to a promoted club.
   */
  standing: ClubStanding;
  /**
   * Whether the world models a division below this one. The single-tier
   * countries — the Netherlands, Portugal, Belgium, and every spin-off league
   * — have nowhere to send a relegated club, and a season stamped "relegated"
   * that then continues in the same division is a story fault worse than not
   * rolling relegation at all. Computed by the caller, which has the world.
   */
  hasLowerDivision: boolean;
  /**
   * Whether this club came up at the end of last season.
   *
   * Straight up and straight to the title is a real story — for a giant.
   * Kaiserslautern won the Bundesliga as a promoted club in 1998. A promoted
   * mid-table side winning it is not that story, and `seasonReality` alone did
   * not stop it: mid-table keeps 15% of the title roll, which over thirty
   * thousand seasons is enough to produce one. `tools/plausibility.ts` refuses
   * it outright, and this is what the engine needs in order to agree.
   */
  justPromoted: boolean;
}

export interface TrophyResult {
  trophies: TrophyId[];
  /** Extra fixtures played, fed back into the season stats. */
  continentalRounds: number;
  relegated: boolean;
  promoted: boolean;
}

export interface TrophyField {
  league: ReadonlyMap<string, number>;
  cup: ReadonlyMap<string, number>;
  elite: ReadonlyMap<string, number>;
  secondary: ReadonlyMap<string, number>;
  /**
   * Per division: the sum of every member's `strength^LEAGUE_CONCENTRATION`.
   *
   * Kept so a club playing OUTSIDE its data division — promoted or relegated
   * during a career — can have its title share computed against the field it
   * actually plays in. Without it, `leagueOdds` looked the club up in the
   * static share table and found its share of its OLD division: Southampton
   * went up and won the Premier League at their Championship odds the very
   * next season, which nobody would believe.
   */
  leagueTotals: ReadonlyMap<string, number>;
}

/**
 * How sharply strength converts into titles.
 *
 * A league title is the most concentrated prize in football — the best side
 * wins it far more often than it is merely "the best" — so the exponent is
 * high. A cup is a knockout and turns on one bad afternoon, so it is flatter,
 * and everyone who enters has a real chance.
 *
 * The cup was *far* too flat at 2.2. The bottom half of the Premier League
 * collectively won the FA Cup in 18% of seasons — about one in five — when the
 * real answer since 1990 is Wigan in 2013 and arguably Portsmouth in 2008, so
 * nearer one in twenty. Manchester City, meanwhile, were on 10%, when a club
 * that dominant wins it closer to a quarter of the time.
 *
 * At 4 the bottom half falls to ~9% and the best side rises to ~18%, which is
 * about right — and the cup stays clearly flatter than the league, where the
 * bottom half is on 3%. A cup upset should be a story people remember, not a
 * thing that happens most decades to most clubs.
 */
const LEAGUE_CONCENTRATION = 6;
/**
 * Flatter than the league, because a cup is a knockout and now spans divisions.
 *
 * It was 4, tuned when the cup field was one division deep. Pooling the tiers
 * into the one national cup they actually play for left a `strength ** 4` term
 * comparing a Premier League club with a Championship one, which crushed the
 * whole second tier to 0.4% of the competition — the opposite error to the one
 * being fixed, and just as unreal.
 *
 * At 2 the second tier holds about 4% of the English cup, against roughly 5% in
 * the real thing (Sunderland 1973, West Ham 1980, and Wigan in 2013), and the
 * strongest single club takes it about one year in nine. Flattening also gets
 * the top flight right: Portsmouth, Wigan and Leicester have all won the FA Cup
 * from mid-table, and a knockout that only the very best can win is not a cup.
 */
const CUP_CONCENTRATION = 2;
const CONTINENTAL_CONCENTRATION = 5;

/** Reputation above the floor at which a club is competitive for anything. */
function strength(reputation: number): number {
  return Math.max(1, reputation - 34);
}

/** Normalise a set of weights so they sum to exactly one. */
function share(entries: [string, number][]): Map<string, number> {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const out = new Map<string, number>();
  if (total <= 0) return out;
  for (const [id, weight] of entries) out.set(id, weight / total);
  return out;
}

/**
 * Every competition's field, normalised. Memoised on the world object: the
 * content pack does not change during a career, and recomputing this for each
 * of twenty seasons of every career in a twenty-thousand-career sweep is
 * measurable. Pure — no clock, no randomness — so it cannot affect replay.
 */
const FIELD_CACHE = new WeakMap<World, TrophyField>();

export function trophyField(world: World): TrophyField {
  const cached = FIELD_CACHE.get(world);
  if (cached) return cached;

  const leagues = new Map(world.leagues.map((l) => [l.id, l]));
  const countries = new Map(world.countries.map((c) => [c.id, c]));
  const leagueOf = (club: Club) => leagues.get(club.leagueId)!;

  // The league title: one per division, shared out by reputation. The raw
  // per-division totals are kept alongside the normalised shares so a club
  // that changes division mid-career can be priced into its new field.
  const leagueShare = new Map<string, number>();
  const leagueTotals = new Map<string, number>();
  for (const league of world.leagues) {
    const clubs = world.clubs.filter((c) => c.leagueId === league.id);
    if (clubs.length === 0) continue;
    const weights = clubs.map(
      (c) => [c.id, strength(c.reputation) ** LEAGUE_CONCENTRATION] as [string, number],
    );
    leagueTotals.set(
      league.id,
      weights.reduce((sum, [, weight]) => sum + weight, 0),
    );
    for (const [id, value] of share(weights)) {
      leagueShare.set(id, value);
    }
  }

  /**
   * The national cup: **one per country**, every division in it together.
   *
   * This was built per league, on a comment that said "the cup is per country,
   * but our world has at most one tier that plays for it, so league is the same
   * set". That has not been true since the second divisions were added: England,
   * Spain, Italy, Germany and France all field two tiers, so each of them was
   * running *two* full-strength national cups — a Premier League FA Cup and a
   * separate Championship FA Cup, each with a winner every year. A Championship
   * side lifted the FA Cup as often as Manchester City did, which is what a
   * player noticed: five seasons in the second tier and a cup almost every year.
   *
   * Pooling the tiers fixes it by arithmetic rather than by a special case. A
   * second-tier club keeps a real chance — that is the romance of the
   * competition and Wigan did win it — but it is now the chance its reputation
   * and its division actually earn, weighted the way the continental field
   * already weights league strength.
   */
  const cupShare = new Map<string, number>();
  const byCountry = new Map<string, [string, number][]>();
  for (const club of world.clubs) {
    const league = leagueOf(club);
    if (!league) continue;
    const weight = strength(club.reputation) ** CUP_CONCENTRATION * (0.7 + league.strength * 0.3);
    byCountry.set(league.countryId, [...(byCountry.get(league.countryId) ?? []), [club.id, weight]]);
  }
  for (const entries of byCountry.values()) {
    for (const [id, value] of share(entries)) cupShare.set(id, value);
  }

  // Continental competitions: one per confederation per tier, and the field is
  // every club that qualifies for it, weighted by league strength as well as
  // reputation — an eighty-rated club in a weak league is not the equal of an
  // eighty-rated club in a strong one.
  const eliteEntries = new Map<string, [string, number][]>();
  const secondaryEntries = new Map<string, [string, number][]>();
  for (const club of world.clubs) {
    const league = leagueOf(club);
    if (!league) continue;
    const entry = continentalEntry(club, league, world);
    if (!entry) continue;
    const confederation = countries.get(league.countryId)?.confederation;
    if (!confederation) continue;
    const weight =
      strength(club.reputation) ** CONTINENTAL_CONCENTRATION * (0.4 + league.strength * 0.6);
    const bucket = entry === 'elite' ? eliteEntries : secondaryEntries;
    bucket.set(confederation, [...(bucket.get(confederation) ?? []), [club.id, weight]]);
  }
  const eliteShare = new Map<string, number>();
  for (const entries of eliteEntries.values()) {
    for (const [id, value] of share(entries)) eliteShare.set(id, value);
  }
  const secondaryShare = new Map<string, number>();
  for (const entries of secondaryEntries.values()) {
    for (const [id, value] of share(entries)) secondaryShare.set(id, value);
  }

  const built: TrophyField = {
    league: leagueShare,
    cup: cupShare,
    elite: eliteShare,
    secondary: secondaryShare,
    leagueTotals,
  };
  FIELD_CACHE.set(world, built);
  return built;
}

/**
 * A player far better than his club drags its odds up — this is how a
 * superstar carries a mid-table side. Bounded tightly: one man improves a
 * team, he does not turn Brighton into Real Madrid.
 */
function starBoost(playerOverall: number, club: Club): number {
  const delta = playerOverall - remap(club.reputation, 10, 100, 55, 92);
  return clamp(1 + delta * 0.055, 0.85, 1.55);
}

/**
 * The superstar who drags an unfashionable club up with him.
 *
 * `starBoost` alone could never do this. Our fields are `strength^6` normalised
 * inside a league, so a mid-table club's share is minuscule before any
 * multiplier touches it: a 96-rated player at Fulham had **0.67%** of winning
 * the league, which is not "hard", it is "no". A player who stays loyal to the
 * club that raised him was quietly playing for nothing.
 *
 * The direct fix is to promote the club a whole reputation band when an elite
 * player is there. In these maths a whole band is worth about ×11, because the
 * exponent is 6 — far too much.
 *
 * So: the same device, half the dose. The player lifts his club's **effective
 * reputation**, by an amount that ramps with his ability and shrinks as the club
 * gets bigger — a giant needs no carrying, and at 92+ reputation gets none. A
 * 96-rated player is worth about +9 reputation at a mid-table side and nothing
 * at Manchester City.
 *
 * Taken through the same exponent as the competition being entered, so a title
 * (concentrated) and a cup (a knockout anyone can win) each move by the right
 * amount rather than by a shared fudge factor.
 */
const CARRY_MIN_OVERALL = 84;
const CARRY_FULL_OVERALL = 95;
/** Reputation at which a club stops needing help, and where the lift is largest. */
const CARRY_CLUB_CEILING = 92;
const CARRY_CLUB_FLOOR = 60;
/** Reputation points an unarguable superstar is worth to a mid-table club. */
const CARRY_LIFT = 12;

function carryBoost(playerOverall: number, club: Club, concentration: number): number {
  const ability = remap(playerOverall, CARRY_MIN_OVERALL, CARRY_FULL_OVERALL, 0, 1);
  const room = remap(club.reputation, CARRY_CLUB_CEILING, CARRY_CLUB_FLOOR, 0, 1);
  if (ability <= 0 || room <= 0) return 1;
  const lifted = strength(club.reputation + CARRY_LIFT * ability * room);
  return (lifted / strength(club.reputation)) ** concentration;
}

/**
 * Domestic title odds — **of the division the club is playing in**, which a
 * promotion or relegation can make a different division from the one the data
 * assigns it. A guest club joins the field with its own weight: a promoted
 * mid-reputation side is worth a percent or two of the top flight, and a
 * relegated giant really is the overwhelming favourite to come straight back
 * up. Looking the club up in the static share table alone handed a promoted
 * club its OLD division's share — a newly-promoted Southampton won the
 * Premier League at Championship-title odds.
 */
export function leagueOdds(club: Club, league: League, playerOverall: number, field: TrophyField): number {
  const own = strength(club.reputation) ** LEAGUE_CONCENTRATION;
  const homeDivision = club.leagueId === league.id;
  const total = field.leagueTotals.get(league.id) ?? 0;
  const shareOfField = homeDivision
    ? (field.league.get(club.id) ?? 0)
    : total > 0
      ? own / (total + own)
      : 0;
  return (
    shareOfField *
    starBoost(playerOverall, club) *
    carryBoost(playerOverall, club, LEAGUE_CONCENTRATION)
  );
}

export function cupOdds(club: Club, playerOverall: number, field: TrophyField): number {
  return (
    (field.cup.get(club.id) ?? 0) *
    starBoost(playerOverall, club) *
    carryBoost(playerOverall, club, CUP_CONCENTRATION)
  );
}

/**
 * Continental odds. The Asian and North American fields are shallow, which is
 * why the Saudi route hands out medals cheaply — that is deliberate, priced
 * into the card, and falls out of the share maths rather than a special case.
 */
export function continentalOdds(
  club: Club,
  tier: 'elite' | 'secondary',
  playerOverall: number,
  field: TrophyField,
): number {
  const table = tier === 'elite' ? field.elite : field.secondary;
  return (
    (table.get(club.id) ?? 0) *
    starBoost(playerOverall, club) *
    carryBoost(playerOverall, club, CONTINENTAL_CONCENTRATION)
  );
}

/**
 * How far a season's cards are allowed to move the odds, in total.
 *
 * Multipliers used to compound without limit, so on the three-cards-a-season
 * pace a player could stack three doublings into a single year and win
 * everything. A season's decisions can swing a competition meaningfully; they
 * cannot make silverware a certainty.
 */
function bounded(multiplier: number): number {
  return clamp(multiplier, 0.3, 2.4);
}

export function simulateTrophies(rng: Rng, context: TrophyContext): TrophyResult {
  const { club, league, modifiers, playerOverall } = context;
  const trophies: TrophyId[] = [];

  // Event multipliers stack multiplicatively, so the products are re-clamped:
  // a doubled title chance must read as "very likely", never "certain". A
  // key-moment override (the decisive penalty) wins outright: the final was
  // already played, the card only decided how it ended.
  const decide = (trophy: TrophyId, odds: number): boolean => {
    if (modifiers.forceTrophy === trophy) return true;
    if (modifiers.skipTrophy === trophy) return false;
    return chance(rng, clamp(odds, 0, 0.92));
  };

  /**
   * The table the club is actually in damps the title roll. The share maths
   * says how big the club is; the standing says what kind of season it is
   * having — and a side in the relegation scrap does not win the league that
   * May whatever its badge says. Midtable champions stay possible at
   * Leicester rarity rather than once a career: measured over 1,500 careers,
   * the undamped rolls handed 5% of top-flight titles to mid-table-or-worse
   * sides, where real football since 1990 is under 1%.
   */
  const seasonReality =
    context.standing === 'survival' ? 0 : context.standing === 'midtable' ? 0.15 : 1;
  /*
   * And the season *before* this one. A club in its first campaign back up
   * wins the league only if it belongs at the top of it — see `justPromoted`.
   * Multiplied rather than folded into `seasonReality` because the two say
   * different things: one is what kind of season this is, the other is where
   * the club was twelve months ago.
   */
  const promotedReality =
    context.justPromoted && context.standing !== 'title' && context.standing !== 'european' ? 0 : 1;
  const wonLeague = decide(
    'league',
    leagueOdds(club, league, playerOverall, context.field) *
      seasonReality *
      promotedReality *
      bounded(modifiers.leagueTrophyMultiplier),
  );
  if (wonLeague) trophies.push('league');

  if (decide('domestic_cup', cupOdds(club, playerOverall, context.field) * bounded(modifiers.cupTrophyMultiplier))) {
    trophies.push('domestic_cup');
  }

  let continentalRounds = 0;
  if (context.continental) {
    continentalRounds = context.continental === 'elite' ? 8 : 6;
    const id: TrophyId = context.continental === 'elite' ? 'continental_elite' : 'continental_secondary';
    const odds =
      continentalOdds(club, context.continental, playerOverall, context.field) *
      bounded(modifiers.continentalTrophyMultiplier);
    if (decide(id, odds)) {
      trophies.push(id);
      // Winning the elite continental cup earns a shot at the Club World Cup.
      if (context.continental === 'elite' && chance(rng, 0.3)) trophies.push('club_world_cup');
    }
  }

  // Relegation threatens weak clubs in the top tier; strong second-tier clubs go
  // up. Winning the league obviously overrides relegation.
  //
  // Which club it is decides the range, and it should: a well-run second-tier
  // side goes up far more often than a poor one whoever plays for it, and that
  // difference is carried by `club.reputation` in the two base rates below.
  //
  // The player then decides where in that range the season lands — he is one of
  // eleven, not the fixture list. Deliberately a *multiplier* on the club's own
  // rate rather than a number added to it: added, a passenger at Manchester
  // United handed them an 8% chance of relegation, because their base rate is
  // zero and anything added to zero is the whole of it. Multiplied, a club that
  // would never go down still never goes down, a club that might goes down more
  // often with a passenger in the side, and a star drags a promotion push into
  // a promotion.
  const swing = remap(context.playerOverall - starterBar(club, league), -10, 14, -0.5, 0.9);
  // By standing in the division the club actually plays in, not by absolute
  // reputation. The old `remap(reputation, 10, 70, …)` zeroed relegation for
  // any club of reputation 70+, so a promoted side could never go straight
  // back down — when that is the most common fate of a promoted side — and it
  // read a relegated giant in the second tier as just another mid-table team.
  // A survival-band club fights the drop about one season in four before the
  // player's own effect; a title-band second-tier club goes up most seasons.
  const relegationRate =
    context.standing === 'survival'
      ? 0.26
      : context.standing === 'midtable'
        ? 0.07
        : context.standing === 'european'
          ? 0.01
          : 0;
  const promotionRate =
    context.standing === 'promotion' ? 0.3 : context.standing === 'playoff' ? 0.16 : context.standing === 'midtable' ? 0.04 : 0.01;

  const relegated =
    league.tier === 1 &&
    context.hasLowerDivision &&
    !wonLeague &&
    chance(rng, clamp(relegationRate * (1 - swing), 0, 0.35));
  const promoted =
    league.tier > 1 && (wonLeague || chance(rng, clamp(promotionRate * (1 + swing), 0, 0.35)));

  // A relegated club's season is not a season with a trophy in it. The
  // alternative — a career row showing a cup win beside a relegation arrow —
  // reads as a bug even though real football does occasionally produce one
  // (Wigan, 2013). Made a decision here rather than left as an accident of two
  // independent rolls.
  return { trophies: relegated ? [] : trophies, continentalRounds, relegated, promoted };
}

/**
 * Whether a club qualifies for continental football at all, and at what level.
 *
 * Tied to where the club finishes, not to a bare reputation number, because
 * Europe is qualified for by the league table: only the title race and the
 * clubs in the European places go, so a mid-table or relegation-threatened
 * side — whatever its badge — is not in it. This is the same `clubStanding`
 * the offer card prints, so a club shown as "mid-table" can no longer be the
 * one quietly entered in the Champions League and winning it. The champions'
 * tier plays the elite competition; the European-place tier plays the secondary
 * one, capped at what the league itself offers (a country whose best prize is
 * the secondary cup never enters the elite from either band).
 */
export function continentalEntry(club: Club, league: League, world: World): 'elite' | 'secondary' | null {
  if (league.continental === null) return null;
  const standing = clubStanding(club, league.id, world);
  if (standing === 'title') return league.continental;
  if (standing === 'european') return league.continental === 'elite' ? 'secondary' : league.continental;
  return null;
}
