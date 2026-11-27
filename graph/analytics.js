// Analytics adapted from koala73/worldmonitor (commit 055a1fd, AGPL-3.0-only).
// Formulas are ported; inputs differ, so no result here is an official worldmonitor index.
// See METHODOLOGY.md for source files, adaptations and limitations.
import { el } from './panel.js';
import worldShapes from './fixtures/world.js';

// Data tables extracted from the worldmonitor sources named in METHODOLOGY.md.
const STOP_WORDS = new Set(["the","a","an","and","or","but","in","on","at","to","for","of","with","by","from","as","is","was","are","were","been","be","have","has","had","do","does","did","will","would","could","should","may","might","must","shall","can","need","it","its","this","that","these","those","i","you","he","she","we","they","what","which","who","whom","how","when","where","why","all","each","every","both","few","more","most","other","some","such","no","not","only","same","so","than","too","very","just","also","now","new","says","said","after"]);
const SUPPRESSED = new Set(["ai","app","api","new","top","big","ceo","cto","update","report","latest","breaking","analysis","reuters","exclusive","opinion","editorial","watch","live","video","photo","photos","read","full","source","sources","according","ahead","english","times","post","news","press","media","journal","morning","evening","daily","weekly","monthly","newsletter","subscribe","podcast","interview","says","said","tells","told","calls","called","makes","made","takes","took","gets","gives","gave","goes","went","comes","came","puts","sets","set","shows","shown","finds","found","keeps","kept","holds","held","runs","turns","turned","leads","led","brings","brought","starts","started","moves","moved","plans","planned","wants","wanted","needs","needed","looks","looked","works","worked","tries","tried","asks","asked","uses","used","expects","expected","reports","reported","claims","claimed","warns","warned","reveals","revealed","announces","announced","confirms","confirmed","denies","denied","launches","launched","signs","signed","faces","faced","seeks","sought","hits","hit","dies","died","killed","kills","rises","rose","falls","fell","wins","won","lost","ends","ended","begins","began","opens","opened","closes","closed","raises","raised","cuts","cut","adds","added","drops","dropped","pushes","pushed","pulls","pulled","backs","backed","blocks","blocked","passes","passed","votes","voted","joins","joined","leaves","left","returns","returned","sends","sent","urges","urged","vows","vowed","pledges","pledged","rejects","rejected","approves","approved","first","last","next","major","former","still","despite","amid","over","under","back","year","years","day","days","week","weeks","month","months","time","long","high","low","part","early","late","key","two","three","four","five","million","billion","percent","nearly","almost","already","just","even","since","while","during","before","between","again","against","into","through","around","about","much","many","several","second","third","possible","likely","least","best","worst","largest","biggest","smallest","highest","lowest","record","global","local","state","states","department","officials","official","country","countries","people","group","groups","plan","deal","talks","move","order","case","house","court","secretary","board","control","bank","power","leader","leaders","government","minister","president","agency","market","markets","company","companies","world","white","head","side","point","end","line","area","number","issue","issues","policy","security","force","forces","system","service","services","program","project","effort","action","support","level","rate","rates","price","prices","trade","growth","change","changes","crisis","risk","impact","future","history","data","team","member","members","office","sector","region","regions","center","role","south","north","east","west","eastern","western","southern","northern","central","middle","united","national","international","federal","say","get","give","go","come","put","take","make","know","think","see","want","look","find","tell","ask","use","try","leave","call","keep","let","begin","show","hear","play","run","help","turn","start","hold","bring","write","provide","sit","stand","lose","pay","meet","include","continue","learn","lead","believe","feel","follow","stop","speak","allow","add","grow","open","walk","win","offer","appear","buy","wait","serve","die","send","build","stay","fall","reach","remain","suggest","raise","sell","require","decide","develop","break","happen","create","000","100","200","500","per","than","trading","stock","earnings","finance","defi","ipo","tradingview","currency","dollar","usd","investing","equity","valuation","ecb","regulation","outlook","forecast","financial","com","platform","block","focus","today","chief","basel","ongoing","higher","poised","track","wall","street","financialcontent","ray","msn","aol","2025","2026","2027","january","february","march","april","may","june","july","august","september","october","november","december","goldman","sachs","off","here","there","where","when","what","which","who","whom","this","that","these","those","been","being","have","has","had","having","does","done","doing","would","could","should","will","shall","might","must","also","more","most","some","other","only","very","after","with","from","they","them","their","then","now","how","all","each","every","both","few","own","same","such","too","any","well"]);
const LEADERS = ["putin","zelensky","xi jinping","biden","trump","netanyahu","khamenei","erdogan","modi","macron","scholz","starmer","orban","milei","kim jong un","al-sisi"].map(n => [n, new RegExp('\\b' + n + '\\b', 'i')]);
const NEGATIVE = new Set(["war","attack","killed","death","dead","crisis","crash","collapse","threat","danger","escalate","escalation","conflict","strike","bomb","explosion","casualties","disaster","emergency","catastrophe","fail","failure","reject","rejected","sanctions","invasion","missile","nuclear","terror","terrorist","hostage","assassination","coup","protest","riot","warns","warning","fears","concern","worried","plunge","plummet","flee","evacuate","shutdown","layoff","layoffs","cuts","slump","recession"]);
const POSITIVE = new Set(["peace","deal","agreement","breakthrough","success","win","gains","recovery","growth","rise","boost","rally","soar","jump","ceasefire","treaty","alliance","partnership","cooperation","progress","release","released","freed","rescue","saved","approved","passes","record","milestone","historic","landmark","celebrates","victory"]);
const THREAT = {"critical":[["nuclear strike","military"],["nuclear attack","military"],["nuclear war","military"],["invasion","conflict"],["declaration of war","conflict"],["declares war","conflict"],["all-out war","conflict"],["full-scale war","conflict"],["martial law","military"],["coup","military"],["coup attempt","military"],["genocide","conflict"],["ethnic cleansing","conflict"],["chemical attack","terrorism"],["biological attack","terrorism"],["dirty bomb","terrorism"],["mass casualty","conflict"],["massive strikes","military"],["military strikes","military"],["retaliatory strikes","military"],["launches strikes","military"],["launch attacks on iran","military"],["launch attack on iran","military"],["attacks on iran","military"],["strikes on iran","military"],["strikes iran","military"],["bombs iran","military"],["attacks iran","military"],["attack on iran","military"],["attack iran","military"],["attacked iran","military"],["attack against iran","military"],["bombing iran","military"],["bombed iran","military"],["war with iran","conflict"],["war on iran","conflict"],["war against iran","conflict"],["iran retaliates","military"],["iran strikes","military"],["iran launches","military"],["iran attacks","military"],["pandemic declared","health"],["health emergency","health"],["nato article 5","military"],["evacuation order","disaster"],["meltdown","disaster"],["nuclear meltdown","disaster"],["major combat operations","military"],["declared war","conflict"]],"high":[["war","conflict"],["armed conflict","conflict"],["airstrike","conflict"],["airstrikes","conflict"],["air strike","conflict"],["air strikes","conflict"],["drone strike","conflict"],["drone strikes","conflict"],["strikes","conflict"],["missile","military"],["missile launch","military"],["missiles fired","military"],["troops deployed","military"],["military escalation","military"],["military operation","military"],["ground offensive","military"],["bombing","conflict"],["bombardment","conflict"],["shelling","conflict"],["casualties","conflict"],["killed in","conflict"],["hostage","terrorism"],["terrorist","terrorism"],["terror attack","terrorism"],["assassination","crime"],["cyber attack","cyber"],["ransomware","cyber"],["data breach","cyber"],["sanctions","economic"],["embargo","economic"],["earthquake","disaster"],["tsunami","disaster"],["hurricane","disaster"],["typhoon","disaster"],["strike on","conflict"],["strikes on","conflict"],["attack on","conflict"],["attack against","conflict"],["attacks on","conflict"],["launched attack","conflict"],["launched attacks","conflict"],["launches attack","conflict"],["launches attacks","conflict"],["explosions","conflict"],["military operations","military"],["combat operations","military"],["retaliatory strike","military"],["retaliatory attack","military"],["retaliatory attacks","military"],["preemptive strike","military"],["preemptive attack","military"],["preventive attack","military"],["preventative attack","military"],["military offensive","military"],["ballistic missile","military"],["cruise missile","military"],["air defense intercepted","military"],["forces struck","conflict"]],"medium":[["protest","protest"],["protests","protest"],["riot","protest"],["riots","protest"],["unrest","protest"],["demonstration","protest"],["strike action","protest"],["military exercise","military"],["naval exercise","military"],["arms deal","military"],["weapons sale","military"],["diplomatic crisis","diplomatic"],["ambassador recalled","diplomatic"],["expel diplomats","diplomatic"],["trade war","economic"],["tariff","economic"],["recession","economic"],["inflation","economic"],["market crash","economic"],["flood","disaster"],["flooding","disaster"],["wildfire","disaster"],["volcano","disaster"],["eruption","disaster"],["outbreak","health"],["epidemic","health"],["infection spread","health"],["oil spill","environmental"],["pipeline explosion","infrastructure"],["blackout","infrastructure"],["power outage","infrastructure"],["internet outage","infrastructure"],["derailment","infrastructure"]],"low":[["election","diplomatic"],["vote","diplomatic"],["referendum","diplomatic"],["summit","diplomatic"],["treaty","diplomatic"],["agreement","diplomatic"],["negotiation","diplomatic"],["talks","diplomatic"],["peacekeeping","diplomatic"],["humanitarian aid","diplomatic"],["ceasefire","diplomatic"],["peace treaty","diplomatic"],["climate change","environmental"],["emissions","environmental"],["pollution","environmental"],["deforestation","environmental"],["drought","environmental"],["vaccine","health"],["vaccination","health"],["disease","health"],["virus","health"],["public health","health"],["covid","health"],["interest rate","economic"],["gdp","economic"],["unemployment","economic"],["regulation","economic"]],"exclusions":["protein","couples","relationship","dating","diet","fitness","recipe","cooking","shopping","fashion","celebrity","movie","tv show","sports","game","concert","festival","wedding","vacation","travel tips","life hack","self-care","wellness","strikes deal","strikes agreement","strikes partnership"],"short":["war","coup","ban","vote","riot","riots","hack","talks","ipo","gdp","virus","disease","flood","strikes"],"trailing":["attack iran","attacked iran","attack on iran","attack against iran","attacks on iran","launch attacks on iran","launch attack on iran","bombing iran","bombed iran","strikes iran","attacks iran","bombs iran","war on iran","war with iran","war against iran","iran retaliates","iran strikes","iran launches","iran attacks"]};
const NON_POLITICAL_COUP = /\b(?:boardroom|corporate|shareholder|marketing|pr|publicity|media|transfer|signing|recruiting|diplomatic|budget|fiscal|cultural)\s+coup\b|\bcoup\s+de\s+(?:gr[aâ]ce|th[eé][aâ]tre|ma[iî]tre|foudre)\b/g;
const POLITICAL_COUP = /\b(?:progressive|conservative|liberal|leftist|populist|socialist|maga|woke|legislative|parliamentary)\s+coup\b/g;
const COUP_CONTEXT = /\b(?:soldiers?|troops|army|military|junta|armed forces|generals?|officers|putsch\w*|seiz\w*|stag(?:e|es|ed|ing)|foil\w*|attempt\w*|plot\w*|overthrow\w*|ousted|martial law|d['’]?[eé]tat)\b/;
const ESCALATION_ACTIONS = /\b(attack|attacks|attacked|strike|strikes|struck|bomb|bombs|bombed|bombing|shell|shelled|shelling|missile|missiles|intercept|intercepted|retaliates|retaliating|retaliation|killed|casualties|offensive|invaded|invades)\b/;
const ESCALATION_TARGETS = /\b(iran|tehran|isfahan|tabriz|russia|moscow|china|beijing|taiwan|taipei|north korea|pyongyang|nato|us base|us forces|american forces|us military)\b/;
const IMPORTANCE = {"military":["war","armada","invasion","airstrike","strike","missile","troops","deployed","offensive","artillery","bomb","combat","fleet","warship","carrier","navy","airforce","deployment","mobilization","attack"],"violence":["killed","dead","death","shot","blood","massacre","slaughter","fatalities","casualties","wounded","injured","murdered","execution","crackdown","violent","clashes","gunfire","shooting"],"unrest":["protest","protests","uprising","revolt","revolution","riot","riots","demonstration","unrest","dissent","rebellion","insurgent","overthrow","coup","martial law","curfew","shutdown","blackout"],"crisis":["crisis","emergency","catastrophe","disaster","collapse","humanitarian","sanctions","ultimatum","threat","retaliation","escalation","tensions","breaking","urgent","developing","exclusive"],"demote":["ceo","earnings","stock","startup","data center","datacenter","revenue","quarterly","profit","investor","ipo","funding","valuation"],"flashpoint":["iran","tehran","russia","moscow","china","beijing","taiwan","ukraine","kyiv","north korea","pyongyang","israel","gaza","west bank","syria","damascus","yemen","hezbollah","hamas","kremlin","pentagon","nato","wagner"],"diplomacy":["ceasefire","truce","armistice","treaty","accord","pact","diplomatic","diplomacy","mediate","mediator","negotiation","negotiations","negotiate","normalization","normalisation"]};
export const BASELINE_RISK = {"US":5,"RU":35,"CN":25,"UA":50,"IR":40,"IL":45,"TW":30,"KP":45,"SA":20,"TR":25,"PL":10,"DE":5,"FR":10,"GB":5,"IN":20,"PK":35,"SY":50,"YE":50,"MM":45,"VE":40,"CU":45,"MX":35,"BR":15,"AE":10,"KR":15,"IQ":40,"AF":45,"LB":40,"EG":20,"JP":5,"QA":10};
const COUNTRY_KEYWORDS = {"US":["united states","usa","u.s.","u.s.a.","america","american","washington","biden","trump","pentagon"],"RU":["russia","russian","moscow","kremlin","putin"],"CN":["china","chinese","beijing","xi jinping","prc"],"UA":["ukraine","ukrainian","kyiv","zelensky","donbas"],"IR":["iran","iranian","tehran","khamenei","irgc"],"IL":["israel","israeli","tel aviv","netanyahu","idf","gaza"],"TW":["taiwan","taiwanese","taipei"],"KP":["north korea","north korean","pyongyang","kim jong"],"SA":["saudi arabia","saudi","riyadh"],"TR":["turkey","turkiye","turkish","ankara","erdogan"],"PL":["poland","warsaw"],"DE":["germany","german","berlin"],"FR":["france","french","paris","macron"],"GB":["united kingdom","britain","british","uk","u.k.","london"],"IN":["india","indian","delhi","modi"],"PK":["pakistan","pakistani","islamabad"],"SY":["syria","syrian","damascus"],"YE":["yemen","yemeni","sanaa","houthi"],"MM":["myanmar","burma","burmese"],"VE":["venezuela","venezuelan","caracas","maduro"],"CU":["cuba","cuban","havana","diaz-canel"],"MX":["mexico","mexican","sheinbaum","cartel","sinaloa"],"BR":["brazil","brazilian","brasilia","lula"],"AE":["uae","emirates","dubai","abu dhabi","united arab emirates"],"KR":["south korea","south korean","korean peninsula","seoul","yoon"],"IQ":["iraq","iraqi","baghdad","kurdistan","mosul","basra"],"AF":["afghanistan","afghan","kabul","taliban","kandahar"],"LB":["lebanon","lebanese","beirut","hezbollah","nasrallah"],"EG":["egypt","egyptian","cairo","suez","sisi"],"JP":["japan","japanese","tokyo","okinawa","fukushima","kishida"],"QA":["qatar","qatari","doha","al jazeera"]};
const HOTSPOTS = {"Sahel":{"keywords":["burkina faso","mali","niger","sahel","junta","coup","wagner","africa corps"],"baseline":4,"countries":["ML","NE","BF"]},"Port-au-Prince":{"keywords":["haiti","port-au-prince","gangs","kenya mission","barbecue"],"baseline":4,"countries":["HT"]},"Horn of Africa":{"keywords":["somalia","piracy","al-shabaab","ethiopia","somaliland","red sea"],"baseline":4,"countries":["ET","SO","SD"]},"Pakistan–Afghanistan Border":{"keywords":["pakistan","afghanistan","ttp","taliban","torkham","chaman","waziristan","khyber","peshawar","border","cross-border","airstrike","pak-afghan"],"baseline":4,"countries":["PK","AF"]},"DC":{"keywords":["pentagon","white house","congress","cia","nsa","washington","biden","trump","senate","supreme court","vance","elon"],"baseline":3,"countries":["US"]},"Silicon Valley":{"keywords":["google","apple","meta","nvidia","openai","anthropic","silicon valley","san francisco","palo alto","tech layoffs","ai","artificial intelligence"],"baseline":3,"countries":["US"]},"Wall Street":{"keywords":["wall street","fed","federal reserve","nyse","nasdaq","dow","sp500","stock market","goldman","jpmorgan","blackrock"],"baseline":3,"countries":["US"]},"Houston":{"keywords":["houston","nasa","spacex","oil","energy","texas","exxon","chevron","lng"],"baseline":3,"countries":["US"]},"Moscow":{"keywords":["kremlin","putin","russia","fsb","moscow","russian"],"baseline":4,"countries":["RU"]},"Beijing":{"keywords":["beijing","xi","china","pla","ccp","chinese","jinping"],"baseline":3,"countries":["CN"]},"Kyiv":{"keywords":["kyiv","ukraine","zelensky","ukrainian","kiev"],"baseline":5,"countries":["UA"]},"Taipei":{"keywords":["taiwan","taipei","tsmc","strait","taiwanese"],"baseline":3,"countries":["TW"]},"Tehran":{"keywords":["iran","tehran","irgc","khamenei","persian","iranian"],"baseline":4,"countries":["IR"]},"Tel Aviv":{"keywords":["israel","idf","mossad","gaza","netanyahu","israeli","hamas","hezbollah"],"baseline":5,"countries":["IL"]},"Pyongyang":{"keywords":["north korea","kim","pyongyang","dprk","korean"],"baseline":3,"countries":["KP"]},"London":{"keywords":["london","uk","britain","gchq","mi6","british"],"baseline":3,"countries":["GB"]},"Brussels":{"keywords":["nato","brussels","eu","european union","europe"],"baseline":3,"countries":["BE"]},"Caracas":{"keywords":["venezuela","maduro","caracas","venezuelan"],"baseline":3,"countries":["VE"]},"Mexico City":{"keywords":["mexico","cartel","sinaloa","jalisco","narco","cjng","fentanyl","el chapo","national guard mexico","zetas","michoacan","juarez","tijuana","border violence","mexican army","sedena","extradition mexico"],"baseline":4,"countries":["MX"]},"Nuuk":{"keywords":["greenland","nuuk","arctic","denmark","danish"],"baseline":3,"countries":["GL"]},"Riyadh":{"keywords":["saudi","riyadh","mbs","aramco","opec","saudi arabia"],"baseline":3,"countries":["SA"]},"Cairo":{"keywords":["egypt","cairo","sisi","egyptian","suez"],"baseline":3,"countries":["EG"]},"Baghdad":{"keywords":["iraq","baghdad","iraqi","pmf","militia"],"baseline":3,"countries":["IQ"]},"Damascus":{"keywords":["syria","damascus","assad","syrian","hts"],"baseline":3,"countries":["SY"]},"Doha":{"keywords":["qatar","doha","qatari","al jazeera"],"baseline":3,"countries":["QA"]},"Ankara":{"keywords":["turkey","ankara","erdogan","turkish","mit"],"baseline":3,"countries":["TR"]},"Beirut":{"keywords":["lebanon","beirut","hezbollah","lebanese","nasrallah"],"baseline":3,"countries":["LB"]},"Abu Dhabi":{"keywords":["uae","abu dhabi","emirates","emirati","dubai"],"baseline":3,"countries":["AE"]}};

const DAY = 864e5, HOUR = 36e5;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const escapeRegex = v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- Temporal baseline (Welford) ----------
export function welfordUpdate(state, value) {
  const n = state.n + 1, delta = value - state.mean, mean = state.mean + delta / n;
  return { n, mean, m2: state.m2 + delta * (value - mean) };
}
export const baselineSeverity = z => (z >= 3 ? 'critical' : z >= 2 ? 'high' : z >= 1.5 ? 'medium' : 'normal');
export function temporalAnomaly(history, current, minSamples = 10) {
  const s = history.reduce(welfordUpdate, { n: 0, mean: 0, m2: 0 });
  if (s.n < minSamples || s.n < 2) return null;
  const sd = Math.sqrt(Math.max(0, s.m2 / (s.n - 1)));
  const zScore = sd > 0 ? Math.abs((current - s.mean) / sd) : 0;
  return { samples: s.n, mean: s.mean, stdDev: sd, current, zScore, severity: baselineSeverity(zScore) };
}
// Only sets with known continuous coverage are tested: feed and catalogue tails would look like spikes.
// Monthly per-day rates. Leading empty months and the first (partial) month of a series are skipped;
// the month of the snapshot date is the observation, divided by the completed days.
export function timelineAnomalies(events, date) {
  const today = String(events?.generated ?? date ?? '').slice(0, 10);
  if (!events?.timeline?.length || today.length < 10) return [];
  const months = new Map();
  for (const point of events.timeline) {
    const key = point.date.slice(0, 7), sum = months.get(key) ?? months.set(key, []).get(key);
    point.counts.forEach((v, i) => { sum[i] = (sum[i] ?? 0) + v; });
  }
  const keys = [...months.keys()].sort(), now = today.slice(0, 7), done = Number(today.slice(8)) - 1;
  if (done < 1 || !months.has(now)) return [];
  const full = keys.filter(k => k < now);
  const daysIn = k => new Date(Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5)), 0)).getUTCDate();
  const out = [];
  events.datasets.forEach((dataset, i) => {
    if (!/^(gdelt_|usgs_quakes$)/.test(dataset.id)) return;
    let history = full.map(k => (months.get(k)[i] ?? 0) / daysIn(k));
    const start = history.findIndex(v => v > 0);
    if (start < 0) return;
    history = history.slice(start + 1);
    const result = temporalAnomaly(history, (months.get(now)[i] ?? 0) / done);
    if (result && result.zScore >= 1.5) out.push({ ...result, id: dataset.id, label: dataset.label, month: now });
  });
  return out.sort((a, b) => b.zScore - a.zScore);
}

