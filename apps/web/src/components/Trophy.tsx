import { useState } from 'react';
import type { TrophyId } from '@bg/engine';
import { INDEX } from '../lib/game';
import { asset } from '../lib/assets';

/**
 * A trophy, shown as the trophy it actually is.
 *
 * The artwork is served from `apps/web/public/trophies/` and belongs to its
 * respective owners (`docs/crests.md` §4). Resolution:
 *
 *   1. The competition's own image — the Premier League trophy, the FA Cup,
 *      the big-eared European Cup.
 *   2. The generic family image (`generic-league.svg` / `generic-cup.svg`)
 *      for competitions with no dedicated art.
 *   3. A drawn silhouette, if a file is missing or fails to load, so a
 *      broken image can never appear.
 *
 * Which image a slot resolves to depends on where it was won: the club fixes
 * the league, the domestic cup and the confederation; the player's country
 * fixes the international ones.
 */

/** League-title art, keyed by league id with the dot flattened (`eng.1` → `eng-1`). */
const LEAGUE_ART = new Set([
  'eng-1', 'esp-1', 'esp-2', 'ita-1', 'ger-1', 'ger-2', 'fra-1', 'fra-2', 'usa-1',
]);

const CUP_ART: Record<string, string> = {
  eng: 'fa-cup.png',
  esp: 'copa-del-rey.png',
  ita: 'coppa-italia.png',
  ger: 'dfb-pokal.png',
  fra: 'coupe-de-france.png',
  usa: 'us-open-cup.png',
};

const ELITE_ART: Record<string, string> = {
  UEFA: 'champions-league.png',
  CONCACAF: 'concachampions.svg',
  CONMEBOL: 'libertadores.png',
};

const SECONDARY_ART: Record<string, string> = {
  UEFA: 'europa-league.png',
  CONMEBOL: 'copa-sudamericana.png',
};

const NATIONS_ART: Record<string, string> = {
  UEFA: 'euro.svg',
  AFC: 'asian-cup.svg',
  CAF: 'afcon.svg',
  CONCACAF: 'gold-cup.svg',
  CONMEBOL: 'copa-america.png',
  OFC: 'ofc-nations-cup.png',
};

/**
 * Individual awards that have artwork.
 *
 * Only these three have an image. The others (young player, league MVP, team
 * of the season) get the drawn `AwardMedal` below rather than a stand-in
 * trophy shape. A trophy silhouette standing in for the Golden Boot reads as
 * replaced artwork, which is exactly what it would be.
 */
export const AWARD_ART: Record<string, string> = {
  ballon_dor: 'ballon-dor.png',
  golden_boot: 'golden-boot.png',
  golden_glove: 'golden-glove.png',
};

/**
 * Team of the Season, the one honour with no artwork of its own — a medal on a
 * ribbon with XI on the disc, so it can never be mistaken for one of the real
 * trophy photographs.
 *
 * There used to be three of these, all rendered from one drawing, so a cabinet
 * showed identical medals that were different honours. The other two — League
 * MVP and Young Player of the Year — are cut rather than redrawn: the award
 * list is now the three with artwork plus this.
 */
export function AwardMedal({ size = 34, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className="shrink-0 drop-shadow-[0_3px_3px_rgba(0,0,0,0.3)]"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {/*
        Gold, and the only medal in the game.
        It was a lime disc on a grey ribbon while the career table marked the
        same honour with a gold emoji, so one award had two pictures and the
        colour agreed with neither. Gold is what the career table already uses
        for an honour, so gold is what this is.
      */}
      <path d="M20 6 L28 30 H36 L44 6 Z" fill="#d4a72c" stroke="#8a6a12" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="32" cy="42" r="17" fill="#f5c542" stroke="#8a6a12" strokeWidth="2.5" />
      <circle cx="32" cy="42" r="12" fill="none" stroke="#8a6a12" strokeWidth="1.2" opacity="0.7" />
      <text
        x="32"
        y="48"
        textAnchor="middle"
        fontSize="16"
        fontWeight="bold"
        fontFamily="system-ui, sans-serif"
        fill="#6b4e0a"
      >
        XI
      </text>
    </svg>
  );
}

