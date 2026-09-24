import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLUBS, COUNTRIES, LEAGUES, MARQUEE_PLAYERS, OUTLETS, WORLD } from './index.js';
import { CLUB_NAMES_ZH } from './i18n/clubs-zh.js';
// Straight from the modules, not through the package index: the app fetches
// each language on demand and no longer has a map holding both at once. The
// suite still wants both in one process.
import { en } from './i18n/en.js';
import { zh } from './i18n/zh.js';
const DICTIONARIES = [en, zh as typeof en];
import { COUNTRY_NAMES } from './i18n/countries.js';
import { EVENTS, indexWorld, marketLevel, leagueInMarket, loanDestinationWeight, type Player } from '@bg/engine';

/**
 * Content integrity.
 *
 * Every one of these caught something real while the league scope was being
 * narrowed: marquee players attached to deleted clubs, Chinese names for clubs
 * that no longer exist, leagues with nobody in them. Data-only mistakes are
 * invisible until a card renders wrong in front of a player.
 */

const leagueIds = new Set(LEAGUES.map((l) => l.id));
const countryIds = new Set(COUNTRIES.map((c) => c.id));
const clubIds = new Set(CLUBS.map((c) => c.id));

describe('referential integrity', () => {
  it('gives every club a league that exists', () => {
    for (const club of CLUBS) expect(leagueIds, club.id).toContain(club.leagueId);
  });

  it('gives every league a country that exists', () => {
    for (const league of LEAGUES) expect(countryIds, league.id).toContain(league.countryId);
  });

  it('attaches every marquee player to a club that exists', () => {
    for (const player of MARQUEE_PLAYERS) expect(clubIds, player.name).toContain(player.clubId);
  });

  it('gives every marquee player a country that exists', () => {
    for (const player of MARQUEE_PLAYERS) expect(countryIds, player.name).toContain(player.countryId);
  });

  it('ties every outlet to a real country or to none', () => {
    for (const outlet of OUTLETS) {
      if (outlet.countryId !== null) expect(countryIds, outlet.id).toContain(outlet.countryId);
    }
  });

  it('has no Chinese club names for clubs that no longer exist', () => {
    for (const id of Object.keys(CLUB_NAMES_ZH)) expect(clubIds, id).toContain(id);
  });

  it('names every country in both languages', () => {
    for (const country of COUNTRIES) {
      expect(COUNTRY_NAMES[country.id], country.id).toBeDefined();
      expect(COUNTRY_NAMES[country.id]!.zh.length).toBeGreaterThan(0);
    }
  });

  it('uses unique club ids', () => {
    expect(new Set(CLUBS.map((c) => c.id)).size).toBe(CLUBS.length);
  });
});

describe('league population', () => {
  it('puts at least six clubs in every league', () => {
    for (const league of LEAGUES) {
      const count = CLUBS.filter((c) => c.leagueId === league.id).length;
      expect(count, league.id).toBeGreaterThanOrEqual(6);
    }
  });

  it('keeps second divisions weaker than their own first division', () => {
    for (const league of LEAGUES.filter((l) => l.tier === 2)) {
      const top = LEAGUES.find((l) => l.countryId === league.countryId && l.tier === 1);
      expect(top, league.id).toBeDefined();
      expect(league.strength).toBeLessThan(top!.strength);
    }
  });

  it('scopes the world to the intended leagues only', () => {
    // The roster is deliberately narrow. Anything outside this list appearing in
    // a transfer window is the bug this list exists to prevent.
    expect([...leagueIds].sort()).toEqual(
      [
        'bel.1', 'chn.1', 'eng.1', 'eng.2', 'esp.1', 'esp.2', 'fra.1', 'fra.2',
        'ger.1', 'ger.2', 'ita.1', 'ita.2', 'jpn.1', 'ksa.1', 'ned.1', 'por.1', 'usa.1',
      ].sort(),
    );
  });
});