// ---------- Geography ----------
export function haversineKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180, a = Math.sin((lat2 - lat1) * r / 2) ** 2
    + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export function countryLocator(shapes) {
  const boxed = (shapes ?? []).map(shape => {
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const ring of shape.rings) for (const [x, y] of ring) {
      box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y);
    }
    return { ...shape, box };
  });
  const at = (x, y) => boxed.find(({ box, rings }) => {
    if (x < box[0] || y < box[1] || x > box[2] || y > box[3]) return false;
    let inside = false;
    for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  })?.code ?? null;
  // A grid-square centre may fall in the sea: then its four near-corners are tried.
  return (lon, lat) => at(lon, lat) ?? at(lon - 0.45, lat - 0.45) ?? at(lon + 0.45, lat + 0.45)
    ?? at(lon - 0.45, lat + 0.45) ?? at(lon + 0.45, lat - 0.45);
}

// ---------- Geographic convergence ----------
export const scoreGeoCell = (types, total) => Math.min(100, types * 25 + Math.min(25, total * 2));
// Dataset to signal type; sets of one phenomenon share a type, all other sets are not signals.
const SIGNALS = { gdelt_protest: 'protest', gdelt_conflict: 'conflict', usgs_quakes: 'earthquake', tsunami: 'earthquake',
  eruptions: 'volcano', gvp: 'volcano', eonet: 'natural' };
