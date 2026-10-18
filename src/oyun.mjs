// Köfte Mancınığı v2 — issue ile oynanan, sıra tabanlı fizik oyunu.
// Başlık biçimi: mancinik|a<1-3>|g<1-5>   (a = açı: alçak/orta/yüksek, g = güç)
// Kurallar: rüzgâr her atışta değişir (bir sonraki atışın rüzgârı sahnede yazar), 3 hedef var
// (kazan 5, tabak 3, sepet 1 puan). Kazanı vuran seviyeyi geçirir; seviye 2'den sonra kaya duvar çıkar.
// Her isabet Totem'in karnını doldurur; karın dolunca ziyafet olur.
import crypto from 'node:crypto';

export const ACILAR = [30, 45, 70];
export const ACI_AD = ['alçak', 'orta', 'yüksek'];
const G = 9.8, ALAN = 30, KARIN = 40;
const HEDEF_TUR = [
  { ad: 'kazan', r: 0.8, puan: 5 },
  { ad: 'tabak', r: 1.3, puan: 3 },
  { ad: 'sepet', r: 2.0, puan: 1 },
];

function rng(tohum) {
  let a = crypto.createHash('sha256').update(String(tohum)).digest().readUInt32BE(0);
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const tuz = () => process.env.OYUN_TUZU || 'mağara';

export function yeniDurum() {
  return { surum: 2, seviye: 1, atis: 0, karin: 0, ziyafet: 0, skor: {}, oyuncular: [], son: [], sonAtisZaman: {} };
}
export function seviyeDuzeni(seviye) {
  const r = rng(`${tuz()}|seviye|${seviye}`);
  const hedefler = [];
  for (const h of HEDEF_TUR) {
    let x, deneme = 0;
    do { x = 7 + r() * 21; deneme++; } while (hedefler.some((o) => Math.abs(o.x - x) < 3.4) && deneme < 50);
    hedefler.push({ ...h, x: +x.toFixed(1) });
  }
  let duvar = null;
  if (seviye >= 2) {
    const kazan = hedefler[0];
    const dx = Math.max(4, kazan.x - 3 - r() * 3);
    duvar = { x: +dx.toFixed(1), h: +(1.6 + Math.min(seviye, 6) * 0.45 + r()).toFixed(1) };
  }
  return { hedefler, duvar };
}
export function ruzgar(d) {
  const r = rng(`${tuz()}|ruzgar|${d.seviye}|${d.atis}`);
  return +((r() * 2 - 1) * 1.6).toFixed(1);
}
export function atisYap(aciNo, guc, w, duzen) {
  const th = (ACILAR[aciNo - 1] * Math.PI) / 180, v = 5 + 2.2 * guc;
  const vx = v * Math.cos(th), vy = v * Math.sin(th);
  const tSon = (2 * vy) / G;
  const yol = [];
  let carpti = false, x = 0;
  for (let i = 0; i <= 48; i++) {
    const t = (tSon * i) / 48;
    x = vx * t + 0.5 * w * t * t;
    const y = vy * t - 0.5 * G * t * t;
    if (duzen.duvar && !carpti) {
      const onceki = yol[yol.length - 1];
      if (onceki && onceki[0] < duzen.duvar.x && x >= duzen.duvar.x) {
        // duvarın hizasındaki yükseklik
        const k = (duzen.duvar.x - onceki[0]) / (x - onceki[0]);
        const yd = onceki[1] + (y - onceki[1]) * k;
        if (yd < duzen.duvar.h) {
          carpti = true;
          yol.push([duzen.duvar.x - 0.15, yd], [duzen.duvar.x - 0.6, 0]);
          x = duzen.duvar.x - 0.6;
          break;
        }
      }
    }
    yol.push([x, Math.max(0, y)]);
  }
  if (!carpti) x = yol[yol.length - 1][0];
  const inis = +Math.max(-1, Math.min(ALAN + 2, x)).toFixed(1);
  let vurulan = null;
  if (!carpti) for (const h of duzen.hedefler) if (Math.abs(inis - h.x) <= h.r) { vurulan = h; break; }
  return { inis, carpti, vurulan, yol: yol.map(([a, b]) => [+a.toFixed(2), +b.toFixed(2)]) };
}

export function oyna(d, kim, aciNo, guc, simdi) {
  if (d.surum !== 2) d = Object.assign(yeniDurum(), { skor: d.skor || {} });
  const once = d.sonAtisZaman[kim] || 0;
  if (simdi - once < 2 * 60 * 1000) return { d, yorum: `Mancınık soğuyor 🔥 Aynı kişi 2 dakikada bir atabilir, @${kim}. Biraz sonra tekrar dene.`, degisti: false };
  const w = ruzgar(d), duzen = seviyeDuzeni(d.seviye);
  const s = atisYap(aciNo, guc, w, duzen);
  d.sonAtisZaman[kim] = simdi;
  d.atis++;
  d.oyuncular = d.oyuncular || [];
  if (!d.oyuncular.includes(kim)) d.oyuncular.push(kim);
  let puan = 0, sonuc, yorum;
  const metre = `${s.inis.toLocaleString('tr-TR')} m`;
  const ayar = `${ACI_AD[aciNo - 1]} açı, güç ${guc}, rüzgâr ${w > 0 ? '→' : w < 0 ? '←' : '·'} ${Math.abs(w)}`;
  if (s.carpti) {
    sonuc = 'duvar';
    yorum = `🪨 **Duvara çarptı!** (${ayar}). Köfte kayaya yapıştı, daha yüksek bir açı dene.`;
  } else if (s.vurulan) {
    puan = s.vurulan.puan;
    sonuc = s.vurulan.ad;
    d.skor[kim] = (d.skor[kim] || 0) + puan;
    d.karin += puan;
    yorum = `🎯 **${s.vurulan.ad[0].toUpperCase() + s.vurulan.ad.slice(1)}! +${puan} puan** (${ayar}). Köfte ${metre}'ye düştü. Toplam puanın: ${d.skor[kim]}.`;
    if (s.vurulan.ad === 'kazan') { d.seviye++; yorum += `\n\n🍲 Kazanı vurdun, **seviye ${d.seviye}** açıldı! Hedefler yer değiştirdi${d.seviye === 2 ? ', artık arada bir kaya var' : ''}.`; }
    if (d.karin >= KARIN) { d.karin -= KARIN; d.ziyafet++; yorum += `\n\n🎉 **Totem'in karnı doydu!** ${d.ziyafet}. ziyafet senin atışınla geldi.`; }
  } else {
    sonuc = 'iska';
    const en = duzen.hedefler.reduce((a, h) => (Math.abs(h.x - s.inis) < Math.abs(a.x - s.inis) ? h : a));
    const fark = en.x - s.inis;
    yorum = `Iska (${ayar}). Köfte ${metre}'ye düştü; en yakın hedef **${en.ad}**, ${Math.abs(fark).toFixed(1)} m ${fark > 0 ? 'ileride' : 'geride'}.`;
  }
  d.son.unshift({ kim, a: aciNo, g: guc, w, x: s.inis, sonuc, puan, yol: s.yol });
  d.son[0].duzenSeviye = s.vurulan?.ad === 'kazan' ? d.seviye - 1 : d.seviye;
  d.son = d.son.slice(0, 6);
  for (const [k, v] of Object.entries(d.sonAtisZaman)) if (simdi - v > 864e5) delete d.sonAtisZaman[k];
  yorum += `\n\nSıradaki atışın rüzgârı: ${(() => { const n = ruzgar(d); return `${n > 0 ? '→' : n < 0 ? '←' : '·'} ${Math.abs(n)}`; })()}`;
  return { d, yorum, degisti: true };
}

// ------------------------------------------------------------------ çizim
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function oyunSvg(d, { font, webp, MONO, SERIF, AZALT }) {
  const W = 1000, H = 580, FX = 190, PX = 25, GY = 400;
  const mx = (m) => FX + m * PX, my = (m) => GY - m * PX * 0.92;
  const duzen = seviyeDuzeni(d.seviye);
  const son = d.son[0];
  const w = ruzgar(d);
  // zemin silueti
  let zemin = `M0 ${GY + 6}`;
  for (let x = 0; x <= W; x += 50) zemin += ` Q${x + 25} ${GY + 2 + ((x / 50) % 2 ? -4 : 5)} ${x + 50} ${GY + 6}`;
  zemin += ` L${W} ${H} L0 ${H}Z`;
  // sarkıtlar
  const r = rng('sarkit');
  let sarkit = '';
  for (let x = 0; x < W; x += 34 + Math.floor(r() * 30)) { const h = 18 + r() * 60, g = 10 + r() * 16; sarkit += `M${x} 0 L${x + g / 2} ${h.toFixed(0)} L${x + g} 0Z `; }
  // cetvel
  let cetvel = '';
  for (let m = 5; m <= ALAN; m += 5) cetvel += `<line x1="${mx(m)}" x2="${mx(m)}" y1="${GY + 12}" y2="${GY + 20}" stroke="rgba(245,235,221,.35)"/><text class="t" x="${mx(m)}" y="${GY + 36}" text-anchor="middle">${m} m</text>`;
  // hedefler
  const ciz = {
    kazan: (x) => `<g transform="translate(${x} ${GY})"><path d="M-22 -30 h44 l-4 24 a6 6 0 0 1 -6 6 h-24 a6 6 0 0 1 -6 -6z" fill="#3a2f28" stroke="#7a5a46" stroke-width="2"/><rect x="-26" y="-34" width="52" height="7" rx="3.5" fill="#5a4636"/><ellipse cx="0" cy="-33" rx="20" ry="4" fill="#C0634F"/>
      <g class="buhar" fill="none" stroke="rgba(245,235,221,.45)" stroke-width="2" stroke-linecap="round"><path d="M-8 -40 q-5 -8 0 -16 q5 -8 0 -16"/><path d="M6 -42 q5 -8 0 -16 q-5 -8 0 -16" style="animation-delay:-1.3s"/></g></g>`,
    tabak: (x) => `<g transform="translate(${x} ${GY})"><ellipse cx="0" cy="-5" rx="32" ry="7" fill="#e9dcc8"/><ellipse cx="0" cy="-6" rx="22" ry="4.2" fill="#d8c6aa"/></g>`,
    sepet: (x) => `<g transform="translate(${x} ${GY})"><path d="M-40 -26 h80 l-7 26 h-66z" fill="#8a6a44"/><path d="M-36 -18 h72 M-34 -10 h68" stroke="#6d5233" stroke-width="2"/><path d="M-30 -26 q30 -30 60 0" fill="none" stroke="#8a6a44" stroke-width="4"/></g>`,
  };
  let hedefler = '';
  for (const h of duzen.hedefler) {
    const x = mx(h.x);
    hedefler += `<rect x="${mx(h.x - h.r)}" y="${GY + 1}" width="${(h.r * 2 * PX).toFixed(1)}" height="4" rx="2" fill="${h.ad === 'kazan' ? '#C0634F' : 'rgba(226,180,138,.5)'}" opacity=".7"/>${ciz[h.ad](x)}<text class="p" x="${x}" y="${GY - 66}" text-anchor="middle">${h.puan}</text>`;
  }
  const duvar = duzen.duvar ? (() => { const x = mx(duzen.duvar.x), y = my(duzen.duvar.h); return `<g><path d="M${x - 22} ${GY + 4} L${x - 18} ${y + 30} L${x - 10} ${y + 8} L${x - 2} ${y} L${x + 8} ${y + 6} L${x + 14} ${y + 26} L${x + 20} ${GY + 4}Z" fill="#4a3a30" stroke="#6b5444" stroke-width="2" stroke-linejoin="round"/><path d="M${x - 8} ${y + 22} l6 10 M${x + 4} ${y + 40} l-5 9" stroke="#2f241d" stroke-width="2"/><path d="M${x - 34} ${GY + 4} q8 -16 18 -2 M${x + 18} ${GY + 4} q10 -12 20 0" fill="#3f322a"/></g>`; })() : '';
  // önceki iniş izleri
  const izler = d.son.slice(1).filter((a) => a.duzenSeviye === d.seviye).map((a) => `<ellipse cx="${mx(a.x)}" cy="${GY + 3}" rx="7" ry="2.6" fill="#a85d35" opacity=".45"/>`).join('');
  // son atış
  let atis = '', patlama = '';
  const DUR = 4.2, UCUS = 0.62;
  if (son && son.yol && son.duzenSeviye === d.seviye) {
    const p = 'M' + son.yol.map(([a, b]) => `${mx(a).toFixed(1)} ${my(b).toFixed(1)}`).join(' L');
    const [ix, iy] = son.yol[son.yol.length - 1];
    atis = `<path class="iz" d="${p}" pathLength="100" fill="none" stroke="#E2B48A" stroke-width="2" stroke-dasharray="1.2 2.2" opacity=".55"/>
<g><circle r="8" fill="#a85d35"/><circle cx="-2.6" cy="-2.6" r="2.6" fill="#f2c49a" opacity=".7"/><circle cx="2" cy="-7" r="2" fill="#7d9a4a"/>
<animateMotion dur="${DUR}s" repeatCount="indefinite" path="${p}" keyPoints="0;0;1;1" keyTimes="0;.12;${UCUS};1" calcMode="linear" rotate="auto"/>
<animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.12;${UCUS};${UCUS + 0.05};1" dur="${DUR}s" repeatCount="indefinite"/></g>`;
    const renk = son.puan ? '#f2c49a' : '#E2B48A';
    patlama = `<g transform="translate(${mx(ix).toFixed(1)} ${my(iy).toFixed(1)})">${[0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI - Math.PI; return `<circle r="3" fill="${renk}"><animate attributeName="cx" values="0;0;${(Math.cos(a) * 26).toFixed(1)}" keyTimes="0;${UCUS};1" dur="${DUR}s" repeatCount="indefinite"/><animate attributeName="cy" values="0;0;${(Math.sin(a) * 22).toFixed(1)}" keyTimes="0;${UCUS};1" dur="${DUR}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0;1;0" keyTimes="0;${UCUS};${UCUS + 0.02};.92" dur="${DUR}s" repeatCount="indefinite"/></circle>`; }).join('')}
${son.puan ? `<text class="arti" y="-30" text-anchor="middle">+${son.puan}<animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${UCUS};${UCUS + 0.03};.9;1" dur="${DUR}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -24" keyTimes="0;${UCUS};1" dur="${DUR}s" repeatCount="indefinite"/></text>` : ''}</g>`;
  }
  // rüzgâr bayrağı
  const bx = 600, by = 92, yon = w >= 0 ? 1 : -1, boy = 16 + Math.abs(w) * 22;
  const bayrak = `<g transform="translate(${bx} ${by})"><line x1="0" y1="0" x2="0" y2="58" stroke="#9a7650" stroke-width="3"/>
<g class="bayrak" style="transform-origin:0 6px"><path d="M0 2 L${yon * boy} 8 L0 16Z" fill="#C0634F"/></g>
<text class="t" x="14" y="76" text-anchor="middle">sıradaki rüzgâr ${w > 0 ? '→' : w < 0 ? '←' : '·'} ${Math.abs(w)}</text></g>`;
  // skor tablosu
  const skor = Object.entries(d.skor).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const madalya = ['#E2B48A', '#cfc6bb', '#b07a52', 'rgba(245,235,221,.35)', 'rgba(245,235,221,.35)'];
  const tablo = skor.length ? skor.map(([k, v], i) => `<circle cx="${W - 210}" cy="${84 + i * 24}" r="5" fill="${madalya[i]}"/><text class="s" x="${W - 196}" y="${89 + i * 24}">@${esc(k.slice(0, 15))}</text><text class="s" x="${W - 40}" y="${89 + i * 24}" text-anchor="end">${v}</text>`).join('') : `<text class="t" x="${W - 40}" y="89" text-anchor="end">ilk puanı sen al</text>`;
  // alt panel
  const sonYazi = !son ? 'Henüz atış yok. İlk köfteyi sen fırlat.'
    : `@${son.kim} · ${ACI_AD[son.a - 1]} açı · güç ${son.g} → ${son.x.toLocaleString('tr-TR')} m · ` + (son.sonuc === 'duvar' ? 'duvara çarptı' : son.puan ? `${son.sonuc}! +${son.puan}` : 'ıska');
  const karinW = 220, karinD = Math.min(1, d.karin / KARIN);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Köfte Mancınığı, seviye ${d.seviye}. ${esc(sonYazi)}">
<title>Köfte Mancınığı · seviye ${d.seviye}</title>
<style>${font('Martian', 'martian.woff2')}${font('Young Serif', 'youngserif.woff2')}
.l{font:400 12px ${MONO};letter-spacing:2.4px;fill:#E2B48A}
.b{font:400 38px ${SERIF};letter-spacing:-.8px;fill:#F5EBDD}
.i{font:400 19px ${SERIF};fill:#F5EBDD}
.t{font:400 11px ${MONO};fill:rgba(245,235,221,.55)}
.s{font:400 13px ${MONO};fill:#F5EBDD}
.p{font:400 15px ${SERIF};fill:#E2B48A}
.arti{font:400 30px ${SERIF};fill:#f2c49a}
.iz{stroke-dashoffset:0;animation:iz ${DUR}s linear infinite}@keyframes iz{0%,12%{opacity:0}20%{opacity:.55}100%{opacity:.55}}
.kol{transform-box:view-box;transform-origin:${FX - 40}px ${GY - 48}px;animation:kol ${DUR}s cubic-bezier(.5,0,.2,1) infinite}@keyframes kol{0%,4%{transform:rotate(-52deg)}12%{transform:rotate(14deg)}34%,100%{transform:rotate(-52deg)}}
.bayrak{animation:by 1.4s ease-in-out infinite}@keyframes by{0%,100%{transform:scaleY(1) skewY(0)}50%{transform:scaleY(.86) skewY(${yon * 6}deg)}}
.buhar path{animation:bh 2.6s ease-in-out infinite;opacity:.0}@keyframes bh{0%{transform:translateY(6px);opacity:0}40%{opacity:.8}100%{transform:translateY(-14px);opacity:0}}
.totem{transform-box:fill-box;transform-origin:50% 100%;animation:zp ${DUR}s ease-in-out infinite}@keyframes zp{0%,60%,100%{transform:none}66%{transform:translateY(-10px)}72%{transform:none}}
.toz{animation:tz 14s linear infinite}@keyframes tz{from{transform:translateX(0)}to{transform:translateX(-120px)}}
.dol{animation:dl 1.6s cubic-bezier(.16,1,.3,1) both}@keyframes dl{from{transform:scaleX(0)}}
${AZALT}</style>
<defs><clipPath id="w"><rect width="${W}" height="${H}" rx="18"/></clipPath>
<radialGradient id="rg" cx=".18" cy=".66" r=".55"><stop offset="0" stop-color="#C0634F" stop-opacity=".3"/><stop offset="1" stop-color="#C0634F" stop-opacity="0"/></radialGradient>
<radialGradient id="kz" cx="${mx(duzen.hedefler[0].x) / W}" cy="${GY / H}" r=".22"><stop offset="0" stop-color="#E2B48A" stop-opacity=".16"/><stop offset="1" stop-color="#E2B48A" stop-opacity="0"/></radialGradient>
<linearGradient id="zg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a211b"/><stop offset="1" stop-color="#120e0b"/></linearGradient></defs>
<g clip-path="url(#w)">
<rect width="${W}" height="${H}" fill="#17120e"/><rect width="${W}" height="${H}" fill="url(#rg)"/><rect width="${W}" height="${H}" fill="url(#kz)"/>
<path d="${sarkit}" fill="#0f0b08" opacity=".9"/>
<g class="toz" fill="#E2B48A" opacity=".35">${[...Array(16)].map((_, i) => `<circle cx="${(i * 73) % 1120}" cy="${130 + ((i * 47) % 220)}" r="${1 + (i % 3) * 0.6}"/>`).join('')}</g>
<text class="l" x="40" y="58">OYUN · SEVİYE ${d.seviye}${duzen.duvar ? ' · KAYA VAR' : ''}</text>
<text class="b" x="38" y="102">Köfte Mancınığı</text>
<text class="t" x="40" y="128">${d.atis} atış · ${(d.oyuncular || []).length} oyuncu · ${d.ziyafet} ziyafet</text>
<text class="l" x="${W - 40}" y="58" text-anchor="end">SKOR TABLOSU</text>
${tablo}
${bayrak}
${duvar}
${hedefler}
${izler}
<path d="${zemin}" fill="url(#zg)"/><path d="${zemin.split(' L')[0]}" fill="none" stroke="#5a4636" stroke-width="2"/>
${cetvel}
<!-- mancınık -->
<g transform="translate(${FX - 40} ${GY})">
<rect x="-62" y="-20" width="124" height="14" rx="5" fill="#5a3d2a"/>
<circle cx="-44" cy="-4" r="13" fill="#2d211a" stroke="#8a6a44" stroke-width="3"/><circle cx="44" cy="-4" r="13" fill="#2d211a" stroke="#8a6a44" stroke-width="3"/>
<path d="M-20 -20 L0 -50 L20 -20" fill="none" stroke="#8a6a44" stroke-width="8" stroke-linejoin="round"/></g>
<g class="kol"><rect x="${FX - 44}" y="${GY - 150}" width="8" height="106" rx="4" fill="#b08a5c"/><path d="M${FX - 58} ${GY - 156} h36 a5 5 0 0 1 0 10 h-36 a5 5 0 0 1 0 -10z" fill="#E2B48A"/></g>
<image class="totem" href="${webp('totem-kucuk.webp')}" x="${FX - 170}" y="${GY - 92}" width="64" height="92"/>
${atis}${patlama}
<line x1="40" x2="${W - 40}" y1="${GY + 62}" y2="${GY + 62}" stroke="rgba(245,235,221,.1)"/>
<text class="i" x="40" y="${GY + 100}">${esc(sonYazi)}</text>
<text class="t" x="40" y="${GY + 130}">${esc(d.son.slice(1, 5).map((a) => `@${a.kim.slice(0, 12)} ${a.puan ? '+' + a.puan : a.sonuc === 'duvar' ? 'kaya' : 'ıska'}`).join('   ·   '))}</text>
<text class="l" x="${W - 40 - karinW}" y="${GY + 94}">TOTEM'İN KARNI</text>
<rect x="${W - 40 - karinW}" y="${GY + 106}" width="${karinW}" height="12" rx="6" fill="rgba(245,235,221,.1)"/>
<rect class="dol" x="${W - 40 - karinW}" y="${GY + 106}" width="${Math.max(12, karinW * karinD).toFixed(1)}" height="12" rx="6" fill="#C0634F" style="transform-origin:${W - 40 - karinW}px 0"/>
<text class="t" x="${W - 40}" y="${GY + 140}" text-anchor="end">${d.karin}/${KARIN} puan · dolunca ziyafet</text>
<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="17.5" fill="none" stroke="rgba(245,235,221,.12)" stroke-width="1.5"/>
</g></svg>`;
  return svg;
}

export function dugmeSvg(aciNo, guc, { font, SERIF }) {
  const W = 120, H = 64, th = (ACILAR[aciNo - 1] * Math.PI) / 180;
  const cubuk = [...Array(5)].map((_, i) => `<rect x="${46 + i * 10}" y="${42 - (i + 1) * 5}" width="7" height="${(i + 1) * 5}" rx="2" fill="${i < guc ? '#8B3F32' : 'rgba(23,18,14,.18)'}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${ACI_AD[aciNo - 1]} açı, güç ${guc}"><title>${ACI_AD[aciNo - 1]} açı, güç ${guc}</title>
<style>.t{font:700 26px Georgia,serif;fill:#17120e}</style>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="#E2B48A" stroke="#C68A58" stroke-width="2"/>
<g transform="translate(14 46)"><line x1="0" y1="0" x2="${(Math.cos(th) * 26).toFixed(1)}" y2="${(-Math.sin(th) * 26).toFixed(1)}" stroke="#17120e" stroke-width="3" stroke-linecap="round"/><circle r="3.5" fill="#17120e"/><circle cx="${(Math.cos(th) * 28).toFixed(1)}" cy="${(-Math.sin(th) * 28).toFixed(1)}" r="4.5" fill="#a85d35"/></g>
${cubuk}<text class="t" x="${W - 12}" y="${H - 22}" text-anchor="end" style="font-size:20px">${guc}</text></svg>`;
}
