import { describe, expect, it } from 'vitest';
import { WORLD } from '@bg/content';
import { createCareer, decide, selectIdentity, type CareerState } from '@bg/engine';
import { bestSeasonOf, indexFor, INDEX, readSave, trophyName, turningPoints } from './game';

/**
 * The app's own logic, which the engine suite does not reach.
 *
 * Everything here decides what a player sees rather than what happens to them,
 * and all of it had zero coverage: whether a save resumes or is thrown away,
 * whether the career table names the division a club is in *now*, and which
 * moments the summary calls the ones that mattered.
 */

const BUILD = 'test-build';

/** A real career, played to the end, so the assertions are about real data. */
function played(seed = 'game-ts'): CareerState {
  let state = selectIdentity(
    createCareer(seed, 'standard'),
    {
      lastName: 'Reader',
      shirtNumber: 7,
      foot: 'right',
      countryId: 'eng',
      position: 'CAM',
      archetype: 'technical',
    },
    WORLD,
  );
  let guard = 0;
  while (state.pending && guard < 300) {
    state = decide(state, state.pending.options[0]!.id, WORLD);
    guard += 1;
  }
  return state;
}

const wrap = (state: CareerState, engine = BUILD) => JSON.stringify({ engine, state });

describe('reading a save', () => {
  it('resumes a career written by this engine, and ranks it', () => {
    const state = played();
    const loaded = readSave(wrap(state), BUILD);
    expect(loaded?.state.seed).toBe(state.seed);
    expect(loaded?.rankable).toBe(true);
  });

  it('still resumes a career written by a different engine, but will not rank it', () => {
    // The career is internally consistent; only the server's replay of it is
    // spoiled. Throwing it away would cost the player more than the board.
    const loaded = readSave(wrap(played(), 'some-older-build'), BUILD);
    expect(loaded).not.toBeNull();
    expect(loaded?.rankable).toBe(false);
  });

  it('reads an unstamped save from before the stamp existed', () => {
    const loaded = readSave(JSON.stringify(played()), BUILD);
    expect(loaded?.state.version).toBe(1);
    expect(loaded?.rankable).toBe(false);
  });

  it('discards a save from an older schema rather than crashing on it', () => {
    const state = { ...played(), version: 0 } as unknown as CareerState;
    expect(readSave(wrap(state), BUILD)).toBeNull();
  });

  it('discards a save naming a club the roster no longer has', () => {
    const state = played();
    const orphaned = {
      ...state,
      contract: { ...state.contract!, clubId: 'club-that-folded' },
    } as CareerState;
    expect(readSave(wrap(orphaned), BUILD)).toBeNull();
  });

  it('survives nothing, and garbage', () => {
    expect(readSave(null, BUILD)).toBeNull();
    expect(readSave('', BUILD)).toBeNull();
    expect(readSave('{"engine":"x","state":', BUILD)).toBeNull();
    expect(readSave('"a string"', BUILD)).toBeNull();
  });
});

/**
 * The first of several seeds whose career satisfies `has`.
 *
 * One hardcoded seed is the wrong shape for these two tests. They need a career
 * that happened to see a promotion and a change of manager, and which seed does
 * that is an accident of balance: a growth retune four files away moved the
 * fixture off a relegation and turned "the career table names the division a
 * club is in now" into a red build, with nothing wrong in the code it guards.
 *
 * Searching keeps the assertion honest — the property is still required of a
 * real played career, and `expect(found)` fails loudly if *no* seed can produce
 * one — while decoupling it from which particular seed does this month.
 */
function playedWith(has: (state: CareerState) => boolean): CareerState | null {
  for (const seed of ['game-ts', 'fixture-3', 'career-2', 'reader-2', 'fixture-2']) {
    const state = played(seed);
    if (has(state)) return state;
  }
  return null;
}

const promoted = (state: CareerState) =>
  Object.entries(state.leagueMoves ?? {}).filter(
    ([clubId, leagueId]) => leagueId !== INDEX.leagueOfClub(clubId).id,
  );

