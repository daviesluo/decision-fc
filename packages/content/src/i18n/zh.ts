import type { Dictionary } from './en.js';

/** Same shape as the English dictionary, with plain strings in the leaves. */
type Localised<T> = { [K in keyof T]: T[K] extends string ? string : Localised<T[K]> };

/**
 * 简体中文文案。
 *
 * 这不是英文的翻译，是中文的重写。同一张卡片，中文用解说和体育版的语气写，
 * 短句、动词在前、不留翻译腔。手机上三秒之内要读完一张决策卡。
 */
export const zh: Localised<Dictionary> = {
  app: {
    title: '足球生涯',
    tagline: '二十年一段生涯，每个选择都会回来找你。',
  },

  intro: {
    title: '打造你的足球生涯',
    subtitle: '选好你从哪来，做出选择，然后承担它。',
    itchHome: '世界排行榜和每日挑战都在 decisionfc.com',
    start: '开启生涯',
    pace: '节奏',
    paceQuick: '快速',
    paceQuickCards: '每两个赛季一张卡',
    paceQuickShort: '约 4 分钟',
    paceStandard: '标准',
    paceStandardCards: '每赛季一张卡',
    paceStandardShort: '约 6 分钟',
    paceDeep: '沉浸',
    paceDeepCards: '每赛季两张卡',
    paceDeepShort: '约 11 分钟',
    paceQuickDesc: '中间的赛季自动推进，你只做真正改变生涯走向的决定。',
    paceStandardDesc: '足够你掌舵，又不用把每一周都过一遍。',
    paceDeepDesc: '伤病、德比、更衣室里的那些周都由你亲手来选，而不是在赛季报告里读到。',
    paceNote: '节奏决定你亲手打多少，不决定难度，抉择卡越少每一张的分量越重。',

    daily: '每日挑战',
    dailyToday: '今天的生涯',
    dailyDone: '今天已挑战',
    daily_world: '今天全世界面对同一片足球世界：同样的青训报价、同样顺序的同样卡片、同样的球队来敲门。',
    daily_pace: '所有人都用标准节奏，成绩才可比。',
    daily_you: '把自己练成什么样的球员、每一步怎么选，还是你自己的事。',
    boards: '三个世界排名',
    boardsHint: '每段生涯是怎么计分的',
    boardsTitle: '三个世界排名',
    boards_legacy: '冠军、个人荣誉、进球和巅峰赛季，按你所处的联赛水平加权。',
    boards_wealth: '你这辈子拿到手的每一分钱，合同给的和卡片给的都算。',
    boards_value: '你达到过的最高身价，算的是那个赛季的你。',
    boardsTension: '三个榜是故意互相拉扯的：把合同耗到底工资最划算、转会费最难看，海湾给的钱远超你实际的身价，而退役之前你不会再看到它们。',
    howto: '玩法',
    howtoHint: '七件值得先知道的事',
    howtoTitle: '玩法',
    howto_play_title: '你打的是一整段生涯，从十六岁到退役。',
    howto_play: '几分钟一局，开局你选自己从哪来、是什么类型的球员，剩下的全靠你一路上做的选择。',
    howto_cards_title: '所有事情都发生在卡片上。',
    howto_cards: '一张卡给你一个处境和两到三个选项，每个选项下面写着它会带来什么，选一个生涯就往前走一段。',
    howto_seasons_title: '赛季是自动踢完的。',
    howto_seasons: '两张卡之间的比赛由系统模拟，出场、进球、奖杯、伤病都在那里发生，你掌的是方向，不排首发阵容。',
    howto_odds_title: '那些百分比是真的。',
    howto_odds: '选项上写的数字，就是游戏真正去掷的数字，没有对你有利或不利的暗改。',
    howto_ability_title: '能力值决定你能站在哪。',
    howto_ability: '就一个数，二十几岁一路成长、再往后开始下滑，它决定你在球队里最高能坐到哪个位置，而上个赛季踢得怎么样决定了夏天谁会来找你。',
    howto_tactics_title: '每个主教练都有自己的打法。',
    howto_tactics: '俱乐部名字下面写的打法，就是主教练要的球员：高位逼抢要体能和速度，传控要会传球的，防守反击要速度和射门，铁桶阵要防守和身体，边路传中要能带球突破的快马，自由发挥则看你最强的那一项；去一支打法用得上你长处的球队，你会踢得更多、成长更快，打法不对，更好的球员也可能坐板凳——卡片不会告诉你哪家适合，这得你自己判断。',
    howto_ending_title: '结局是打出来的，不是抽出来的。',
    howto_ending: '一共二十五个，由你真正走过的这段生涯决定，满足条件的里面最稀有的那个才是你的。',
    news: '更新了什么',
    newsHint: '你上次来之后',
    newsTitle: '更新了什么',
    news_fit: '玩法说明里现在讲清楚了每种打法要什么样的球员；一家俱乐部适不适合你，报价卡不再替你判断，由你自己来看。',
    news_minutes: '坐板凳从此要付代价：没有出场时间的赛季会拖慢你在任何年龄的成长，签给一支不会让你上场的球队不再是白拿一枚队徽。',
    news_daily: '每日挑战有榜了——今天所有人拿到的是同一个世界，总结页会告诉你在其中排第几。',
    news_offline: '只要打开过一次，之后没有网络也能进游戏。',
    boardsGot: '知道了',
  },

  ads: {
    label: '广告',
    countdown: '{seconds} 秒',
    skip: '跳过，再来一把',
    skipIn: '{seconds} 秒后可跳过',
    holdOn: '正在准备你的下一段生涯',
    why: '再来一把之前的广告是这个游戏免费的原因，每天第一次重开没有广告，进行中的生涯也永远不会被打断。',
  },

  identity: {
    back: '返回',
    title: '你是谁？',
    subtitle: '十六岁，一切都还没定。',
    lastName: '名字',
    lastNamePlaceholder: '输入名字',
    number: '球衣号码',
    foot: '惯用脚',
    left: '左脚',
    right: '右脚',
    nationality: '国籍',
    searchCountry: '搜索国家',
    position: '位置',
    archetype: '球员类型',
    confirm: '签下第一份合同',
    randomise: '随便给我一个',
  },

  career: {
    record: '生涯履历',
    honours: '荣誉',
    honoursEmpty: '奖杯柜还是空的。',
    age: '年龄',
    overall: '能力',
    peakOverall: '巅峰能力',
    wage: '周薪',
    perWeek: '/周',
    club: '俱乐部',
    season: '赛季',
    contract: '合同',
    contractYears: '还剩 {years} 年',
    contractFinal: '本季到期',
    contractLength: '{years}年合同',
    freeAgent: '自由身',
    cash: '资产',
    academyRating: '青训',
    marketValue: '身价',
    apps: '首发(替补)',
    cols: {
      goals: '进球',
      assists: '助攻',
      cleanSheets: '零封',
      tackles: '抢断',
      interceptions: '拦截',
      saves: '扑救',
    },
    rating: '评分',
    trophies: '冠军',
    /* 只出现在生涯表的国家队行里，行首已有国旗和国家名，列宽 30px——
       「国家队出场」五个字在那里放不下，也不需要。 */
    caps: '国家队',
    onLoan: '租借中',
    choosing: '抉择中…',
    injured: '伤停 {weeks} 周',
    relegated: '降级',
    promoted: '升级',
    suspended: '禁赛',
    noTrophies: '奖杯柜还空着',
  },

  standings: {
    title: '争冠',
    european: '欧战区',
    // A top club outside Europe qualifies for its own confederation's
    // competition, not a European one — so a Chinese or Saudi side reads
    // "洲际区", never "欧战区".
    continental: '洲际区',
    promotion: '争升级',
    playoff: '升级附加赛区',
    midtable: '中游',
    survival: '保级',
  },

  leagues: {
    eng: { 1: '英超', 2: '英冠' },
    esp: { 1: '西甲', 2: '西乙' },
    ita: { 1: '意甲', 2: '意乙' },
    ger: { 1: '德甲', 2: '德乙' },
    fra: { 1: '法甲', 2: '法乙' },
    por: { 1: '葡超' },
    ned: { 1: '荷甲' },
    bel: { 1: '比甲' },
    ksa: { 1: '沙特联' },
    jpn: { 1: '日职联' },
    usa: { 1: '美职联' },
    chn: { 1: '中超' },
  },

  effects: {
    ovr_up: '能力 +{value}',
    ovr_down: '能力 −{value}',
    ovr_temp: '暂时能力 −{value}',
    ovr_back: '适应后能力 +{value}',
    role_up: '升为{role}',
    role_down: '可能降到{role}',
    role_same: '继续当{role}',
    minutes_up: '出场时间比原本多',
    minutes_down: '出场时间比原本少',
    minutes_up_after: '之后出场时间比原本多',
    minutes_down_after: '之后出场时间比原本少',
    transfer: '你会换俱乐部',
    suspended: '禁赛——报废一个赛季，整年无薪',
    new_position: '改踢新位置',
    form_up: '球队战绩会提升',
    form_down: '球队战绩会下滑',
    odds_up_named: '{competition}成绩变好',
    odds_down_named: '{competition}成绩变差',
    trophy_won: '这个冠军拿下',
    trophy_lost: '这个冠军丢掉',
    call_up: '你能打这届大赛',
    no_call_up: '你缺席这届大赛',
    must_move: '下个转会窗必须走人',
    cash_up: '进账 {cash}',
    cash_down: '花掉 {cash}',
    wage_up: '周薪涨 {value}%',
    wage_down: '周薪降 {value}%',
    growth_up: '这个赛季成长更快',
    growth_down: '这个赛季成长更慢',
    decline_slower: '这个赛季状态下滑得更慢',
    decline_faster: '这个赛季状态下滑得更快',
    injury_risk_up: '受伤风险变高',
    injury_risk_down: '受伤风险变低',
    switch_nation: '从此为他们踢球，不能再改回去',
    doping_ban: '你的档案上永远留下一次禁药处罚',
  },

  competitions: {
    league: '联赛',
    cup: '杯赛',
    continental: '欧战',
  },

  rolesInline: {
    star: '球星',
    important: '重要球员',
    regular: '常规首发',
    squad: '轮换球员',
    impact_sub: '替补奇兵',
    fringe: '边缘球员',
  },

  months: {
    aug: '8月',
    sep: '9月',
    oct: '10月',
    nov: '11月',
    dec: '12月',
    jan: '1月',
    feb: '2月',
    mar: '3月',
    apr: '4月',
    may: '5月',
  },

  stats: {
    appearances: '出场',
    goals: '进球',
    assists: '助攻',
    cleanSheets: '零封',
    saves: '扑救',
    goalsConceded: '失球',
    tackles: '抢断',
    interceptions: '拦截',
    aerialsWon: '争顶',
    keyPasses: '关键传球',
    passAccuracy: '传球成功率',
    dribblesCompleted: '过人',
  },

  roles: {
    star: '球星',
    important: '重要球员',
    regular: '常规首发',
    squad: '轮换球员',
    impact_sub: '替补奇兵',
    fringe: '边缘球员',
  },

  positions: {
    GK: '门将', CB: '中卫', LB: '左后卫', RB: '右后卫',
    CDM: '后腰', CM: '中场', CAM: '前腰', LM: '左前卫', RM: '右前卫',
    LW: '左边锋', RW: '右边锋', ST: '中锋',
  },

  /* The Chinese name already reads plainly, so the second line carries the
     abbreviation instead — the form every Chinese broadcast puts on screen. */
  positionNames: {
    GK: 'GK', CB: 'CB', LB: 'LB', RB: 'RB',
    CDM: 'CDM', CM: 'CM', CAM: 'CAM', LM: 'LM', RM: 'RM',
    LW: 'LW', RW: 'RW', ST: 'ST',
  },

  archetypes: {
    pace: {
      name: '速度型',
      pro: '早早就领先同龄人，打反击最致命',
      con: '最早开始下滑，也是三种里最容易受伤的',
    },
    technical: {
      name: '技术型',
      pro: '大器晚成，为传控体系而生',
      con: '起步最慢，最好的几年在最后',
    },
    physical: {
      name: '身体型',
      pro: '几乎不受伤，也没有低谷，三者中最稳',
      con: '前期没爆发，后期没高峰；适合逼抢，不适合传控',
    },
  },

  attributes: {
    pace: '速度',
    shooting: '射门',
    passing: '传球',
    dribbling: '盘带',
    defending: '防守',
    physical: '身体',
  },

  attributesGk: {
    pace: '反应',
    shooting: '接扑',
    passing: '开球',
    dribbling: '指挥',
    defending: '站位',
    physical: '身体',
  },

  managerStyles: {
    gegenpress: '高位逼抢',
    possession: '传控',
    counter: '防守反击',
    low_block: '铁桶阵',
    wing_play: '边路传中',
    free_role: '自由发挥',
  },

  trophies: {
    league: '联赛冠军',
    domestic_cup: '国内杯赛',
    continental_elite: '欧冠',
    continental_secondary: '欧联杯',
    club_world_cup: '世俱杯',
    continental_nations: '欧洲杯',
    world_cup: '世界杯',
  },

  cups: {
    eng: '足总杯', esp: '国王杯', ita: '意大利杯', ger: '德国杯',
    fra: '法国杯', por: '葡萄牙杯', ned: '荷兰杯',
    bel: '比利时杯', ksa: '国王杯（沙特）', jpn: '天皇杯',
    usa: '美国公开杯', chn: '足协杯',
  },
  continentalCups: {
    UEFA: { elite: '欧冠', secondary: '欧联杯' },
    AFC: { elite: '亚冠精英联赛', secondary: '亚冠二级联赛' },
    CONCACAF: { elite: '中北美冠军杯', secondary: '中美洲杯' },
    CONMEBOL: { elite: '南美解放者杯', secondary: '南美杯' },
    CAF: { elite: '非洲冠军联赛', secondary: '非洲联盟杯' },
    OFC: { elite: '大洋洲冠军联赛', secondary: '大洋洲冠军联赛' },
  },
  nationsCups: {
    UEFA: '欧洲杯',
    AFC: '亚洲杯',
    CONCACAF: '中北美金杯',
    CONMEBOL: '美洲杯',
    CAF: '非洲杯',
    OFC: '大洋洲国家杯',
  },

  awards: {
    ballon_dor: '金球奖',
    golden_boot: '联赛金靴',
    golden_glove: '金手套',
    team_of_the_season: '联赛最佳阵容',
  },

  injuries: {
    hamstring: '腘绳肌撕裂',
    ankle_sprain: '脚踝扭伤',
    calf_tear: '小腿拉伤',
    meniscus: '半月板撕裂',
    metatarsal_fracture: '脚掌骨折',
    shoulder_dislocation: '肩关节脱位',
    disc_hernia: '腰椎间盘突出',
    acl: '前十字韧带断裂',
    tibia_fibula: '小腿骨折',
    achilles: '跟腱断裂',
  },


  headlines: {
    transfer_fee: 'Here we go！加盟{club}正式完成，转会费 {fee}。',
    transfer_free: 'Here we go！自由身加盟{club}已敲定，体检通过。',
    took_the_money: '他选了支票没选比赛，{club}签下的是一个镜头从此不再追的球员。',
    ballon_dor: '金球奖，没有第二个人接近过。',
    world_cup: '世界冠军，剩下的都是注脚。',
    continental: '{club}问鼎洲际之巅——而他就是原因。',
    league_title: '冠军！{club}把联赛拖过了终点线。',
    golden_boot: '{goals} 球，整个联赛没人靠近过他。',
    breakthrough: '这是从哪冒出来的？{club}手上可能是全联赛性价比最高的球员。',
    long_injury: '伤停 {weeks} 周，等于报废一个赛季，还留下一个关于生涯的问号。',
    injury: '{weeks} 周躺在治疗台上，节奏全断了。',
    relegated: '{club}降级了，周一就开始甩卖。',
    promoted: '升级！{club}回到了他们认为自己该在的位置。',
    in_form: '没人踢得比他更好，整个赛季 {rating} 分。',
    poor_form: '令人担忧的一年，{club}需要更多，但没等到。',
    frozen_out: '在{club}被彻底冷藏，从入秋起他连大名单都没进过。',
    evergreen: '{age} 岁还在首发，这样的人现在真不多了。',
    first_call_up: '首次入选国家队，他看上去像已经在这儿待了很多年。',
  },

  settings: {
    title: '设置',
    currency: '货币单位',
    language: '语言',
    currencyHint: '仅影响显示，薪资和转会费在引擎里都以欧元计算，排行榜比的也是欧元，换单位不会改变任何结果。',
    display: '显示',
    showOdds: '在选项上显示概率',
    showOddsHint: '显示的百分比就是真正掷的那个数。',
    quit: '放弃这段生涯',
    quitHint: '就此结束并回到开始界面，不会保存，也不会计入任何排行榜。',
    quitConfirm: '放弃',
    quitCancel: '继续踢',
    reducedMotion: '减少动效',
    reducedMotionHint: '关闭卡片与页面动画。',
    open: '设置',

    help: '攻略与说明',
    handbook: '进阶攻略',
    handbookHint: '怎么打出高分',
    handbookTitle: '进阶攻略',
    handbookLede:
      '「玩法说明」讲的是规则，这一页讲的是怎么赢——三个世界排行榜到底靠什么登顶，以及为什么你没法同时把三个都拿下。',
    hb_chase_title: '认准一个榜，别三个都要',
    hb_chase:
      '成就、财富、身价这三个榜天生互相拉扯——最赚钱的选择往往拿不到最多荣誉，也几乎不会是把身价顶到最高的那一步；早点想清楚你要打的是哪一种生涯，后面每一张卡都会好选很多。',
    hb_ability_title: '一切都从能力值来',
    hb_ability:
      '能力值是一个数字，二十多岁一路往上、之后慢慢往下；你的球队地位、收到的每一份报价、三个榜的成绩全都跟着它走——所以因伤或坐板凳白丢一个赛季，是这游戏里最贵的代价。',
    hb_minutes_title: '要上场，别坐着',
    hb_minutes:
      '在一个你站得稳的水平上稳定出场，成长比在豪门板凳上快得多；年轻时在一家好球队当主力，胜过在豪门只挂个名——等球场上的表现说你够格了，你随时能往上走。',
    hb_loan_title: '把租借当跳板',
    hb_loan:
      '一次租借就是一个赛季来证明自己：接下租约、每周首发、然后让母队抢着要你回去——年轻时这是最快的一条上升通道；为了留下来陪预备队训练而拒掉租借，等于白扔了那个本该成就你的赛季。',
    hb_offers_title: '看合同，别看队徽',
    hb_offers:
      '周薪、年限、解约金，比队徽更能决定一份报价的好坏；球队只有在你够得着他们的水平时才会来谈，所以一份报价其实是对你当前身价的判决——而冲着最响亮的队徽去坐板凳，会悄悄毁掉你最好的几年。',
    hb_tactics_title: '挑一个配得上你踢法的教练',
    hb_tactics:
      '每种战术都会重新加权你的属性：高位逼抢和防守反击吃速度和身体，传控吃传球，边路进攻吃盘带，铁桶阵吃防守，自由发挥则奖励你最突出的那一项——所以速度型在反击里如鱼得水、进了铁桶阵就憋死，技术型正好反过来；合不合拍最多能让实际发挥差出约 12%，足够把首发变成替补，一家战术合适的小俱乐部，常常比一家不合适的大俱乐部更能让你上场，也长得更快。',
    hb_reading_title: '看懂 offer 卡上的每一样东西',
    hb_reading:
      '每个球队选项的第一行依次是：联赛名、这家俱乐部在该联赛里的档次（争冠、欧战区、中游、保级，二级联赛则是冲超），以及五格绿色小条——那是俱乐部实力，代表你要挤进首发得越过的阵容质量；下一行是主教练的战术打法和许诺给你的出场时间定位，下方标签写着周薪、合同年限和签字费；事件卡选项旁的百分比就是游戏实际掷出的概率，可以在设置里显示或隐藏。',
    hb_legacy_title: '想当传奇：能站稳多高就冲多高',
    hb_legacy:
      '奖杯、进球和个人荣誉，都会按你拿下它们时所处的水平来加权——在欧洲豪门赢一座欧冠，胜过一抽屉次级联赛的奖牌；瞄准那家你真能在一线队站稳脚跟的最大俱乐部，然后在那里赢。',
    hb_value_title: '想刷身价：算准巅峰的时点',
    hb_value:
      '身价榜只留你最值钱的那一个赛季：你在巅峰年龄、大俱乐部、大联赛时最值钱——所以把转会安排在这三样同时凑齐、而且正好是你能力值最高的那个赛季。',
    hb_wealth_title: '想赚钱：要有耐心，也别小看中东',
    hb_wealth:
      '财富榜数的是你这辈子拿到手的每一分钱：把合同耗到期、以自由身离开，是最划算的薪资操作；三十二岁之后去沙特、美国或中国，报价也远高于你的实际身价——但这两条路都发生在你身价见顶之后，也都成就不了传奇。',

    about: '关于游戏',
    aboutHint: '这是什么',
    aboutTitle: '关于 Decision FC',
    aboutLede:
      'Decision FC（足球生涯）是一款完全用选择来玩的足球生涯模拟游戏——16 岁起步，大约五分钟走完二十个赛季。',
    ab_what_title: '五分钟，一整段生涯',
    ab_what:
      '选好你从哪来、是什么类型的球员，进青训，租借出去，再挑一次成就你、或者让你赚钱的转会——免费，打开网页就能玩，中英文双语，不用下载。',
    ab_how_title: '你掌舵，赛季自己踢',
    ab_how:
      '你不排兵布阵，也不亲自射门——你做的是一名球员生涯里那些关键的抉择，中间的比赛由这些抉择推演出来；同样的开局加同样的选择，永远得到同样的生涯，这也正是排行榜能核对、而不是盲信一段成绩的原因。',
    ab_world_title: '一个真实的足球世界',
    ab_world:
      '英西意德法及更多联赛，191 家真实俱乐部，配上相应的联赛、杯赛和欧战之夜，还有一个像模像样的转会市场——球队只签他们够得着的人，租借也只在欧洲体系内进行。',
    ab_free_title: '免费，而且打算一直免费',
    ab_free:
      '没有账号、不用登录、没有任何付费；靠再玩一局前的一个可跳过广告来维持免费——你每天第一次重玩没有广告，正在进行的生涯也绝不会被打断。',
    ab_made_title: '独立开发',
    ab_made:
      '这是一个独立项目，由一个人做出来，还在继续打磨；Bug、想法和问题都非常欢迎——来信 daviesluo@gmail.com。',

    faq: '常见问题',
    faqHint: '几句话说清楚',
    faqTitle: '常见问题',
    faq_free_q: '真的免费吗？',
    faq_free_a:
      '是的——靠再玩一局前的一个可跳过广告维持，你每天第一次重玩没有广告，正在进行的生涯也不会被打断，没有任何需要付费的东西。',
    faq_account_q: '需要注册账号吗？',
    faq_account_a: '不需要，也不用登录——你的进度、设置和语言都存在你自己的浏览器里；唯一会离开浏览器的，是你提交到排名的已完成生涯，以及一份匿名的每日游玩计数，隐私政策里写得清清楚楚。',
    faq_length_q: '一段生涯要玩多久？',
    faq_length_a: '几分钟——在开始界面选节奏，卡越少越快、每张卡的分量也越重，但节奏不影响难度。',
    faq_save_q: '关掉网页会丢进度吗？',
    faq_save_a: '不会——进行中的生涯存在你的设备上，重新打开就接着玩，只有清除浏览器存储才会删掉它。',
    faq_daily_q: '每日挑战对所有人都一样吗？',
    faq_daily_a:
      '一样——当天同一片足球世界、同样的卡、同样的顺序、同样的节奏，只有你捏的球员和你做的选择是你自己的。',
    faq_offers_q: '为什么大俱乐部不签我？',
    faq_offers_a:
      '报价跟你的能力值和上赛季的表现挂钩；远高于你水平的球队不会主动来找你——先把自己踢到够得着他们，他们自然会注意到你。',
    faq_currency_q: '换货币或语言会改变结果吗？',
    faq_currency_a: '不会，两者都只影响显示——游戏和排行榜都以欧元运算，切换永远不会改变实际发生的事。',
    faq_leaderboard_q: '世界排行榜怎么运作？',
    faq_leaderboard_a:
      '一段生涯结束后可以提交到三个榜，只上传游戏内数据——随机种子、你的选择、你输入的名字——所以请不要用真实个人信息当球员名字。',
    faq_feedback_q: '怎么反馈问题？',
    faq_feedback_a: '发邮件到 daviesluo@gmail.com——Bug、想法和问题都欢迎。',

    privacy: '隐私政策',
  },

  decisions: {
    academy: {
      title: '三家青训想要你',
      body: '现在还没人跟你谈钱，他们能给的是教练，和一支你也许某天能挤进去的一线队。',
      join: '加入{club}',
    },
    transfer: {
      title: '转会窗开了',
      body_wanted: '{club}想和你续约，别的报价也摆在桌上——看周薪、看年限、看解约金，别只看队徽。',
      body_stay: '{club}没提新合同，但你还在约里，可以就这么踢下去，别的报价也摆在桌上——看周薪、看年限、看解约金，别只看队徽。',
      body_unwanted: '{club}没有拿出续约合同，看看桌上还有什么——周薪、年限、解约金，别只看队徽。',
      free_title: '你的合同到期了',
      free_body_wanted: '你现在是自由身，{club}希望你留下来续约，而买家不用付转会费，省下的钱会变成你的签字费。',
      free_body_unwanted: '你现在是自由身，{club}没有拿出新合同，而买家不用付转会费，省下的钱会变成你的签字费。',
      join: '加盟{club}',
      stay: '与{club}续约',
      stay_on_deal: '留在{club}',
      stay_on_deal_hint: '现有合同继续履行',
      run_down: '把合同耗到底',
      run_down_hint: '让合同到期，明夏自由身离队——签字费会翻好几倍',
      retire: '就此挂靴',
      retire_hint: '在自己选的时间，体面告别',
      results: {
        joined: '你加盟了{club}。',
        stayed: '你在{club}签了字。',
        stayed_on_deal: '你留在{club}，继续履行原来的合同。',
        running_down: '不续约，明年夏天你自由离队。',
      },
    },
    manager_change: {
      title: '球队换帅了',
      body: '{club}把主教练换掉了，原来打的是{from}，新帅打的是{to}。',
    },
    spending: {
      title: '有一定积蓄了',
      body_a: '你生涯里第一笔像样的钱正躺在账户里，它该去哪？',
      body_b: '财务顾问又来了，让你给今年这笔钱定个去处。',
      training: '组建私人训练团队',
      training_up: '成长更快，受伤更少',
      lifestyle: '该享受了',
      lifestyle_up: '曝光度上升，代言费上涨',
      lifestyle_down: '更衣室有意见，成长因此变慢',
      cost: '每年从工资里扣 {cash}',
      save: '先存着',
      save_hint: '什么都不变——但余额一直在涨',
      results: {
        training: '你雇了自己的团队，周一开工。',
        lifestyle: '镜头开始跟着你走。',
        saved: '钱还在原地。',
      },
    },
    loan: {
      title: '你在这儿踢不上球',
      body_home: '青年队你已经够用了，一线队还差一口气——去附近踢一年，每周都上场。',
      body_development: '主教练认可你但不会派你上场，去次级联赛踢一年，换的是你在{club}拿不到的出场时间。',
      body_proving: '当初送你去涨球的级别你已经踢出来了，这几家都是顶级联赛的球队，而且每一家都会让你直接首发。',
      join: '租借到{club}',
      results: {
        joined: '你租借加盟{club}，周一开始季前训练。',
      },
    },
    loan_return: {
      title: '租借到期了',
      body_wanted: '这一年你踢出来了，{club}愿意你回归，把你算进计划里。',
      body_unwanted: '你仍不在{club}的计划中，得再找个能踢上的地方。',
      body_selling: '你仍不在{club}的计划中，他们打算趁合同到期前把你卖掉。',
      go_back: '回到{club}',
      go_back_renew: '回到{club}并签下新合同',
      sign_permanently: '正式加盟{club}',
      back_at_role: '以你现在的能力，回去是{role}',
      no_new_terms: '他们不打算续约，明夏你就是自由身',
      stay_playing: '守住你自己挣来的位置',
      results: {
        returned: '你按原来的合同回队报到，准备季前训练。',
        renewed: '你回队报到，并和{club}签下了新合同。',
        signed: '你正式加盟了{club}。',
      },
    },
  },

  retirement: {
    chose: '你自己决定了，是时候了。',
    age: '身体不答应了。',
    decline: '出场时间没了，报价也没了。',
    no_offers: '没人来电话，没有球队愿意给你合同。',
  },

  summary: {
    percentile: '前 {percent}%',
    unrankable: '这段生涯进行途中游戏更新过，因此无法参与全球排名，下一段可以。',
    share: '分享你的生涯',
    showName: '在卡片上显示姓氏',
    turningPoints: '转折点',
    turning: {
      academy: '一切开始的地方',
      academyBody: '你在{club}签下了第一份合同。',
      move: '改变一切的那次转会',
      moveBody: '你从{from}去了{club}，并在那里拿到了 {trophies} 座奖杯。',
      moveBodyNone: '你从{from}去了{club}，那是所有人给过你的最大一次跳板。',
      injury: '再也没好利索的那次伤',
      injuryBody: '这次伤你没能完全恢复，永久损失了 {cost} 点能力值。',
      peak: '你最好的赛季',
      peakBody: '在{club}整个赛季评分 {rating}，是你整段生涯的标杆。',
    },
    replay: '再来一次',
    seasonsPlayed: '{count} 个赛季',
    verdict: '生涯评语',
    bestSeason: '最佳赛季 · {club} · {age} 岁',
    avgRating: '场均评分',
    viewSummary: '查看总结',
    download: '保存图片',
    shareImage: '分享',
    copied: '已复制到剪贴板',
    rendering: '正在生成…',
    shareFailed: '分享没成功，可以试试保存图片。',
    boards: {
      legacy: '成就榜',
      wealth: '财富榜',
      value: '最高身价',
    },
    dailyBoard: {
      label: '今日挑战',
      standing: '第 {rank} / {total} 名',
      alone: '今天第一个完赛',
    },
    boardHints: {
      legacy: '所有冠军、个人荣誉、进球与巅峰赛季，按你所处的联赛水平加权，点开看完整算法。',
      wealth: '整个职业生涯的税前总收入。',
      value: '职业生涯身价的最高点——是巅峰值，不是最后一个赛季的身价。',
    },
    legacyKeys: {
      trophies: '冠军',
      awards: '个人荣誉',
      output: '进球与出场',
      peak: '巅峰能力',
      longevity: '巅峰年数',
      wealth: '财富',
      loyalty: '忠诚',
      penalties: '扣分',
    },
  },

  endings: {
    goat: { title: '历史第一人', body: '已经没什么可争的了，任何一份名单第一个名字都是你。' },
    ballon_dor_winner: { title: '金球先生', body: '至少有那么一年，地球上踢得最好的人是你。' },
    world_champion: { title: '世界冠军', body: '别的都可以争，这座奖杯不用争。' },
    continental_king: { title: '欧陆之王', body: '两座冠军杯，那些画面会一直放下去。' },
    oil_baron: { title: '淘金者', body: '你去了钱最多的地方，那笔钱确实惊人，至于历史怎么写，历史自有主张。' },
    one_club_legend: { title: '一人一城', body: '一件队徽从头到尾，球场有一个看台用你的名字命名。' },
    serial_winner: { title: '冠军收割机', body: '奖杯柜得再腾一间屋子，你不是家喻户晓，但圈里没人不知道你。' },
    late_bloomer: { title: '大器晚成', body: '二十二岁时没人看好你，三十岁时所有人都看见了。' },
    disgraced: { title: '污点生涯', body: '数字是真的，你拿到它的方式不是。' },
    glass_talent: { title: '伤病天才', body: '健康时你无解，问题出在这句话的前半段。' },
    nearly_man: { title: '无冕之王', body: '好球员，可惜每一次队不对，年份也不对。' },
    solid_pro: { title: '职业球员', body: '一段正经的生涯，老家的小孩还在穿你的号码。' },
    journeyman: { title: '流浪者', body: '八间更衣室，八条去训练场的路，柜子里什么都没有，但你靠这行养活了自己。' },
    continental_nomad: { title: '三国冠军', body: '三个联赛，三枚奖牌，三种语言的歌，这种事没人是碰巧碰上的。' },
    centurion: { title: '百场国脚', body: '一百场国家队，你的球衣挂在足协博物馆里，国歌响起时你还是会绷住。' },
    goal_machine: { title: '射手', body: '三百个进球，早就退役的后卫提起你用的还是同一句话。' },
    the_wall: { title: '城墙', body: '一整段生涯的零封，和无数个因为有你才显得平静的下午。' },
    cup_specialist: { title: '杯赛先生', body: '联赛冠军一次没有，杯赛决赛赢了三次，所有人记得的都是那几天。' },
    boy_wonder: { title: '天才少年', body: '二十岁那年你是所有人见过最好的二十岁球员，后面十年一直没能把这句话接下去。' },
    comeback: { title: '伤愈归来', body: '那次伤永久拿走了你一部分能力，你还是回来了，还是踢到了自己的巅峰。' },
    promotion_hero: { title: '升级功臣', body: '三次升级，三次冲进球场的人群，三批一辈子愿意请你喝一杯的球迷。' },
    globetrotter: { title: '环球球员', body: '五个国家，五套手续，五次在更衣室里从陌生人开始。' },
    homegrown: { title: '扎根本土', body: '报价年年都来，你年年都留下，你的联赛，你的国家，你的一整段生涯。' },
    frozen_out: { title: '没人来电话', body: '你还踢得动，电话就已经不响了，大多数人的生涯就是这么结束的。' },
    squad_player: { title: '轮换球员', body: '你走得比几乎所有做过这个梦的人都远，这不是小事。' },
  },

  events: {
    shared: {
      joinClub: '加盟{club}',
    },

    closed_door_friendly: {
      title: '一场封闭教学赛',
      body: '一场没有观众的周中教学赛，只有教练组在看，而周末的首发，就看这一场了。',
      options: { go_hard: '当正赛踢', coast: '走个过场' },
      why: {
        knock: '热身赛也是九十分钟，场地还硬',
      },
      results: {
        noticed: '空场上你是最好的那个，而决定首发的人从头看到尾。',
        knock: '还剩二十分钟，大腿那下你自己就知道不对了，而这只是一场教学赛。',
        coasted: '让做什么做什么，多一点没有，没人记得这场。',
      },
    },
    fifty_fifty: {
      title: '一次五五开的拼抢',
      body: '球停在你和对方后卫中间，他也不打算收脚。',
      options: { go_in: '顶上去', pull_out: '收脚' },
      why: {
        came_off: '他也一样不会收脚',
        pulled_out: '板凳上的人都看见你不敢上',
      },
      results: {
        won_it: '你干净地拿下来了，进攻没断，整个看台都知道了这一下。',
        came_off: '两个人都上去了，只有一个人很快站起来，不是你。',
        pulled_out: '你收脚了，替补席上每个人都看见了。',
      },
    },
    play_through_it: {
      title: '你带着伤在踢',
      body: '片子上还算能踢，但队医说得很清楚：带伤硬上，可能落下治不好的伤。',
      options: { play: '打封闭上', sit_out: '休一个月' },
      why: {
        made_it_worse: '片子说能踢，不等于说好了',
      },
      results: {
        held_up: '你带着伤踢完了赛季最后那段冲刺，最终扛住了。',
        made_it_worse: '下半场彻底伤了，三周变成三个月，有些东西再也没完全恢复。',
        sat_out: '你休到好才回来，而球队也学会了没有你怎么踢。',
      },
    },
    derby_week: {
      title: '德比周',
      body: '这场球在球迷心里和别的比赛不一样，到周日为止全城只聊这一件事。',
      options: { take_it_on: '主动要球', play_safe: '稳着踢' },
      why: {
        hid: '整场都在要球，丢球也就全算在你头上',
      },
      results: {
        owned_it: '你当着全城的面把这场球掐在了手里，这场球以后是要被唱进歌里的。',
        hid: '你要了一下午球，也丢了一下午球，德比里这是看台唯一不原谅的事。',
        anonymous: '你把本职做完就没有别的了，这场球从你身边过去了。',
      },
    },
    reserves_run: {
      title: '去预备队踢一个月',
      body: '教练给你安排 U21 的比赛找状态，从你原来的位置掉到这儿，落差不小。',
      options: { drop_down: '去踢', refuse_reserves: '不去，我是一队球员' },
      why: {
        nobody_watched: '定首发的那个人不会来看预备队',
        sulked: '拒绝会被记下来，而七月是照着那份记录定的',
      },
      results: {
        earned_it: '你在那个级别好得离谱——这正是重点，主教练也这么说了。',
        nobody_watched: '你在四十个人和一个场地工面前踢得不错，而一队那边没有你也照样转。',
        sulked: '你拒绝了，教练组把你记成了会拒绝的那种人，而一年只练不踢是不会成长的。',
      },
    },
    extra_training: {
      title: '教练组要你加练',
      body: '体能教练要你整个季前每天早上都到，会很难受。',
      options: { accept: '加练', rest: '保护身体' },
      why: {
        strained: '练得更利索的身体，也更容易出事',
      },
      results: {
        gained: '归队时你比谁都锋利。',
        strained: '练过了，最后一堂课就拉伤了。',
        rested: '你状态不错，仅此而已。',
      },
    },
    preseason_camp: {
      title: '季前高原拉练',
      body: '三周高原，不见家人，没有休息日，回来的人要么脱胎换骨要么废了。',
      options: { accept: '去', rest: '留队正常训练' },
      why: {
        strained: '不是每个人的身体都扛得住三周高原',
      },
      results: {
        gained: '你从山上下来时，已经是另一个球员。',
        strained: '身体始终没适应，整个季前报废。',
        rested: '一个普通的夏天，没得到也没失去。',
      },
    },
    personal_coach: {
      title: '有人给你介绍了私人技术教练',
      body: '他要把你的技术从头重建，这意味着先忘掉那些本来管用的东西。',
      options: { rework: '从头重建', reject: '保持原样' },
      why: {
        lost_it: '把本来会的拆掉，可能两头都不落',
      },
      results: {
        clicked: '十一月前后突然通了，而且再没丢过。',
        lost_it: '你在新旧两套技术之间卡了一整年，哪套都不属于你。',
        unchanged: '你留住了原来的东西。',
      },
    },
    nutrition_plan: {
      title: '俱乐部给你定了一套营养方案',
      body: '专家看完你的血检报告，要改掉你吃的每一样东西。',
      options: { accept: '照做', reject: '还是照原来那样吃' },
      why: {
        backfired: '换食谱先掉的，往往不是该掉的那部分',
      },
      results: {
        sharper: '你更轻、更快，四月份还站得住。',
        backfired: '你虚了三个月，场上看得出来。',
        unchanged: '什么都没变。',
      },
    },
    mysterious_substance: {
      title: '队医递来一支来历不明的补剂',
      body: '队医给你一样「不违规」的东西，而且没有写进病历。',
      options: { take: '吃下去', refuse: '拒绝' },
      why: {
        caught: '有药检，而药检不管他有没有写下来',
      },
      results: {
        flying: '你飞了一整年，而且从来没人问起。',
        caught: '样本呈阳性，一切都停了。',
        clean: '你过了，你每次都过。',
      },
    },
    season_load: {
      title: '赛季的负荷开始吃不消了',
      body: '教练组想知道这个赛季该怎么用你。',
      options: { push: '整季拼满', ease_off: '控制负荷' },
      why: {
        broke_down: '六十场球，身体从来没答应过',
      },
      results: {
        held_up: '整个赛季身体没出问题，你每一轮都首发。',
        broke_down: '二月里拉伤缺阵一个月，回来时位置已经是别人的，之后身体也一直不结实。',
        managed: '教练组控制着你的出场时间，你踢得比原本少，但这个赛季一场伤没有，练的东西也都练进去了。',
      },
    },
    double_session: {
      title: '教练要你一天两练',
      body: '整个赛季每天两练，有的身体扛得住。',
      options: { push: '两练照做', ease_off: '一天一练就够' },
      why: {
        broke_down: '一天两练是负荷，负荷会找最弱的那一环',
      },
      results: {
        held_up: '一个冬训下来，你成了全队体能最好的人，主教练也就这么用你。',
        broke_down: '身体扛不住这个量，位置丢了，之后也总在伤病边缘。',
        managed: '一天一练，周末踢得少了一些，但整年身体都撑得住。',
      },
    },
    position_switch: {
      title: '主教练想让你改打另一个位置',
      body: '阵容里缺个人，主教练觉得你能补，但那不是你的位置。',
      options: { accept: '接受新位置', refuse: '拒绝' },
      why: {
        switch_failed: '换的是个新位置，有些人一辈子都踢不像',
        refused: '主教练记得谁对他说过不',
      },
      results: {
        switched: '别扭了一年，然后它就成了你的位置。',
        switch_failed: '你在那个位置上始终不像那儿的人，而原来那件球衣你已经交出去了。',
        refused: '他不会问第二次，也不会忘记。',
      },
    },
    position_competition: {
      title: '有人是冲着你的位置来的',
      body: '他们签了一个和你直接竞争的人，薪水比你高。',
      options: { compete: '把位置守住', leave: '找机会走人' },
      why: {
        lost_place: '俱乐部花钱买他，是因为他确实好',
      },
      results: {
        held_off: '他在替补席上看了你一整个赛季。',
        lost_place: '他更强，这种事会发生。',
        moved_on: '门本来就开着，你走了出去。',
      },
    },
    rival_prospect: {
      title: '青训营那小子是真的强',
      body: '梯队上来一个年轻人，直奔你的位置——而且他这个年纪，比当年的你还强。',
      options: { mentor: '带他', leave: '申请转会' },
      results: {
        mentored: '你把位置让了，球队变强了，所有人都看在眼里。',
        moved_on: '你把号码留给他，自己去换一件新的。',
      },
    },
    club_priority: {
      title: '俱乐部这个赛季的重心放在哪',
      body: '董事会问你：今年更重要的是联赛，还是能带来收入的欧战。',
      options: { league: '联赛', continental: '欧战' },
      results: {
        league_first: '一切都为了联赛冠军。',
        cup_first: '一切都为了欧战。',
      },
    },
    finish_school: {
      title: '要不要把书念完',
      body: '你一直没念完，课都在上午，而上午是训练时间。',
      options: { study: '回去念完', focus_football: '只踢球' },
      why: {
        dropped_out: '两件事各做一半，加起来一件也没做成',
      },
      results: {
        graduated: '你念完了，人稳了一些，也缺了几堂训练课。',
        dropped_out: '课去得够多，训练缺了不少，学位却没拿到。',
        unchanged: '文凭可以再等等。',
      },
    },
    controversial_statement: {
      title: '你因采访言论陷入了舆论漩涡',
      body: '你对着记者把对主教练的看法一字不落地说了，中午之前全国都知道了。',
      options: { apologise: '公开道歉', leave: '申请离队' },
      why: {
        apologised: '道歉声明得俱乐部替你写，它对你也就少信一分',
      },
      results: {
        apologised: '你照着别人写好的声明念完了，这个赛季剩下的时间里主教练对你少了几分信任。',
        moved_on: '你去了一个没人再提这件事的地方。',
      },
    },
    fan_backlash: {
      title: '看台球迷似乎对你近期的表现不满',
      body: '主场念到你名字的时候，回应你的不再是欢呼，而是嘘声。',
      options: { stay: '留下来赢回他们', leave: '申请离队' },
      why: {
        endured: '每个主场都顶着嘘声踢，是要付代价的',
      },
      results: {
        endured: '你顶着嘘声踢完，这要付出代价，不过还能挣回来。',
        moved_on: '你走了，嘘声也在那天停了。',
      },
    },
    tax_trouble: {
      title: '税务局找上门',
      body: '他们要查你六年的账，而且一边查一边给报纸放风。',
      options: { stay: '在本国打官司', leave: '接一份国外的报价' },
      why: {
        fought_it: '打官司要花的月份，和一个赛季一样多',
      },
      results: {
        fought_it: '律师、听证会，以及一个跟足球无关的赛季。',
        left_country: '你接了那份合同，麻烦留在了身后。',
      },
    },
    foreign_grandfather: {
      title: '祖父来自别的国家',
      body: '手续查下来是成立的，你可以改代表{newCountry}，但一旦改了，你长大的那个国家就永远关上了门。',
      options: { switch: '改投{newCountry}', stay: '留在{country}' },
      results: {
        switched: '你签了字，以后唱的是另一首国歌，而这条国家队的路要好走得多。',
        stayed: '你留在了出生的地方，他们会不会招你是他们的事，不是你的。',
      },
    },
    rival_offer: {
      title: '死敌俱乐部向你发出了邀请',
      body: '{club}正在砸钱堆一支超级球队，他们要你，而你的球迷永远不会原谅你。',
      options: { join: '加盟{club}', stay: '留下来干掉他们' },
      results: {
        joined_rival: '你越过了那条线，骂声很响，而你身边的阵容更强。',
        stayed_loyal: '你留下了，看台为此唱了一整个赛季你的名字。',
      },
    },
    saudi_approach: {
      title: '来自海湾的报价',
      body: '三倍周薪，去踢一个你尊敬的人都不会看的联赛。',
      options: { take_it: '拿钱', refuse: '留在还有胜负的地方' },
      results: {
        took_it: '你签了，那串数字不真实，那里的足球也不真实——弱联赛、身价缩水，这里的冠军和你留在欧洲的那些比起来，轻得可怜。',
        stayed_competitive: '你拒绝了这笔钱，选了还能踢的地方，你的会计师到现在也没想通。',
      },
    },
    triumphant_return: {
      title: '梦开始的地方',
      body: '{club}想让你回去，把故事在开始的地方写完。',
      options: { return: '回到{club}', decline: '在现在的地方继续' },
      results: {
        came_home: '看台上挂出了一条横幅：欢迎回家。',
        stayed_put: '你决定还不是时候，这件事先放着。',
      },
    },
    national_team_conflict: {
      title: '俱乐部与国家队',
      body: '国家队征召你去打{tournament}，俱乐部不放人，说这趟飞机你上不了。',
      options: { go: '照样去报到', obey: '留在俱乐部' },
      results: {
        went_anyway: '你还是去了{tournament}，为国家队踢了球，回到俱乐部后被主教练放到了替补席上。',
        obeyed: '你留在了俱乐部，这个夏天国家队的那件球衣穿在了别人身上。',
      },
    },
    decisive_penalty: {
      title: '决定冠军的点球',
      body: '终场哨就要响了，这一脚决定{trophy}，球在你怀里，选好角度别再改主意。',
      options: { left: '推左下死角', right: '抽右上角' },
      why: {
        saved: '门将也在猜，有时候正好和你猜到一处',
      },
      results: {
        scored: '网窝翻起，替补席清空，这张照片会在酒吧里挂二十年。',
        saved: '门将和你想到了一块儿把球扑了出去，走回中圈的那几十米长得像一辈子。',
      },
    },
    decisive_save: {
      title: '扑出它，冠军就是你们的',
      body: '扑出这个点球，{trophy}就到手了，而主罚的人一眼都没看你。',
      options: { left: '扑左边', right: '扑右边' },
      why: {
        beaten: '他出脚之前，你就得先选一边',
      },
      results: {
        saved_it: '你整个人飞出去，球在手套里，剩下的只有彩带。',
        beaten: '你朝一边扑了出去，球却往另一边飞，球员通道里静得出奇。',
      },
    },
    injury_at_peak: {
      title: '在最坏的时刻受伤了',
      body: '片子不干净，离{trophy}只剩几周，队医不敢看你。',
      options: { play: '打封闭，上', rest: '休养，把冲刺阶段让出去' },
      why: {
        broke_down: '身体到了极限，不会先跟你打招呼',
        lost_without: '少了你，球队还得自己去赢',
      },
      results: {
        limped_over: '你用一条好腿把全队拖过了终点线。',
        broke_down: '赛前热身时你的肌肉就拉伤了，整场比赛你在理疗床上看完。',
        won_without: '球队没有你也拿下了这个冠军，奖牌发到你手里的时候，轻得有点陌生。',
        lost_without: '你在看台上看着它溜走。',
      },
    },
    play_through_injury: {
      title: '你的伤还没完全好利索',
      body: '片子不干净，冲刺阶段还剩四场，教练在问你，而硬上的代价可能不止这一个赛季。',
      options: { play: '硬上', recover: '休到好' },
      why: {
        made_it_worse: '带着伤踢，只会把伤踢大',
      },
      results: {
        got_away: '你扛过来了，把球队拖过了冲刺阶段，而你自己清楚这是蒙过去的。',
        made_it_worse: '这下伤得重多了，恢复期从几周变成几个月，还落下了后遗症。',
        recovered: '你养好了才回来，比你想的晚。',
      },
    },
    frozen_out: {
      title: '你被排除在球队计划之外',
      body: '从九月起你就没进过大名单，也没人跟你解释过为什么。',
      options: { wait: '等机会', leave: '逼球队放你走' },
      why: {
        still_out: '干等着，改变不了主教练的想法',
      },
      results: {
        won_him_over: '一次伤病把门推开一条缝，你一脚踹开了它。',
        still_out: '又一年周六独自加练。',
        moved_on: '你去了一个真的想要你的地方。',
      },
    },

    agent_change: {
      title: '一家更大的经纪公司想签你',
      body: '他们手里有三个国脚，也报了一个他们说能给你谈到的数，而你现在这位从你十五岁起就跟着你。',
      options: { switch: '跟他们签', stay_loyal: '不换' },
      cost: '经纪公司抽成 {cash}',
      why: {
        paid_for_nothing: '更大的经纪公司，有更大的名字要先打电话',
      },
      results: {
        better_deals: '下一份合同比原来高出一大截，他那份抽成拿得不亏。',
        paid_for_nothing: '签约饭局之后电话就少了，那顿饭还是你结的账。',
        kept_him: '当年没人肯送你去试训，是他一趟趟开车送的，这份情你一直记着。',
      },
    },
    captain_armband: {
      title: '主教练想让你当队长',
      body: '在这儿队长不是个虚职，输球之后要你站出来，而输球是一定会有的。',
      options: { take_it: '接下袖标', decline_armband: '这不适合我' },
      why: {
        weight_of_it: '戴上袖标，别人的麻烦也变成你的',
      },
      results: {
        led_them: '整个赛季你都是最后一个离开球场的，赢了输了都一样，更衣室看在眼里。',
        weight_of_it: '那份压力你没能卸下，一路带回了家，接下来一阵子你自己的状态也跟着往下掉。',
        just_play: '采访让别人去做，你只管踢球。',
      },
    },
    new_manager_meeting: {
      title: '新帅在一个一个见球员',
      body: '每人十五分钟，他在那间屋子里对你形成的看法，基本就是你这个赛季的样子。',
      options: { make_the_case: '告诉他你该首发', let_work_talk: '让训练说话' },
      why: {
        marked_card: '新帅不喜欢别人教他怎么排阵容',
      },
      results: {
        convinced_him: '他认可你说的那些，第三轮你就进了首发，位置也定了下来。',
        marked_card: '他不爱被人教该怎么用人，你的出场时间因此少了一些。',
        kept_head_down: '你一句没说，把话都放进了训练里——他没有立刻给你位置，但多下的功夫都留在了身上。',
      },
    },
    winter_break: {
      title: '赛季中间放两周假',
      body: '队友们都在海边，健身房开着，也没人查。',
      options: { train_through: '照练不误', switch_off: '彻底歇下来' },
      why: {
        came_back_flat: '有冬歇期，是因为身体需要它',
      },
      results: {
        came_back_sharp: '回来时你比谁都锐利，下半赛季是你踢得最好的一段。',
        came_back_flat: '你其实一直没停下来，到三月就看出来了。',
        rested: '两周什么都没干，回来一身轻，假期本来就是干这个用的。',
      },
    },
    january_window_itch: {
      title: '十月之后你就没首发过',
      body: '转会窗还有两周就关，经纪人说有人在问你，而主教练已经一个月没跟你说过话了。',
      options: { ask_to_leave: '要求离队', fight_for_it: '留下来抢回位置' },
      why: {
        still_out_of_it: '练得好和被选上，是两回事',
      },
      results: {
        got_out: '你去了一个想要你的地方，有时候答案就这么简单。',
        won_place_back: '一次伤病给你开了门，你把门直接踹掉了，从那以后再没下来过。',
        still_out_of_it: '你练了半年，什么都没改变。',
      },
    },
    boot_deal: {
      title: '一家球鞋公司要独家',
      body: '钱不少，条件是只穿他们的，而你从十六岁起就一直穿另一个牌子的同一款。',
      options: { sign_big: '签下来', keep_own_boots: '还穿自己的' },
      income: '代言费 {cash}',
      why: {
        boots_hurt: '不合脚，还是得换回原来的球鞋',
      },
      results: {
        money_landed: '钱到账了，鞋也合脚，这是你做过最省心的决定。',
        boots_hurt: '那双鞋你的脚一直没适应，圣诞节前你换回了原来那双，那笔钱也跟着没了。',
        same_boots: '同一双鞋，同一副鞋钉，什么都没变，有的球员就是这样。',
      },
    },
    set_piece_duty: {
      title: '任意球现在没人主罚',
      body: '原来罚的那位夏天走了，而训练里你踢得不比任何人差。',
      options: { take_them: '我来罚', leave_them: '让别人罚' },
      why: {
        wasted_them: '当着满场罚飞的任意球，会一直跟着你',
      },
      results: {
        they_go_in: '圣诞节前进了三个，现在这活儿是你的了，集锦也是。',
        wasted_them: '一个月里四脚打在人墙上，你还没起脚看台就开始叹气，下个赛季你站到球前都还在想这件事。',
        someone_else_takes: '这活儿归了别人，你专心踢自己的球，什么也没多什么也没少。',
      },
    },
    language_lessons: {
      title: '点杯咖啡你还得靠比划',
      body: '俱乐部安排了每周三个上午的语言课，大部分外籍球员从来不去。',
      options: { learn_it: '把语言学下来', use_translator: '继续用翻译' },
      why: {
        never_got_there: '一周三个上午，未必够你学出来',
      },
      results: {
        dressing_room_opened: '到春天队友的玩笑你也接得住了，听得懂之后这就是另一家俱乐部。',
        never_got_there: '晚上的时间搭进去了，话却始终只会几句客套，时间没了，东西也没学到。',
        through_a_translator: '要紧的事都得靠别人转告给你，而那些本该用来学语法的晚上，你都泡在了健身房。',
      },
    },
    sports_science: {
      title: '实验室想重做你的训练方式',
      body: '睡眠、负荷、饮食全部量化，全部你自己掏钱，做过这套的老将现在还在踢。',
      options: { buy_in: '自费上这套', trust_the_body: '相信自己的身体' },
      cost: '项目费用 {cash}',
      why: {
        body_ignored_it: '数据只是描述身体，改变不了身体',
      },
      results: {
        body_holds: '第二个赛季你感觉到了区别，再下一个赛季也是。',
        body_ignored_it: '你花钱买了一年的数据，身体该怎么样还是怎么样。',
        always_managed: '你靠本能撑到今天，目前为止它没让你失望过。',
      },
    },
    youth_rival_signed: {
      title: '他们签了个和你同位置的十九岁',
      body: '真金白银买来的，主教练在发布会上一直在用「未来」这个词。',
      options: { raise_your_game: '把他压下去', ask_the_question: '问清楚自己的位置' },
      why: {
        kid_won: '俱乐部不会去买一个自己看不上的小孩',
      },
      results: {
        saw_off_the_kid: '你踢出了生涯最好的一个赛季，他一直没能挤进来。',
        kid_won: '他确实更好，而这一点没人会提前教你怎么面对。',
        moved_for_minutes: '你去了一个号码还没人占着的地方。',
      },
    },
    testimonial: {
      title: '俱乐部想给你办一场致敬赛',
      body: '满场球迷，请回一个当年的对手，还有那天的门票收入。',
      options: { have_it: '门票收入归你', give_it_away: '捐给青训' },
      income: '门票收入 {cash}',
      why: {
        half_empty: '致敬赛坐不坐得满，得看这座城市肯不肯来人',
      },
      results: {
        full_house: '座无虚席，整整九十分钟那座球场都在念你的名字。',
        half_empty: '一个下雨的周二，半个球场的人，支票不大，场面更难看。',
        gave_the_gate: '一分不留，全给了培养你的青训营，从那以后俱乐部把你当自己人看。',
      },
    },
    referee_row: {
      title: '裁判的一个判罚，刚刚毁了这场球',
      body: '摄像机就在二十米外，还开着，而你有一肚子话。',
      options: { say_it: '说出来', walk_away: '走回通道' },
      why: {
        banned_for_it: '镜头还开着，纪律委员会也一样看着',
      },
      results: {
        squad_backed_you: '更衣室为此喜欢你，纪律委员会不太欣赏，但放过了。',
        banned_for_it: '停赛三场，你一场没落地看完了，以后每次提到你那段视频都还会被放一遍。',
        said_nothing: '你一句没接，转身走开，这事儿到周二就没人再提。',
      },
    },
    position_switch_offer: {
      title: '教练觉得你该往回撤',
      body: '你慢了半步他看出来了，他也说换个位置还有五年好踢。',
      options: { drop_deeper: '学新位置', stay_where_you_are: '不改' },
      why: {
        never_took: '你得先放掉自己本来擅长的那个位置',
      },
      results: {
        new_position: '学了一个冬天，换来了好几年。',
        never_took: '你始终没学会那个位置，原来擅长的那个也丢了。',
        kept_the_shirt: '你就是你，那件一直穿的球衣你没换。',
      },
    },
    transfer_request_leak: {
      title: '有报纸说你申请转会',
      body: '你没有申请转会，但有人放了这个风，到中午已经满天飞。',
      options: { deny_it: '公开否认', let_it_stand: '不说话，随它去' },
      why: {
        nobody_believed_you: '否认要管用，前提是那件事是假的',
      },
      results: {
        crowd_believed_you: '你对着镜头把话说明白了，球场信了你，主教练也公开表了态，接下来这个赛季你踢得比原来多。',
        nobody_believed_you: '没人信这个否认，主场看台开始对你有声音，下个赛季你在自己的球场上踢得很别扭。',
        door_opened: '你没有否认，那就等于默认了，下个转会窗你会被摆上货架，而来买你的人不会把工资开低。',
      },
    },
    charity_match: {
      title: '老队友在组织一场慈善赛',
      body: '夏天的一个下午，满场观众，还有一块五月之后就没浇过水的草皮。',
      options: { play_it: '去踢', send_a_cheque: '捐钱不去' },
      cost: '捐出 {cash}',
      why: {
        went_over_on_it: '五月起就没人浇过的场地，也还是场地',
      },
      results: {
        good_afternoon: '一个不错的下午，一件不错的事，还有一张你真留下来的照片。',
        went_over_on_it: '一场不算数的比赛，下半场你崴了脚踝。',
        wrote_the_cheque: '你没去踢那场球，改成写了一张支票，金额比全场门票加起来还多。',
      },
    },
    contract_leak: {
      title: '你的周薪上了报纸',
      body: '精确到个位，旁边并排印着一张季票多少钱，电台热线聊了一整周。',
      options: { front_it_out: '硬扛过去', take_a_cut: '主动降薪' },
      why: {
        never_lived_it_down: '客场看台读到了那个数字，而且不会忘',
      },
      results: {
        blew_over: '一周之后他们又开始为别的事生气了。',
        never_lived_it_down: '整整一个赛季，每个客场都有人拿这个喊你。',
        bought_goodwill: '没人要求你降，你自己降了，球迷知道了，主教练也知道了。',
      },
    },
    europa_thursday: {
      title: '周四打欧战，周日打联赛',
      body: '欧战和联赛一起来了，阵容不够两条线用，主教练在问你想踢哪个。',
      options: { play_both: '两个都踢', save_yourself: '留力打联赛' },
      why: {
        legs_went: '周四加周日，一双腿要踢两个赛季',
      },
      results: {
        ran_it_all: '两条线你一分钟没缺，欧战走得比所有人预想的都远。',
        legs_went: '到三月腿就没了，积分榜上写得清清楚楚。',
        picked_the_league: '周日你总是满状态，而欧战是别人的故事。',
      },
    },
    coaching_badges: {
      title: '夏天有一期教练证课程',
      body: '别人休假的时候你要在教室里坐两周，队里有一半人觉得这是你开始准备退役了。',
      options: { start_them: '去考证', not_yet: '还在踢，先不考' },
      cost: '课程学费 {cash}',
      why: {
        classroom_only: '六月坐进教室，这个夏天就回不来了',
      },
      results: {
        reading_the_game: '你开始在比赛发生之前就看见它的形状，这让你先成了更好的球员。',
        classroom_only: '证是考了，可周末的球场上一点用没有，而那个夏天你再也补不回来。',
        still_playing: '这些事以后有的是时间做，你现在首先还是个球员。',
      },
    },
  },
};
