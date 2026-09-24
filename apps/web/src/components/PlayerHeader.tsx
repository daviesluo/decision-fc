import { currentRole, type CareerState, type Club } from '@bg/engine';
import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { Crest } from './Crest';
import { SettingsIcon } from './IntroIcons';
import { SettingsSheet } from './SettingsSheet';
import { Pill } from './ui';

/**
 * The status band. Everything the player needs to know about himself lives
 * here, labelled and always visible: age, rating, wage, net worth, the six
 * attributes and the contract. There is no detail page behind it — a stat
 * you have to tap through to reach is a stat that stops mattering.
 */
export function PlayerHeader({
  state,
  club,
  onQuit,
}: {
  state: CareerState;
  club: Club | null;
  onQuit?: () => void;
}) {
  const { t, money, locale } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const player = state.player;
  if (!player) return null;

  const role = currentRole(state);

  return (
    <div className="card px-3 py-2">
      {/* Row 1 — who he is: name, number, position and player type, with the
          rating badge. The club is the crest beside it, not a name — a badge a
          player already recognises does not need spelling out. */}
      <div className="flex items-center gap-2.5">
        {club ? <Crest club={club} size={30} /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-1.5">
            {/* The name yields size, never letters. At a fixed 17px anything
                past nine characters truncated against the type-position phrase
                and the rating badge — LEWANDOWSKI read "LEWA…" on a 375px
                screen in a 3,200-career sweep. Stepped by length so every real
                surname prints whole; `truncate` stays as the last-resort guard
                for the 14-character maximum the input allows. */}
            <span
              className="display truncate font-bold uppercase leading-none"
              style={{
                // Measured, not estimated: with a crest on the bar this row is
                // 199px, and "Technical CDM" (the longest phrase) plus the
                // shirt number leave 89px for the name. Eleven characters at
                // 11px is 84 — LEWANDOWSKI prints whole with margin. Twelve
                // and up is a self-typed name; 9.5px carries it to fourteen,
                // and the truncate guard owns whatever a keyboard invents.
                fontSize: player.lastName.length >= 12 ? 9.5 : player.lastName.length >= 10 ? 11 : 14,
              }}
            >
              {player.lastName}
            </span>
            <span className="num shrink-0 text-[11px] text-white/35">#{player.shirtNumber}</span>
            {/* Player type and position, said as one thing the way a fan would
                — "技术型中锋", "Pace Winger". The archetype (which decides how
                his attributes grow and which systems suit him) leads; Chinese
                runs the two together, English keeps the space. */}
            {/* 10px, measured, not taste: with a crest on the row this phrase
                at 11.5px left a nine-letter surname 64px of space against the
                92px it needs. The name is the headline; the phrase is a tag. */}
            <span className="shrink-0 text-[10px] font-semibold leading-none text-lime-400">
              {t(`archetypes.${player.archetype}.name`)}
              {locale === 'zh' ? '' : ' '}
              {t(`positions.${player.position}`)}
            </span>
          </div>
          {/* Row 2 — how the manager plays, then his standing in that dressing
              room. The tactics decide whether he starts; the squad role is where
              that has left him. The club's name is the crest above; the club's
              league position is not shown here. A free agent has neither. */}
          {club ? (
            <div className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden text-[10.5px] leading-none text-white/55">
              {/* The one thing on this row allowed to lose characters. Everything
                  beside it is a fact you cannot half-say: a role, or whether he
                  is on loan. The row used to truncate as a whole, which sliced
                  the loan pill down the middle and printed "On l" against the
                  OVR badge — visible in the first batch of store screenshots. */}
              <span className="min-w-0 truncate font-semibold text-white/60">{t(`managerStyles.${club.managerStyle}`)}</span>
              {role ? (
                <>
                  <span className="shrink-0 text-white/20">·</span>
                  <span className="shrink-0 font-semibold text-white/75">{t(`roles.${role}`)}</span>
                </>
              ) : null}
              {/* On the situation line, not the name line: the pill was what
                  pushed an 11-character surname into "LEWAND…" every loan
                  season. Tactics · role · loan status are one kind of fact —
                  where he stands this season — and they share a line. */}
              {state.loan ? (
                <span className="shrink-0">
                  <Pill tone="gold">{t('career.onLoan')}</Pill>
                </span>
              ) : null}
            </div>
          ) : (
            <div className="mt-1 truncate text-[10.5px] leading-none text-white/55">{t('career.freeAgent')}</div>
          )}
        </div>
        <OvrBadge value={player.overall} label={t('career.overall')} />
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label={t('settings.open')}
          className="shrink-0 self-start rounded-md p-0.5 leading-none text-white/35"
        >
          <SettingsIcon size={14} />
        </button>
      </div>

      {/* Row 2 — the labelled numbers that drive every decision.

          Market value earns its place here because it is one of the three
          boards a career is scored on, and it was the only one the player could
          not see while playing. That is different from showing a running
          leaderboard *rank*, which is deliberately kept off-screen: this is a
          stat about the player, the same kind of thing as his rating. */}
      <div className="mt-2 grid grid-cols-5 gap-1 border-t border-white/8 pt-2">
        {/* Age and value get the colour. Age is the clock the whole career is
            run against, and value is one of the three things it is scored on
            at the end — the two numbers on this row a player should feel. */}
        <Fact label={t('career.age')} value={String(player.age)} tone="lime" />
        <Fact label={t('career.marketValue')} value={money(player.marketValue)} tone="gold" />
        {/* A wage with no period on it is a number nobody can size up. */}
        <Fact
          label={t('career.wage')}
          value={state.contract ? money(state.contract.wage) : '—'}
          suffix={state.contract ? t('career.perWeek') : undefined}
        />
        <Fact label={t('career.cash')} value={money(state.cash)} />
        <Fact
          label={t('career.contract')}
          value={
            // "Free agent" overflows a fifth-of-the-bar cell, and the row
            // under the name already says it in full when he has no club.
            !state.contract
              ? '—'
              : state.contract.yearsRemaining <= 0
                ? t('career.contractFinal')
                : t('career.contractYears', { years: state.contract.yearsRemaining })
          }
        />
      </div>

      {/* The six per-attribute values used to sit here as a third row. They
          were the densest thing on the bar and the least often needed mid-
          decision — the overall rating already says where he can play — so the
          bar drops them to breathe. They still drive everything under the hood. */}

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} onQuit={onQuit} />
    </div>
  );
}

