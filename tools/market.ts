/**
 * Offer audit — does the market read like football?
 *
 * The balance sweep asks whether a career *ends* in a sensible place. This asks
 * whether every card along the way is one a real player could have been handed:
 * the wage, the signing bonus, the contract length, and the squad role written
 * into it.
 *
 * It plays careers from the player's seat rather than at random — a player
 * takes the best thing in front of him most of the time — and inspects every
 * offer the engine produces. Each rule below is something a reader would notice
 * and not forgive. A violation prints with the numbers that caused it, so a
 * failure is a lead rather than a score.
 *
 * Usage: pnpm market [--runs=500] [--pace=standard] [--show=4]
 */

import { WORLD } from '../packages/content/src/index.js';
import {
  createCareer,
  decide,
  indexWorld,
  appearanceRange,
  mulberry32,
  countSeasonsAtClub,
  isRealisticTarget,
  withinOfferReach,
  promisableRole,
  roleForDelta,
  shiftRole,
  roleRank,
  selectIdentity,
  starterBar,
  PLAYABLE_POSITIONS,
  type CareerState,
  type Club,
  type League,
  type DecisionOption,
  type Pace,
  type Position,
  WINDOW_SPREAD,
  type SquadRole,
} from '../packages/engine/src/index.js';
import { COUNTRIES } from '../packages/content/src/data/countries.js';

/** The lowest squad standard anywhere in the world. */
const LEAGUE_BY_ID = new Map(WORLD.leagues.map((l) => [l.id, l]));
const LOWEST_BAR = Math.min(
  ...WORLD.clubs.map((c) => starterBar(c, LEAGUE_BY_ID.get(c.leagueId)!)),
);

/**
 * A career mutates the world it plays in — clubs change division, managers get
 * sacked — and both are recorded on the career rather than on the shared world.
 * Every lookup therefore has to go through *that career's* view. Reading the
 * world's opening position instead makes a promoted club look second-tier, and
 * computes tactical fit against a manager who left six seasons ago.
 */
const indexFor = (state: CareerState) => indexWorld(WORLD, state.leagueMoves, state.managerChanges);

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const RUNS = Number(arg('runs') ?? 500);
const PACE = (arg('pace') ?? 'standard') as Pace;
const SHOW = Number(arg('show') ?? 4);

const ARCHETYPES = ['pace', 'technical', 'physical'] as const;

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

interface Rule {
  id: string;
  what: string;
  /** Violations are a hard failure; observations are printed for judgement. */
  soft?: boolean;
  hits: number;
  seen: number;
  examples: string[];
}

const RULES = new Map<string, Rule>();

function rule(id: string, what: string, soft = false): Rule {
  let found = RULES.get(id);
  if (!found) {
    found = { id, what, soft, hits: 0, seen: 0, examples: [] };
    RULES.set(id, found);
  }
  return found;
}

