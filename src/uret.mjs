// ferhatwork profil üreticisi — bağımlılık yok (Node 20+).
//   node src/uret.mjs gunluk          → katkı takvimi + son video → assets/*.svg
//   node src/uret.mjs oyun            → issue olayını işle (Köfte Mancınığı) → oyun/durum.json + assets/oyun.svg
//   node src/uret.mjs ornek           → yerel önizleme (sahte veri, ağ yok)
// Gizlilik: yalnızca herkese açık takvimdeki günlük TOPLAM sayılar ve YouTube RSS kullanılır. Repo adı/kod yok.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as oyun from './oyun.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V = (f) => path.join(KOK, 'src/varliklar', f);
const OUT = (f) => path.join(KOK, 'assets', f);
const KULLANICI = 'ferhatwork';
const REPO = 'ferhatwork/ferhatwork';
const KANAL = 'UCdD8eZ8GNBCZn4so3yKFlxw';

const b64 = (f) => fs.readFileSync(V(f)).toString('base64');
const font = (fam, f) => `@font-face{font-family:"${fam}";src:url(data:font/woff2;base64,${b64(f)}) format("woff2")}`;
const webp = (f) => `data:image/webp;base64,${b64(f)}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sayi = (n) => n.toLocaleString('tr-TR');
const yaz = (f, s) => { fs.mkdirSync(path.dirname(OUT(f)), { recursive: true }); fs.writeFileSync(OUT(f), s); console.log('yazıldı', f, Math.round(s.length / 1024) + ' KB'); };
const MONO = '"Martian",ui-monospace,SFMono-Regular,Consolas,monospace';
const SERIF = '"Young Serif",Georgia,serif';
const AZALT = '@media (prefers-reduced-motion:reduce){*{animation:none!important}}';

const TEMA = {
  dark: { zemin: '#17120e', bos: '#1d1814', bosK: '#2a231d', yazi: '#F5EBDD', soluk: 'rgba(245,235,221,.55)', vurgu: '#E2B48A', kofte: ['#9a5532', '#a85d35', '#b8663a', '#c8733f'], parlak: '#f2c49a' },
  light: { zemin: '#FBF5EA', bos: '#efe6d8', bosK: '#e2d5c1', yazi: '#262421', soluk: 'rgba(38,36,33,.6)', vurgu: '#8B3F32', kofte: ['#a5603a', '#97502d', '#874427', '#763920'], parlak: '#e9b07c' },
};

// ------------------------------------------------------------------ veri
async function takvim() {
  const token = process.env.GITHUB_TOKEN;
  const q = `query{user(login:"${KULLANICI}"){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount contributionLevel}}}}}}`;
  const r = await fetch('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': KULLANICI }, body: JSON.stringify({ query: q }) });
  const j = await r.json();
  if (!j.data) throw new Error('takvim alınamadı: ' + JSON.stringify(j).slice(0, 300));
  const c = j.data.user.contributionsCollection.contributionCalendar;
  const SEV = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
  return { toplam: c.totalContributions, haftalar: c.weeks.map((w) => w.contributionDays.map((d) => ({ tarih: d.date, n: d.contributionCount, s: SEV[d.contributionLevel] ?? 0 }))) };
}
async function sonVideo() {
  try {
    const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${KANAL}`);
    if (!r.ok) return null;
    const x = await r.text();
    const e = x.split('<entry>')[1];
    if (!e) return null;
    const t = (e.match(/<title>([^<]*)<\/title>/) || [])[1];
    const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return t ? decode(t) : null;
  } catch { return null; }
}
function seriler(haftalar) {
  const g = haftalar.flat();
  let enUzun = 0, cur = 0;
  for (const d of g) { cur = d.n > 0 ? cur + 1 : 0; enUzun = Math.max(enUzun, cur); }
  let simdi = 0;
  for (let i = g.length - 1; i >= 0; i--) { if (g[i].n > 0) simdi++; else if (i === g.length - 1) continue; else break; }
  const aktif = g.filter((d) => d.n > 0).length;
  return { enUzun, simdi, aktif };
}
function ornekTakvim() {
  let s = 42; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const haftalar = []; let toplam = 0;
  for (let w = 0; w < 53; w++) { const h = []; for (let d = 0; d < 7; d++) { const v = r(); const n = v < 0.45 ? 0 : Math.floor(v * v * 14); toplam += n; h.push({ n, s: n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 9 ? 3 : 4 }); } haftalar.push(h); }
  return { toplam, haftalar };
}

