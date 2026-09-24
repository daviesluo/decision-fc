/**
 * Domain model for the career engine.
 *
 * Everything here is plain data: serialisable, structurally cloned between
 * steps, and safe to persist. The engine never mutates a state object in
 * place — `advance()` returns a new one — so the UI can keep old states around
 * for animation, undo or replay without defensive copying.
 */

// ---------------------------------------------------------------------------
// Positions and attributes
// ---------------------------------------------------------------------------

export const POSITIONS = [
  'GK',
  'CB',
  'LB',
  'RB',
  'CDM',
  'CM',
  'CAM',
  'LM',
  'RM',
  'LW',
  'RW',
  'ST',
] as const;

/**
 * The positions a new career can actually be created with.
 *
 * LM and RM are retired (2026-08-02): the wide-midfield pair
 * overlapped the wingers on every screen and in every deck. The `Position`
 * type keeps them so old saves replay; nothing may generate them.
 */
export const PLAYABLE_POSITIONS = POSITIONS.filter((p) => p !== 'LM' && p !== 'RM');
export type Position = (typeof POSITIONS)[number];

export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'ATT';

/**
 * Six attribute slots, shared by every position so the maths stays uniform.
 *
 * Goalkeepers reuse the same slots under different display names — the mapping
 * lives in the i18n layer, not here:
 *
 *   pace      → Reflexes      dribbling → Command
 *   shooting  → Handling      defending → Positioning
 *   passing   → Distribution  physical  → Physical
 */
export const ATTRIBUTE_KEYS = [
  'pace',
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'physical',
] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

export type Attributes = Record<AttributeKey, number>;

/**
 * Attributes the player never sees a number for. They are inferred from how the
 * career actually plays out, which is the point — a scout report shows a range,
 * not a value.
 */
/**
 * A two-year development cycle: how much ability the next two seasons hold
 * and how it splits between them. Rolled by `model/growth.ts`.
 */
export interface DevelopmentCycle {
  /** The (even) age this cycle finishes at. */
  targetAge: number;
  /** OVR change for each of the two seasons. */
  annualDeltas: [number, number];
  /** Which half is served next. */
  nextPart: 0 | 1;
}

export interface HiddenAttributes {
  /**
   * Talent curve: how much ability each two-year cycle is worth, and when.
   * There is no single "potential" number — an early bloomer peaks young and
   * fades, a late one is still improving at 26. This is the ceiling.
   */
  developmentProfile: 'early' | 'normal' | 'late';
  /** Low consistency means wilder season-to-season swings, in both directions. */
  consistency: number;
  /** Injury frequency and recovery speed. */
  injuryProneness: number;
}

export const PERSONALITIES = [
  'model_professional',
  'perfectionist',
  'resolute',
  'maverick',
  'leader',
  'loner',
  'fragile',
  'party_animal',
  'loyalist',
  'mercenary',
  'reserved',
  'media_darling',
] as const;
export type Personality = (typeof PERSONALITIES)[number];

// ---------------------------------------------------------------------------
// World: countries, leagues, clubs
// ---------------------------------------------------------------------------

export type Confederation = 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC';

export interface Country {
  id: string;
  /** ISO 3166-1 alpha-2, used for the flag asset. */
  iso: string;
  confederation: Confederation;
  /** 0–100. Gates national-team call-ups. */
  reputation: number;
  /** Personal income tax rate on wages, 0–1. Saudi Arabia is the outlier at 0. */
  taxRate: number;
}

/**
 * Managers are modelled by style rather than by name. Each style prefers a
 * different attribute mix per position, which is what turns "should I join the
 * bigger club?" into a real question instead of a reputation comparison.
 */
export const MANAGER_STYLES = [
  'gegenpress',
  'possession',
  'counter',
  'low_block',
  'wing_play',
  'free_role',
] as const;
export type ManagerStyle = (typeof MANAGER_STYLES)[number];

