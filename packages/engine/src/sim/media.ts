/**
 * Press coverage.
 *
 * After each season the engine asks what was worth writing about and picks an
 * outlet to write it, weighted by reach and by whether the outlet covers the
 * league the player is in. Two consequences fall out of that weighting and both
 * are deliberate:
 *
 *   - a great season in a weak league gets one line from a wire service, while
 *     the same season in the Premier League gets four outlets arguing about it;
 *   - the transfer insider outranks everyone on transfer news specifically,
 *     which is exactly how the real ecosystem works.
 *
 * Headline text lives in the i18n pack keyed by `headlines.<key>`, so the copy
 * is localised and the engine only decides *what* is newsworthy.
 */

import type { Club, Country, League, Outlet, SeasonRecord, Player } from '../types.js';
import { clamp, weightedPick, type Rng } from '../rng.js';

export interface Headline {
  outletId: string;
  /** i18n key under `headlines.`. */
  key: string;
  params: Record<string, string | number>;
  tone: 'positive' | 'negative' | 'neutral';
}

interface Candidate {
  key: string;
  /** Higher wins when several stories compete for the same season. */
  priority: number;
  tone: Headline['tone'];
  params: Record<string, string | number>;
  /** Only the insider reports this kind of story. */
  insiderOnly?: boolean;
}

export interface MediaContext {
  player: Player;
  club: Club;
  league: League;
  country: Country;
  season: SeasonRecord;
  previous: SeasonRecord | null;
  outlets: readonly Outlet[];
  /** 0–100. A well-liked player gets kinder framing on the same facts. */
  mediaRelationship: number;
  /** True when the club the player just joined is in a far weaker league. */
  tookTheMoney: boolean;
}

/** Decide what happened that was worth reporting. */
function candidatesFor(context: MediaContext): Candidate[] {
  const { season, player, club, previous } = context;
  const out: Candidate[] = [];
  // Club params carry the *id*; the UI resolves it to a localized name. Baking
  // the English display name in here froze the language of every old headline.
  const club_ = club.id;

  if (season.transferFee > 0) {
    out.push({
      key: 'transfer_fee',
      priority: 70,
      tone: 'neutral',
      params: { club: club_, fee: season.transferFee },
      insiderOnly: true,
    });
  } else if (previous && previous.clubId !== season.clubId) {
    out.push({
      key: 'transfer_free',
      priority: 68,
      tone: 'neutral',
      params: { club: club_ },
      insiderOnly: true,
    });
  }

  if (context.tookTheMoney) {
    out.push({ key: 'took_the_money', priority: 88, tone: 'negative', params: { club: club_ } });
  }

  if (season.awards.includes('ballon_dor')) {
    out.push({ key: 'ballon_dor', priority: 100, tone: 'positive', params: {} });
  }
  if (season.trophies.includes('world_cup')) {
    out.push({ key: 'world_cup', priority: 98, tone: 'positive', params: {} });
  }
  if (season.trophies.includes('continental_elite')) {
    out.push({ key: 'continental', priority: 90, tone: 'positive', params: { club: club_ } });
  }
  if (season.trophies.includes('league')) {
    out.push({ key: 'league_title', priority: 76, tone: 'positive', params: { club: club_ } });
  }
  if (season.awards.includes('golden_boot')) {
    out.push({ key: 'golden_boot', priority: 82, tone: 'positive', params: { goals: season.stats.goals } });
  }

  // A step change in ability is a story in itself.
  const growth = season.overallEnd - season.overallStart;
  if (growth >= 6 && player.age <= 23) {
    out.push({ key: 'breakthrough', priority: 72, tone: 'positive', params: { club: club_ } });
  }

  if (season.injuryWeeks >= 20) {
    out.push({ key: 'long_injury', priority: 80, tone: 'negative', params: { weeks: season.injuryWeeks } });
  } else if (season.injuryWeeks > 0) {
    out.push({ key: 'injury', priority: 46, tone: 'negative', params: { weeks: season.injuryWeeks } });
  }

  if (season.relegated) out.push({ key: 'relegated', priority: 78, tone: 'negative', params: { club: club_ } });
  if (season.promoted) out.push({ key: 'promoted', priority: 60, tone: 'positive', params: { club: club_ } });

  if (season.stats.rating >= 7.8 && season.stats.appearances >= 20) {
    out.push({ key: 'in_form', priority: 58, tone: 'positive', params: { rating: season.stats.rating.toFixed(2) } });
  } else if (season.stats.rating <= 6.2 && season.stats.appearances >= 15) {
    out.push({ key: 'poor_form', priority: 56, tone: 'negative', params: { club: club_ } });
  }

  if (season.role === 'fringe' && player.age >= 22) {
    out.push({ key: 'frozen_out', priority: 64, tone: 'negative', params: { club: club_ } });
  }

  if (player.age >= 34 && season.stats.appearances >= 25) {
    out.push({ key: 'evergreen', priority: 52, tone: 'positive', params: { age: player.age } });
  }

  if (season.nationalStats && season.nationalStats.appearances > 0 && (previous?.nationalStats ?? null) === null) {
    out.push({ key: 'first_call_up', priority: 66, tone: 'positive', params: {} });
  }

  return out;
}