// ------------------------------------------------------------------ 1) Totem'in köfte yolu
function totemYolu(t, tema) {
  const T = TEMA[tema];
  const P = 20, H = 15, X0 = 40, Y0 = 126;
  const hucreler = [];
  t.haftalar.forEach((w, c) => w.forEach((d, r) => hucreler.push({ c, r, ...d })));
  // yılan sırası: çift sütun aşağı, tek sütun yukarı
  const sira = [];
  t.haftalar.forEach((w, c) => { const idx = w.map((_, r) => r); if (c % 2) idx.reverse(); idx.forEach((r) => sira.push({ c, r })); });
  // Totem boş günlerde oyalanmasın: yalnızca köfteli günlerin üstünden zıplayarak geçer
  const dolu = new Set(hucreler.filter((h) => h.s).map((h) => `${h.c}-${h.r}`));
  const durak = sira.filter((p) => dolu.has(`${p.c}-${p.r}`));
  if (durak.length) { sira.length = 0; sira.push(...durak); }
  const N = sira.length, ADIM = +Math.min(0.32, 36 / N).toFixed(3), DUR = +(N * ADIM + 2.4).toFixed(2);
  const merkez = ({ c, r }) => [X0 + c * P + H / 2, Y0 + r * P + H / 2];
  const yol = 'M' + sira.map((p) => merkez(p).map((v) => v.toFixed(1)).join(' ')).join(' L');
  const zaman = new Map(sira.map((p, i) => [`${p.c}-${p.r}`, (i * ADIM) / DUR]));
  const sonT = (N * ADIM) / DUR;
  const W = X0 * 2 + t.haftalar.length * P - (P - H);
  const Hh = Y0 + 7 * P + 52;
  let kare = '', kofte = '';
  for (const h of hucreler) {
    const x = X0 + h.c * P, y = Y0 + h.r * P;
    kare += `<rect x="${x}" y="${y}" width="${H}" height="${H}" rx="4" fill="${h.s ? T.bosK : T.bos}"/>`;
    if (!h.s) continue;
    const k = zaman.get(`${h.c}-${h.r}`), e = Math.min(k + 0.006, 0.97);
    const rr = [0, 3.6, 4.6, 5.6, 6.6][h.s], cx = x + H / 2, cy = y + H / 2;
    kofte += `<g><circle cx="${cx}" cy="${cy}" r="${rr}" fill="${T.kofte[h.s - 1]}"/><circle cx="${cx - rr * 0.35}" cy="${cy - rr * 0.35}" r="${rr * 0.32}" fill="${T.parlak}" opacity=".55"/>${h.s === 4 ? `<circle cx="${cx + 1}" cy="${cy - rr + 0.6}" r="1.6" fill="#7d9a4a"/>` : ''}<animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;${k.toFixed(4)};${e.toFixed(4)};.985;1" dur="${DUR}s" repeatCount="indefinite"/></g>`;
  }
  const s = seriler(t.haftalar);
  const toplananSay = hucreler.filter((h) => h.s).length;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" role="img" aria-label="Mini Totem son bir yılın katkı takviminde köfte topluyor: ${sayi(t.toplam)} katkı">
<title>Mini Totem'in köfte yolu · son bir yılda ${sayi(t.toplam)} katkı</title>
<style>${font('Martian', 'martian.woff2')}${font('Young Serif', 'youngserif.woff2')}
.l{font:400 12px ${MONO};letter-spacing:2.4px;fill:${T.vurgu}}
.b{font:400 30px ${SERIF};letter-spacing:-.6px;fill:${T.yazi}}
.k{font:400 12px ${MONO};letter-spacing:.6px;fill:${T.soluk}}
.zipla{animation:z ${ADIM}s ease-in-out infinite}
@keyframes z{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}${AZALT}</style>
<defs><clipPath id="w"><rect width="${W}" height="${Hh}" rx="18"/></clipPath><radialGradient id="rg" cx=".1" cy=".2" r=".7"><stop offset="0" stop-color="#C0634F" stop-opacity=".18"/><stop offset="1" stop-color="#C0634F" stop-opacity="0"/></radialGradient></defs>
<g clip-path="url(#w)"><rect width="${W}" height="${Hh}" fill="${T.zemin}"/><rect width="${W}" height="${Hh}" fill="url(#rg)"/>
<text class="l" x="${X0}" y="42">MİNİ TOTEM'İN KÖFTE YOLU</text>
<text class="b" x="${X0 - 2}" y="78">Son bir yılda ${sayi(t.toplam)} katkı</text>
<text class="k" x="${W - X0}" y="40" text-anchor="end" dy="12">en uzun seri ${s.enUzun} gün · ${s.aktif} üretken gün</text>
<text class="k" x="${W - X0}" y="62" text-anchor="end" dy="12">her köfte bir gün · koyusu daha dolu</text>
${kare}${kofte}
<g><g class="zipla"><ellipse cx="0" cy="6" rx="10" ry="3" fill="#000" opacity=".25"/><image href="${webp('totem-kucuk.webp')}" x="-17" y="-44" width="34" height="49"/></g>
<animateMotion dur="${DUR}s" repeatCount="indefinite" path="${yol} L${merkez(sira[N - 1]).join(' ')}" keyPoints="0;1;1" keyTimes="0;${sonT.toFixed(4)};1" calcMode="linear"/></g>
<text class="k" x="${X0}" y="${Hh - 22}">${toplananSay} köfte · takvim her gece yenilenir</text>
<rect x=".75" y=".75" width="${W - 1.5}" height="${Hh - 1.5}" rx="17.5" fill="none" stroke="rgba(245,235,221,.12)" stroke-width="1.5"/></g>
</svg>`;
  yaz(tema === 'dark' ? 'totem-yolu.svg' : `totem-yolu-${tema}.svg`, svg);
}

// ------------------------------------------------------------------ 2) terminal durum kartı
function durumKarti(t, video) {
  const s = seriler(t.haftalar);
  const kisalt = (x, n) => (x.length > n ? x.slice(0, n - 1) + '…' : x);
  const satir = [
    ['kim', 'Ferhat Özdemir · 9 yıl e-ticaret'],
    ['şu an', 'yapay zekâyla ürün yapıyor, anlatıyor'],
    ['yayında', 'Profitcen · Sideleaf · Profitcen Tray'],
    ['yapımda', 'uncus.si · şimdilik sır'],
    ['son video', video ? kisalt(video, 34) : 'ilk bölüm yolda'],
    ['bu yıl', `${sayi(t.toplam)} katkı · ` + (s.simdi > 1 ? `seri ${s.simdi} gün` : `en uzun seri ${s.enUzun} gün`)],
    ['motto', 'Başka türlü de olur.'],
  ];
  const W = 1000, H = 430, TX = 330;
  const sat = satir.map(([a, b], i) => `<text class="r" x="${TX}" y="${150 + i * 32}"><tspan class="a">${esc(a.padEnd(10, ' '))}</tspan><tspan class="v">${esc(b)}</tspan></text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="ferhatwork --durum: ${esc(satir.map((x) => x.join(': ')).join(' · '))}">
<title>ferhatwork --durum</title>
<style>${font('Martian', 'martian.woff2')}
.r,.p{font:400 15px ${MONO};white-space:pre}
.a{fill:#C68A58}.v{fill:#F5EBDD}.p{fill:rgba(245,235,221,.6)}.p b{fill:#E2B48A}
.c{fill:#E2B48A;animation:bl 1.1s steps(1) infinite}@keyframes bl{50%{opacity:0}}
.tl{transform-box:fill-box;transform-origin:50% 100%;animation:n 4.6s ease-in-out infinite}@keyframes n{0%,100%{transform:none}50%{transform:translateY(-5px) scale(1.01,1.016)}}
.sc{animation:sc 6s linear infinite}@keyframes sc{from{transform:translateY(-60px)}to{transform:translateY(${H}px)}}${AZALT}</style>
<defs><clipPath id="w"><rect width="${W}" height="${H}" rx="18"/></clipPath><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E2B48A" stop-opacity="0"/><stop offset=".5" stop-color="#E2B48A" stop-opacity=".06"/><stop offset="1" stop-color="#E2B48A" stop-opacity="0"/></linearGradient>
<radialGradient id="rg" cx=".16" cy=".62" r=".45"><stop offset="0" stop-color="#C0634F" stop-opacity=".28"/><stop offset="1" stop-color="#C0634F" stop-opacity="0"/></radialGradient></defs>
<g clip-path="url(#w)">
<rect width="${W}" height="${H}" fill="#17120e"/><rect width="${W}" height="${H}" fill="url(#rg)"/>
<rect width="${W}" height="44" fill="#211a15"/>
<circle cx="26" cy="22" r="6.5" fill="#C0634F"/><circle cx="48" cy="22" r="6.5" fill="#C68A58"/><circle cx="70" cy="22" r="6.5" fill="#7a8a52"/>
<text class="p" x="${W / 2}" y="27" text-anchor="middle">ferhat@ferhat.work — mağara</text>
<image class="tl" href="${webp('totem-laptop.webp')}" x="22" y="78" width="297" height="330"/>
<text class="p" x="${TX}" y="102">ferhat@ferhat.work:~$ <tspan fill="#F5EBDD">ferhatwork --durum</tspan></text>
<line x1="${TX}" x2="${W - 40}" y1="120" y2="120" stroke="rgba(245,235,221,.14)"/>
${sat}
<text class="p" x="${TX}" y="${150 + satir.length * 32 + 12}">ferhat@ferhat.work:~$ <tspan fill="#E2B48A">█<animate attributeName="fill-opacity" values="1;0" dur="1.1s" calcMode="discrete" repeatCount="indefinite"/></tspan></text>
<rect class="sc" width="${W}" height="60" fill="url(#g)"/>
<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="17.5" fill="none" stroke="rgba(245,235,221,.12)" stroke-width="1.5"/>
</g></svg>`;
  yaz('durum.svg', svg);
}

// ------------------------------------------------------------------ 3) Köfte Mancınığı (src/oyun.mjs)
const DURUM_F = path.join(KOK, 'oyun/durum.json');
const CIZ = { font, webp, MONO, SERIF, AZALT };
function oyunDurumu() { try { return JSON.parse(fs.readFileSync(DURUM_F, 'utf8')); } catch { return oyun.yeniDurum(); } }
function oyunCiz(d) { yaz('oyun.svg', oyun.oyunSvg(d, CIZ)); }
function dugmeler() { for (let a = 1; a <= 3; a++) for (let g = 1; g <= 5; g++) yaz(`oyun/a${a}g${g}.svg`, oyun.dugmeSvg(a, g, CIZ)); }

async function gh(yol, govde, yontem = 'POST') {
  const r = await fetch(`https://api.github.com/repos/${REPO}${yol}`, { method: yontem, headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': KULLANICI }, body: JSON.stringify(govde) });
  if (!r.ok) console.error('github', yol, r.status, await r.text());
}
async function oyunIsle() {
  const olay = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const issue = olay.issue;
  const m = String(issue.title || '').trim().match(/^mancinik\|a([1-3])\|g([1-5])$/i);
  if (!m) return;
  const kim = String(issue.user.login).replace(/[^A-Za-z0-9-]/g, '').slice(0, 39);
  const { d, yorum, degisti } = oyun.oyna(oyunDurumu(), kim, +m[1], +m[2], Date.now());
  if (degisti) {
    fs.mkdirSync(path.dirname(DURUM_F), { recursive: true });
    fs.writeFileSync(DURUM_F, JSON.stringify(d));
    oyunCiz(d);
  }
  await gh(`/issues/${issue.number}/comments`, { body: yorum + `\n\n[Profile dön ve sahneyi gör →](https://github.com/${KULLANICI})` });
  await gh(`/issues/${issue.number}`, { state: 'closed', state_reason: 'completed' }, 'PATCH');
}

// ------------------------------------------------------------------ giriş
const kip = process.argv[2];
if (kip === 'gunluk') {
  const t = await takvim(); const v = await sonVideo();
  totemYolu(t, 'dark'); durumKarti(t, v);
  oyunCiz(oyunDurumu()); // rüzgâr bayrağı vb. her gün tazelenir
  if (!fs.existsSync(OUT('oyun/a1g1.svg'))) dugmeler();
} else if (kip === 'oyun') {
  await oyunIsle();
} else if (kip === 'ornek') {
  const t = ornekTakvim();
  totemYolu(t, 'dark'); durumKarti(t, null);
  let d = oyun.yeniDurum(); let t0 = 0;
  const oyuncular = ['ornek-oyuncu', 'baska', 'ucuncu', 'dorduncu'];
  for (let k = 0; k < 14; k++) { const r = oyun.oyna(d, oyuncular[k % 4], 1 + (k % 3), 1 + ((k * 2) % 5), (t0 += 3e5)); d = r.d; if (k === 13) console.log(r.yorum); }
  oyunCiz(d); dugmeler();
} else {
  console.log('kullanım: node src/uret.mjs gunluk|oyun|ornek'); process.exit(1);
}