export interface League {
  id: string;
  countryId: string;
  /** 1 = top division of that country. */
  tier: number;
  /**
   * How much a goal in this league is worth anywhere else: drives market value,
   * transfer fees, call-up thresholds and Ballon d'Or weighting.
   * Premier League 1.00 → Saudi Pro League ~0.50 → third tiers ~0.15.
   */
  strength: number;
  /**
   * What this league *pays*, relative to what it is worth on the pitch.
   *
   * Sporting quality and money are not the same number and England is the proof:
   * its broadcast deal puts an ordinary Premier League club on wages a
   * second-tier giant elsewhere would struggle to match, and the Championship
   * pays more than several European top flights. Tying wages to `strength`
   * alone made a La Liga move and a Premier League move financially
   * interchangeable, which no player has ever found to be true.
   *
   * Multiplies the wage only. Market value, fees, awards and legacy stay on
   * `strength`, because those really are about the football.
   *
   * Defaults to 1 when a league does not set it.
   */
  wageIndex?: number;
  /** Which continental competition its top clubs enter. */
  continental: ContinentalTier | null;
  /**
   * How this league behaves in the transfer market.
   *
   * `core` leagues trade with each other freely. `spinoff` leagues — the Gulf,
   * MLS, China, Japan — are money or twilight moves and never appear as an
   * ordinary next step, which is what stopped a window from offering Tottenham
   * and a Chinese second-division side side by side.
   */
  market: LeagueMarket;
}

export type LeagueMarket = 'core' | 'spinoff';

export type ContinentalTier = 'elite' | 'secondary';

export interface Club {
  id: string;
  leagueId: string;
  /**
   * Display name is deliberately a separate field from `id`. If real club names
   * ever have to be swapped for "real city + original name", it is a content
   * pack change and nothing in the engine or save format moves.
   */
  name: string;
  shortName: string;
  /** 0–100. Squad quality, so the bar you must clear to start. */
  reputation: number;
  /** 0–100. Wage budget and transfer spending power. */
  wealth: number;
  /** 0–100. Quality of coaching staff — a direct multiplier on growth. */
  training: number;
  managerStyle: ManagerStyle;
  /** Hex pair driving the generated crest and kit swatch. */
  colors: [string, string];
  /**
   * An explicit URL for the club's crest artwork. Left unset in the content
   * pack: the renderer shows the club's file in the web app's `crests/` folder,
   * or a crest generated from `colors` and the club's identity when there is
   * none. Setting this makes that URL win.
   */
  crestUrl?: string;
}

/**
 * A press outlet. Coverage is weighted by reach and by whether the outlet
 * follows the league the player is in, which is how an obscure league turns
 * into media silence.
 */
export interface Outlet {
  id: string;
  name: { en: string; zh: string };
  /** null means the outlet covers football globally. */
  countryId: string | null;
  kind: 'broadsheet' | 'tabloid' | 'insider' | 'broadcast' | 'digital';
  /** 0–100. How widely the outlet is read. */
  reach: number;
}

/**
 * A real player who is at a club when the career begins. They age forward and
 * retire on their own, so the squads turn over across a twenty-year career.
 */
export interface MarqueePlayer {
  clubId: string;
  name: string;
  position: Position;
  overall: number;
  /** Age in the 2026/27 season. */
  age: number;
  countryId: string;
}

/** A named teammate, either a marquee player or a generated squad filler. */
export interface SquadMate {
  name: string;
  position: Position;
  overall: number;
  age: number;
  countryId: string;
  /** True for real players carried in from the marquee table. */
  marquee: boolean;
}

/** Given names and surnames by country, used to generate squad-mates. */
export interface NamePool {
  first: string[];
  last: string[];
  /** Cultures where a single name is common, e.g. Brazil. */
  mono?: string[];
}

