/**
 * "What league is this club in, right now, in *this* career?"
 *
 * The world is shared and immutable — one `WORLD` object serves every career
 * running in the process, and the balance sweep runs twenty thousand of them.
 * A career that sees its club promoted therefore cannot edit the world; it
 * records the change against itself, and every lookup goes through here so the
 * answer reflects that career's own history rather than the world's opening
 * position.
 *
 * That distinction is the single most repeated bug in this codebase. It has
 * been hit in the engine (reading `club.leagueId` directly), in the tests
 * (reading a career's final league snapshot while asserting about season three)
 * and in the UI (the static index labelling an offer with a division the club
 * left four seasons ago). If you are reaching for a club's league, reach for
 * this.
 */
import type { Club, Country, League, ManagerStyle, World } from '../types.js';

export interface WorldIndex {
  club: (id: string) => Club;
  league: (id: string) => League;
  country: (id: string) => Country;
  leagueOfClub: (clubId: string) => League;
  countryOfClub: (clubId: string) => Country;
}

/**
 * @param leagueMoves clubId → leagueId for clubs this career has seen promoted
 *   or relegated. The world itself is shared and immutable, so a division
 *   change lives on the career state and is applied here — every lookup of
 *   "what league is this club in?" then answers with the career's own history
 *   rather than the world's opening position.
 */
export function indexWorld(
  world: World,
  leagueMoves?: Record<string, string>,
  managerChanges?: Record<string, ManagerStyle>,
): WorldIndex {
  const clubs = new Map(world.clubs.map((c) => [c.id, c]));
  const leagues = new Map(world.leagues.map((l) => [l.id, l]));
  const countries = new Map(world.countries.map((c) => [c.id, c]));

  const club = (id: string) => {
    const found = clubs.get(id);
    if (!found) throw new Error(`Unknown club: ${id}`);
    // The manager is part of the club as far as every caller is concerned —
    // tactical fit reads `club.managerStyle` — so the override is applied here
    // rather than at each of the dozen places that would otherwise have to
    // remember to ask.
    const style = managerChanges?.[id];
    return style && style !== found.managerStyle ? { ...found, managerStyle: style } : found;
  };
  const league = (id: string) => {
    const found = leagues.get(id);
    if (!found) throw new Error(`Unknown league: ${id}`);
    return found;
  };
  const country = (id: string) => {
    const found = countries.get(id);
    if (!found) throw new Error(`Unknown country: ${id}`);
    return found;
  };

  return {
    club,
    league,
    country,
    leagueOfClub: (clubId) => league(leagueMoves?.[clubId] ?? club(clubId).leagueId),
    countryOfClub: (clubId) => country(league(leagueMoves?.[clubId] ?? club(clubId).leagueId).countryId),
  };
}