/**
 * How likely an outlet is to cover this player at all. Local press cares about
 * the local league; global outlets care about visibility, which in this model
 * means league strength.
 */
function outletWeight(outlet: Outlet, context: MediaContext, story: Candidate): number {
  if (story.insiderOnly) return outlet.kind === 'insider' ? 100 : 0;
  // The insider only breaks transfers; they do not write match reports.
  if (outlet.kind === 'insider') return 0;

  const local = outlet.countryId !== null && outlet.countryId === context.league.countryId;
  const homeNation = outlet.countryId !== null && outlet.countryId === context.player.countryId;

  if (outlet.countryId !== null && !local && !homeNation) return 0;

  // Global outlets scale hard with league strength — this is the mechanism
  // behind a Saudi move costing visibility rather than just award points.
  const visibility = outlet.countryId === null ? Math.pow(context.league.strength, 1.6) : 1;
  // Home-nation press follows their own abroad, whatever league they are in.
  const loyalty = homeNation && !local ? 0.8 : 1;

  return outlet.reach * visibility * loyalty;
}

/** How many stories a season generates, from how notable it was. */
function coverageBudget(context: MediaContext, top: Candidate | undefined): number {
  if (!top) return 0;
  const base = top.priority >= 90 ? 3 : top.priority >= 70 ? 2 : 1;
  const visibility = context.league.strength;
  return clamp(Math.round(base * (0.5 + visibility)), 1, 3);
}

export function generateHeadlines(rng: Rng, context: MediaContext): Headline[] {
  const candidates = candidatesFor(context).sort((a, b) => b.priority - a.priority);
  if (candidates.length === 0) return [];

  const budget = coverageBudget(context, candidates[0]);
  const headlines: Headline[] = [];
  const usedOutlets = new Set<string>();

  for (const story of candidates) {
    if (headlines.length >= budget) break;
    const pool = context.outlets.filter((o) => !usedOutlets.has(o.id) && outletWeight(o, context, story) > 0);
    const outlet = weightedPick(rng, pool, (o) => outletWeight(o, context, story));
    if (!outlet) continue;
    usedOutlets.add(outlet.id);

    // Standing with the press shifts the framing, not the facts: a well-liked
    // player gets "unlucky", a badly-liked one gets "finished".
    const tone =
      story.tone === 'negative' && context.mediaRelationship >= 72
        ? 'neutral'
        : story.tone === 'positive' && context.mediaRelationship <= 28
          ? 'neutral'
          : story.tone;

    headlines.push({ outletId: outlet.id, key: story.key, params: story.params, tone });
  }

  return headlines;
}