export interface World {
  countries: readonly Country[];
  leagues: readonly League[];
  clubs: readonly Club[];
  outlets: readonly Outlet[];
  marquee: readonly MarqueePlayer[];
  /** Keyed by country id, with a `default` entry as the fallback. */
  namePools: Record<string, NamePool>;
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

/**
 * Where a player stands in the squad.
 *
 * Six rungs rather than the five we had, and named for the job each one is:
 * "Regular Starter" and "Important Player" are different jobs, and
 * collapsing them lost the most interesting stretch of a career — the years
 * between getting into the side and the side being built around you.
 *
 * Ordered low to high by `ROLE_ORDER` in `model/role.ts`. The ids are part of
 * the save format and the leaderboard's replay contract, so they are stable
 * even though the words shown to the player are not.
 */
export type SquadRole =
  | 'fringe'
  | 'impact_sub'
  | 'squad'
  | 'regular'
  | 'important'
  | 'star';

export type Archetype = 'pace' | 'technical' | 'physical';

export interface Player {
  lastName: string;
  /** The kind of footballer he is: quick, technical or physical. */
  archetype: Archetype;
  shirtNumber: number;
  foot: 'left' | 'right';
  countryId: string;
  position: Position;
  age: number;
  attributes: Attributes;
  hidden: HiddenAttributes;
  personality: Personality;
  /**
   * Caught doping, once, and it never washes off.
   *
   * This replaced a general "traits" system. That system existed to hang labels
   * on a player, and all but two of the labels were never granted by anything —
   * while the one that mattered was the only lasting consequence in the deck
   * that the player could not read off his own career. `events.ts` states the
   * rule it was breaking: a consequence the player cannot see is not a
   * consequence, it is bookkeeping. This is the one that was always real — it
   * costs 350 legacy points and it is the `disgraced` ending — so it is named
   * for what it is instead of being one entry in a vocabulary of labels.
   */
  dopingBan: boolean;
  /** Derived from attributes and position weights; cached for display. */
  overall: number;
  marketValue: number;
}

/**
 * A loan spell.
 *
 * The parent club still holds the contract; the player turns out for someone
 * else. This is the main tool a young player has against being frozen out at a
 * club too good for him, and the trade it forces - level of football against
 * minutes on the pitch - is one of the better decisions in the game.
 */
export interface ActiveLoan {
  /** Where he is actually playing. */
  clubId: string;
  parentClubId: string;
  seasonsRemaining: number;
  /** Minutes the loan club promised; the whole reason to go. */
  guaranteedRole: SquadRole;
  /** Fee the loan club may sign him for at the end, when they have that right. */
  buyOption: number | null;
}

export interface Contract {
  clubId: string;
  /** Weekly wage before tax, in euros. */
  wage: number;
  yearsRemaining: number;
  /** Release clause in euros, or null when the contract has none. */
  releaseClause: number | null;
  /** Squad role the club guaranteed at signing; a floor, not a promise kept. */
  promisedRole: SquadRole;
}


/** Recurring spending commitments, chosen by the player, billed every season. */
export interface Investments {
  /** 0–3. Buys growth and cuts injury risk; the single best use of money. */
  trainingStaff: number;
  /** 0–3. Exposure and endorsement value, at the cost of professionalism. */
  lifestyle: number;
  /** Amount sunk into ventures; may compound or may go to zero. */
  ventures: number;
}

// ---------------------------------------------------------------------------
// Season records
// ---------------------------------------------------------------------------

export type TrophyId =
  | 'league'
  | 'domestic_cup'
  | 'continental_elite'
  | 'continental_secondary'
  | 'club_world_cup'
  | 'continental_nations'
  | 'world_cup';

/**
 * Individual honours. Three of them have trophy artwork; Team of the Season is
 * the one drawn medal. There were two more — League MVP and Young Player of the
 * Year — and they were cut: a cabinet full of near-identical medals reads as
 * clutter, and neither had a shape anyone would recognise.
 */
/**
 * Four, and the fourth is the only medal.
 *
 * Defender of the Season and Playmaker of the Season used to sit here, added
 * because a centre-back or a creator could play twenty seasons at the top and
 * win nothing. That gap is real and is closed on the achievements board
 * instead, where output is scored against what *that* position normally
 * produces — for every position, not for two. See `sim/awards.ts`.
 */
export type AwardId =
  | 'ballon_dor'
  | 'golden_boot'
  | 'golden_glove'
  | 'team_of_the_season';

/**
 * A season's numbers.
 *
 * Every position records every field, but only a few of them mean anything for
 * any given player — a centre-back's season is not summarised by goals and
 * assists, and showing those was making three quarters of the squad look like
 * failed strikers. `statLineFor()` picks the four that matter.
 */
export interface SeasonStats {
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  /** Average match rating, 4.0–10.0. */
  rating: number;
  /** Goalkeeping. */
  saves: number;
  goalsConceded: number;
  /** Defending. */
  tackles: number;
  interceptions: number;
  aerialsWon: number;
  /** Creating. */
  keyPasses: number;
  /** Pass completion, 0-100. */
  passAccuracy: number;
  /** Take-ons completed. */
  dribblesCompleted: number;
}

/** Which stat keys are worth showing for a position, in display order. */
export type StatKey = keyof Omit<SeasonStats, 'rating'>;

export interface SeasonRecord {
  index: number;
  /** Calendar year the season ends in, e.g. 2027 for 2026/27. */
  year: number;
  age: number;
  clubId: string;
  leagueId: string;
  /** Parent club id when the season was spent out on loan, else null. */
  onLoanFrom: string | null;
  /**
   * The position actually played this season.
   *
   * Recorded per season rather than read off the player at the end, because a
   * career can change position (`changePosition`) and the legacy score judges
   * each season's output against what *that* position is for. Scoring a
   * decade at centre-back against a striker's par is precisely the unfairness
   * the position-relative output term exists to remove.
   */
  position: Position;
  role: SquadRole;
  overallStart: number;
  overallEnd: number;
  stats: SeasonStats;
  nationalStats: SeasonStats | null;
  trophies: TrophyId[];
  awards: AwardId[];
  /** Weeks lost to injury this season, 0 when fit throughout. */
  injuryWeeks: number;
  /** The season was served under a ban: no minutes, no silverware, no growth. */
  suspended: boolean;
  injuryId: string | null;
  /**
   * Rating points this season's injury took permanently, or 0. Separate from
   * `injuryId` because most injuries take none — see `lastingOdds` — and the
   * summary needs to point at the one season that actually cost something.
   */
  injuryLasting: number;
  /** Gross wage earned across the season, before tax. */
  earnings: number;
  /** Fee the buying club paid to sign the player at the start of this season. */
  transferFee: number;
  relegated: boolean;
  promoted: boolean;
  /** What the press made of the season. */
  headlines: SeasonHeadline[];
  /** Notable names in the dressing room that season. */
  squad: SquadMate[];
}

/** One story, attributed to an outlet. Copy lives in the i18n pack. */
export interface SeasonHeadline {
  outletId: string;
  /** i18n key under `headlines.`. */
  key: string;
  params: Record<string, string | number>;
  tone: 'positive' | 'negative' | 'neutral';
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

/**
 * Every kind of card the engine can deal — and nothing else.
 *
 * `contract_renewal` and `key_moment` used to be in this union with nothing
 * building them and nothing resolving them: the renewal is an option on the
 * transfer card, and a key moment is a career event that happens to decide a
 * trophy. A kind that exists only in the type is an invitation to build a card
 * the resolver has never heard of, which is how a card comes to promise
 * something the engine does not do. `decide` now switches exhaustively over
 * this union, so adding a member without a resolver stops compiling.
 */
export type DecisionKind =
  | 'academy'
  | 'transfer'
  | 'career_event'
  | 'spending'
  | 'loan'
  | 'loan_return'
  | 'retirement';

/** A numeric consequence shown to the player before they choose. */
export interface OutcomeHint {
  /** 0–100, omitted when the outcome is certain. */
  probability?: number;
  /** i18n key describing the consequence. */
  labelKey: string;
  params?: Record<string, string | number>;
  tone: 'positive' | 'negative' | 'neutral';
  /**
   * The mechanical consequence, spelled out: "+3 OVR", "starter · 40–50 games",
   * "banned for a season". Derived from the effect itself rather than written
   * by hand, so a card can never promise something the engine does not do —
   * and so a new event gets correct labels for free.
   */
  effects?: { key: string; params?: Record<string, string | number> }[];
  /**
   * **Why the bad branch is bad**, in one clause, before he chooses.
   *
   * `effects` says *what* — "Ability −3 · Higher injury risk" — and the reason
   * lived only in the result prose, which arrives after the decision is made.
   * So a player weighing a card was told the price and never the cause: forty
   * per cent of the time the boots leave you slower, and nothing on the screen
   * said it was because boots you cannot play in also pay you nothing.
   *
   * The rule: every downside explains itself. Set on negative outcomes
   * only — a good branch needs no excuse, and a neutral one is the absence of
   * both. `packages/content` asserts that every negative outcome in the deck
   * has one, in both languages.
   */
  whyKey?: string;
}

export interface DecisionOption {
  id: string;
  labelKey: string;
  params?: Record<string, string | number>;
  /** Present when the option means joining or staying at a club. */
  clubId?: string;
  /** Contract on offer, shown inline so wages are part of the choice. */
  offer?: {
    wage: number;
    years: number;
    fee: number;
    signingBonus: number;
    releaseClause: number | null;
    promisedRole: SquadRole;
    /**
     * These are the terms he is **already on**, not terms being offered.
     *
     * Only the "go back to the parent club" option after a loan sets it, and it
     * exists because the card cannot otherwise tell the difference: a wage, a
     * length and a role rendered identically to a signing made returning to a
     * deal with one year left look like putting pen to a fresh one-year
     * contract. With this set the screen reads the length as time remaining
     * ("expires this season") rather than as a contract being signed.
     */
    existing?: boolean;
  };
  /**
   * The squad role a loan destination guarantees, for options that carry no
   * contract. A loan card has no wage or length to print, but the role is the
   * whole point of going — and it must be shown exactly where a transfer offer
   * shows its `offer.promisedRole` (the tactics line), not as a differently
   * worded outcome row. One concept, one presentation.
   */
  promisedRole?: SquadRole;
  outcomes: OutcomeHint[];
  /** Set by the event definition; consumed by the resolver. */
  effectKey?: string;
}

/** What actually happened after a gamble resolved. */
export interface DecisionResult {
  /** i18n key under `events.<eventId>.results.<key>` or a decision-specific key. */
  key: string;
  tone: 'positive' | 'negative' | 'neutral';
  params?: Record<string, string | number>;
}

export interface Decision {
  id: string;
  kind: DecisionKind;
  titleKey: string;
  bodyKey: string;
  params?: Record<string, string | number>;
  options: DecisionOption[];
}

// ---------------------------------------------------------------------------
// Career state
// ---------------------------------------------------------------------------

export type Phase = 'identity' | 'academy' | 'season' | 'summary';

export type Pace = 'quick' | 'standard' | 'deep';

/** Number of decision cards offered per season at each pace. */
export const PACE_DECISIONS: Record<Pace, number> = {
  quick: 0.5, // one card every two seasons
  standard: 1,
  deep: 2,
};

/**
 * How hard one card's lasting consequences hit, per pace. **A pace is a length
 * setting, never a difficulty setting** — the same deck has to add up to the
 * same career whichever one is chosen.
 *
 * These are *not* the reciprocals of `PACE_DECISIONS`, and assuming they were
 * is what made deep the hardest pace at the first attempt. Two things break
 * that intuition:
 *
 *  - Every event fires at most once per career, so a pace never gets its
 *    nominal cards-per-season — it gets as many as the deck can still offer.
 *    Measured over 2,500 careers each, a career sees ~10.5 event cards on
 *    quick, ~19.7 on standard and ~25.5 on deep: a 0.53 / 1 / 1.29 spread, not
 *    the 0.5 / 1 / 2 the cadence asks for.
 *  - More cards is also more exposure. Deep draws more of the deck's downside
 *    — suspensions, injuries, a doping ban — so it does not need shrinking in
 *    proportion to its card count.
 *
 * The numbers below are calibrated against the outcome, not the card count:
 * with them, mean peak ability lands within half a point across all three
 * paces on paired seeds. Re-measure with `tools/pace.ts` after adding or
 * removing events; the "every pace is the same difficulty" test asserts the
 * parity these exist to produce.
 */
/**
 * How far apart two leagues may be inside a single window of offers.
 *
 * Measured window-against-itself, not against the player: the market band is
 * centred on him, so a mid player sitting in the middle of it could draw Ligue
 * 1 and Serie B at once — each within reach of *him*, and absurd next to *each
 * other*. 0.22 keeps the big five together and keeps the second divisions with
 * each other. Spin-off leagues are exempt: the Gulf offer is deliberately from
 * another world, and it has its own gating.
 *
 * Academies and loans are deliberately not held to it — choosing between a
 * Premier League academy and a Championship one, or between better football and
 * a place in the side, is the decision those cards exist to pose.
 */
export const WINDOW_SPREAD = 0.22;

export const PACE_EFFECT_SCALE: Record<Pace, number> = {
  quick: 1.6,
  standard: 1,
  deep: 0.86,
};

export interface CareerTotals {
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  trophies: number;
  awards: number;
  /** Gross career earnings before tax — the Wealth leaderboard metric. */
  grossEarnings: number;
  netEarnings: number;
  /** Sum of every fee paid for him — the Value leaderboard metric. */
  transferFees: number;
  peakOverall: number;
  peakMarketValue: number;
  /**
   * Rating points lost permanently to injuries that never fully healed.
   *
   * Recorded so a career can be told the truth at the end: an ACL at 24 that
   * cost three points is the reason a thirty-year-old is a step slower, and
   * without this the player only ever sees the season it happened.
   */
  lastingInjuryDamage: number;
}

export interface CareerState {
  version: 1;
  seed: string;
  pace: Pace;
  phase: Phase;
  /** Monotonic counter; part of every RNG channel address. */
  step: number;
  /** Calendar year the current season ends in. */
  year: number;