describe('transfer market coherence', () => {
  const index = indexWorld(WORLD);
  // Kept honest by `tsconfig.check.json`: this literal still carried three
  // hidden attributes the engine dropped long ago — `potential`,
  // `determination`, `bigMatch` — and no player type at all, because until
  // now nothing typechecked the tests.
  const player = (overall: number, age: number): Player => ({
    lastName: 'X', shirtNumber: 9, foot: 'right', countryId: 'eng',
    position: 'ST', age, archetype: 'technical',
    attributes: { pace: overall, shooting: overall, passing: overall, dribbling: overall, defending: overall, physical: overall },
    hidden: { developmentProfile: 'normal', consistency: 60, injuryProneness: 40 },
    personality: 'resolute', dopingBan: false, overall, marketValue: 0,
  });

  it('never offers a spin-off league to a young player with options', () => {
    const context = { player: player(80, 23), world: WORLD, currentLeague: index.leagueOfClub('tottenham'), europeQuiet: false };
    for (const league of LEAGUES.filter((l) => l.market === 'spinoff')) {
      expect(leagueInMarket(league, context), league.id).toBe(false);
    }
  });

  it('opens the spin-off door only in the twilight of a career', () => {
    const spinoffs = LEAGUES.filter((l) => l.market === 'spinoff');
    const doorAt = (age: number) => {
      const context = { player: player(80, age), world: WORLD, currentLeague: index.leagueOfClub('tottenham'), europeQuiet: false };
      return spinoffs.some((l) => leagueInMarket(l, context));
    };
    // All four are twilight moves — Japan and MLS as much as the Gulf. At 31 a
    // player is still in his peak and being shown them reads as the game giving
    // up on a career that has not finished happening.
    expect(doorAt(31)).toBe(false);
    expect(doorAt(33)).toBe(true);
  });

  it('keeps a Premier League player and a second-division club out of the same window', () => {
    // The exact failure this system was built for: Tottenham next to a club
    // three levels below, both "valid", neither making any sense together.
    const context = { player: player(84, 26), world: WORLD, currentLeague: index.leagueOfClub('tottenham'), europeQuiet: false };
    const inBand = LEAGUES.filter((l) => leagueInMarket(l, context));
    expect(inBand.some((l) => l.id === 'eng.1')).toBe(true);
    expect(inBand.some((l) => l.tier === 2)).toBe(false);
    expect(inBand.some((l) => l.market === 'spinoff')).toBe(false);
  });

  it('never loans a player to a spin-off league or upward', () => {
    const parent = index.leagueOfClub('man-city');
    for (const club of CLUBS) {
      const league = index.leagueOfClub(club.id);
      const weight = loanDestinationWeight(parent, league, club);
      if (league.market === 'spinoff') expect(weight, club.id).toBe(0);
      if (league.strength >= parent.strength) expect(weight, club.id).toBe(0);
    }
  });

  it('scales market level with ability', () => {
    expect(marketLevel(player(88, 25))).toBeGreaterThan(marketLevel(player(62, 25)));
  });
});