/** The image file for a trophy, in the context it was won. Never empty. */
export function trophyArt(
  trophy: TrophyId | string,
  context: { clubId?: string | null; countryId?: string | null; leagueId?: string | null },
): string {
  /*
   * The division the trophy was won in, which is **not** the division the club
   * started the world in.
   *
   * `INDEX` is the world as it opened, and a career promotes and relegates
   * clubs inside its own copy of it. Southampton starts in the Championship
   * here, so a career that took them up and then won the Premier League still
   * had the Championship plate drawn on the row — for the rest of the career,
   * because the static index never moves. `leagueId` comes off the season
   * record, which stores the division the season was actually played in.
   */
  const league = (() => {
    try {
      if (context.leagueId) return INDEX.league(context.leagueId);
      return context.clubId ? INDEX.leagueOfClub(context.clubId) : null;
    } catch {
      return null;
    }
  })();
  const confederation = (() => {
    try {
      if (context.clubId) return INDEX.countryOfClub(context.clubId).confederation;
      if (context.countryId) return INDEX.country(context.countryId).confederation;
    } catch {
      /* an id from an older content pack — fall through to the generic art */
    }
    return 'UEFA';
  })();

  switch (trophy) {
    case 'league': {
      const key = league ? league.id.replace('.', '-') : '';
      return LEAGUE_ART.has(key) ? `league-${key}.png` : 'generic-league.svg';
    }
    case 'domestic_cup':
      return (league && CUP_ART[league.countryId]) || 'generic-cup.svg';
    case 'continental_elite':
      return ELITE_ART[confederation] ?? 'generic-cup.svg';
    case 'continental_secondary':
      return SECONDARY_ART[confederation] ?? 'generic-cup.svg';
    case 'continental_nations':
      return NATIONS_ART[confederation] ?? 'generic-cup.svg';
    case 'world_cup':
      return 'world-cup.png';
    case 'club_world_cup':
      return 'club-world-cup.png';
    default:
      return 'generic-cup.svg';
  }
}

export function Trophy({
  trophy,
  clubId = null,
  countryId = null,
  /** The division it was won in — see `trophyArt`. Clubs move divisions. */
  leagueId = null,
  size = 14,
  title,
}: {
  trophy: TrophyId | string;
  clubId?: string | null;
  countryId?: string | null;
  leagueId?: string | null;
  size?: number;
  title?: string;
}) {
  const art = trophyArt(trophy, { clubId, countryId, leagueId });
  // Failure is remembered per file, for the same reason `Crest` remembers per
  // club: one instance renders many different trophies as a list scrolls.
  const [failedFor, setFailedFor] = useState<string | null>(null);

  if (failedFor !== art) {
    return (
      <img
        key={art}
        src={asset(`trophies/${art}`)}
        alt=""
        title={title}
        width={size}
        height={size}
        className="shrink-0 select-none object-contain drop-shadow-[0_3px_3px_rgba(0,0,0,0.3)]"
        loading="lazy"
        decoding="async"
        onError={() => setFailedFor(art)}
        style={{ width: size, height: size }}
      />
    );
  }
  return <DrawnTrophy shape={trophyShape(trophy, { clubId, countryId })} size={size} title={title} />;
}

// ---------------------------------------------------------------------------
// Drawn fallback — only ever seen if an image file is missing or corrupt.
// ---------------------------------------------------------------------------

export type TrophyShape =
  | 'bigEars'
  | 'slimCup'
  | 'twoHandled'
  | 'shield'
  | 'chalice'
  | 'globe'
  | 'clubGlobe';

/**
 * Which silhouette a trophy gets. The slot alone is not enough — the same
 * `continental_elite` is the European Cup at Real Madrid and the AFC Champions
 * League Elite at Kashima — so the club's confederation decides the shape.
 */
export function trophyShape(
  trophy: TrophyId | string,
  context: { clubId?: string | null; countryId?: string | null },
): TrophyShape {
  const confederation = (() => {
    try {
      if (context.clubId) return INDEX.countryOfClub(context.clubId).confederation;
      if (context.countryId) return INDEX.country(context.countryId).confederation;
    } catch {
      /* a club id from an older content pack — fall through to Europe */
    }
    return 'UEFA';
  })();

  switch (trophy) {
    case 'league':
      return 'shield';
    case 'domestic_cup':
      return 'twoHandled';
    case 'continental_elite':
      // The big ears are the European Cup's alone; elsewhere it is a chalice.
      return confederation === 'UEFA' ? 'bigEars' : 'chalice';
    case 'continental_secondary':
      return 'slimCup';
    case 'club_world_cup':
      return 'clubGlobe';
    case 'continental_nations':
      return 'chalice';
    case 'world_cup':
      return 'globe';
    default:
      return 'twoHandled';
  }
}

/** Gold, with a darker rim so the shape still reads on a light background. */
const GOLD = '#f2c14b';
const RIM = '#a9761c';