  player: Player | null;
  /**
   * The identity the career STARTED with, recorded verbatim at selectIdentity.
   * Replay verification must begin from this, not from the current player —
   * position can change mid-career (the position_switch event), and a
   * submission built from the mutated player would never reproduce.
   */
  identity: IdentityInput | null;
  contract: Contract | null;
  /** Set while out on loan; the club he actually plays for. */
  loan: ActiveLoan | null;
  /** Two-year development cycle in progress; see model/growth.ts. */
  developmentCycle: DevelopmentCycle | null;
  investments: Investments;
  /** Liquid net worth in euros. */
  cash: number;

  /**
   * Clubs this career has seen promoted or relegated, as clubId → leagueId.
   *
   * The world is immutable and shared, so a division change cannot be written
   * back into it. Without somewhere to record it the flag was decoration: a
   * club "went up" every few seasons and played in the same division forever.
   * Being carried up a division — or going down with a club — is one of the
   * few things in a career that happens *to* the player rather than being
   * chosen, and it has to stick.
   *
   * Optional so careers saved before it existed still load.
   */
  leagueMoves?: Record<string, string>;

  /**
   * Clubs whose manager has changed during this career, as clubId → style.
   *
   * A new manager is the single most common reason a real career turns, in
   * either direction — the same player, the same club, a different idea of what
   * a midfielder is for. Without this the style set at world-build time held for
   * twenty years and tactical fit was a fact about the club rather than
   * something that could happen to you.
   *
   * Stored on the career for the same reason `leagueMoves` is: the world is
   * shared and immutable. Optional, so older saves still load.
   */
  managerChanges?: Record<string, ManagerStyle>;

