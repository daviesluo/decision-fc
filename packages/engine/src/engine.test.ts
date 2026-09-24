import { describe, expect, it } from 'vitest';
import { WORLD } from '@bg/content';
import {
  computeLegacy,
  computeOverall,
  continentalEntry,
  continentalOdds,
  createCareer,
  cupOdds,
  decide,
  CARD_SLOTS,
  EMPTY_MODIFIERS,
  ENDINGS,
  simulateSeason,
  simulateTrophies,
  weightedPick,
  type DecisionKind,
  indexWorld,
  leagueOdds,
  trophyField,
  clubStanding,
  formScore,
  standingFactor,
  marketValue,
  type MarketForm,
  mulberry32,
  PACE_EFFECT_SCALE,
  WINDOW_SPREAD,
  POSITIONS,
  replay,
  rngFor,
  selectIdentity,
  promisableRole,
  roleCapOnLoan,
  LOAN_GUARANTEE,
  roleCeiling,
  roleRank,
  shiftRole,
  roleForDelta,
  ROLE_ORDER,
  starterBar,
  withinOfferReach,
  tacticalFit,
  suitableStyles,
  transferFee,
  type CareerState,
  type Club,
  type SeasonRecord,
  type IdentityInput,
  type ManagerStyle,
  type Pace,
  type Position,
} from './index.js';
import { loanDestinations, loanSpellsOf } from './career/loans.js';
import { minutesGrowthMultiplier } from './model/growth.js';

const IDENTITY: IdentityInput = {
  lastName: 'Tester',
  shirtNumber: 10,
  foot: 'right',
  countryId: 'eng',
  position: 'ST',
  archetype: 'technical',
};

/** A player of an exact rating, for assertions about the squad ladder. */
const striker = (overall: number) => ({
  lastName: 'X', shirtNumber: 9, foot: 'right' as const, countryId: 'eng',
  position: 'ST' as const, age: 25, archetype: 'technical' as const,
  attributes: { pace: overall, shooting: overall, passing: overall, dribbling: overall, defending: overall, physical: overall },
  hidden: { developmentProfile: 'normal' as const, consistency: 60, injuryProneness: 40 },
  personality: 'resolute' as const, dopingBan: false, overall, marketValue: 1_000_000,
});

/** Play a whole career, always taking the option at `chooser`. */
function playThrough(
  seed: string,
  chooser: (state: CareerState) => number,
  setup: { pace?: Pace; identity?: Partial<IdentityInput> } = {},
): CareerState {
  const identity = { ...IDENTITY, ...setup.identity };
  let state = selectIdentity(createCareer(seed, setup.pace ?? 'standard'), identity, WORLD);
  let guard = 0;
  while (state.pending && guard < 300) {
    const index = chooser(state);
    const option = state.pending.options[index % state.pending.options.length]!;
    state = decide(state, option.id, WORLD);
    guard += 1;
  }
  return state;
}

describe('determinism', () => {
  it('produces an identical career for the same seed and the same choices', () => {
    const a = playThrough('seed-alpha', () => 0);
    const b = playThrough('seed-alpha', () => 0);
    expect(b.totals).toEqual(a.totals);
    expect(b.retirement).toEqual(a.retirement);
    expect(b.seasons.map((s) => s.overallEnd)).toEqual(a.seasons.map((s) => s.overallEnd));
  });

  it('produces different careers for different seeds', () => {
    // Deliberately not comparing club lists: always taking option 0 means
    // always taking "stay", so two seeds can legitimately share a one-club
    // career at the same academy. The trajectory is what must differ.
    const scores = new Set(
      Array.from({ length: 12 }, (_, i) => playThrough(`vary-${i}`, () => 0))
        .map((s) => `${s.retirement?.legacyScore}:${s.totals.peakOverall}:${s.seasons.length}`),
    );
    expect(scores.size).toBeGreaterThan(9);
  });

  it('replays a recorded decision list back to the same result', () => {
    const original = playThrough('seed-replay', (s) => s.seasons.length);
    const optionIds = original.history.map((entry) => entry.optionId);
    const replayed = replay('seed-replay', 'standard', IDENTITY, optionIds, WORLD);
    // This is the property the leaderboard's anti-cheat depends on: a submitted
    // seed plus decision list must reproduce the submitted score exactly.
    expect(replayed.retirement?.legacyScore).toBe(original.retirement?.legacyScore);
    expect(replayed.totals.grossEarnings).toBe(original.totals.grossEarnings);
    expect(replayed.totals.transferFees).toBe(original.totals.transferFees);
  });

  /**
   * The invariant the whole leaderboard rests on: a career is a function of
   * `seed + identity + decisions` and nothing else. One `Math.random()` on any
   * branch and the server's replay quietly disagrees with the player's screen,
   * and a run nobody cheated on is rejected.
   *
   * This used to play a single career always taking option 1, which meant any
   * impurity on a branch that path did not reach passed unnoticed — and the
   * branches it did not reach are most of them: loans, spin-off moves, the
   * retirement fork, the injury events. So it now sweeps seeds, paces,
   * positions and choice policies. The first policy walks the top option, the
   * second the bottom, the third a seeded pseudo-random one — seeded, because a
   * purity test that is itself non-deterministic reports a different failure
   * every run.
   */
  it('never consults the clock or the global RNG, on any path', () => {
    const realRandom = Math.random;
    const realNow = Date.now;
    const realPerfNow = performance.now;
    Math.random = () => {
      throw new Error('engine must not call Math.random');
    };
    Date.now = () => {
      throw new Error('engine must not read the clock');
    };
    performance.now = () => {
      throw new Error('engine must not read the clock');
    };

    const paces: Pace[] = ['quick', 'standard', 'deep'];
    const positions: Position[] = ['GK', 'CB', 'CM', 'ST'];
    try {
      for (let i = 0; i < 12; i += 1) {
        const seed = `seed-pure-${i}`;
        // A generator per career, drawn from the engine's own RNG so the
        // sequence is fixed and a failure is reproducible from the seed alone.
        const roll = rngFor(seed, 'choices');
        const policies: ((state: CareerState) => number)[] = [
          () => 0,
          (state) => state.pending!.options.length - 1,
          (state) => Math.floor(roll() * state.pending!.options.length),
        ];
        for (const chooser of policies) {
          const setup = {
            pace: paces[i % paces.length]!,
            identity: {
              position: positions[i % positions.length]!,
              // Country and player type both branch: nationality picks the
              // national-team ladder, the type reshapes development.
              countryId: i % 2 === 0 ? 'eng' : 'bra',
              archetype: (['pace', 'technical', 'physical'] as const)[i % 3]!,
            },
          };
          expect(() => playThrough(seed, chooser, setup), `${seed} / ${setup.pace}`).not.toThrow();
        }
      }
    } finally {
      Math.random = realRandom;
      Date.now = realNow;
      performance.now = realPerfNow;
    }
  });
});