const SIGNAL_LABELS = { protest: 'протесты', conflict: 'силовые действия', earthquake: 'землетрясения и цунами', volcano: 'вулканы', natural: 'природные явления' };
export function convergenceCells(events, minTypes = 3) {
  const cells = new Map();
  for (const row of events?.cells ?? []) {
    const d = events.datasets[row[2]];
    const type = SIGNALS[d?.id];
    if (!type || !(row[3] > 0) || (d.geo && d.geo !== 'exact')) continue;
    const lat = Math.floor(row[1]), lon = Math.floor(row[0]), id = `${lat},${lon}`;
    const cell = cells.get(id) ?? cells.set(id, { id, lat: lat + 0.5, lon: lon + 0.5, types: new Map(), total: 0 }).get(id);
    cell.types.set(type, (cell.types.get(type) ?? 0) + row[3]);
    cell.total += row[3];
  }
  return [...cells.values()].filter(c => c.types.size >= minTypes)
    .map(c => ({ id: c.id, lat: c.lat, lon: c.lon, total: c.total, types: [...c.types.keys()], score: scoreGeoCell(c.types.size, c.total) }))
    .sort((a, b) => b.score - a.score || b.types.length - a.types.length || b.total - a.total);
}

// ---------- Text ----------
export function tokenize(text) {
  const tokens = new Set();
  for (const run of String(text).normalize('NFKC').toLowerCase().split(/[^\p{L}\p{N}\p{M}]+/u)) {
    if (!run) continue;
    const chars = [...run];
    if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u.test(run)) {
      if (chars.length === 1) tokens.add(run);
      for (let i = 0; i + 1 < chars.length; i++) tokens.add(chars[i] + chars[i + 1]);
    } else if (chars.length > (/\p{Script=Hangul}/u.test(run) ? 1 : 2) && !STOP_WORDS.has(run)) tokens.add(run);
  }
  return tokens;
}
export function jaccardSimilarity(a, b) {
  if (!a.size && !b.size) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let both = 0;
  for (const x of small) if (large.has(x)) both++;
  return both / (a.size + b.size - both);
}
const parseTime = t => {
  const s = String(t ?? '').replace(' ', 'T');
  const ms = Date.parse(s.length > 10 && !/(Z|[+-]\d\d:?\d\d)$/.test(s) ? `${s}Z` : s);
  return Number.isFinite(ms) ? ms : 0;
};
export function newsItems(news) {
  return (news?.headlines ?? []).filter(h => h?.title).map(h => ({
    title: String(h.title), time: parseTime(h.t), source: String(h.s),
    sourceName: news.sources?.[h.s]?.name ?? String(h.s), tier: news.sources?.[h.s]?.tier ?? 4,
  }));
}
const splitCredit = title => {
  const m = /\s[-–—|]\s+([^-–—|]{1,60})$/.exec(title);
  return !m || m[1].trim().split(/\s+/).length > 6 ? title : title.slice(0, m.index);
};
// Greedy Jaccard clustering of the newest `max` items; threshold 0.5, rewording rescue at 1/3.
export function clusterNews(items, max = 1000) {
  const list = [...items].sort((a, b) => b.time - a.time || a.title.localeCompare(b.title)).slice(0, max);
  const tokens = list.map(i => tokenize(i.title)), heads = list.map(i => tokenize(splitCredit(i.title)));
  const index = new Map();
  tokens.forEach((set, i) => { for (const t of set) (index.get(t) ?? index.set(t, []).get(t)).push(i); });
  const used = new Set(), clusters = [];
  for (let i = 0; i < list.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const members = [list[i]], near = new Set();
    for (const t of tokens[i]) for (const j of index.get(t)) if (j > i && !used.has(j)) near.add(j);
    for (const j of [...near].sort((a, b) => a - b)) {
      let same = jaccardSimilarity(tokens[i], tokens[j]) >= 0.5;
      if (!same && list[i].source !== list[j].source && jaccardSimilarity(heads[i], heads[j]) >= 1 / 3) {
        let shared = 0;
        for (const t of heads[i]) if (heads[j].has(t) && !SUPPRESSED.has(t) && !/^\d+$/.test(t)) shared++;
        same = shared >= 4;
      }
      if (same) { used.add(j); members.push(list[j]); }
    }
    const primary = [...members].sort((a, b) => a.tier - b.tier || b.time - a.time)[0];
    const times = members.map(m => m.time);
    clusters.push({ title: primary.title, tier: primary.tier, items: members, sources: new Set(members.map(m => m.source)).size,
      firstSeen: Math.min(...times), lastUpdated: Math.max(...times) });
  }
  return clusters;
}