  /**
   * A manager change **at his own club** that the player has not been told
   * about yet.
   *
   * `managerChanges` records that the club now plays a different way; it cannot
   * say what it played *before*, because it is the new value. The card that
   * breaks the news has to name both — "they pressed; he wants the ball" is the
   * whole content of the moment — so the pair is carried from the season that
   * rolled it to the summer that reports it, and cleared when it is spent.
   *
   * Optional, so older saves still load; a save written mid-summer simply does
   * not get the card.
   */
  pendingManagerChange?: { clubId: string; from: ManagerStyle; to: ManagerStyle };

  seasons: SeasonRecord[];
  totals: CareerTotals;

  /** The card currently awaiting an answer, or null while simulating. */
  pending: Decision | null;
  /** Decision option ids in order — replaying these reproduces the career. */
  history: { decisionId: string; optionId: string }[];
  /** Event cards still owed this season, from the chosen pace. */
  cardsRemaining: number;
  /** Outcome of the last resolved gamble, surfaced on the next screen. */
  lastResult: DecisionResult | null;
  /** Seasons produced since the last card, so the UI can animate the gap. */
  recentSeasons: SeasonRecord[];

  /** Transient modifiers applied to the next simulated season, then cleared. */
  modifiers: SeasonModifiers;
  /** Fee agreed in the window just closed, attributed to the next season. */
  pendingFee?: number;
  /** Season index of the last transfer window, for the interest cooldown. */
  lastWindowSeason?: number;
  /** Trophy a live key-moment card is deciding, consumed by its effect. */
  pendingTrophy?: TrophyId;
  /**
   * He chose to see this contract out and leave on a free.
   *
   * Recorded because a decision that shapes the next twelve months has to be
   * visible to everything that happens inside them. Without it the engine
   * forgot immediately: a player who had just turned down a renewal to run his
   * deal down was offered a move by the very next card, which is the game
   * contradicting the thing it had asked him a moment earlier.
   *
   * Cleared the moment he signs anything — a new deal, anywhere, ends the
   * run-down.
   */
  runningDown?: boolean;
  /** Event ids already seen, so the pool does not repeat itself. */
  seenEvents: string[];
  /** Progress through multi-chapter storylines: chapter id → step reached. */
  chapters: Record<string, number>;
  /**
   * Consecutive gamble picks that landed on the negative branch.
   *
   * Feeds the unannounced mercy rule (2026-08-02): after three
   * red results in a row, the fourth gamble resolves to its positive branch.
   * Deliberately never surfaced anywhere in the UI or the copy — the printed
   * odds stay the odds of an ordinary roll. Optional so pre-rule saves load;
   * absent reads as 0.
   */
  redStreak?: number;

