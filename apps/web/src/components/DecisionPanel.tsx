import {
  CARD_SLOTS,
  clubStanding,
  type CareerState,
  type Club,
  type Decision,
  type DecisionOption,
  type WorldIndex,
} from '@bg/engine';
import { WORLD } from '@bg/content';
import { useI18n } from '../lib/i18n';
import { useSettings } from '../lib/settings';
import { indexFor, localizeParams, standingName } from '../lib/game';
import { CardIcon } from './CardIcon';
import { Crest } from './Crest';

/**
 * The decision, pinned to the bottom of the screen under the thumb.
 *
 * Options are rows rather than cards so three of them still fit on a small
 * phone without scrolling. The odds printed on an option are the odds the
 * engine actually rolls — the one rule nothing overrides, and the reason
 * losing here feels like losing a bet rather than being cheated.
 */
/**
 * The beat between choosing and finding out.
 *
 * A gamble earns the full treatment: 1 s of the two outcome pills taking turns
 * under the light, then the real one locks in, then the season plays. Anything
 * else gets `settle` — the chosen row lit, the rest dimmed, held just long
 * enough to register that the choice was made. Nothing resolves instantly;
 * that was the flat, un-dramatic part of the old screen.
 */
export interface RevealState {
  optionId: string;
  tone: 'positive' | 'negative' | 'neutral';
  phase: 'roulette' | 'lock' | 'settle';
}

