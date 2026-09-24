import { useState } from 'react';
import type { Pace } from '@bg/engine';
import { useI18n } from '../lib/i18n';
import { SettingsSheet } from '../components/SettingsSheet';
import { Button, Screen, Sheet } from '../components/ui';
import { DAILY_PACE, dailySeed, markPlayedToday, playedToday } from '../lib/daily';
import { DailyIcon, HowToIcon, RankingsIcon, SettingsIcon } from '../components/IntroIcons';
import { markNewsSeen, newsSeen } from '../lib/news';

const PACES: Pace[] = ['quick', 'standard', 'deep'];

/** Pace id → the capitalised fragment its copy keys are built from. */
const paceKeyOf = (pace: Pace) => (pace === 'quick' ? 'Quick' : pace === 'standard' ? 'Standard' : 'Deep');

export function IntroScreen({ onStart }: { onStart: (pace: Pace, seed?: string) => void }) {
  const { t, locale, setLocale } = useI18n();
  const [pace, setPace] = useState<Pace>('standard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheet, setSheet] = useState<'daily' | 'boards' | 'howto' | 'news' | null>(null);
  /* Read once on mount: the dot must not vanish under the player's finger the
     moment they open the sheet — it is set when the sheet closes. */
  const [newsRead, setNewsRead] = useState(() => newsSeen());
  const done = playedToday();

  return (
    <div className="relative h-full">
      {/* Floodlights and mown stripes, in CSS. No image payload, scales to any
          viewport, and sets the tone before a single word is read. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-x-[-20%] top-[-28%] h-[70%] rounded-[50%]"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgb(184 255 60 / 0.28) 0%, rgb(155 238 22 / 0.06) 42%, transparent 72%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'repeating-linear-gradient(97deg, transparent 0 46px, rgb(255 255 255 / 0.018) 46px 92px)',
          }}
        />
      </div>

      <Screen
        middle={
          /* The hero sizes itself to the space it is given — see `.intro-hero`
             in app.css. It used to be a fixed 44px title centred in a clipped
             box, and whenever the box came out shorter than the hero (an
             iPhone SE; every iPhone once iOS 26 shortened the window) the
             centring pushed the overflow out of both ends: the eyebrow up under
             the clock, the subtitle off the bottom. `my-auto` rather than
             `justify-center` is the other half — it centres while there is
             room and never pushes anything above the top when there is not. */
          <div className="intro-hero relative flex h-full flex-col">
            <div className="animate-rise my-auto">
              <div className="intro-eyebrow mb-2.5 flex items-center gap-2">
                <span className="h-[3px] w-6 rounded-full bg-lime-500" />
                <span className="display text-[11px] font-bold uppercase tracking-[0.26em] text-lime-400">
                  {t('app.title')}
                </span>
              </div>

              <h1 className="intro-title display font-bold uppercase leading-[0.95]">
                {t('intro.title')}
              </h1>
              <p className="intro-sub mt-3 max-w-[30ch] text-[14.5px] leading-relaxed text-balance text-white/50">
                {t('intro.subtitle')}
              </p>
              {/* itch.io only. There the game is an iframe on someone else's
                  page: no address bar of its own, and the world leaderboards
                  are the one part of it that cannot follow it there. A single
                  line, and a link out rather than a banner. */}
              {__ITCH__ ? (
                <a
                  href="https://decisionfc.com/"
                  target="_blank"
                  rel="noopener"
                  className="mt-3 inline-block text-[11.5px] leading-snug text-lime-400/75 underline decoration-lime-400/30 underline-offset-4 transition-colors hover:text-lime-300"
                >
                  {t('intro.itchHome')}
                </a>
              ) : null}
            </div>
          </div>
        }
        bottom={
          <div className="relative">
            <div className="mb-2 flex items-center justify-between">
              <span className="display text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
                {t('intro.pace')}
              </span>
              <div className="flex items-center gap-1">
                {(['en', 'zh'] as const).map((code) => (
                  <button
                    key={code}
                    onClick={() => setLocale(code)}
                    className={`rounded px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      locale === code ? 'bg-white/14 text-chalk' : 'text-white/35 hover:text-white/70'
                    }`}
                  >
                    {code === 'en' ? 'EN' : '中文'}
                  </button>
                ))}
                <button
                  onClick={() => setSettingsOpen(true)}
                  aria-label={t('settings.open')}
                  className="ml-1 rounded px-2 py-1 text-white/45 transition-colors hover:text-white/80"
                >
                  <SettingsIcon size={16} />
                </button>
              </div>
            </div>

            <div className="mb-2 grid grid-cols-3 gap-2">
              {PACES.map((option) => {
                const active = pace === option;
                const key = paceKeyOf(option);
                return (
                  <button
                    key={option}
                    data-pace={option}
                    aria-pressed={active}
                    onClick={() => setPace(option)}
                    className={`rounded-xl border px-2 py-2.5 text-center transition-all duration-150 ${
                      active
                        ? 'border-lime-500 bg-lime-500/[0.12]'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.07]'
                    }`}
                  >
                    <div className={`display text-[15px] font-bold uppercase ${active ? 'text-lime-400' : ''}`}>
                      {t(`intro.pace${key}`)}
                    </div>
                    <div className="mt-0.5 text-[10px] leading-tight text-white/40">
                      {t(`intro.pace${key}Short`)}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* What the selected pace actually is. One block that swaps rather
                than three that stack, because three descriptions do not fit
                above the fold on a 375px screen and this screen never scrolls. */}
            {/* Three lines, in the order a player wants them: how often a card
                comes, what that feels like to play, and the reminder that pace
                is not difficulty. They were two paragraphs, and the first thing
                anybody wants to know was buried in the middle of one. */}
            {/* All three are laid in the same grid cell and only the chosen one
                is visible, so the block is always as tall as the longest — the
                rule (2026-09-23) that picking a pace moves nothing else
                on the screen. Standard's line is shorter than the other two, and
                choosing it used to pull the start button up a line. */}
            <div className="mb-3 grid rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-2" data-pace-blurb>
              {PACES.map((option) => {
                const key = paceKeyOf(option);
                const shown = option === pace;
                return (
                  <div
                    key={option}
                    className={`[grid-area:1/1] ${shown ? '' : 'invisible'}`}
                    aria-hidden={shown ? undefined : true}
                  >
                    <p className="text-[11px] font-semibold leading-snug text-lime-400/90">
                      {t(`intro.pace${key}Cards`)}
                    </p>
                    <p className="mt-1 text-[10.5px] leading-snug text-white/60">{t(`intro.pace${key}Desc`)}</p>
                    <p className="mt-1 text-[10px] leading-snug text-white/35">{t('intro.paceNote')}</p>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              {/* A saved career never reaches this screen — the app resumes it
                  straight into the career view — so there is no resume button. */}
              <Button variant="primary" onClick={() => onStart(pace)}>
                {t('intro.start')}
              </Button>

              {/* Two doors, not one. The daily challenge is a game mode; the
                  three boards are how every career is scored, which is not a
                  footnote to a side mode and no longer reads as one. Both live
                  here because this is the last screen before a career starts,
                  and once one has, nothing should interrupt it. */}
              <button
                onClick={() => setSheet('daily')}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
                  done
                    ? 'border-white/8 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'
                    : 'border-lime-500/25 bg-lime-500/[0.07] hover:border-lime-500/50 hover:bg-lime-500/[0.12]'
                }`}
              >
                <DailyIcon size={18} active={!done} />
                <span className="min-w-0 flex-1">
                  <span className="display block truncate text-[12px] font-bold uppercase tracking-wide">
                    {t('intro.daily')}
                  </span>
                  <span className="block truncate text-[10px] leading-tight text-white/40">
                    {done ? t('intro.dailyDone') : t('intro.dailyToday')}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] text-white/25">›</span>
              </button>

              {/* What changed since they were last here — a dot rather than a
                  popup, because nothing on this screen should get in the way of
                  the button that starts a career. */}
              {!newsRead ? (
                <button
                  onClick={() => setSheet('news')}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-lime-500/25 bg-lime-500/[0.07] px-3 py-2 text-left transition-colors hover:border-lime-500/50 hover:bg-lime-500/[0.12]"
                >
                  <span className="grid h-[18px] w-[18px] shrink-0 place-items-center">
                    <span className="h-2 w-2 rounded-full bg-lime-400" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="display block truncate text-[12px] font-bold tracking-wide uppercase">
                      {t('intro.news')}
                    </span>
                    <span className="block truncate text-[10px] leading-tight text-white/40">
                      {t('intro.newsHint')}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] text-white/25">›</span>
                </button>
              ) : null}

              {/* How the game works, in six lines.
                  A player who has never seen a football-manager game has no
                  idea what a squad role is, why an offer is worth taking or
                  what the ability number does — and until now nothing on any
                  screen told them. This sheet is what makes a first career
                  legible. */}
              <button
                onClick={() => setSheet('howto')}
                className="flex w-full items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-white/20 hover:bg-white/[0.05]"
              >
                <HowToIcon size={18} />
                <span className="min-w-0 flex-1">
                  <span className="display block truncate text-[12px] font-bold uppercase tracking-wide">
                    {t('intro.howto')}
                  </span>
                  <span className="block truncate text-[10px] leading-tight text-white/40">
                    {t('intro.howtoHint')}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] text-white/25">›</span>
              </button>

              <button
                onClick={() => setSheet('boards')}
                className="flex w-full items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-white/20 hover:bg-white/[0.05]"
              >
                <RankingsIcon size={18} />
                <span className="min-w-0 flex-1">
                  <span className="display block truncate text-[12px] font-bold uppercase tracking-wide">
                    {t('intro.boards')}
                  </span>
                  <span className="block truncate text-[10px] leading-tight text-white/40">
                    {t('intro.boardsHint')}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] text-white/25">›</span>
              </button>
            </div>
          </div>
        }
      />

      <Sheet open={sheet === 'daily'} onClose={() => setSheet(null)} title={t('intro.daily')}>
        <Bullets items={[t('intro.daily_world'), t('intro.daily_pace'), t('intro.daily_you')]} />

        <div className="mt-4 space-y-2">
          <Button
            variant="primary"
            onClick={() => {
              markPlayedToday();
              setSheet(null);
              // Not `pace` — the daily is the same challenge for everyone or it
              // is not a challenge. See `DAILY_PACE`.
              onStart(DAILY_PACE, dailySeed());
            }}
          >
            {t('intro.dailyToday')}
          </Button>
          <Button variant="ghost" onClick={() => setSheet(null)}>
            {t('intro.boardsGot')}
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'news'}
        onClose={() => {
          markNewsSeen();
          setNewsRead(true);
          setSheet(null);
        }}
        title={t('intro.newsTitle')}
      >
        <ul className="space-y-2 text-[12.5px] leading-snug text-white/60">
          {(['fit', 'minutes', 'daily', 'offline'] as const).map((key) => (
            <li key={key} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-lime-500" />
              <span>{t(`intro.news_${key}`)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <Button
            variant="ghost"
            onClick={() => {
              markNewsSeen();
              setNewsRead(true);
              setSheet(null);
            }}
          >
            {t('intro.boardsGot')}
          </Button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'howto'} onClose={() => setSheet(null)} title={t('intro.howtoTitle')}>
        {/* Order matters: what you do, then what decides how it goes. */}
        <Bullets
          items={(['play', 'cards', 'seasons', 'odds', 'ability', 'tactics', 'ending'] as const).map((key) => (
            <>
              <strong className="text-chalk">{t(`intro.howto_${key}_title`)}</strong>{' '}
              {t(`intro.howto_${key}`)}
            </>
          ))}
        />

        <div className="mt-4">
          <Button variant="ghost" onClick={() => setSheet(null)}>
            {t('intro.boardsGot')}
          </Button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'boards'} onClose={() => setSheet(null)} title={t('intro.boardsTitle')}>
        <Bullets
          items={(['legacy', 'wealth', 'value'] as const).map((board) => (
            <>
              <strong className="text-chalk">{t(`summary.boards.${board}`)}</strong>{' '}
              {t(`intro.boards_${board}`)}
            </>
          ))}
        />
        <p className="mt-3 text-[11.5px] leading-snug text-white/40">{t('intro.boardsTension')}</p>

        <div className="mt-4">
          <Button variant="ghost" onClick={() => setSheet(null)}>
            {t('intro.boardsGot')}
          </Button>
        </div>
      </Sheet>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

/**
 * A short list, not a paragraph.
 *
 * The three explainer sheets each opened with a block of four or five
 * sentences, and a block of four or five sentences on a phone is a block
 * nobody finishes. One idea per line, the name of the thing in white, the rest
 * in grey — the same shape the "How to play" sheet already used and the only
 * one of the three anybody read.
 */
function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2.5 text-[12.5px] leading-snug text-white/60">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-lime-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
