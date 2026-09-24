import type { MarqueePlayer } from '@bg/engine';

/**
 * Marquee squad-mates.
 *
 * When a career starts in 2026 these are the players actually at each club, so
 * signing for a top side means lining up next to names you know. Everyone else
 * in a squad is generated from the nationality name pools.
 *
 * `age` is as of the 2026/27 season and the engine ages them forward, so they
 * decline and retire on their own over a twenty-year career — by 2040 the
 * squads have turned over entirely and are generated. That is intentional: it
 * keeps the opening grounded without pretending to predict a decade of
 * transfers, and it means this table only ever needs refreshing at the top.
 *
 * Fields are `[clubId, name, position, overall, age, countryId]`.
 */
type Row = [string, string, MarqueePlayer['position'], number, number, string];

const ROWS: Row[] = [
  // England
  ['man-city', 'Erling Haaland', 'ST', 93, 26, 'nor'],
  ['man-city', 'Rodri', 'CDM', 91, 30, 'esp'],
  ['man-city', 'Phil Foden', 'CAM', 88, 26, 'eng'],
  ['man-city', 'Elliot Anderson', 'CM', 85, 23, 'eng'],
  ['liverpool', 'Virgil van Dijk', 'CB', 88, 35, 'ned'],
  ['liverpool', 'Alexis Mac Allister', 'CM', 86, 27, 'arg'],
  ['liverpool', 'Florian Wirtz', 'CAM', 89, 23, 'ger'],
  ['liverpool', 'Alexander Isak', 'ST', 87, 27, 'swe'],
  ['arsenal', 'Bukayo Saka', 'RW', 89, 25, 'eng'],
  ['arsenal', 'Declan Rice', 'CDM', 88, 27, 'eng'],
  ['arsenal', 'William Saliba', 'CB', 87, 25, 'fra'],
  ['arsenal', 'Viktor Gyökeres', 'ST', 86, 28, 'swe'],
  ['man-utd', 'Bruno Fernandes', 'CAM', 87, 32, 'por'],
  ['man-utd', 'Benjamin Šeško', 'ST', 85, 23, 'slo'],
  ['chelsea', 'Cole Palmer', 'CAM', 87, 24, 'eng'],
  ['chelsea', 'Morgan Rogers', 'CAM', 86, 24, 'eng'],
  ['chelsea', 'Moisés Caicedo', 'CDM', 86, 25, 'ecu'],
  ['tottenham', 'Cristian Romero', 'CB', 86, 28, 'arg'],
  ['tottenham', 'Sandro Tonali', 'CDM', 87, 26, 'ita'],
  ['aston-villa', 'Ollie Watkins', 'ST', 84, 30, 'eng'],
  ['brighton', 'Kaoru Mitoma', 'LW', 83, 29, 'jpn'],
  ['sunderland', 'Granit Xhaka', 'CDM', 82, 33, 'sui'],

  // Spain
  ['real-madrid', 'Jude Bellingham', 'CAM', 91, 23, 'eng'],
  ['real-madrid', 'Kylian Mbappé', 'ST', 93, 27, 'fra'],
  ['real-madrid', 'Vinícius Júnior', 'LW', 90, 26, 'bra'],
  ['barcelona', 'Lamine Yamal', 'RW', 90, 19, 'esp'],
  ['barcelona', 'Pedri', 'CM', 89, 23, 'esp'],
  ['barcelona', 'Robert Lewandowski', 'ST', 84, 38, 'pol'],
  ['atletico', 'Julián Álvarez', 'ST', 87, 26, 'arg'],
  ['atletico', 'Antoine Griezmann', 'CAM', 85, 35, 'fra'],
  ['athletic', 'Nico Williams', 'LW', 86, 24, 'esp'],
  ['sociedad', 'Takefusa Kubo', 'RW', 84, 25, 'jpn'],

  // Italy
  ['inter', 'Lautaro Martínez', 'ST', 88, 29, 'arg'],
  ['inter', 'Nicolò Barella', 'CM', 87, 29, 'ita'],
  ['juventus', 'Kenan Yıldız', 'CAM', 84, 21, 'tur'],
  ['ac-milan', 'Rafael Leão', 'LW', 86, 27, 'por'],
  ['ac-milan', 'Christian Pulisic', 'RW', 84, 28, 'usa'],
  ['napoli', 'Scott McTominay', 'CM', 84, 30, 'sco'],
  ['atalanta', 'Ademola Lookman', 'LW', 85, 29, 'nga'],
  ['roma', 'Paulo Dybala', 'CAM', 84, 33, 'arg'],

  // Germany
  ['bayern', 'Harry Kane', 'ST', 90, 33, 'eng'],
  ['bayern', 'Jamal Musiala', 'CAM', 89, 23, 'ger'],
  ['bayern', 'Michael Olise', 'RW', 86, 25, 'fra'],
  ['dortmund', 'Serhou Guirassy', 'ST', 85, 30, 'gui'],
  ['leverkusen', 'Alejandro Grimaldo', 'LB', 85, 30, 'esp'],
  ['leipzig', 'Johan Bakayoko', 'RW', 82, 23, 'bel'],
  ['stuttgart', 'Angelo Stiller', 'CM', 83, 25, 'ger'],

  // France
  ['psg', 'Ousmane Dembélé', 'RW', 88, 29, 'fra'],
  ['psg', 'Vitinha', 'CM', 87, 26, 'por'],
  ['psg', 'João Neves', 'CDM', 86, 22, 'por'],
  ['monaco', 'Maghnes Akliouche', 'CAM', 83, 24, 'fra'],
  ['marseille', 'Mason Greenwood', 'RW', 83, 25, 'eng'],

  // Portugal / Netherlands / Türkiye / Scotland
  ['sporting', 'Morten Hjulmand', 'CDM', 83, 27, 'den'],
  ['benfica', 'Vangelis Pavlidis', 'ST', 82, 27, 'gre'],
  ['psv', 'Joey Veerman', 'CM', 82, 27, 'ned'],

  // Saudi Arabia — the money, made concrete.
  ['al-nassr', 'Cristiano Ronaldo', 'ST', 84, 41, 'por'],
  ['al-nassr', 'Sadio Mané', 'LW', 82, 34, 'sen'],
  ['al-hilal', 'Rúben Neves', 'CDM', 83, 29, 'por'],
  ['al-hilal', 'Darwin Núñez', 'ST', 84, 27, 'uru'],
  ['al-hilal', 'Karim Benzema', 'ST', 82, 38, 'fra'],
  ['al-ittihad', "N'Golo Kanté", 'CDM', 82, 35, 'fra'],
  ['al-ahli-s', 'Riyad Mahrez', 'RW', 82, 35, 'alg'],

  // USA / Japan / Korea / China
  ['inter-miami', 'Lionel Messi', 'CAM', 86, 39, 'arg'],
  ['inter-miami', 'Luis Suárez', 'ST', 78, 39, 'uru'],
  ['lafc', 'Son Heung-min', 'LW', 84, 34, 'kor'],
  ['marinos', 'Kota Watanabe', 'CB', 76, 27, 'jpn'],
  ['shanghai-p', 'Wu Lei', 'ST', 74, 35, 'chn'],
  ['beijing-g', 'Zhang Yuning', 'ST', 72, 29, 'chn'],
];

export const MARQUEE_PLAYERS: readonly MarqueePlayer[] = ROWS.map(
  ([clubId, name, position, overall, age, countryId]) => ({
    clubId,
    name,
    position,
    overall,
    age,
    countryId,
  }),
);
