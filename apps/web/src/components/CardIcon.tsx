import type { Decision } from '@bg/engine';

/**
 * A drawn mark for every card.
 *
 * A card with a face is recognisable at a glance and a wall of identical
 * headings is not. An emoji would give it one, and the emoji itself is what
 * does not work — 🩺 is a stethoscope on iOS, a flat cross on Android and a
 * shrug on Windows, none of them in this game's palette, and a career screen
 * with a system emoji in it stops looking like broadcast graphics and starts
 * looking like a chat app.
 *
 * So they are drawn here: one stroke weight, one palette, `currentColor`, and
 * the same 24-unit grid as the rest of the interface. Fifteen glyphs cover the
 * whole deck by *subject* rather than one per card — the pitch, the treatment
 * table, the training ground, the contract, the press — because that is what a
 * player actually reads off an icon before the words arrive.
 */

type Glyph =
  | 'pitch'
  | 'boot'
  | 'whistle'
  | 'medical'
  | 'syringe'
  | 'dumbbell'
  | 'stopwatch'
  | 'contract'
  | 'money'
  | 'plane'
  | 'megaphone'
  | 'crowd'
  | 'shield'
  | 'flag'
  | 'book';

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const GLYPHS: Record<Glyph, React.ReactNode> = {
  /* A pitch seen from above: the centre circle and the halfway line. */
  pitch: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" {...S} />
      <path d="M12 5v14" {...S} />
      <circle cx="12" cy="12" r="3" {...S} />
    </>
  ),
  /* A boot with studs — the match itself. */
  boot: (
    <>
      <path d="M4 9h5l3 3h5a3 3 0 0 1 3 3v2H4z" {...S} />
      <path d="M7 17v2M11 17v2M15 17v2M19 17v2" {...S} />
    </>
  ),
  /* A whistle: the manager, the selection, the decision taken for you. */
  whistle: (
    <>
      <path d="M4 10h9l6-3v10l-6-3H4z" {...S} />
      <circle cx="7" cy="14" r="3.2" {...S} />
    </>
  ),
  /* A cross in a rounded square: the treatment room. */
  medical: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="3" {...S} />
      <path d="M12 9v6M9 12h6" {...S} />
    </>
  ),
  /* A syringe, for the card nobody should take lightly. */
  syringe: (
    <>
      <path d="M14 4l6 6M17 7l-9 9-4 1 1-4 9-9" {...S} />
      <path d="M11 9l4 4" {...S} />
    </>
  ),
  /* Weights: the work nobody sees. */
  dumbbell: (
    <>
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" {...S} />
    </>
  ),
  /* A stopwatch: the season, the schedule, the load. */
  stopwatch: (
    <>
      <circle cx="12" cy="13" r="7" {...S} />
      <path d="M12 9v4l2.5 2M10 3h4" {...S} />
    </>
  ),
  /* A sheet with a signature line: anything that is signed. */
  contract: (
    <>
      <path d="M6 3h8l4 4v14H6z" {...S} />
      <path d="M14 3v4h4" {...S} />
      <path d="M9 15c1.5-2 3-2 4 0s2.5 2 3-1" {...S} />
    </>
  ),
  /* A coin: wages, bonuses, and what they cost. */
  money: (
    <>
      <circle cx="12" cy="12" r="7.5" {...S} />
      <path d="M12 8v8M14 10c0-1-1-1.6-2-1.6S10 9 10 10s1 1.4 2 1.8 2 .8 2 1.8-.9 1.6-2 1.6-2-.6-2-1.6" {...S} />
    </>
  ),
  /* A plane: the move abroad, the long flight, the homesickness. */
  plane: (
    <>
      <path d="M3 12l18-6-4 7 1 6-4-4-4 3 1-4z" {...S} />
    </>
  ),
  /* A megaphone: the press, and what you said to it. */
  megaphone: (
    <>
      <path d="M4 10v4l11 4V6z" {...S} />
      <path d="M15 9a3.5 3.5 0 0 1 0 6" {...S} />
      <path d="M6 14v4h3v-3" {...S} />
    </>
  ),
  /* Three heads in a stand: the supporters, for you or against you. */
  crowd: (
    <>
      <circle cx="7" cy="8" r="2.2" {...S} />
      <circle cx="16.5" cy="8" r="2.2" {...S} />
      <path d="M3 19c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5M13 19c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5" {...S} />
    </>
  ),
  /* A crest: the club, the badge, the rival. */
  shield: (
    <>
      <path d="M12 3l7 2.5V12c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V5.5z" {...S} />
      <path d="M12 8.5v5" {...S} />
    </>
  ),
  /* A corner flag: the country, the call-up, the anthem. */
  flag: (
    <>
      <path d="M6 21V4M6 5h11l-2.5 3.5L17 12H6" {...S} />
    </>
  ),
  /* A book: school, the exams, the life after. */
  book: (
    <>
      <path d="M5 4h9a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H5z" {...S} />
      <path d="M17 7h2v13h-2.5" {...S} />
    </>
  ),
};