function DrawnTrophy({ shape, size, title }: { shape: TrophyShape; size: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className="shrink-0"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      fill={GOLD}
      stroke={RIM}
      strokeWidth={2}
      strokeLinejoin="round"
    >
      {title ? <title>{title}</title> : null}
      <Silhouette shape={shape} />
    </svg>
  );
}

function Silhouette({ shape }: { shape: TrophyShape }) {
  switch (shape) {
    // The European Cup: tall body, and the handles that gave it its nickname —
    // huge, curved, running the full height of the bowl.
    case 'bigEars':
      return (
        <>
          <path d="M20 8 H44 V26 Q44 40 32 44 Q20 40 20 26 Z" />
          <path d="M20 11 Q6 13 7 27 Q8 38 18 40" fill="none" strokeWidth={4} strokeLinecap="round" />
          <path d="M44 11 Q58 13 57 27 Q56 38 46 40" fill="none" strokeWidth={4} strokeLinecap="round" />
          <path d="M29 44 H35 V50 H29 Z" />
          <path d="M20 50 H44 L46 58 H18 Z" />
        </>
      );

    // A secondary continental cup: taller, narrower, with a lid.
    case 'slimCup':
      return (
        <>
          <path d="M24 16 H40 V34 Q40 42 32 45 Q24 42 24 34 Z" />
          <path d="M22 16 H42 L40 10 H24 Z" />
          <circle cx="32" cy="7" r="3" />
          <path d="M24 20 Q16 22 17 30 Q18 35 23 36" fill="none" strokeWidth={3.5} strokeLinecap="round" />
          <path d="M40 20 Q48 22 47 30 Q46 35 41 36" fill="none" strokeWidth={3.5} strokeLinecap="round" />
          <path d="M29 45 H35 V51 H29 Z" />
          <path d="M21 51 H43 L45 58 H19 Z" />
        </>
      );

    // The domestic-cup shape: a wide urn on a stem, two small handles.
    case 'twoHandled':
      return (
        <>
          <path d="M18 14 H46 V28 Q46 40 32 44 Q18 40 18 28 Z" />
          <path d="M18 18 Q10 20 11 27 Q12 32 17 33" fill="none" strokeWidth={3.5} strokeLinecap="round" />
          <path d="M46 18 Q54 20 53 27 Q52 32 47 33" fill="none" strokeWidth={3.5} strokeLinecap="round" />
          <path d="M29 44 H35 V50 H29 Z" />
          <path d="M20 50 H44 L46 58 H18 Z" />
        </>
      );

    // A league title is a plate or a shield, never a cup.
    case 'shield':
      return (
        <>
          <path d="M32 6 L54 13 V32 Q54 50 32 58 Q10 50 10 32 V13 Z" />
          <path d="M32 20 L35.5 28 H44 L37 33.5 L39.5 42 L32 37 L24.5 42 L27 33.5 L20 28 H28.5 Z" strokeWidth={1.5} />
        </>
      );

    // Euro / Delaunay style: a shallow chalice on a tall stem.
    case 'chalice':
      return (
        <>
          <path d="M20 12 H44 Q44 32 32 38 Q20 32 20 12 Z" />
          <path d="M30 38 H34 V50 H30 Z" strokeWidth={2.5} />
          <path d="M18 50 H46 L48 58 H16 Z" />
          <path d="M20 16 H44" fill="none" strokeWidth={2} />
        </>
      );

    // The World Cup: a globe held up by a tapering base.
    case 'globe':
      return (
        <>
          <circle cx="32" cy="20" r="12" />
          <path d="M32 8 Q24 20 32 32 Q40 20 32 8" fill="none" strokeWidth={1.8} />
          <path d="M20 20 H44" fill="none" strokeWidth={1.8} />
          <path d="M26 31 Q22 44 24 52 H40 Q42 44 38 31 Z" />
          <path d="M20 52 H44 L46 59 H18 Z" />
        </>
      );

    // The Club World Cup: the same globe idea on a ringed cylinder.
    case 'clubGlobe':
    default:
      return (
        <>
          <circle cx="32" cy="19" r="11" />
          <path d="M32 8 Q25 19 32 30 Q39 19 32 8" fill="none" strokeWidth={1.8} />
          <path d="M21 19 H43" fill="none" strokeWidth={1.8} />
          <path d="M25 30 H39 V46 H25 Z" />
          <path d="M25 36 H39" fill="none" strokeWidth={1.8} />
          <path d="M20 46 H44 L46 58 H18 Z" />
        </>
      );
  }
}
