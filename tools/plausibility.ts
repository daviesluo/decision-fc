/**
 * Is the career a football story a fan would believe?
 *
 * Every other suite checks a *mechanism* — the odds are real, the offers are
 * coherent, the numbers stay in bounds. None of them read the career the way
 * a person does: as a story. Which is how a promoted Southampton winning the
 * Premier League the very next season sailed through a 3,200-career sweep that
 * was busy checking column widths — the stats were all in range; the *story*
 * was nonsense.
 *
 * So this suite plays careers and audits the story, season by season:
 * champions must come from the top of the division they actually play in,
 * promoted clubs do not lift the title the following May, relegation sends a
 * club down a division in fact and not just in a flag, a ban voids the year,
 * Europe is only won from inside Europe. Hard rules fail the build; the
 * distribution prints alongside so a drift that stays inside the rules is
 * still visible to a reader.
 *
 * Usage:
 *   pnpm plausibility                 # the report
 *   pnpm plausibility --assert       # …and fail the build on any violation
 *   pnpm plausibility --runs=4000
 */

import { WORLD } from '../packages/content/src/index.js';
import {
  clubStanding,
  continentalEntry,
  createCareer,
  decide,
  indexWorld,
  mulberry32,
  roleRank,
  selectIdentity,
  PLAYABLE_POSITIONS,
  type CareerState,
  type Position,
  type SeasonRecord,
} from '../packages/engine/src/index.js';
import { COUNTRIES } from '../packages/content/src/data/countries.js';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const RUNS = Number(arg('runs') ?? 1500);
const ASSERT = process.argv.includes('--assert');

interface Rule {
  title: string;
  checked: number;
  bad: number;
  examples: string[];
}
const rules = new Map<string, Rule>();
function check(id: string, title: string, ok: boolean, detail: () => string): void {
  let rule = rules.get(id);
  if (!rule) {
    rule = { title, checked: 0, bad: 0, examples: [] };
    rules.set(id, rule);
  }
  rule.checked += 1;
  if (!ok) {
    rule.bad += 1;
    if (rule.examples.length < 4) rule.examples.push(detail());
  }
}

const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

// Distributions worth reading even when every rule holds.
const championsByStanding = new Map<string, number>();
const promotedNextSeason = new Map<string, number>();

let careers = 0;
let seasonsAudited = 0;

