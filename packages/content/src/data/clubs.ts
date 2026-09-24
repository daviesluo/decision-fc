import type { Club, ManagerStyle } from '@bg/engine';

/**
 * Club database.
 *
 * Scoped to the leagues in `leagues.ts`. The second divisions are deliberately
 * deep — twelve English, eight each elsewhere — because that is where the youth
 * game happens: academy intakes, loan destinations and the first real contract.
 * A thin second tier made every young career look the same.
 *
 * Names are plain text. A club's crest is its image at
 * `apps/web/public/crests/<id>.png` when there is one, and otherwise a badge
 * the renderer generates from `colors` and the club's identity
 * (see `docs/crests.md`).
 *
 * Columns: id, league, name, short, reputation, wealth, training, style, colours
 */
type Row = [string, string, string, string, number, number, number, ManagerStyle, string, string];

const ROWS: Row[] = [
  // ======================================================= ENGLAND — Premier
  ['man-city',   'eng.1', 'Manchester City',      'Man City',   93, 99, 96, 'possession',  '#6CABDD', '#1C2C5B'],
  ['liverpool',  'eng.1', 'Liverpool',            'Liverpool',  87, 92, 93, 'gegenpress',  '#C8102E', '#00B2A9'],
  ['arsenal',    'eng.1', 'Arsenal',              'Arsenal',    95, 90, 91, 'possession',  '#EF0107', '#FFFFFF'],
  ['man-utd',    'eng.1', 'Manchester United',    'Man Utd',    88, 96, 86, 'possession',     '#DA020E', '#FBE122'],
  ['chelsea',    'eng.1', 'Chelsea',              'Chelsea',    85, 97, 88, 'possession',  '#034694', '#FFFFFF'],
  ['tottenham',  'eng.1', 'Tottenham Hotspur',    'Spurs',      80, 84, 85, 'possession',  '#132257', '#FFFFFF'],
  ['newcastle',  'eng.1', 'Newcastle United',     'Newcastle',  76, 91, 80, 'gegenpress',     '#241F20', '#FFFFFF'],
  ['aston-villa','eng.1', 'Aston Villa',          'Villa',      84, 76, 79, 'possession',  '#95BFE5', '#670E36'],
  ['brighton',   'eng.1', 'Brighton',             'Brighton',   74, 68, 84, 'possession',  '#0057B8', '#FFFFFF'],
  ['west-ham',   'eng.2', 'West Ham United',      'West Ham',   56, 56, 70, 'counter',   '#7A263A', '#1BB1E7'],
  ['crystal-p',  'eng.1', 'Crystal Palace',       'Palace',     64, 62, 74, 'gegenpress',     '#1B458F', '#C4122E'],
  ['everton',    'eng.1', 'Everton',              'Everton',    65, 60, 70, 'counter',   '#003399', '#FFFFFF'],
  ['fulham',     'eng.1', 'Fulham',               'Fulham',     66, 63, 71, 'possession',  '#FFFFFF', '#000000'],
  ['brentford',  'eng.1', 'Brentford',            'Brentford',  68, 58, 76, 'counter',   '#E30613', '#FFFFFF'],
  ['wolves',     'eng.2', 'Wolverhampton',        'Wolves',     52, 52, 66, 'gegenpress',     '#FDB913', '#231F20'],
  ['forest',     'eng.1', 'Nottingham Forest',    'Forest',     62, 62, 66, 'counter',     '#DD0000', '#FFFFFF'],
  ['bournemouth','eng.1', 'Bournemouth',          'Bournemouth',72, 58, 72, 'gegenpress',  '#DA291C', '#000000'],
  ['leeds',      'eng.1', 'Leeds United',         'Leeds',      63, 58, 68, 'possession',  '#FFCD00', '#1D428A'],
  ['ipswich',    'eng.1', 'Ipswich Town',         'Ipswich',    55, 54, 64, 'counter',  '#3764AE', '#FFFFFF'],

  // ================================================== ENGLAND — Championship
  ['southampton','eng.2', 'Southampton',          'Saints',     55, 50, 72, 'gegenpress',  '#D71920', '#130C0E'],
  ['middlesbro', 'eng.2', 'Middlesbrough',        'Boro',       54, 46, 66, 'gegenpress',     '#E21C38', '#FFFFFF'],
  ['sunderland', 'eng.1', 'Sunderland',           'Sunderland', 70, 48, 70, 'counter',  '#EB172B', '#FFFFFF'],
  ['stoke',      'eng.2', 'Stoke City',           'Stoke',      44, 44, 64, 'possession',   '#E03A3E', '#FFFFFF'],
  ['norwich',    'eng.2', 'Norwich City',         'Norwich',    47, 42, 68, 'possession',  '#FFF200', '#00A650'],
  ['blackburn',  'eng.2', 'Blackburn Rovers',     'Blackburn',  41, 38, 64, 'possession',     '#009EE0', '#FFFFFF'],
  ['coventry',   'eng.1', 'Coventry City',        'Coventry',   56, 48, 64, 'possession',   '#78D0F3', '#FFFFFF'],
  ['preston',    'eng.2', 'Preston North End',    'Preston',    43, 34, 58, 'counter',   '#FFFFFF', '#00307C'],
  ['hull',       'eng.1', 'Hull City',            'Hull',       50, 46, 60, 'counter',   '#F5A12D', '#000000'],
  ['millwall',   'eng.2', 'Millwall',             'Millwall',   50, 32, 55, 'low_block',   '#001D5E', '#FFFFFF'],
  ['sheff-utd',  'eng.2', 'Sheffield United',     'Sheff Utd',  46, 42, 64, 'wing_play',     '#EE2737', '#FFFFFF'],
  ['west-brom',  'eng.2', 'West Bromwich Albion', 'West Brom',  43, 40, 62, 'low_block',   '#122F67', '#FFFFFF'],
  ['wrexham',    'eng.2', 'Wrexham',              'Wrexham',    48, 48, 58, 'wing_play',     '#D2010D', '#FFFFFF'],

  // ========================================================== SPAIN — LaLiga
  ['real-madrid','esp.1', 'Real Madrid',          'Real Madrid',94, 98, 92, 'counter',     '#FFFFFF', '#FEBE10'],
  ['barcelona',  'esp.1', 'Barcelona',            'Barcelona',  96, 84, 96, 'gegenpress',  '#A50044', '#004D98'],
  ['atletico',   'esp.1', 'Atlético Madrid',      'Atlético',   86, 82, 86, 'low_block',   '#CB3524', '#FFFFFF'],
  ['sociedad',   'esp.1', 'Real Sociedad',        'Sociedad',   68, 66, 88, 'possession',  '#0067B1', '#FFFFFF'],
  ['villarreal', 'esp.1', 'Villarreal',           'Villarreal', 80, 66, 82, 'gegenpress',  '#FFE667', '#005187'],
  ['athletic',   'esp.1', 'Athletic Club',        'Athletic',   72, 68, 86, 'gegenpress',  '#EE2523', '#FFFFFF'],
  ['betis',      'esp.1', 'Real Betis',           'Betis',      76, 64, 76, 'possession',  '#00954C', '#FFFFFF'],
  ['sevilla',    'esp.1', 'Sevilla',              'Sevilla',    64, 62, 78, 'low_block',     '#F43333', '#FFFFFF'],
  ['valencia',   'esp.1', 'Valencia',             'Valencia',   66, 52, 80, 'gegenpress',   '#FFFFFF', '#F18E00'],
  ['girona',     'esp.2', 'Girona',               'Girona',     52, 44, 70, 'possession',  '#CD2534', '#FFFFFF'],
  ['celta',      'esp.1', 'Celta Vigo',           'Celta',      70, 48, 72, 'possession',  '#8AC3EE', '#FFFFFF'],
  ['osasuna',    'esp.1', 'Osasuna',              'Osasuna',    54, 44, 68, 'low_block',   '#0A346F', '#D91A21'],
  ['mallorca',   'esp.2', 'Mallorca',             'Mallorca',   48, 38, 64, 'low_block',   '#E20E17', '#000000'],
  ['getafe',     'esp.1', 'Getafe',               'Getafe',     62, 40, 62, 'low_block',   '#005999', '#FFFFFF'],
  ['espanyol',   'esp.1', 'Espanyol',             'Espanyol',   59, 46, 68, 'counter',     '#007FC8', '#FFFFFF'],
  ['rayo',       'esp.1', 'Rayo Vallecano',       'Rayo',       60, 40, 66, 'counter',  '#FFFFFF', '#E53027'],
  ['alaves',     'esp.1', 'Deportivo Alavés',     'Alavés',     52, 38, 64, 'low_block',   '#0761AF', '#FFFFFF'],
  ['elche',      'esp.1', 'Elche',                'Elche',      49, 36, 62, 'possession',   '#FFFFFF', '#00834B'],

  // ======================================================== SPAIN — Segunda
  ['deportivo',  'esp.1', 'Deportivo La Coruña',  'Deportivo',  50, 42, 70, 'wing_play',  '#0067B1', '#FFFFFF'],
  ['malaga',     'esp.1', 'Málaga',               'Málaga',     46, 40, 66, 'possession',   '#00A3E0', '#FFFFFF'],
  ['sporting-g', 'esp.2', 'Sporting Gijón',       'Sporting',   41, 30, 66, 'wing_play',   '#E4002B', '#FFFFFF'],
  ['levante',    'esp.1', 'Levante',              'Levante',    48, 30, 62, 'possession',  '#005CA9', '#B4141B'],
  ['racing',     'esp.1', 'Racing Santander',     'Racing',     47, 38, 62, 'wing_play',     '#FFFFFF', '#009B48'],
  ['eibar',      'esp.2', 'Eibar',                'Eibar',      37, 26, 64, 'gegenpress',  '#0A346F', '#E4002B'],
  ['las-palmas', 'esp.2', 'Las Palmas',           'Las Palmas', 46, 34, 66, 'possession',  '#FFDD00', '#004B9B'],
  ['leganes',    'esp.2', 'Leganés',              'Leganés',    44, 32, 62, 'low_block',   '#003DA5', '#FFFFFF'],
  ['valladolid', 'esp.2', 'Real Valladolid',      'Valladolid', 42, 32, 64, 'possession',  '#5A2149', '#FFFFFF'],
  ['cadiz',      'esp.2', 'Cádiz',                'Cádiz',      40, 30, 60, 'low_block',   '#FFE500', '#005CA9'],

  // ========================================================= ITALY — Serie A
  ['inter',      'ita.1', 'Inter',                'Inter',      93, 86, 88, 'wing_play',     '#0068A8', '#000000'],
  ['juventus',   'ita.1', 'Juventus',             'Juventus',   83, 88, 87, 'possession',   '#000000', '#FFFFFF'],
  ['ac-milan',   'ita.1', 'AC Milan',             'Milan',      85, 84, 86, 'possession',  '#FB090B', '#000000'],
  ['napoli',     'ita.1', 'Napoli',               'Napoli',     88, 78, 84, 'low_block',  '#12A0D7', '#FFFFFF'],
  ['atalanta',   'ita.1', 'Atalanta',             'Atalanta',   78, 70, 90, 'possession',  '#1D1D1B', '#005CA9'],
  ['roma',       'ita.1', 'Roma',                 'Roma',       84, 72, 78, 'gegenpress',     '#8E1F2F', '#F0BC42'],
  ['lazio',      'ita.1', 'Lazio',                'Lazio',      74, 66, 76, 'gegenpress',  '#87D8F7', '#FFFFFF'],
  ['fiorentina', 'ita.1', 'Fiorentina',           'Fiorentina', 66, 62, 78, 'possession',  '#592C82', '#FFFFFF'],
  ['bologna',    'ita.1', 'Bologna',              'Bologna',    72, 56, 80, 'gegenpress',  '#1A2F48', '#9F1B32'],
  ['torino',     'ita.1', 'Torino',               'Torino',     60, 50, 72, 'gegenpress',   '#881600', '#FFFFFF'],
  ['udinese',    'ita.1', 'Udinese',              'Udinese',    62, 48, 74, 'counter',     '#000000', '#9BA0A5'],
  ['genoa',      'ita.1', 'Genoa',                'Genoa',      53, 42, 66, 'possession',   '#B3122C', '#00265D'],
  ['como',       'ita.1', 'Como',                 'Como',       76, 58, 70, 'possession',  '#005EB8', '#FFFFFF'],
  ['parma',      'ita.1', 'Parma',                'Parma',      55, 44, 68, 'possession',     '#FFE500', '#004C97'],
  ['cagliari',   'ita.1', 'Cagliari',             'Cagliari',   54, 40, 64, 'low_block',   '#AD002A', '#00205B'],
  ['sassuolo',   'ita.1', 'Sassuolo',             'Sassuolo',   56, 40, 68, 'possession',  '#00A752', '#000000'],
  ['lecce',      'ita.1', 'Lecce',                'Lecce',      52, 36, 62, 'gegenpress',     '#FFF200', '#E31E24'],
  ['monza',      'ita.1', 'Monza',                'Monza',      48, 42, 64, 'gegenpress',  '#E20613', '#FFFFFF'],
  ['venezia',    'ita.1', 'Venezia',              'Venezia',    47, 38, 62, 'possession',   '#0B4B3C', '#FF7F27'],
  ['frosinone',  'ita.1', 'Frosinone',            'Frosinone',  44, 32, 60, 'gegenpress',   '#FFE500', '#005CA9'],
  ['verona',     'ita.2', 'Hellas Verona',        'Verona',     46, 32, 60, 'low_block',   '#FFE500', '#003B7B'],

  // ========================================================= ITALY — Serie B
  ['sampdoria',  'ita.2', 'Sampdoria',            'Sampdoria',  44, 32, 64, 'possession',  '#1B5AA4', '#FFFFFF'],
  ['palermo',    'ita.2', 'Palermo',              'Palermo',    42, 38, 62, 'wing_play',   '#F19FC0', '#000000'],
  ['cremonese',  'ita.2', 'Cremonese',            'Cremonese',  37, 26, 58, 'low_block',   '#B4141B', '#808080'],
  ['catanzaro',  'ita.2', 'Catanzaro',            'Catanzaro',  35, 24, 56, 'counter',     '#FFE500', '#B4141B'],
  ['modena',     'ita.2', 'Modena',               'Modena',     34, 24, 56, 'possession',  '#FFE500', '#005CA9'],
  ['pisa',       'ita.2', 'Pisa',                 'Pisa',       41, 30, 60, 'low_block',   '#00205B', '#000000'],
  ['empoli',     'ita.2', 'Empoli',               'Empoli',     40, 28, 66, 'possession',  '#005CA9', '#FFFFFF'],

  // ==================================================== GERMANY — Bundesliga
  ['bayern',     'ger.1', 'Bayern München',       'Bayern',     96, 95, 94, 'possession',  '#DC052D', '#FFFFFF'],
  ['leverkusen', 'ger.1', 'Bayer Leverkusen',     'Leverkusen', 80, 80, 90, 'possession',  '#E32221', '#000000'],
  ['dortmund',   'ger.1', 'Borussia Dortmund',    'Dortmund',   86, 82, 92, 'counter',  '#FDE100', '#000000'],
  ['leipzig',    'ger.1', 'RB Leipzig',           'Leipzig',    82, 84, 91, 'gegenpress',  '#DD0741', '#FFFFFF'],
  ['stuttgart',  'ger.1', 'VfB Stuttgart',        'Stuttgart',  78, 64, 82, 'possession',   '#FFFFFF', '#E32219'],
  ['frankfurt',  'ger.1', 'Eintracht Frankfurt',  'Frankfurt',  72, 66, 80, 'gegenpress',     '#E1000F', '#000000'],
  ['gladbach',   'ger.1', 'Borussia M’gladbach',  'Gladbach',   62, 56, 78, 'counter',  '#FFFFFF', '#00A13A'],
  ['wolfsburg',  'ger.2', 'VfL Wolfsburg',        'Wolfsburg',  56, 60, 74, 'counter',     '#65B32E', '#FFFFFF'],
  ['freiburg',   'ger.1', 'SC Freiburg',          'Freiburg',   67, 50, 84, 'counter',   '#000000', '#E2001A'],
  ['bremen',     'ger.1', 'Werder Bremen',        'Bremen',     53, 48, 74, 'counter',  '#1D9053', '#FFFFFF'],
  ['hoffenheim', 'ger.1', 'TSG Hoffenheim',       'Hoffenheim', 68, 56, 78, 'gegenpress',  '#1961B5', '#FFFFFF'],
  ['mainz',      'ger.1', 'Mainz 05',             'Mainz',      57, 42, 72, 'low_block',  '#C3141E', '#FFFFFF'],
  ['augsburg',   'ger.1', 'FC Augsburg',          'Augsburg',   58, 42, 68, 'counter',   '#BA3733', '#46714D'],
  ['koeln',      'ger.1', '1. FC Köln',           'Köln',       54, 50, 72, 'gegenpress',   '#ED1C24', '#FFFFFF'],
  ['union-b',    'ger.1', 'Union Berlin',         'Union',      56, 44, 68, 'low_block',   '#EB1923', '#FFD500'],
  ['elversberg', 'ger.1', 'SV Elversberg',        'Elversberg', 42, 26, 64, 'possession',     '#005CA9', '#FFFFFF'],
  ['st-pauli',   'ger.2', 'FC St. Pauli',         'St. Pauli',  46, 32, 68, 'gegenpress',  '#68452B', '#FFFFFF'],

  // =================================================== GERMANY — 2.Bundesliga
  ['hsv',        'ger.1', 'Hamburger SV',         'HSV',        55, 52, 72, 'possession',  '#FFFFFF', '#0A66B7'],
  ['schalke',    'ger.1', 'Schalke 04',           'Schalke',    52, 48, 72, 'gegenpress',     '#004D9D', '#FFFFFF'],
  ['hertha',     'ger.2', 'Hertha BSC',           'Hertha',     45, 40, 68, 'possession',  '#005CA9', '#FFFFFF'],
  ['hannover',   'ger.2', 'Hannover 96',          'Hannover',   41, 32, 64, 'counter',     '#00953E', '#000000'],
  ['nuernberg',  'ger.2', '1. FC Nürnberg',       'Nürnberg',   38, 30, 64, 'wing_play',   '#8B0000', '#FFFFFF'],
  ['karlsruher', 'ger.2', 'Karlsruher SC',        'Karlsruhe',  35, 24, 60, 'low_block',   '#FFFFFF', '#005CA9'],
  ['lautern',    'ger.2', '1. FC Kaiserslautern', 'Lautern',    42, 32, 62, 'counter',     '#E30613', '#FFFFFF'],
  ['bochum',     'ger.2', 'VfL Bochum',           'Bochum',     40, 28, 60, 'low_block',   '#005CA9', '#FFFFFF'],
  ['paderborn',  'ger.1', 'SC Paderborn',         'Paderborn',  43, 30, 62, 'gegenpress',  '#003D7C', '#000000'],

  // ======================================================== FRANCE — Ligue 1
  ['psg',        'fra.1', 'Paris Saint-Germain',  'PSG',        95, 97, 88, 'possession',  '#004170', '#DA291C'],
  ['marseille',  'fra.1', 'Olympique Marseille',  'Marseille',  76, 70, 78, 'possession',  '#FFFFFF', '#2FAEE0'],
  ['monaco',     'fra.1', 'AS Monaco',            'Monaco',     74, 76, 86, 'possession',     '#E63946', '#FFFFFF'],
  ['lyon',       'fra.1', 'Olympique Lyonnais',   'Lyon',       71, 64, 84, 'possession',  '#FFFFFF', '#DA291C'],
  ['lille',      'fra.1', 'Lille',                'Lille',      72, 60, 82, 'counter',     '#E01E13', '#FFFFFF'],
  ['nice',       'fra.1', 'OGC Nice',             'Nice',       58, 66, 76, 'low_block',   '#DA291C', '#000000'],
  ['rennes',     'fra.1', 'Stade Rennais',        'Rennes',     64, 58, 80, 'gegenpress',   '#E23D28', '#000000'],
  ['lens',       'fra.1', 'RC Lens',              'Lens',       70, 50, 74, 'counter',  '#FFE500', '#D30A11'],
  ['nantes',     'fra.2', 'FC Nantes',            'Nantes',     48, 38, 66, 'possession',  '#FCD703', '#008B4C'],
  ['strasbourg', 'fra.1', 'RC Strasbourg',        'Strasbourg', 60, 52, 72, 'possession',  '#009FE3', '#FFFFFF'],
  ['brest',      'fra.1', 'Stade Brestois',       'Brest',      52, 40, 68, 'wing_play',     '#E4002B', '#FFFFFF'],
  ['toulouse',   'fra.1', 'Toulouse',             'Toulouse',   56, 40, 72, 'gegenpress',  '#5F259F', '#FFFFFF'],
  ['paris-fc',   'fra.1', 'Paris FC',             'Paris FC',   51, 52, 66, 'possession',  '#00265F', '#FFFFFF'],
  ['auxerre',    'fra.1', 'AJ Auxerre',           'Auxerre',    46, 34, 64, 'counter',     '#FFFFFF', '#003C7E'],
  ['le-havre',   'fra.1', 'Le Havre',             'Le Havre',   45, 32, 66, 'possession',   '#75AADB', '#00205B'],
  ['lorient',    'fra.1', 'FC Lorient',           'Lorient',    48, 32, 64, 'low_block',   '#FF6600', '#000000'],
  ['angers',     'fra.1', 'Angers SCO',           'Angers',     44, 30, 62, 'low_block',   '#000000', '#FFFFFF'],
  ['le-mans',    'fra.1', 'Le Mans FC',           'Le Mans',    40, 28, 58, 'counter',     '#FFCC00', '#CC0000'],

  // ======================================================== FRANCE — Ligue 2
  ['saint-e',    'fra.2', 'Saint-Étienne',        'Saint-É',    42, 34, 70, 'gegenpress',  '#009A44', '#FFFFFF'],
  ['montpellier','fra.2', 'Montpellier HSC',      'Montpellier',44, 34, 64, 'counter',     '#003DA5', '#FF7F27'],
  ['reims',      'fra.2', 'Stade de Reims',       'Reims',      43, 32, 66, 'possession',  '#DA291C', '#FFFFFF'],
  ['metz',       'fra.2', 'FC Metz',              'Metz',       40, 30, 62, 'low_block',   '#8B0000', '#FFFFFF'],
  ['sochaux',    'fra.2', 'FC Sochaux',           'Sochaux',    36, 26, 60, 'counter',     '#FFD500', '#00337F'],
  ['guingamp',   'fra.2', 'EA Guingamp',          'Guingamp',   34, 24, 62, 'wing_play',   '#E4002B', '#000000'],
  ['troyes',     'fra.1', 'ESTAC Troyes',         'Troyes',     42, 34, 60, 'possession',  '#005CA9', '#FFFFFF'],
  ['grenoble',   'fra.2', 'Grenoble Foot',        'Grenoble',   30, 22, 58, 'counter',     '#005CA9', '#D50032'],

  // ====================================================== PORTUGAL — Primeira
  ['benfica',    'por.1', 'Benfica',              'Benfica',    80, 70, 90, 'possession',  '#E00000', '#FFFFFF'],
  ['porto',      'por.1', 'FC Porto',             'Porto',      84, 68, 89, 'counter',     '#00428C', '#FFFFFF'],
  ['sporting',   'por.1', 'Sporting CP',          'Sporting',   82, 66, 91, 'gegenpress',  '#008C57', '#FFFFFF'],
  ['braga',      'por.1', 'SC Braga',             'Braga',      66, 50, 80, 'wing_play',   '#B4141B', '#FFFFFF'],
  ['vitoria-g',  'por.1', 'Vitória Guimarães',    'Vitória',    51, 38, 72, 'counter',     '#FFFFFF', '#000000'],
  ['famalicao',  'por.1', 'Famalicão',            'Famalicão',  52, 34, 74, 'possession',  '#FFFFFF', '#005CA9'],
  ['rio-ave',    'por.1', 'Rio Ave',              'Rio Ave',    42, 28, 64, 'low_block',   '#007B3A', '#FFFFFF'],
  ['estoril',    'por.1', 'Estoril Praia',        'Estoril',    41, 28, 70, 'possession',  '#FFE500', '#005CA9'],

  // ================================================ NETHERLANDS — Eredivisie
  ['ajax',       'ned.1', 'Ajax',                 'Ajax',       72, 66, 94, 'possession',  '#FFFFFF', '#D2122E'],
  ['psv',        'ned.1', 'PSV',                  'PSV',        82, 64, 88, 'wing_play',   '#ED1C24', '#FFFFFF'],
  ['feyenoord',  'ned.1', 'Feyenoord',            'Feyenoord',  76, 58, 86, 'gegenpress',  '#DA291C', '#FFFFFF'],
  ['az',         'ned.1', 'AZ Alkmaar',           'AZ',         62, 46, 88, 'possession',  '#DA291C', '#000000'],
  ['twente',     'ned.1', 'FC Twente',            'Twente',     58, 38, 78, 'counter',     '#E30613', '#FFFFFF'],
  ['utrecht',    'ned.1', 'FC Utrecht',           'Utrecht',    54, 34, 74, 'low_block',   '#E1001A', '#FFFFFF'],
  ['heerenveen', 'ned.1', 'SC Heerenveen',        'Heerenveen', 46, 30, 78, 'possession',  '#005CA9', '#FFFFFF'],
  ['sparta-r',   'ned.1', 'Sparta Rotterdam',     'Sparta',     42, 26, 70, 'counter',     '#E4002B', '#FFFFFF'],

  // =================================================== BELGIUM — Pro League
  ['club-brugge','bel.1', 'Club Brugge',          'Brugge',     70, 52, 80, 'counter',     '#0066B2', '#000000'],
  ['anderlecht', 'bel.1', 'Anderlecht',           'Anderlecht', 60, 48, 84, 'possession',  '#582C83', '#FFFFFF'],
  ['genk',       'bel.1', 'KRC Genk',             'Genk',       58, 42, 86, 'gegenpress',  '#0055A5', '#FFFFFF'],
  ['gent',       'bel.1', 'KAA Gent',             'Gent',       56, 40, 74, 'wing_play',   '#0B5CA8', '#FFFFFF'],
  ['antwerp',    'bel.1', 'Royal Antwerp',        'Antwerp',    46, 38, 72, 'counter',     '#E4002B', '#000000'],
  ['standard',   'bel.1', 'Standard Liège',       'Standard',   48, 32, 74, 'low_block',   '#E4002B', '#FFFFFF'],
  ['union-sg',   'bel.1', 'Union Saint-Gilloise', 'Union SG',   66, 40, 74, 'gegenpress',  '#FFD800', '#004A99'],
  ['cercle',     'bel.1', 'Cercle Brugge',        'Cercle',     40, 28, 76, 'gegenpress',  '#00A650', '#000000'],
  ['westerlo',   'bel.1', 'KVC Westerlo',         'Westerlo',   39, 26, 70, 'possession',  '#FFE500', '#005CA9'],

  // ============================================ SPIN-OFF — SAUDI PRO LEAGUE
  // Reputation is mid-table by European standards; wealth is off the chart.
  // That gap is the entire trap.
  ['al-hilal',   'ksa.1', 'Al Hilal',             'Al Hilal',   77, 99, 66, 'possession',  '#0F4C9C', '#FFFFFF'],
  ['al-nassr',   'ksa.1', 'Al Nassr',             'Al Nassr',   78, 99, 64, 'counter',     '#FFD800', '#0B3D91'],
  ['al-ittihad', 'ksa.1', 'Al Ittihad',           'Al Ittihad', 64, 97, 62, 'wing_play',   '#000000', '#FFCB05'],
  ['al-ahli-s',  'ksa.1', 'Al Ahli',              'Al Ahli',    72, 96, 62, 'possession',  '#00A44F', '#FFFFFF'],
  ['al-qadsiah', 'ksa.1', 'Al Qadsiah',           'Al Qadsiah', 68, 88, 58, 'counter',     '#FFE500', '#005CA9'],
  ['al-shabab',  'ksa.1', 'Al Shabab',            'Al Shabab',  48, 82, 56, 'counter',     '#FFFFFF', '#000000'],
  ['al-ettifaq', 'ksa.1', 'Al Ettifaq',           'Al Ettifaq', 54, 80, 54, 'low_block',   '#00843D', '#FFFFFF'],

  // ============================================================ SPIN-OFF — MLS
  ['inter-miami','usa.1', 'Inter Miami',          'Miami',      66, 80, 60, 'possession',  '#F7B5CD', '#000000'],
  ['lafc',       'usa.1', 'Los Angeles FC',       'LAFC',       60, 72, 66, 'gegenpress',  '#000000', '#C39E6D'],
  ['atlanta',    'usa.1', 'Atlanta United',       'Atlanta',    44, 66, 64, 'wing_play',   '#80000A', '#000000'],
  ['seattle',    'usa.1', 'Seattle Sounders',     'Seattle',    56, 62, 66, 'possession',  '#5D9732', '#005595'],
  ['ny-red',     'usa.1', 'New York Red Bulls',   'NY Red Bulls',46,64, 70, 'gegenpress',  '#ED1E36', '#FFFFFF'],
  ['columbus',   'usa.1', 'Columbus Crew',        'Columbus',   54, 60, 68, 'possession',  '#FFE500', '#000000'],

  // ========================================================== SPIN-OFF — J1
  ['kashima',    'jpn.1', 'Kashima Antlers',      'Kashima',    60, 50, 74, 'counter',     '#B71C3E', '#00205B'],
  ['kawasaki',   'jpn.1', 'Kawasaki Frontale',    'Kawasaki',   51, 44, 78, 'possession',  '#009FE8', '#000000'],
  ['urawa',      'jpn.1', 'Urawa Red Diamonds',   'Urawa',      52, 46, 74, 'counter',     '#E60012', '#000000'],
  ['marinos',    'jpn.1', 'Yokohama F. Marinos',  'Marinos',    44, 44, 76, 'gegenpress',  '#004098', '#FFFFFF'],
  ['kobe',       'jpn.1', 'Vissel Kobe',          'Kobe',       55, 52, 72, 'possession',  '#8E1728', '#FFFFFF'],
  ['gamba',      'jpn.1', 'Gamba Osaka',          'Gamba',      48, 40, 74, 'wing_play',   '#00286E', '#000000'],
  ['sanfrecce',  'jpn.1', 'Sanfrecce Hiroshima',  'Sanfrecce',  56, 42, 76, 'low_block',   '#5A2A82', '#FFFFFF'],

  // ========================================================= SPIN-OFF — CSL
  ['shanghai-p', 'chn.1', 'Shanghai Port',        'Shanghai P', 52, 62, 58, 'counter',     '#E4002B', '#000000'],
  ['shanghai-s', 'chn.1', 'Shanghai Shenhua',     'Shenhua',    50, 58, 56, 'possession',  '#00509E', '#FFFFFF'],
  ['beijing-g',  'chn.1', 'Beijing Guoan',        'Guoan',      47, 56, 56, 'possession',  '#00693E', '#FFFFFF'],
  ['shandong',   'chn.1', 'Shandong Taishan',     'Shandong',   46, 56, 54, 'wing_play',   '#F58220', '#000000'],
  ['chengdu',    'chn.1', 'Chengdu Rongcheng',    'Chengdu',    48, 48, 52, 'gegenpress',  '#F2A900', '#000000'],
  ['zhejiang',   'chn.1', 'Zhejiang FC',          'Zhejiang',   40, 44, 54, 'counter',     '#008C45', '#FFFFFF'],
];

export const CLUBS: readonly Club[] = ROWS.map(
  ([id, leagueId, name, shortName, reputation, wealth, training, managerStyle, c1, c2]) => ({
    id,
    leagueId,
    name,
    shortName,
    reputation,
    wealth,
    training,
    managerStyle,
    colors: [c1, c2] as [string, string],
  }),
);
