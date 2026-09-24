import { useMemo, useState } from 'react';
import { COUNTRIES } from '@bg/content';
import type { Archetype, IdentityInput, Position } from '@bg/engine';
import { useI18n } from '../lib/i18n';
import { flagLabel } from '../lib/flags';
import { Button, Screen, Sheet } from '../components/ui';
import { Jersey } from '../components/Jersey';

/**
 * Character creation, in three steps on one screen.
 *
 * The shirt is the point: it carries the name and number the player is
 * choosing, and it updates as they type, so the decision feels like being
 * handed a kit rather than filling in a form. Positions are picked on a
 * drawn pitch — each spot labelled, because "CDM" means nothing to somebody
 * who has never played a football game.
 *
 * Deliberately absent: tax rates. They were shown next to each country and
 * quietly turned nationality into an optimisation problem, which is not the
 * question being asked here.
 */
const PITCH_ROWS: { position: Position; }[][] = [
  [{ position: 'LW' }, { position: 'ST' }, { position: 'RW' }],
  // LM/RM are retired (deliberately): the CAM holds the line alone.
  [{ position: 'CAM' }],
  [{ position: 'CDM' }, { position: 'CM' }],
  [{ position: 'LB' }, { position: 'CB' }, { position: 'RB' }],
  [{ position: 'GK' }],
];

const ARCHETYPES: Archetype[] = ['pace', 'technical', 'physical'];

/**
 * What a replay brings with it. Everything except the player type, which is
 * the one thing worth changing between careers — and all of it still editable
 * here, because this is the screen where those choices are made.
 */
export type CarriedIdentity = Pick<
  IdentityInput,
  'lastName' | 'shirtNumber' | 'foot' | 'countryId' | 'position'
>;