for (let i = 0; i < RUNS; i += 1) {
  const setup = mulberry32(i * 2654435761 + 7);
  let state: CareerState = selectIdentity(
    createCareer(`plausibility-${i}`, (['standard', 'quick', 'deep'] as const)[i % 3]!),
    {
      lastName: 'Test',
      shirtNumber: 9,
      foot: setup() < 0.25 ? 'left' : 'right',
      countryId: COUNTRIES[Math.floor(setup() * COUNTRIES.length)]!.id,
      position: PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length] as Position,
      archetype: (['pace', 'technical', 'physical'] as const)[i % 3]!,
    },
    WORLD,
  );
  const rng = mulberry32(i * 40503 + 11);
  let guard = 0;
  while (state.pending && guard < 600) {
    guard += 1;
    const options = state.pending.options;
    state = decide(state, options[Math.floor(rng() * options.length)]!.id, WORLD);
  }
  careers += 1;

  // The index that knows every division change this career produced; standing
  // questions are asked of the division the club played in that season.
  const index = indexWorld(WORLD, state.leagueMoves, state.managerChanges);
  const seasons = state.seasons;
  let prev: SeasonRecord | null = null;

  for (const r of seasons) {
    seasonsAudited += 1;
    const club = index.club(r.clubId);
    const league = index.league(r.leagueId);
    const standing = clubStanding(club, r.leagueId, WORLD);
    const at = `career ${i}, age ${r.age}, ${r.clubId} in ${r.leagueId}`;
    const wonLeague = r.trophies.includes('league');

    // -- The champion has to be believable -------------------------------
    if (wonLeague && league.tier === 1) {
      bump(championsByStanding, standing);
      // A club in the relegation scrap never wins the league — no exception,
      // no star carry. Mid-table champions are the Leicester story: they must
      // exist and they must be rare, which is a rate (asserted below), not a
      // per-instance rule.
      check(
        'champion-standing',
        'a top-flight title never goes to a club in the relegation fight',
        standing !== 'survival',
        () => `${at}: champions from the ${standing} band (player ${r.overallStart})`,
      );
    }
    // Straight back up and straight to the title is a real thing — for a
    // giant. Kaiserslautern won the Bundesliga as a promoted club in 1998;
    // promoted Southampton winning the Premier League is not that story, and
    // the standing of the division they came up to is what separates the two.
    check(
      'promoted-champions',
      'a club fresh from promotion only wins the top flight if it belongs at the top',
      !(prev && prev.promoted && prev.clubId === r.clubId && wonLeague) ||
        standing === 'title' ||
        standing === 'european',
      () => `${at}: ${standing}-band champions one season after going up`,
    );

    // -- Divisions move in fact, not just in a flag ----------------------
    check(
      'promotion-tier',
      'promotion only happens below the top flight, relegation only inside it',
      (!r.promoted || league.tier > 1) && (!r.relegated || league.tier === 1),
      () => `${at}: promoted=${r.promoted} relegated=${r.relegated} in tier ${league.tier}`,
    );
    if (prev && prev.clubId === r.clubId && r.onLoanFrom === null && prev.onLoanFrom === null) {
      const prevLeague = index.league(prev.leagueId);
      if (prev.promoted) {
        check(
          'promotion-lands',
          'a promoted club actually plays the next season a division up',
          league.tier === prevLeague.tier - 1 || league.id !== prev.leagueId,
          () => `${at}: still in ${prev!.leagueId} the season after promotion`,
        );
        bump(promotedNextSeason, r.relegated ? 'straight back down' : r.trophies.length ? 'silverware' : standing);
      }
      if (prev.relegated) {
        check(
          'relegation-lands',
          'a relegated club actually plays the next season a division down',
          league.tier === prevLeague.tier + 1 || league.id !== prev.leagueId,
          () => `${at}: still in ${prev!.leagueId} the season after relegation`,
        );
      }
    }

    // -- An honour is earned on the pitch it is named after ---------------
    //
    // The one that shipped: a Bayern season of two starts and four off the
    // bench carried a league Team of the Season medal, because the twelve-game
    // floor was being applied to club *and* international appearances added
    // together. A league award is a league award — these read the club season
    // and nothing else.
    const apps = r.stats.appearances;
    check(
      'award-minutes',
      'a league honour needs a league season behind it',
      !r.awards.includes('team_of_the_season') || apps >= 25,
      () => `${at}: team of the season on ${apps} club appearances`,
    );
    check(
      'golden-boot-minutes',
      'the Golden Boot is won across a campaign, not in a cameo',
      !r.awards.includes('golden_boot') || apps >= 22,
      () => `${at}: golden boot on ${apps} club appearances (${r.stats.goals} goals)`,
    );
    check(
      'golden-glove-keeper',
      'the Golden Glove goes to a keeper who played most of the season',
      !r.awards.includes('golden_glove') || (r.position === 'GK' && apps >= 25),
      () => `${at}: golden glove as ${r.position} on ${apps} appearances`,
    );
    check(
      'ballon-dor-season',
      'the Ballon d\'Or needs an elite player playing an elite season',
      !r.awards.includes('ballon_dor') || (apps >= 25 && r.overallEnd >= 84),
      () => `${at}: ballon d'or on ${apps} appearances at ${r.overallEnd} overall`,
    );
    check(
      'suspended-season-is-empty',
      'a banned season records no minutes, no silverware and no honours',
      !r.suspended || (apps === 0 && r.trophies.length === 0 && r.awards.length === 0),
      () => `${at}: banned with ${apps} apps, ${r.trophies.length} trophies, ${r.awards.length} awards`,
    );
    // Clean sheets are a team fact and a defender shares them, so only the
    // goalkeeper half of this is a rule. The first version asserted both and
    // found 7,608 centre-backs keeping clean sheets, which is football.
    check(
      'keeper-scores-nothing',
      'goalkeepers do not score',
      r.position !== 'GK' || r.stats.goals === 0,
      () => `${at}: GK with ${r.stats.goals} goals`,
    );
    check(
      'clean-sheets-fit-the-season',
      'a keeper cannot keep more clean sheets than he played games',
      r.stats.cleanSheets <= apps,
      () => `${at}: ${r.stats.cleanSheets} clean sheets in ${apps} games`,
    );
    check(
      'silverware-needs-a-season',
      'a medal needs at least one appearance in the season that won it',
      r.trophies.length === 0 || apps > 0 || (r.nationalStats?.appearances ?? 0) > 0,
      () => `${at}: ${r.trophies.join('+')} without playing`,
    );

    // -- Europe is won from inside Europe --------------------------------
    const continental = continentalEntry(club, league, WORLD);
    check(
      'europe-entitlement',
      'continental silverware only goes to a club that qualified for the competition',
      (!r.trophies.includes('continental_elite') || continental === 'elite') &&
        (!r.trophies.includes('continental_secondary') || continental !== null) &&
        (!r.trophies.includes('club_world_cup') || r.trophies.includes('continental_elite')),
      () => `${at}: won ${r.trophies.join('+')} with entry ${continental ?? 'none'}`,
    );

    // -- A season the rules void stays void ------------------------------
    check(
      'ban-voids-season',
      'a banned season has no minutes, no silverware, no award and no pay',
      !r.suspended ||
        (r.stats.appearances === 0 && r.trophies.length === 0 && r.awards.length === 0 && r.earnings === 0),
      () => `${at}: banned but apps=${r.stats.appearances} trophies=${r.trophies.length} pay=${r.earnings}`,
    );
    // Club trophies only: the World Cup a player lifts in July belongs to his
    // country's summer, and his club going down does not void it.
    const clubTrophies = r.trophies.filter((t) => t !== 'world_cup' && t !== 'continental_nations');
    check(
      'relegated-no-trophy',
      'a relegated season carries no club trophy',
      !r.relegated || clubTrophies.length === 0,
      () => `${at}: relegated with ${clubTrophies.join('+')}`,
    );

    // -- The person stays a person ---------------------------------------
    check(
      'age-continuity',
      'seasons age one year at a time',
      !prev || r.age === prev.age + 1,
      () => `${at}: after age ${prev?.age}`,
    );
    check(
      'no-cliff',
      'no season strips more rating than the cap allows',
      r.overallStart - r.overallEnd <= 7,
      () => `${at}: ${r.overallStart} → ${r.overallEnd}`,
    );
    // An 82→64 in play: within-row caps held while event cards spent rating
    // *between* the rows, so consecutive table lines still fell off a cliff.
    // The floor is row-to-row, on the numbers the table actually prints.
    check(
      'no-cliff-between-rows',
      'consecutive career rows never drop more than 8 rating (position switches reprice honestly)',
      !prev || prev.overallEnd - r.overallEnd <= 8 || r.position !== prev.position,
      () => `${at}: row closed ${prev?.overallEnd} → row closed ${r.overallEnd}`,
    );
    check(
      'stat-sanity',
      'a season line reads like football',
      r.stats.appearances <= 55 &&
        (r.stats.appearances === 0 || (r.stats.rating >= 4 && r.stats.rating <= 10)) &&
        r.stats.cleanSheets <= r.stats.appearances &&
        (r.position === 'GK' ? r.stats.goals <= 1 : r.stats.saves === 0),
      () => `${at}: apps=${r.stats.appearances} rating=${r.stats.rating} goals=${r.stats.goals} saves=${r.stats.saves}`,
    );
    if (r.index === 0) {
      check(
        'debut-minutes',
        'a sixteen-year-old debut season is a handful of games',
        r.stats.appearances <= 8,
        () => `${at}: ${r.stats.appearances} appearances at 16`,
      );
    }
    if (r.nationalStats) {
      check(
        'national-sanity',
        'an international season reads like one',
        r.age >= 17 && r.nationalStats.appearances <= 20 && (r.position !== 'GK' || r.nationalStats.goals === 0),
        () => `${at}: age ${r.age}, ${r.nationalStats!.appearances} caps, GK goals ${r.nationalStats!.goals}`,
      );
    }
    check(
      'loans-stay-european',
      'a loan stays inside the European pyramid',
      r.onLoanFrom === null || index.country(league.countryId).confederation === 'UEFA',
      () => `${at}: on loan in ${league.id}`,
    );
    // A spin-off league buys a name, not a squad body: the card promises at
    // least an important player (the market suite holds that line) and the
    // arrival season delivers it — absolutely, over event cards too. Only a
    // ban overrides, because a banned season is fringe by law.
    if (league.market === 'spinoff' && (!prev || prev.clubId !== r.clubId) && !r.suspended) {
      check(
        'spinoff-arrival-role',
        'a spin-off arrival plays as at least an important player',
        roleRank(r.role) >= roleRank('important'),
        () => `${at}: arrived as ${r.role}`,
      );
    }

    prev = r;
  }

  // Nobody good is forced out young because the window came up empty — below
  // the retirement age the last-resort pool registers him somewhere, so a
  // forced retirement can only be a 35-plus veteran (his last table row reads
  // 34 or older) whom the market genuinely stopped calling — never a player
  // still good enough that somebody would.
  const last = seasons[seasons.length - 1];
  if (state.retirement?.reasonKey === 'retirement.no_offers' && last) {
    check(
      'forced-retirement',
      'a "no offers" retirement only takes a 35-plus veteran the market stopped calling',
      // Age first: under 35 the last-resort pool must have caught him. The
      // ability cap is loose on purpose — a 37-year-old on 67 nobody calls is
      // ordinary football; a 35-year-old on 70+ being told nobody wants him
      // is not.
      last.age >= 34 && last.overallEnd < 70,
      () => `career ${i}: forced out after his age-${last.age} season with overall ${last.overallEnd}`,
    );
  }
}

