/**
 * What language a footballer arrives speaking.
 *
 * Only one card needs this, and it needed it badly: "you still order coffee by
 * pointing" was dealt to an Englishman who had signed in the United States,
 * because the gate was `league.countryId !== player.countryId` and that is not
 * what a language barrier is. An Argentinian in Spain, a Brazilian in Portugal
 * and an Austrian in Germany are all in the same position — they moved abroad
 * and understood every word on the first morning.
 *
 * Countries not listed speak for themselves, so two unlisted countries are
 * always a barrier. That is the safe default: a wrong "you need lessons" is a
 * card that reads as nonsense, and a missing one is only a card not dealt.
 */
const LANGUAGE: Record<string, string> = {
  // English
  eng: 'en', sco: 'en', wal: 'en', nir: 'en', irl: 'en', usa: 'en', can: 'en',
  aus: 'en', nzl: 'en', jam: 'en', tri: 'en', rsa: 'en', gha: 'en', nga: 'en',
  ken: 'en', uga: 'en', zam: 'en', zim: 'en', sgp: 'en', ind: 'en', phi: 'en',
  mlt: 'en',
  // Spanish
  esp: 'es', arg: 'es', uru: 'es', col: 'es', chi: 'es', ecu: 'es', per: 'es',
  par: 'es', mex: 'es', ven: 'es', bol: 'es', crc: 'es', hon: 'es', slv: 'es',
  gua: 'es', pan: 'es', gnq: 'es',
  // Portuguese
  por: 'pt', bra: 'pt', ang: 'pt', moz: 'pt', cpv: 'pt', gnb: 'pt',
  // French
  fra: 'fr', civ: 'fr', sen: 'fr', mli: 'fr', bfa: 'fr', gab: 'fr', tog: 'fr',
  ben: 'fr', gui: 'fr', com: 'fr', mad: 'fr', hai: 'fr', ncl: 'fr', tah: 'fr',
  cod: 'fr', mtn: 'fr',
  // German
  ger: 'de', aut: 'de',
  // Arabic
  ksa: 'ar', qat: 'ar', uae: 'ar', irq: 'ar', egy: 'ar', mar: 'ar', alg: 'ar',
  tun: 'ar', lby: 'ar', jor: 'ar', omn: 'ar', bhr: 'ar', kuw: 'ar', syr: 'ar',
  lbn: 'ar', pse: 'ar', sdn: 'ar',
  // Dutch
  ned: 'nl', sur: 'nl', cuw: 'nl',
  // Serbo-Croatian
  srb: 'sh', cro: 'sh', bih: 'sh', mne: 'sh',
};

/** Would he need lessons to move from one to the other? */
export function sharesLanguage(a: string, b: string): boolean {
  return (LANGUAGE[a] ?? a) === (LANGUAGE[b] ?? b);
}
