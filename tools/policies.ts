/**
 * How a player can decide, written as code — shared by `pnpm skill`, which
 * measures how much deciding matters, and `pnpm seed:boards`, which fills the
 * leaderboards with careers that were played rather than coin-flipped.
 *
 * Moved out of `tools/skill.ts` unchanged, so the skill gate's numbers could
 * not move with it.
 */
import { WORLD } from '../packages/content/src/index.js';
import { indexWorld, roleRank, type CareerState } from '../packages/engine/src/index.js';

export const indexFor = (state: CareerState) => indexWorld(WORLD, state.leagueMoves, state.managerChanges);

/**
 * How attractive an option looks, on the axes a player can actually read off
 * the card: the club's standing, the division, and the squad role promised.
 * Deliberately the same information the screen shows — a policy that read
 * hidden state would measure the engine's omniscience, not a player's skill.
 */
export function appeal(state: CareerState, optionIndex: number): number {
  const option = state.pending!.options[optionIndex]!;
  if (!option.clubId) return -Infinity;
  const index = indexFor(state);
  let club;
  try {
    club = index.club(option.clubId);
  } catch {
    return -Infinity;
  }
  const league = index.leagueOfClub(club.id);
  const role = option.offer ? roleRank(option.offer.promisedRole) : 0;
  return club.reputation + league.strength * 25 + role * 4;
}

export type Policy = (state: CareerState, rng: () => number) => string;

export const POLICIES: { name: string; play: Policy }[] = [
  {
    // Chase the level. Always the biggest club and the best role on offer.
    name: 'ambitious',
    play: (state) => {
      const options = state.pending!.options;
      let best = 0;
      for (let i = 1; i < options.length; i += 1) {
        if (appeal(state, i) > appeal(state, best)) best = i;
      }
      return options[best]!.id;
    },
  },
  {
    /**
     * The one that knows what the game is about: go as high as you can *and
     * still play*. Among options that promise a starting place it takes the
     * biggest club; only when none does will it take the best on offer.
     *
     * If this beats `ambitious`, then the skill in this game is not "click the
     * famous badge" — it is reading a squad role against your own ability,
     * which is the decision the whole squad ladder was built to pose.
     */
    name: 'shrewd',
    play: (state) => {
      const options = state.pending!.options;
      const starting = options
        .map((option, i) => ({ option, i }))
        .filter(({ option }) => option.offer && roleRank(option.offer.promisedRole) >= roleRank('regular'));
      const pool = starting.length > 0 ? starting.map((x) => x.i) : options.map((_, i) => i);
      let best = pool[0]!;
      for (const i of pool) if (appeal(state, i) > appeal(state, best)) best = i;
      return options[best]!.id;
    },
  },
  {
    // Stay put wherever staying is on the table; otherwise the smallest step.
    name: 'loyal',
    play: (state) => {
      const options = state.pending!.options;
      const stay = options.find((o) => o.id.startsWith('stay:'));
      if (stay) return stay.id;
      let worst = 0;
      for (let i = 1; i < options.length; i += 1) {
        if (appeal(state, i) < appeal(state, worst)) worst = i;
      }
      return options[worst]!.id;
    },
  },
  {
    // Never take a step up. The floor of what deliberate play can produce.
    name: 'unambitious',
    play: (state) => {
      const options = state.pending!.options;
      let worst = 0;
      for (let i = 1; i < options.length; i += 1) {
        if (appeal(state, i) < appeal(state, worst)) worst = i;
      }
      return options[worst]!.id;
    },
  },
  { name: 'random', play: (state, rng) => {
      const options = state.pending!.options;
      return options[Math.floor(rng() * options.length)]!.id;
    },
  },
];