// ---------------------------------------------------------------------------

// The Leicester rate: mid-table champions must exist (the superstar-carry
// mechanic is designed to produce them) and must stay a once-an-era story —
// a per-instance rule cannot say "rare", so this one is a rate.
{
  const total = [...championsByStanding.values()].reduce((a, b) => a + b, 0);
  const midtable = championsByStanding.get('midtable') ?? 0;
  check(
    'midtable-rate',
    'mid-table champions stay a rarity (≤2% of top-flight titles)',
    total === 0 || midtable / total <= 0.02,
    () => `${midtable} of ${total} titles (${((midtable / total) * 100).toFixed(2)}%)`,
  );
}

console.log(`\n  ${careers} careers · ${seasonsAudited} seasons audited\n`);
let violated = 0;
for (const rule of rules.values()) {
  const flag = rule.bad === 0 ? '✓' : '✗';
  console.log(`  ${flag} ${rule.title}`);
  console.log(`      ${rule.checked.toLocaleString()} checked · ${rule.bad} bad`);
  for (const example of rule.examples) console.log(`      → ${example}`);
  if (rule.bad > 0) violated += 1;
}

console.log('\n  top-flight champions by their own division standing:');
for (const [standing, count] of [...championsByStanding.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`      ${standing.padEnd(10)} ${count}`);
}
console.log('\n  the season after promotion:');
for (const [fate, count] of [...promotedNextSeason.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`      ${fate.padEnd(18)} ${count}`);
}

if (violated > 0) {
  console.log(`\n  ${violated} rule(s) violated.\n`);
  if (ASSERT) process.exit(1);
} else {
  console.log('\n  Every story rule holds.\n');
}