/**
 * Which glyph a card gets.
 *
 * Keyed on the event id where the subject is specific and on the card *kind*
 * otherwise, so a new event without an entry still gets a sensible mark rather
 * than a hole — and a new decision kind does too. Nothing here reaches into the
 * engine: the icon is presentation, and the engine has no opinion about it.
 */
const BY_EVENT: Record<string, Glyph> = {
  closed_door_friendly: 'pitch',
  fifty_fifty: 'boot',
  derby_week: 'crowd',
  reserves_run: 'pitch',
  decisive_save: 'boot',
  position_competition: 'whistle',
  rival_prospect: 'whistle',
  club_priority: 'shield',
  frozen_out: 'whistle',

  extra_training: 'dumbbell',
  preseason_camp: 'dumbbell',
  double_session: 'dumbbell',
  personal_coach: 'stopwatch',
  season_load: 'stopwatch',
  nutrition_plan: 'medical',

  play_through_it: 'medical',
  injury_at_peak: 'medical',
  play_through_injury: 'medical',
  mysterious_substance: 'syringe',

  controversial_statement: 'megaphone',
  fan_backlash: 'crowd',
  tax_trouble: 'money',
  rival_offer: 'contract',
  saudi_approach: 'plane',
  triumphant_return: 'plane',
  national_team_conflict: 'flag',
  finish_school: 'book',
};

const BY_KIND: Record<Decision['kind'], Glyph> = {
  academy: 'shield',
  transfer: 'contract',
  loan: 'plane',
  loan_return: 'plane',
  spending: 'money',
  career_event: 'pitch',
  retirement: 'flag',
};

/**
 * The event behind a career-event card.
 *
 * Read off `titleKey` (`events.<id>.title`) rather than off the decision id,
 * which is `<id>|<step>`: the copy key is the one thing that cannot drift,
 * because a card with the wrong key would render the wrong words long before
 * anybody noticed the wrong icon.
 */
function eventIdOf(decision: Decision): string | null {
  if (decision.kind !== 'career_event') return null;
  const match = /^events\.([a-z_]+)\./.exec(decision.titleKey);
  return match?.[1] ?? decision.id.split('|')[0] ?? null;
}

export function CardIcon({ decision, size = 34 }: { decision: Decision; size?: number }) {
  const eventId = eventIdOf(decision);
  const glyph = (eventId ? BY_EVENT[eventId] : undefined) ?? BY_KIND[decision.kind] ?? 'pitch';
  return (
    <span
      aria-hidden
      /* A quiet glass chip, not a solid lime block. The old mark was lime on
         lime on a lime border — one loud colour that fought the lime the
         buttons and highlights use for *interactive* things. Now the chip is
         the same dark, faintly-lifted surface as the rest of the interface, a
         hairline edge catches the light, and the lime is spent only on the
         glyph, where it reads as the card's subject rather than a green box. */
      className="grid shrink-0 place-items-center rounded-xl bg-gradient-to-b from-white/[0.09] to-white/[0.03] text-lime-400 shadow-sm ring-1 ring-inset ring-white/10"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58}>
        {GLYPHS[glyph]}
      </svg>
    </span>
  );
}