describe('localisation', () => {
  it('keeps the Chinese dictionary structurally identical to English', () => {
    const shape = (node: unknown, path: string, out: string[]) => {
      if (typeof node === 'string') { out.push(path); return; }
      if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) shape(value, `${path}.${key}`, out);
      }
    };
    const englishKeys: string[] = [];
    const chineseKeys: string[] = [];
    shape(en, '', englishKeys);
    shape(zh, '', chineseKeys);
    expect(chineseKeys.sort()).toEqual(englishKeys.sort());
  });

  /**
   * Every card the deck can deal has copy for every line it can print.
   *
   * A `resultKey` is a string in `events.ts` and a key in two dictionaries,
   * and nothing tied the two together: a branch added to a card without its
   * sentence printed the raw key on the result line, in both languages, and
   * every existing test still passed — the en/zh shape test only checks the
   * two dictionaries against *each other*.
   *
   * Caught exactly that, twice, in one afternoon.
   */
  it('has copy for every title, body, option and outcome in the deck', () => {
    const missing: string[] = [];
    const has = (dictionary: typeof en, path: string) => {
      let node: unknown = dictionary;
      for (const part of path.split('.')) {
        if (node === null || typeof node !== 'object') return false;
        node = (node as Record<string, unknown>)[part];
      }
      return typeof node === 'string';
    };
    for (const [name, dictionary] of [['en', en], ['zh', zh as typeof en]] as const) {
      for (const event of EVENTS) {
        const want = [`events.${event.id}.title`, `events.${event.id}.body`];
        for (const option of event.options) {
          want.push(`events.${event.id}.options.${option.id}`);
          for (const outcome of option.outcomes) {
            want.push(`events.${event.id}.results.${outcome.effect.resultKey}`);
            /*
             * **Every downside explains itself**, before the choice is made.
             *
             * By design. `effects` prints the price — "Ability −3 · Higher
             * injury risk" — and the reason used to live only in the result
             * prose, which the player reads once it is too late to weigh. A
             * negative branch with no `why` is a card asking him to accept a
             * cost it will not name a cause for, and `machine.ts` builds the
             * key unconditionally, so a missing one is a raw key on screen.
             */
            if (outcome.effect.resultTone === 'negative') {
              want.push(`events.${event.id}.why.${outcome.effect.resultKey}`);
            }
            /*
             * **A card that moves money says what the money is.**
             *
             * `describeEffect` can only produce "you spend €480K", because an
             * amount is all it is given, and a run of cards charging six figures
             * with no noun attached is what a player read. The card knows —
             * an agency's cut, a programme's fee, a cheque to a cause — so it
             * says so, and `nameTheMoney` in the state machine swaps the generic
             * key for this one unconditionally. A card that moves cash without
             * one prints a raw key on screen.
             */
            const cash = (outcome.effect.cashWeeks ?? 0) + (outcome.effect.cash ?? 0);
            if (cash > 0) want.push(`events.${event.id}.income`);
            if (cash < 0) want.push(`events.${event.id}.cost`);
          }
        }
        for (const key of want) if (!has(dictionary, key)) missing.push(`${name}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  /**
   * One sentence, one full stop, at the end of it.
   *
   * Chinese copy had a hundred and fifty-eight strings with a full stop in the
   * middle — two clipped fragments where one sentence belongs, which is how a
   * literal translation of English sports writing comes out and reads nothing
   * like Chinese. 「钱到账了。你的脚一直没原谅你。」 is the shape: two halves that
   * do not join, and a second half that is an English idiom wearing Chinese
   * characters.
   *
   * A label carries no full stop at all; a sentence carries exactly one, at
   * the end. Both are allowed; a stop anywhere else is not.
   */
  it('never puts a full stop in the middle of a Chinese string', () => {
    const offenders: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (typeof node === 'string') {
        const body = node.endsWith('。') ? node.slice(0, -1) : node;
        if (body.includes('。')) offenders.push(`${path}: ${node}`);
        return;
      }
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        walk(value, path ? `${path}.${key}` : key);
      }
    };
    walk(zh, '');
    expect(offenders).toEqual([]);
  });

  /**
   * Chinese text takes Chinese punctuation.
   *
   * Half-width marks between full-width characters are the other tell of copy
   * that was typed in an English keyboard layout: 「董事会问你:今年」. Five of them
   * had survived two passes of reading the file.
   */
  it('never puts half-width punctuation inside Chinese text', () => {
    const offenders: string[] = [];
    const bad = /[\u4e00-\u9fff][,.!?;:]|[,.!?;:][\u4e00-\u9fff]/;
    const walk = (node: unknown, path: string) => {
      if (typeof node === 'string') {
        if (bad.test(node)) offenders.push(`${path}: ${node}`);
        return;
      }
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        walk(value, path ? `${path}.${key}` : key);
      }
    };
    walk(zh, '');
    expect(offenders).toEqual([]);
  });

  /**
   * No copy for a screen that does not exist.
   *
   * The dictionary had forty-two leaves nothing could ever ask for: a
   * relationships panel that was cut, a growth panel that was cut, a resume
   * button the app does not need because a saved career goes straight into the
   * career view, six summary labels replaced by a different layout, a scouted
   * potential range that was never built. Every one of them read like a
   * feature when the file was skimmed, and translating them cost real work
   * twice.
   *
   * It is the mirror of the fault this project keeps finding in the other
   * direction — something the engine does that the screen never says — and it
   * gets a test for the same reason: nobody notices dead copy by reading.
   */
  it('has no copy that no screen can ask for', () => {
    const roots = [
      new URL('../../../apps/web/src/', import.meta.url),
      new URL('../../engine/src/', import.meta.url),
    ];
    const files: string[] = [];
    const walk = (dir: URL) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
        if (entry.isDirectory()) walk(child);
        else if (/\.(ts|tsx)$/.test(entry.name)) files.push(readFileSync(child, 'utf8'));
      }
    };
    for (const root of roots) walk(root);
    const source = files.join('\n');

    /*
     * A lookup can be spelled out — `t('career.age')` — or built, and the built
     * ones take every shape: `t(\`effects.${x}\`)`, `t(\`intro.pace${key}\`)`,
     * `t(\`${gk ? 'attributesGk' : 'attributes'}.${key}\`)`. Each template
     * becomes a pattern with its literal parts kept, so all three count as
     * reaching a key. A pattern with almost no literal in it would match
     * everything and turn this into a test that always passes, so those are
     * dropped.
     */
    const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns: RegExp[] = [];
    for (const match of source.matchAll(/`([^`\\]*?\$\{[^`]*?)`/g)) {
      const parts: string[] = [];
      let literal = 0;
      let rest = match[1]!;
      while (rest.length > 0) {
        const open = rest.indexOf('${');
        if (open === -1) {
          parts.push(escape(rest));
          literal += rest.length;
          break;
        }
        if (open > 0) {
          parts.push(escape(rest.slice(0, open)));
          literal += open;
        }
        const close = rest.indexOf('}', open);
        if (close === -1) break;
        const quoted = [...rest.slice(open + 2, close).matchAll(/'([\w.-]+)'/g)].map((q) => q[1]!);
        if (quoted.length > 0) {
          parts.push(`(?:${quoted.map(escape).join('|')})`);
          literal += Math.min(...quoted.map((q) => q.length));
        } else {
          parts.push('[\\w.]*');
        }
        rest = rest.slice(close + 1);
      }
      /*
       * A wildcard spans dots, because the values substituted into these do:
       * `t(`leagues.${league.id}`)` is asked for `leagues.eng.1`. The cost is a
       * blind spot — `t(`identity.${option}`)` vouches for every leaf under
       * `identity.`, so a sibling that goes dead there is not reported. Tried
       * the strict version; it called seventeen live league names dead, and an
       * audit that cries wolf is one nobody runs. Catching the accumulation is
       * the job, and it caught forty-two.
       */
      if (literal >= 3) patterns.push(new RegExp(`^${parts.join('')}$`));
    }

    const leaves: string[] = [];
    const walkKeys = (node: unknown, path: string) => {
      if (typeof node === 'string') { leaves.push(path); return; }
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        walkKeys(value, path ? `${path}.${key}` : key);
      }
    };
    walkKeys(en, '');

    const dead = leaves.filter(
      (key) =>
        !source.includes(`'${key}'`) &&
        !source.includes(`"${key}"`) &&
        !source.includes(`\`${key}\``) &&
        !patterns.some((pattern) => pattern.test(key)),
    );
    expect(dead).toEqual([]);
  });

  /**
   * The engine stores a trophy *slot* — `domestic_cup` — and the UI turns it
   * into a real name from where it was won. Add a league without adding its
   * cup and the career table renders a raw key; these two pin that shut.
   */
  it('names the domestic cup of every country that has a league', () => {
    const withLeagues = new Set(LEAGUES.map((l) => l.countryId));
    for (const dictionary of DICTIONARIES) {
      for (const countryId of withLeagues) {
        expect(Object.keys(dictionary.cups), countryId).toContain(countryId);
      }
    }
  });

  it('names the continental and international cups of every confederation', () => {
    const confederations = new Set(COUNTRIES.map((c) => c.confederation));
    for (const dictionary of DICTIONARIES) {
      for (const confederation of confederations) {
        expect(Object.keys(dictionary.continentalCups), confederation).toContain(confederation);
        expect(Object.keys(dictionary.nationsCups), confederation).toContain(confederation);
      }
    }
  });

  /**
   * A card whose "leave" option can resolve to more than one club cannot name
   * a club in its body: the engine has no single suitor to put in the slot, so
   * it falls back to the club the player is already at. That produced "Leeds
   * will treble your wages" while at Leeds, and "Villarreal would take you
   * tomorrow" while at Villarreal.
   */
  it('never names a club in the body of a card with more than one destination', () => {
    const multi = new Set(['escape', 'foreign', 'home', 'money']);
    for (const event of EVENTS) {
      const splits = event.options.some((option) => {
        const kind = option.outcomes[0]?.effect.joinClub;
        return kind !== undefined && multi.has(kind) && !option.namesClub;
      });
      if (!splits) continue;
      for (const dictionary of DICTIONARIES) {
        const body = (dictionary.events as Record<string, { body?: string }>)[event.id]?.body ?? '';
        expect(body, `${event.id} body names {club} but can resolve two`).not.toContain('{club}');
      }
    }
  });

  it('writes out every position for the pitch picker', () => {
    for (const dictionary of DICTIONARIES) {
      expect(Object.keys(dictionary.positionNames).sort()).toEqual(Object.keys(dictionary.positions).sort());
    }
  });
});
