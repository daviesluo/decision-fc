import { useState } from 'react';
import { LOCALES, type Locale } from '@bg/content';
import { PRIVACY_URL } from '../lib/assets';
import { useI18n } from '../lib/i18n';
import { CURRENCIES, CURRENCY_SYMBOLS, useSettings } from '../lib/settings';
import { Button, SectionLabel, Sheet } from './ui';

/**
 * The link to the privacy policy, in both sheets that carry one.
 *
 * Off the site — the itch.io build — `PRIVACY_URL` is an absolute link to
 * decisionfc.com, and that build runs inside itch's iframe, where following it
 * in place would replace the game with a policy page and no way back. So an
 * off-site link opens a tab; the site's own relative link behaves as it always
 * has.
 */
function PrivacyLink() {
  const { t } = useI18n();
  const away = PRIVACY_URL.startsWith('http');
  return (
    <a
      href={PRIVACY_URL}
      {...(away ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="mt-4 inline-block text-[12px] font-semibold text-lime-400/80 underline underline-offset-2"
    >
      {t('settings.privacy')}
    </a>
  );
}

/** Which reference sheet is open on top of settings, if any. */
type Help = 'handbook' | 'about' | 'faq' | null;

/* The handbook and About are titled sections; the FAQ is question/answer.
   Held as id lists so the copy lives entirely in the dictionaries and this
   file never has a sentence to translate. */
const HANDBOOK = ['chase', 'ability', 'minutes', 'loan', 'offers', 'tactics', 'reading', 'legacy', 'value', 'wealth'] as const;
const ABOUT = ['what', 'how', 'world', 'free', 'made'] as const;
const FAQ = ['free', 'account', 'length', 'save', 'daily', 'offers', 'currency', 'leaderboard', 'feedback'] as const;

/**
 * Settings.
 *
 * Reachable from the title screen and from the player card mid-career, because
 * currency is exactly the sort of thing a player realises they want changed the
 * moment a wage figure appears, not before starting.
 */
export function SettingsSheet({
  open,
  onClose,
  onQuit,
}: {
  open: boolean;
  onClose: () => void;
  /**
   * Walk away from the career in progress. Only passed mid-career — on the
   * title screen there is nothing to abandon.
   */
  onQuit?: () => void;
}) {
  const { t, locale, setLocale } = useI18n();
  const settings = useSettings();
  const [confirming, setConfirming] = useState(false);
  const [help, setHelp] = useState<Help>(null);

  return (
    <>
    <Sheet open={open} onClose={onClose} title={t('settings.title')}>
      <SectionLabel>{t('settings.currency')}</SectionLabel>
      <div role="radiogroup" aria-label={t('settings.currency')} className="grid grid-cols-4 gap-2">
        {CURRENCIES.map((code) => (
          <Choice
            key={code}
            active={settings.currency === code}
            onClick={() => settings.set('currency', code)}
          >
            <span className="num text-[17px]">{CURRENCY_SYMBOLS[code]}</span>
            <span className="mt-0.5 text-[10px] text-white/45">{code}</span>
          </Choice>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-white/35">{t('settings.currencyHint')}</p>

      <div className="mt-5">
        <SectionLabel>{t('settings.language')}</SectionLabel>
        <div role="radiogroup" aria-label={t('settings.language')} className="grid grid-cols-2 gap-2">
          {LOCALES.map((code: Locale) => (
            <Choice key={code} active={locale === code} onClick={() => setLocale(code)}>
              <span className="text-[14px] font-bold">{code === 'en' ? 'English' : '简体中文'}</span>
            </Choice>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <SectionLabel>{t('settings.display')}</SectionLabel>
        <Toggle
          label={t('settings.showOdds')}
          hint={t('settings.showOddsHint')}
          value={settings.showOdds}
          onChange={(v) => settings.set('showOdds', v)}
        />
        <Toggle
          label={t('settings.reducedMotion')}
          hint={t('settings.reducedMotionHint')}
          value={settings.reducedMotion}
          onChange={(v) => settings.set('reducedMotion', v)}
        />

      </div>

      {/* Guide & info. Three doors to the reference material — a strategy
          handbook, what the game is, and the practical questions — kept out of
          the way of the controls above but always one tap from them. The
          title-screen "How to play" teaches the rules; none of these repeats
          it. */}
      <div className="mt-5">
        <SectionLabel>{t('settings.help')}</SectionLabel>
        <div className="space-y-2">
          <HelpRow title={t('settings.handbook')} hint={t('settings.handbookHint')} onClick={() => setHelp('handbook')} />
          <HelpRow title={t('settings.about')} hint={t('settings.aboutHint')} onClick={() => setHelp('about')} />
          <HelpRow title={t('settings.faq')} hint={t('settings.faqHint')} onClick={() => setHelp('faq')} />
        </div>
      </div>

      {/* Abandoning a career is destructive and unrecoverable, so it asks once
          rather than sitting one mis-tap away from twenty seasons of play. */}
      {onQuit ? (
        <div className="mt-5 border-t border-white/10 pt-4">
          {confirming ? (
            <>
              <p className="mb-2 text-[12px] leading-snug text-white/55">{t('settings.quitHint')}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  {t('settings.quitCancel')}
                </Button>
                <Button size="sm" className="bg-loss text-white" onClick={onQuit}>
                  {t('settings.quitConfirm')}
                </Button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="w-full rounded-xl border border-loss/30 bg-loss/[0.08] py-3 text-[13px] font-semibold text-loss"
            >
              {t('settings.quit')}
            </button>
          )}
        </div>
      ) : null}
    </Sheet>

    {/* The strategy handbook. Long-form, so it scrolls inside its own sheet —
        the one place in the game where scrolling is the point. */}
    <Sheet open={help === 'handbook'} onClose={() => setHelp(null)} title={t('settings.handbookTitle')}>
      <p className="mb-4 text-[12.5px] leading-relaxed text-white/50">{t('settings.handbookLede')}</p>
      <div className="space-y-3.5">
        {HANDBOOK.map((id) => (
          <Article key={id} title={t(`settings.hb_${id}_title`)} body={t(`settings.hb_${id}`)} />
        ))}
      </div>
      <div className="mt-5">
        <Button variant="ghost" onClick={() => setHelp(null)}>
          {t('intro.boardsGot')}
        </Button>
      </div>
    </Sheet>

    <Sheet open={help === 'about'} onClose={() => setHelp(null)} title={t('settings.aboutTitle')}>
      <p className="mb-4 text-[12.5px] leading-relaxed text-white/50">{t('settings.aboutLede')}</p>
      <div className="space-y-3.5">
        {ABOUT.map((id) => (
          <Article key={id} title={t(`settings.ab_${id}_title`)} body={t(`settings.ab_${id}`)} />
        ))}
      </div>
      <PrivacyLink />
      <div className="mt-4">
        <Button variant="ghost" onClick={() => setHelp(null)}>
          {t('intro.boardsGot')}
        </Button>
      </div>
    </Sheet>

    <Sheet open={help === 'faq'} onClose={() => setHelp(null)} title={t('settings.faqTitle')}>
      <div className="space-y-3.5">
        {FAQ.map((id) => (
          <Article key={id} title={t(`settings.faq_${id}_q`)} body={t(`settings.faq_${id}_a`)} />
        ))}
      </div>
      <PrivacyLink />
      <div className="mt-4">
        <Button variant="ghost" onClick={() => setHelp(null)}>
          {t('intro.boardsGot')}
        </Button>
      </div>
    </Sheet>
    </>
  );
}

/** One row in the guide list: a title, a one-line hint, and a chevron. */
function HelpRow({ title, hint, onClick }: { title: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-white/20 hover:bg-white/[0.05]"
    >
      <span className="min-w-0 flex-1">
        <span className="display block truncate text-[12px] font-bold uppercase tracking-wide">{title}</span>
        <span className="block truncate text-[10px] leading-tight text-white/40">{hint}</span>
      </span>
      <span className="shrink-0 text-[13px] text-white/25">›</span>
    </button>
  );
}

/**
 * A heading over a paragraph.
 *
 * The handbook and About are titled sections; the FAQ is a question over its
 * answer — the same shape, so it renders through the same component and the
 * question just reads as the heading.
 */
function Article({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h3 className="display text-[12.5px] font-bold uppercase tracking-wide text-lime-400/90">{title}</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-white/60">{body}</p>
    </section>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      // A row of buttons where one is "on" is a radio group. Without this a
      // screen reader reads four identical currency buttons and gives no way to
      // tell which one is selected — the highlight is colour only.
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex h-[52px] flex-col items-center justify-center rounded-xl border transition-colors ${
        active ? 'border-lime-500 bg-lime-500/[0.14] text-lime-400' : 'border-white/10 bg-white/[0.03] text-white/65'
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      // It looks like a switch and behaves like one, so it should announce
      // itself as one. As a plain button a screen reader said "Show odds,
      // button" and gave no way at all to know whether it was on.
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="flex w-full items-center gap-3 py-2.5 text-left"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold">{label}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-white/40">{hint}</div>
      </div>
      <span
        className={`relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors ${
          value ? 'bg-lime-500' : 'bg-white/15'
        }`}
      >
        <span
          className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white transition-all ${
            value ? 'left-[23px]' : 'left-[3px]'
          }`}
        />
      </span>
    </button>
  );
}