export function IdentityScreen({
  onConfirm,
  onBack,
  initial = null,
}: {
  onConfirm: (identity: IdentityInput) => void;
  /** Back to the intro screen, to pick a different pace or language. */
  onBack: () => void;
  /** The last career's identity, on a replay. */
  initial?: CarriedIdentity | null;
}) {
  const { t, country: countryName, locale } = useI18n();
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [shirtNumber, setShirtNumber] = useState(initial?.shirtNumber ?? 10);
  const [foot, setFoot] = useState<'left' | 'right'>(initial?.foot ?? 'right');
  const [countryId, setCountryId] = useState(initial?.countryId ?? 'eng');
  const [position, setPosition] = useState<Position>(initial?.position ?? 'ST');
  const [archetype, setArchetype] = useState<Archetype>('technical');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const countries = useMemo(() => {
    const sorted = [...COUNTRIES].sort((a, b) =>
      countryName(a.id).localeCompare(countryName(b.id), locale === 'zh' ? 'zh-Hans-CN' : 'en'),
    );
    if (!query.trim()) return sorted;
    const needle = query.trim().toLowerCase();
    return sorted.filter((c) => countryName(c.id).toLowerCase().includes(needle) || c.id.includes(needle));
  }, [query, countryName, locale]);

  const selected = COUNTRIES.find((c) => c.id === countryId);

  return (
    <>
      <Screen
        top={
          <div className="flex items-start gap-2">
            {/* Nothing has been committed yet — the career exists but has no
                player in it — so going back is free and needs no confirmation.
                Without this the pace picked on the previous screen was locked
                in by a single tap, and the only way to change it was to finish
                or abandon a career. */}
            <button
              onClick={onBack}
              aria-label={t('identity.back')}
              className="-ml-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[26px] leading-none text-white/55 active:bg-white/10"
            >
              ‹
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="display text-[24px] font-bold uppercase leading-none">{t('identity.title')}</h1>
              <p className="mt-1 text-[12px] leading-snug text-white/50">{t('identity.subtitle')}</p>
            </div>
          </div>
        }
        middle={
          <div
            className="flex h-full flex-col gap-2 overflow-y-auto"
            /*
              `safe center` rather than `center`, and rather than a Tailwind
              class, on purpose.

              On a phone this picker fills its band or overflows it, so it has
              always stacked from the top. In the desktop frame the same content
              is laid out wider, finishes early, and left a band of dead black
              between the archetype note and the button. Centring fixes that —
              but plain `center` in a scroll container pushes the overflowing top
              out of reach, which would break the phone to fix the desktop.
              `safe` is exactly the keyword for "centre it unless that would
              clip", and a browser too old to know it drops the declaration and
              gets today's top-aligned layout.
            */
            style={{ justifyContent: 'safe center' }}
          >
            {/* ---- the shirt, with the name on the back ------------------ */}
            <div className="flex shrink-0 items-center gap-3">
              {/* Blank until he types. A shirt printed with "Enter a name" is
                  a form field wearing a kit. */}
              <Jersey name={lastName} number={shirtNumber} countryId={countryId} width={104} />

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <input
                  value={lastName}
                  /* Stored upper-case, not just drawn upper-case. The field
                     had `uppercase` as a CSS class, so the shirt and the status
                     band showed one thing and the save held another. */
                  onChange={(e) => setLastName(e.target.value.toUpperCase())}
                  placeholder={t('identity.lastNamePlaceholder')}
                  maxLength={14}
                  className="display h-[40px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[16px] font-bold uppercase outline-none placeholder:font-normal placeholder:normal-case placeholder:text-white/25 focus:border-lime-500/50"
                />
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label={t('identity.number')}
                    min={1}
                    max={99}
                    value={shirtNumber}
                    onChange={(e) => setShirtNumber(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                    className="num h-[38px] w-[58px] shrink-0 rounded-xl border border-white/10 bg-white/[0.04] text-center text-[16px] font-bold outline-none focus:border-lime-500/50"
                  />
                  {(['left', 'right'] as const).map((option) => (
                    <button
                      key={option}
                      data-foot={option}
                      onClick={() => setFoot(option)}
                      className={`h-[38px] flex-1 rounded-xl border text-[12px] font-semibold transition-colors ${
                        foot === option
                          ? 'border-lime-500 bg-lime-500/[0.14] text-lime-400'
                          : 'border-white/10 bg-white/[0.03] text-white/50'
                      }`}
                    >
                      {t(`identity.${option}`)}
                    </button>
                  ))}
                </div>
                <button
                  data-country-picker
                  onClick={() => setPickerOpen(true)}
                  className="flex h-[38px] items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-[16px] leading-none">
                      {selected ? flagLabel(selected.iso, selected.id) : '—'}
                    </span>
                    <span className="truncate text-[14px] font-semibold">
                      {selected ? countryName(selected.id) : '—'}
                    </span>
                  </span>
                  <span className="text-white/30">›</span>
                </button>
              </div>
            </div>

            {/* ---- the pitch --------------------------------------------- */}
            <SectionTitle>{t('identity.position')}</SectionTitle>
            <div className="relative shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgb(155_238_22/0.07),transparent)] p-2">
              <PitchLines />
              <div className="relative flex flex-col gap-1.5">
                {PITCH_ROWS.map((row, i) => (
                  <div key={i} className="flex justify-center gap-1.5">
                    {row.map(({ position: option }) => {
                      const active = position === option;
                      return (
                        <button
                          key={option}
                          data-position={option}
                          onClick={() => setPosition(option)}
                          className={`flex min-w-[74px] flex-col items-center rounded-lg border px-1 py-1 transition-all duration-150 ${
                            active
                              ? 'border-lime-500 bg-lime-500 text-turf-950'
                              : 'border-white/10 bg-white/[0.04] text-white/70'
                          }`}
                        >
                          <span className="display text-[13px] font-bold uppercase leading-none">
                            {t(`positions.${option}`)}
                          </span>
                          <span
                            className={`mt-0.5 truncate text-[8.5px] leading-none ${
                              active ? 'text-turf-950/70' : 'text-white/40'
                            }`}
                          >
                            {t(`positionNames.${option}`)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* ---- player type -------------------------------------------
                Three names side by side, and the trade-off spelled out for
                whichever is selected. Stacking all three sets of pros and cons
                pushed the last one below the fold on a 667px screen, and this
                screen is not allowed to scroll. */}
            <SectionTitle>{t('identity.archetype')}</SectionTitle>
            <div className="shrink-0 pb-1">
              <div className="flex gap-1.5">
                {ARCHETYPES.map((option) => {
                  const active = archetype === option;
                  return (
                    <button
                      key={option}
                      data-archetype={option}
                      onClick={() => setArchetype(option)}
                      className={`display flex-1 rounded-xl border py-2 text-[13.5px] font-bold transition-colors ${
                        active
                          ? 'border-lime-500 bg-lime-500 text-turf-950'
                          : 'border-white/10 bg-white/[0.03] text-white/60'
                      }`}
                    >
                      {t(`archetypes.${option}.name`)}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 flex flex-col gap-0.5 rounded-xl border border-white/8 bg-white/[0.02] px-2.5 py-1.5 text-[11px] leading-snug">
                <span className="text-gain">+ {t(`archetypes.${archetype}.pro`)}</span>
                <span className="text-loss">− {t(`archetypes.${archetype}.con`)}</span>
              </div>
            </div>
          </div>
        }
        bottom={
          <Button onClick={() => onConfirm({ lastName, shirtNumber, foot, countryId, position, archetype })}>
            {t('identity.confirm')}
          </Button>
        }
      />

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title={t('identity.nationality')}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('identity.searchCountry')}
          className="mb-2 h-[42px] w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[14px] outline-none placeholder:text-white/25 focus:border-lime-500/50"
        />
        <div className="grid grid-cols-2 gap-0.5">
          {countries.map((option) => (
            <button
              key={option.id}
              data-country={option.id}
              onClick={() => {
                setCountryId(option.id);
                setPickerOpen(false);
                setQuery('');
              }}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] ${
                countryId === option.id ? 'bg-lime-500/12 font-bold text-lime-400' : ''
              }`}
            >
              <span className="shrink-0 text-[15px] leading-none">{flagLabel(option.iso, option.id)}</span>
              <span className="truncate">{countryName(option.id)}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}


/**
 * The pitch markings behind the position buttons: attacking goal off the top,
 * so the centre circle dips in from the top edge and your own penalty box sits
 * under the keeper. Strokes are non-scaling, so the box can stretch to
 * whatever height the rows need without the lines going thick or thin.
 */
function PitchLines() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 130"
      preserveAspectRatio="none"
      fill="none"
      stroke="rgb(255 255 255 / 0.1)"
      strokeWidth="1.2"
      aria-hidden
    >
      <g vectorEffect="non-scaling-stroke">
        {/* Touchlines and goal line. */}
        <rect x="2.5" y="2.5" width="95" height="125" rx="1" vectorEffect="non-scaling-stroke" />
        {/* Centre circle, dipping in from the halfway line off the top. */}
        <ellipse cx="50" cy="2.5" rx="16" ry="13" vectorEffect="non-scaling-stroke" />
        <circle cx="50" cy="10" r="0.8" fill="rgb(255 255 255 / 0.12)" stroke="none" />
        {/* Penalty area, six-yard box, spot and the D. */}
        <rect x="21" y="103" width="58" height="24.5" vectorEffect="non-scaling-stroke" />
        <rect x="35" y="118" width="30" height="9.5" vectorEffect="non-scaling-stroke" />
        <circle cx="50" cy="111" r="0.8" fill="rgb(255 255 255 / 0.12)" stroke="none" />
        <path d="M38 103 Q50 93 62 103" vectorEffect="non-scaling-stroke" />
        {/* Corner arcs at the goal line. */}
        <path d="M2.5 122 Q7 123.5 7.5 127.5" vectorEffect="non-scaling-stroke" />
        <path d="M97.5 122 Q93 123.5 92.5 127.5" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="display shrink-0 pt-0.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/35">
      {children}
    </div>
  );
}

