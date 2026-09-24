import type { Outlet } from '@bg/engine';

/**
 * The press.
 *
 * Real outlets, because the media ecosystem is a huge part of what makes a
 * football career feel like a football career — the difference between "you
 * were sold" and "The Athletic says your camp forced the move" is most of the
 * texture. Coverage is weighted by where the player is: a season in the
 * Bundesliga gets Kicker and Bild, a season in the Saudi Pro League largely
 * gets ignored by everyone except the wire services, and that silence is part
 * of the trap.
 *
 * Everything these outlets "report" is about a player who does not exist, and
 * the copy is generated from what happened in the simulation.
 */
export const OUTLETS: readonly Outlet[] = [
  // ---- Global ------------------------------------------------------------
  { id: 'athletic',   name: { en: 'The Athletic',  zh: 'The Athletic' }, countryId: null, kind: 'digital',   reach: 88 },
  { id: 'espn',       name: { en: 'ESPN FC',       zh: 'ESPN FC' },      countryId: null, kind: 'broadcast', reach: 82 },
  { id: 'guardian',   name: { en: 'The Guardian',  zh: '卫报' },          countryId: null, kind: 'broadsheet',reach: 76 },
  { id: 'transfer_insider', name: { en: 'Fabrizio Romano', zh: '罗马诺' }, countryId: null, kind: 'insider', reach: 94 },

  // ---- England -----------------------------------------------------------
  { id: 'bbc',        name: { en: 'BBC Sport',     zh: 'BBC 体育' },      countryId: 'eng', kind: 'broadcast', reach: 84 },
  { id: 'sky',        name: { en: 'Sky Sports',    zh: '天空体育' },       countryId: 'eng', kind: 'broadcast', reach: 86 },
  { id: 'telegraph',  name: { en: 'The Telegraph', zh: '每日电讯报' },     countryId: 'eng', kind: 'broadsheet',reach: 68 },
  { id: 'sun',        name: { en: 'The Sun',       zh: '太阳报' },        countryId: 'eng', kind: 'tabloid',   reach: 74 },

  // ---- Spain -------------------------------------------------------------
  { id: 'marca',      name: { en: 'Marca',         zh: '马卡报' },        countryId: 'esp', kind: 'tabloid',   reach: 82 },
  { id: 'as',         name: { en: 'AS',            zh: '阿斯报' },        countryId: 'esp', kind: 'tabloid',   reach: 78 },
  { id: 'mundo',      name: { en: 'Mundo Deportivo', zh: '世界体育报' },  countryId: 'esp', kind: 'tabloid',   reach: 70 },

  // ---- Italy -------------------------------------------------------------
  { id: 'gazzetta',   name: { en: 'La Gazzetta dello Sport', zh: '米兰体育报' }, countryId: 'ita', kind: 'broadsheet', reach: 80 },
  { id: 'corriere',   name: { en: 'Corriere dello Sport',    zh: '体育信使报' }, countryId: 'ita', kind: 'broadsheet', reach: 70 },

  // ---- Germany -----------------------------------------------------------
  { id: 'kicker',     name: { en: 'Kicker',        zh: '踢球者' },        countryId: 'ger', kind: 'broadsheet',reach: 76 },
  { id: 'bild',       name: { en: 'Bild',          zh: '图片报' },        countryId: 'ger', kind: 'tabloid',   reach: 80 },

  // ---- France ------------------------------------------------------------
  { id: 'lequipe',    name: { en: "L'Équipe",      zh: '队报' },          countryId: 'fra', kind: 'broadsheet',reach: 80 },
  { id: 'rmc',        name: { en: 'RMC Sport',     zh: 'RMC 体育' },      countryId: 'fra', kind: 'broadcast', reach: 66 },

  // ---- Portugal / Netherlands / Türkiye ----------------------------------
  { id: 'record_pt',  name: { en: 'Record',        zh: '纪录报' },        countryId: 'por', kind: 'tabloid',   reach: 62 },
  { id: 'telegraaf',  name: { en: 'De Telegraaf',  zh: '电讯报' },        countryId: 'ned', kind: 'tabloid',   reach: 58 },
  { id: 'fanatik',    name: { en: 'Fanatik',       zh: 'Fanatik' },       countryId: 'tur', kind: 'tabloid',   reach: 56 },

  // ---- China -------------------------------------------------------------
  { id: 'dongqiudi',  name: { en: 'Dongqiudi',     zh: '懂球帝' },        countryId: 'chn', kind: 'digital',   reach: 72 },
  { id: 'hupu',       name: { en: 'Hupu',          zh: '虎扑' },          countryId: 'chn', kind: 'digital',   reach: 70 },
  { id: 'titan',      name: { en: 'Titan Sports',  zh: '体坛周报' },      countryId: 'chn', kind: 'broadsheet',reach: 64 },

  // ---- Rest of Asia / Americas -------------------------------------------
  { id: 'nikkan',     name: { en: 'Nikkan Sports', zh: '日刊体育' },      countryId: 'jpn', kind: 'broadsheet',reach: 58 },
  { id: 'sportsseoul',name: { en: 'Sports Seoul',  zh: '首尔体育' },      countryId: 'kor', kind: 'broadsheet',reach: 54 },
  { id: 'arriyadiyah',name: { en: 'Arriyadiyah',   zh: 'Arriyadiyah' },   countryId: 'ksa', kind: 'broadsheet',reach: 50 },
  { id: 'mlssoccer',  name: { en: 'MLSsoccer.com', zh: 'MLSsoccer' },     countryId: 'usa', kind: 'digital',   reach: 48 },
];