// ---------- Velocity and sentiment ----------
export function analyzeSentiment(text) {
  let score = 0;
  for (const w of String(text).toLowerCase().split(/\W+/)) score += (POSITIVE.has(w) ? 1 : 0) - (NEGATIVE.has(w) ? 1 : 0);
  return { sentiment: score < -1 ? 'negative' : score > 1 ? 'positive' : 'neutral', score };
}
export function calculateVelocity(cluster) {
  const { items, firstSeen, lastUpdated } = cluster;
  if (items.length <= 1) return { sourcesPerHour: 0, level: 'normal', trend: 'stable', ...analyzeSentiment(cluster.title) };
  const span = lastUpdated - firstSeen, perHour = items.length / Math.max(span / HOUR, 0.25);
  const recent = items.filter(i => i.time > firstSeen + span / 2).length, older = items.length - recent;
  return { sourcesPerHour: Math.round(perHour * 10) / 10, level: perHour >= 6 ? 'spike' : perHour >= 3 ? 'elevated' : 'normal',
    trend: recent > older * 1.5 ? 'rising' : older > recent * 1.5 ? 'falling' : 'stable',
    ...analyzeSentiment(items.map(i => i.title).join(' ')) };
}

// ---------- Keyword spikes ----------
export function evaluateSpike(recent, baseline, minCount = 5, multiplier = 3) {
  if (recent < minCount) return { isSpike: false, multiplier: 0 };
  return { isSpike: baseline > 0 ? recent > baseline * multiplier : true, multiplier: baseline > 0 ? recent / baseline : 0 };
}
function termsOf(title) {
  const idx = title.lastIndexOf(' - '), tail = idx < 0 ? '' : title.slice(idx + 3).trim();
  const clean = (tail && tail.length <= 60 && !/[.!?]/.test(tail) ? title.slice(0, idx) : title).slice(0, 500);
  const terms = new Map([...tokenize(clean)].map(t => [t, t]));
  for (const re of [/CVE-\d{4}-\d{4,}/gi, /APT\d+/gi, /FIN\d+/gi]) {
    for (const m of clean.matchAll(re)) terms.set(m[0].toLowerCase(), m[0].toUpperCase());
  }
  for (const [name, re] of LEADERS) if (re.test(clean)) terms.set(name, name);
  return terms;
}
// Window of 2 h ending at the newest headline; the baseline is the earlier part of the last 7 days.
export function keywordSpikes(items, { windowMs = 2 * HOUR } = {}) {
  const dated = items.filter(i => i.time > 0);
  if (!dated.length) return [];
  const now = dated.reduce((m, i) => Math.max(m, i.time), 0), start = now - windowMs;
  const used = dated.filter(i => i.time >= now - 7 * DAY);
  const duration = start - used.reduce((m, i) => Math.min(m, i.time), now);
  if (duration <= 0) return [];
  const terms = new Map();
  for (const item of used) for (const [key, display] of termsOf(item.title)) {
    if (SUPPRESSED.has(key) || key.length < 3) continue;
    const r = terms.get(key) ?? terms.set(key, { term: display, recent: [], before: 0 }).get(key);
    if (item.time >= start) r.recent.push(item); else r.before++;
  }
  const out = [];
  for (const r of terms.values()) {
    const baseline = r.before / (duration / windowMs), d = evaluateSpike(r.recent.length, baseline);
    const sources = new Set(r.recent.map(i => i.source)).size;
    if (d.isSpike && sources >= 2) out.push({ term: r.term, count: r.recent.length, baseline, multiplier: d.multiplier, sources, sample: r.recent[0].title });
  }
  return out.sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
}