export function DecisionPanel({
  state,
  decision,
  currentClub,
  countryId,
  onChoose,
  reveal = null,
}: {
  /**
   * The career, purely so a club's **current** division can be looked up.
   *
   * This panel used to read the league — and then, for longer, the club itself
   * — off the static world index, which is the world as it started. A career
   * moves clubs between divisions and changes their managers, so a club it had
   * relegated three seasons ago still had "Premier League" printed on its offer
   * card, and the club the player was actually at still named the manager who
   * had been sacked. Both sat next to a wage and a squad role computed from the
   * real ones. The card contradicted itself.
   */
  state: CareerState;
  decision: Decision;
  currentClub: Club | null;
  /** The player's nationality — names the international competitions. */
  countryId: string | null;
  onChoose: (optionId: string) => void;
  reveal?: RevealState | null;
}) {
  const { t, clubName, country: countryName } = useI18n();
  const { reducedMotion } = useSettings();
  // The engine's own params win — during a loan they name the club he actually
  // plays for. The current club only fills the slot when nothing better exists.
  const params: Record<string, string | number> = {
    ...(currentClub ? { club: clubName(currentClub) } : {}),
    ...localizeParams(decision.params, clubName, t, { clubId: currentClub?.id ?? null, countryId }, countryName),
  };
  // The career's own view of the world: divisions move, and an offer card that
  // names the wrong one contradicts the wage and role printed beside it.
  const careerIndex = indexFor(state);

  return (
    /*
     * `data-decision` counts the decisions already answered, so it changes on
     * exactly the event "this card was resolved and the next one is up".
     *
     * It exists for `tools/verify-ui.mjs`, which used to detect that by
     * comparing the first option's id — and ten cards in the deck share a
     * first option id with another card (`refuse`, `rest`, `reject`,
     * `ease_off`, `stay`). Two of those back to back looked to the harness
     * like a card that never moved, and it failed a keypress that had in fact
     * worked. A heuristic identity in a test is a test that reports faults
     * that are not there; this is the real one.
     */
    <div className={reducedMotion ? undefined : 'animate-rise'} data-decision={state.history.length}>
      <div className="flex items-start gap-2.5">
        {/* A drawn mark, not an emoji — see CardIcon. A wall of identical
            headings is the thing it exists to break up. */}
        <CardIcon decision={decision} />
        <h2 className="display min-w-0 flex-1 text-[21px] font-bold leading-[1.15]">
          {t(decision.titleKey, params)}
        </h2>
        {typeof params.month === 'string' ? (
          <span className="num shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/55">
            {params.month}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[12.5px] leading-snug text-white/55">
        {t(decision.bodyKey, params)}
      </p>

      <div className={`mt-3 space-y-2 ${reducedMotion || reveal ? '' : 'stagger'}`}>
        {decision.options.slice(0, CARD_SLOTS).map((option, slot) => (
          <OptionRow
            key={option.id}
            option={option}
            slot={slot}
            index={careerIndex}
            showAcademyRating={decision.kind === 'academy'}
            currentClub={currentClub}
            countryId={countryId}
            onChoose={onChoose}
            mode={reveal === null ? 'idle' : reveal.optionId === option.id ? reveal.phase : 'dimmed'}
            revealTone={reveal?.tone ?? 'neutral'}
          />
        ))}
      </div>
    </div>
  );
}

function OptionRow({
  option,
  slot,
  index,
  showAcademyRating,
  currentClub,
  countryId,
  onChoose,
  mode,
  revealTone,
}: {
  option: DecisionOption;
  /**
   * Which row this is, from zero. Only used for the number-key badge, and the
   * career screen binds the same numbers — so if the order here ever stops
   * matching the order there, the badge starts lying about what a key does.
   */
  slot: number;
  /** The career's own view of the world — divisions move. */
  index: WorldIndex;
  /**
   * Academy cards only. Coaching is the one thing that separates three otherwise
   * identical youth offers, and it is invisible everywhere else because after 21
   * it stops mattering — see `coachingMultiplier`.
   */
  showAcademyRating: boolean;
  currentClub: Club | null;
  countryId: string | null;
  onChoose: (optionId: string) => void;
  mode: 'idle' | 'roulette' | 'lock' | 'settle' | 'dimmed';
  revealTone: 'positive' | 'negative' | 'neutral';
}) {
  const { t, money, clubName, country: countryName } = useI18n();
  const { showOdds } = useSettings();
  const club = option.clubId ? safeClub(index, option.clubId) : null;
  const league = club ? index.leagueOfClub(club.id) : null;
  const params = {
    ...(club ? { club: clubName(club) } : currentClub ? { club: clubName(currentClub) } : {}),
    ...localizeParams(option.params, clubName, t, { clubId: club?.id ?? currentClub?.id ?? null, countryId }, countryName),
  };

  // The pill whose tone matches the engine's real outcome is the winner.
  const winnerIndex = mode === 'lock' ? option.outcomes.findIndex((o) => o.tone === revealTone) : -1;

  return (
    <button
      data-option
      data-option-id={option.id}
      onClick={() => onChoose(option.id)}
      disabled={mode !== 'idle'}
      className={`card flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-all duration-300 ease-out active:border-lime-500/50 active:bg-white/[0.09] ${
        mode === 'dimmed'
          ? 'opacity-30'
          : mode === 'settle'
            ? 'border-lime-500/60 bg-lime-500/[0.08] ring-1 ring-lime-500/30'
            : mode === 'roulette' || mode === 'lock'
              ? 'border-white/40 ring-1 ring-white/30'
              : // Only an option still waiting to be picked answers the pointer.
                // Once a choice is made every row is mid-reveal and lighting one
                // under the cursor would read as "this one is still available".
                'hover:border-lime-500/40 hover:bg-white/[0.075]'
      }`}
    >
      {club ? <Crest club={club} size={30} /> : null}

      <div className="min-w-0 flex-1">
        <div className="display text-[14.5px] font-bold leading-tight">
          {t(option.labelKey, params)}
        </div>

        {club && league ? (
          <div className="mt-1 flex items-center gap-1.5 text-[10.5px] leading-none text-white/45">
            <span className="shrink-0 font-semibold text-white/60">{t(`leagues.${league.id}`)}</span>
            {/* What kind of club this is, in words. The division and the wage
                do not answer the first question anybody asks about a club they
                have never heard of: are they any good? Measured inside their
                own division, so "mid-table" means mid-table of where they
                actually play. */}
            <span className="shrink-0 text-white/50">
              {standingName(club.id, clubStanding(club, league.id, WORLD), t)}
            </span>
            <StrengthBars reputation={club.reputation} />
            {showAcademyRating ? (
              <span className="num shrink-0 font-bold text-lime-400">
                {t('career.academyRating')} {club.training}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* How the manager plays, and the role he is promised — the same
            tactics-then-role line the player's own header carries. Putting the
            role here rather than in the tag row below keeps the tags to money
            and length, which stopped them wrapping to a second line, and reads
            the way the top bar already taught the player to read it. */}
        {club && league ? (
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 text-[10.5px] leading-none text-white/40">
            {/* Nothing on this line may lose characters. The style used to be
                the part allowed to truncate, and a 375px phone read
                "Counter-a…" — the playtest counted 162 clipped styles in 64
                careers. So the line wraps rather than cuts: when it does not
                fit, the role drops under it whole. The role is a fact you
                cannot half-say, and neither is the manager's football. */}
            <span className="whitespace-nowrap">{t(`managerStyles.${club.managerStyle}`)}</span>
            {/* No verdict on whether that football suits him — a rule since
                2026-09-23. Reading the manager's style against your own game is
                the player's call; How to Play says what each style asks for, and
                every transfer window is built with at least one club whose
                style suits him, which the card does not point out. */}
            {/* Loan options carry the role on `promisedRole` instead of an
                offer — same concept, same slot on the line, so a loan card and
                a transfer card read identically. */}
            {option.offer || option.promisedRole ? (
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span className="text-white/20">·</span>
                <span className="font-semibold text-white/60">
                  {t(`roles.${option.offer?.promisedRole ?? option.promisedRole}`)}
                </span>
              </span>
            ) : null}
          </div>
        ) : null}

        {option.offer && option.offer.wage > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Tag tone="gold">
              {money(option.offer.wage)}
              {t('career.perWeek')}
            </Tag>
            {/* A deal being signed states its length; the one option that is
                the contract he already has states what is left of it. Both used
                "{years}y left", which made "go back to your parent club" read
                as signing a fresh one-year contract — the club had decided
                nothing, and the card looked like an automatic renewal. */}
            <Tag>
              {option.offer.existing
                ? option.offer.years <= 1
                  ? t('career.contractFinal')
                  : t('career.contractYears', { years: option.offer.years })
                : t('career.contractLength', { years: option.offer.years })}
            </Tag>
            {option.offer.signingBonus > 0 ? (
              <Tag tone="positive">+{money(option.offer.signingBonus)}</Tag>
            ) : null}
          </div>
        ) : null}

        {option.outcomes.length > 0 ? (
          <div className="mt-1.5 space-y-0.5">
            {option.outcomes.map((outcome, i) => (
              <div
                key={i}
                /* `px-1` lives on the base row, not on the roulette/lock states,
                   so the text width never changes when the animation starts —
                   it used to be added only while animating, which narrowed the
                   row mid-spin and bumped a word onto a new line. Only the
                   background (roulette) and the ring/transform (lock) change now,
                   and none of those affect layout. */
                className={`flex items-center gap-1.5 rounded-md px-1 text-[11.5px] leading-tight transition-all duration-300 ease-out ${
                  mode === 'roulette'
                    ? `roulette-${i % 2}`
                    : mode === 'lock'
                      ? i === winnerIndex
                        ? `ring-1 ${
                            revealTone === 'positive'
                              ? 'bg-gain/15 ring-gain/60'
                              : revealTone === 'negative'
                                ? 'bg-loss/15 ring-loss/60'
                                : 'bg-white/10 ring-white/40'
                          }`
                        : 'scale-[0.97] opacity-25 grayscale'
                      : ''
                }`}
              >
                {outcome.probability !== undefined && showOdds ? (
                  <span
                    className={`num w-[34px] shrink-0 rounded text-center text-[11px] font-bold ${
                      outcome.tone === 'positive'
                        ? 'bg-gain/18 text-gain'
                        : outcome.tone === 'negative'
                          ? 'bg-loss/18 text-loss'
                          : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {outcome.probability}%
                  </span>
                ) : (
                  <span
                    className={`w-[34px] shrink-0 text-center ${
                      outcome.tone === 'positive'
                        ? 'text-gain'
                        : outcome.tone === 'negative'
                          ? 'text-loss'
                          : 'text-white/30'
                    }`}
                  >
                    {outcome.tone === 'positive' ? '↑' : outcome.tone === 'negative' ? '↓' : '→'}
                  </span>
                )}
                {/* `text-balance` evens the wrap so a hint that spills a word or
                    two onto a second line reads as two lines rather than a full
                    line and one orphan character — the loyalty card's
                    "…这件事一直算 / 数。" was one. Flex items are blockified,
                    so balancing applies here. */}
                <span className="min-w-0 flex-1 text-balance text-white/70">
                  {/* What it does, not how it feels — the prose waits for the
                      result card. Card-level params fill any {club} slot. */}
                  {outcome.effects && outcome.effects.length > 0
                    ? outcome.effects
                        .map((effect) =>
                          t(effect.key, {
                            ...effect.params,
                            ...(typeof effect.params?.role === 'string'
                              ? { role: t(`rolesInline.${effect.params.role}`) }
                              : {}),
                            // Consequence params carry engine ids, and every id
                            // that reaches the screen has to be looked up. This
                            // one was not, so an option touching three
                            // competitions read "league夺冠机会变大".
                            ...(typeof effect.params?.competition === 'string'
                              ? { competition: t(`competitions.${effect.params.competition}`) }
                              : {}),
                            // The engine counts in euros and knows nothing
                            // about currencies; the screen is where a number
                            // becomes money the player recognises.
                            ...(typeof effect.params?.cash === 'number'
                              ? { cash: money(effect.params.cash) }
                              : {}),
                            // A goalkeeper's six bars are not an outfielder's,
                            // so the engine says which player is being asked.
                            ...(typeof effect.params?.attribute === 'string'
                              ? {
                                  attribute: t(
                                    `${effect.params.gk ? 'attributesGk' : 'attributes'}.${effect.params.attribute}`,
                                  ),
                                }
                              : {}),
                          }),
                        )
                        .join(' · ')
                    : t(outcome.labelKey, {
                        ...params,
                        ...localizeParams(
                          outcome.params,
                          clubName,
                          t,
                          { clubId: club?.id ?? currentClub?.id ?? null, countryId },
                          countryName,
                        ),
                        // A hand-written outcome line can name money too — the
                        // savings card says what a tier takes out of the wage
                        // every year rather than "a slice of it".
                        ...(typeof outcome.params?.cash === 'number'
                          ? { cash: money(outcome.params.cash) }
                          : {}),
                      })}
                  {/* Why the bad branch is bad, said before he chooses rather
                      than after. `effects` gives him the price — "Ability −3 ·
                      Higher injury risk" — and the reason used to live only in
                      the result prose, which arrives once the decision is made.
                      Deliberate, and it is the difference between a gamble
                      and a coin: forty per cent of the time the boots leave you
                      slower, and nothing said it was because boots you cannot
                      play in also pay you nothing. */}
                  {outcome.whyKey ? (
                    <span className="block text-[10.5px] leading-tight text-white/35">
                      {t(outcome.whyKey, params)}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/*
        The key that picks this row.
        `kbd` is `(hover: hover) and (pointer: fine)`, so it never appears on a
        touchscreen — an instruction to press a key you do not have is worse
        than no instruction. It is the only thing that advertises keyboard play,
        which is why it is a badge on the row rather than a line of help text
        somewhere else: it is impossible to read it and not know what it does.
      */}
      <span
        aria-hidden
        className="num hidden shrink-0 items-center justify-center rounded-md border border-white/12 px-1.5 text-[10.5px] font-bold leading-[17px] text-white/30 kbd:flex"
      >
        {slot + 1}
      </span>
    </button>
  );
}

function Tag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'gold' | 'positive' }) {
  const tones = {
    neutral: 'bg-white/[0.08] text-white/65',
    gold: 'bg-gold/15 text-gold',
    positive: 'bg-gain/15 text-gain',
  }[tone];
  return (
    <span className={`num shrink-0 rounded px-1.5 py-[2px] text-[11px] font-bold leading-none ${tones}`}>
      {children}
    </span>
  );
}

/**
 * Club strength as bars, from `club.reputation` (0–100) — the squad-quality
 * number that decides the role he would actually get there. It used to show
 * *league* strength, which repeated what the division name already says and
 * made every club in a window look identical (changed 2026-08-02).
 */
function StrengthBars({ reputation }: { reputation: number }) {
  const filled = Math.max(1, Math.round(reputation / 20));
  return (
    <span className="inline-flex shrink-0 items-center gap-[2px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={`h-[8px] w-[3px] rounded-sm ${i < filled ? 'bg-lime-500' : 'bg-white/15'}`} />
      ))}
    </span>
  );
}

/**
 * The club as *this career* has it, not as the world opened.
 *
 * `indexWorld` folds `managerChanges` into the club it returns, so the static
 * index hands back the manager the club had at kick-off. Every row that names
 * the player's own club — stay, run the deal down, go back to your parent club
 * — was printing that original style beside a wage and a squad role computed
 * from the *current* one, so the card contradicted itself. Over 300 careers,
 * 1,028 of the 1,086 affected rows were wrong.
 *
 * Still guarded: a save can outlive the club id it names.
 */
function safeClub(index: WorldIndex, id: string) {
  try {
    return index.club(id);
  } catch {
    return null;
  }
}