describe('the career\'s own view of the world', () => {
  it('answers with the division a club is in now, not the one it started in', () => {
    // The bug this guards has been made three times, in three different files:
    // reading the world's opening position while rendering a career that has
    // since changed it.
    const state = playedWith((s) => promoted(s).length > 0);
    expect(state, 'no seed produced a career with a promotion or relegation').not.toBeNull();
    const index = indexFor(state!);
    for (const [clubId, leagueId] of promoted(state!)) {
      expect(index.leagueOfClub(clubId).id).toBe(leagueId);
      expect(index.leagueOfClub(clubId).id).not.toBe(INDEX.leagueOfClub(clubId).id);
    }
  });

  it('applies a manager change to the club every caller reads', () => {
    const state = playedWith((s) => Object.keys(s.managerChanges ?? {}).length > 0);
    expect(state, 'no seed produced a career with a manager change').not.toBeNull();
    const changed = Object.entries(state!.managerChanges ?? {});
    for (const [clubId, style] of changed) {
      // Tactical fit reads `club.managerStyle`, so the override has to arrive
      // on the club object itself rather than beside it.
      expect(indexFor(state!).club(clubId).managerStyle).toBe(style);
    }
  });
});

describe('naming a competition', () => {
  const t = (key: string) => key;

  it('names the domestic cup after the country the club plays in', () => {
    expect(trophyName('domestic_cup', t, { clubId: 'arsenal' })).toBe('cups.eng');
    expect(trophyName('domestic_cup', t, { clubId: 'real-madrid' })).toBe('cups.esp');
  });

  it('follows the player, not the club, for international silverware', () => {
    expect(trophyName('continental_nations', t, { clubId: 'arsenal', countryId: 'bra' })).toBe(
      'nationsCups.CONMEBOL',
    );
  });

  it('falls back rather than throwing on an id the roster has dropped', () => {
    expect(trophyName('domestic_cup', t, { clubId: 'club-that-folded' })).toBe(
      'trophies.domestic_cup',
    );
  });
});

describe('turning points', () => {
  it('always names where it started, and reads in order of age', () => {
    const points = turningPoints(played());
    expect(points[0]?.kind).toBe('academy');
    const ages = points.map((p) => p.age);
    expect([...ages].sort((a, b) => a - b)).toEqual(ages);
  });

  /**
   * The summary's header and the Turning points sheet named two different
   * best seasons on one screen — a 36-year-old's six Bundesliga starts in the
   * header, a 44-game 7.37 season in the sheet. One definition now, and it
   * never picks a season he did not play half of when one he did exists.
   */
  it('names the same best season as the summary, and never a cameo year', () => {
    for (const seed of ['best-a', 'best-b', 'best-c', 'best-d']) {
      const state = played(seed);
      const best = bestSeasonOf(state);
      const peak = turningPoints(state).find((p) => p.kind === 'peak');
      expect(peak?.age, seed).toBe(best?.age);
      const half = (s: CareerState['seasons'][number]) => (s.position === 'GK' ? 19 : 15);
      if (best && state.seasons.some((s) => !s.suspended && s.stats.appearances >= half(s))) {
        expect(best.stats.appearances, seed).toBeGreaterThanOrEqual(half(best));
      }
    }
    // And the case that was found: a short season in a strong league loses to
    // a full one rated higher, whatever the division.
    const state = played('best-e');
    const template = state.seasons[0]!;
    const cameo = { ...template, index: 1, age: 36, leagueId: 'ger.1', position: 'GK' as const, trophies: [], awards: [], suspended: false, stats: { ...template.stats, appearances: 10, rating: 6.76 } };
    const full = { ...template, index: 0, age: 26, leagueId: 'eng.2', position: 'GK' as const, trophies: [], awards: [], suspended: false, stats: { ...template.stats, appearances: 44, rating: 7.37 } };
    expect(bestSeasonOf({ ...state, seasons: [full, cameo] })?.age).toBe(26);
  });

  it('names no moment twice, and nothing at all before a career has started', () => {
    const points = turningPoints(played());
    expect(new Set(points.map((p) => p.kind)).size).toBe(points.length);
    expect(turningPoints(createCareer('empty', 'standard'))).toEqual([]);
  });
});