// ---------- Threat classes and headline importance ----------
const keywordRe = new Map();
const matchTable = (lower, table) => table.find(([kw]) => {
  let re = keywordRe.get(kw);
  if (!re) {
    const e = escapeRegex(kw);
    re = new RegExp(THREAT.short.includes(kw) ? `\\b${e}\\b` : THREAT.trailing.includes(kw) ? `${e}(?![\\w-])` : e);
    keywordRe.set(kw, re);
  }
  return re.test(lower);
});
export function classifyByKeyword(title) {
  let lower = String(title).toLowerCase().replace(NON_POLITICAL_COUP, ' ');
  if (!COUP_CONTEXT.test(lower)) lower = lower.replace(POLITICAL_COUP, ' ');
  if (THREAT.exclusions.some(x => lower.includes(x))) return 'info';
  if (matchTable(lower, THREAT.critical)) return 'critical';
  const high = matchTable(lower, THREAT.high);
  if (high) return ['conflict', 'military'].includes(high[1]) && ESCALATION_ACTIONS.test(lower) && ESCALATION_TARGETS.test(lower) ? 'critical' : 'high';
  return matchTable(lower, THREAT.medium) ? 'medium' : matchTable(lower, THREAT.low) ? 'low' : 'info';
}
export function scoreImportance(cluster) {
  const text = cluster.title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const n = key => IMPORTANCE[key].filter(k => text.includes(k)).length;
  let score = cluster.tier === 1 ? 35 : cluster.tier === 2 ? 20 : cluster.tier === 3 ? 8 : 0;
  score += Math.min(Math.max(1, cluster.sources), 6) * 12;
  const add = (count, base, each) => { if (count > 0) score += base + count * each; };
  const violence = n('violence'), unrest = n('unrest'), flash = n('flashpoint'), diplomacy = n('diplomacy');
  add(violence, 50, 12); add(n('military'), 40, 10); add(unrest, 35, 9); add(flash, 30, 8); add(diplomacy, 35, 9);
  if ((violence || unrest || diplomacy) && flash) score *= 1.25;
  add(n('crisis'), 15, 5);
  if (n('demote')) score *= 0.35;
  return score;
}
export const recencyWeight = (updated, now) => (updated > 0 ? Math.max(0.5, 1 - Math.max(0, (now - updated) / HOUR) / 16) : 1);

