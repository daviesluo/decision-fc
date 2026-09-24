/**
 * Career events — the deck of decisions a career deals you.
 *
 * The rules that make the deck work:
 *
 * - **Every event fires at most once per career.** The pool is big enough
 *   that nothing needs to come round twice, and a repeated question is the
 *   fastest way to make a career feel generated rather than lived.
 * - **Gates are situational, not random.** A tax investigation needs money, a
 *   homesickness card needs a career abroad, a superteam poach needs a rival
 *   worth joining. That gating is what makes a card land as "this happened to
 *   *me*" instead of "a card came up".
 * - **Probabilities shown are the probabilities rolled.** `odds` on an option
 *   is both the number on screen and the number the engine rolls against.
 *
 * There are no hidden relationship meters behind any of this. An event that
 * only moved an invisible number was cut: if the player cannot see it, it is
 * not a consequence, it is bookkeeping.
 */

import type {
  Club,
  Country,
  League,
  Player,
  SeasonRecord,
  SquadMate,
  SquadRole,
  TrophyId,
  World,
} from '../types.js';
import type { Effect } from './effects.js';
import { callUpThreshold, tournamentThisYear } from '../sim/national.js';
import { SPINOFF_MIN_AGE } from '../model/market.js';
import { roleRank } from '../model/role.js';
import { sharesLanguage } from '../model/language.js';
import { continentalEntry } from '../sim/trophies.js';

export interface EventContext {
  player: Player;
  club: Club;
  league: League;
  country: Country;
  world: World;
  /** The role the coming season is projected to hold. */
  role: SquadRole;
  /** Consecutive seasons at the current club. */
  seasonsAtClub: number;
  lastSeason: SeasonRecord | null;
  seasonIndex: number;
  /**
   * The calendar year the coming season ends in.
   *
   * Only the international calendar needs it, and it needs it badly: a card
   * that names the tournament must not be dealt in a year that has none.
   */
  seasonYear: number;
  cash: number;
  chapters: Record<string, number>;
  wage: number;
  /** Named teammates, so events can talk about actual people. */
  squad: readonly SquadMate[];
  /**
   * What a pre-run of next season's trophy engine says the club would win —
   * the fuel for the key-moment cards. Null when nothing is on the line.
   */
  pendingTrophy: TrophyId | null;
  /**
   * Pre-resolved destinations for events that carry an inline club move, most
   * plausible first. Empty when no club fits, which gates the event off.
   *
   * A kind that means "get me out of here" resolves **two** clubs, so asking
   * to leave is a choice of where rather than a door with one room behind it.
   * `rival` and `first` stay single on purpose: those cards are about one
   * named club — the rival who came for you, the club that raised you — and a
   * second option would contradict the card's own words.
   */
  joinTargets: {
    /** A domestic rival of comparable standing. Exactly one. */
    rival: readonly string[];
    /** The club the career began at. Exactly one. */
    first: readonly string[];
    /** Clubs that would take him right now — the escape hatch. */
    escape: readonly string[];
    /** Clubs abroad, for the tax exile. */
    foreign: readonly string[];
    /** Spin-off league clubs: the money move. */
    money: readonly string[];
  };
  /**
   * He has chosen to see this contract out and leave on a free.
   *
   * No card that moves him may be dealt while it is true: he answered that
   * question one card ago, and asking it again — with a Gulf offer, of all
   * things — is the game forgetting what it just asked him.
   */
  runningDown: boolean;
  /** Whether he has ever been capped, for the nationality-switch card. */
  capped: boolean;
  /**
   * The other country he could declare for — same confederation, and better
   * than the one he has. Empty when there is nobody worth switching to, which
   * gates the card off.
   */
  switchTo: string | null;
}

export interface EventOutcome {
  /** 0–1. Omit for a certain outcome. */
  odds?: number;
  effect: Effect;
}

export interface EventOptionDef {
  id: string;
  labelKey: string;
  /**
   * Set when this option's own copy already carries a `{club}` slot, so it
   * still reads correctly once the option is split across two destinations.
   * Without it a two-destination card would print the same line twice, and
   * the crest underneath would be the only thing telling them apart.
   */
  namesClub?: boolean;
  /** Two entries means a gamble: [success, failure]. One means certainty. */
  outcomes: [EventOutcome] | [EventOutcome, EventOutcome];
}

export interface EventDef {
  id: string;
  /** Relative likelihood among all currently eligible events. */
  weight: number;
  /** Storyline this belongs to, if any. */
  chapter?: string;
  /** Required progress in `chapter` before this can fire. */
  chapterStep?: number;
  /**
   * The card is **one match**, not a season.
   *
   * Only affects what the screen says. A squad-role shift always applies from
   * then on, but "less playing time than you would have had" reads as a
   * description of the season when the card is a training decision and as a
   * description of *this* match when the card is a derby — and a player weighing
   * a derby wants to know whether the ninety minutes cost him the rest of the
   * year. Set on the four cards that really are a single
   * afternoon, and the minutes lines then read "afterwards, …".
   */
  afterMatch?: boolean;
  when: (context: EventContext) => boolean;
  options: EventOptionDef[];
}

const isOutfield = (c: EventContext) => c.player.position !== 'GK';
const isStarting = (c: EventContext) => roleRank(c.role) >= roleRank('regular');
/**
 * His club is actually in a continental competition this season. The cards
 * about European nights — the Thursday-Sunday fatigue card, the board's
 * league-or-Europe choice — must not be dealt to a club that never qualified,
 * which was the fault: a mid-table side with no European football was still
 * asked how it would juggle two competitions it was only in one of.
 */
const inContinental = (c: EventContext) => continentalEntry(c.club, c.league, c.world) !== null;
/**
 * The Thursday card is about *Thursday* — the Europa League's night. The elite
 * competition plays Tuesday and Wednesday with a squad built for it, so a card
 * that says "Thursday night, Sunday afternoon" dealt to a Champions League
 * club is wrong on its face. Only the secondary competition qualifies.
 */
const inSecondaryContinental = (c: EventContext) =>
  continentalEntry(c.club, c.league, c.world) === 'secondary';
const isBenched = (c: EventContext) => roleRank(c.role) <= roleRank('impact_sub');

/**
 * Content pack. Ids double as i18n key prefixes: `events.<id>.title`,
 * `events.<id>.body`, `events.<id>.options.<optionId>` and
 * `events.<id>.results.<key>`.
 */
