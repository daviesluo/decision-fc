import { describe, expect, it } from 'vitest';
import { WORLD } from '@bg/content';
import { createCareer, selectIdentity, type Pace } from '@bg/engine';
import { DAILY_PACE, challengeDay, dailySeed } from './daily';

describe('the daily challenge', () => {
  it('gives everyone on a given day the same career', () => {
    // Two very different local times inside one UTC day must agree, or the
    // challenge is several different challenges wearing one name.
    const morningInTokyo = new Date('2026-07-29T00:30:00Z');
    const eveningInLA = new Date('2026-07-29T23:30:00Z');
    expect(dailySeed(challengeDay(morningInTokyo))).toBe(dailySeed(challengeDay(eveningInLA)));
  });

  it('changes at the UTC date boundary and nowhere else', () => {
    expect(challengeDay(new Date('2026-07-29T23:59:59Z'))).toBe('2026-07-29');
    expect(challengeDay(new Date('2026-07-30T00:00:00Z'))).toBe('2026-07-30');
    expect(dailySeed('2026-07-29')).not.toBe(dailySeed('2026-07-30'));
  });

  it('hands everyone the same world, whatever player they build', () => {
    // The half that has to hold: the seed fixes the academy offers, the deck
    // and every roll, so two players comparing today's result are comparing
    // the same football.
    const opening = (position: 'ST' | 'GK', archetype: 'pace' | 'physical') =>
      selectIdentity(
        createCareer(dailySeed('2026-07-29'), DAILY_PACE),
        { lastName: 'A', shirtNumber: 9, foot: 'right', countryId: 'eng', position, archetype },
        WORLD,
      );
    const a = opening('ST', 'pace');
    const b = opening('GK', 'physical');
    expect(a.pending?.options.map((o) => o.clubId)).toEqual(b.pending?.options.map((o) => o.clubId));
  });

  it('is played at one pace by everyone', () => {
    // Pace changes how many cards a season deals and how far effects scale, so
    // a daily inheriting whatever the intro screen had selected was several
    // different challenges wearing one name. It is pinned; this notices if it
    // ever stops being.
    expect(DAILY_PACE satisfies Pace).toBe('standard');
  });
});