function Fact({
  label,
  value,
  tone,
  suffix,
}: {
  label: string;
  value: string;
  tone?: 'gold' | 'lime';
  suffix?: string;
}) {
  return (
    <div className="min-w-0 text-center">
      <div
        className={`num truncate text-[13px] font-bold leading-none ${
          tone === 'gold' ? 'text-gold' : tone === 'lime' ? 'text-lime-400' : ''
        }`}
      >
        {value}
        {suffix ? <span className="text-[9px] font-semibold text-white/40">{suffix}</span> : null}
      </div>
      <div className="mt-0.5 truncate text-[8.5px] font-semibold uppercase tracking-wide text-white/35">{label}</div>
    </div>
  );
}

/**
 * The rating badge, tiered like a collectible card: bronze, silver, gold,
 * ice, purple — the ladder itself is something to climb.
 */
export function OvrBadge({ value, label, size = 'md' }: { value: number; label: string; size?: 'md' | 'sm' }) {
  const tier =
    value >= 95
      ? 'bg-gradient-to-b from-fuchsia-500/40 to-purple-700/40 text-fuchsia-200 ring-fuchsia-400/50'
      : value >= 90
        ? 'bg-gradient-to-b from-sky-300/30 to-sky-600/30 text-sky-100 ring-sky-300/50'
        : value >= 80
          ? 'bg-gradient-to-b from-yellow-300/25 to-amber-600/25 text-yellow-200 ring-yellow-400/40'
          : value >= 70
            ? 'bg-gradient-to-b from-slate-200/20 to-slate-500/20 text-slate-100 ring-slate-300/30'
            : 'bg-gradient-to-b from-orange-800/30 to-amber-950/40 text-orange-200 ring-orange-700/40';

  return (
    <div
      className={`flex shrink-0 flex-col items-center justify-center rounded-lg ring-1 ${tier} ${
        size === 'md' ? 'h-[40px] w-[40px]' : 'h-[34px] w-[34px]'
      }`}
    >
      <span className={`num font-bold leading-none ${size === 'md' ? 'text-[18px]' : 'text-[15px]'}`}>{value}</span>
      <span className="mt-0.5 text-[7px] font-bold uppercase tracking-wider opacity-70">{label}</span>
    </div>
  );
}