describe('rng', () => {
  it('gives independent streams per channel', () => {
    const a = Array.from({ length: 5 }, rngFor('s', 'one'));
    const b = Array.from({ length: 5 }, rngFor('s', 'two'));
    expect(a).not.toEqual(b);
  });

  it('is stable for the same channel', () => {
    expect(Array.from({ length: 5 }, rngFor('s', 'one'))).toEqual(
      Array.from({ length: 5 }, rngFor('s', 'one')),
    );
  });

  it('stays inside [0, 1)', () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 5000; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('attributes', () => {
  it('re-rates the same player differently by position', () => {
    const attributes = {
      pace: 85, shooting: 88, passing: 55, dribbling: 82, defending: 30, physical: 70,
    };
    const asStriker = computeOverall(attributes, 'ST');
    const asCentreBack = computeOverall(attributes, 'CB');
    // A positional switch has to have a real cost, not a flat penalty.
    expect(asStriker).toBeGreaterThan(asCentreBack + 10);
  });

  it('keeps every position weighting normalised', () => {
    for (const position of POSITIONS) {
      const perfect = computeOverall(
        { pace: 99, shooting: 99, passing: 99, dribbling: 99, defending: 99, physical: 99 },
        position,
      );
      expect(perfect).toBe(99);
    }
  });
});

describe('player type', () => {
  const TYPES = ['pace', 'technical', 'physical'] as const;

  it('gives no type a head start', () => {
    // The pitch says the three types are the same player shaped differently.
    // If one of them simply started on a better rating that would be a lie,
    // and the choice would be a trap for anyone who read the pros and cons.
    for (const position of ['ST', 'CB', 'CM', 'GK'] as const) {
      const ratings = TYPES.map(
        (archetype) =>
          selectIdentity(createCareer('type-fair', 'standard'), { ...IDENTITY, position, archetype }, WORLD)
            .player!.overall,
      );
      expect(new Set(ratings).size).toBe(1);
    }
  });

  it('shapes the six attributes differently', () => {
    const [quick, technical, physical] = TYPES.map(
      (archetype) =>
        selectIdentity(createCareer('type-shape', 'standard'), { ...IDENTITY, archetype }, WORLD).player!.attributes,
    );
    expect(quick!.pace).toBeGreaterThan(technical!.pace);
    expect(technical!.passing).toBeGreaterThan(quick!.passing);
    expect(physical!.physical).toBeGreaterThan(quick!.physical);
  });

  it('trades when a career peaks, not how much it is worth', () => {
    // The pitch is "ahead early, level in the end". Both halves are asserted,
    // because the first draft of the tilt table delivered only the first half
    // and quietly made the quick player the correct answer for everyone.
    const sample = (archetype: (typeof TYPES)[number]) => {
      let early = 0;
      let legacy = 0;
      let runs = 0;
      // Sixty was too few to say anything. The loan rework moved which careers
      // land where, and the sixty-career spread jumped to 1.245 while the
      // 300-career spread sat at 1.108 — the guard was reading its own noise.
      // Widening the band would have hidden a real regression next time; taking
      // more samples is what actually makes the number mean something. 150 is
      // ~3s and lands at 1.16.
      for (let i = 0; i < 150; i += 1) {
        const position = POSITIONS[i % POSITIONS.length]!;
        let state = selectIdentity(
          createCareer(`type-arc-${i}`, 'standard'),
          { ...IDENTITY, position, archetype },
          WORLD,
        );
        let guard = 0;
        while (state.pending && guard < 300) {
          state = decide(state, state.pending.options[0]!.id, WORLD);
          guard += 1;
        }
        const young = state.seasons.filter((s) => s.age <= 22).map((s) => s.overallEnd);
        if (young.length === 0) continue;
        early += Math.max(...young);
        legacy += state.retirement?.legacyScore ?? 0;
        runs += 1;
      }
      return { early: early / runs, legacy: legacy / runs };
    };

    const quick = sample('pace');
    const technical = sample('technical');
    const strong = sample('physical');

    // Ahead early: the quick player is the better twenty-two-year-old.
    expect(quick.early).toBeGreaterThan(technical.early);

    // Level in the end. A wide band, because sixty careers is a small sample
    // and this guards against a re-tune going badly wrong, not against drift —
    // the real calibration is the 420-career sweep documented in growth.ts.
    const legacies = [quick.legacy, technical.legacy, strong.legacy];
    const spread = Math.max(...legacies) / Math.min(...legacies);
    expect(spread).toBeLessThan(1.2);
  });
});

describe('tactical fit', () => {
  /*
   * The rule since 2026-09-23: the card no longer says whether a club's
   * football suits the player — that read is his — but every transfer window
   * has to have one that does. "Suits" is `suitableStyles`: his best system
   * and anything close to it, widened until at least 48 clubs play one of
   * them. The engine goes one step further for the rare window at the very
   * top where no club at his level plays any of those (it takes the next best
   * system instead of breaking the window's level), so the floor asserted
   * here is 99% rather than every single window.
   */
  it('offers a club whose football suits him in every transfer window', () => {
    const positions: Position[] = ['ST', 'LW', 'RW', 'CAM', 'CM', 'CDM', 'CB', 'LB', 'RB', 'GK'];
    const archetypes = ['pace', 'technical', 'physical'] as const;
    let windows = 0;
    let covered = 0;
    for (let i = 0; i < 120; i += 1) {
      const pace = (['quick', 'standard', 'deep'] as Pace[])[i % 3]!;
      let state: CareerState = selectIdentity(
        createCareer(`fit-window-${i}`, pace),
        { ...IDENTITY, position: positions[i % positions.length]!, archetype: archetypes[Math.floor(i / 10) % 3]! },
        WORLD,
      );
      const rng = mulberry32(4400 + i);
      for (let guard = 0; state.pending && guard < 400; guard += 1) {
        const decision = state.pending;
        if (decision.kind === 'transfer' && state.player) {
          const index = indexWorld(WORLD, state.leagueMoves, state.managerChanges);
          const suits = suitableStyles(state.player, WORLD.clubs.map((club) => index.club(club.id).managerStyle));
          const clubs = decision.options.filter((o) => o.clubId && /^(transfer|stay):/.test(o.id));
          if (clubs.length > 0) {
            windows += 1;
            if (clubs.some((o) => suits.has(index.club(o.clubId!).managerStyle))) covered += 1;
          }
        }
        state = decide(state, decision.options[Math.floor(rng() * decision.options.length)]!.id, WORLD);
      }
    }
    expect(windows).toBeGreaterThan(500);
    expect(covered / windows).toBeGreaterThanOrEqual(0.99);
  });

  it('never leaves a player with only a handful of clubs that suit him', () => {
    const styles = WORLD.clubs.map((club) => club.managerStyle);
    const count = (set: Set<ManagerStyle>) => styles.filter((style) => set.has(style)).length;
    const base = { pace: 60, shooting: 60, passing: 60, dribbling: 60, defending: 60, physical: 60 };
    // A winger's best system is wing play, which seventeen clubs play; a
    // centre-back's, a pressing or deep side. Every profile gets a quarter of
    // the world at least.
    for (const attributes of [
      { ...base, pace: 90, dribbling: 88, physical: 70, defending: 30 },
      { ...base, passing: 90, dribbling: 80, pace: 45 },
      { ...base, defending: 88, physical: 85, dribbling: 35 },
      { ...base, pace: 85, shooting: 88, passing: 40 },
    ]) {
      const player = { attributes } as Parameters<typeof suitableStyles>[0];
      expect(count(suitableStyles(player, styles))).toBeGreaterThanOrEqual(48);
    }
  });

  it('rewards a pacey forward under a counter-attacking manager over a possession one', () => {
    const index = indexWorld(WORLD);
    const player = {
      lastName: 'X', shirtNumber: 9, foot: 'right' as const, countryId: 'eng',
      position: 'ST' as const, age: 25, archetype: 'pace' as const,
      attributes: { pace: 92, shooting: 84, passing: 45, dribbling: 78, defending: 25, physical: 80 },
      hidden: { developmentProfile: 'normal' as const, consistency: 60, injuryProneness: 40 },
      personality: 'resolute' as const, dopingBan: false, overall: 80, marketValue: 0,
    };
    const counterFit = tacticalFit(player, index.club('real-madrid')); // counter
    const possessionFit = tacticalFit(player, index.club('man-city')); // possession
    expect(counterFit).toBeGreaterThan(possessionFit);
  });

  it('sets a higher starting bar at a stronger club', () => {
    const index = indexWorld(WORLD);
    expect(starterBar(index.club('man-city'), index.leagueOfClub('man-city'))).toBeGreaterThan(
      starterBar(index.club('eibar'), index.leagueOfClub('eibar')),
    );
  });
});

describe('finance', () => {
  const player = {
    lastName: 'X', shirtNumber: 9, foot: 'right' as const, countryId: 'eng',
    position: 'ST' as const, age: 25, archetype: 'technical' as const,
    attributes: { pace: 80, shooting: 80, passing: 70, dribbling: 78, defending: 30, physical: 75 },
    hidden: { developmentProfile: 'normal' as const, consistency: 60, injuryProneness: 40 },
    personality: 'resolute' as const, dopingBan: false, overall: 80, marketValue: 30_000_000,
  };

  it('values the same player lower in a weaker league', () => {
    expect(marketValue(player, 1.0)).toBeGreaterThan(marketValue(player, 0.42));
  });

  it('charges nothing for a player out of contract', () => {
    const index = indexWorld(WORLD);
    const fee = transferFee(mulberry32(1), player, 0, index.club('chelsea'), 'normal', null);
    expect(fee).toBe(0);
  });

  it('charges more the longer the contract has left', () => {
    const index = indexWorld(WORLD);
    const buyer = index.club('chelsea');
    const short = transferFee(mulberry32(7), player, 1, buyer, 'normal', null);
    const long = transferFee(mulberry32(7), player, 4, buyer, 'normal', null);
    expect(long).toBeGreaterThan(short * 2);
  });
});

describe('career progression', () => {
  it('runs from academy to retirement without stalling', () => {
    const state = playThrough('seed-full', () => 0);
    expect(state.phase).toBe('summary');
    expect(state.seasons.length).toBeGreaterThan(10);
    expect(state.retirement).not.toBeNull();
  });

  it('ages the player exactly one year per season', () => {
    const state = playThrough('seed-age', () => 0);
    const ages = state.seasons.map((s) => s.age);
    for (let i = 1; i < ages.length; i += 1) {
      expect(ages[i]).toBe(ages[i - 1]! + 1);
    }
  });

  it('records a transfer fee at some point in a mobile career', () => {
    // Regression guard: the transfer window used to open only at contract
    // expiry, which silently made every move a free transfer and left the
    // Valuation leaderboard reading zero for every player alive.
    const fees = Array.from({ length: 40 }, (_, i) => playThrough(`fee-${i}`, (s) => s.seasons.length))
      .map((s) => s.totals.transferFees);
    expect(fees.some((fee) => fee > 0)).toBe(true);
  });

  it('lets teenagers develop even without first-team minutes', () => {
    // Regression guard: young players used to be frozen out for being weak and
    // stay weak for being frozen out, so nobody ever reached their potential.
    const peaks = Array.from({ length: 30 }, (_, i) => playThrough(`grow-${i}`, () => 0))
      .map((s) => s.totals.peakOverall);
    const median = peaks.sort((a, b) => a - b)[Math.floor(peaks.length / 2)]!;
    expect(median).toBeGreaterThan(66);
  });

  it('never lets totals go negative', () => {
    const state = playThrough('seed-totals', (s) => s.seasons.length + 1);
    expect(state.cash).toBeGreaterThanOrEqual(0);
    expect(state.totals.grossEarnings).toBeGreaterThanOrEqual(0);
    expect(state.totals.appearances).toBeGreaterThanOrEqual(0);
  });

  it('develops players on a human curve, not on minutes', () => {
    // Regression guard for the arc that broke the game: a teenager who went
    // out on loan, started, and gained a career's worth of ability in two
    // seasons. Development is age and talent; minutes only ever cost you.
    const jumps: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      const state = playThrough(`curve-${i}`, (s) => s.seasons.length);
      for (const season of state.seasons) {
        if (season.age <= 19) jumps.push(season.overallEnd - season.overallStart);
      }
    }
    // The tables allow an early bloomer +16 across the 16→18 cycle, so a
    // single season can legitimately be worth low double figures. What must
    // never come back is the old minutes-driven spike on top of that.
    expect(Math.max(...jumps)).toBeLessThanOrEqual(13);
    const median = jumps.sort((a, b) => a - b)[Math.floor(jumps.length / 2)]!;
    expect(median).toBeLessThanOrEqual(6);
  });

  /**
   * The loan ladder, which is four rules. It is worth pinning all four here
   * because each one has been broken at least once by a change made somewhere
   * else entirely.
   */
  /**
   * Every option on the loan-return card has to actually do what it says.
   *
   * `applyLoanReturn` handled `buyout:` and let everything else fall through to
   * "went back to the parent club" — so the two priced `transfer:` offers on
   * that card, and the next loan spell, were read, considered, chosen, and
   * silently ignored. A player who picked Lyon was handed his old club and his
   * old contract with no explanation. It shipped, and a real player found it.
   *
   * This walks the card and asserts the state moved for each kind of option,
   * because the failure was a missing branch and nothing else could have caught
   * it: no type error, no crash, no console warning — just a decision that did
   * not happen.
   */
  /**
   * Three faults a player reported from one screenshot, pinned so they cannot
   * return. Each was invisible to every other check in this repository.
   */
  it('runs one national cup per country, not one per division', () => {
    const index = indexWorld(WORLD);
    const field = trophyField(WORLD);

    for (const countryId of ['eng', 'esp', 'ita', 'ger', 'fra']) {
      const clubs = WORLD.clubs.filter((c) => index.leagueOfClub(c.id).countryId === countryId);
      // The raw shares, not `cupOdds` — that multiplies in a star player's
      // boost, which is a property of the career rather than of the field.
      const total = clubs.reduce((sum, c) => sum + (field.cup.get(c.id) ?? 0), 0);
      // One competition: every club in the country shares one whole cup. When
      // the field was built per league each tier ran its own, so this summed to
      // the number of divisions — two for all five of these countries, which is
      // why a Championship side lifted the FA Cup about as often as City did.
      expect(total, `${countryId} cup shares`).toBeGreaterThan(0.9);
      expect(total, `${countryId} cup shares`).toBeLessThan(1.1);

      const secondTier = clubs
        .filter((c) => index.leagueOfClub(c.id).tier === 2)
        .reduce((sum, c) => sum + (field.cup.get(c.id) ?? 0), 0);
      // A real but small chance: the romance of the cup, not a coin flip.
      expect(secondTier, `${countryId} second tier`).toBeLessThan(0.12);
    }
  });

  it('does not open renewal talks in the middle of a contract', () => {
    let sawMidContractWindow = false;

    for (let i = 0; i < 60; i += 1) {
      let state = selectIdentity(createCareer(`renew-${i}`, 'standard'), IDENTITY, WORLD);
      let guard = 0;
      while (state.pending && guard < 300) {
        const pending = state.pending;
        // A card that pushed him out is the one case where a mid-contract
        // window legitimately has no way to stay: the club did not decline to
        // renew him, an event ended his time there and said so. Without this
        // the test asserts the opposite of `mustMove`.
        const pushedOut = state.modifiers.forcedTransfer;
        if (pending.kind === 'transfer' && !pushedOut && (state.contract?.yearsRemaining ?? 0) > 2) {
          sawMidContractWindow = true;
          const stay = pending.options.find((o) => o.id.startsWith('stay:'));
          // Staying must still be possible — a club that wants him cannot push
          // him out — but it is the deal he signed, not a new one.
          expect(stay, 'a mid-contract window must still let him stay').toBeDefined();
          expect(stay?.offer, 'no club re-signs a player with three years to run').toBeUndefined();
        }
        state = decide(state, pending.options[guard % pending.options.length]!.id, WORLD);
        guard += 1;
      }
    }

    expect(sawMidContractWindow, 'no mid-contract window was ever reached').toBe(true);
  });

  it('lets a player settle before anyone comes for him', () => {
    for (let i = 0; i < 60; i += 1) {
      let state = selectIdentity(createCareer(`settle-${i}`, 'standard'), IDENTITY, WORLD);
      let guard = 0;

      while (state.pending && guard < 300) {
        const pending = state.pending;
        // The engine counts *consecutive* seasons ending at the current club,
        // which is the same thing said precisely: how long he has been there.
        const clubId = state.contract?.clubId ?? null;
        let seasonsHere = 0;
        for (let k = state.seasons.length - 1; k >= 0; k -= 1) {
          if (state.seasons[k]!.clubId === clubId) seasonsHere += 1;
          else break;
        }
        // A manager change is the one thing that legitimately reopens the
        // question after a single season, and it is the most ordinary story in
        // football: the manager who signed him is sacked in May, the new one
        // has never seen him play, and a player who waits to find out has
        // already lost the summer. It is not the market coming for him — it is
        // his own club becoming a different club — so the settle rule does not
        // apply to it.
        const managerNews = pending.titleKey === 'decisions.manager_change.title';
        if (pending.kind === 'transfer' && (state.contract?.yearsRemaining ?? 0) > 0 && !state.loan && !managerNews) {
          // A window arriving on a deal that is not expiring is the market
          // coming for him, and it must not arrive the season after he signed.
          // The counter used to move only when a *window* opened, so a move made
          // from an event card left it untouched and the market appeared to
          // forget he had just joined.
          expect(seasonsHere, `window after ${seasonsHere} season(s) at the club`).toBeGreaterThanOrEqual(2);
        }
        state = decide(state, pending.options[guard % pending.options.length]!.id, WORLD);
        guard += 1;
      }
    }
  });

  it('honours every option on the loan-return card, not just the buyout', () => {
    let sawTransfer = false;
    let sawLoan = false;
    let sawBuyout = false;

    for (let i = 0; i < 80 && !(sawTransfer && sawLoan && sawBuyout); i += 1) {
      // Take the loan whenever offered, then walk each branch of the return.
      for (const prefix of ['transfer:', 'loan:', 'buyout:'] as const) {
        let state = selectIdentity(createCareer(`loan-return-${i}`, 'standard'), IDENTITY, WORLD);
        let guard = 0;
        while (state.pending && guard < 300) {
          const pending = state.pending;
          if (pending.kind === 'loan_return') {
            const target = pending.options.find((o) => o.id.startsWith(prefix));
            if (target) {
              const before = {
                club: state.contract?.clubId ?? null,
                loanClub: state.loan?.clubId ?? null,
              };
              const after = decide(state, target.id, WORLD);

              if (prefix === 'transfer:') {
                sawTransfer = true;
                // The whole bug: this used to leave him where he was.
                expect(after.contract?.clubId, 'a transfer on the return card must move him').toBe(
                  target.clubId,
                );
                expect(after.contract?.clubId).not.toBe(before.club);
                expect(after.loan).toBeNull();
              } else if (prefix === 'loan:') {
                sawLoan = true;
                expect(after.loan?.clubId, 'a further spell must start at the club offered').toBe(
                  target.clubId,
                );
                expect(after.loan?.clubId).not.toBe(before.loanClub);
                // The parent deal is untouched by a loan.
                expect(after.contract?.clubId).toBe(before.club);
              } else {
                sawBuyout = true;
                expect(after.contract?.clubId).toBe(target.clubId);
                expect(after.loan).toBeNull();
              }
              break;
            }
          }
          const index = pending.kind === 'loan' ? 0 : state.seasons.length;
          state = decide(state, pending.options[index % pending.options.length]!.id, WORLD);
          guard += 1;
        }
      }
    }

    // If the harness never reached a branch the assertions above prove nothing.
    expect(sawTransfer, 'no loan-return card ever offered a transfer').toBe(true);
    expect(sawBuyout, 'no loan-return card ever offered a permanent signing').toBe(true);
    expect(sawLoan, 'no loan-return card ever offered a further spell').toBe(true);
  });

  /**
   * A ladder whose lower rung stays on the board is not a ladder.
   *
   * Every destination on a loan card has already passed "would start for
   * them", so once a big-five top flight is among them, a second-tier club
   * beside it is strictly the worse version of the same season. Before this
   * rule, **every** proving-rung card that reached the top flight also carried
   * a second-tier side: 56 of 56 over 1,500 careers.
   */
  it('stops offering the second tier once he can start in a top flight', () => {
    const BIG_FIVE = new Set(['eng', 'esp', 'ita', 'ger', 'fra']);
    let sawProvingCard = false;

    for (let i = 0; i < 120; i += 1) {
      let state = selectIdentity(createCareer(`ladder-${i}`, 'standard'), IDENTITY, WORLD);
      let guard = 0;
      while (state.pending && guard < 300) {
        if (state.pending.kind === 'loan') {
          // The proving rung, defined exactly as `loanRung` defines it: at
          // least one spell already begun at eighteen or later.
          const senior = loanSpellsOf(state.seasons).filter((s) => s.startAge >= 18).length;
          /*
           * Through the career's own index, not the world's.
           * Divisions move: a club promoted during this career is in the top
           * flight *now*, and reading its opening league — the most-repeated
           * bug in this repo, and the reason `world-index` exists — made the
           * test call a Bundesliga side a second-tier one and fail a card the
           * engine had filtered correctly.
           */
          const index = indexWorld(WORLD, state.leagueMoves, state.managerChanges);
          const leagues = state.pending.options
            .filter((o) => o.clubId)
            .map((o) => index.leagueOfClub(o.clubId!));
          const topFlight = leagues.filter((l) => l.tier === 1 && BIG_FIVE.has(l.countryId));
          const secondTier = leagues.filter((l) => l.tier === 2 && BIG_FIVE.has(l.countryId));
          if (senior >= 1 && topFlight.length > 0) {
            sawProvingCard = true;
            expect(
              secondTier.map((l) => l.id),
              `card offered ${topFlight[0]!.id} and a second tier together`,
            ).toEqual([]);
          }
        }
        // Take the loan whenever it is offered, so the ladder is walked.
        const slot = state.pending.kind === 'loan' ? 0 : state.seasons.length;
        state = decide(state, state.pending.options[slot % state.pending.options.length]!.id, WORLD);
        guard += 1;
      }
    }

    expect(sawProvingCard, 'no career ever reached a proving-rung card with a top-flight club').toBe(true);
  });

  /**
   * Answering "I am seeing this contract out" must not be followed by "would
   * you like to leave?".
   *
   * Before the state remembered the decision, 457 of 2,231 run-downs over
   * 2,000 careers were followed immediately by a card carrying a move — one in
   * five, and a Gulf approach as often as not.
   */
  it('never offers a move to a player who has just chosen to run his deal down', () => {
    let runouts = 0;
    for (let i = 0; i < 150; i += 1) {
      let state = selectIdentity(createCareer(`rundown-${i}`, 'standard'), IDENTITY, WORLD);
      let guard = 0;
      let justRanDown = false;
      while (state.pending && guard < 300) {
        if (justRanDown) {
          const move = state.pending.options.find((o) => o.id.includes(':join:'));
          expect(move?.id, 'a move was offered the card after a run-down').toBeUndefined();
          justRanDown = false;
        }
        const options = state.pending.options;
        // Take the run-down whenever it is on the card, to reach the case.
        const runout = options.find((o) => o.id.startsWith('runout:'));
        if (runout) {
          runouts += 1;
          justRanDown = true;
        }
        state = decide(state, (runout ?? options[guard % options.length]!).id, WORLD);
        guard += 1;
      }
    }
    expect(runouts, 'no career ever ran a contract down, so nothing was tested').toBeGreaterThan(20);
  });

  it('climbs the loan ladder: home, then the second tier, then the top flight on merit', () => {
    const index = indexWorld(WORLD);
    const BIG_FIVE = new Set(['eng', 'esp', 'ita', 'ger', 'fra']);
    let sawSecondSpell = false;

    for (let i = 0; i < 40; i += 1) {
      // Take the loan whenever it is offered, so the ladder is actually walked.
      const state = playThrough(`loan-${i}`, (s) => (s.pending?.kind === 'loan' ? 0 : s.seasons.length));
      const spells = loanSpellsOf(state.seasons);
      expect(spells.length).toBeLessThanOrEqual(3);

      for (const season of state.seasons.filter((s) => s.onLoanFrom !== null)) {
        expect(season.age).toBeGreaterThanOrEqual(17);
        // A spell can begin at 24 and run two seasons, so 25 is the last age a
        // career can record one at.
        expect(season.age).toBeLessThanOrEqual(25);
      }

      spells.forEach((spell, rung) => {
        const league = index.leagueOfClub(spell.clubId);
        const parentCountry = index.leagueOfClub(
          state.seasons.find((s) => s.clubId === spell.clubId && s.onLoanFrom)!.onLoanFrom!,
        ).countryId;

        if (spell.startAge <= 17) {
          // Home: the country his club plays in, whatever division that is —
          // unless that country cannot field two clubs below his that would
          // play him, which for a one-division country is common. Then the card
          // would have been a single button, and the boy takes the next rung of
          // the ladder early instead: the big five's second tier.
          const secondTier = league.tier === 2 && BIG_FIVE.has(league.countryId);
          expect(
            league.countryId === parentCountry || secondTier,
            `spell ${rung + 1} at ${spell.startAge}: ${spell.clubId} is neither at home (${parentCountry}) nor a big-five second tier`,
          ).toBe(true);
          return;
        }
        // The first *senior* spell is always the big five's second tier — never
        // a top flight. Counting the home spell as a senior one used to skip
        // this rung entirely.
        const senior = spells.filter((s) => s.startAge >= 18);
        if (senior[0]?.clubId === spell.clubId) {
          expect(
            league.tier === 1 && BIG_FIVE.has(league.countryId),
            `first senior spell went to a big-five top flight (${spell.clubId})`,
          ).toBe(false);
        } else {
          sawSecondSpell = true;
        }
      });
    }

    // The rung above has to be reachable, or the rule is decoration.
    expect(sawSecondSpell, 'no career ever served a second senior spell').toBe(true);
  });

  /**
   * "A loan is one season. Always." — `career/loans.ts`
   *
   * It used to be written for one *or two* at the moment it was agreed, and a
   * third of all spells came out two — a year of a career decided without a
   * card. On the quicker paces, where a card comes every second season anyway,
   * the player vanished for what felt like an age. A second year is a fine
   * story; it is now a decision taken at the end of the first one, and the
   * clock is deliberately independent of the card cadence: the return card is
   * dealt the season the loan ends, at every pace.
   */
  /**
   * One season, always — and no card anywhere offers a second at the same club.
   *
   * The extension was tried and removed: the return card
   * has three slots, and "again" took one from the clubs, so a boy who had
   * just spent a year somewhere was shown that same club and only two others.
   * A career can still have two seasons at one club; it comes back through the
   * ordinary rungs, on merit.
   */
  it('runs every loan for exactly one season, and never offers a second', () => {
    for (const pace of ['quick', 'standard', 'deep'] as Pace[]) {
      let spells = 0;
      for (let i = 0; i < 30; i += 1) {
        let state = selectIdentity(createCareer(`loan-length-${pace}-${i}`, pace), IDENTITY, WORLD);
        const rng = mulberry32(i * 2654435761 + 3);
        let guard = 0;
        while (state.pending && guard < 300) {
          const card = state.pending;
          expect(
            card.options.find((o) => o.id.startsWith('extend:'))?.id,
            `${pace}: a card offered another season at the same club`,
          ).toBeUndefined();
          const pick = card.kind === 'loan' ? 0 : Math.floor(rng() * card.options.length);
          state = decide(state, card.options[pick]!.id, WORLD);
          guard += 1;
        }
        // Count consecutive loan seasons at one club — that is a spell.
        let run = 0;
        let previous: string | null = null;
        for (const season of state.seasons) {
          const here = season.onLoanFrom ? season.clubId : null;
          if (here && here === previous) run += 1;
          else {
            if (run > 0) { spells += 1; expect(run, `${pace}: a spell ran ${run} seasons`).toBe(1); }
            run = here ? 1 : 0;
          }
          previous = here;
        }
        if (run > 0) { spells += 1; expect(run, `${pace}: a spell ran ${run} seasons`).toBe(1); }
      }
      expect(spells, `${pace}: no loan spells to check`).toBeGreaterThan(10);
    }
  });

  it('never promises a loan role the season cannot deliver', () => {
    // The card's promise and the season's ceiling used to be computed by two
    // different rules — the destination filter added its own bonus worth up to
    // seventeen rating points, and the season then capped the role at what raw
    // ability earned. So "Regular Starter — you would start every week"
    // resolved to an impact-sub season, which is the game lying to the player
    // about a move the engine itself had constructed.
    //
    // Asserted on the builder rather than on played seasons, because that is
    // where the property lives: an event card is still allowed to bench a
    // player mid-loan, and a statistical assertion would have to tolerate that
    // and would therefore tolerate the bug too.
    const index = indexWorld(WORLD);
    let checked = 0;
    for (let i = 0; i < 30; i += 1) {
      const rng = rngFor(`loan-promise-${i}`, 'destinations');
      const player = striker(58 + (i % 20));
      const parent = index.club(['arsenal', 'ajax', 'benfica', 'stoke'][i % 4]!);
      for (const entry of loanDestinations(rng, WORLD, player, parent)) {
        checked += 1;
        // What the option advertises is exactly the ceiling the season applies,
        // including the lift that club's league position buys him.
        const standing = clubStanding(entry.club, entry.league.id, WORLD);
        expect(entry.role).toBe(roleCapOnLoan(player, entry.club, entry.league, standing));
        // And it is always a club that would play him. Rotation, not a starting
        // place: a promotion-chasing club gives a borrowed teenager a squad
        // place and no more, and that is a real option rather than a club to
        // be filtered off the card.
        expect(roleRank(entry.role), `${entry.club.id}`).toBeGreaterThanOrEqual(roleRank('squad'));
        // And the promise is the club's own standing, never anything richer:
        // a side chasing promotion cannot offer a star's season however weak
        // the boy's parent club has decided he is.
        expect(
          roleRank(entry.role),
          `${entry.club.id} (${standing}) promises ${entry.role}`,
        ).toBeLessThanOrEqual(
          Math.max(
            roleRank(LOAN_GUARANTEE[standing]),
            roleRank(roleCeiling(player, entry.club, entry.league)),
          ),
        );
      }
    }
    expect(checked, 'no loan destinations were produced at all').toBeGreaterThan(20);
  });

  it('offers nearly every career the loan, and never to a player already in the side', () => {
    // The rule, and the end of the old 30%/70% coin: a young player
    // short of a place is offered the move, full stop. It is not literally
    // every career — a boy who walks into the first team is not loaned out,
    // and one who cannot start even at the weakest club he could reach has
    // nowhere to go — so this guards the shape, not a fixed number.
    let offered = 0;
    const total = 40;
    for (let i = 0; i < total; i += 1) {
      const state = playThrough(`loan-rate-${i}`, (s) => s.seasons.length);
      if (state.seasons.some((s) => s.onLoanFrom !== null)) offered += 1;
    }
    expect(offered / total).toBeGreaterThan(0.85);
  });

  it('never offers the loan to a player who just played a full season', () => {
    // The loan card says "you can't get a game here". It reads the role his
    // ability *projects* for next season with his service reset, which can drop
    // a regular starter the season carried back to a squad rating on paper — so
    // the loan offer reached a forty-appearance regular. Last season's
    // minutes are the truth the card claims: at a squad player's count or above,
    // it does not deal. A first senior season has none, which is the home loan's
    // seventeen-year-old, and stays offered.
    let loans = 0;
    for (let i = 0; i < 140; i += 1) {
      let state = selectIdentity(createCareer(`loan-apps-${i}`, 'standard'), IDENTITY, WORLD);
      const rng = mulberry32(i * 2654435761 + 47);
      let guard = 0;
      while (state.pending && guard < 300) {
        const card = state.pending;
        if (card.kind === 'loan') {
          loans += 1;
          const last = state.seasons[state.seasons.length - 1];
          expect(
            (last?.stats.appearances ?? 0) < 25,
            `career ${i}: a loan was offered after a ${last?.stats.appearances}-appearance season`,
          ).toBe(true);
        }
        state = decide(state, card.options[Math.floor(rng() * card.options.length)]!.id, WORLD);
        guard += 1;
      }
    }
    expect(loans, 'no loan was ever offered').toBeGreaterThan(20);
  });

  it('never lets a club far below his ability make a cold offer', () => {
    // The rule, read off a screenshot of an 86-rated forward frozen out
    // at Barcelona being offered a Serie B club: every *cold* offer is tied to
    // ability. Form drove the market on its own, so a benched star had every
    // club he cleared on the floor bidding, down to the second divisions — but a
    // benched star is still a star, and only clubs near his level sign him. The
    // two relationship moves that are meant to sit below him — the loan club's
    // buy option and the boyhood club taking its old boy home — are exempt.
    let checked = 0;
    for (let i = 0; i < 140; i += 1) {
      let state = selectIdentity(createCareer(`cold-offer-${i}`, 'standard'), IDENTITY, WORLD);
      const rng = mulberry32(i * 2654435761 + 59);
      let guard = 0;
      while (state.pending && guard < 300) {
        const card = state.pending;
        const index = indexWorld(WORLD, state.leagueMoves, state.managerChanges);
        const homeId = state.seasons[0]?.clubId;
        for (const o of card.options) {
          if (!o.clubId || !o.offer) continue;
          if (o.clubId === state.contract?.clubId) continue; // staying / a renewal
          if (o.id.startsWith('buyout:') || o.clubId === homeId) continue; // relationship moves
          const club = index.club(o.clubId);
          const league = index.leagueOfClub(club.id);
          if (league.market !== 'core') continue; // a twilight money move bids on the cheque
          checked += 1;
          expect(
            withinOfferReach(state.player!, club, league),
            `career ${i}: OVR ${state.player!.overall} was offered ${club.id}, bar only ${starterBar(club, league)}`,
          ).toBe(true);
        }
        state = decide(state, card.options[Math.floor(rng() * card.options.length)]!.id, WORLD);
        guard += 1;
      }
    }
    expect(checked, 'no cold offer was ever checked').toBeGreaterThan(50);
  });

  it('tells a player his manager has gone, and tells him the truth about it', () => {
    /*
     * A new manager is the most common reason a real career turns, and it used
     * to turn in silence: the style changed, tactical fit moved with it, the
     * squad role followed a season later, and nothing on any screen said a
     * manager had been sacked. The window now opens on that news and names both
     * systems, so the two things it claims have to be true — the club really
     * plays the new way, and the new way really is worse for him.
     */
    let cards = 0;
    for (let i = 0; i < 80; i += 1) {
      let state = selectIdentity(createCareer(`manager-card-${i}`, 'standard'), IDENTITY, WORLD);
      const rng = mulberry32(i * 2654435761 + 41);
      let guard = 0;
      while (state.pending && guard < 400) {
        const card = state.pending;
        if (card.titleKey === 'decisions.manager_change.title') {
          cards += 1;
          const from = card.params!.from as ManagerStyle;
          const to = card.params!.to as ManagerStyle;
          const clubId = card.params!.club as string;
          expect(from, `career ${i}: the card says they changed to what they already played`).not.toBe(to);
          // It is his club, and the club really does play that way now.
          expect(clubId).toBe(state.contract!.clubId);
          const index = indexWorld(WORLD, state.leagueMoves, state.managerChanges);
          expect(index.club(clubId).managerStyle, `career ${i}: the card and the world disagree`).toBe(to);
          // And it is news worth a window: the old manager suited him better.
          const before = { ...index.club(clubId), managerStyle: from } as Club;
          expect(
            tacticalFit(state.player!, index.club(clubId)) <= tacticalFit(state.player!, before),
            `career ${i}: the new manager suits him better and he was asked to leave over it`,
          ).toBe(true);
          // Still a real window underneath the headline. When the club is
          // keeping him — a renewal is on the card — it is three choices like
          // every other end-of-season decision, never the two-button "renew or
          // one club" card a player hit. When the club is letting him go the
          // card is the clubs that want him, and two real moves is a decision.
          expect(card.kind).toBe('transfer');
          const hasRenewal = card.options.some((o) => o.id.startsWith('stay:'));
          expect(
            card.options.length,
            `career ${i}: a manager-change window came up with fewer than ${hasRenewal ? 'three' : 'two'} choices`,
          ).toBeGreaterThanOrEqual(hasRenewal ? 3 : 2);
        }
        state = decide(state, card.options[Math.floor(rng() * card.options.length)]!.id, WORLD);
        guard += 1;
      }
    }
    expect(cards, 'no career ever saw a manager change at its own club').toBeGreaterThan(20);
  });

  it('starts every career as a fringe player, on a handful of games', () => {
    // The appearance rule and the role rule disagreed about the same season:
    // three-to-eight games, labelled Squad Player, which `appearanceRange` says
    // is 25-39. A player reads the label, which is the one the screen shows.
    for (let i = 0; i < 40; i += 1) {
      let state = selectIdentity(createCareer(`debut-${i}`, 'standard'), IDENTITY, WORLD);
      let guard = 0;
      while (state.seasons.length === 0 && state.pending && guard < 40) {
        state = decide(state, state.pending.options[0]!.id, WORLD);
        guard += 1;
      }
      const debut = state.seasons[0];
      expect(debut, `career ${i} never played a season`).toBeDefined();
      expect(debut!.age, `career ${i} debuted at ${debut!.age}`).toBe(16);
      expect(debut!.role, `career ${i} debuted as ${debut!.role}`).toBe('fringe');
      expect(debut!.stats.appearances).toBeLessThanOrEqual(8);
    }
  });

  it('deals three answers when a loan ends, and never fewer', () => {
    // The card dealt two whenever the world could not produce a next loan rung:
    // "sign for the club you were just at" and "go back to the club that does
    // not want you", with no third door. Every other club card in the game
    // deals three, and a card about where a career goes next is the last one
    // that should be a coin toss between two clubs the player already knows.
    let cards = 0;
    let full = 0;
    for (let i = 0; i < 120; i += 1) {
      let state = selectIdentity(createCareer(`loan-three-${i}`, 'standard'), IDENTITY, WORLD);
      const rng = mulberry32(i * 2654435761 + 11);
      let guard = 0;
      while (state.pending && guard < 300) {
        const card = state.pending;
        if (card.kind === 'loan_return') {
          cards += 1;
          if (card.options.length === 3) full += 1;
          // Two is the floor, and it means one thing only: a player nobody in
          // the database would sign — a 50-rated twenty-two-year-old — so the
          // market genuinely has no third answer. Inventing one would be worse
          // than showing two.
          expect(card.options.length, `career ${i}: a loan ended with ${card.options.length} options`).toBeGreaterThanOrEqual(2);
          // And always *different* clubs: padding that re-offered the parent or
          // the club he had just left would be three rows and two choices.
          const clubs = new Set(card.options.map((o) => o.clubId));
          expect(clubs.size, `career ${i}: the same club appeared twice`).toBe(card.options.length);
        }
        state = decide(state, card.options[Math.floor(rng() * card.options.length)]!.id, WORLD);
        guard += 1;
      }
    }
    expect(cards, 'no loan ever ended').toBeGreaterThan(40);
    // Measured at 801 of 805 over 400 careers. The bar is set well under that
    // so a balance change moves it rather than breaking the build, but far
    // enough above the old behaviour — where a missing loan rung meant two
    // options every time — that a regression fails.
    expect(full / cards, `only ${((full / cards) * 100).toFixed(1)}% of loan cards dealt three`).toBeGreaterThan(0.95);
  });

  it('never renews a contract because a loan ended', () => {
    /*
     * Going back to the parent club used to re-term him in silence. The option
     * carried a freshly priced offer — a market wage for the player he had
     * become — and the resolver took the better of that and his existing deal
     * on each axis, so *every* return raised his wage with no club having
     * decided anything. It read exactly as it behaved: "why did
     * clicking go-back look like an automatic one-year renewal?"
     *
     * New terms are now a decision the card states, on an option whose id says
     * so. A plain `return:` must leave the contract alone.
     */
    let returns = 0;
    for (let i = 0; i < 60; i += 1) {
      let state = selectIdentity(createCareer(`loan-renew-${i}`, 'standard'), IDENTITY, WORLD);
      const rng = mulberry32(i * 2654435761 + 17);
      let guard = 0;
      while (state.pending && guard < 300) {
        const card = state.pending;
        const back = card.kind === 'loan_return'
          ? card.options.find((o) => o.id.startsWith('return:'))
          : undefined;
        const before = state.contract!;
        const pick = back ? back.id : card.options[Math.floor(rng() * card.options.length)]!.id;
        state = decide(state, pick, WORLD);
        if (!back) { guard += 1; continue; }
        returns += 1;
        const after = state.contract!;
        expect(after.clubId, `career ${i}: a plain return changed club`).toBe(before.clubId);
        expect(after.wage, `career ${i}: a plain return raised the wage`).toBe(before.wage);
        expect(
          after.yearsRemaining,
          `career ${i}: a plain return lengthened the deal`,
        ).toBeLessThanOrEqual(Math.max(1, before.yearsRemaining));
        guard += 1;
      }
    }
    expect(returns, 'nobody ever went back to a parent club').toBeGreaterThan(20);
  });

  it('never sends a player out again in the last year of his deal', () => {
    // `tryOfferLoan` refuses a loan with fewer than two years on the parent
    // contract — the club would be lending an asset it is about to lose for
    // nothing, and he would come back to no contract at all. The loan-return
    // card offered the next rung without that check, so the one card that could
    // break the rule was the one that did.
    for (let i = 0; i < 60; i += 1) {
      let state = selectIdentity(createCareer(`loan-lastyear-${i}`, 'standard'), IDENTITY, WORLD);
      const rng = mulberry32(i * 2654435761 + 23);
      let guard = 0;
      while (state.pending && guard < 300) {
        const card = state.pending;
        if (card.kind === 'loan_return' && (state.contract?.yearsRemaining ?? 0) <= 1) {
          expect(
            card.options.find((o) => o.id.startsWith('loan:'))?.id,
            `career ${i}: another spell offered on an expiring deal`,
          ).toBeUndefined();
        }
        state = decide(state, card.options[Math.floor(rng() * card.options.length)]!.id, WORLD);
        guard += 1;
      }
    }
  });

  it('replaces a fringe return with another loan, or sells him, and the body says which', () => {
    /*
     * The rule, in three shapes the body has to name:
     *
     *   wanted    the club wants him back — the return is the heart of the card,
     *             body "they want you back in the side".
     *   unwanted  it does not, but he can be sent out again — the loan takes the
     *             return's slot, body "still not in their plans, go find minutes".
     *   selling   it does not, and cannot loan him (his final year, or the rungs
     *             are spent) — it means to cash in, so the card is two sale
     *             offers and, last, going back to run the deal down from the
     *             bench, body "still not in their plans, they mean to sell you".
     *
     * A return and a replacement loan are never both on one card; in the sell
     * case the run-down return is always the last option.
     */
    let cards = 0;
    let wanted = 0;
    let replacedByLoan = 0;
    let selling = 0;
    for (let i = 0; i < 160; i += 1) {
      let state = selectIdentity(createCareer(`loan-fringe-${i}`, 'standard'), IDENTITY, WORLD);
      const rng = mulberry32(i * 2654435761 + 29);
      let guard = 0;
      while (state.pending && guard < 300) {
        const card = state.pending;
        if (card.kind === 'loan_return') {
          cards += 1;
          const isWanted = card.bodyKey.endsWith('body_wanted');
          const isUnwanted = card.bodyKey.endsWith('body_unwanted');
          const isSelling = card.bodyKey.endsWith('body_selling');
          expect(isWanted || isUnwanted || isSelling, `career ${i}: loan-return body ${card.bodyKey} names no case`).toBe(true);

          const hasReturn = card.options.some((o) => o.id.startsWith('return:') || o.id.startsWith('renew:'));
          const hasLoan = card.options.some((o) => o.id.startsWith('loan:'));
          const hasBuyout = card.options.some((o) => o.id.startsWith('buyout:'));
          // Never a return and a replacement loan at once — the loan is what
          // replaced the return.
          expect(hasReturn && hasLoan, `career ${i}: a return and a loan on one card`).toBe(false);

          if (isWanted) {
            wanted += 1;
            expect(hasReturn, `career ${i}: wanted, but no way back`).toBe(true);
            expect(hasBuyout, `career ${i}: wanted, but a buyout was offered`).toBe(false);
            expect(hasLoan, `career ${i}: wanted, but a loan was offered`).toBe(false);
          } else if (isUnwanted) {
            // Unwanted with a spell to offer: the loan took the return's slot.
            replacedByLoan += 1;
            expect(hasLoan, `career ${i}: body_unwanted, but no loan on the card`).toBe(true);
            expect(hasReturn, `career ${i}: unwanted with a loan, but the return survived`).toBe(false);
          } else {
            // Selling: no loan, a way back that runs the deal down, and that
            // return is the last option on the card.
            selling += 1;
            expect(hasLoan, `career ${i}: selling, but a loan was offered`).toBe(false);
            expect(hasReturn, `career ${i}: selling, but no way back to run the deal down`).toBe(true);
            expect(
              card.options[card.options.length - 1]!.id.startsWith('return:'),
              `career ${i}: the run-down return was not the last option`,
            ).toBe(true);
          }
        }
        state = decide(state, card.options[Math.floor(rng() * card.options.length)]!.id, WORLD);
        guard += 1;
      }
    }
    expect(cards, 'no loan ever ended').toBeGreaterThan(40);
    // All three branches have to actually fire, or the test proves nothing. Bars
    // set well under what a clean run produces so a balance shift moves them.
    expect(wanted, 'no parent club ever wanted a returning player').toBeGreaterThan(0);
    expect(replacedByLoan, 'the loan never once replaced a fringe return').toBeGreaterThan(3);
    expect(selling, 'no parent club ever moved to sell an unwanted player').toBeGreaterThan(3);
  });
});

describe('silverware arithmetic', () => {
  const index = indexWorld(WORLD);
  const field = trophyField(WORLD);
  const topFlights = WORLD.leagues.filter((l) => l.tier === 1);
  /** A competent but unremarkable player, so the star boost is not in play. */
  const NEUTRAL = 74;

  /**
   * A league hands out exactly one title a season, so the odds of every club
   * in it must sum to about one. The first ladder summed to 4.7 in England,
   * which is how Brighton and Villa ended up winning the Premier League and
   * Villarreal collected six European Cups. This is the check that catches it.
   */
  it('awards about one league title per league per season', () => {
    for (const league of topFlights) {
      const clubs = WORLD.clubs.filter((c) => c.leagueId === league.id);
      const total = clubs.reduce((sum, club) => sum + leagueOdds(club, league, NEUTRAL, field), 0);
      expect(total, `${league.id} awards ${total.toFixed(2)} titles a season`).toBeGreaterThan(0.45);
      expect(total, `${league.id} awards ${total.toFixed(2)} titles a season`).toBeLessThan(1.7);
    }
  });

  it('awards about one domestic cup per country per season', () => {
    for (const league of topFlights) {
      const clubs = WORLD.clubs.filter((c) => c.leagueId === league.id);
      const total = clubs.reduce((sum, club) => sum + cupOdds(club, NEUTRAL, field), 0);
      expect(total, `${league.id} cup awards ${total.toFixed(2)} a season`).toBeLessThan(2.2);
    }
  });

  it('awards about one elite continental cup per confederation per season', () => {
    const byConfederation = new Map<string, number>();
    for (const league of topFlights) {
      const confederation = index.country(league.countryId).confederation;
      for (const club of WORLD.clubs.filter((c) => c.leagueId === league.id)) {
        const entry = continentalEntry(club, league, WORLD);
        if (entry !== 'elite') continue;
        const odds = continentalOdds(club, 'elite', NEUTRAL, field);
        byConfederation.set(confederation, (byConfederation.get(confederation) ?? 0) + odds);
      }
    }
    for (const [confederation, total] of byConfederation) {
      expect(total, `${confederation} awards ${total.toFixed(2)} elite cups a season`).toBeLessThan(1.8);
    }
  });

  it('keeps a mid-table club out of the title race', () => {
    const premierLeague = index.league('eng.1');
    // Brighton: a good side, never a champion. One in fifty at the outside.
    expect(leagueOdds(index.club('brighton'), premierLeague, NEUTRAL, field)).toBeLessThan(0.02);
    expect(leagueOdds(index.club('brentford'), premierLeague, NEUTRAL, field)).toBeLessThan(0.05);
    // And the giants still are giants. The bar sat at 0.2 when the league had
    // 19 clubs and City the top rating; the 26/27 world fields the full 20 and
    // crowns Arsenal, so a genuine title contender now holds ~15–20%, not 25.
    expect(leagueOdds(index.club('man-city'), premierLeague, NEUTRAL, field)).toBeGreaterThan(0.15);
  });

  it('prices a club that changed division into the field it actually plays in', () => {
    const premierLeague = index.league('eng.1');
    const championship = index.league('eng.2');
    // A promoted second-tier club is a survival story in the top flight, not
    // the champion it was a division down. The fault this pins down: a player
    // watched Southampton go up and win the Premier League the following
    // season, because the odds looked the club up in its OLD division's share
    // table — where a promotion-race side holds a huge slice of a weak field.
    for (const club of WORLD.clubs.filter((c) => c.leagueId === 'eng.2')) {
      const asGuest = leagueOdds(club, premierLeague, NEUTRAL, field);
      const atHome = leagueOdds(club, championship, NEUTRAL, field);
      expect(asGuest, `${club.id} promoted: ${(asGuest * 100).toFixed(1)}% of the top flight`).toBeLessThan(0.06);
      expect(asGuest).toBeLessThan(atHome);
    }
    // And the mirror image: a relegated top-flight giant really is the
    // favourite to come straight back up.
    const relegatedGiant = leagueOdds(index.club('man-city'), championship, NEUTRAL, field);
    expect(relegatedGiant).toBeGreaterThan(0.5);
  });

  it('only lets clubs in the title or European places play continental football', () => {
    // Europe is qualified for by where a club finishes, not by its badge: a
    // mid-table or relegation side is never in it, and never in it means never
    // winning it. This is the same standing the offer card prints, so the two
    // cannot disagree — the fault a player caught was a mid-table West Ham
    // entered in the Champions League and winning it.
    const leagueById = new Map(WORLD.leagues.map((l) => [l.id, l]));
    for (const club of WORLD.clubs) {
      const league = leagueById.get(club.leagueId)!;
      const entry = continentalEntry(club, league, WORLD);
      const standing = clubStanding(club, league.id, WORLD);
      if (entry !== null) {
        expect(
          standing === 'title' || standing === 'european',
          `${club.id} plays continental football on a ${standing} finish`,
        ).toBe(true);
      }
      if (['midtable', 'survival', 'promotion', 'playoff'].includes(standing)) {
        expect(entry, `${club.id} is ${standing} but entered in continental football`).toBeNull();
      }
    }
  });
});

describe('market coherence', () => {
  it('offers at most one spin-off club per window, and none to a wanted young player', () => {
    const index = indexWorld(WORLD);
    let windows = 0;

    for (let i = 0; i < 25; i += 1) {
      let state = selectIdentity(createCareer(`market-${i}`, 'standard'), IDENTITY, WORLD);
      let guard = 0;
      while (state.pending && guard < 300) {
        const decision = state.pending;
        if (decision.kind === 'transfer' && state.player) {
          windows += 1;
          const offers = decision.options.filter((o) => o.id.startsWith('transfer:') && o.clubId);
          const spinoffs = offers.filter((o) => index.leagueOfClub(o.clubId!).market === 'spinoff');
          const core = offers.length - spinoffs.length;
          expect(spinoffs.length).toBeLessThanOrEqual(1);
          // Under 28 the spin-off door only opens when Europe has gone quiet —
          // a window that also carries two or more core offers has no business
          // showing the Gulf to a wanted young player.
          if (state.player.age < 28 && core >= 2) expect(spinoffs.length).toBe(0);
        }
        const option = decision.options[state.seasons.length % decision.options.length]!;
        state = decide(state, option.id, WORLD);
        guard += 1;
      }
    }
    expect(windows).toBeGreaterThan(20);
  });
});

/**
 * "However lucky he gets, a player who is not good enough does not play at a
 * top club."
 *
 * Six rungs, and ability decides which one. The ways a role could previously
 * be handed out — a contract clause, an event card that promotes you, a loan
 * guarantee, a good run in the side — all now clamp to `promisableRole`, so the
 * answer to "am I good enough for them?" is readable off the numbers instead of
 * being a gamble.
 */
describe('the squad ladder is ability, not luck', () => {
  const index = indexWorld(WORLD);
  it('runs low to high with no gaps', () => {
    expect(ROLE_ORDER).toEqual(['fringe', 'impact_sub', 'squad', 'regular', 'important', 'star']);
    expect(roleRank('star') - roleRank('fringe')).toBe(5);
  });

  it('caps what a big club can even promise a player who is short of its standard', () => {
    const elite = index.club('real-madrid');
    const eliteLeague = index.leagueOfClub('real-madrid');
    // Comfortably a professional footballer, nowhere near this dressing room.
    const ordinary = striker(68);
    expect(roleRank(roleCeiling(ordinary, elite, eliteLeague))).toBeLessThanOrEqual(roleRank('squad'));
    // The contract states what he actually gets, so it cannot read better than
    // the ceiling — a squad place at the Bernabéu, not a starting one.
    expect(roleRank(promisableRole(ordinary, elite, eliteLeague))).toBeLessThan(roleRank('important'));
    // Even a decade of service does not make him one of their best players.
    expect(roleRank(promisableRole(ordinary, elite, eliteLeague, 10))).toBeLessThanOrEqual(
      roleRank('important'),
    );

    // The same player is the best thing at a club whose standard he clears —
    // and that has to be a club in a division that does not demand more than he
    // is. Leeds are in the Premier League, whose floor he is well short of.
    const modest = index.club('millwall');
    expect(roleRank(roleCeiling(ordinary, modest, index.leagueOfClub('millwall')))).toBeGreaterThan(
      roleRank(roleCeiling(ordinary, elite, eliteLeague)),
    );
  });

  it('never lets a played season outrun ability, however the season went', () => {
    // Asserted from what a season actually records — its starting rating and
    // its club — because attributes are not stored per season and tactical fit
    // cannot be reconstructed from one. Fit is worth at most +2, so a season
    // that began `below` points under the club's standard had a ceiling of
    // `roleForDelta(-below + 2)`. On top of that the engine allows exactly two
    // rungs: one of in-season headroom (`roleCap`) and one for long service.
    //
    // The division comes from `season.leagueId` — what the club was in *that
    // season* — and nothing else will do. `state.leagueMoves` is a snapshot of
    // where every club ended up, so a club promoted in year 12 reads top-flight
    // for the year-3 season the player actually spent in the second tier, and
    // the assertion measures a division he never played in.
    const leagueById = new Map(WORLD.leagues.map((l) => [l.id, l]));
    let tested = 0;
    for (let i = 0; i < 40; i += 1) {
      const state = playThrough(`ladder-${i}`, () => 0);
      let prevSeason: (typeof state.seasons)[number] | null = null;
      for (const season of state.seasons) {
        const prev = prevSeason;
        prevSeason = season;
        // A loan season is a deliberate exception. The parent club lends the
        // boy *on condition that he plays*; the guarantee is `LOAN_GUARANTEE`,
        // read off where the borrowing club sits in its own division, and it
        // outruns ability on purpose — that clause is why a seventeen-year-old
        // rated below every senior bar in the database has anywhere to go.
        if (season.onLoanFrom !== null) continue;
        // A spin-off arrival is the other one (by rule): the season a
        // player lands in Saudi Arabia, the US, Japan or China he plays as at
        // least an Important Player, because the signing is the product. From
        // his second season there, the ladder applies again.
        if (
          leagueById.get(season.leagueId)!.market === 'spinoff' &&
          (prev === null || prev.clubId !== season.clubId)
        ) {
          continue;
        }
        const club = index.club(season.clubId);
        const bar = starterBar(club, leagueById.get(season.leagueId)!);
        const below = bar - season.overallStart;
        if (below < 10) continue;
        tested += 1;
        const ceiling = roleForDelta(striker(season.overallStart), -below + 2);
        const allowed = shiftRole(ceiling, 2);
        expect(
          roleRank(season.role),
          `${season.clubId} (bar ${bar}) at OVR ${season.overallStart} — played as ${season.role}`,
        ).toBeLessThanOrEqual(roleRank(allowed));
      }
    }
    // The assertion is worthless if no season ever qualifies.
    expect(tested).toBeGreaterThan(10);
  });
});

/**
 * "Nobody leaves before he has played a season there."
 *
 * The transfer window is between seasons and cannot break this. Event cards
 * can: half the deck carries an inline move, and one firing in October of a
 * first season would have a player signing in the summer and leaving before he
 * had played anywhere.
 */
describe('a move needs a season behind it', () => {
  it('never offers to move a player who has not played a season at his club', () => {
    let moves = 0;
    for (let i = 0; i < 30; i += 1) {
      let state = selectIdentity(createCareer(`settle-${i}`, 'deep'), IDENTITY, WORLD);
      const rng = mulberry32(i * 2654435761 + 11);
      let guard = 0;
      while (state.pending && guard < 500) {
        const here = state.contract?.clubId;
        // Any season he actually turned out for them counts, including one
        // spent there on loan before the move was made permanent. The rule is
        // "he has played a season at this club", not "he has played a season
        // under this contract" — a player who spent last year on loan at the
        // club that has just signed him has been there a full season, and the
        // dressing room knows exactly who he is.
        const played = here ? state.seasons.filter((season) => season.clubId === here).length : 0;
        // A card that would move him elsewhere, on a club he has yet to play a
        // season for. Loan and academy cards are the two that legitimately move
        // a player who has not: an academy card *is* his first club, and a loan
        // is the club sending him out.
        if (played === 0 && state.pending.kind === 'career_event') {
          for (const option of state.pending.options) {
            if (option.clubId && option.clubId !== here) moves += 1;
          }
        }
        const options = state.pending.options;
        state = decide(state, options[Math.floor(rng() * options.length)]!.id, WORLD);
        guard += 1;
      }
    }
    expect(moves).toBe(0);
  });
});

/**
 * "A good season should be rewarded with a bigger club, not a smaller one."
 *
 * The window used to be a function of ability alone, so a player could star for
 * a mid-table side all year, win the cup, and open the transfer screen to find
 * two clubs below the one he had just carried. These pin the ladder shut: last
 * season decides which way it points, at the transfer screen and on the event
 * cards that carry a move alike.
 */
describe('market standing', () => {
  const index = indexWorld(WORLD);
  const form = (over: Partial<MarketForm> = {}): MarketForm => ({
    role: 'regular',
    appearances: 38,
    rating: 7.0,
    trophies: 0,
    awards: 0,
    growth: 2,
    ...over,
  });

  /**
   * A label has to be true of the competition it is printed against.
   *
   * The first version ran one set of band names over every division, so a
   * strong Championship club was advertised as being in "European places" —
   * a finish that does not exist below the top flight. This walks every club
   * in the world rather than a sample: the rule is categorical, so a
   * counter-example anywhere is the bug.
   */
  it('never gives a club a finish its division does not have', () => {
    const topFlightOnly = new Set(['title', 'european']);
    const belowOnly = new Set(['promotion', 'playoff']);
    for (const club of WORLD.clubs) {
      const league = index.leagueOfClub(club.id);
      const standing = clubStanding(club, league.id, WORLD);
      if (league.tier === 1) {
        expect(belowOnly.has(standing), `${club.id} in ${league.id}: ${standing}`).toBe(false);
      } else {
        expect(topFlightOnly.has(standing), `${club.id} in ${league.id}: ${standing}`).toBe(false);
      }
    }
  });

  it('scores a starring season above an anonymous one', () => {
    expect(formScore(form({ role: 'star', rating: 7.5, trophies: 1, awards: 1 }))).toBeGreaterThan(0.6);
    expect(formScore(form())).toBeGreaterThan(0.2);
    expect(formScore(form({ role: 'impact_sub', appearances: 12, rating: 6.2, growth: 0 }))).toBeLessThan(-0.4);
    expect(formScore(null)).toBe(0);
  });

  it('tilts toward bigger clubs after a good season and smaller ones after a bad one', () => {
    const player = {
      lastName: 'X', shirtNumber: 9, foot: 'right' as const, countryId: 'eng',
      position: 'ST' as const, age: 25, archetype: 'technical' as const,
      attributes: { pace: 80, shooting: 82, passing: 70, dribbling: 78, defending: 30, physical: 76 },
      hidden: { developmentProfile: 'normal' as const, consistency: 60, injuryProneness: 40 },
      personality: 'resolute' as const, dopingBan: false, overall: 80, marketValue: 30_000_000,
    };
    const here = index.club('brighton'); // reputation 76
    const context = (f: MarketForm) => ({
      player,
      world: WORLD,
      currentLeague: index.leagueOfClub(here.id),
      currentClub: here,
      europeQuiet: false,
      form: f,
    });

    const good = context(form({ role: 'star', rating: 7.4, trophies: 1 }));
    expect(standingFactor(index.club('arsenal'), good)).toBeGreaterThan(1.4);
    expect(standingFactor(index.club('leeds'), good)).toBeLessThan(0.7);

    const bad = context(form({ role: 'impact_sub', appearances: 11, rating: 6.1, growth: -1 }));
    expect(standingFactor(index.club('arsenal'), bad)).toBeLessThan(0.7);
    expect(standingFactor(index.club('leeds'), bad)).toBeGreaterThan(1.3);

    // The club he is already at is never re-ranked against itself.
    expect(standingFactor(here, good)).toBe(1);
  });

  it('fills the window with clubs above him after a season worth talking about', () => {
    const climbing: number[] = [];
    const sliding: number[] = [];

    // 200 careers rather than 60: the tail this measures is a few per cent, so
    // a small sample moves it by a percentage point on any change that shifts
    // the RNG stream — which is every engine change. Measuring it on a bigger
    // sample is cheaper than re-tuning the bound each time.
    for (let i = 0; i < 200; i += 1) {
      let state = selectIdentity(createCareer(`standing-${i}`, 'standard'), IDENTITY, WORLD);
      let guard = 0;
      while (state.pending && guard < 300) {
        const decision = state.pending;
        const here = state.contract ? index.club(state.contract.clubId) : null;
        const last = state.seasons[state.seasons.length - 1];
        if (here && last) {
          const score = formScore({
            role: last.role,
            appearances: last.stats.appearances,
            rating: last.stats.rating,
            trophies: last.trophies.length,
            awards: last.awards.length,
            growth: last.overallEnd - last.overallStart,
          });
          const suitors = decision.options.filter((o) => o.clubId && o.clubId !== here.id && o.offer);
          for (const suitor of suitors) {
            const delta = index.club(suitor.clubId!).reputation - here.reputation;
            if (score > 0.2) climbing.push(delta);
            else if (score < -0.2) sliding.push(delta);
          }
        }
        const option = decision.options[(state.seasons.length + guard) % decision.options.length]!;
        state = decide(state, option.id, WORLD);
        guard += 1;
      }
    }

    expect(climbing.length).toBeGreaterThan(100);
    expect(sliding.length).toBeGreaterThan(100);

    const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    // A good season buys a step up on average; a bad one costs one.
    expect(mean(climbing)).toBeGreaterThan(5);
    expect(mean(sliding)).toBeLessThan(0);
    // And the specific complaint: being shown a much smaller club after
    // starring for this one. A handful survive because the money move and the
    // trip home are deliberately not about climbing.
    const wayDown = climbing.filter((d) => d <= -10).length / climbing.length;
    expect(wayDown).toBeLessThan(0.06);
  });
});

/**
 * "Immersive mode is really a difficulty setting, and that is not fair."
 *
 * A pace changes how long a career takes to play, and nothing else. The deck is
 * authored for one card a season, so serving it twice as often — or once every
 * two seasons — has to be corrected for, and `PACE_EFFECT_SCALE` is that
 * correction.
 *
 * Paired seeds: the same career is played at all three paces off the same
 * choice stream, so what is left is the engine's doing.
 */
describe('every pace is the same difficulty', () => {
  const play = (pace: Pace, runs: number) => {
    const peaks: number[] = [];
    const legacies: number[] = [];
    for (let i = 0; i < runs; i += 1) {
      let state = selectIdentity(createCareer(`pace-${i}`, pace), IDENTITY, WORLD);
      const rng = mulberry32(i * 2654435761 + 1);
      let guard = 0;
      while (state.pending && guard < 400) {
        const options = state.pending.options;
        state = decide(state, options[Math.floor(rng() * options.length)]!.id, WORLD);
        guard += 1;
      }
      peaks.push(Math.max(0, ...state.seasons.map((s) => s.overallEnd)));
      legacies.push(state.retirement?.legacyScore ?? 0);
    }
    const mean = peaks.reduce((a, b) => a + b, 0) / peaks.length;
    const median = [...legacies].sort((a, b) => a - b)[Math.floor(legacies.length / 2)]!;
    return { mean, median };
  };

  it('produces the same player whichever pace is chosen', () => {
    const results = (['quick', 'standard', 'deep'] as Pace[]).map((pace) => play(pace, 150));
    const means = results.map((r) => r.mean);
    /*
     * The comment above this line used to say the measured spread was ~0.4 at
     * 2,500 careers. It is not, and has not been: `npx tsx tools/pace.ts` at
     * 2,500 paired careers puts quick on 81.2, standard on 81.5 and **deep on
     * 82.7** — deep is a point and a quarter clear, and thirteen per cent clear
     * on the legacy median. A 150-career sample could not see it, so nothing
     * failed until a change widened the per-player spread and the noise crossed
     * the bound.
     *
     * The cause is structural rather than a constant that needs nudging. Deep
     * deals four times as many cards, most cards are worth taking, and the
     * things that carry the advantage — a rung of squad standing, a season's
     * silverware odds — are season-bound, so `scaleEffectToPace` deliberately
     * leaves them alone. What it does scale is floored at ±1 so a card can
     * never round away to nothing, which is why dropping the deep scale from
     * 0.95 to 0.72 only moved the peak from 83.1 to 82.3.
     *
     * 0.86 is what the discount can honestly buy. The bound below is the
     * measured truth plus sampling room at n=150, not a target — and the
     * docs now say a point rather than half a point.
     */
    expect(Math.max(...means) - Math.min(...means)).toBeLessThan(2.6);

    // And the leaderboard the game is actually ranked on. The residual is not
    // ability — it is that a pace serving fewer cards offers fewer chances to
    // leave a club (the loyalty bonus) and fewer chances to take a doping ban.
    // Both are choices, so this bound is deliberately generous; it exists to
    // catch a pace becoming outright easier, not to freeze the spread.
    const legacies = results.map((r) => r.median);
    expect(Math.max(...legacies) / Math.max(1, Math.min(...legacies))).toBeLessThan(1.4);
  });

  it('keeps every pace scale positive, with standard as the reference', () => {
    // Standard is the pace the deck is authored for, so it is the one scale
    // that must never drift; the others are measured against it.
    for (const pace of Object.keys(PACE_EFFECT_SCALE) as Pace[]) {
      expect(PACE_EFFECT_SCALE[pace], pace).toBeGreaterThan(0);
    }
    expect(PACE_EFFECT_SCALE.standard).toBe(1);
  });
});

/**
 * "Ligue 1 and Serie B in the same window, for about the same money."
 *
 * The market band is centred on the player, so a mid player sitting in the
 * middle of it could draw both — each within reach of him, absurd next to each
 * other. Windows are held to `WINDOW_SPREAD` against themselves now.
 *
 * Academies and loans are deliberately exempt: choosing between a Premier
 * League academy and a Championship one, or between better football and a place
 * in the side, is the decision those cards exist to pose.
 */
describe('a window reads as one football world', () => {
  it('never puts a big-five first division next to a second division', () => {
    let windows = 0;
    let incoherent = 0;
    let loanCareers = 0;

    for (let i = 0; i < 40; i += 1) {
      let state = selectIdentity(createCareer(`coherent-${i}`, 'standard'), IDENTITY, WORLD);
      const rng = mulberry32(i * 2654435761 + 1);
      let guard = 0;
      while (state.pending && guard < 400) {
        const decision = state.pending;
        const here = state.contract?.clubId;
        // Genuine suitors only: staying put, or going back to the parent club,
        // is not the window offering two incompatible worlds.
        const suitors = decision.options.filter(
          (o) => o.clubId && o.clubId !== here && !o.id.startsWith('stay:') && !o.id.startsWith('return:'),
        );
        if (suitors.length > 1 && (decision.kind === 'transfer' || decision.kind === 'career_event')) {
          // Built from *this career's* divisions, not the world's opening ones.
          // Clubs get promoted and relegated, and a club that went up belongs
          // with the top flight from then on: reading Sheffield Wednesday as
          // second-tier after they had gone up made a perfectly coherent window
          // look like it paired La Liga with the Championship.
          const index = indexWorld(WORLD, state.leagueMoves);
          const core = suitors
            .map((o) => index.leagueOfClub(o.clubId!))
            .filter((l) => l.market === 'core')
            .map((l) => l.strength);
          if (core.length > 1) {
            windows += 1;
            if (Math.max(...core) - Math.min(...core) > WINDOW_SPREAD + 0.02) incoherent += 1;
          }
        }
        const options = decision.options;
        state = decide(state, options[Math.floor(rng() * options.length)]!.id, WORLD);
        guard += 1;
      }
      if (state.seasons.some((s) => s.onLoanFrom !== null)) loanCareers += 1;
    }

    expect(windows).toBeGreaterThan(50);
    expect(incoherent).toBe(0);

    // And the loan system exists at all. It was gated one role-band too strict
    // and fired in under a tenth of careers, which read as "loans are gone".
    //
    // The bar came down from 0.4 when destinations were narrowed to the big
    // five's second divisions — the Championship, 2. Bundesliga, Serie B, which
    // is where the real loan market sends an eighteen-year-old. A narrower set
    // of destinations means fewer careers find one, and roughly a third is the
    // right shape: a loan should be a common chapter, not a near-certain one.
    expect(loanCareers / 40).toBeGreaterThan(0.25);
  });
});

/**
 * The rules this project states in prose, made executable.
 *
 * Two shapes of bug have produced every serious fault found in this engine so
 * far. The first is a card that promises what the resolver does not do — a
 * branch nobody wrote, no type error, no throw; `tools/fairness.ts` now plays
 * thousands of careers and checks every option against what the state actually
 * became. The second is this one: **a rule written down in one place and
 * enforced in some of the others.** The comment says "there is always at least
 * one", the handbook says "every transfer window must read as a coherent set of
 * clubs", the design doc says "contracts renew only near expiry" — and each was
 * true on the path its author was looking at.
 *
 * Prose cannot fail. So each test below quotes the claim it is holding the
 * engine to, and the file that makes it. If the claim changes, the test has to
 * change with it, in the same commit — which is the only way a comment stays
 * true a year later.
 */
describe('the rules this project states in prose', () => {
  interface DealtCard {
    seed: string;
    id: string;
    kind: DecisionKind;
    optionIds: string[];
    /** Clubs on the card that he could actually join. */
    suitors: number;
    age: number;
    /** OVR as stored, and OVR as the attributes make it — see `attributes.ts`. */
    stored: number;
    derived: number;
  }

  /**
   * Every card a spread of careers is dealt, kept so the claims below are
   * measured against real play rather than a constructed state. Paces,
   * positions and choice policies all vary: a rule that only holds for a
   * standard-pace striker who always taps the first option is not a rule.
   */
  const DEALT: DealtCard[] = (() => {
    const dealt: DealtCard[] = [];
    for (let i = 0; i < 24; i += 1) {
      const seed = `stated-${i}`;
      const rng = mulberry32(i * 2654435761 + 7);
      let state = selectIdentity(
        createCareer(seed, (['standard', 'quick', 'deep'] as const)[i % 3]!),
        { ...IDENTITY, position: POSITIONS[i % POSITIONS.length]! },
        WORLD,
      );
      let guard = 0;
      while (state.pending && guard < 400) {
        const card = state.pending;
        const player = state.player!;
        dealt.push({
          seed,
          id: card.id,
          kind: card.kind,
          optionIds: card.options.map((o) => o.id),
          suitors: card.options.filter((o) => o.id.startsWith('transfer:')).length,
          age: player.age,
          stored: player.overall,
          derived: computeOverall(player.attributes, player.position),
        });
        const options = card.options;
        state = decide(state, options[Math.floor(rng() * options.length)]!.id, WORLD);
        guard += 1;
      }
    }
    return dealt;
  })();

  /** "A card is three options, never more." — `career/decisions.ts` */
  it('never deals a card with more than three options', () => {
    const oversized = DEALT.filter((card) => card.optionIds.length > CARD_SLOTS);
    expect(oversized).toEqual([]);
  });

  /**
   * "A window of one real choice is a window with no choice in it."
   * — `career/decisions.ts`, on the rule that drops filler offers.
   *
   * The rule was enforced against filler and not against the card: dropping
   * both drawn suitors left a transfer window whose only button was *stay*.
   */
  it('never deals a card with only one way to answer it', () => {
    const nonChoices = DEALT.filter((card) => card.optionIds.length < 2);
    expect(nonChoices).toEqual([]);
  });

  /**
   * "Whatever is left is how many clubs come calling, and there is always at
   * least one." — `career/decisions.ts`
   */
  it('never opens a transfer window with nobody to join', () => {
    const empty = DEALT.filter((card) => card.kind === 'transfer' && card.suitors === 0);
    expect(empty).toEqual([]);
  });

  /**
   * The load-bearing one: **an option does what the option said.**
   *
   * This is the property behind the loan-return bug — `applyLoanReturn` handled
   * one option prefix and let the other three fall through, so a player chose
   * Lyon twice and was handed his old club. Nothing else in this repository
   * could have caught it: the options were well-formed, nothing threw, and a
   * test only covers the branch somebody remembered to write.
   *
   * `pnpm fairness` asks it of thousands of options and is the exhaustive
   * version; this is the same property in the suite that runs on every commit,
   * kept to a handful of careers so it costs seconds. Both matter: a check that
   * only runs when somebody remembers to run it is a habit, not a gate.
   */
  it('does what the option said, on every option of every card', () => {
    const broken: string[] = [];
    const clubOf = (s: CareerState) => s.loan?.clubId ?? s.contract?.clubId ?? null;

    for (let i = 0; i < 6; i += 1) {
      let state = selectIdentity(createCareer(`promise-${i}`, 'standard'), {
        ...IDENTITY,
        position: POSITIONS[i % POSITIONS.length]!,
      }, WORLD);
      const rng = mulberry32(i * 40503 + 11);
      let guard = 0;

      while (state.pending && guard < 300) {
        const card = state.pending;
        const before = clubOf(state);

        for (const option of card.options) {
          // The id shape says what kind of move it is: a loan changes where he
          // plays without changing who employs him.
          const isLoan = option.id.startsWith('loan:');
          const after = decide(state, option.id, WORLD);
          const where = `${card.kind}/${option.id}`;

          if (option.clubId && option.clubId !== before) {
            const landed = isLoan ? after.loan?.clubId : after.contract?.clubId;
            if (landed !== option.clubId) broken.push(`${where} → ${landed ?? 'nobody'}`);
          }
          if (option.clubId && option.clubId === before && !after.loan && after.contract?.clubId !== before) {
            broken.push(`${where} named his own club and moved him`);
          }
          if (option.offer && !isLoan && after.contract) {
            // `decide` signs the deal *and* plays on to the next card, so the
            // seasons served since have to come off the promised length.
            const served = after.seasons.length - state.seasons.length;
            if (after.contract.wage < option.offer.wage) broken.push(`${where} underpaid`);
            if (after.contract.yearsRemaining < option.offer.years - served) {
              broken.push(`${where} short-changed the contract length`);
            }
            if (
              after.contract.clubId === option.clubId &&
              roleRank(after.contract.promisedRole) < roleRank(option.offer.promisedRole)
            ) {
              broken.push(`${where} promised a role it did not write into the contract`);
            }
          }
        }

        state = decide(state, card.options[Math.floor(rng() * card.options.length)]!.id, WORLD);
        guard += 1;
      }
    }
    expect(broken).toEqual([]);
  });

  /**
   * "Every event fires at most once per career. The pool is big enough that
   * nothing needs to come round twice." — `career/events.ts`
   */
  it('fires every event at most once in a career', () => {
    const seen = new Set<string>();
    const repeats: string[] = [];
    for (const card of DEALT) {
      if (card.kind !== 'career_event') continue;
      const key = `${card.seed}|${card.id}`;
      if (seen.has(key)) repeats.push(key);
      seen.add(key);
    }
    expect(repeats).toEqual([]);
  });

  /**
   * "OVR is always derived, never stored as the source of truth."
   * — `model/attributes.ts`
   */
  it('derives the rating from the attributes at every step of every career', () => {
    const drifted = DEALT.filter((card) => card.stored !== card.derived);
    expect(drifted).toEqual([]);
  });

  /** "A veteran can always choose to walk away on his own terms." — `career/decisions.ts` */
  it('offers the walk-away on every window a veteran is shown', () => {
    const windows = DEALT.filter((card) => card.kind === 'transfer' && card.age >= 35);
    expect(windows.length).toBeGreaterThan(0);
    expect(windows.filter((card) => !card.optionIds.includes('retire:now'))).toEqual([]);
  });

  /**
   * "A club that would never go down still never goes down." — `sim/trophies.ts`,
   * on why the player's effect on relegation is a multiplier and not a term.
   *
   * The passenger is deliberately dreadful: at a club whose base rate is zero,
   * no player can conjure a relegation that the arithmetic does not allow.
   */
  it('never relegates a club in the title race', () => {
    // The safe set is the title band of each division — standing, not a bare
    // reputation number, because relegation now follows where a club sits in
    // the division it actually plays in. A rep-72 club is a fortress in the
    // Championship and a survival case in the Premier League; "reputation 70+
    // never goes down" was exactly the assumption that let a promoted club
    // live in the top flight without ever facing the drop.
    const field = trophyField(WORLD);
    const index = indexWorld(WORLD);
    const safe = WORLD.clubs.filter(
      (club) =>
        index.leagueOfClub(club.id).tier === 1 &&
        clubStanding(club, club.leagueId, WORLD) === 'title',
    );
    expect(safe.length).toBeGreaterThan(10);
    let relegations = 0;
    for (const club of safe) {
      const league = index.leagueOfClub(club.id);
      for (let i = 0; i < 40; i += 1) {
        const result = simulateTrophies(rngFor(club.id, `safe-${i}`), {
          club,
          league,
          modifiers: EMPTY_MODIFIERS,
          continental: continentalEntry(club, league, WORLD),
          playerOverall: 45,
          field,
          standing: clubStanding(club, league.id, WORLD),
          justPromoted: false,
          hasLowerDivision: WORLD.leagues.some(
            (l) => l.countryId === league.countryId && l.tier === league.tier + 1,
          ),
        });
        if (result.relegated) relegations += 1;
      }
    }
    expect(relegations).toBe(0);
  });

  /**
   * "Low consistency means bigger hot and cold streaks, never a different
   * career average." — `sim/season.ts`
   *
   * An earlier version multiplied the Poisson mean itself, which quietly paid
   * inconsistent players about 30% more goals for life. The property is the
   * one worth pinning: the same expectation, a wider spread.
   */
  it('changes the spread with consistency, and not the career average', () => {
    const index = indexWorld(WORLD);
    const club = WORLD.clubs.find((c) => c.reputation >= 75)!;
    const league = index.leagueOfClub(club.id);
    const run = (consistency: number) => {
      const base = striker(80);
      const player = { ...base, hidden: { ...base.hidden, consistency } };
      const goals: number[] = [];
      for (let i = 0; i < 400; i += 1) {
        const stats = simulateSeason(rngFor(`consistency-${consistency}`, `season-${i}`), {
          player,
          club,
          league,
          role: 'important',
          injuryWeeks: 0,
          continentalRounds: 8,
          temporaryDelta: 0,
          firstSeason: false,
        });
        goals.push(stats.goals);
      }
      const mean = goals.reduce((a, b) => a + b, 0) / goals.length;
      const variance = goals.reduce((a, b) => a + (b - mean) ** 2, 0) / goals.length;
      return { mean, spread: Math.sqrt(variance) };
    };
    const erratic = run(15);
    const metronome = run(95);
    // The same career, told with more and less drama: means within 8%, and the
    // erratic player's season-to-season swing clearly the wider of the two.
    expect(Math.abs(erratic.mean - metronome.mean) / metronome.mean).toBeLessThan(0.08);
    expect(erratic.spread).toBeGreaterThan(metronome.spread * 1.15);
  });

  /**
   * "Loans stay inside the European pyramid, downward only." — handbook §1,
   * league scope; `career/loans.ts` implements it as a destination weight.
   */
  it('sends every loan down the pyramid and never out of it', () => {
    const index = indexWorld(WORLD);
    const player = { ...striker(66), age: 19 };
    let checked = 0;
    for (const parent of WORLD.clubs.filter((c) => c.reputation >= 60)) {
      for (const rung of ['home', 'development', 'proving'] as const) {
        for (const entry of loanDestinations(
          rngFor(parent.id, `loan-${rung}`), WORLD, player, parent, [], undefined, rung,
        )) {
          const league = index.leagueOfClub(entry.club.id);
          expect(league.market).toBe('core');
          expect(entry.club.reputation).toBeLessThan(parent.reputation);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  /**
   * "Entries with weight <= 0 can never be selected." — `rng.ts`
   *
   * Half the world model is a weighted draw — suitors, loan destinations,
   * squad-mates, headlines — and every one of them expresses "not this club"
   * as a zero weight rather than by filtering the list.
   */
  it('never picks an entry whose weight is zero', () => {
    const entries = ['no', 'yes', 'never'];
    const picks = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const picked = weightedPick(rngFor('weights', `pick-${i}`), entries, (entry) =>
        entry === 'yes' ? 1 : 0,
      );
      picks.add(picked ?? 'none');
    }
    expect([...picks]).toEqual(['yes']);
  });

  /**
   * The other half of the promise property: a card whose kind nothing resolves
   * must not be answerable at all.
   *
   * `decide` used to end its switch with `default: break` — a card of an
   * unhandled kind was dealt, chosen, and applied nothing. `DecisionKind` had
   * two members no builder produced and no resolver read.
   */
  it('refuses to answer a card whose kind nothing resolves', () => {
    const state = selectIdentity(createCareer('unresolved', 'standard'), IDENTITY, WORLD);
    const broken = {
      ...state,
      pending: { ...state.pending!, kind: 'nonsense' as unknown as DecisionKind },
    };
    expect(() => decide(broken, broken.pending!.options[0]!.id, WORLD)).toThrow(/No resolver/);
  });
});

describe('endings', () => {
  it('awards a legacy score with a traceable breakdown', () => {
    const state = playThrough('seed-legacy', () => 0);
    const report = state.retirement!;
    const summed = report.breakdown.reduce((total, entry) => total + entry.value, 0);
    expect(report.legacyScore).toBe(Math.max(0, summed));
  });

  /**
   * "A ban is the first line of the obituary whatever else the career held."
   * — `career/summary.ts`
   *
   * Endings used to be "first match in list order wins", which made the order
   * of the array load-bearing and quietly hid rarer outcomes behind broader
   * ones: `serial_winner` was reached in 24% of careers and shown in 3%, and a
   * player banned for doping who had won enough retired as *Serial Winner*.
   */
  it('shows the rarest ending that fits, not the first one listed', () => {
    const ranked = [...ENDINGS].sort((a, b) => b.rarity - a.rarity);
    // No two endings share a rarity, or "the rarest that fits" is a coin toss.
    expect(new Set(ranked.map((e) => e.rarity)).size).toBe(ENDINGS.length);
    // The ban outranks every honour: that is the specific fault this fixes.
    const rarityOf = (id: string) => ENDINGS.find((e) => e.id === id)!.rarity;
    expect(rarityOf('disgraced')).toBeGreaterThan(rarityOf('serial_winner'));
    expect(rarityOf('disgraced')).toBeGreaterThan(rarityOf('goat'));
    // And the fallback is the floor, so something always resolves.
    expect(Math.min(...ENDINGS.map((e) => e.rarity))).toBe(rarityOf('squad_player'));

    for (let i = 0; i < 30; i += 1) {
      const state = playThrough(`ending-order-${i}`, (s) => s.seasons.length);
      const report = state.retirement!;
      const fitting = ENDINGS.filter((e) => e.when(state, report.legacyScore, WORLD, report.reasonKey));
      const rarest = fitting.reduce((best, e) => (e.rarity > best.rarity ? e : best), fitting[0]!);
      expect(report.endingId, `career ${i}`).toBe(rarest.id);
    }
  });

  it('always resolves to an ending', () => {
    for (let i = 0; i < 20; i += 1) {
      const state = playThrough(`ending-${i}`, (s) => s.seasons.length);
      expect(state.retirement?.endingId).toBeTruthy();
    }
  });
});

/**
 * The four mechanics the September 2026 review added, each asserted on its own.
 *
 * Every one of them was landed on the strength of a simulation — a balance
 * sweep moved, `pnpm skill` reordered the policies, `pnpm plausibility` stopped
 * refusing a season. That is the right evidence for *whether* a change was
 * worth making and the wrong evidence for whether the rule still holds a month
 * later: a sweep says the median moved, not that a keeper's full season is
 * thirty-eight games. So each rule is pinned here, where a later edit that
 * breaks it fails in a second rather than showing up as a number nobody can
 * explain.
 */
describe('what the September review changed', () => {
  /** A career whose seasons can be doctored to pose one question at a time. */
  const template = () => {
    const state = playThrough('september-template', () => 0);
    return { state, season: state.seasons[0]! };
  };

  /**
   * `trophyShare` — "the man who played it is worth twice the man who watched
   * it". The floor is 0.5 and the cap is 1, so that ratio is exactly two, and
   * this is the assertion the prose in `career/summary.ts` makes.
   */
  it('pays twice as much for a medal won as for a medal watched', () => {
    const { state, season } = template();
    const withApps = (appearances: number, position: Position = 'ST') => ({
      ...season,
      position,
      trophies: ['league' as const],
      awards: [],
      nationalStats: null,
      stats: { ...season.stats, appearances },
    });
    const trophies = (seasons: SeasonRecord[]) =>
      computeLegacy({ ...state, seasons }, WORLD).breakdown.find((e) => e.key === 'trophies')!.value;

    const played = trophies([withApps(30)]);
    const watched = trophies([withApps(0)]);
    expect(played).toBeGreaterThan(0);
    // Rounding is the only slack allowed: the ratio is 1 ÷ 0.5.
    expect(Math.abs(played - watched * 2)).toBeLessThanOrEqual(1);

    // The floor, from below: fifteen games of thirty is exactly the floor, so
    // nothing under it is worth less than nothing at all.
    expect(trophies([withApps(15)])).toBe(watched);
    // And the cap, from above: a 46-game season is not worth more than a full
    // one, or a cup run would inflate a medal.
    expect(trophies([withApps(46)])).toBe(played);
  });

  /**
   * `FULL_SEASON_APPS` — a keeper plays 38 league games where an outfielder is
   * credited with a full season at 30, because the two jobs do not share a
   * denominator and crediting them as if they did quietly under-pays a keeper.
   */
  it('measures a keeper against 38 games and an outfielder against 30', () => {
    const { state, season } = template();
    const at = (position: Position) => {
      const seasons = [
        {
          ...season,
          position,
          trophies: ['league' as const],
          awards: [],
          nationalStats: null,
          stats: { ...season.stats, appearances: 30 },
        },
      ];
      return computeLegacy({ ...state, seasons }, WORLD).breakdown.find((e) => e.key === 'trophies')!.value;
    };
    const outfield = at('ST');
    const keeper = at('GK');
    // 30 of 30 against 30 of 38. The points are rounded integers, so the
    // ratio is compared with a point of slack rather than exactly.
    expect(keeper).toBeLessThan(outfield);
    expect(Math.abs(keeper / outfield - 30 / 38)).toBeLessThan(0.02);
  });

  /**
   * `minutesGrowthMultiplier` — development costs a player who does not play.
   *
   * The two properties that matter are both about *not* overreaching: it never
   * exceeds 1, because playing every game is the normal case rather than a
   * bonus, and it never reaches zero, because nothing but the age curve is
   * allowed to make a player worse (`model/growth.ts`).
   */
  it('scales growth by minutes, down the ladder and never above a full season', () => {
    const values = ROLE_ORDER.map((role) => minutesGrowthMultiplier(role));
    for (const [i, value] of values.entries()) {
      expect(value, ROLE_ORDER[i]).toBeGreaterThan(0);
      expect(value, ROLE_ORDER[i]).toBeLessThanOrEqual(1);
    }
    // ROLE_ORDER runs worst to best, so the multipliers may never fall as the
    // role improves.
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]!, `${ROLE_ORDER[i - 1]} → ${ROLE_ORDER[i]}`).toBeGreaterThanOrEqual(values[i - 1]!);
    }
    // And the two ends are genuinely different, or the rule does nothing.
    expect(minutesGrowthMultiplier('star')).toBe(1);
    expect(minutesGrowthMultiplier('fringe')).toBeLessThan(1);
  });

  /**
   * `countriesSignedIn` — a loan is not leaving.
   *
   * `homegrown` was reached by one career in twenty-five hundred because the
   * loan ladder's second rung is a big-five second division, and a season there
   * counted as a country he had played in. The club still owns him and he comes
   * back; what counts is where he was *contracted*.
   */
  it('counts a season on loan abroad as a season at home', () => {
    const { state, season } = template();
    const index = indexWorld(WORLD);
    const home = WORLD.clubs.find((c) => index.leagueOfClub(c.id).tier === 1)!;
    const homeCountry = index.leagueOfClub(home.id).countryId;
    const abroad = WORLD.clubs.find((c) => index.leagueOfClub(c.id).countryId !== homeCountry)!;

    const atHome = { ...season, clubId: home.id, leagueId: home.leagueId, onLoanFrom: null, trophies: [], awards: [] };
    const seasons = Array.from({ length: 12 }, (_, i) => ({ ...atHome, index: i }));
    const loanedOut = { ...seasons[3]!, clubId: abroad.id, leagueId: abroad.leagueId, onLoanFrom: home.id };
    const signedAway = { ...loanedOut, onLoanFrom: null };

    const ending = (id: string, list: SeasonRecord[]) => {
      const e = ENDINGS.find((x) => x.id === id)!;
      return e.when({ ...state, seasons: list }, 0, WORLD, state.retirement!.reasonKey);
    };
    const withLoan = seasons.map((s, i) => (i === 3 ? loanedOut : s));
    const withMove = seasons.map((s, i) => (i === 3 ? signedAway : s));

    expect(ending('homegrown', withLoan)).toBe(true);
    expect(ending('homegrown', withMove)).toBe(false);
    // The same rule, on the ending random play never reaches: the loan season
    // belongs to the parent club, so one club it stays.
    expect(ending('one_club_legend', withLoan)).toBe(true);
    expect(ending('one_club_legend', withMove)).toBe(false);
  });

  /**
   * `serial_winner` — five league titles, not "a very high legacy score".
   *
   * A score threshold is permanently in the shadow of every ending that is a
   * thing that *happened*; this is what a serial winner actually is, and it is
   * true of a career that never won an individual honour.
   */
  it('makes a serial winner somebody who won five leagues', () => {
    const { state, season } = template();
    const ending = ENDINGS.find((e) => e.id === 'serial_winner')!;
    const titles = (n: number) =>
      Array.from({ length: 12 }, (_, i) => ({
        ...season,
        index: i,
        awards: [],
        trophies: i < n ? (['league'] as const).slice() : [],
      }));
    const fits = (n: number) => ending.when({ ...state, seasons: titles(n) }, 0, WORLD, state.retirement!.reasonKey);
    expect(fits(4)).toBe(false);
    expect(fits(5)).toBe(true);
  });

  /**
   * `justPromoted` — straight up and straight to the title is a real story for
   * a giant and not for anybody else.
   *
   * `seasonReality` alone did not stop it: mid-table keeps 15% of the title
   * roll, which over thirty thousand seasons produced exactly the Ligue 1
   * champion `tools/plausibility.ts` refuses. The rolls below are seeded, so
   * this is a fact about the engine rather than a sample.
   */
  it('will not let a promoted mid-table club win the league', () => {
    const index = indexWorld(WORLD);
    const field = trophyField(WORLD);
    const context = (club: Club, justPromoted: boolean) => {
      const league = index.leagueOfClub(club.id);
      return {
        club,
        league,
        modifiers: EMPTY_MODIFIERS,
        continental: continentalEntry(club, league, WORLD),
        // A superstar drags the odds up, which is what makes the mid-table
        // club win often enough for "never" to mean something.
        playerOverall: 99,
        field,
        standing: clubStanding(club, league.id, WORLD),
        justPromoted,
        hasLowerDivision: WORLD.leagues.some((l) => l.countryId === league.countryId && l.tier === league.tier + 1),
      };
    };
    const titlesIn = (club: Club, justPromoted: boolean, runs: number) => {
      let titles = 0;
      for (let i = 0; i < runs; i += 1) {
        const result = simulateTrophies(rngFor(club.id, `promoted-${justPromoted}-${i}`), context(club, justPromoted));
        if (result.trophies.includes('league')) titles += 1;
      }
      return titles;
    };
    const strongest = (standing: string) =>
      WORLD.clubs
        .filter((c) => index.leagueOfClub(c.id).tier === 1 && clubStanding(c, c.leagueId, WORLD) === standing)
        .sort((a, b) => b.reputation - a.reputation)[0]!;

    const midtable = strongest('midtable');
    // If this ever reads 0 the test below proves nothing, so it is asserted.
    expect(titlesIn(midtable, false, 3000)).toBeGreaterThan(5);
    expect(titlesIn(midtable, true, 3000)).toBe(0);

    // And the story that is real stays possible: a club that belongs at the top
    // of the division is not damped by having just come up.
    const contender = strongest('title');
    expect(titlesIn(contender, true, 300)).toBeGreaterThan(20);
  });
});
