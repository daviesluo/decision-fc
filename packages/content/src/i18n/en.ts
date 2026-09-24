/**
 * English copy.
 *
 * This file is the schema: `zh.ts` is typed against it, so a missing or
 * misspelled key is a build error rather than a blank card in production.
 *
 * Voice: terse, present tense, second person. A decision card has to be read in
 * about three seconds on a phone, so nothing here is longer than it needs to be.
 */
export const en = {
  app: {
    title: 'Decision FC',
    tagline: 'Twenty years. One career. Every choice comes back for you.',
  },

  intro: {
    title: 'Build a football career',
    subtitle: 'Pick where you come from, make the calls, and live with them.',
    /* Shown only in the itch.io build (`__ITCH__`), where the game runs in
       somebody else's iframe with no leaderboard tab and no address bar of
       its own. It is the one line that tells a player where the rest of it
       lives. */
    itchHome: 'World leaderboards and the daily challenge — decisionfc.com',
    start: 'Start career',
    pace: 'Pace',
    /* Three lines on a 100px tile: the name, how often a card comes, and how
       long a career takes. They used to share a line, and the thing that
       actually decides the choice was the half nobody read. */
    paceQuick: 'Quick',
    paceQuickCards: 'A card every two seasons',
    paceQuickShort: '~4 min',
    paceStandard: 'Standard',
    paceStandardCards: 'A card every season',
    paceStandardShort: '~6 min',
    paceDeep: 'Deep',
    paceDeepCards: 'Two cards a season',
    paceDeepShort: '~11 min',
    /* Shown under the picker for whichever pace is selected. The three tiles
       are 100px wide on a phone and can only carry a name and a duration, so
       the thing that actually decides the choice is said here. */
    paceQuickDesc: 'The years in between run themselves — you make only the calls that change the direction of a career.',
    paceStandardDesc: 'Enough to steer a career without living every week of it.',
    paceDeepDesc: 'The injuries, the derbies and the dressing-room weeks you would otherwise only read about in the season report.',
    /* Said plainly because players assume the long one is the hard one. It is
       not: the fewer cards a pace deals, the more each one is worth, and all
       three retire within half a rating point of each other. */
    paceNote: 'Pace is how much of the career you play through, not how hard it is. Fewer cards, and each one counts for more.',

    /* Two separate doors, deliberately. The daily challenge is a game mode;
       the three boards are how every career is scored. Folding the second into
       the first meant the only explanation of how the game is won sat behind a
       card most players read as "optional side mode" and never opened.

       Both live on this screen and nowhere else: a career is a story being
       lived, and a running leaderboard position in the corner of it would turn
       every card into a spreadsheet question. */
    daily: 'Daily challenge',
    dailyToday: "Today's career",
    dailyDone: 'Played today',
    /* Three lines, not a paragraph. The old one said all of this in four
       sentences and nobody read past the second. */
    daily_world: 'The same football for everyone today — the same academy offers, the same cards in the same order, the same clubs calling.',
    daily_pace: 'Standard pace for everyone, so the results compare.',
    daily_you: 'The player you build and every call you make are still your own.',
    boards: 'The three world rankings',
    boardsHint: 'How every career is scored',
    boardsTitle: 'The three world rankings',
    /* The three names come from the summary screen, so there is one place a
       board is named. These are what each one counts. */
    boards_legacy: 'Trophies, awards, goals and seasons at the top — weighed by the level you played at.',
    boards_wealth: 'Everything you were ever paid, by a contract or by a card.',
    boards_value: 'The most you were ever worth, in the season you were worth it.',
    boardsTension: 'They pull against each other on purpose: running a contract down is the best wage deal and the worst fee, and the Gulf pays far more than it is worth. You will not see any of them again until you retire.',
    /* Seven lines, and the first three are the ones that were missing.
       This sheet used to open with "ability is one number" — true, and not an
       answer to the question the button asks. Somebody tapping "How to play"
       wants to know what they are about to do: cards arrive, you pick one
       option, the seasons in between play themselves. The model notes are
       worth knowing, but they are what happens *after* you know how to play,
       so they come second. The seventh, tactics, was added on 2026-09-23:
       the offer cards stopped saying whether a manager's football suits you,
       because that read is the player's to make, so the one place that
       explains how to make it is here. */
    howto: 'How to play',
    howtoHint: 'Seven things worth knowing',
    howtoTitle: 'How to play',
    howto_play_title: 'You play one career, from sixteen to retirement.',
    howto_play: 'It takes a few minutes. You pick where you are from and what kind of player you are, and the rest is the choices you make.',
    howto_cards_title: 'Everything happens on a card.',
    howto_cards: 'A card puts a situation in front of you with two or three options, and each option says underneath what it will do to you. Pick one and the career moves on.',
    howto_seasons_title: 'The seasons play themselves.',
    howto_seasons: 'Between cards the football is simulated — the appearances, the goals, the trophies, the injuries. You steer the career; you do not pick the team.',
    howto_odds_title: 'The percentages are real.',
    howto_odds: 'A number on an option is the number the game rolls. Nothing is weighted for or against you.',
    howto_ability_title: 'Ability decides where you stand.',
    howto_ability: 'One number, rising through your twenties and falling later. It sets the highest place you can hold in a squad, and last season decides who comes calling in the summer.',
    howto_tactics_title: 'Every manager plays his own football.',
    howto_tactics: 'The style under a club\'s name is what its manager asks for: a high press wants legs and stamina, possession wants passers, a counter-attack wants pace and a finish, a deep defence wants defenders and strength, wing play wants quick dribblers, and free to roam rewards whatever you do best. Join a side whose football needs what you are good at and you play more and grow faster; the wrong one can bench a better player. The card will not tell you which — that read is yours.',
    howto_ending_title: 'The ending is earned, not drawn.',
    howto_ending: 'Twenty-five of them, decided by the career you actually had, and the rarest one that fits is the one you get.',
    news: "What's new",
    newsHint: 'Since you were last here',
    newsTitle: "What's new",
    news_fit: 'How to Play now explains what each manager\'s style asks of a player. Whether a club suits you is your read — the offer card leaves it to you.',
    news_minutes: 'Sitting on a bench costs you. A season without minutes slows how you develop at every age, so signing for a club that will not play you is a real price rather than a free badge.',
    news_daily: "The daily challenge has a board: everybody who plays today gets the same world, and the summary says where you finished among them.",
    news_offline: 'The game starts with no connection, once you have opened it once.',
    boardsGot: 'Got it',
  },

  /* The rewarded ad before a replay. See `apps/web/src/lib/ads.ts` for the
     ladder, the skip rule and why the reward is never withheld. */
  ads: {
    label: 'Advertisement',
    countdown: '{seconds}s',
    skip: 'Skip and play again',
    skipIn: 'Skip in {seconds}s',
    holdOn: 'Your next career is loading',
    why: 'Ads before a replay are what keep this free. Your first replay each day has none, and a career in progress is never interrupted.',
  },

  identity: {
    back: 'Back',
    title: 'Who are you?',
    subtitle: 'Sixteen years old, and nothing decided yet.',
    lastName: 'Name',
    lastNamePlaceholder: 'Enter a name',
    number: 'Shirt number',
    foot: 'Preferred foot',
    left: 'Left',
    right: 'Right',
    nationality: 'Nationality',
    searchCountry: 'Search country',
    position: 'Position',
    archetype: 'Type of player',
    confirm: 'Sign your first forms',
    randomise: 'Surprise me',
  },

  career: {
    /* Heading over the career table when it stands in its own column on a
       computer. On a phone the table needs no heading: it is the screen. */
    record: 'Career record',
    honours: 'Honours',
    honoursEmpty: 'Nothing in the cabinet yet.',
    age: 'Age',
    overall: 'OVR',
    peakOverall: 'Peak OVR',
    wage: 'Wage',
    perWeek: '/wk',
    club: 'Club',
    season: 'Season',
    contract: 'Contract',
    contractYears: '{years}y left',
    /* A deal in its last summer showed "0y", which is true and reads like a
       rendering fault. The transfer window is open at exactly this moment, so
       it is also the one time the number is worth a word.
       "Final year" against "1y" was two ways of saying the same thing and
       neither said which: one more season after this, or this one and no
       more. Now the number counts what is left and the word says it is up. */
    contractFinal: 'Final yr',
    /* The length of a deal being *signed*, which is not the same sentence as
       the time left on one already running. Every offer in the game rendered
       "3y left", so a four-year contract at a new club read like a countdown
       that had already started — and the one option that really is the deal he
       is already on, going back from a loan, read identically to signing a new
       one. Two facts, two strings. */
    contractLength: '{years}-year',
    freeAgent: 'Free agent',
    cash: 'Assets',
    /* Shown only on the opening academy card: the club's coaching, which is the
       one thing that separates three otherwise identical youth offers. It stops
       mattering at 21, which is why it appears nowhere else. */
    academyRating: 'Academy',
    marketValue: 'Value',
    apps: 'Starts (sub)',
    /* Career-table stat-column headings only. English uses the abbreviations
       a football fan reads instantly, because the full words physically do
       not fit a 34px column on a 375px screen — "INTERCEPTIONS" was clipping
       in every English career of a 3,200-career sweep. Chinese keeps the full
       words: two hanzi fit. The long-form names below stay for every other
       surface. */
    cols: {
      goals: 'Gls',
      assists: 'Ast',
      cleanSheets: 'CS',
      tackles: 'Tck',
      interceptions: 'Int',
      saves: 'Sv',
    },
    rating: 'Rating',
    trophies: 'Trophies',
    caps: 'Caps',
    onLoan: 'On loan',
    choosing: 'Deciding…',
    injured: 'Injured — {weeks} weeks out',
    relegated: 'Relegated',
    promoted: 'Promoted',
    suspended: 'Suspended',
    noTrophies: 'Nothing in the cabinet yet',
  },

  /** Compact stat labels. Which four appear depends on position. */
  /* What kind of club an offer is from, by quartile inside its own division —
     the first thing anybody wants to know about a club they do not follow.
     Two sets of top bands, because a second tier plays for promotion and the
     play-offs and has no European place to finish in. */
  standings: {
    title: 'title race',
    european: 'European places',
    // A top club outside Europe qualifies for its own confederation's
    // competition, not a European one — so a Chinese or Saudi side reads
    // "continental places", never "European places".
    continental: 'continental places',
    promotion: 'promotion race',
    playoff: 'play-off places',
    midtable: 'mid-table',
    survival: 'relegation fight',
  },

  leagues: {
    eng: { 1: 'Premier League', 2: 'Championship' },
    esp: { 1: 'La Liga', 2: 'La Liga 2' },
    ita: { 1: 'Serie A', 2: 'Serie B' },
    ger: { 1: 'Bundesliga', 2: '2. Bundesliga' },
    fra: { 1: 'Ligue 1', 2: 'Ligue 2' },
    por: { 1: 'Primeira Liga' },
    ned: { 1: 'Eredivisie' },
    bel: { 1: 'Pro League' },
    ksa: { 1: 'Saudi Pro League' },
    jpn: { 1: 'J1 League' },
    usa: { 1: 'MLS' },
    chn: { 1: 'Chinese Super League' },
  },

  /* Consequence labels. Plain sentences, not arithmetic: the player is being
     asked to make a decision, not to audit a spreadsheet. */
  effects: {
    ovr_up: 'Ability +{value}',
    ovr_down: 'Ability −{value}',
    ovr_temp: 'Ability −{value} for now',
    ovr_back: 'Ability +{value} once you settle',
    role_up: 'Become {role}',
    role_down: 'May drop to {role}',
    role_same: 'Stay {role}',
    /* Relative to the season he would otherwise have had, not to last one.
       A rung is applied on top of the standing this season recomputes from
       ability, so a player who has improved a lot can take the drop and still
       end up above where he was — measured at 15% of the cards that promise
       one. "Less playing time" then reads as a lie against the career table,
       which is the truthful record. Saying what the shift is against is the
       fix; forcing the season below last year's would be the engine bending to
       the sentence. */
    minutes_up: 'More playing time than you would have had',
    minutes_down: 'Less playing time than you would have had',
    /* The same fact on a card that is one afternoon: the ninety minutes are
       over, and what changes is the rest of the year. See `EventDef.afterMatch`. */
    minutes_up_after: 'More playing time afterwards than you would have had',
    minutes_down_after: 'Less playing time afterwards than you would have had',
    transfer: 'You change clubs',
    /* The whole price, on the card. The ban also suspends the year's pay
       (machine.ts zeroes the season's earnings), and a consequence line that
       hid that would be the card lying about its own cost. */
    suspended: 'Banned — a season lost, unpaid',
    new_position: 'You learn a new position',
    /* One line when every competition moves together, named only when the
       option is trading one for another — that trade is the decision. Which
       of the two pairs is used depends on whether the club is chasing
       anything: "better shot at silverware" in a relegation fight is a joke,
       and the same multiplier there simply means a better season. */
    form_up: 'The team has a better season',
    form_down: 'The team has a worse season',
    odds_up_named: 'Better in the {competition}',
    odds_down_named: 'Worse in the {competition}',
    trophy_won: 'You win it',
    trophy_lost: 'You lose it',
    call_up: 'You play at the tournament',
    no_call_up: 'You miss the tournament',
    must_move: 'You leave in the next window',
    /* `{cash}` arrives formatted in the player's own currency. */
    cash_up: 'Cash +{cash}',
    cash_down: 'Costs you {cash}',
    wage_up: 'Wage +{value}%',
    wage_down: 'Wage −{value}%',
    growth_up: 'You develop faster this season',
    growth_down: 'You develop slower this season',
    /* Past the peak, the same multiplier is about holding on, not improving. */
    decline_slower: 'You hold your level better this season',
    decline_faster: 'You lose your level faster this season',
    injury_risk_up: 'Higher injury risk',
    injury_risk_down: 'Lower injury risk',
    switch_nation: 'You play for them from now on, and there is no going back',
    doping_ban: 'A doping ban on your record for good',
  },

  /* Competition names as they read inside a consequence line. */
  competitions: {
    league: 'league',
    cup: 'cup',
    continental: 'European run',
  },

  /* Role names as they read inside a sentence. */
  /* The article belongs to the noun, not to the four sentences that use it:
     "a impact sub" and "a important player" both reached the screen, because
     every template hardcoded "a". Carrying it here is the only version that
     cannot be got wrong by the next slot that names a role. */
  rolesInline: {
    star: 'a star player',
    important: 'an important player',
    regular: 'a regular starter',
    squad: 'a squad player',
    impact_sub: 'an impact sub',
    fringe: 'a fringe player',
  },

  months: {
    aug: 'August',
    sep: 'September',
    oct: 'October',
    nov: 'November',
    dec: 'December',
    jan: 'January',
    feb: 'February',
    mar: 'March',
    apr: 'April',
    may: 'May',
  },

  stats: {
    appearances: 'Apps',
    goals: 'Goals',
    assists: 'Assists',
    cleanSheets: 'Clean sheets',
    saves: 'Saves',
    goalsConceded: 'Conceded',
    tackles: 'Tackles',
    interceptions: 'Interceptions',
    aerialsWon: 'Headers won',
    keyPasses: 'Key passes',
    passAccuracy: 'Pass accuracy',
    dribblesCompleted: 'Dribbles',
  },

  roles: {
    star: 'Star Player',
    important: 'Important Player',
    regular: 'Regular Starter',
    squad: 'Squad Player',
    impact_sub: 'Impact Sub',
    fringe: 'Fringe Player',
  },

  positions: {
    GK: 'GK', CB: 'CB', LB: 'LB', RB: 'RB',
    CDM: 'CDM', CM: 'CM', CAM: 'CAM', LM: 'LM', RM: 'RM',
    LW: 'LW', RW: 'RW', ST: 'ST',
  },

  /* Written out under each spot on the pitch: "CDM" tells a new player
     nothing, and this is the one screen where there is room to say it. */
  positionNames: {
    GK: 'Goalkeeper',
    CB: 'Centre-back', LB: 'Left-back', RB: 'Right-back',
    CDM: 'Holding mid', CM: 'Centre mid', CAM: 'Attacking mid',
    LM: 'Left mid', RM: 'Right mid',
    LW: 'Left wing', RW: 'Right wing', ST: 'Striker',
  },

  /**
   * The three player types. None of them starts on a better rating, and over a
   * whole career they retire within a couple of percent of each other on
   * legacy and on money — see the calibration note on `ARCHETYPE_TILT` in
   * `engine/model/growth.ts`. So the pro and the con below really are the
   * whole of the difference, and they must stay true to the numbers: if the
   * table is retuned, this copy is retuned with it.
   */
  archetypes: {
    pace: {
      name: 'Speed',
      pro: 'Ahead of your age group early, and lethal on the counter',
      con: 'Fades soonest, and gets injured the most',
    },
    technical: {
      name: 'Technical',
      pro: 'Still improving late, and made for possession football',
      con: 'The slowest start — your best years are your last ones',
    },
    physical: {
      name: 'Physical',
      pro: 'Rarely injured and never has a bad spell: the steadiest career',
      con: 'No early surge, no late bloom; pressing suits you, passing does not',
    },
  },

  /* Kept short: they sit in a six-column strip on a 375px screen, and a
     label that truncates to "DRIBBLI…" is worse than no label. */
  attributes: {
    pace: 'Pace',
    shooting: 'Shoot',
    passing: 'Pass',
    dribbling: 'Drib',
    defending: 'Def',
    physical: 'Phys',
  },

  /** Goalkeepers use the same six slots under different names. */
  attributesGk: {
    pace: 'Reflex',
    shooting: 'Hands',
    passing: 'Kicking',
    dribbling: 'Cmd',
    defending: 'Pos',
    physical: 'Phys',
  },

  managerStyles: {
    // Not "Gegenpress", dropped on 2026-09-23: the German coaching word reads
    // as jargon. The Chinese has always said 高位逼抢, high pressing.
    gegenpress: 'High press',
    possession: 'Possession',
    counter: 'Counter-attack',
    low_block: 'Deep defence',
    wing_play: 'Wing play',
    free_role: 'Free to roam',
  },

  trophies: {
    league: 'League title',
    domestic_cup: 'Domestic cup',
    continental_elite: 'UEFA Champions League',
    continental_secondary: 'UEFA Europa League',
    club_world_cup: 'FIFA Club World Cup',
    continental_nations: 'UEFA European Championship',
    world_cup: 'FIFA World Cup',
  },

  /* Real competition names, chosen by the club's country or the player's. */
  cups: {
    eng: 'FA Cup', esp: 'Copa del Rey', ita: 'Coppa Italia', ger: 'DFB-Pokal',
    fra: 'Coupe de France', por: 'Taça de Portugal', ned: 'KNVB Cup',
    bel: 'Belgian Cup', ksa: "King's Cup", jpn: "Emperor's Cup",
    usa: 'US Open Cup', chn: 'Chinese FA Cup',
  },
  continentalCups: {
    UEFA: { elite: 'UEFA Champions League', secondary: 'UEFA Europa League' },
    AFC: { elite: 'AFC Champions League Elite', secondary: 'AFC Champions League Two' },
    CONCACAF: { elite: 'CONCACAF Champions Cup', secondary: 'CONCACAF Central American Cup' },
    CONMEBOL: { elite: 'Copa Libertadores', secondary: 'Copa Sudamericana' },
    CAF: { elite: 'CAF Champions League', secondary: 'CAF Confederation Cup' },
    OFC: { elite: 'OFC Champions League', secondary: 'OFC Champions League' },
  },
  nationsCups: {
    UEFA: 'UEFA European Championship',
    AFC: 'AFC Asian Cup',
    CONCACAF: 'CONCACAF Gold Cup',
    CONMEBOL: 'Copa América',
    CAF: 'Africa Cup of Nations',
    OFC: 'OFC Nations Cup',
  },

  awards: {
    ballon_dor: 'Ballon d’Or',
    golden_boot: 'League Golden Boot',
    golden_glove: 'Golden Glove',
    team_of_the_season: 'League Team of the Season',
  },

  injuries: {
    hamstring: 'Hamstring tear',
    ankle_sprain: 'Ankle sprain',
    calf_tear: 'Calf tear',
    meniscus: 'Torn knee cartilage',
    metatarsal_fracture: 'Broken foot',
    shoulder_dislocation: 'Dislocated shoulder',
    disc_hernia: 'Slipped disc',
    acl: 'Torn knee ligament',
    tibia_fibula: 'Broken leg',
    achilles: 'Ruptured Achilles',
  },


  /**
   * Press coverage. Written as headlines, not sentences — the outlet's name sits
   * next to it, so the voice has to read like that outlet's front page.
   */
  headlines: {
    transfer_fee: 'Here we go — {club} have completed the signing. Fee: {fee}.',
    transfer_free: 'Here we go — free transfer to {club} confirmed. Medical done.',
    took_the_money: 'He has chosen the cheque over the game. {club} get a player the cameras will stop following.',
    ballon_dor: 'Ballon d’Or. Nobody else was close.',
    world_cup: 'World champion. Everything else is footnotes now.',
    continental: '{club} are champions of the continent — and he was the reason.',
    league_title: 'Champions. {club} get the title over the line.',
    golden_boot: '{goals} goals. Nobody in the league came near him.',
    breakthrough: 'Where did this come from? {club} may have the best-value player in the league.',
    long_injury: '{weeks} weeks out. A season, effectively, and a career question attached to it.',
    injury: '{weeks} weeks on the treatment table. The rhythm is gone.',
    relegated: 'Down. {club} go through the trapdoor and the fire sale starts Monday.',
    promoted: 'Promoted. {club} are back where they think they belong.',
    in_form: 'Nobody is playing better. {rating} across the season is absurd.',
    poor_form: 'A worrying year. {club} needed more, and did not get it.',
    frozen_out: 'Frozen out at {club}. He has not been in a matchday squad since autumn.',
    evergreen: '{age} years old and still starting. They do not really make them like this.',
    first_call_up: 'Called up for the first time. He looked like he had been there for years.',
  },

  settings: {
    title: 'Settings',
    currency: 'Currency',
    /* The section header inside settings. `intro.language` labels the inline
       EN/中文 toggle on the title screen, which is a different control. */
    language: 'Language',
    currencyHint: 'Display only. Wages and fees are modelled in euros and the leaderboards compare euro figures, so switching here never changes a result.',
    display: 'Display',
    showOdds: 'Show odds on options',
    showOddsHint: 'The percentages shown are the ones actually rolled.',
    quit: 'Abandon this career',
    quitHint: 'Ends it here and goes back to the start. It is not saved, and it is not on any leaderboard.',
    quitConfirm: 'Abandon it',
    quitCancel: 'Keep playing',
    reducedMotion: 'Reduce motion',
    reducedMotionHint: 'Turn off card and screen animation.',
    open: 'Settings',

    /* The reference block below the toggles. Four surfaces, four jobs, and the
       reason they are separate rather than one long page:
         · "How to play" (title screen) teaches the rules — what a card is.
         · The handbook here teaches strategy — how a high score is built.
         · About says what the game is; FAQ answers the practical questions.
       Nothing here repeats the how-to; if a fact belongs to two of them it is
       written for a different question in each. */
    help: 'Guide & info',
    handbook: 'Strategy handbook',
    handbookHint: 'How high scores are built',
    handbookTitle: 'Strategy handbook',
    handbookLede:
      '“How to play” gives you the rules. This is how careers are won — the reading behind a high score, and the trade-offs you commit to before your first card.',
    hb_chase_title: 'Chase one board, not three.',
    hb_chase:
      'Legacy, wealth and valuation pull against each other by design — the move that pays best rarely wins the most, and almost never peaks your price. Decide early which career you are building; every later call is easier once you have.',
    hb_ability_title: 'Everything flows from ability.',
    hb_ability:
      'It is one number that climbs through your twenties and slides after. Your squad role, every offer you get and all three boards are downstream of it — so a season lost, to injury or to the bench, is the most expensive thing that can happen to you.',
    hb_minutes_title: 'Play. Do not sit.',
    hb_minutes:
      'Regular minutes at a level you can hold grow you faster than a seat on a great club’s bench. Early on, being the man at a good club beats being a name at a giant — you can always move up once the football says you have earned it.',
    hb_loan_title: 'Treat the loan as a launchpad.',
    hb_loan:
      'A loan is one season to prove it. Take it, start every week, and come back wanted — it is the quickest way up while you are young. Turning one down to train with the reserves wastes the very season that would have made you.',
    hb_offers_title: 'Read the deal, not the badge.',
    hb_offers:
      'Wage, length and release clause decide more than the crest. Clubs only call when you are within reach of their level, so an offer is really a verdict on where you stand — and the grandest badge, taken for a bench role, can quietly cost you your best years.',
    hb_tactics_title: 'Match the manager to your game.',
    hb_tactics:
      'Every manager re-weights what you are good at: a high press and counter play pay for pace and physique, possession pays for passing, wing play for dribbling, a deep defence for defending, and free to roam rewards your best attribute whatever it is. So a pace player flies on the counter and drowns in a low block; a technical player is the opposite. The fit swings your effective ability by up to ±12% — enough to turn a starter into a substitute — so a smaller club whose style suits you will often play you, and grow you, more than a bigger one that does not.',
    hb_reading_title: 'Read everything on an offer card.',
    hb_reading:
      'Top line of every club row: the division, the club’s standing in it (title race, Europe, mid-table, relegation — or the promotion race in a second tier), then five green bars showing the club’s strength — the squad quality you would have to beat for a place. The line below is the manager’s style and the squad role you are promised; the tags carry the weekly wage, contract length and any signing bonus. On event cards, the percentage beside an outcome is the exact probability the game rolls — you can show or hide it in settings.',
    hb_legacy_title: 'For a legend: climb as high as you can hold.',
    hb_legacy:
      'Trophies, goals and awards are weighed by the level you won them at — one Champions League at a European giant outweighs a drawer of second-tier medals. Aim for the biggest club whose side you can genuinely keep a place in, and win there.',
    hb_value_title: 'For a record valuation: time your peak.',
    hb_value:
      'This board keeps only your single best season’s worth. You are dearest in your peak years, at a big club, in a big league — so line the move up to land you in all three at once, in the season your ability is highest.',
    hb_wealth_title: 'For a fortune: be patient, and mind the Gulf.',
    hb_wealth:
      'Wealth counts every euro you were ever paid. Running a contract to its end and leaving on a free is the strongest wage deal, and the moves to Saudi Arabia, the US or China after thirty-two pay far above your worth — but both arrive after your value has peaked, and neither builds a legend.',

    about: 'About Decision FC',
    aboutHint: 'What this game is',
    aboutTitle: 'About Decision FC',
    aboutLede:
      'Decision FC (足球生涯) is a football-career simulator you play entirely through choices — start at sixteen, and live twenty seasons in about five minutes.',
    ab_what_title: 'A whole career, in five minutes.',
    ab_what:
      'Pick where you come from and what kind of player you are, sign for an academy, go out on loan, and chase the move that makes you or the one that pays you. Free, in the browser, in English and 简体中文, with nothing to download.',
    ab_how_title: 'You steer; the seasons play themselves.',
    ab_how:
      'You never pick the team or kick the ball — you make the calls a footballer’s life turns on, and the matches between them are simulated from those calls. The same start and the same choices always produce the same career, which is what lets the leaderboards check a run instead of trusting it.',
    ab_world_title: 'A real football world.',
    ab_world:
      '191 real clubs across England, Spain, Italy, Germany, France and beyond, with the leagues, cups and continental nights to match, and a transfer market that behaves like one — clubs sign who they can reach, and loans stay inside the European pyramid.',
    ab_free_title: 'Free, and meant to stay that way.',
    ab_free:
      'No account, no login, nothing to buy. A single optional ad before a replay is what keeps it free — your first replay each day has none, and a career already in progress is never interrupted.',
    ab_made_title: 'Made independently.',
    ab_made:
      'An independent project, built by one person and still growing. Bugs, ideas and questions are genuinely welcome — write to daviesluo@gmail.com.',

    faq: 'FAQ',
    faqHint: 'Quick answers',
    faqTitle: 'FAQ',
    faq_free_q: 'Is it really free?',
    faq_free_a:
      'Yes. It is supported by one optional ad before a replay — your first replay each day has none, and a career in progress is never interrupted. There is nothing to buy.',
    faq_account_q: 'Do I need an account?',
    faq_account_a:
      'No, and there is no login. Your progress, settings and language live in your own browser. The only things that ever leave it are a finished career you submit to the rankings and an anonymous daily count of how the game is played — the privacy policy says exactly what.',
    faq_length_q: 'How long does a career take?',
    faq_length_a:
      'A few minutes. Pick a pace on the start screen — fewer cards is quicker and makes each one count for more; it is not any easier or harder.',
    faq_save_q: 'Will I lose my career if I close the tab?',
    faq_save_a:
      'No. A career in progress is saved on your device and resumes where you left off. Only clearing your browser storage erases it.',
    faq_daily_q: 'Is the daily challenge the same for everyone?',
    faq_daily_a:
      'Yes — the same football world that day, the same cards in the same order, at the same pace. Only the player you build and the calls you make are your own.',
    faq_offers_q: 'Why won’t a big club sign me?',
    faq_offers_a:
      'Offers are tied to your ability and your last season. A club far above your level will not cold-call you — play your way into their reach, and they start to notice.',
    faq_currency_q: 'Does changing currency or language change my result?',
    faq_currency_a:
      'No. Both are display only. The game and the leaderboards work in euros, so switching never changes what actually happens.',
    faq_leaderboard_q: 'How do the world rankings work?',
    faq_leaderboard_a:
      'When a career ends it can be submitted to three of them. Only gameplay data goes up — the seed, your choices and the name you typed — so please do not use real personal information as a player name.',
    faq_feedback_q: 'How do I send feedback?',
    faq_feedback_a: 'Email daviesluo@gmail.com — bugs, ideas and questions are all welcome.',

    privacy: 'Privacy policy',
  },

  decisions: {
    academy: {
      title: 'Three academies want you',
      body: 'Nobody is offering money yet. What they are offering is coaching, and a first team you might one day reach.',
      join: 'Join {club}',
    },
    transfer: {
      title: 'The window is open',
      /* Whether his own club wants to keep him is the first fact he needs, and
         it used to be readable only from whether a "stay" option existed. */
      body_wanted: '{club} want to extend your contract. There are offers on the table too — read the wage, the length and the clause, not just the badge.',
      /* No new terms, but he is under contract and can simply stay on it. The
         body used to claim the club "wants to extend" here too, which was a
         lie: nothing new was on offer, only the deal he already had. */
      body_stay: '{club} have not put new terms on the table, but your current deal runs on and you can stay. Other offers are on the table too — read the wage, the length and the clause, not just the badge.',
      body_unwanted: '{club} have not offered you a new deal. Read what is on the table — the wage, the length and the clause, not just the badge.',
      free_title: 'Your contract is up',
      free_body_wanted: 'You are a free agent, and {club} want you to re-sign. No fee to pay means a far bigger signing bonus for you either way.',
      free_body_unwanted: 'You are a free agent, and {club} have not put a new deal in front of you. No fee to pay means a far bigger signing bonus for you.',
      join: 'Sign for {club}',
      stay: 'Re-sign with {club}',
      /* Mid-contract, where there is no new deal to sign because the club is
         not offering one yet. Says what happens rather than implying terms. */
      stay_on_deal: 'Stay at {club}',
      stay_on_deal_hint: 'Your current contract runs on',
      run_down: 'Run the contract down',
      /* Only ever offered in the final year of a deal (`canRunDown`), so this
         is the whole truth rather than half of it. */
      /* "Walk away for nothing" read as the *player* getting nothing, in the
         same breath as a bigger bonus. It is the buying club that pays
         nothing. */
      run_down_hint:
        'Let it expire and leave for free next summer — no fee for the buyer means a far bigger signing bonus for you',
      retire: 'Call it a career',
      retire_hint: 'Walk away now, on your own terms',
      results: {
        joined: 'You sign for {club}.',
        stayed: 'You put pen to paper at {club}.',
        stayed_on_deal: 'You stay at {club} on the deal you already had.',
        running_down: 'No new deal. Next summer you walk for free.',
      },
    },
    /*
     * Not a separate card — the same transfer window, opened by a different
     * piece of news, so every option under it is built by the same rules.
     *
     * A manager change is the most common reason a real career turns, and it
     * was the quietest thing in this game: the style changed, tactical fit
     * moved with it, the squad role followed a season later, and no screen ever
     * said a manager had been sacked. This says what they played, what they
     * play now, and leaves the rest of the card to answer it.
     */
    manager_change: {
      title: 'There is a new manager',
      /* Two facts and a question, in under a hundred and thirty characters.
         The first draft ran to a hundred and eighty and took four lines on a
         phone — and its last clause, "you can wait and find out, or you can
         go", was the three options underneath it said again in prose. */
      body: '{club} have sacked the manager. They played {from}; the new man plays {to}.',
    },
    spending: {
      title: 'You have some savings now',
      body_a: 'The first real money of your career is sitting in an account doing nothing. Where does it go?',
      body_b: 'Your accountant is back, and he wants a decision on where this money goes.',
      training: 'Private training staff',
      training_up: 'Faster development, fewer injuries',
      lifestyle: 'Live a little',
      lifestyle_up: 'More exposure, bigger endorsements',
      lifestyle_down: 'An unhappy dressing room, and slower development for it',
      /* The Chinese said this plainly — 「每年从工资里扣 X」 — and the English
         did not: "«€»40.6K of your wage, every year" reads as a fragment, and
         the reader has to work out that it is a yearly deduction rather than a
         share of something. */
      cost: '{cash} a year, out of your wage',
      save: 'Bank it',
      save_hint: 'Nothing changes — but the balance keeps growing',
      results: {
        training: 'You hire your own staff. They start on Monday.',
        lifestyle: 'The cameras start following you around.',
        saved: 'The money stays where it is.',
      },
    },
    loan: {
      title: 'You are not going to play here',
      /* Three rungs, three framings — a boy going out locally, a teenager sent
         down a division to learn, and a young player who has earned a look at
         the level above. See `loanRung`. */
      body_home:
        'Too good for the youth team, not ready for this one. A season somewhere close, playing every week.',
      body_development:
        'The manager rates you. He is not going to pick you. A season in a second division is minutes you will not get at {club}.',
      body_proving:
        'You have outgrown the level you were sent to learn at. These are top-flight clubs, and every one of them would put you straight in.',
      /* "Go to {club}" read the same as a permanent move — a player rightly
         asked whether he was being loaned or sold. The Chinese said 租借 in the
         label; the English left it to the card's title, so the button now says
         it outright, matching the "on loan" in the result below. */
      join: 'Go to {club} on loan',
      results: {
        joined: 'You join {club} on loan. Pre-season starts Monday.',
      },
    },
    loan_return: {
      title: 'The loan is up',
      body_wanted: 'You came good this season, and {club} want you back in the side.',
      body_unwanted: "You are still not in {club}'s plans — you need somewhere you will play.",
      body_selling: "You are still not in {club}'s plans, and they mean to sell you before your deal runs out.",
      go_back: 'Go back to {club}',
      /* Two different things a parent club can do, and the card has to say
         which. New terms are a decision somebody made; going back on the deal
         you already have is not. */
      go_back_renew: 'Go back to {club} on new terms',
      sign_permanently: 'Sign permanently for {club}',
      /* A loan runs one season and ends in a decision — this is the one that
         keeps him where he is, which used to be imposed rather than offered. */
      back_at_role: 'Back there, your ability makes you {role}',
      /* Why there are no new terms on the table, before he chooses rather than
         after. A club that will not put a boy in the side does not extend him,
         and a career that ends up a free agent at twenty should be able to see
         it coming a season out. */
      no_new_terms: 'They will not extend you — a free agent next summer',
      stay_playing: 'Keep the shirt you have earned',
      results: {
        returned: 'You report back for pre-season, on the deal you already had.',
        renewed: 'You report back for pre-season, and sign new terms at {club}.',
        signed: 'You sign for {club} permanently.',
      },
    },
  },

  retirement: {
    chose: 'You decide it is time.',
    age: 'The body has had enough.',
    decline: 'The minutes dried up, and so did the offers.',
    no_offers: 'Nobody is calling. No club wants to give you a contract.',
  },

  summary: {
    percentile: 'Top {percent}%',
    unrankable:
      'The game was updated while this career was in progress, so it cannot be ranked globally. The next one will be.',
    share: 'Share your career',
    showName: 'Show surname on the card',
    turningPoints: 'Turning points',
    turning: {
      academy: 'Where it started',
      academyBody: 'You signed your first forms at {club}.',
      move: 'The move that changed it',
      moveBody: 'You left {from} for {club} — and won {trophies} there.',
      moveBodyNone: 'You left {from} for {club}. It was the biggest step up anyone offered you.',
      injury: 'The one that stayed with you',
      injuryBody: 'You never came all the way back from this one. It cost {cost} rating points for good.',
      peak: 'Your best season',
      peakBody: 'At {club}, rated {rating} across the season — the year the rest of your career is measured against.',
    },
    replay: 'Play again',
    seasonsPlayed: '{count} seasons',
    verdict: 'Career verdict',
    /* The one year the career is remembered for. */
    bestSeason: 'Best season · {club} · age {age}',
    avgRating: 'Avg rating',
    viewSummary: 'View summary',
    download: 'Save image',
    shareImage: 'Share',
    copied: 'Copied to clipboard',
    rendering: 'Building your card…',
    shareFailed: 'That did not work — try saving the image instead.',
    boards: {
      legacy: 'Achievements',
      wealth: 'Wealth',
      value: 'Highest valuation',
    },
    /* The daily challenge's own board: everybody who played today's world. */
    dailyBoard: {
      label: "Today's challenge",
      standing: '{rank} of {total}',
      alone: 'First one home',
    },
    boardHints: {
      legacy: 'Every trophy, award, goal and season at the top, weighed by the level you played at. Tap for the full breakdown.',
      wealth: 'Everything you were paid across the career, before tax.',
      value: 'The highest your market value ever reached — your peak, not your last season.',
    },
    legacyKeys: {
      trophies: 'Trophies',
      awards: 'Individual awards',
      output: 'Goals and minutes',
      peak: 'Peak ability',
      longevity: 'Years at the top',
      wealth: 'Wealth',
      loyalty: 'Loyalty',
      /* Not "Penalties": on a football screen that word means spot-kicks. */
      penalties: 'Deductions',
    },
  },

  endings: {
    goat: { title: 'The Greatest', body: 'There is no argument left to have. Every list starts with your name.' },
    ballon_dor_winner: { title: 'Ballon d’Or Winner', body: 'For one year at least, you were the best player alive.' },
    world_champion: { title: 'World Champion', body: 'Whatever else happened, you lifted the only trophy that stops arguments.' },
    continental_king: { title: 'King of Europe', body: 'Two Champions Cups. They will play the footage forever.' },
    oil_baron: { title: 'Followed the Money', body: 'You went where the money was, and the money was extraordinary. History will have opinions.' },
    one_club_legend: { title: 'One-Club Legend', body: 'One badge, start to finish. There is a stand with your name on it.' },
    serial_winner: { title: 'Serial Winner', body: 'A cabinet that needed a second room. Not a household name — but everyone in the game knows.' },
    late_bloomer: { title: 'The Late Bloomer', body: 'Nobody saw it coming at twenty-two. Everybody saw it by thirty.' },
    disgraced: { title: 'Tainted Record', body: 'The numbers were real. The way you got there was not.' },
    glass_talent: { title: 'Injury-Prone Talent', body: 'Brilliant when fit. The problem was the second half of that sentence.' },
    nearly_man: { title: 'The Nearly Man', body: 'Great player. Wrong teams, wrong years, every single time.' },
    solid_pro: { title: 'The Professional', body: 'A proper career. Kids in your hometown still wear your number.' },
    journeyman: { title: 'The Journeyman', body: 'Eight dressing rooms, eight sets of directions to training, and nothing in the cabinet. You made a living out of the game.' },
    /* Ten added when the endings were re-ordered by rarity — see summary.ts.
       Each one is a shape of career the old fourteen could not tell: a
       goalkeeper's, a forward's, an international's, a career that climbed
       divisions, one that never left home, one that ended early. */
    continental_nomad: { title: 'Champion of Three Countries', body: 'Three leagues, three medals, three languages of song. Nobody does that by accident.' },
    centurion: { title: 'A Hundred Caps', body: 'A hundred caps. Your shirt hangs in the federation museum, and the anthem still does something to you.' },
    goal_machine: { title: 'The Goalscorer', body: 'Three hundred goals. Defenders who retired years ago still describe you the same way.' },
    the_wall: { title: 'The Wall', body: 'A career of clean sheets and quiet afternoons that were only quiet because of you.' },
    cup_specialist: { title: 'The Cup Man', body: 'Never a league title, and three cup finals won. Everyone remembers the days out.' },
    boy_wonder: { title: 'The Boy Wonder', body: 'You were the best twenty-year-old anyone had seen. The next ten years never quite answered it.' },
    comeback: { title: 'The Comeback', body: 'The injury took something off you for good. You went back and reached your peak anyway.' },
    promotion_hero: { title: 'The Promotion Winner', body: 'Three times up. Three pitch invasions, three sets of supporters who will buy you a drink forever.' },
    globetrotter: { title: 'The Globetrotter', body: 'Five countries, five sets of paperwork, five ways of being a stranger in the dressing room.' },
    homegrown: { title: 'Home Is Home', body: 'The offers came every summer, and every summer you stayed. Your league, your country, your whole career.' },
    frozen_out: { title: 'Nobody Called', body: 'The phone stopped ringing while you were still fit enough to play. That is how most of them end.' },
    squad_player: { title: 'Squad Player', body: 'You made it further than almost everyone who ever tried. That is not nothing.' },
  },

  events: {
    /* Used when a card's "ask to leave" splits across two destinations: one
       label per club, so the two rows are not the same sentence twice. */
    shared: {
      joinClub: 'Sign for {club}',
    },

    closed_door_friendly: {
      title: 'A closed-door friendly',
      body: 'A midweek friendly with nobody watching but the staff. The manager is picking his team for Saturday off it.',
      options: { go_hard: 'Play like it counts', coast: 'Get through it' },
      why: {
        knock: 'a friendly is still ninety minutes on a hard pitch',
      },
      results: {
        noticed: 'You were the best player on an empty pitch, and the man picking the team saw all of it.',
        knock: 'You felt something go in your thigh with twenty minutes left. In a friendly.',
        coasted: 'You did what was asked and nothing more. Nobody remembers it either way.',
      },
    },
    fifty_fifty: {
      title: 'A fifty-fifty challenge is coming in',
      body: 'The ball sits up between you and a defender who is not going to pull out of it either.',
      options: { go_in: 'Go through him', pull_out: 'Pull out' },
      why: {
        came_off: 'he is not pulling out of it either',
        pulled_out: 'the bench sees a player who did not fancy it',
      },
      results: {
        won_it: 'You won it clean, kept the move alive, and the crowd let the whole ground know.',
        came_off: 'You both went in. Only one of you got up quickly, and it was not you.',
        pulled_out: 'You pulled out. The bench saw it. Everyone on it saw it.',
      },
    },
    play_through_it: {
      title: 'You are carrying an injury',
      body: 'The scan is clean enough to play on. The physio would rather you did not: playing through can leave damage that never fully heals.',
      options: { play: 'Strap it and play', sit_out: 'Sit the month out' },
      why: {
        made_it_worse: 'a scan clear enough to play on is not a scan that says healed',
      },
      results: {
        held_up: 'It held up. You played the run-in on one and a half legs and it was worth it.',
        made_it_worse: 'It went properly in the second half. What was three weeks became three months, and something in it never came all the way back.',
        sat_out: 'You sat it out and came back right. The team learned to play without you.',
      },
    },
    derby_week: {
      title: 'Derby week',
      body: 'The one fixture the supporters count differently. Nobody in the city talks about anything else until Sunday.',
      options: { take_it_on: 'Demand the ball', play_safe: 'Keep it simple' },
      why: {
        hid: 'ask for the ball all afternoon and every loss of it is yours',
      },
      results: {
        owned_it: 'You took the game by the throat in front of everybody. They will sing about this one.',
        /* He demanded the ball — the losing branch has to be him demanding it
           and it going wrong, not him hiding. Telling a player who chose
           "Demand the ball" that he hid is the card contradicting the option
           he just pressed. */
        hid: 'You asked for it all afternoon and lost it all afternoon. In a derby that is the one thing a crowd never forgives.',
        anonymous: 'You did your job and nothing else. The game passed you by, and passed off quietly.',
      },
    },
    reserves_run: {
      title: 'A month in the reserves',
      body: 'The coach offers you games with the under-21s to get your sharpness back. It is a long way down from where you were.',
      options: { drop_down: 'Take the games', refuse_reserves: 'Refuse — you are a first-team player' },
      why: {
        nobody_watched: 'the man who picks the first team is not at the reserves',
        sulked: 'a refusal goes in the file, and the file decides July',
      },
      results: {
        earned_it: 'You were far too good for it, which was exactly the point, and the manager admitted as much.',
        nobody_watched: 'You played well in front of forty people and a groundsman, and the first team went on without you.',
        sulked: 'You refused, and the staff wrote you down as the sort who does. A season of training and no football gets you nowhere.',
      },
    },
    extra_training: {
      title: 'The coaches want you in for extra training',
      body: 'The fitness coach wants you in every morning through pre-season. It will hurt.',
      options: { accept: 'Do the work', rest: 'Protect your body' },
      why: {
        strained: 'the body that gets sharper is the body that can go',
      },
      results: {
        gained: 'You come back sharper than anyone else in the building.',
        strained: 'You overcooked it. Something goes in the last session.',
        rested: 'You are fine. Just fine.',
      },
    },
    preseason_camp: {
      title: 'A pre-season altitude camp',
      body: 'Three weeks at altitude, no family, no days off. Players come back either flying or broken.',
      options: { accept: 'Go', rest: 'Stay and train normally' },
      why: {
        strained: 'not every body adapts to three weeks of altitude',
      },
      results: {
        gained: 'You come down from the mountain a different player.',
        strained: 'Your body never adjusts. You lose the whole pre-season.',
        rested: 'A normal summer. Nothing gained, nothing lost.',
      },
    },
    personal_coach: {
      title: 'A private technical coach is on offer',
      body: 'He wants to rebuild your technique from the ground up. It means unlearning things that already work.',
      options: { rework: 'Rebuild it', reject: 'Leave it alone' },
      why: {
        lost_it: 'unlearning what already works can leave you with neither',
      },
      results: {
        clicked: 'Around November it clicks, and it stays clicked.',
        lost_it: 'You spend a season between two techniques and own neither.',
        unchanged: 'You keep what you have.',
      },
    },
    nutrition_plan: {
      title: 'The club has drawn up a nutrition plan',
      body: 'A specialist has read your bloods and wants to change everything you eat.',
      options: { accept: 'Follow it', reject: 'Eat like a footballer' },
      why: {
        backfired: 'a new diet takes the weight off the wrong things first',
      },
      results: {
        sharper: 'You are lighter, faster and still standing in April.',
        backfired: 'You spend three months feeling weak and it shows.',
        unchanged: 'Nothing changes.',
      },
    },
    mysterious_substance: {
      title: 'The team doctor offers you a supplement',
      body: 'The club doctor offers you something that is \'within the rules\'. He does not write it down.',
      options: { take: 'Take it', refuse: 'Refuse' },
      why: {
        caught: 'there is a test, and it does not care what he wrote down',
      },
      results: {
        flying: 'You feel superhuman for a year, and nobody ever asks.',
        caught: 'The sample comes back positive. Everything stops.',
        clean: 'You pass. You always pass.',
      },
    },
    season_load: {
      title: 'The season\'s workload is catching up with you',
      body: 'The staff want to know how hard to run you this season.',
      options: { push: 'Push hard all season', ease_off: 'Manage my workload' },
      why: {
        broke_down: 'sixty games is more than a body ever promised',
      },
      results: {
        held_up: 'Your body holds. You play every week.',
        /* Says what the card does: a rung down and a fragile body, not a
           season deleted. It used to read "the season is gone", which the
           career table then contradicted with a full set of appearances. */
        broke_down: 'Something goes in February. You are back inside a month, behind the man who took your place, and never far from the physio after it.',
        managed: 'They hold you back and you play less for it. You also finish the season fit, and better for the work you did do.',
      },
    },
    double_session: {
      title: 'The manager wants double sessions',
      body: 'Two a day, every day, all season. Some bodies survive it.',
      options: { push: 'Do the double sessions', ease_off: 'One session is enough' },
      why: {
        broke_down: 'two a day is a load, and a load finds the weak link',
      },
      results: {
        held_up: 'You are the fittest player at the club by Christmas, and the manager picks the fittest player.',
        broke_down: 'Your body gives out under the load. You lose your place, and you are never far from the physio again.',
        managed: 'One session a day, fewer minutes on a Saturday, and a body that lasts the year.',
      },
    },
    position_switch: {
      title: 'The manager wants to move you to a new position',
      body: 'The manager has a hole in the side and thinks you can fill it. It is not your position.',
      options: { accept: 'Take the new role', refuse: 'Refuse' },
      why: {
        switch_failed: 'it is a new position, and some players never look like they belong in it',
        refused: 'a manager remembers who told him no',
      },
      results: {
        switched: 'It is awkward for a year. Then it is just where you play.',
        switch_failed: 'You never looked like a player who belonged there, and you had already given up the shirt you did.',
        refused: 'He does not ask twice, and he does not forget.',
      },
    },
    position_competition: {
      title: 'Someone for your shirt',
      body: 'They have signed a direct rival for your place, on better money than you.',
      options: { compete: 'Fight for the shirt', leave: 'Look for a move' },
      why: {
        lost_place: 'the club paid for him because he is good',
      },
      results: {
        held_off: 'He spends the whole season watching you play.',
        lost_place: 'He is better. It happens.',
        moved_on: 'You take the door that was open.',
      },
    },
    rival_prospect: {
      title: 'The academy kid is good',
      body: 'A young player has come up to take your shirt — and he is better than you were at his age.',
      options: { mentor: 'Take him under your wing', leave: 'Ask for a move' },
      results: {
        mentored: 'You give up the shirt and the team gets better. Everybody sees it.',
        moved_on: 'You leave the shirt to him and take a new one.',
      },
    },
    club_priority: {
      title: 'What the club chases this season',
      /* Only ever dealt to a club actually in Europe (see the event's gate), so
         the body names Europe the way the second option does — "the cup that
         pays the bills" left the reader guessing which cup was being traded. */
      body: 'The board asks what matters more this year: the league, or the European run that pays the bills.',
      options: { league: 'The league', continental: 'The European cup' },
      results: {
        league_first: 'Everything is aimed at the title.',
        cup_first: 'Everything is aimed at Europe.',
      },
    },
    finish_school: {
      title: 'Whether to finish school',
      body: 'You never finished. The classes are in the mornings, which is when training is.',
      options: { study: 'Go back and finish', focus_football: 'Football only' },
      why: {
        dropped_out: 'two half-jobs do not add up to one whole one',
      },
      results: {
        graduated: 'You finish it. You are steadier for it, and you missed some sessions.',
        dropped_out: 'You went to enough of them to miss the training and not enough of them to finish.',
        unchanged: 'The certificate can wait.',
      },
    },
    controversial_statement: {
      title: 'Your interview has become a media storm',
      body: 'You told a reporter exactly what you think of the manager. It is everywhere by lunchtime.',
      options: { apologise: 'Apologise publicly', leave: 'Ask to leave' },
      why: {
        apologised: 'a club that has to write your apology trusts you less',
      },
      results: {
        apologised: 'You read out the statement somebody else wrote, and the manager trusts you a little less for the rest of the season.',
        moved_on: 'You go somewhere the story cannot follow.',
      },
    },
    fan_backlash: {
      title: 'The fans seem unhappy with your recent form',
      body: 'Your name gets read out at home now and the answer is a whistle.',
      options: { stay: 'Win them back', leave: 'Ask to leave' },
      why: {
        endured: 'playing under a whistle every home game costs something',
      },
      results: {
        endured: 'You play through it. It costs you something that comes back later.',
        moved_on: 'You leave. The whistling stops the day you do.',
      },
    },
    tax_trouble: {
      title: 'The tax authorities',
      body: 'They want six years of records and they are briefing the newspapers while they wait.',
      options: { stay: 'Fight it in court', leave: 'Take an offer abroad' },
      why: {
        fought_it: 'a hearing takes the same months a season does',
      },
      results: {
        fought_it: 'Lawyers, hearings, and a season spent somewhere other than football.',
        left_country: 'You take the move. The problem stays behind you.',
      },
    },
    foreign_grandfather: {
      title: 'A grandfather from somewhere else',
      body: 'The paperwork checks out: you could declare for {newCountry} instead. Take it and the country you grew up in is closed to you for good.',
      options: { switch: 'Declare for {newCountry}', stay: 'Stay with {country}' },
      results: {
        switched: 'You file the papers. A different anthem, and a far shorter queue for a shirt.',
        stayed: 'You stay where you were born. Whether they ever call is their decision, not yours.',
      },
    },
    rival_offer: {
      title: 'Your biggest rivals have made an approach',
      body: '{club} are building something enormous and they want you in it. Your fans would never forgive you.',
      options: { join: 'Sign for {club}', stay: 'Stay and beat them' },
      results: {
        joined_rival: 'You cross the line. The abuse is loud; the squad around you is louder.',
        stayed_loyal: 'You stay. The stands sing your name for it.',
      },
    },
    saudi_approach: {
      title: 'The offer from the Gulf',
      body: 'They will treble your wages to play in a league nobody you respect will watch.',
      options: { take_it: 'Take the money', refuse: 'Stay competitive' },
      results: {
        took_it:
          'You sign. The number is unreal, and so is the football — a weak league, a fading value, and trophies worth a fraction of the ones you left behind.',
        stayed_competitive: 'You turn it down. Your accountant does not understand.',
      },
    },
    triumphant_return: {
      title: 'Where it all began',
      body: '{club} want you back to finish the story where it started.',
      options: { return: 'Go back to {club}', decline: 'Keep going where you are' },
      results: {
        came_home: 'The banner over the away end says WELCOME HOME.',
        stayed_put: 'Not yet. The story stays unfinished.',
      },
    },
    national_team_conflict: {
      title: 'Club versus country',
      body: 'Your country wants you for the {tournament}. Your club says the flight is not happening.',
      options: { go: 'Join up anyway', obey: 'Stay with the club' },
      results: {
        went_anyway: 'You go to the {tournament} and play for your country, and the manager leaves you on the bench when you get back.',
        obeyed: 'You stay at your club, and somebody else wears your number in the summer.',
      },
    },
    decisive_penalty: {
      title: 'The decisive penalty',
      body: 'The final whistle is coming, and this kick decides it: {trophy}. The ball is under your arm. Pick a corner and do not change your mind.',
      options: { left: 'Low to the left', right: 'High to the right' },
      why: {
        saved: 'keepers guess too, and sometimes they guess with you',
      },
      results: {
        scored: 'The net ripples. The bench empties. That picture hangs in bars for twenty years.',
        saved: 'He guessed with you. The walk back to the halfway line takes a lifetime.',
      },
    },
    decisive_save: {
      title: 'One penalty to stop',
      body: 'Save this and it is yours: {trophy}. The taker has not looked at you once.',
      options: { left: 'Dive left', right: 'Dive right' },
      why: {
        beaten: 'you have to pick a side before he strikes it',
      },
      results: {
        saved_it: 'You are horizontal and the ball is in your glove. The rest is confetti.',
        beaten: 'You picked right. The ball went left. The tunnel is very quiet.',
      },
    },
    injury_at_peak: {
      title: 'An injury at the worst possible moment',
      body: 'The scan is not clean and the physio will not look at you. Weeks away: {trophy}.',
      options: { play: 'Strap it and play', rest: 'Sit out the run-in' },
      why: {
        broke_down: 'a body at its limit gives no warning',
        lost_without: 'the team still has to win it without you',
      },
      results: {
        limped_over: 'On one good leg you drag them over the line.',
        broke_down: 'It goes in the warm-up. You watch from a treatment table.',
        won_without: 'They finish it without you. The medal feels light.',
        lost_without: 'From the stands you watch it slip away.',
      },
    },
    play_through_injury: {
      title: 'You are not quite over the injury',
      body: 'The scan is not clean, there are four games left in the run-in, and the manager is asking. Playing on it can cost you more than the season.',
      options: { play: 'Play anyway', recover: 'Take the time' },
      why: {
        made_it_worse: 'an injury played through is an injury made worse',
      },
      results: {
        got_away: 'You get away with it, you drag them through the run-in, and you know you got away with it.',
        made_it_worse: 'You make it much worse. Months, not weeks — and it leaves something behind.',
        recovered: 'You come back properly, and later than you wanted.',
      },
    },
    frozen_out: {
      title: 'You are out of the manager\'s plans',
      body: 'You have not been in a matchday squad since September and nobody has explained why.',
      options: { wait: 'Wait for your chance', leave: 'Force a move' },
      why: {
        still_out: 'waiting does not change a manager\'s mind',
      },
      results: {
        won_him_over: 'An injury opens the door and you kick it in.',
        still_out: 'Another year of training alone on a Saturday.',
        moved_on: 'You go somewhere that actually wants you.',
      },
    },

    /* ---- added with the deck expansion ------------------------------ */
    agent_change: {
      title: 'A bigger agency wants to represent you',
      body: 'They have three internationals on their books and a number they say they can get you. Your current agent has been there since you were fifteen.',
      options: { switch: 'Sign with them', stay_loyal: 'Stay where you are' },
      cost: 'Agency fee {cash}',
      why: {
        paid_for_nothing: 'a bigger agency has bigger names to call first',
      },
      results: {
        better_deals: 'The next contract came in well above what you were on. He earned his cut.',
        paid_for_nothing: 'The calls stopped after the signing dinner. You paid for the dinner.',
        kept_him: 'He drove you to trials when nobody else would. That still counts.',
      },
    },
    captain_armband: {
      title: 'The manager wants you to captain the side',
      body: 'It is not a ceremonial job here. It means fronting up after the bad ones, and there will be bad ones.',
      options: { take_it: 'Take the armband', decline_armband: 'Not for you' },
      why: {
        weight_of_it: 'the armband is everyone else\'s problems as well as your own',
      },
      results: {
        led_them: 'You were the last one off the pitch all season, win or lose. The dressing room noticed.',
        weight_of_it: 'Some of it came home with you. Your own game suffered for a while.',
        just_play: 'Somebody else does the interviews. You just play.',
      },
    },
    new_manager_meeting: {
      title: 'The new manager is seeing players one by one',
      body: 'Fifteen minutes each. Whatever he makes of you in that room is roughly what your season looks like.',
      options: { make_the_case: 'Tell him you should start', let_work_talk: 'Let the work talk' },
      why: {
        marked_card: 'a new manager does not enjoy being told his own team',
      },
      results: {
        convinced_him: 'He took the point. You were in the side by the third game and the place was yours.',
        marked_card: 'He does not like being told what his team needs, and you get less of the ball for it.',
        kept_head_down: 'You said nothing and put it into training instead. He gives you nothing straight away, but the work stays with you.',
      },
    },
    winter_break: {
      title: 'Two weeks off in the middle of the season',
      body: 'The rest of the squad is on a beach. The gym is open and nobody is checking.',
      options: { train_through: 'Train through it', switch_off: 'Switch off properly' },
      why: {
        came_back_flat: 'the break exists because the body needs it',
      },
      results: {
        came_back_sharp: 'You came back sharper than anyone. The second half of the season was your best football.',
        came_back_flat: 'You never really stopped, and it showed by March.',
        rested: 'You did nothing for two weeks and came back fresh. That is what the break is for.',
      },
    },
    january_window_itch: {
      title: 'You have not started since October',
      body: 'The window is open for another fortnight. Your agent says there is interest, and the manager has not said a word to you in a month.',
      options: { ask_to_leave: 'Ask to leave', fight_for_it: 'Stay and fight for it' },
      why: {
        still_out_of_it: 'training well and being picked are two different things',
      },
      results: {
        got_out: 'You went somewhere that wanted you. Sometimes that is the whole answer.',
        won_place_back: 'An injury opened the door and you kicked it off its hinges. You did not come out of the side again.',
        still_out_of_it: 'You trained brilliantly for six months and it changed nothing.',
      },
    },
    boot_deal: {
      title: 'A boot company wants an exclusive',
      body: 'Serious money to wear theirs and only theirs. You have played in the same pair of a different make since you were sixteen.',
      options: { sign_big: 'Take the deal', keep_own_boots: 'Keep your own boots' },
      income: '{cash} from the deal',
      why: {
        boots_hurt: 'they never fit, and you go back to your old pair',
      },
      results: {
        money_landed: 'The money landed and the boots were fine. Easiest decision you ever made.',
        boots_hurt: 'They never fit. You were back in your old pair by Christmas, and the deal went with them.',
        same_boots: 'Same boots, same studs, same everything. Some players are like that.',
      },
    },
    set_piece_duty: {
      title: 'Nobody has claimed the free kicks',
      body: 'The man who took them left in the summer. In training you are as good as anyone at them.',
      options: { take_them: 'Take them', leave_them: 'Leave them to somebody else' },
      why: {
        wasted_them: 'a free kick missed in front of a full ground stays with you',
      },
      results: {
        they_go_in: 'Three went in before Christmas. They are yours now, and so is the wall of highlights.',
        wasted_them: 'Four into the wall in a month, and the crowd groaned before you struck them. You are still thinking about it next season, and it shows.',
        someone_else_takes: 'Somebody else took them and you got on with your own game, no better and no worse for it.',
      },
    },
    language_lessons: {
      title: 'You still order coffee by pointing',
      body: 'The club has offered lessons three mornings a week. Most of the foreign lads never bother.',
      options: { learn_it: 'Learn the language', use_translator: 'Stick with the translator' },
      why: {
        never_got_there: 'three mornings a week is not always enough to get there',
      },
      results: {
        dressing_room_opened: 'By spring you were taking the jokes as well as the passes. It is a different club when you understand it.',
        never_got_there: 'You gave up the evenings and never got past the pleasantries, so you lost the hours and gained nothing.',
        through_a_translator: 'Everything important reached you through somebody else, and the evenings you would have spent on grammar went into the gym instead.',
      },
    },
    sports_science: {
      title: 'The lab wants to rebuild how you train',
      body: 'Sleep, load, diet, all of it measured, all of it paid for by you. The older players who did it are still playing.',
      options: { buy_in: 'Pay for the programme', trust_the_body: 'Trust the body you have' },
      cost: '{cash} for the programme',
      why: {
        body_ignored_it: 'numbers describe a body, they do not change one',
      },
      results: {
        body_holds: 'You felt the difference the following season, and the one after that.',
        body_ignored_it: 'You paid for a year of numbers, and your body carried on doing exactly what it was going to do anyway.',
        always_managed: 'You have managed this long on instinct. It has not let you down yet.',
      },
    },
    youth_rival_signed: {
      title: 'They have signed a nineteen-year-old in your position',
      body: 'He cost real money and the manager keeps using the word "future" in press conferences.',
      options: { raise_your_game: 'See him off', ask_the_question: 'Ask what your future is' },
      why: {
        kid_won: 'a club does not sign a boy it does not rate',
      },
      results: {
        saw_off_the_kid: 'You had the best season of your career and he did not get near the side.',
        kid_won: 'He was better. That is the part nobody prepares you for.',
        moved_for_minutes: 'You went somewhere the shirt was not already spoken for.',
      },
    },
    testimonial: {
      title: 'The club wants to give you a testimonial',
      body: 'A full house, an old opponent brought back for the night, and the gate money.',
      options: { have_it: 'Take the night', give_it_away: 'Give the gate to the academy' },
      income: '{cash} from the gate',
      why: {
        half_empty: 'a testimonial only fills if the city turns up',
      },
      results: {
        full_house: 'They filled it. Your name went round that ground for ninety minutes.',
        half_empty: 'A wet Tuesday and half a ground. The cheque was small and the message was smaller.',
        gave_the_gate: 'Every penny went to the academy that made you, and the club has treated you as one of its own ever since.',
      },
    },
    referee_row: {
      title: 'The referee has just cost you the game',
      body: 'The cameras are twenty metres away and still rolling, and you have plenty to say.',
      options: { say_it: 'Say it', walk_away: 'Walk down the tunnel' },
      why: {
        banned_for_it: 'the cameras were still rolling, and so was the panel',
      },
      results: {
        squad_backed_you: 'The dressing room loved you for it. The panel was less impressed but let it go.',
        banned_for_it: 'Three matches, and you watch every one of them. The clip is still played every time you are mentioned.',
        said_nothing: 'You walked. The story died by Tuesday.',
      },
    },
    position_switch_offer: {
      title: 'The coach thinks you should drop deeper',
      body: 'You have lost half a yard and he has noticed. He also says there are five good years in the new role.',
      options: { drop_deeper: 'Learn the new position', stay_where_you_are: 'Stay where you are' },
      why: {
        never_took: 'you give up the position you were good at first',
      },
      results: {
        new_position: 'It took a winter to learn and it bought you years.',
        never_took: 'You never really learned it. You gave up the position you were good at and did not replace it.',
        kept_the_shirt: 'You are what you are. You kept the shirt you always wore.',
      },
    },
    transfer_request_leak: {
      title: 'A paper says you have asked to leave',
      body: 'You have not. Somebody has briefed it anyway, and by lunchtime it is on every feed.',
      options: { deny_it: 'Deny it publicly', let_it_stand: 'Say nothing and let it stand' },
      why: {
        nobody_believed_you: 'a denial only works when the story is not true',
      },
      results: {
        crowd_believed_you: 'You said it straight to camera, the ground believed you and the manager backed you publicly. You play more of the football that follows.',
        nobody_believed_you: 'Nobody believed the denial and your own end started to turn. You play next season under a whistle at home, and your form suffers for it.',
        door_opened: 'You did not deny it, which everybody read as agreeing with it. You are up for sale in the next window — and whoever buys you will pay you properly.',
      },
    },
    charity_match: {
      title: 'An old team-mate is organising a charity game',
      body: 'A summer afternoon, a full ground, and a pitch nobody has watered since May.',
      options: { play_it: 'Play in it', send_a_cheque: 'Send money instead' },
      cost: '{cash} to the cause',
      why: {
        went_over_on_it: 'a pitch nobody has watered since May is still a pitch',
      },
      results: {
        good_afternoon: 'Good afternoon, good cause, and a photograph you actually kept.',
        went_over_on_it: 'You went over on the ankle in the second half of a game that did not count.',
        /* He *chose* to send money — "you could not make it" told a player who
           had just pressed exactly that button that his diary decided for him. */
        wrote_the_cheque: 'You skipped it and sent the cheque instead. It was bigger than the gate would have taken.',
      },
    },
    contract_leak: {
      title: 'Your wages are in the paper',
      body: 'The exact figure, to the pound, next to what a season ticket costs. The phone-ins have been at it all week.',
      options: { front_it_out: 'Front it out', take_a_cut: 'Offer to take less' },
      why: {
        never_lived_it_down: 'away ends read the number and do not forget it',
      },
      results: {
        blew_over: 'A week later they were angry about something else.',
        never_lived_it_down: 'It followed you round every away ground for a season.',
        bought_goodwill: 'You took a cut nobody asked for. The supporters heard about it, and so did the manager.',
      },
    },
    europa_thursday: {
      title: 'Thursday night, Sunday afternoon',
      body: 'A European run and a league campaign at once. The squad is not big enough for both and the manager is asking what you want to play.',
      options: { play_both: 'Play everything', save_yourself: 'Save yourself for the league' },
      why: {
        legs_went: 'Thursday and Sunday is two seasons in one pair of legs',
      },
      results: {
        ran_it_all: 'You played every minute of both. Europe went further than anyone expected.',
        legs_went: 'By March your legs had gone and the league table showed it.',
        picked_the_league: 'You were fresh on Sundays. Europe was somebody else\u2019s adventure.',
      },
    },
    coaching_badges: {
      title: 'A coaching course starts in the summer',
      body: 'Two weeks of classrooms while everyone else is away, and half the dressing room reads it as a man planning his retirement.',
      options: { start_them: 'Start the badges', not_yet: 'Not while you are still playing' },
      cost: '{cash} for the course',
      why: {
        classroom_only: 'a June in a classroom is a summer you do not get back',
      },
      results: {
        reading_the_game: 'You started seeing the shape of games before they happened. It made you a better player, never mind afterwards.',
        classroom_only: 'You sat the badges and learned nothing you could use on a Saturday, and it was a summer you do not get back.',
        still_playing: 'There is time for all that. You are still a footballer.',
      },
    },
  },
} as const;

export type Dictionary = typeof en;