export const EVENTS: readonly EventDef[] = [
  // ------------------------------------------------- inside the season
  /*
   * Match-week cards. The rest of the deck asks about a career; these ask
   * about a Saturday. They are the reason a season has texture rather than
   * being a number that arrives at the end, and they pay in the two currencies
   * a player actually feels: ability, and a place in the team — which the wage
   * follows, because the wage is priced off the role.
   */
  {
    id: 'closed_door_friendly',
    afterMatch: true,
    weight: 110,
    when: (c) => c.player.age <= 33 && roleRank(c.role) <= roleRank('squad'),
    options: [
      {
        id: 'go_hard',
        labelKey: 'go_hard',
        outcomes: [
          { odds: 0.6, effect: { overall: 2, roleShift: 1, resultKey: 'noticed', resultTone: 'positive' } },
          { odds: 0.4, effect: { overall: -1, injuryRiskMultiplier: 1.3, resultKey: 'knock', resultTone: 'negative' } },
        ],
      },
      { id: 'coast', labelKey: 'coast', outcomes: [{ effect: { resultKey: 'coasted', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'fifty_fifty',
    afterMatch: true,
    weight: 120,
    when: (c) => isOutfield(c) && c.player.age <= 34,
    options: [
      {
        id: 'go_in',
        labelKey: 'go_in',
        outcomes: [
          { odds: 0.62, effect: { overall: 2, roleShift: 1, resultKey: 'won_it', resultTone: 'positive' } },
          { odds: 0.38, effect: { overall: -2, injuryRiskMultiplier: 1.5, resultKey: 'came_off', resultTone: 'negative' } },
        ],
      },
      { id: 'pull_out', labelKey: 'pull_out', outcomes: [{ effect: { roleShift: -1, resultKey: 'pulled_out', resultTone: 'negative' } }] },
    ],
  },
  {
    id: 'play_through_it',
    weight: 100,
    when: (c) => c.player.age >= 20 && roleRank(c.role) >= roleRank('squad'),
    options: [
      {
        id: 'play',
        labelKey: 'play',
        outcomes: [
          { odds: 0.5, effect: { roleShift: 1, cupTrophyMultiplier: 1.4, resultKey: 'held_up', resultTone: 'positive' } },
          { odds: 0.5, effect: { overall: -3, injuryRiskMultiplier: 1.8, resultKey: 'made_it_worse', resultTone: 'negative' } },
        ],
      },
      { id: 'sit_out', labelKey: 'sit_out', outcomes: [{ effect: { roleShift: -1, resultKey: 'sat_out', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'derby_week',
    afterMatch: true,
    weight: 100,
    when: (c) => c.seasonsAtClub >= 1 && roleRank(c.role) >= roleRank('squad'),
    options: [
      {
        id: 'take_it_on',
        labelKey: 'take_it_on',
        outcomes: [
          { odds: 0.55, effect: { overall: 2, roleShift: 1, resultKey: 'owned_it', resultTone: 'positive' } },
          { odds: 0.45, effect: { roleShift: -1, resultKey: 'hid', resultTone: 'negative' } },
        ],
      },
      { id: 'play_safe', labelKey: 'play_safe', outcomes: [{ effect: { resultKey: 'anonymous', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'reserves_run',
    weight: 110,
    when: (c) => isBenched(c) && c.player.age <= 30,
    options: [
      {
        id: 'drop_down',
        labelKey: 'drop_down',
        outcomes: [
          /* Sharpness, not a promotion. Paying two points *and* a rung at 70%
             against an option that cost a rung and gave nothing made this the
             most one-sided card in the deck — 24 points clear, by
             `tools/deck.ts`. Going down and staying down is the risk; refusing
             is pride, and pride costs you the games rather than your place. */
          { odds: 0.7, effect: { overall: 2, resultKey: 'earned_it', resultTone: 'positive' } },
          { odds: 0.3, effect: { roleShift: -1, resultKey: 'nobody_watched', resultTone: 'negative' } },
        ],
      },
      { id: 'refuse_reserves', labelKey: 'refuse_reserves', outcomes: [{ effect: { growthMultiplier: 0.92, resultKey: 'sulked', resultTone: 'negative' } }] },
    ],
  },

  // ---------------------------------------------------------------- training
  {
    id: 'extra_training',
    weight: 100,
    when: (c) => c.player.age <= 30,
    options: [
      {
        id: 'accept',
        labelKey: 'accept',
        outcomes: [
          /* Pre-season work is the body, so it moves the body. Neither branch
             said anything about injury risk, which is how a player took the
             green outcome on a *training* card and then lost the season to a
             muscle — the two were unrelated rolls and the screen had no way of
             saying so. Now doing the work well protects you, and overdoing it
             is what leaves you fragile. */
          { odds: 0.7, effect: { overall: 3, injuryRiskMultiplier: 0.85, resultKey: 'gained', resultTone: 'positive' } },
          { odds: 0.3, effect: { overall: -2, injuryRiskMultiplier: 1.4, resultKey: 'strained', resultTone: 'negative' } },
        ],
      },
      { id: 'rest', labelKey: 'rest', outcomes: [{ effect: { resultKey: 'rested', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'preseason_camp',
    weight: 100,
    when: (c) => c.player.age <= 30,
    options: [
      {
        id: 'accept',
        labelKey: 'accept',
        outcomes: [
          { odds: 0.65, effect: { overall: 4, injuryRiskMultiplier: 0.85, resultKey: 'gained', resultTone: 'positive' } },
          { odds: 0.35, effect: { overall: -3, injuryRiskMultiplier: 1.45, resultKey: 'strained', resultTone: 'negative' } },
        ],
      },
      { id: 'rest', labelKey: 'rest', outcomes: [{ effect: { resultKey: 'rested', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'personal_coach',
    weight: 100,
    when: (c) => c.player.age <= 32,
    options: [
      {
        id: 'rework',
        labelKey: 'rework',
        outcomes: [
          /* Was ±2 at even odds — a coin flip worth exactly nothing against an
             option that costs nothing, which is a card pretending to be a
             decision. A coach who knows his job is worth taking a risk on. */
          { odds: 0.5, effect: { overall: 3, resultKey: 'clicked', resultTone: 'positive' } },
          { odds: 0.5, effect: { overall: -2, resultKey: 'lost_it', resultTone: 'negative' } },
        ],
      },
      { id: 'reject', labelKey: 'reject', outcomes: [{ effect: { resultKey: 'unchanged', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'nutrition_plan',
    weight: 100,
    when: (c) => c.player.age <= 32,
    options: [
      {
        id: 'accept',
        labelKey: 'accept',
        outcomes: [
          { odds: 0.6, effect: { overall: 3, resultKey: 'sharper', resultTone: 'positive' } },
          { odds: 0.4, effect: { overall: -2, resultKey: 'backfired', resultTone: 'negative' } },
        ],
      },
      { id: 'reject', labelKey: 'reject', outcomes: [{ effect: { resultKey: 'unchanged', resultTone: 'neutral' } }] },
    ],
  },
  {
    // The signature high-stakes card: a doubled career or a ruined one.
    id: 'mysterious_substance',
    weight: 20,
    when: (c) => c.player.age >= 18,
    options: [
      {
        id: 'take',
        labelKey: 'take',
        outcomes: [
          { odds: 0.75, effect: { overall: 5, resultKey: 'flying', resultTone: 'positive' } },
          { odds: 0.25, effect: { suspended: true, dopingBan: true, resultKey: 'caught', resultTone: 'negative' } },
        ],
      },
      { id: 'refuse', labelKey: 'refuse', outcomes: [{ effect: { resultKey: 'clean', resultTone: 'neutral' } }] },
    ],
  },
  /*
   * The two workload cards, and the fault they shared.
   *
   * Both used to name an absolute role: succeed and you are a `regular`, fail
   * and you are an `impact_sub`. That reads correctly for a squad player and
   * backwards for everybody above him — an important player who pushed
   * through the season was told, on the *winning* branch, "may drop to regular
   * starter", and a star player's card offered him a demotion at 70% and a
   * bigger demotion at 30%. Playing it in Chinese made it unmissable: 「65%
   * 可能降到常规首发 / 35% 可能降到替补奇兵」, two losses and no way to win.
   *
   * Worse, easing off was strictly dominated — a rung down and nothing back —
   * so the card had a right answer and was therefore not a decision.
   *
   * Rewritten as what the choice actually is: run yourself into the ground for
   * the shirt, or protect the body and take fewer minutes for it. Pushing
   * buys a rung or costs one; easing off costs the rung but buys back the
   * season — fewer injuries, better development, which is exactly what rest is
   * for and exactly what the old version gave you none of.
   */
  {
    id: 'season_load',
    weight: 100,
    when: (c) => roleRank(c.role) >= roleRank('squad'),
    options: [
      {
        id: 'push',
        labelKey: 'push',
        outcomes: [
          { odds: 0.7, effect: { roleShift: 1, overall: 1, resultKey: 'held_up', resultTone: 'positive' } },
          { odds: 0.3, effect: { roleShift: -1, injuryRiskMultiplier: 1.4, resultKey: 'broke_down', resultTone: 'negative' } },
        ],
      },
      {
        id: 'ease_off',
        labelKey: 'ease_off',
        outcomes: [
          { effect: { roleShift: -1, injuryRiskMultiplier: 0.85, resultKey: 'managed', resultTone: 'neutral' } },
        ],
      },
    ],
  },
  {
    id: 'double_session',
    weight: 100,
    when: (c) => roleRank(c.role) >= roleRank('squad'),
    options: [
      {
        id: 'push',
        labelKey: 'push',
        outcomes: [
          { odds: 0.65, effect: { roleShift: 1, overall: 1, growthMultiplier: 1.1, resultKey: 'held_up', resultTone: 'positive' } },
          { odds: 0.35, effect: { roleShift: -1, injuryRiskMultiplier: 1.5, resultKey: 'broke_down', resultTone: 'negative' } },
        ],
      },
      {
        id: 'ease_off',
        labelKey: 'ease_off',
        outcomes: [
          { effect: { roleShift: -1, injuryRiskMultiplier: 0.85, resultKey: 'managed', resultTone: 'neutral' } },
        ],
      },
    ],
  },
  {
    // Accepting costs ability now and gives it back once he has settled —
    // learning a new job is expensive before it pays.
    id: 'position_switch',
    weight: 100,
    when: (c) => isOutfield(c) && c.player.age >= 19,
    options: [
      {
        id: 'accept',
        labelKey: 'accept',
        outcomes: [
          /* A rung, not a rank: naming `regular` outright *promoted* a squad
             player for agreeing to learn a job he is worse at, and dropped a
             star two rungs for the same sentence.
             And it has to be able to fail. As a certainty it cost a rung and
             two points and handed three back, which is a card you always say
             yes to — a new position at a new age does not always take. */
          {
            odds: 0.7,
            effect: {
              changePosition: true,
              roleShift: -1,
              overall: -2,
              deferredOverall: 3,
              resultKey: 'switched',
              resultTone: 'neutral',
            },
          },
          {
            odds: 0.3,
            effect: {
              changePosition: true,
              roleShift: -1,
              overall: -2,
              resultKey: 'switch_failed',
              resultTone: 'negative',
            },
          },
        ],
      },
      /* Both options used to land on exactly the same number, which is a card
         that cannot be played wrong. Learning the job now pays back more than
         it cost; refusing keeps costing the rung, and a manager who has been
         told no puts less into you. */
      { id: 'refuse', labelKey: 'refuse', outcomes: [{ effect: { roleShift: -1, growthMultiplier: 0.95, resultKey: 'refused', resultTone: 'negative' } }] },
    ],
  },
  {
    id: 'position_competition',
    weight: 100,
    when: (c) => isStarting(c) && c.joinTargets.escape.length > 0,
    options: [
      {
        id: 'compete',
        labelKey: 'compete',
        outcomes: [
          /* Holding a shirt off a rival keeps what you had; it does not hand a
             star player a demotion to regular starter for winning the fight,
             which is what naming the rank did.
             It also cannot be *nothing*, which is what it was: an empty effect
             made "fight for the shirt" a branch that could only cost him — half
             the time two rungs, half the time not a single thing — so the card
             was asking whether he wanted to gamble for zero. A season spent
             holding off a signing the club paid over the odds for is a season
             that makes a player better, and now it says so. */
          { odds: 0.5, effect: { overall: 1, resultKey: 'held_off', resultTone: 'positive' } },
          { odds: 0.5, effect: { roleShift: -2, resultKey: 'lost_place', resultTone: 'negative' } },
        ],
      },
      {
        id: 'leave',
        labelKey: 'leave',
        outcomes: [{ effect: { joinClub: 'escape', resultKey: 'moved_on', resultTone: 'neutral' } }],
      },
    ],
  },
  {
    id: 'rival_prospect',
    weight: 100,
    when: (c) => c.player.age >= 23 && isStarting(c) && c.joinTargets.escape.length > 0,
    options: [
      {
        id: 'mentor',
        labelKey: 'mentor',
        outcomes: [
          {
            effect: {
              roleShift: -1,
              leagueTrophyMultiplier: 2,
              cupTrophyMultiplier: 2,
              continentalTrophyMultiplier: 2,
              resultKey: 'mentored',
              resultTone: 'positive',
            },
          },
        ],
      },
      {
        id: 'leave',
        labelKey: 'leave',
        outcomes: [{ effect: { joinClub: 'escape', resultKey: 'moved_on', resultTone: 'neutral' } }],
      },
    ],
  },
  {
    id: 'club_priority',
    weight: 100,
    when: (c) => isStarting(c) && inContinental(c) && c.league.strength >= 0.6,
    options: [
      {
        id: 'league',
        labelKey: 'league',
        outcomes: [{ effect: { leagueTrophyMultiplier: 2, continentalTrophyMultiplier: 0.5, resultKey: 'league_first', resultTone: 'neutral' } }],
      },
      {
        id: 'continental',
        labelKey: 'continental',
        outcomes: [{ effect: { continentalTrophyMultiplier: 2, leagueTrophyMultiplier: 0.5, resultKey: 'cup_first', resultTone: 'neutral' } }],
      },
    ],
  },
  {
    id: 'finish_school',
    weight: 35,
    when: (c) => c.player.age <= 22,
    options: [
      {
        id: 'study',
        labelKey: 'study',
        /* The card's own body says the classes are in the morning and the
           mornings are training. That has to be in the effect, or finishing
           school is a point of ability for nothing. */
        outcomes: [
          { odds: 0.6, effect: { overall: 2, roleShift: -1, growthMultiplier: 0.93, resultKey: 'graduated', resultTone: 'positive' } },
          { odds: 0.4, effect: { roleShift: -1, growthMultiplier: 0.93, resultKey: 'dropped_out', resultTone: 'negative' } },
        ],
      },
      { id: 'focus_football', labelKey: 'focus_football', outcomes: [{ effect: { resultKey: 'unchanged', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'controversial_statement',
    weight: 45,
    when: (c) => c.player.age >= 20 && c.joinTargets.escape.length > 0,
    options: [
      {
        id: 'apologise',
        labelKey: 'apologise',
        outcomes: [{ effect: { roleShift: -1, resultKey: 'apologised', resultTone: 'negative' } }],
      },
      {
        id: 'leave',
        labelKey: 'leave',
        outcomes: [{ effect: { joinClub: 'escape', resultKey: 'moved_on', resultTone: 'neutral' } }],
      },
    ],
  },
  {
    id: 'fan_backlash',
    weight: 80,
    when: (c) => c.player.age >= 22 && c.seasonsAtClub >= 1 && c.joinTargets.escape.length > 0,
    options: [
      {
        id: 'stay',
        labelKey: 'stay',
        outcomes: [{ effect: { overall: -2, deferredOverall: 2, resultKey: 'endured', resultTone: 'negative' } }],
      },
      {
        id: 'leave',
        labelKey: 'leave',
        outcomes: [{ effect: { joinClub: 'escape', resultKey: 'moved_on', resultTone: 'neutral' } }],
      },
    ],
  },
  {
    id: 'tax_trouble',
    weight: 25,
    when: (c) => c.player.age >= 24 && c.cash > 2_000_000 && c.joinTargets.foreign.length > 0,
    options: [
      {
        id: 'stay',
        labelKey: 'stay',
        outcomes: [{ effect: { overall: -3, deferredOverall: 3, resultKey: 'fought_it', resultTone: 'negative' } }],
      },
      {
        id: 'leave',
        labelKey: 'leave',
        outcomes: [{ effect: { joinClub: 'foreign', resultKey: 'left_country', resultTone: 'neutral' } }],
      },
    ],
  },
  {
    /*
     * A grandparent from somewhere else — one of very few cards that changes
     * something about the *player* rather than his circumstances.
     *
     * The never-capped gate is what gives it teeth: take it and the door to the
     * country you were born in closes for good, exactly as it does in the real
     * rules. It is offered only when the other country is genuinely stronger,
     * so it is a decision about ambition rather than a free upgrade nobody
     * would refuse.
     */
    id: 'foreign_grandfather',
    weight: 25,
    when: (c) => !c.capped && c.switchTo !== null && c.player.age <= 26,
    options: [
      {
        id: 'switch',
        labelKey: 'switch',
        outcomes: [{ effect: { switchNation: true, resultKey: 'switched', resultTone: 'positive' } }],
      },
      { id: 'stay', labelKey: 'stay', outcomes: [{ effect: { resultKey: 'stayed', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'rival_offer',
    weight: 80,
    when: (c) => isStarting(c) && c.club.reputation >= 66 && c.player.age <= 31 && c.joinTargets.rival.length > 0,
    options: [
      {
        id: 'join',
        labelKey: 'join',
        outcomes: [
          {
            effect: {
              joinClub: 'rival',
              role: 'squad',
              leagueTrophyMultiplier: 2,
              cupTrophyMultiplier: 2,
              continentalTrophyMultiplier: 2,
              resultKey: 'joined_rival',
              resultTone: 'positive',
            },
          },
        ],
      },
      { id: 'stay', labelKey: 'stay', outcomes: [{ effect: { resultKey: 'stayed_loyal', resultTone: 'positive' } }] },
    ],
  },
  {
    // The money move, with the cost of it stated on the card.
    id: 'saudi_approach',
    weight: 60,
    // Same age gate as the transfer window: these are twilight moves, and a
    // twenty-eight-year-old is at his peak, not the end of it.
    when: (c) => c.player.age >= SPINOFF_MIN_AGE && c.player.overall >= 70 && c.joinTargets.money.length > 0,
    options: [
      {
        id: 'take_it',
        labelKey: 'take_it',
        /**
         * One outcome, and the copy carries the whole trade.
         *
         * It used to be two — the move, then a second "and here is what it
         * costs" line with no effect on it. The resolver reads two outcomes and
         * branches on the *first* one's odds, and this option had none, so the
         * second line could never be reached: the card printed a consequence
         * the engine was incapable of producing. `pnpm fairness` now fails the
         * build on that shape, whatever card grows it next.
         */
        outcomes: [
          { effect: { joinClub: 'money', role: 'star', resultKey: 'took_it', resultTone: 'positive' } },
        ],
      },
      { id: 'refuse', labelKey: 'refuse', outcomes: [{ effect: { resultKey: 'stayed_competitive', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'triumphant_return',
    weight: 50,
    when: (c) => c.player.age >= 32 && c.joinTargets.first.length > 0,
    options: [
      {
        id: 'return',
        labelKey: 'return',
        outcomes: [{ effect: { joinClub: 'first', role: 'important', resultKey: 'came_home', resultTone: 'positive' } }],
      },
      { id: 'decline', labelKey: 'decline', outcomes: [{ effect: { resultKey: 'stayed_put', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'national_team_conflict',
    weight: 20,
    // Only when his country would genuinely call him up. At 72 the card fired
    // for players an England squad would never look at, so "your country wants
    // you" was the card inventing an interest nobody had.
    // Only in a summer that actually holds one. The card names the tournament
    // now, and there is no naming a World Cup in 2029: an unnamed "a
    // tournament" was the vaguer version of the same card, and a named one in
    // an empty year would be worse than either.
    when: (c) =>
      c.player.age >= 20 &&
      c.player.overall >= callUpThreshold(c.country, c.league.strength) &&
      tournamentThisYear(c.seasonYear) !== null,
    options: [
      {
        id: 'go',
        labelKey: 'go',
        /* Defying the club costs standing in proportion to what you had. Named
           as `impact_sub` it *promoted* a fringe player for going. */
        outcomes: [{ effect: { roleShift: -2, growthMultiplier: 0.95, forceCallUp: true, resultKey: 'went_anyway', resultTone: 'neutral' } }],
      },
      { id: 'obey', labelKey: 'obey', outcomes: [{ effect: { skipCallUp: true, resultKey: 'obeyed', resultTone: 'neutral' } }] },
    ],
  },

  // ------------------------------------------------------------ key moments
  {
    /*
      * The trophy engine has already been run for next season and found
      * silverware this club goes on to win — this penalty decides whether it
      * actually happens. A flat coin.
      *
      * The domestic cup used to be excluded, which was backwards twice over: a
      * cup final is the one game in football that really is decided from the
      * spot, and the cup is the trophy an ordinary club actually reaches. With
      * it excluded only **12.8%** of careers ever met a key moment — four
      * players in five never got the single card this game is built to be
      * remembered for, and the ones who missed out were the ones at clubs that
      * win nothing else.
      */
    id: 'decisive_penalty',
    weight: 420,
    when: (c) => c.pendingTrophy !== null && isStarting(c) && isOutfield(c),
    options: [
      {
        id: 'left',
        labelKey: 'left',
        outcomes: [
          { odds: 0.5, effect: { forcePendingTrophy: true, resultKey: 'scored', resultTone: 'positive' } },
          { odds: 0.5, effect: { skipPendingTrophy: true, overall: -1, resultKey: 'saved', resultTone: 'negative' } },
        ],
      },
      {
        id: 'right',
        labelKey: 'right',
        outcomes: [
          { odds: 0.5, effect: { forcePendingTrophy: true, resultKey: 'scored', resultTone: 'positive' } },
          { odds: 0.5, effect: { skipPendingTrophy: true, overall: -1, resultKey: 'saved', resultTone: 'negative' } },
        ],
      },
    ],
  },
  {
    // The goalkeeper's mirror image — you are the one diving.
    id: 'decisive_save',
    weight: 420,
    when: (c) => c.pendingTrophy !== null && isStarting(c) && c.player.position === 'GK',
    options: [
      {
        id: 'left',
        labelKey: 'left',
        outcomes: [
          { odds: 0.5, effect: { forcePendingTrophy: true, resultKey: 'saved_it', resultTone: 'positive' } },
          { odds: 0.5, effect: { skipPendingTrophy: true, overall: -1, resultKey: 'beaten', resultTone: 'negative' } },
        ],
      },
      {
        id: 'right',
        labelKey: 'right',
        outcomes: [
          { odds: 0.5, effect: { forcePendingTrophy: true, resultKey: 'saved_it', resultTone: 'positive' } },
          { odds: 0.5, effect: { skipPendingTrophy: true, overall: -1, resultKey: 'beaten', resultTone: 'negative' } },
        ],
      },
    ],
  },
  {
    id: 'injury_at_peak',
    weight: 60,
    when: (c) => c.pendingTrophy !== null && isStarting(c) && c.player.age >= 20,
    options: [
      {
        id: 'play',
        labelKey: 'play',
        outcomes: [
          { odds: 0.8, effect: { forcePendingTrophy: true, overall: -1, injuryRiskMultiplier: 1.25, resultKey: 'limped_over', resultTone: 'positive' } },
          { odds: 0.2, effect: { skipPendingTrophy: true, overall: -2, injuryRiskMultiplier: 1.5, resultKey: 'broke_down', resultTone: 'negative' } },
        ],
      },
      {
        id: 'rest',
        labelKey: 'rest',
        outcomes: [
          { odds: 0.3, effect: { forcePendingTrophy: true, resultKey: 'won_without', resultTone: 'positive' } },
          { odds: 0.7, effect: { skipPendingTrophy: true, resultKey: 'lost_without', resultTone: 'negative' } },
        ],
      },
    ],
  },
  {
    id: 'play_through_injury',
    weight: 45,
    when: (c) => isStarting(c) && c.player.age >= 21,
    options: [
      {
        id: 'play',
        labelKey: 'play',
        outcomes: [
          /* Getting away with it means getting away with it. The old pair
             demoted a star on both branches — 55% "may drop to regular
             starter" against 45% "may drop to impact sub" — so the gamble had
             no winning side. */
          { odds: 0.55, effect: { roleShift: 1, leagueTrophyMultiplier: 1.3, cupTrophyMultiplier: 1.3, resultKey: 'got_away', resultTone: 'positive' } },
          { odds: 0.45, effect: { overall: -3, roleShift: -1, injuryRiskMultiplier: 1.3, resultKey: 'made_it_worse', resultTone: 'negative' } },
        ],
      },
      /* Coming back right is worth something — that is the whole argument the
         physio is making, and without it the card was "lose a little" against
         "lose a lot", which nobody has to think about. */
      { id: 'recover', labelKey: 'recover', outcomes: [{ effect: { roleShift: -1, injuryRiskMultiplier: 0.8, resultKey: 'recovered', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'frozen_out',
    weight: 70,
    when: (c) => isBenched(c) && c.seasonsAtClub >= 1 && c.joinTargets.escape.length > 0,
    options: [
      {
        id: 'wait',
        labelKey: 'wait',
        outcomes: [
          { odds: 0.35, effect: { role: 'squad', resultKey: 'won_him_over', resultTone: 'positive' } },
          { odds: 0.65, effect: { roleShift: -1, resultKey: 'still_out', resultTone: 'negative' } },
        ],
      },
      {
        id: 'leave',
        labelKey: 'leave',
        outcomes: [{ effect: { joinClub: 'escape', resultKey: 'moved_on', resultTone: 'neutral' } }],
      },
    ],
  },
  /* ------------------------------------------------------------------ *
   * Twenty cards added in the deck expansion. The deck was 30, and with a
   * career drawing 18.6 event cards it was dealing 62% of itself in a single
   * playthrough — while `events.ts` opened by claiming the pool was big
   * enough that nothing needed to come round twice.
   *
   * Each one is told where the career actually happens: the loan market, the
   * agent, the January window, the winter break, the new manager's first
   * meeting.
   * ------------------------------------------------------------------ */
  {
    id: 'agent_change',
    weight: 90,
    when: (c) => c.player.age >= 19 && c.player.age <= 32,
    options: [
      {
        id: 'switch',
        labelKey: 'switch',
        outcomes: [
          { odds: 0.55, effect: { wageMultiplier: 1.18, cashWeeks: -3, resultKey: 'better_deals', resultTone: 'positive' } },
          { odds: 0.45, effect: { cashWeeks: -6, resultKey: 'paid_for_nothing', resultTone: 'negative' } },
        ],
      },
      { id: 'stay_loyal', labelKey: 'stay_loyal', outcomes: [{ effect: { resultKey: 'kept_him', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'captain_armband',
    weight: 80,
    when: (c) => c.seasonsAtClub >= 3 && roleRank(c.role) >= roleRank('important') && c.player.age >= 25,
    options: [
      {
        id: 'take_it',
        labelKey: 'take_it',
        outcomes: [
          { odds: 0.6, effect: { overall: 2, roleShift: 1, leagueTrophyMultiplier: 1.15, resultKey: 'led_them', resultTone: 'positive' } },
          { odds: 0.4, effect: { temporary: -2, resultKey: 'weight_of_it', resultTone: 'negative' } },
        ],
      },
      { id: 'decline_armband', labelKey: 'decline_armband', outcomes: [{ effect: { resultKey: 'just_play', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'new_manager_meeting',
    weight: 110,
    when: (c) => c.seasonsAtClub >= 1 && c.player.age >= 18,
    options: [
      {
        id: 'make_the_case',
        labelKey: 'make_the_case',
        /* A rung, not a rank. Naming `regular` outright told a star player his
           reward for walking into that room and arguing for his place was a
           demotion to regular starter — on the branch where the manager
           agreed with him. */
        outcomes: [
          { odds: 0.5, effect: { roleShift: 1, resultKey: 'convinced_him', resultTone: 'positive' } },
          { odds: 0.5, effect: { roleShift: -1, resultKey: 'marked_card', resultTone: 'negative' } },
        ],
      },
      { id: 'let_work_talk', labelKey: 'let_work_talk', outcomes: [{ effect: { growthMultiplier: 1.1, roleShift: -1, resultKey: 'kept_head_down', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'winter_break',
    weight: 95,
    when: (c) => c.player.age >= 19,
    options: [
      {
        id: 'train_through',
        labelKey: 'train_through',
        outcomes: [
          { odds: 0.65, effect: { overall: 2, resultKey: 'came_back_sharp', resultTone: 'positive' } },
          { odds: 0.35, effect: { injuryRiskMultiplier: 1.35, resultKey: 'came_back_flat', resultTone: 'negative' } },
        ],
      },
      { id: 'switch_off', labelKey: 'switch_off', outcomes: [{ effect: { injuryRiskMultiplier: 0.75, resultKey: 'rested', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'january_window_itch',
    weight: 85,
    when: (c) => roleRank(c.role) <= roleRank('impact_sub') && c.player.age >= 20 && c.seasonsAtClub >= 1,
    options: [
      {
        id: 'ask_to_leave',
        labelKey: 'ask_to_leave',
        outcomes: [{ effect: { joinClub: 'escape', resultKey: 'got_out', resultTone: 'neutral' } }],
      },
      {
        id: 'fight_for_it',
        labelKey: 'fight_for_it',
        outcomes: [
          { odds: 0.45, effect: { role: 'regular', overall: 1, resultKey: 'won_place_back', resultTone: 'positive' } },
          { odds: 0.55, effect: { roleShift: -1, resultKey: 'still_out_of_it', resultTone: 'negative' } },
        ],
      },
    ],
  },
  {
    id: 'boot_deal',
    weight: 85,
    when: (c) => c.player.age >= 20 && roleRank(c.role) >= roleRank('squad'),
    options: [
      {
        id: 'sign_big',
        labelKey: 'sign_big',
        outcomes: [
          /* The money is what the boots working out is worth, not a fee that
             lands whatever happens. An exclusive you break because you cannot
             play in them pays nothing — you go back to your own pair, and the
             half-season you spent in the wrong ones is what it cost. The
             fairer version of the card, deliberately. */
          { odds: 0.6, effect: { cashWeeks: 45, resultKey: 'money_landed', resultTone: 'positive' } },
          /* A point of ability rather than a point of pace, deliberately, and
             the better shape: half a season in boots you cannot play in does
             not make you specifically slower, it makes you worse, and the
             attribute chip made the card read as a card about legs. */
          { odds: 0.4, effect: { overall: -1, resultKey: 'boots_hurt', resultTone: 'negative' } },
        ],
      },
      { id: 'keep_own_boots', labelKey: 'keep_own_boots', outcomes: [{ effect: { resultKey: 'same_boots', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'set_piece_duty',
    weight: 90,
    when: (c) => isOutfield(c) && roleRank(c.role) >= roleRank('regular'),
    options: [
      {
        id: 'take_them',
        labelKey: 'take_them',
        outcomes: [
          /* Was `attributes: { shooting: 2, passing: 1 }` — the attribute bars
             left the screen, so a card promising "+2 shooting" promised a
             change to a number the player can no longer see. The same prize in
             the currency he can: one point of overall. */
          { odds: 0.55, effect: { overall: 1, resultKey: 'they_go_in', resultTone: 'positive' } },
          { odds: 0.45, effect: { temporary: -1, resultKey: 'wasted_them', resultTone: 'negative' } },
        ],
      },
      { id: 'leave_them', labelKey: 'leave_them', outcomes: [{ effect: { resultKey: 'someone_else_takes', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'language_lessons',
    weight: 80,
    when: (c) => !sharesLanguage(c.league.countryId, c.player.countryId) && c.seasonsAtClub <= 2,
    options: [
      /*
       * Standing against development, which is what the choice actually is.
       *
       * Learning it used to hand over a place in the side *and* twelve per cent
       * more development against an option that did nothing — a free lunch, and
       * a card with a free lunch on it is not a decision. The hours are the
       * cost, and they are real: evenings with a tutor are evenings not in the
       * gym. So the language buys the dressing room, and the translator buys
       * the time back.
       */
      {
        id: 'learn_it',
        labelKey: 'learn_it',
        /* Three mornings a week are three mornings, and not everybody gets
           there. Learning it buys the dressing room when it takes; the
           translator buys the hours back and costs you the room. Neither is
           free, which is the whole card. */
        outcomes: [
          { odds: 0.7, effect: { roleShift: 1, growthMultiplier: 0.9, resultKey: 'dressing_room_opened', resultTone: 'positive' } },
          { odds: 0.3, effect: { growthMultiplier: 0.85, resultKey: 'never_got_there', resultTone: 'negative' } },
        ],
      },
      {
        id: 'use_translator',
        labelKey: 'use_translator',
        outcomes: [{ effect: { growthMultiplier: 1.1, roleShift: -1, resultKey: 'through_a_translator', resultTone: 'neutral' } }],
      },
    ],
  },
  {
    id: 'sports_science',
    weight: 85,
    when: (c) => c.player.age >= 28,
    options: [
      {
        id: 'buy_in',
        labelKey: 'buy_in',
        /* A programme you pay for yourself and that might not suit you. It
           was a certainty worth fifteen points against an option worth
           nothing, which is not a decision — the risk is that the money buys
           you a folder of numbers and another season of the same body. */
        outcomes: [
          { odds: 0.7, effect: { cashWeeks: -10, deferredOverall: 2, injuryRiskMultiplier: 0.8, resultKey: 'body_holds', resultTone: 'positive' } },
          { odds: 0.3, effect: { cashWeeks: -10, resultKey: 'body_ignored_it', resultTone: 'negative' } },
        ],
      },
      { id: 'trust_the_body', labelKey: 'trust_the_body', outcomes: [{ effect: { resultKey: 'always_managed', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'youth_rival_signed',
    weight: 95,
    when: (c) => c.player.age <= 24 && roleRank(c.role) <= roleRank('regular') && c.seasonsAtClub >= 1,
    options: [
      {
        id: 'raise_your_game',
        labelKey: 'raise_your_game',
        outcomes: [
          { odds: 0.5, effect: { overall: 3, roleShift: 1, resultKey: 'saw_off_the_kid', resultTone: 'positive' } },
          { odds: 0.5, effect: { roleShift: -1, resultKey: 'kid_won', resultTone: 'negative' } },
        ],
      },
      { id: 'ask_the_question', labelKey: 'ask_the_question', outcomes: [{ effect: { joinClub: 'escape', resultKey: 'moved_for_minutes', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'testimonial',
    weight: 70,
    /*
     * Six seasons, not eight.
     *
     * Eight consecutive seasons at one club is a career shape almost nobody
     * has: the card reached **0.2% of careers** across 1,727 played through the
     * screen, which is content written, translated, balanced and then shown to
     * one player in five hundred. Six is still a long stay — long enough that
     * the club would really put a night on for him — and it is the same length
     * the loyalty bonus already pays out at.
     */
    when: (c) => c.seasonsAtClub >= 6,
    options: [
      /*
       * A million euros against nothing is not a decision either.
       *
       * Giving the gate away has to buy something the game actually has, and
       * it does: a man who hands a full house to the academy he came through
       * is the man that club builds its dressing room around. The money and
       * the standing are both real, and neither is free.
       */
      {
        id: 'have_it',
        labelKey: 'have_it',
        outcomes: [
          /* Forty weeks, not thirty. `pnpm deck` had this option risking ten
             points against an alternative worth the same in expectation —
             taking the gate was a coin flip you were paid nothing to take, so
             giving it away was simply the better read and the card had a right
             answer. A full house for a man six years at the club is a big
             night, and it is now priced like one. */
          { odds: 0.7, effect: { cashWeeks: 42, resultKey: 'full_house', resultTone: 'positive' } },
          { odds: 0.3, effect: { cashWeeks: 8, roleShift: -1, resultKey: 'half_empty', resultTone: 'negative' } },
        ],
      },
      {
        id: 'give_it_away',
        labelKey: 'give_it_away',
        outcomes: [{ effect: { roleShift: 1, resultKey: 'gave_the_gate', resultTone: 'positive' } }],
      },
    ],
  },
  {
    id: 'referee_row',
    afterMatch: true,
    weight: 90,
    when: (c) => c.player.age >= 21 && roleRank(c.role) >= roleRank('squad'),
    options: [
      {
        id: 'say_it',
        labelKey: 'say_it',
        outcomes: [
          /* Three matches, not a year.
            *
            * The effect was `suspended`, which freezes the role at fringe for
            * the whole season, stops development and rules out the national
            * squad — a 34-point gap from walking away, so the card had a right
            * answer and was therefore not a decision. The *copy* had it right
            * all along: a touchline rant costs three games and a clip that
            * follows you around. The effect now says what the copy says. */
          /* 0.4 and two points, not 0.35 and one. The ban was priced honestly
             and the upside was not: saying it risked eight points against
             walking away for no premium at all. A dressing room that backs a
             man who spoke for them is worth more than a single point, and it
             happens more often than a third of the time. */
          { odds: 0.4, effect: { roleShift: 1, overall: 2, resultKey: 'squad_backed_you', resultTone: 'positive' } },
          { odds: 0.6, effect: { roleShift: -1, growthMultiplier: 0.95, resultKey: 'banned_for_it', resultTone: 'negative' } },
        ],
      },
      { id: 'walk_away', labelKey: 'walk_away', outcomes: [{ effect: { resultKey: 'said_nothing', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'position_switch_offer',
    weight: 75,
    when: (c) => isOutfield(c) && c.player.age >= 28 && roleRank(c.role) <= roleRank('regular'),
    options: [
      {
        id: 'drop_deeper',
        labelKey: 'drop_deeper',
        /* Learning a deeper role at twenty-eight is not a guarantee, and as a
           certainty it was twelve points of free upside against an option that
           did nothing at all. It buys years when it takes; when it does not,
           you have given up the position you were good at. */
        outcomes: [
          { odds: 0.65, effect: { changePosition: true, roleShift: 1, resultKey: 'new_position', resultTone: 'positive' } },
          { odds: 0.35, effect: { changePosition: true, overall: -2, resultKey: 'never_took', resultTone: 'negative' } },
        ],
      },
      { id: 'stay_where_you_are', labelKey: 'stay_where_you_are', outcomes: [{ effect: { resultKey: 'kept_the_shirt', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'transfer_request_leak',
    weight: 80,
    when: (c) => c.seasonsAtClub >= 2 && roleRank(c.role) >= roleRank('regular') && c.player.age >= 22,
    options: [
      {
        id: 'deny_it',
        labelKey: 'deny_it',
        outcomes: [
          /* A denial that lands is worth more than a rung. The crowd taking
             your word for it in a week when the story said you wanted out is
             the week a manager decides you are his — so it carries a point of
             ability as well, and it lands more often than not. Before this,
             denying the story risked eight points against letting it stand for
             no premium, which made the brave answer the wrong one. */
          { odds: 0.65, effect: { roleShift: 1, overall: 1, resultKey: 'crowd_believed_you', resultTone: 'positive' } },
          { odds: 0.35, effect: { temporary: -2, resultKey: 'nobody_believed_you', resultTone: 'negative' } },
        ],
      },
      /* Saying nothing is not martyrdom: the move it forces is a move somebody
         wanted, and it comes with the pay rise a signing usually carries.
         Without that, denying the story could not do worse than letting it
         stand, and a gamble that cannot lose is not one. */
      { id: 'let_it_stand', labelKey: 'let_it_stand', outcomes: [{ effect: { forceTransfer: true, wageMultiplier: 1.12, resultKey: 'door_opened', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'charity_match',
    weight: 70,
    when: (c) => c.player.age >= 24,
    options: [
      {
        id: 'play_it',
        labelKey: 'play_it',
        outcomes: [
          /* Ninety minutes in July against players who can still play is
             pre-season, and it shows. Without it the card was "risk an ankle
             for nothing" against "write a cheque", and both came to the same
             number. */
          { odds: 0.8, effect: { overall: 1, resultKey: 'good_afternoon', resultTone: 'positive' } },
          { odds: 0.2, effect: { injuryRiskMultiplier: 1.4, resultKey: 'went_over_on_it', resultTone: 'negative' } },
        ],
      },
      { id: 'send_a_cheque', labelKey: 'send_a_cheque', outcomes: [{ effect: { cashWeeks: -8, resultKey: 'wrote_the_cheque', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'contract_leak',
    weight: 80,
    when: (c) => c.wage > 0 && c.seasonsAtClub >= 1 && c.player.age >= 23,
    options: [
      {
        id: 'front_it_out',
        labelKey: 'front_it_out',
        outcomes: [
          { odds: 0.5, effect: { roleShift: 1, resultKey: 'blew_over', resultTone: 'positive' } },
          { odds: 0.5, effect: { temporary: -2, resultKey: 'never_lived_it_down', resultTone: 'negative' } },
        ],
      },
      { id: 'take_a_cut', labelKey: 'take_a_cut', outcomes: [{ effect: { wageMultiplier: 0.85, roleShift: 1, resultKey: 'bought_goodwill', resultTone: 'positive' } }] },
    ],
  },
  {
    id: 'europa_thursday',
    weight: 85,
    when: (c) =>
      c.league.strength >= 0.6 &&
      inSecondaryContinental(c) &&
      roleRank(c.role) >= roleRank('squad') &&
      c.player.age >= 20,
    options: [
      {
        id: 'play_both',
        labelKey: 'play_both',
        outcomes: [
          { odds: 0.5, effect: { continentalTrophyMultiplier: 1.5, roleShift: 1, injuryRiskMultiplier: 1.3, resultKey: 'ran_it_all', resultTone: 'positive' } },
          { odds: 0.5, effect: { leagueTrophyMultiplier: 0.85, temporary: -1, resultKey: 'legs_went', resultTone: 'negative' } },
        ],
      },
      { id: 'save_yourself', labelKey: 'save_yourself', outcomes: [{ effect: { leagueTrophyMultiplier: 1.2, continentalTrophyMultiplier: 0.7, resultKey: 'picked_the_league', resultTone: 'neutral' } }] },
    ],
  },
  {
    id: 'coaching_badges',
    weight: 75,
    when: (c) => c.player.age >= 31,
    options: [
      {
        id: 'start_them',
        labelKey: 'start_them',
        /* Two weeks of classrooms in the close season while everybody else
           rests, and a dressing room that reads it as a man planning his
           retirement. Both are real, and neither was on the card. */
        outcomes: [
          /* Two deferred points, not one, and two thirds rather than three
             fifths. A thirty-one-year-old who spends a summer learning how the
             game is coached genuinely reads it better the following season —
             that is the whole reason players do it — and the old numbers made
             it a five-point risk for nothing, so not going was always right. */
          { odds: 0.65, effect: { cashWeeks: -4, deferredOverall: 2, growthMultiplier: 0.94, resultKey: 'reading_the_game', resultTone: 'positive' } },
          { odds: 0.35, effect: { cashWeeks: -4, growthMultiplier: 0.9, resultKey: 'classroom_only', resultTone: 'negative' } },
        ],
      },
      { id: 'not_yet', labelKey: 'not_yet', outcomes: [{ effect: { resultKey: 'still_playing', resultTone: 'neutral' } }] },
    ],
  },
];

export function eligibleEvents(context: EventContext, seen: readonly string[]): EventDef[] {
  const seenSet = new Set(seen);
  return EVENTS.filter((event) => {
    // Every event happens at most once per career. The pool is large enough
    // that no card ever needs to come around twice.
    if (seenSet.has(event.id)) return false;
    if (event.chapterStep !== undefined && (context.chapters[event.chapter ?? ''] ?? 0) < event.chapterStep) {
      return false;
    }
    // Nobody is offered a move before they have played a season for the club
    // they just signed for. Cards that carry a transfer wait a year.
    const movesClub = event.options.some((option) => option.outcomes.some((o) => o.effect.joinClub));
    if (movesClub && context.seasonsAtClub < 1) return false;
    // A player running his deal down has already decided where he is until it
    // expires. Gated here rather than card by card so a card written later
    // cannot reintroduce it.
    if (movesClub && context.runningDown) return false;
    try {
      return event.when(context);
    } catch {
      return false;
    }
  });
}