function check(id: string, what: string, ok: boolean, detail: () => string, soft = false): void {
  const r = rule(id, what, soft);
  r.seen += 1;
  if (ok) return;
  r.hits += 1;
  if (r.examples.length < SHOW) r.examples.push(detail());
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const money = (v: number) =>
  v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `€${Math.round(v / 1000)}k` : `€${v}`;

const describe = (club: Club, league: League, role: SquadRole, wage: number) =>
  `${club.id}(${league.id} rep${club.reputation} w${club.wealth}) ${role} ${money(wage)}/wk`;

// ---------------------------------------------------------------------------
// The audit
// ---------------------------------------------------------------------------

/** Offers carrying a wage, i.e. a contract the player is being asked to sign. */
function contractOffers(options: readonly DecisionOption[]) {
  return options.filter((o) => o.offer && o.offer.wage > 0 && o.clubId);
}

function auditDecision(state: CareerState): void {
  const INDEX = indexFor(state);
  const decision = state.pending;
  const player = state.player;
  if (!decision || !player) return;

  const currentWage = state.contract?.wage ?? 0;
  const offers = contractOffers(decision.options);

  for (const option of offers) {
    const club = INDEX.club(option.clubId!);
    const league = INDEX.leagueOfClub(club.id);
    const offer = option.offer!;
    const where = describe(club, league, offer.promisedRole, offer.wage);
    const isMove = option.clubId !== state.contract?.clubId;

    // 1. Nobody is promised a place he is not good enough to hold. This is the
    //    rule, checked at the point the promise is made rather than
    //    only at the point it is kept.
    //
    //    Service counts, and has to be counted here too: four seasons at a club
    //    buy a rung of standing, so a renewal may legitimately promise one
    //    higher than a signing of identical ability. Measuring against a
    //    zero-service ceiling flagged every long-serving player's renewal as a
    //    broken promise.
    const served = isMove ? 0 : countSeasonsAtClub(state.seasons, club.id);
    check(
      'role-ability',
      'a contract never promises a role ability cannot support',
      roleRank(offer.promisedRole) <= roleRank(promisableRole(player, club, league, served)),
      () =>
        `OVR ${player.overall} vs bar ${starterBar(club, league)} at ${where} after ${served} seasons — ` +
        `most they could promise is ${promisableRole(player, club, league, served)} ` +
        // Which card produced it. Without this a violation names a club and a
        // number and leaves the reader to guess which of the six builders that
        // can write a contract wrote this one.
        `[${decision.kind} ${option.id}]`,
    );

    // 2. A wage has to be a wage. The floor is the lowest the engine is allowed
    //    to quote; anything at seven figures a week is a headline, not a job.
    check(
      'wage-range',
      'every wage sits inside a believable band',
      offer.wage >= 250 && offer.wage <= 1_800_000,
      () => `${where}`,
    );

    // 3. A signing bonus is a multiple of what he earns, not a lottery. Half a
    //    year's wage to five years' wage covers everything from a routine
    //    renewal to a free transfer where the fee becomes the player's.
    check(
      'bonus-scale',
      'a signing bonus reads as a multiple of the wage, not a random number',
      offer.signingBonus === 0 ||
        (offer.signingBonus >= offer.wage * 26 * 0.5 && offer.signingBonus <= offer.wage * 52 * 5),
      () => `${where} bonus ${money(offer.signingBonus)} on ${money(offer.wage * 52)}/yr`,
    );

    // 4. A free transfer is worth more to the player than a paid one: the fee
    //    that is not being paid to his club is the money he captures. If that
    //    ever inverts, the "run your contract down" route is a lie.
    //
    //    Only on offers that actually move him. A renewal also carries no fee,
    //    and correctly pays the ordinary bonus — nobody is buying him.
    if (isMove && offer.fee === 0 && offer.signingBonus > 0) {
      check(
        'free-transfer-premium',
        'a free transfer pays a bigger bonus than the same wage on a fee move',
        offer.signingBonus >= offer.wage * 26 * 2,
        () => `free move to ${where}, bonus only ${money(offer.signingBonus)}`,
      );
    }

    // 5. Contract length has to match a career stage. Nobody hands a 36-year-old
    //    five years, and a 20-year-old signing for one is a bookkeeping error.
    check(
      'contract-years',
      'contract length fits the age',
      offer.years >= 1 &&
        offer.years <= 5 &&
        (player.age < 31 || offer.years <= 3) &&
        (player.age < 35 || offer.years <= 2),
      () => `age ${player.age}, ${offer.years}y at ${where}`,
    );

    // 6. A release clause below market value would be free money for the buyer.
    //
    //    Only for a clause being *written*. An `existing` offer is the deal the
    //    player is already on, printed so he can read it — the loan-return card
    //    does this — and a clause agreed four seasons ago is below what he is
    //    worth today precisely because he has grown. That is how release
    //    clauses work, and nobody is promising anything.
    check(
      'release-clause',
      'a release clause is never below what he is already worth',
      offer.existing === true || offer.releaseClause === null || offer.releaseClause >= player.marketValue,
      () => `clause ${money(offer.releaseClause!)} vs value ${money(player.marketValue)} at ${where}`,
    );

    // 7. The mirror of role-ability, and the rule stated on a screenshot:
    //    every *cold* offer is tied to his ability. A club so far below him that
    //    he would never sign for it is not a suitor — an 86 frozen out at
    //    Barcelona does not get a Serie B bid. Only moves, and only the core
    //    market: a twilight money move to a spin-off league bids on the cheque,
    //    not the fit, and is gated by age elsewhere.
    //
    //    Two relationship moves are exempt, because their tie to the player is
    //    exactly what a cold ability bar cannot see: the loan club exercising its
    //    buy option on a boy it has just played a season, and the club that
    //    raised him taking its old boy home. Both are meant to sit below his
    //    level; that is the story, not a bug.
    const isBuyout = option.id.startsWith('buyout:');
    const isHomecoming = option.clubId === state.seasons[0]?.clubId;
    if (isMove && !isBuyout && !isHomecoming) {
      check(
        'offer-ability-ceiling',
        'no cold core-market offer comes from a club far below his ability',
        withinOfferReach(player, club, league),
        () =>
          `OVR ${player.overall} but bar only ${starterBar(club, league)} at ${where} ` +
          `[${decision.kind} ${option.id}]`,
      );
    }

    // 7. Money moves. The Gulf and China are the wage trap and have to bait it:
    //    an offer from one that undercuts his current wage is the trap failing.
    //    Japan, MLS and China are deliberately *not* in this — they are the
    //    twilight move, where a pay cut is the realistic thing and the draw is
    //    the life. Only the Gulf is the wage trap now, and only its `wageIndex`
    //    is written to outbid Europe.
    //
    //    Moves only. A club re-signing a thirty-five-year-old at half what it
    //    once paid him is not a broken offer, it is the second half of a
    //    career: the Gulf overpays to *sign* a name and re-prices him after.
    if (isMove && league.market === 'spinoff' && (league.wageIndex ?? 1) >= 1.5 && currentWage > 0) {
      check(
        'money-league-pays',
        'a money-league offer really does pay over the odds',
        offer.wage > currentWage * 1.2,
        () => `${where} vs current ${money(currentWage)}/wk — via ${decision.kind}/${option.id}`,
      );
    }
  }

  // ---- the window as a whole -------------------------------------------
  //
  // The single thing most likely to break the fiction is not any one offer, it
  // is two offers side by side. A window is a claim about who is interested in
  // this player right now, and clubs from two different football worlds in one
  // list says nobody is really interested in him at all.
  //
  // Spin-off clubs are exempt throughout: the Gulf offer is deliberately from
  // somewhere else, which is the whole story it tells. It is capped at one per
  // window elsewhere, so it can never be what makes a window incoherent.
  const suitors = decision.options
    .filter((o) => o.clubId && o.clubId !== state.contract?.clubId)
    .map((o) => {
      const club = INDEX.club(o.clubId!);
      return { id: o.id, club, league: INDEX.leagueOfClub(club.id), offer: o.offer };
    });
  const core = suitors.filter((e) => e.league.market === 'core');

  // 8. Every club in the window is one that would genuinely have him. Without
  //    this a window can read as coherent and still be nonsense — three clubs
  //    from the same league, none of whom would take his call.
  //
  // Two card kinds are deliberately outside all of this, and the engine says so
  // where the rule is defined: an academy card is a sixteen-year-old choosing
  // where to be coached, not a squad signing him, and a loan card exists
  // precisely to pose "better football, or a place in the side?" — which means
  // offering two levels at once. Judging either by transfer-window rules would
  // be enforcing the opposite of what they are for.
  const judged = decision.kind === 'transfer' || decision.kind === 'career_event';
  if (!judged) return;

  for (const entry of suitors) {
    check(
      'plausible-suitor',
      'every club in a window is one that would actually take this player',
      // Clubs at the very bottom of the world's squad standards are exempt: a
      // career can fall below every bar in the game (the lowest is 58, and
      // careers do end up under it), and at that point the only alternative to
      // an implausible offer is no window at all, which ends the career on a
      // technicality. This is the documented last-resort trade — a door that
      // exists beats a door that reads correctly.
      //
      // Written as a property of the *club* and it should have been one of the
      // player: it exempted a side whose bar is the lowest in the world and
      // nothing else, so a 45-rated twenty-two-year-old offered Preston — bar
      // 59, one point above the exemption — read as a market failure when it is
      // the documented trade working exactly as described. He is fourteen
      // points below every squad standard in the game; *every* door he is shown
      // is a last resort. The door still has to be at the bottom of the pyramid,
      // so a giant slumming it fails as loudly as before.
      isRealisticTarget(player, entry.club, entry.league, 12) ||
        starterBar(entry.club, entry.league) <= LOWEST_BAR ||
        (player.overall < LOWEST_BAR && starterBar(entry.club, entry.league) <= LOWEST_BAR + 4),
      () =>
        `OVR ${player.overall} offered ${entry.club.id} ` +
        `(${entry.league.id}, bar ${starterBar(entry.club, entry.league)}) via ${entry.id}`,
    );
  }

  if (core.length > 1) {
    const strengths = core.map((e) => e.league.strength);
    const reputations = core.map((e) => e.club.reputation);

    // 9. One football world, by league. A window that pairs Ligue 1 with Serie
    //    B is asking the player to choose between two different sports.
    check(
      'window-one-league-world',
      'the leagues in a window belong to the same level of football',
      Math.max(...strengths) - Math.min(...strengths) <= WINDOW_SPREAD + 0.02,
      () => core.map((e) => `${e.club.id}(${e.league.id} ${e.league.strength})`).join('  vs  '),
    );

    // 10. One football world, by club. League alone is not enough: Real Madrid
    //     and a relegation side are both La Liga, and a window offering both is
    //     just as incoherent as one that crosses divisions.
    check(
      'window-one-club-world',
      'the clubs in a window are of comparable standing, not a giant next to a minnow',
      Math.max(...reputations) - Math.min(...reputations) <= 30,
      () => core.map((e) => `${e.club.id}(rep ${e.club.reputation})`).join('  vs  '),
    );

    // 11. And the money has to agree with the rest of it. Two clubs of a
    //     similar size at the same role should read as comparable offers; an
    //     order-of-magnitude gap means one of the two numbers is wrong.
    const paid = core.filter((e) => e.offer && e.offer.wage > 0);
    if (paid.length > 1) {
      const wages = paid.map((e) => e.offer!.wage);
      check(
        'window-wages-comparable',
        'wages inside one window are of the same order as each other',
        Math.max(...wages) <= Math.min(...wages) * 8,
        () => paid.map((e) => `${e.club.id} ${money(e.offer!.wage)}`).join('  vs  '),
      );
    }

    // 12. The bigger club does not quote the smaller wage at the same role.
    //     Adjusted for what a league *pays* as opposed to what it is worth on
    //     the pitch: the Championship really does outpay the Belgian top flight,
    //     and calling that a bug would be calling football a bug.
    const rated = core
      .filter((e) => e.offer && e.offer.wage > 0)
      .map((e) => ({ ...e, standing: e.club.reputation + e.league.strength * 20 }));
    if (rated.length > 1) {
      const best = rated.reduce((a, b) => (a.standing >= b.standing ? a : b));
      const worst = rated.reduce((a, b) => (a.standing <= b.standing ? a : b));
      if (
        best.standing - worst.standing > 15 &&
        (best.league.wageIndex ?? 1) >= (worst.league.wageIndex ?? 1) &&
        roleRank(best.offer!.promisedRole) >= roleRank(worst.offer!.promisedRole)
      ) {
        check(
          'bigger-club-pays',
          'the bigger club in a window does not quote a smaller wage at the same role',
          best.offer!.wage >= worst.offer!.wage * 0.75,
          () =>
            `${describe(best.club, best.league, best.offer!.promisedRole, best.offer!.wage)}  <  ` +
            `${describe(worst.club, worst.league, worst.offer!.promisedRole, worst.offer!.wage)}`,
        );
      }
    }
  }
}

function auditSeasons(state: CareerState): void {
  const INDEX = indexFor(state);
  const isGoalkeeper = state.player?.position === 'GK';
  for (const season of state.seasons) {
    const club = INDEX.club(season.clubId);
    // The division the season was actually played in. `state.leagueMoves` is
    // where every club *ended up*, so it dates a year-three season by a
    // promotion that happened in year twelve.
    const seasonLeague = LEAGUE_BY_ID.get(season.leagueId)!;
    const seasonBar = starterBar(club, seasonLeague);

    // 9. The same rule again, this time on what actually happened. Ten
    //    points below a club's standard caps the ceiling at an impact sub even
    //    with tactical fit at its most generous; one rung of promise on top of
    //    that still stops short of a starting place.
    //
    //    **A loan season is the deliberate exception.** The parent club lends
    //    the boy on condition that he plays and the borrowing club signs up to
    //    it, so the guarantee outruns ability by design — that clause is the
    //    only reason a seventeen-year-old rated below every senior bar in the
    //    database has anywhere to go at all. How far it outruns him is not
    //    arbitrary either: it is `LOAN_GUARANTEE`, read off where the borrowing
    //    club sits in its own division, and the engine suite asserts the card
    //    and the season agree on it.
    //    **A spin-off arrival is the other exception** (by rule): the
    //    season a player lands in Saudi Arabia, MLS, J1 or the CSL he plays as
    //    at least an Important Player, because the signing is the product —
    //    the engine floors it absolutely and the ladder test asserts it. From
    //    his second season there, this rule applies again.
    const prevSeason = state.seasons[state.seasons.indexOf(season) - 1] ?? null;
    const spinoffArrival =
      seasonLeague.market === 'spinoff' && (prevSeason === null || prevSeason.clubId !== season.clubId);
    if (season.onLoanFrom === null && !spinoffArrival && season.overallStart <= seasonBar - 10) {
      // Ceiling from the friendliest tactical fit (+2), then the two rungs the
      // engine allows on top: one of in-season headroom, one for long service.
      const ceiling = roleForDelta(state.player!, season.overallStart - seasonBar + 2);
      const allowed = shiftRole(ceiling, 2);
      check(
        'role-earned',
        'a season never hands out a place ability could not earn',
        roleRank(season.role) <= roleRank(allowed),
        () =>
          `${season.clubId} (${seasonLeague.id}) bar ${seasonBar}, OVR ${season.overallStart} — ` +
          `played as ${season.role}, most it could be is ${allowed}`,
      );
    }

    // 10. Minutes have to follow the role. A star with a substitute's
    //     appearance count means the two halves of the model disagree.
    //
    //     Graded off `appearanceRange` rather than a flat number, because a
    //     goalkeeper's season is close to binary — he is first choice or he is
    //     watching — so a *squad* keeper playing seven games is the model
    //     working, and the same line for an outfielder would be a bug.
    const apps = season.stats.appearances;
    // A debut season is deliberately 3-8 games whatever the role says — see
    // `DEBUT_APPEARANCES`. A sixteen-year-old who joins a small enough club
    // clears its bar and would otherwise be handed thirty appearances, which no
    // career has. The role is still recorded honestly; only the minutes are
    // capped, so this rule has nothing to say about the first row.
    // A banned season plays zero by definition — "no minutes, no silverware,
    // no growth" — so the role's appearance promise is void for that row, the
    // same way a long injury already voids it.
    if (season.index > 0 && season.injuryWeeks < 8 && !season.suspended) {
      const [low, high] = appearanceRange(season.role, isGoalkeeper);
      check(
        'minutes-match-role',
        'appearances track the squad role they were meant to buy',
        apps >= Math.floor(low * 0.75) && apps <= high + 8,
        () => `${season.role} wants ${low}–${high} but played ${apps} at ${season.clubId}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Playing like a player
// ---------------------------------------------------------------------------

/**
 * A plausible human: takes the best offer in front of him most of the time,
 * and picks at random the rest, so the audit sees ambitious careers and drifting
 * ones alike. Pure ambition would only ever exercise the top of the ladder.
 */
function choose(state: CareerState, rng: () => number): string {
  const INDEX = indexFor(state);
  const options = state.pending!.options;
  if (rng() < 0.3) return options[Math.floor(rng() * options.length)]!.id;

  const scored = options.map((option) => {
    if (!option.clubId || !option.offer) return { id: option.id, score: -1 };
    const club = INDEX.club(option.clubId);
    const league = INDEX.leagueOfClub(club.id);
    return {
      id: option.id,
      score: club.reputation + league.strength * 25 + roleRank(option.offer.promisedRole) * 4,
    };
  });
  const best = scored.reduce((a, b) => (a.score >= b.score ? a : b));
  return best.score < 0 ? options[Math.floor(rng() * options.length)]!.id : best.id;
}

function runCareer(i: number): void {
  const rng = mulberry32(i * 2654435761 + 7);
  const country = COUNTRIES[Math.floor(rng() * COUNTRIES.length)]!;
  let state = selectIdentity(
    createCareer(`audit-${i}`, PACE),
    {
      lastName: 'Test',
      shirtNumber: 9,
      foot: rng() < 0.25 ? 'left' : 'right',
      countryId: country.id,
      position: PLAYABLE_POSITIONS[Math.floor(rng() * PLAYABLE_POSITIONS.length)] as Position,
      archetype: ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)]!,
    },
    WORLD,
  );

  let guard = 0;
  while (state.pending && guard < 600) {
    auditDecision(state);
    state = decide(state, choose(state, rng), WORLD);
    guard += 1;
  }
  auditSeasons(state);
}

// ---------------------------------------------------------------------------

const started = Date.now();
for (let i = 0; i < RUNS; i += 1) runCareer(i);

console.log(`\n  ${RUNS} careers played as a player would · pace=${PACE} · ${Date.now() - started}ms\n`);

let failed = 0;
for (const r of RULES.values()) {
  const rate = r.seen === 0 ? 0 : (r.hits / r.seen) * 100;
  const mark = r.hits === 0 ? '✓' : r.soft ? '·' : '✗';
  if (r.hits > 0 && !r.soft) failed += 1;
  console.log(
    `  ${mark} ${r.what}\n      ${r.seen.toLocaleString()} checked · ${r.hits.toLocaleString()} bad (${rate.toFixed(2)}%)`,
  );
  for (const example of r.examples) console.log(`      → ${example}`);
}

console.log(failed === 0 ? '\n  Every rule holds.\n' : `\n  ${failed} rule(s) violated.\n`);
process.exit(failed === 0 ? 0 : 1);