  retirement: RetirementReport | null;
}

export interface SeasonModifiers {
  overallDelta: number;
  /** Temporary OVR penalty that decays after the season. */
  temporaryDelta: number;
  roleOverride: SquadRole | null;
  roleShift: number;
  leagueTrophyMultiplier: number;
  cupTrophyMultiplier: number;
  continentalTrophyMultiplier: number;
  growthMultiplier: number;
  injuryRiskMultiplier: number;
  suspended: boolean;
  forcedTransfer: boolean;
  /**
   * Key-moment override: the decisive-penalty card pre-simulates the coming
   * season, finds a final that would be won, and converts it into a coin the
   * player flips. Force = the trophy is won regardless of odds; skip = lost.
   */
  forceTrophy: TrophyId | null;
  skipTrophy: TrophyId | null;
  /**
   * The club-versus-country card, resolved. Force = he answered the call and
   * plays for his country this season whatever the selector's usual bar; skip =
   * he stayed with his club and wins no caps.
   */
  forceCallUp: boolean;
  skipCallUp: boolean;
}

export interface RetirementReport {
  age: number;
  reasonKey: string;
  legacyScore: number;
  endingId: string;
  /** Component breakdown so the summary can show where the score came from. */
  breakdown: { key: string; value: number }[];
}

export const EMPTY_MODIFIERS: SeasonModifiers = {
  overallDelta: 0,
  temporaryDelta: 0,
  roleOverride: null,
  roleShift: 0,
  leagueTrophyMultiplier: 1,
  cupTrophyMultiplier: 1,
  continentalTrophyMultiplier: 1,
  growthMultiplier: 1,
  injuryRiskMultiplier: 1,
  suspended: false,
  forcedTransfer: false,
  forceCallUp: false,
  skipCallUp: false,
  forceTrophy: null,
  skipTrophy: null,
};

export const EMPTY_TOTALS: CareerTotals = {
  appearances: 0,
  goals: 0,
  assists: 0,
  cleanSheets: 0,
  trophies: 0,
  awards: 0,
  grossEarnings: 0,
  netEarnings: 0,
  transferFees: 0,
  peakOverall: 0,
  peakMarketValue: 0,
  lastingInjuryDamage: 0,
};

/** Everything needed to start a career, supplied by the UI. */
export interface IdentityInput {
  lastName: string;
  shirtNumber: number;
  foot: 'left' | 'right';
  countryId: string;
  position: Position;
  /** The kind of footballer he is. See `model/attributes.ts`. */
  archetype: Archetype;
}