// ---------- Country instability (our adaptation) ----------
export function gdeltEscalation(current, baseline) {
  const ratio = (current + 20) / (baseline + 20);
  if (!(ratio > 1.25)) return 0;
  return Math.round(Math.min(70, Math.log(ratio / 1.25) / Math.log(3 / 1.25) * 70));
}
export function gdeltLevel(coded, total, kind) {
  if (!(total >= 200)) return 0;
  const [floor, top] = kind === 'conflict' ? [0.14, 0.40] : [0.02, 0.08];
  const scaled = (coded / total - floor) / (top - floor);
  return scaled > 0 ? Math.round(Math.min(70, scaled * 70)) : 0;
}
export const earthquakeBoost = magnitudes => Math.min(25, magnitudes.reduce((s, m) => s + (m >= 7.5 ? 10 : m >= 6.5 ? 5 : m >= 5.5 ? 2 : 0), 0));
export function instabilityScore({ baseline, unrest = 0, conflict = 0, security = 0, information = 0, quake = 0 }) {
  const event = unrest * 0.25 + conflict * 0.30 + security * 0.20 + information * 0.25;
  const urgency = information >= 70 ? 5 : information >= 50 ? 3 : 0;
  return Math.min(100, Math.round(baseline * 0.4 + event * 0.6 + urgency + quake));
}
const wordsRe = words => new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.map(escapeRegex).join('|')})(?![\\p{L}\\p{N}])`, 'iu');
let countryRes;
export function countriesInTitle(title) {
  countryRes ??= Object.entries(COUNTRY_KEYWORDS).map(([code, words]) => [code, wordsRe(words)]);
  return countryRes.filter(([, re]) => re.test(title)).map(([code]) => code);
}
export function countryIndex({ events, clusters = [], topStories = [], locate }) {
  const rows = new Map(), cache = new Map();
  const row = code => rows.get(code) ?? rows.set(code, { week: 0, month: {}, last: {}, quakes: [], story: 0, threat: 0 }).get(code);
  for (const cell of events?.cells ?? []) {
    const id = events.datasets[cell[2]]?.id;
    if (!id?.startsWith('gdelt_')) continue;
    const key = `${cell[0]},${cell[1]}`;
    if (!cache.has(key)) cache.set(key, locate(cell[0], cell[1]));
    const code = cache.get(key);
    if (!code) continue;
    const r = row(code);
    r.week += cell[3];
    r.last[id] = (r.last[id] ?? 0) + cell[3];
    r.month[id] = (r.month[id] ?? 0) + cell[4];
  }
  for (const e of events?.latest ?? []) {
    if (events.datasets[e.ds]?.id !== 'usgs_quakes' || !e.country) continue;
    if ((Date.parse(events.generated) - Date.parse(e.d)) / DAY < 7) row(e.country).quakes.push(e.weight);
  }
  const WEIGHT = { critical: 4, high: 2, medium: 1, low: 0.5 };
  for (const c of topStories) for (const code of countriesInTitle(c.title)) row(code).story += WEIGHT[classifyByKeyword(c.title)] ?? 0;
  for (const c of clusters) for (const item of c.items) {
    const codes = countriesInTitle(item.title);
    if (!codes.length) continue;
    const weight = WEIGHT[classifyByKeyword(item.title)] ?? 0;
    for (const code of codes) row(code).threat += weight;
  }
  if (events || clusters.length) for (const code of Object.keys(BASELINE_RISK)) row(code);
  const hasEvents = Boolean(events);
  return [...rows].map(([code, r]) => {
    const term = (id, kind) => {
      const week = r.last[id] ?? 0, before = Math.max(0, (r.month[id] ?? 0) - week);
      return Math.max(gdeltEscalation(week / 7, before / 23), gdeltLevel(week, r.week, kind));
    };
    const parts = { baseline: BASELINE_RISK[code] ?? 15, unrest: hasEvents ? term('gdelt_protest', 'protest') : null,
      conflict: hasEvents ? term('gdelt_conflict', 'conflict') : null,
      information: clusters.length && code in COUNTRY_KEYWORDS ? Math.min(100, r.story + Math.min(20, r.threat)) : null,
      quake: hasEvents ? earthquakeBoost(r.quakes) : null };
    return { code, ...parts, score: instabilityScore(parts), curated: code in BASELINE_RISK, events7d: r.week };
  }).sort((a, b) => b.score - a.score || b.events7d - a.events7d || a.code.localeCompare(b.code));
}
export function strategicRisk(scores) {
  const top = [...scores].sort((a, b) => b - a).slice(0, 5);
  if (!top.length) return null;
  const weights = top.map((_, i) => 1 - i * 0.15);
  const average = top.reduce((s, v, i) => s + v * weights[i], 0) / weights.reduce((s, w) => s + w, 0);
  const score = Math.min(100, Math.round(average * 0.7 + 15));
  return { score, level: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low' };
}

// ---------- Hotspot escalation ----------
export function escalationScore({ matches = 0, breaking = false, velocity = 0, cii = null, geoScore = 0, geoTypes = 0, flights = 0, vessels = 0, baseline = 3 }) {
  const news = Math.min(100, matches * 15 + (breaking ? 30 : 0) + velocity * 5);
  const geo = geoScore === 0 ? 0 : Math.min(100, geoScore + geoTypes * 10);
  const military = Math.min(100, flights * 10 + vessels * 15);
  const raw = news * 0.35 + (cii ?? 30) * 0.25 + geo * 0.25 + military * 0.15;
  return { news, cii: cii ?? 30, ciiKnown: cii !== null, geo, military, score: baseline * 0.3 + (1 + raw / 100 * 4) * 0.7 };
}
export function hotspotScores({ layers, items = [], index = [], nearby = [] }) {
  const points = (layers ?? []).find(l => l.id === 'hotspots')?.items ?? [];
  const now = items.reduce((m, i) => Math.max(m, i.time), 0);
  const recent = items.filter(i => i.time > now - 2 * HOUR);
  const byCode = new Map(index.map(r => [r.code, r.score]));
  return points.flatMap(point => {
    const spot = HOTSPOTS[point.name];
    if (!spot) return [];
    const re = wordsRe(spot.keywords), matches = recent.filter(i => re.test(i.title)).length;
    const scores = spot.countries.map(c => byCode.get(c)).filter(v => v !== undefined);
    const close = nearby.filter(c => haversineKm(point.lat, point.lon, c.lat, c.lon) <= 150);
    const best = close.sort((a, b) => b.score - a.score)[0];
    return [{ name: point.name, lon: point.lon, lat: point.lat, matches, baseline: spot.baseline,
      ...escalationScore({ matches, breaking: matches > 0, velocity: matches / 2, cii: scores.length ? Math.max(...scores) : null,
        geoScore: best?.score ?? 0, geoTypes: best?.types.length ?? 0, baseline: spot.baseline }) }];
  }).sort((a, b) => b.score - a.score);
}

// ---------- Cross-signal correlation ----------
export function correlationScore(signals, weights) {
  const best = new Map();
  for (const s of signals) best.set(s.type, Math.max(best.get(s.type) ?? 0, s.severity));
  let sum = 0;
  for (const [type, severity] of best) sum += severity * (weights[type] ?? 0);
  return Math.min(100, sum + Math.min(30, Math.max(0, best.size - 2) * 12));
}
// Union-find proximity clusters (pairwise: the input is a short list of notable events).
export function proximityClusters(signals, radiusKm) {
  const parent = signals.map((_, i) => i);
  const find = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  for (let i = 0; i < signals.length; i++) for (let j = i + 1; j < signals.length; j++) {
    if (haversineKm(signals[i].lat, signals[i].lon, signals[j].lat, signals[j].lon) <= radiusKm) parent[find(i)] = find(j);
  }
  return [...Map.groupBy(signals, (_, i) => find(i)).values()].filter(g => g.length >= 2);
}
export function disasterCorrelations(events) {
  const quakes = (events?.latest ?? []).filter(e => events.datasets[e.ds]?.id === 'usgs_quakes' && Number.isFinite(e.lat)
    && (Date.parse(events.generated) - Date.parse(e.d)) / DAY < 4)
    .map(e => ({ type: 'earthquake', severity: clamp((e.weight - 1.5) * 17, 10, 100), lat: e.lat, lon: e.lon, label: e.title }));
  return proximityClusters(quakes, 500).map(group => {
    const top = [...group].sort((a, b) => b.severity - a.severity)[0];
    return { domain: 'disaster', title: top.label, count: group.length, lat: top.lat, lon: top.lon,
      score: Math.round(correlationScore(group, { earthquake: 0.55 })) };
  }).filter(c => c.score >= 20).sort((a, b) => b.score - a.score || b.count - a.count);
}
const SANCTIONS = /\b(sanction|tariff|embargo|trade\s+war|ban|restrict|block|seize|freeze\s+assets|export\s+control|blacklist|decouple|decoupl|subsid|dumping|countervail|quota|levy|excise|retaliat|currency\s+manipulat|capital\s+controls|swift|cbdc|petrodollar|de-?dollar|opec|cartel|price\s+cap|oil|crude|commodity|shortage|stockpile|strategic\s+reserve|supply\s+chain|rare\s+earth|chip\s+ban|semiconductor|economic\s+warfare|financial\s+weapon)\b/i;
const COMPOUND = ['supply chain', 'rare earth', 'central bank', 'interest rate', 'trade war', 'oil price', 'gas price', 'federal reserve'];
const SINGLE = new Set('oil gas sanctions trade tariff commodity currency energy wheat crude gold silver copper bitcoin crypto inflation embargo opec semiconductor dollar yuan euro'.split(' '));
export const entityKey = label => {
  const lower = label.toLowerCase();
  return COMPOUND.find(p => lower.includes(p)) ?? lower.split(/\W+/).find(w => SINGLE.has(w)) ?? null;
};
// Coins use the 7-day change (the original uses the session change).
export function economicCorrelations(nodes, clusters = []) {
  const signals = [];
  for (const n of nodes ?? []) {
    const change = n.meta?.change7d;
    if (n.group !== 'coin' || !Number.isFinite(change) || Math.abs(change) < 1.5) continue;
    signals.push({ type: ['Bitcoin', 'Ethereum'].includes(n.name) ? 'commodity_spike' : 'market_move',
      severity: Math.min(100, Math.abs(change) * 10), label: `${n.name} ${change > 0 ? '+' : ''}${change.toFixed(1)}% за 7д` });
  }
  const now = clusters.reduce((m, c) => Math.max(m, c.lastUpdated), 0);
  for (const c of clusters) {
    if (now - c.lastUpdated > DAY || !SANCTIONS.test(c.title)) continue;
    const level = classifyByKeyword(c.title);
    signals.push({ type: 'sanctions_news', severity: level === 'critical' ? 85 : level === 'high' ? 70 : 50, label: c.title });
  }
  const groups = Map.groupBy(signals.filter(s => entityKey(s.label)), s => entityKey(s.label));
  return [...groups].filter(([, g]) => g.length >= 2).map(([key, g]) => ({ domain: 'economic', title: key, count: g.length,
    types: new Set(g.map(s => s.type)).size, examples: g.slice(0, 3).map(s => s.label),
    score: Math.round(correlationScore(g, { market_move: 0.35, sanctions_news: 0.30, commodity_spike: 0.35 })) }))
    .filter(c => c.score >= 20).sort((a, b) => b.score - a.score || b.count - a.count);
}

// ---------- Related assets ----------
const ASSET_LAYERS = ['pipelines', 'ai-datacenters', 'military-bases', 'nuclear-facilities'];
// Up to three assets per layer within 300 km; a line is represented by its middle vertex.
export function relatedAssets(point, layers, radiusKm = 300) {
  return (layers ?? []).filter(l => ASSET_LAYERS.includes(l.id)).flatMap(layer => layer.items.map(item => {
    const mid = item.path?.[Math.floor(item.path.length / 2)];
    const lon = mid ? mid[0] : item.lon, lat = mid ? mid[1] : item.lat;
    return { layer: layer.id, name: item.name, distanceKm: haversineKm(point.lat, point.lon, lat, lon) };
  }).filter(x => x.distanceKm <= radiusKm).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 3))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

// ---------- All results, memoized per context object ----------
const memo = new WeakMap();
let locator;
export function analyze(ctx) {
  if (memo.has(ctx)) return memo.get(ctx);
  locator ??= countryLocator(ctx.shapes ?? worldShapes.shapes);
  const events = ctx.events ?? null, items = newsItems(ctx.news), clusters = clusterNews(items);
  const now = items.reduce((m, i) => Math.max(m, i.time), 0);
  const ranked = clusters.map(c => ({ ...c, importance: scoreImportance(c) * recencyWeight(c.lastUpdated, now) }))
    .sort((a, b) => b.importance - a.importance);
  const index = countryIndex({ events, clusters, topStories: ranked.slice(0, 8), locate: locator });
  const result = {
    index, risk: strategicRisk(index.map(r => r.score)),
    anomalies: timelineAnomalies(events, ctx.date),
    convergence: convergenceCells(events).map((c, i) => (i < 10 ? { ...c, assets: relatedAssets(c, ctx.layers) } : c)),
    hotspots: hotspotScores({ layers: ctx.layers, items, index, nearby: convergenceCells(events, 2) }),
    spikes: keywordSpikes(items),
    stories: ranked.slice(0, 8).map(c => ({ ...c, velocity: calculateVelocity(c) })),
    correlations: [...disasterCorrelations(events).slice(0, 5), ...economicCorrelations(ctx.nodes, clusters).slice(0, 5)],
  };
  memo.set(ctx, result);
  return result;
}

// ---------- Panel ----------
const num = (v, digits = 0) => v.toLocaleString('ru', { maximumFractionDigits: digits });
const SEVERITY = { critical: 'критично', high: 'высоко', medium: 'средне' };
const note = textContent => el('p', { className: 'rg-note', textContent });
function block(title, rows, empty, ...extra) {
  return el('section', { className: 'rg-analytics' }, el('h3', { textContent: title }),
    rows.length ? el('ul', { className: 'rg-datasets' }, ...rows) : note(empty), ...extra);
}
function line(label, value, sub, onclick) {
  const text = el('span', {}, el('b', { textContent: label }), sub ? el('small', { textContent: sub }) : null);
  const strong = el('strong', { textContent: value });
  return el('li', {}, ...(onclick ? [el('button', { type: 'button', onclick }, text, strong)] : [text, strong]));
}

export function analyticsSection(ctx, state, handlers) {
  const a = analyze(ctx);
  const name = code => ctx.countries?.[code]?.name ?? code;
  const place = (lon, lat) => () => handlers.onPlace({ lon, lat });
  const known = v => (v === null ? 'нет данных' : num(v, 1));
  const level = { high: 'высокий', medium: 'средний', low: 'низкий' };
  return [
    el('section', { className: 'rg-analytics' },
      el('h3', { textContent: 'Сводный риск · наша адаптация' }),
      el('p', { className: 'rg-big', textContent: a.risk ? String(a.risk.score) : '—' }),
      note(a.risk ? `Уровень: ${level[a.risk.level]}. Пять самых высоких баллов стран, шкала 0–100. Это не официальный индекс worldmonitor.`
        : 'Нет данных о событиях и новостях.')),
    block('Нестабильность стран · топ-20', a.index.slice(0, 20).map(r => line(name(r.code), String(r.score),
      `база ${r.baseline}${r.curated ? '' : ' (по умолч.)'} · протесты ${known(r.unrest)} · конфликт ${known(r.conflict)} · безопасность: нет данных · новости ${known(r.information)} · сейсмика ${r.quake === null ? 'нет данных' : `+${r.quake}`}`,
      () => handlers.onCountry(r.code))), 'Нет данных.'),
    block('Аномалии по месяцам', a.anomalies.map(x => line(x.label, `z ${num(x.zScore, 1)}`,
      `${SEVERITY[x.severity]}, ${x.current > x.mean ? 'выше' : 'ниже'} нормы: ${num(x.current, 1)} в день против ${num(x.mean, 1)} (${x.samples} мес.; ${x.month} неполный)`)),
    ctx.events ? 'Отклонений с z ≥ 1,5 нет или истории меньше 10 полных месяцев.' : 'События не загружены.'),
    block('Совпадение сигналов за 7 дней', a.convergence.slice(0, 10).map(c => line(
      `${num(c.lat, 1)}°, ${num(c.lon, 1)}°`, String(c.score), `${c.types.map(t => SIGNAL_LABELS[t]).join(' + ')} · событий ${num(c.total)}${c.assets.length ? ` · рядом: ${c.assets.slice(0, 2).map(x => `${x.name} (${num(x.distanceKm)} км)`).join(', ')}` : ''}`,
      place(c.lon, c.lat))), ctx.events ? 'Нет клеток 1° с тремя типами сигналов.' : 'События не загружены.'),
    block('Горячие точки · шкала 1–5', a.hotspots.slice(0, 8).map(h => line(h.name, num(h.score, 1),
      `база ${h.baseline} · новости ${ctx.news ? num(h.news) : 'нет данных'} · страна ${h.ciiKnown ? h.cii : 'нет данных (взято 30)'} · совпадения ${ctx.events ? h.geo : 'нет данных'} · военные: нет данных`,
      place(h.lon, h.lat))), 'Слой горячих точек не загружен.'),
    block('Всплески слов за 2 часа', a.spikes.slice(0, 12).map(s => line(s.term, num(s.count),
      `источников ${s.sources} · ${s.multiplier ? `в ${num(s.multiplier, 1)} раза выше обычного` : 'раньше не встречалось'}`)),
    ctx.news ? 'Всплесков нет.' : 'Новости не загружены.'),
    block('Главные сюжеты', a.stories.map(s => line(s.title, num(s.importance),
      `источников ${s.sources} · лучший уровень ${s.tier} · ${num(s.velocity.sourcesPerHour, 1)} статей/ч`)),
    ctx.news ? 'Сюжетов нет.' : 'Новости не загружены.'),
    block('Связанные сигналы', a.correlations.map(c => (c.domain === 'disaster'
      ? line(c.title, String(c.score), `скопление землетрясений: ${c.count} в радиусе до 500 км по цепочке, 4 дня`, place(c.lon, c.lat))
      : line(`Экономика: ${c.title}`, String(c.score), `сигналов ${c.count}, типов ${c.types}: ${c.examples.join('; ')}`))),
    'Связок нет.', note('Совместное появление сигналов не доказывает причинную связь.')),
    el('details', { className: 'rg-analytics' }, el('summary', { textContent: 'Как это считается' }),
      ...[
        'Страны: 40% базовый риск (редакционные коэффициенты worldmonitor) + 60% событий: протесты 25%, конфликт 30%, безопасность 20% (данных нет, равна 0), новости 25%. Добавки: срочность новостей и землетрясения.',
        'События GDELT закодированы автоматически по СМИ. Неделя сравнивается со средним за предыдущие 23 дня и с долей в событиях страны.',
        'Новости учитываются только для 31 страны с английскими ключевыми словами, поэтому баллы стран сравнимы не полностью.',
        'Аномалии: среднее и дисперсия по Уэлфорду, z = |значение − среднее| / отклонение.',
        'Совпадения: 25 баллов за тип сигнала + до 25 за число событий в клетке 1°.',
        'Баллы служат для сравнения внутри снимка. Это не вероятности и не проверенный прогноз.',
      ].map(note)),
  ];
}
