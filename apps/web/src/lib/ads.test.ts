import { describe, expect, it } from 'vitest';
import { AD_LADDER, FREE_REPLAYS_PER_DAY, adSeconds, planFor } from './ads';

/**
 * The monetisation ladder is a product decision, not an implementation detail:
 * the numbers below were chosen deliberately and changing one is a change to
 * how the game earns. These pin them so a refactor cannot quietly re-price it.
 */
describe('the rewarded-ad ladder', () => {
  it('gives the first replay of the day away, then runs 5, 10, 15, 20, 30', () => {
    expect(AD_LADDER).toEqual([5, 10, 15, 20, 30]);
    expect(FREE_REPLAYS_PER_DAY).toBe(1);
    expect([0, 1, 2, 3, 4, 5].map(adSeconds)).toEqual([0, 5, 10, 15, 20, 30]);
    // The tenth replay of an afternoon costs the same as the sixth. Escalation
    // is there to price heavy use, not to become unusable.
    expect(adSeconds(9)).toBe(30);
    expect(adSeconds(99)).toBe(30);
  });

  it('has no overlay at all for a free replay', () => {
    expect(planFor(0)).toBeNull();
    expect(planFor(1)).not.toBeNull();
  });

  it('lets every ad past the floor be skipped at halfway', () => {
    expect(planFor(1)).toMatchObject({ seconds: 5, skipAt: 5 });
    expect(planFor(2)).toMatchObject({ seconds: 10, skipAt: 5 });
    expect(planFor(3)).toMatchObject({ seconds: 15, skipAt: 8 });
    expect(planFor(4)).toMatchObject({ seconds: 20, skipAt: 10 });
    expect(planFor(5)).toMatchObject({ seconds: 30, skipAt: 15 });
  });

  it('never puts the skip past the end of the ad', () => {
    for (let i = 1; i < 12; i += 1) {
      const plan = planFor(i)!;
      expect(plan.skipAt).toBeLessThanOrEqual(plan.seconds);
      expect(plan.skipAt).toBeGreaterThan(0);
    }
  });
});
