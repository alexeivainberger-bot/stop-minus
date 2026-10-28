/* Собрано из исходников проекта. Код проприетарный, все права защищены. */

/* src/calc.js */
(function (root, factory) {
if (typeof module === 'object' && module.exports) {
module.exports = factory();
} else {
root.WbMarginCalc = factory();
}
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';
var FORMULA_VERSION = '2026-10-28.1';
var DEFAULTS = {
price: 0,
cost: 0,
packaging: 0,
logistics: 0,
commissionPct: 15,
taxPct: 6,
buyoutPct: 90,
returnCost: 50,
otherCosts: 0,
thresholdPct: 15
};
function toNum(value) {
if (typeof value === 'number') return isFinite(value) ? value : 0;
if (value === null || value === undefined) return 0;
var s = String(value)
.replace(/[\s\u00a0\u202f]/g, '')
.replace(/руб\.?/gi, '')
.replace(/₽/g, '')
.replace(',', '.')
.replace(/[^\d.\-]/g, '');
var n = parseFloat(s);
return isFinite(n) ? n : 0;
}
function clampPct(value) {
var n = toNum(value);
return Math.min(Math.max(n, 0), 100);
}
function round(n, digits) {
var m = Math.pow(10, digits === undefined ? 2 : digits);
return Math.round(n * m) / m;
}
function pick(raw) {
var p = {};
for (var key in DEFAULTS) {
p[key] = (raw && raw[key] !== undefined && raw[key] !== null) ? raw[key] : DEFAULTS[key];
}
return p;
}
function fixedCosts(p) {
return toNum(p.cost) + toNum(p.packaging) + toNum(p.logistics) + toNum(p.otherCosts) +
toNum(p.returnCost) * (1 - clampPct(p.buyoutPct) / 100);
}
function compute(raw) {
var p = pick(raw);
var price = Math.max(toNum(p.price), 0);
var cost = toNum(p.cost);
var packaging = toNum(p.packaging);
var logistics = toNum(p.logistics);
var otherCosts = toNum(p.otherCosts);
var returnCost = toNum(p.returnCost);
var commissionPct = clampPct(p.commissionPct);
var taxPct = clampPct(p.taxPct);
var buyoutPct = clampPct(p.buyoutPct);
var thresholdPct = toNum(p.thresholdPct);
var commission = round(price * commissionPct / 100, 2);
var tax = round(price * taxPct / 100, 2);
var returnsCost = round(returnCost * (1 - buyoutPct / 100), 2);
var profit = round(price - cost - packaging - logistics - commission - tax - returnsCost - otherCosts, 2);
var marginPct = price > 0 ? (profit / price) * 100 : 0;
var invested = cost + packaging + logistics + otherCosts;
var roiPct = invested > 0 ? (profit / invested) * 100 : 0;
var status = 'ok';
if (price <= 0) {
profit = 0;
marginPct = 0;
roiPct = 0;
status = 'empty';
} else if (profit < 0) {
status = 'loss';
} else if (marginPct < thresholdPct) {
status = 'below';
}
return {
cost: cost,
packaging: packaging,
logistics: logistics,
otherCosts: otherCosts,
returnCost: returnCost,
price: price,
commission: commission,
tax: tax,
returnsCost: returnsCost,
profit: profit,
marginPct: marginPct,
invested: invested,
roiPct: roiPct,
commissionPct: commissionPct,
taxPct: taxPct,
buyoutPct: buyoutPct,
thresholdPct: thresholdPct,
status: status
};
}
function priceForMargin(targetMarginPct, raw) {
var p = pick(raw);
var k = clampPct(p.commissionPct) / 100;
var t = clampPct(p.taxPct) / 100;
var m = toNum(targetMarginPct) / 100;
var denom = 1 - k - t - m;
if (denom <= 0.0001) return null;
var fixed = fixedCosts(p);
if (fixed <= 0) return null;
return fixed / denom;
}
function maxDiscountPct(raw, targetMarginPct) {
var p = pick(raw);
var price = Math.max(toNum(p.price), 0);
if (price <= 0) return null;
var k = clampPct(p.commissionPct) / 100;
var t = clampPct(p.taxPct) / 100;
var m = toNum(targetMarginPct) / 100;
var denom = 1 - k - t - m;
if (denom <= 0.0001) return null;
var fixed = fixedCosts(p);
if (fixed <= 0) return 100;
var share = fixed / (price * denom);
if (share >= 1) return 0;
return (1 - share) * 100;
}
function promoResult(raw, discountPct) {
var p = pick(raw);
var d = Math.min(Math.max(toNum(discountPct), 0), 100);
var discountedPrice = Math.max(toNum(p.price), 0) * (1 - d / 100);
if (discountedPrice <= 0.005) {
var zero = compute(Object.assign({}, p, { price: 0 }));
zero.profit = round(-fixedCosts(p), 2);
zero.marginPct = 0;
zero.roiPct = 0;
zero.status = 'loss';
zero.discountPct = d;
zero.discountedPrice = 0;
return zero;
}
var result = compute(Object.assign({}, p, { price: discountedPrice }));
result.discountPct = d;
result.discountedPrice = round(discountedPrice, 2);
return result;
}
function formatRub(n) {
var v = Math.round(toNum(n));
var sign = v < 0 ? '-' : '';
var abs = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
return sign + abs + ' ₽';
}
function formatPct(n) {
var v = toNum(n);
if (v !== 0 && Math.abs(v) < 1) return v.toFixed(1).replace('.', ',') + '%';
var rounded = Math.round(v);
return (rounded === 0 && v < 0 ? 0 : rounded) + '%';
}
function formatDiscountPct(n) {
var v = toNum(n);
if (!(v > 0)) return '0%';
if (v < 1) return v.toFixed(1).replace('.', ',') + '%';
return Math.floor(v) + '%';
}
function warningText(result) {
if (!result) return null;
if (result.status === 'loss') {
return 'Продажа в минус: ' + formatRub(result.profit);
}
if (result.status === 'below') {
return 'Маржа ниже ' + Math.round(result.thresholdPct) + '%: прибыль всего ' + formatRub(result.profit);
}
return null;
}
function statusLabel(status) {
if (status === 'loss') return 'МИНУС';
if (status === 'below') return 'НИЗКО';
if (status === 'empty') return '—';
return 'ОК';
}
return {
FORMULA_VERSION: FORMULA_VERSION,
DEFAULTS: DEFAULTS,
compute: compute,
promoResult: promoResult,
priceForMargin: priceForMargin,
maxDiscountPct: maxDiscountPct,
fixedCosts: fixedCosts,
toNum: toNum,
clampPct: clampPct,
round: round,
formatRub: formatRub,
formatPct: formatPct,
formatDiscountPct: formatDiscountPct,
warningText: warningText,
statusLabel: statusLabel
};
});
;

/* src/store.js */
(function (root) {
'use strict';
var KEY = 'wbmg.v1';
var DEFAULT_SETTINGS = {
taxPreset: 'usn6',
taxPct: 6,
thresholdPct: 15,
commissionPct: 15,
categoryId: 'custom',
logistics: 180,
packaging: 30,
returnCost: 50,
buyoutPct: 90,
otherCosts: 20,
calibratedSelector: '',
promoDiscountPct: 0,
telemetryConsent: false,
formulaVersion: '2026-10-28.1'
};
var cache = null;
function hasChromeStorage() {
return !!(root.chrome && root.chrome.storage && root.chrome.storage.local);
}
function blank() {
return { settings: {}, costs: {}, events: [], createdAt: Date.now() };
}
function normalize(raw) {
var base = blank();
raw = raw || {};
var settings = {};
for (var k in DEFAULT_SETTINGS) {
settings[k] = (raw.settings && raw.settings[k] !== undefined) ? raw.settings[k] : DEFAULT_SETTINGS[k];
}
var costs = {};
if (raw.costs) {
for (var id in raw.costs) {
if (raw.costs[id] !== null && raw.costs[id] !== undefined && raw.costs[id] !== '') {
costs[String(id)] = Number(raw.costs[id]);
}
}
}
return {
settings: settings,
costs: costs,
events: Array.isArray(raw.events) ? raw.events : [],
createdAt: raw.createdAt || base.createdAt
};
}
async function read() {
if (cache) return cache;
var raw = null;
if (hasChromeStorage()) {
try {
var r = await root.chrome.storage.local.get(KEY);
raw = r && r[KEY];
} catch (e) { }
}
if (!raw) {
try {
raw = JSON.parse(root.localStorage.getItem(KEY) || 'null');
} catch (e) { }
}
cache = normalize(raw);
return cache;
}
async function write(data) {
cache = data;
var payload = {};
payload[KEY] = data;
if (hasChromeStorage()) {
try {
await root.chrome.storage.local.set(payload);
return data;
} catch (e) { }
}
try {
root.localStorage.setItem(KEY, JSON.stringify(data));
} catch (e) { }
return data;
}
async function load() {
return await read();
}
async function saveSettings(patch) {
var data = await read();
for (var k in patch) data.settings[k] = patch[k];
return await write(data);
}
async function getCost(sku) {
var data = await read();
var id = String(sku);
return data.costs[id] === undefined ? null : Number(data.costs[id]);
}
async function setCost(sku, value) {
var data = await read();
var id = String(sku);
if (value === null || value === undefined || value === '') delete data.costs[id];
else data.costs[id] = Number(value);
return await write(data);
}
async function setCostsMap(map) {
var data = await read();
var next = {};
for (var id in (map || {})) {
var n = Number(map[id]);
if (isFinite(n)) next[String(id)] = n;
}
data.costs = next;
return await write(data);
}
function costsToText(costs) {
return Object.keys(costs || {})
.sort(function (a, b) { return a.localeCompare(b); })
.map(function (k) { return k + '; ' + costs[k]; })
.join('\n');
}
function textToCosts(text) {
var out = {};
String(text || '').split(/\r?\n/).forEach(function (line) {
var m = line.trim().match(/^(\d{4,20})[\s;,:\t]+(\d+(?:[.,]\d+)?)$/);
if (m) out[m[1]] = Number(m[2].replace(',', '.'));
});
return out;
}
function parseCsvCosts(text) {
var out = {};
String(text || '').split(/\r?\n/).forEach(function (line) {
var raw = line.replace(/^\uFEFF/, '').trim();
if (!raw) return;
var sep = raw.indexOf(';') >= 0 ? ';' : (raw.indexOf('\t') >= 0 ? '\t' : ',');
var parts = raw.split(sep).map(function (part) {
return part.trim().replace(/^"|"$/g, '').replace(/\u00a0/g, '');
}).filter(function (part) { return part.length > 0; });
if (parts.length < 2) return;
var article = (parts[0].match(/\d{4,20}/) || [])[0];
if (!article) return;
var cost = null;
for (var i = 1; i < parts.length; i++) {
var candidate = Number(parts[i].replace(/[^\d,.\-]/g, '').replace(',', '.'));
if (isFinite(candidate) && candidate >= 0) { cost = candidate; break; }
}
if (cost === null) return;
out[article] = cost;
});
return out;
}
function costsToCsv(costs) {
var lines = ['Артикул;Себестоимость'];
Object.keys(costs || {})
.sort(function (a, b) { return String(a).localeCompare(String(b)); })
.forEach(function (id) { lines.push(id + ';' + costs[id]); });
return lines.join('\r\n');
}
async function buildBackup() {
var data = await read();
return JSON.stringify({
app: 'stop-minus',
version: 1,
exportedAt: new Date().toISOString(),
settings: data.settings,
costs: data.costs
}, null, 2);
}
function parseBackup(text) {
var parsed;
try {
parsed = JSON.parse(String(text || ''));
} catch (e) {
throw new Error('Файл не является JSON');
}
if (!parsed || parsed.app !== 'stop-minus') throw new Error('Это не файл резервной копии «Стоп-минус»');
var costs = {};
for (var id in (parsed.costs || {})) {
var n = Number(parsed.costs[id]);
if (isFinite(n) && n >= 0) costs[String(id)] = n;
}
return { settings: parsed.settings || {}, costs: costs };
}
async function applyBackup(text) {
var parsed = parseBackup(text);
var data = await read();
for (var key in parsed.settings) {
if (DEFAULT_SETTINGS[key] !== undefined) data.settings[key] = parsed.settings[key];
}
data.costs = parsed.costs;
await write(data);
return {
settings: Object.keys(parsed.settings).length,
costs: Object.keys(parsed.costs).length
};
}
async function logEvent(name, meta) {
var data = await read();
if (!data.settings.telemetryConsent) return;
data.events.push({ t: Date.now(), n: String(name), m: meta || {} });
if (data.events.length > 200) data.events = data.events.slice(-200);
await write(data);
}
root.WbMarginStore = {
KEY: KEY,
DEFAULTS: DEFAULT_SETTINGS,
load: load,
saveSettings: saveSettings,
getCost: getCost,
setCost: setCost,
setCostsMap: setCostsMap,
costsToText: costsToText,
costsToCsv: costsToCsv,
textToCosts: textToCosts,
parseCsvCosts: parseCsvCosts,
buildBackup: buildBackup,
applyBackup: applyBackup,
parseBackup: parseBackup,
logEvent: logEvent
};
if (typeof module === 'object' && module.exports) {
module.exports = root.WbMarginStore;
}
})(typeof globalThis !== 'undefined' ? globalThis : this);
;

/* src/overlay.js */
(function (root) {
'use strict';
var C = root.WbMarginCalc;
var HOST_ID = 'wbmg-host';
var CSS = [
':host{all:initial}',
'*{box-sizing:border-box;margin:0;padding:0}',
'.panel{width:302px;background:#fffdf9;color:#1d1b16;border:1px solid #e6ddcf;border-left:4px solid #8a8272;border-radius:12px;box-shadow:0 12px 34px rgba(20,15,5,.20);font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden}',
'.panel[data-status="ok"]{border-left-color:#2f9e6b}',
'.panel[data-status="below"]{border-left-color:#e0a11a}',
'.panel[data-status="loss"]{border-left-color:#d33a3a;background:#fff6f6}',
'header{display:flex;align-items:center;gap:8px;padding:9px 12px;background:rgba(0,0,0,.035);cursor:move;user-select:none}',
'header .dot{width:8px;height:8px;border-radius:50%;background:#8a8272;flex:0 0 auto}',
'.panel[data-status="ok"] header .dot{background:#2f9e6b}',
'.panel[data-status="below"] header .dot{background:#e0a11a}',
'.panel[data-status="loss"] header .dot{background:#d33a3a}',
'header .title{font-weight:700;font-size:11.5px;letter-spacing:.04em;text-transform:uppercase;color:#6b6355}',
'header .mode{margin-left:auto;font-size:10.5px;color:#8a8272;max-width:132px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'header button{border:0;background:transparent;color:#8a8272;cursor:pointer;font:inherit;line-height:1;padding:3px 4px;border-radius:6px}',
'header button:hover{background:rgba(0,0,0,.07)}',
'.main{padding:12px}',
'.profit{display:flex;align-items:baseline;justify-content:space-between;gap:8px}',
'.profit .label{font-size:11.5px;color:#8a8272}',
'.profit .value{font-size:22px;font-weight:800;letter-spacing:-.02em;color:#3a352c}',
'.panel[data-status="loss"] .profit .value{color:#c22a2a}',
'.panel[data-status="below"] .profit .value{color:#a87400}',
'.panel[data-status="ok"] .profit .value{color:#1e7a4b}',
'.metrics{display:flex;gap:8px;margin:9px 0 10px}',
'.metrics>div{flex:1;background:rgba(0,0,0,.04);border-radius:8px;padding:5px 8px;display:flex;justify-content:space-between;align-items:baseline}',
'.metrics span{font-size:10.5px;color:#8a8272}',
'.metrics b{font-size:14px}',
'.price-line{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;color:#6b6355;border-top:1px dashed #e6ddcf;padding-top:8px}',
'.price-line b{font-weight:700}',
'.price-line .sku{color:#a49a86}',
'.compare{margin-top:7px;padding:6px 8px;border-radius:7px;background:rgba(0,0,0,.04);font-size:11.5px;color:#5d564a;line-height:1.45}',
'.compare b{color:#3a352c}',
'.compare[hidden]{display:none}',
'.warn{margin-top:10px;padding:8px 10px;border-radius:8px;font-weight:700;font-size:12.5px;background:#ffeaea;color:#b02525;line-height:1.35}',
'.warn[data-status="below"]{background:#fff7e3;color:#8a5a00}',
'.warn[hidden]{display:none}',
'.hint{margin-top:8px;font-size:10.5px;color:#8a8272;line-height:1.35}',
'details{margin-top:10px;border-top:1px dashed #e6ddcf;padding-top:8px}',
'summary{cursor:pointer;font-size:11.5px;color:#6b6355;list-style:none}',
'summary::-webkit-details-marker{display:none}',
'summary:before{content:"▸ ";color:#a49a86}',
'details[open] summary:before{content:"▾ "}',
'.break-rows{margin-top:7px;display:grid;grid-template-columns:1fr auto;gap:3px 12px;font-size:11.5px;color:#5d564a}',
'.break-rows .neg{text-align:right;color:#a8452a;font-variant-numeric:tabular-nums}',
'.break-rows .sum{font-weight:700;color:#3a352c;border-top:1px dashed #e6ddcf;padding-top:4px;margin-top:2px}',
'.promo{margin-top:10px;border-top:1px dashed #e6ddcf;padding-top:9px}',
'.promo-head{display:flex;justify-content:space-between;align-items:baseline;font-size:11.5px;color:#6b6355}',
'.promo-head b{color:#3a352c;font-size:13px}',
'.promo input[type=range]{width:100%;margin:7px 0 5px;accent-color:#2f6fed;height:16px}',
'.promo-line{font-size:11.5px;line-height:1.4;color:#5d564a}',
'.promo-line.stop{color:#b02525;font-weight:800}',
'.promo-line.warnline{color:#8a5a00;font-weight:700}',
'.manual{display:grid;gap:8px;margin-top:10px;border-top:1px dashed #e6ddcf;padding-top:10px}',
'.manual[hidden]{display:none}',
'.manual label{display:grid;gap:3px;font-size:10.5px;color:#8a8272}',
'.manual input{font:14px inherit;padding:6px 8px;border:1px solid #d8cfc0;border-radius:8px;background:#fff;color:#1d1b16;width:100%}',
'.manual .apply{background:#2f6fed;color:#fff;font-weight:700;padding:8px;border-radius:8px;border:0;cursor:pointer;font-size:12.5px}',
'.manual .apply:hover{background:#2660d8}',
'.footer{padding:7px 12px;background:rgba(0,0,0,.03);font-size:10px;color:#9a9182;display:flex;justify-content:space-between;gap:8px}',
'.panel.collapsed .main,.panel.collapsed .footer{display:none}'
].join('\n');
var PANEL = [
'<div class="panel" data-status="empty">',
'  <header>',
'    <span class="dot"></span>',
'    <span class="title">Стоп-минус</span>',
'    <span class="mode">авто</span>',
'    <button class="btn-min" title="Свернуть">—</button>',
'    <button class="btn-close" title="Скрыть">✕</button>',
'  </header>',
'  <div class="main">',
'    <div class="profit"><span class="label">Чистая прибыль</span><span class="value">—</span></div>',
'    <div class="metrics">',
'      <div><span>Маржа</span><b class="margin">—</b></div>',
'      <div><span>ROI</span><b class="roi">—</b></div>',
'    </div>',
'    <div class="price-line"><span>Цена <b class="price">—</b></span><span class="sku">—</span></div>',
'    <div class="compare" hidden></div>',
'    <div class="promo">',
'      <div class="promo-head"><span>Акция: скидка</span><b class="promo-pct">0%</b></div>',
'      <input class="promo-range" type="range" min="0" max="100" step="1" value="0">',
'      <div class="promo-line"></div>',
'    </div>',
'    <div class="warn" hidden></div>',
'    <div class="hint"></div>',
'    <details class="break"><summary>Из чего сложилось</summary><div class="break-rows"></div></details>',
'    <div class="manual" hidden>',
'      <label>Цена, ₽<input class="m-price" type="text" inputmode="decimal" placeholder="1990"></label>',
'      <label>Артикул<input class="m-sku" type="text" inputmode="numeric" placeholder="123456"></label>',
'      <button class="apply" type="button">Показать маржу</button>',
'    </div>',
'  </div>',
'  <div class="footer"><span>только чтение · локальный расчёт</span><span class="info"></span></div>',
'</div>'
].join('\n');
function createOverlay(options) {
options = options || {};
var host = document.createElement('div');
host.id = HOST_ID;
host.style.cssText = 'position:fixed;z-index:2147483000;right:16px;bottom:16px;display:none;';
(document.body || document.documentElement).appendChild(host);
var shadow = host.attachShadow({ mode: 'open' });
var style = document.createElement('style');
style.textContent = CSS;
shadow.appendChild(style);
var wrapper = document.createElement('div');
wrapper.innerHTML = PANEL;
var panel = wrapper.querySelector('.panel');
shadow.appendChild(panel);
var refs = {
panel: panel,
mode: panel.querySelector('.mode'),
value: panel.querySelector('.profit .value'),
profitLabel: panel.querySelector('.profit .label'),
margin: panel.querySelector('.metrics .margin'),
roi: panel.querySelector('.metrics .roi'),
price: panel.querySelector('.price-line .price'),
sku: panel.querySelector('.price-line .sku'),
compare: panel.querySelector('.compare'),
promoRange: panel.querySelector('.promo-range'),
promoPct: panel.querySelector('.promo-pct'),
promoLine: panel.querySelector('.promo-line'),
warn: panel.querySelector('.warn'),
hint: panel.querySelector('.hint'),
breakRows: panel.querySelector('.break-rows'),
manual: panel.querySelector('.manual'),
mPrice: panel.querySelector('.m-price'),
mSku: panel.querySelector('.m-sku'),
mApply: panel.querySelector('.manual .apply'),
info: panel.querySelector('.info')
};
var userMoved = false;
var last = null;
var currentPromo = null;
function show() { host.style.display = 'block'; }
function hide() { host.style.display = 'none'; }
function clearBreakdown() {
while (refs.breakRows.firstChild) refs.breakRows.removeChild(refs.breakRows.firstChild);
}
function addBreakRow(label, value, isSum) {
var l = document.createElement('span');
l.textContent = label;
var v = document.createElement('span');
v.className = 'neg';
v.textContent = value;
if (isSum) { l.className = 'sum'; v.className = 'sum'; }
refs.breakRows.appendChild(l);
refs.breakRows.appendChild(v);
}
function render(result, settings, sku, opts) {
last = { result: result, settings: settings, sku: sku, opts: opts || {} };
if (opts && opts.costKnown === false) {
refs.panel.dataset.status = 'empty';
refs.value.textContent = '—';
refs.margin.textContent = '—';
refs.roi.textContent = '—';
refs.price.textContent = result.price > 0 ? C.formatRub(result.price) : '—';
refs.sku.textContent = sku ? '#' + sku : '—';
refs.warn.hidden = true;
refs.warn.textContent = '';
refs.hint.textContent = 'Себестоимость не задана — добавь её в настройках расширения: «артикул; цена».';
refs.promoRange.disabled = true;
refs.promoPct.textContent = '—';
refs.promoLine.className = 'promo-line';
refs.promoLine.textContent = 'Пока не известна себестоимость, акцию считать нельзя.';
clearBreakdown();
return;
}
refs.promoRange.disabled = false;
var promoPct = (opts && opts.promoPct !== undefined) ? C.toNum(opts.promoPct) : (currentPromo === null ? C.toNum(settings.promoDiscountPct) : currentPromo);
currentPromo = promoPct;
refs.promoRange.value = String(Math.round(promoPct));
refs.promoPct.textContent = Math.round(promoPct) + '%';
var baseForDiscount = {};
for (var pk in settings) baseForDiscount[pk] = settings[pk];
baseForDiscount.price = result.price;
baseForDiscount.cost = result.cost;
var promo = C.promoResult(baseForDiscount, promoPct);
var threshold = C.toNum(result.thresholdPct);
var maxZero = C.maxDiscountPct(baseForDiscount, 0);
var maxTarget = C.maxDiscountPct(baseForDiscount, threshold);
var showPromo = promoPct > 0;
var eff = showPromo ? promo : result;
refs.panel.dataset.status = eff.status;
var zeroPrice = showPromo && promo.discountedPrice <= 0;
refs.value.textContent = C.formatRub(eff.profit);
refs.margin.textContent = zeroPrice ? '—' : C.formatPct(eff.marginPct);
refs.roi.textContent = zeroPrice ? '—' : C.formatPct(eff.roiPct);
refs.price.textContent = showPromo
? C.formatRub(result.price) + ' → ' + C.formatRub(promo.discountedPrice)
: C.formatRub(result.price);
refs.sku.textContent = sku ? '#' + sku : '—';
if (refs.profitLabel) refs.profitLabel.textContent = showPromo ? 'Прибыль со скидкой' : 'Чистая прибыль';
if (refs.compare) {
if (showPromo) {
var delta = C.round(eff.profit - result.profit, 2);
refs.compare.hidden = false;
refs.compare.innerHTML = 'Без скидки: <b>' + C.formatRub(result.profit) + '</b> · ' +
'со скидкой ' + Math.round(promoPct) + '%: <b>' + C.formatRub(eff.profit) + '</b> · ' +
'разница: <b>' + (delta > 0 ? '+' : '') + C.formatRub(delta) + '</b>';
} else {
refs.compare.hidden = true;
refs.compare.textContent = '';
}
}
var warn = showPromo ? null : C.warningText(eff);
if (warn) {
refs.warn.hidden = false;
refs.warn.textContent = warn;
refs.warn.dataset.status = eff.status === 'below' ? 'below' : 'loss';
} else {
refs.warn.hidden = true;
refs.warn.textContent = '';
}
var base = {
cost: result.cost,
packaging: result.packaging,
logistics: result.logistics,
otherCosts: result.otherCosts,
returnCost: result.returnCost,
commissionPct: result.commissionPct,
taxPct: result.taxPct,
buyoutPct: result.buyoutPct
};
var minZero = C.priceForMargin(0, base);
var minTarget = C.priceForMargin(threshold, base);
if (result.price <= 0) {
refs.hint.textContent = minZero ? 'Мин. цена «в ноль»: ' + C.formatRub(minZero) : '';
} else {
var parts = [];
if (minZero !== null) parts.push('в ноль — от ' + C.formatRub(minZero));
if (minTarget !== null && threshold > 0) parts.push('маржа ' + Math.round(threshold) + '% — от ' + C.formatRub(minTarget));
refs.hint.textContent = parts.join(' · ');
}
clearBreakdown();
addBreakRow('Себестоимость', '-' + C.formatRub(eff.cost));
addBreakRow('Упаковка', '-' + C.formatRub(eff.packaging));
addBreakRow('Логистика', '-' + C.formatRub(eff.logistics));
addBreakRow('Комиссия ' + Math.round(eff.commissionPct) + '%', '-' + C.formatRub(eff.commission));
addBreakRow('Налог ' + Math.round(eff.taxPct) + '%', '-' + C.formatRub(eff.tax));
addBreakRow('Возвраты (невыкуп ' + Math.round(100 - eff.buyoutPct) + '%)', '-' + C.formatRub(eff.returnsCost));
addBreakRow('Прочие', '-' + C.formatRub(eff.otherCosts));
addBreakRow(showPromo ? 'Прибыль со скидкой' : 'Прибыль', C.formatRub(eff.profit), true);
refs.promoLine.className = 'promo-line';
if (promoPct <= 0) {
if (maxZero !== null && maxZero <= 0) {
refs.promoLine.className = 'promo-line warnline';
refs.promoLine.textContent = 'Скидка невозможна: при этой цене уже минус.';
} else {
var maxText = 'Без скидки. Максимальная скидка без минуса: ';
maxText += (maxZero === null ? '—' : C.formatDiscountPct(maxZero));
if (maxTarget !== null && threshold > 0) {
if (maxTarget <= 0) {
maxText += ' · маржа ' + Math.round(threshold) + '% не достигается даже без скидки';
} else {
maxText += ' · до маржи ' + Math.round(threshold) + '%: ' + C.formatDiscountPct(maxTarget);
}
}
refs.promoLine.textContent = maxText;
}
} else if (promo.status === 'loss') {
refs.promoLine.className = 'promo-line stop';
refs.promoLine.textContent = 'СТОП: со скидкой ' + Math.round(promoPct) + '% цена ' + C.formatRub(promo.discountedPrice) +
' даёт ' + C.formatRub(promo.profit) + ' за заказ. В такую акцию идти нельзя.';
} else if (promo.status === 'below') {
refs.promoLine.className = 'promo-line warnline';
refs.promoLine.textContent = 'Цена ' + C.formatRub(promo.discountedPrice) + ' → ' +
C.formatRub(promo.profit) + ' · маржа ' + C.formatPct(promo.marginPct) + ' — ниже порога';
} else {
refs.promoLine.textContent = 'Цена ' + C.formatRub(promo.discountedPrice) + ' → ' +
C.formatRub(promo.profit) + ' · маржа ' + C.formatPct(promo.marginPct) + ' · ROI ' + C.formatPct(promo.roiPct);
}
}
function update(opts) {
opts = opts || {};
var settings = opts.settings || {};
var merged = {};
for (var k in settings) merged[k] = settings[k];
merged.price = opts.price;
merged.cost = opts.cost || 0;
var result = C.compute(merged);
show();
render(result, settings, opts.sku, opts);
if (typeof opts.mode === 'string') setMode(opts.mode);
return result;
}
function setMode(text) { refs.mode.textContent = text || ''; }
function setInfo(text) { refs.info.textContent = text || ''; }
function showManual(prefill) {
refs.manual.hidden = false;
show();
if (prefill && prefill.price) refs.mPrice.value = String(prefill.price);
if (prefill && prefill.sku) refs.mSku.value = String(prefill.sku);
try { refs.mPrice.focus({ preventScroll: true }); } catch (e) { }
}
refs.mApply.addEventListener('click', function () {
var price = C.toNum(refs.mPrice.value);
var sku = (refs.mSku.value || '').replace(/\D/g, '') || null;
if (options.onManualApply) options.onManualApply({ price: price, sku: sku });
});
refs.promoRange.addEventListener('input', function () {
var pct = C.toNum(refs.promoRange.value);
currentPromo = pct;
refs.promoPct.textContent = Math.round(pct) + '%';
try {
document.dispatchEvent(new CustomEvent('wbmg:promo', { detail: { pct: pct } }));
} catch (e) { }
if (options.onPromoChange) {
options.onPromoChange(pct);
return;
}
if (last) {
var merged = {};
for (var k in last.settings) merged[k] = last.settings[k];
merged.price = last.result.price;
merged.cost = last.result.cost;
merged.promoDiscountPct = pct;
render(C.compute(merged), merged, last.sku, { promoPct: pct });
}
});
panel.querySelector('.btn-close').addEventListener('click', hide);
panel.querySelector('.btn-min').addEventListener('click', function () {
panel.classList.toggle('collapsed');
});
var dragState = null;
var header = panel.querySelector('header');
header.addEventListener('mousedown', function (ev) {
if (ev.target.tagName === 'BUTTON') return;
ev.preventDefault();
var rect = host.getBoundingClientRect();
dragState = { dx: ev.clientX - rect.left, dy: ev.clientY - rect.top };
userMoved = true;
host.style.right = 'auto';
host.style.bottom = 'auto';
host.style.left = rect.left + 'px';
host.style.top = rect.top + 'px';
document.addEventListener('mousemove', onDrag, true);
document.addEventListener('mouseup', onDragEnd, true);
});
function onDrag(ev) {
if (!dragState) return;
waitForDrag(ev);
}
function waitForDrag(ev) {
var left = Math.max(4, Math.min(window.innerWidth - 120, ev.clientX - dragState.dx));
var top = Math.max(4, Math.min(window.innerHeight - 60, ev.clientY - dragState.dy));
host.style.left = left + 'px';
host.style.top = top + 'px';
}
function onDragEnd() {
dragState = null;
document.removeEventListener('mousemove', onDrag, true);
document.removeEventListener('mouseup', onDragEnd, true);
}
function anchorTo(rect) {
if (!rect || userMoved) return;
var width = 302;
var gap = 10;
var left = rect.right + gap;
var top = rect.bottom + gap;
if (top + 340 > window.innerHeight) {
top = rect.top - 340 - gap;
if (top < 8) top = Math.min(Math.max(8, rect.top), Math.max(8, window.innerHeight - 348));
}
if (left + width > window.innerWidth - 8) left = Math.max(8, rect.left - width - gap);
if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
if (top + 340 > window.innerHeight) top = Math.max(8, rect.top - 340 - gap);
host.style.right = 'auto';
host.style.bottom = 'auto';
host.style.left = left + 'px';
host.style.top = top + 'px';
}
function isUserMoved() { return userMoved; }
function pinCorner() {
userMoved = true;
host.style.left = 'auto';
host.style.top = 'auto';
host.style.right = '16px';
host.style.bottom = '16px';
show();
}
function destroy() {
if (host.parentNode) host.parentNode.removeChild(host);
}
return {
host: host,
update: update,
render: render,
setMode: setMode,
setInfo: setInfo,
show: show,
hide: hide,
showManual: showManual,
anchorTo: anchorTo,
pinCorner: pinCorner,
isUserMoved: isUserMoved,
destroy: destroy
};
}
root.WbMarginOverlay = { createOverlay: createOverlay };
})(typeof globalThis !== 'undefined' ? globalThis : this);
;

/* src/engine.js */
(function (root) {
'use strict';
var C = root.WbMarginCalc;
var S = root.WbMarginStore;
var OV = root.WbMarginOverlay;
var CHIP_ID = 'wbmg-chip-style';
var itemCache = new WeakMap();
function itemFor(input) {
var existing = itemCache.get(input);
if (existing) return existing;
var item = { input: input, row: rowOf(input), sku: null, score: 0, bound: false, chip: null };
item.sku = skuOf(item.row);
itemCache.set(input, item);
return item;
}
var state = {
settings: null,
costs: {},
overlay: null,
items: [],
active: null,
calibrating: false,
mode: 'авто',
observer: null,
scanTimer: null,
booted: false
};
function textOf(node) {
if (!node) return '';
var value = node.innerText;
if (!value) value = node.textContent;
return String(value || '').replace(/\s+/g, ' ').trim();
}
function isVisible(el) {
if (!el || el.disabled) return false;
var rect = el.getBoundingClientRect();
if (rect.width < 8 || rect.height < 8) return false;
var style = window.getComputedStyle(el);
if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
return true;
}
var SKU_RE = /(?:^|\D)(\d{6,12})(?:\D|$)/;
function rowOf(el) {
if (!el) return null;
var direct = el.closest('tr, [role="row"], li, [data-row]');
if (direct) return direct;
var node = el.parentElement;
var depth = 0;
while (node && depth < 4) {
if (node === document.body || node === document.documentElement) break;
var inputsInside = node.querySelectorAll ? node.querySelectorAll('input').length : 0;
if (inputsInside <= 12 && SKU_RE.test(textOf(node))) return node;
node = node.parentElement;
depth++;
}
return el.parentElement;
}
function skuOf(row) {
if (!row) return null;
var holder = row.closest ? row.closest('[data-sku], [data-article], [data-nm]') : null;
if (holder && holder.dataset) {
var attr = holder.dataset.sku || holder.dataset.article || holder.dataset.nm;
if (attr) return String(attr).replace(/\D/g, '') || null;
}
var match = textOf(row).match(SKU_RE);
return match ? match[1] : null;
}
function rowCost(row) {
if (!row) return null;
var holder = row.closest ? row.closest('[data-cost]') : null;
if (holder && holder.dataset && holder.dataset.cost !== undefined) {
return C.toNum(holder.dataset.cost);
}
return null;
}
function rowDiscount(item) {
if (!item || !item.row || !item.row.dataset) return 0;
return C.toNum(item.row.dataset.discount || 0);
}
function resolveCost(item) {
if (!item) return null;
var fromRow = rowCost(item.row);
if (fromRow !== null) return fromRow;
if (item.sku && state.costs[String(item.sku)] !== undefined) {
return Number(state.costs[String(item.sku)]);
}
return null;
}
function inputWords(input) {
return [
input.getAttribute('placeholder') || '',
input.getAttribute('aria-label') || '',
input.name || '',
input.id || '',
typeof input.className === 'string' ? input.className : ''
].join(' ').toLowerCase();
}
function scoreInput(input) {
var type = (input.getAttribute('type') || 'text').toLowerCase();
if (['checkbox', 'radio', 'file', 'submit', 'button', 'hidden', 'password', 'search', 'email'].indexOf(type) >= 0) return -1;
if (input.getAttribute('data-wbmg-ignore')) return -1; 
var words = inputWords(input);
var wordScore = /цен|price|стоим/.test(words) ? 3 : 0;
var value = C.toNum(input.value);
var valueScore = (value > 0 && value < 100000000) ? 2 : 0;
if (wordScore === 0 && valueScore === 0) return -1;
var score = wordScore + valueScore;
var row = rowOf(input);
if (/цена|цену|price/.test(textOf(row).toLowerCase())) score += 1;
if (input.getAttribute('inputmode') === 'decimal' || input.getAttribute('inputmode') === 'numeric') score += 1;
if (skuOf(row)) score += 2;
if (row && row.tagName === 'TR') score += 1;
if (score < 4) return score;
if (!isVisible(input)) return -1;
return score;
}
function scan() {
var found = [];
var inputs = document.querySelectorAll('input');
for (var i = 0; i < inputs.length; i++) {
var input = inputs[i];
var score = scoreInput(input);
if (score >= 4) {
var item = itemFor(input);
item.score = score;
item.row = rowOf(input);
item.sku = skuOf(item.row) || item.sku;
found.push(item);
}
}
if (state.settings && state.settings.calibratedSelector) {
var pinned = null;
try { pinned = document.querySelector(state.settings.calibratedSelector); } catch (e) { pinned = null; }
if (pinned && pinned.tagName === 'INPUT' && !found.some(function (it) { return it.input === pinned; })) {
var pinnedItem = itemFor(pinned);
pinnedItem.score = 99;
found.unshift(pinnedItem);
}
}
found.sort(function (a, b) { return b.score - a.score; });
found.forEach(bind);
state.items = found;
return found;
}
function bind(item) {
if (item.bound) {
item.sku = skuOf(item.row) || item.sku;
return item;
}
item.bound = true;
item.input.addEventListener('focus', function () { activate(item); });
item.input.addEventListener('input', function () { activate(item); });
item.input.addEventListener('change', function () { activate(item); });
return item;
}
function activate(item) {
if (!item || !state.overlay) return;
state.active = item;
var price = C.toNum(item.input.value);
var cost = resolveCost(item);
state.overlay.update({
price: price,
cost: cost === null ? 0 : cost,
costKnown: cost !== null,
settings: state.settings,
sku: item.sku,
mode: state.mode,
promoPct: rowDiscount(item)
});
if (!state.overlay.isUserMoved()) state.overlay.anchorTo(item.input.getBoundingClientRect());
if (state.overlay.setInfo) {
state.overlay.setInfo(state.mode + ' · ' + state.items.length + ' пол.' + (item.sku ? ' · #' + item.sku : ''));
}
decorate(item);
}
function decorate(item) {
if (!item || !item.row) return;
var cost = resolveCost(item);
var price = C.toNum(item.input.value);
var chip = item.chip;
if (!chip) {
chip = document.createElement('span');
chip.className = 'wbmg-chip';
item.chip = chip;
item.input.insertAdjacentElement('afterend', chip);
}
if (cost === null) {
chip.dataset.status = 'empty';
chip.textContent = 'нет себестоимости';
chip.title = 'Укажи себестоимость в настройках расширения (артикул; цена)';
return;
}
var merged = {};
for (var k in state.settings) merged[k] = state.settings[k];
merged.price = price;
merged.cost = cost;
var result = C.compute(merged);
var promoPct = rowDiscount(item);
if (promoPct > 0) {
result = C.promoResult(merged, promoPct);
chip.title = 'Со скидкой ' + Math.round(promoPct) + '%: ' + C.formatRub(result.profit) + ' · ' + C.formatPct(result.marginPct);
} else {
chip.title = 'Прибыль и маржа при цене ' + C.formatRub(result.price);
}
chip.dataset.status = result.status;
chip.textContent = C.formatRub(result.profit) + ' · ' + C.formatPct(result.marginPct);
}
function decorateAll() {
state.items.forEach(function (item) {
item.sku = skuOf(item.row) || item.sku;
decorate(item);
});
}
function ensureChipStyle() {
if (!document.getElementById(CHIP_ID)) {
var style = document.createElement('style');
style.id = CHIP_ID;
style.textContent = [
'.wbmg-chip{display:inline-flex;align-items:center;margin-left:8px;padding:2px 7px;border-radius:7px;',
'font:11.5px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-weight:700;',
'border:1px solid #d8cfc0;background:#f4f1ea;color:#5d564a;vertical-align:middle;white-space:nowrap;'
,'cursor:default}',
'.wbmg-chip[data-status="ok"]{background:#e9f7ef;color:#1e6b3a;border-color:#b8e0c8}',
'.wbmg-chip[data-status="below"]{background:#fff7e3;color:#8a5a00;border-color:#f0d090}',
'.wbmg-chip[data-status="loss"]{background:#ffeaea;color:#a61b1b;border-color:#f3b5b5}',
'.wbmg-chip[data-status="empty"]{opacity:.7;font-weight:500}'
].join('');
(document.head || document.documentElement).appendChild(style);
}
}
async function refreshSettings() {
var data = await S.load();
state.settings = data.settings;
state.costs = data.costs;
return data;
}
async function reload() {
await refreshSettings();
decorateAll();
if (state.active && document.contains(state.active.input)) activate(state.active);
}
function enableManual(prefill) {
state.mode = 'ручной режим';
if (!state.overlay) return;
state.overlay.setMode(state.mode);
state.overlay.showManual(prefill || null);
}
function observe() {
if (state.observer) return;
var timer = null;
state.observer = new MutationObserver(function () {
if (state.calibrating) return;
clearTimeout(timer);
timer = setTimeout(function () {
if (state.active && !document.contains(state.active.input)) state.active = null;
scan();
}, 700);
});
state.observer.observe(document.documentElement, { childList: true, subtree: true });
}
function cssPath(el) {
var parts = [];
var node = el;
while (node && node.nodeType === 1 && node !== document.body) {
var selector = node.tagName.toLowerCase();
if (node.id && /^[A-Za-z][\w-]*$/.test(node.id)) {
parts.unshift('#' + node.id);
break;
}
var parent = node.parentElement;
if (parent) {
var sameTag = [];
for (var i = 0; i < parent.children.length; i++) {
if (parent.children[i].tagName === node.tagName) sameTag.push(parent.children[i]);
}
if (sameTag.length > 1) selector += ':nth-of-type(' + (sameTag.indexOf(node) + 1) + ')';
}
parts.unshift(selector);
node = parent;
}
return parts.join(' > ');
}
function startCalibration() {
if (state.calibrating || !state.overlay) return;
state.calibrating = true;
state.overlay.show();
state.overlay.setMode('калибровка: кликни по полю цены');
var hovered = null;
function restoreHover() {
if (hovered) {
hovered.style.outline = hovered.__wbmgOutline || '';
delete hovered.__wbmgOutline;
hovered = null;
}
}
function onMove(ev) {
var el = ev.target;
if (el === hovered) return;
restoreHover();
if (el && el.tagName === 'INPUT') {
hovered = el;
el.__wbmgOutline = el.style.outline;
el.style.outline = '2px solid #2f6fed';
}
}
function onClick(ev) {
var el = ev.target;
if (!el || el.tagName !== 'INPUT') {
finish(null);
return;
}
ev.preventDefault();
ev.stopPropagation();
finish(cssPath(el));
}
function onKey(ev) {
if (ev.key === 'Escape') finish(null);
}
function finish(selector) {
state.calibrating = false;
restoreHover();
document.removeEventListener('mousemove', onMove, true);
document.removeEventListener('click', onClick, true);
document.removeEventListener('keydown', onKey, true);
if (!selector) {
state.overlay.setMode('калибровка отменена');
return;
}
state.settings.calibratedSelector = selector;
S.saveSettings({ calibratedSelector: selector });
state.mode = 'калиброванный';
state.overlay.setMode('калибровка сохранена');
var el = null;
try { el = document.querySelector(selector); } catch (e) { el = null; }
if (el) {
var row = rowOf(el);
var item = itemFor(el);
item.row = row;
item.sku = skuOf(row) || item.sku;
item.score = 99;
bind(item);
if (state.items.indexOf(item) === -1) state.items.unshift(item);
activate(item);
}
}
document.addEventListener('mousemove', onMove, true);
document.addEventListener('click', onClick, true);
document.addEventListener('keydown', onKey, true);
}
async function init(options) {
options = options || {};
if (state.booted) return state;
state.booted = true;
await refreshSettings();
ensureChipStyle();
state.overlay = OV.createOverlay({
trialLabel: options.trialLabel || '',
onPromoChange: function (pct) {
if (state.active && state.active.row && state.active.row.dataset) {
state.active.row.dataset.discount = String(pct);
}
state.settings.promoDiscountPct = pct;
decorateAll();
if (state.active) activate(state.active);
},
onManualApply: function (payload) {
var cost = null;
if (payload.sku && state.costs[payload.sku] !== undefined) cost = Number(state.costs[payload.sku]);
state.mode = 'ручной режим';
state.overlay.update({
price: payload.price,
cost: cost === null ? 0 : cost,
settings: state.settings,
sku: payload.sku,
mode: state.mode
});
S.logEvent('manual_apply', { hasSku: !!payload.sku });
}
});
state.overlay.setMode('авто');
var found = scan();
if (state.overlay.setInfo) state.overlay.setInfo('авто · ' + found.length + ' пол.');
await S.logEvent('scan', { inputs: found.length, mode: 'auto' });
if (!found.length) {
setTimeout(function () {
if (!state.items.length) enableManual();
}, 1200);
}
observe();
document.addEventListener('keydown', function (ev) {
if (ev.key !== 'Escape' || state.calibrating || !state.overlay) return;
state.overlay.hide();
});
document.addEventListener('click', function (ev) {
if (state.calibrating || !state.items.length) return;
var target = ev.target;
if (!target || target.nodeType !== 1) return;
if (target.id === 'wbmg-host' || (target.closest && target.closest('#wbmg-host'))) return;
var node = target;
var depth = 0;
while (node && depth < 6) {
for (var i = 0; i < state.items.length; i++) {
if (state.items[i].row === node) {
if (state.active !== state.items[i]) activate(state.items[i]);
return;
}
}
node = node.parentElement;
depth++;
}
}, true);
return state;
}
function activateFirst() {
if (!state.items.length) scan();
if (state.items.length) {
var item = state.items[0];
state.overlay.show();
try { item.input.focus({ preventScroll: true }); } catch (e) { }
activate(item);
return true;
}
enableManual();
return false;
}
root.WbMarginEngine = {
init: init,
reload: reload,
scan: scan,
startCalibration: startCalibration,
activateFirst: activateFirst,
enableManual: enableManual,
getState: function () { return state; }
};
})(typeof globalThis !== 'undefined' ? globalThis : this);
;

/* demo/demo.js */
(async function () {
'use strict';
var S = window.WbMarginStore;
var Engine = window.WbMarginEngine;
var Calc = window.WbMarginCalc;
window.addEventListener('error', function (e) {
if (!document.body) return;
var out = document.createElement('div');
out.id = 'selftest';
out.textContent = 'SELFTEST FAIL: JS ' + (e && e.message ? e.message : 'error');
document.body.appendChild(out);
});
var summaryTimer = null;
function scheduleSummary() {
clearTimeout(summaryTimer);
summaryTimer = setTimeout(updateSummary, 120);
}
async function updateSummary() {
var el = document.getElementById('summary');
if (!el) return;
var data = await S.load();
var settings = data.settings;
var rows = document.querySelectorAll('tr[data-sku]');
var plus = 0, minus = 0, below = 0, sum = 0, counted = 0, withDiscount = 0;
Array.prototype.forEach.call(rows, function (tr) {
var priceInput = tr.querySelector('.price-input');
var price = priceInput ? Calc.toNum(priceInput.value) : 0;
if (price <= 0) return;
var costInput = tr.querySelector('.cost-input');
var cost = costInput ? Calc.toNum(costInput.value) : Calc.toNum(tr.dataset.cost || 0);
var discInput = tr.querySelector('.disc-input');
var disc = discInput ? Calc.toNum(discInput.value) : Calc.toNum(tr.dataset.discount || 0);
if (disc > 0) withDiscount++;
var merged = Object.assign({}, settings, { price: price, cost: cost });
var r = disc > 0 ? Calc.promoResult(merged, disc) : Calc.compute(merged);
counted++;
sum += r.profit;
if (r.profit < 0) { minus++; tr.dataset.state = 'loss'; }
else if (r.marginPct < Calc.toNum(settings.thresholdPct)) { below++; tr.dataset.state = 'below'; }
else { plus++; tr.dataset.state = 'ok'; }
});
if (counted < 1) {
el.hidden = true;
return;
}
el.hidden = false;
var baseBlock =
'<span class="total-wrap">Общая сумма прибыль-убыток: <b class="total ' + (sum < 0 ? 'bad' : 'ok') + '">' +
Calc.formatRub(sum) + '</b></span>';
el.innerHTML =
'<span class="counts">позиций: <b>' + counted + '</b></span>' +
'<span class="counts">в норме: <b class="ok">' + plus + '</b></span>' +
'<span class="counts">ниже порога: <b class="warn">' + below + '</b></span>' +
'<span class="counts">в минусе: <b class="bad">' + minus + '</b></span>' +
'<span class="counts">со скидкой: <b>' + withDiscount + '</b></span>' +
'<span class="totals">' + baseBlock + '</span>';
}
function plural(n, forms) {
var mod10 = n % 10;
var mod100 = n % 100;
if (mod10 === 1 && mod100 !== 11) return forms[0];
if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
return forms[2];
}
var SETTINGS_MAP = {
commissionPct: 's-commission',
taxPct: 's-tax',
thresholdPct: 's-threshold',
logistics: 's-logistics',
packaging: 's-packaging',
returnCost: 's-return',
buyoutPct: 's-buyout',
otherCosts: 's-other',
promoDiscountPct: 's-promo'
};
function $(id) { return document.getElementById(id); }
async function seedSettings() {
var data = await S.load();
var patch = {};
var changed = false;
Object.keys(SETTINGS_MAP).forEach(function (key) {
var input = $(SETTINGS_MAP[key]);
if (!input) return;
input.value = data.settings[key];
});
return patch;
}
async function seedCosts() {
var costs = {};
var rows = document.querySelectorAll('tr[data-sku]');
for (var i = 0; i < rows.length; i++) {
var row = rows[i];
if (row.dataset.cost !== undefined) costs[row.dataset.sku] = row.dataset.cost;
}
await S.setCostsMap(costs);
return costs;
}
function addDemoRow() {
var tbody = document.querySelector('.price-table tbody');
if (!tbody) return;
var index = tbody.rows.length + 1;
var article = String(900000 + Math.floor(Math.random() * 99999));
var tr = document.createElement('tr');
tr.dataset.sku = article;
tr.dataset.cost = '500';
tr.dataset.demoAdded = '1';
tr.innerHTML =
'<td class="mono"><input class="art-input" data-wbmg-ignore="1" type="text" inputmode="numeric" value="' + article + '"></td>' +
'<td><input class="name-input" data-wbmg-ignore="1" type="text" value="Новый товар ' + index + '"></td>' +
'<td class="num"><input class="cost-input" data-wbmg-ignore="1" type="text" inputmode="decimal" value="500"></td>' +
'<td><input class="price-input" type="text" inputmode="decimal" placeholder="Цена, ₽" value="1490"></td>' +
'<td class="num"><input class="disc-input" data-wbmg-ignore="1" type="text" inputmode="numeric" value="0"> <button type="button" class="row-del" title="Удалить строку">✕</button></td>';
var del = tr.querySelector('.row-del');
tbody.appendChild(tr);
bindCostInputs();
bindTextInputs();
bindDiscInputs();
Engine.scan();
scheduleSummary();
var input = tr.querySelector('input');
try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
input.dispatchEvent(new Event('input', { bubbles: true }));
}
function removeDemoRows() {
var rows = document.querySelectorAll('tr[data-demo-added]');
for (var i = 0; i < rows.length; i++) rows[i].remove();
}
function bindCostInputs() {
var inputs = document.querySelectorAll('.cost-input');
for (var i = 0; i < inputs.length; i++) {
(function (input) {
if (input.dataset.bound) return;
input.dataset.bound = '1';
input.addEventListener('input', function () {
var tr = input.closest('tr');
var value = Number(String(input.value).replace(/[^\d.,]/g, '').replace(',', '.'));
var cost = isFinite(value) ? value : 0;
if (tr) tr.dataset.cost = String(cost);
Engine.reload();
});
})(inputs[i]);
}
}
function bindDiscInputs() {
var inputs = document.querySelectorAll('.disc-input');
for (var i = 0; i < inputs.length; i++) {
(function (input) {
if (input.dataset.bound) return;
input.dataset.bound = '1';
input.addEventListener('input', function () {
var tr = input.closest('tr');
var value = Math.min(Math.max(Calc.toNum(input.value), 0), 100);
if (tr) tr.dataset.discount = String(value);
Engine.reload();
scheduleSummary();
});
})(inputs[i]);
}
}
function bindTextInputs() {
var articles = document.querySelectorAll('.art-input');
for (var i = 0; i < articles.length; i++) {
(function (input) {
if (input.dataset.bound) return;
input.dataset.bound = '1';
input.addEventListener('input', function () {
var tr = input.closest('tr');
if (!tr) return;
tr.dataset.sku = String(input.value).replace(/\D/g, '');
Engine.reload();
scheduleSummary();
});
})(articles[i]);
}
}
function applyDiscountToAll(value) {
var rows = document.querySelectorAll('tr[data-sku]');
Array.prototype.forEach.call(rows, function (tr) {
var input = tr.querySelector('.disc-input');
var pct = Math.min(Math.max(Calc.toNum(value), 0), 100);
if (input) input.value = String(pct);
tr.dataset.discount = String(pct);
});
}
function bindSettingsInputs() {
Object.keys(SETTINGS_MAP).forEach(function (key) {
var input = $(SETTINGS_MAP[key]);
if (!input) return;
input.addEventListener('input', async function () {
var patch = {};
patch[key] = input.value;
await S.saveSettings(patch);
if (key === 'promoDiscountPct') applyDiscountToAll(input.value);
await Engine.reload();
scheduleSummary();
});
});
}
var sortAsc = true;
async function sortRows() {
var tbody = document.querySelector('.price-table tbody');
if (!tbody) return;
var data = await S.load();
var settings = data.settings;
var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr[data-sku]'));
rows.forEach(function (tr) {
var priceInput = tr.querySelector('.price-input');
var price = priceInput ? Calc.toNum(priceInput.value) : 0;
var costInput = tr.querySelector('.cost-input');
var cost = costInput ? Calc.toNum(costInput.value) : Calc.toNum(tr.dataset.cost || 0);
var discInput = tr.querySelector('.disc-input');
var disc = discInput ? Calc.toNum(discInput.value) : Calc.toNum(tr.dataset.discount || 0);
var merged = Object.assign({}, settings, { price: price, cost: cost });
var r = disc > 0 ? Calc.promoResult(merged, disc) : Calc.compute(merged);
tr.dataset.sortProfit = String(r.profit);
});
rows.sort(function (a, b) {
var pa = Calc.toNum(a.dataset.sortProfit);
var pb = Calc.toNum(b.dataset.sortProfit);
return sortAsc ? pa - pb : pb - pa;
});
rows.forEach(function (tr) { tbody.appendChild(tr); });
sortAsc = !sortAsc;
Engine.scan();
scheduleSummary();
}
async function scenario(deltas) {
var out = document.getElementById('sim-result');
if (!out) return;
var data = await S.load();
var base = data.settings;
var changed = Object.assign({}, base);
if (deltas.commission) changed.commissionPct = Calc.toNum(base.commissionPct) + Calc.toNum(deltas.commission);
if (deltas.logistics) changed.logistics = Calc.toNum(base.logistics) + Calc.toNum(deltas.logistics);
if (deltas.packaging) changed.packaging = Calc.toNum(base.packaging) + Calc.toNum(deltas.packaging);
if (deltas.other) changed.otherCosts = Calc.toNum(base.otherCosts) + Calc.toNum(deltas.other);
var rows = document.querySelectorAll('tr[data-sku]');
var before = { loss: 0, sum: 0, total: 0 };
var after = { loss: 0, sum: 0 };
Array.prototype.forEach.call(rows, function (tr) {
var priceInput = tr.querySelector('.price-input');
var price = priceInput ? Calc.toNum(priceInput.value) : 0;
if (price <= 0) return;
var costInput = tr.querySelector('.cost-input');
var cost = costInput ? Calc.toNum(costInput.value) : Calc.toNum(tr.dataset.cost || 0);
var discInput = tr.querySelector('.disc-input');
var disc = discInput ? Calc.toNum(discInput.value) : Calc.toNum(tr.dataset.discount || 0);
var mergedBase = Object.assign({}, base, { price: price, cost: cost });
var mergedNew = Object.assign({}, changed, { price: price, cost: cost });
var rb = disc > 0 ? Calc.promoResult(mergedBase, disc) : Calc.compute(mergedBase);
var rn = disc > 0 ? Calc.promoResult(mergedNew, disc) : Calc.compute(mergedNew);
before.total++;
before.sum += rb.profit;
after.sum += rn.profit;
if (rb.profit < 0) before.loss++;
if (rn.profit < 0) after.loss++;
});
if (!before.total) {
out.textContent = 'Добавь хотя бы одну позицию с ценой.';
return;
}
var label = deltas.commission ? 'Комиссия +' + deltas.commission + '%'
: deltas.logistics ? 'Логистика +' + deltas.logistics + ' ₽'
: deltas.packaging ? 'Упаковка +' + deltas.packaging + ' ₽'
: 'Прочие +' + deltas.other + ' ₽';
var delta = after.sum - before.sum;
out.innerHTML = '<b>' + label + '</b> → убыточных станет: <b class="bad">' + after.loss + ' из ' + before.total +
'</b> (сейчас ' + before.loss + ') · общая сумма: <b class="' + (after.sum < 0 ? 'bad' : 'ok') + '">' +
Calc.formatRub(after.sum) + '</b> вместо ' + Calc.formatRub(before.sum) +
' · разница <b class="' + (delta < 0 ? 'bad' : 'ok') + '">' + (delta > 0 ? '+' : '') + Calc.formatRub(delta) + '</b>';
}
function bindButtons() {
var auto = $('btn-auto');
var manual = $('btn-manual');
var calibrate = $('btn-calibrate');
var reset = $('btn-reset');
var addRow = $('btn-add-row');
var tbody = document.querySelector('.price-table tbody');
if (tbody) {
tbody.addEventListener('click', function (ev) {
var button = ev.target.closest('.row-del');
if (!button) return;
ev.preventDefault();
var tr = button.closest('tr');
if (tr) tr.remove();
Engine.scan();
scheduleSummary();
});
}
if (auto) auto.addEventListener('click', function () { Engine.activateFirst(); });
if (addRow) addRow.addEventListener('click', function () { addDemoRow(); });
var sortBtn = $('btn-sort');
if (sortBtn) sortBtn.addEventListener('click', function () { sortRows(); });
var sim = $('sim');
if (sim) {
sim.addEventListener('click', function (ev) {
var btn = ev.target.closest('.sim-btn');
if (!btn) return;
if (btn.dataset.reset) {
var res = $('sim-result');
if (res) res.textContent = 'Нажми кнопку — покажу, сколько позиций станет убыточными и как изменится общая сумма.';
return;
}
scenario({
commission: btn.dataset.commission,
logistics: btn.dataset.logistics,
packaging: btn.dataset.packaging,
other: btn.dataset.other
});
});
}
if (manual) manual.addEventListener('click', function () {
Engine.enableManual({ price: 1990, sku: '123456' });
});
if (calibrate) calibrate.addEventListener('click', function () { Engine.startCalibration(); });
if (reset) reset.addEventListener('click', async function () {
await S.saveSettings({
commissionPct: 15,
taxPct: 6,
thresholdPct: 15,
logistics: 180,
packaging: 30,
returnCost: 50,
buyoutPct: 90,
otherCosts: 20,
promoDiscountPct: 0
});
location.reload();
});
}
await S.load();
var params = new URLSearchParams(location.search);
if (params.get('bg') === 'white') document.body.classList.add('bg-white');
if (params.get('shot') === '1') {
document.body.classList.add('shot-mode');
var tag = document.querySelector('.top .tag');
if (tag) tag.textContent = 'пример данных';
var topNote = document.querySelector('.top .note');
if (topNote) topNote.textContent = 'Кабинет продавца Wildberries · Цены и скидки';
Array.prototype.forEach.call(document.querySelectorAll('.settings, .hint, .actions'), function (el) {
el.parentNode.removeChild(el);
});
}
if (params.has('promo')) {
await S.saveSettings({ promoDiscountPct: Number(params.get('promo')) });
}
if (params.get('zero') === '1') {
await S.saveSettings({
commissionPct: 0, taxPct: 0, logistics: 0, packaging: 0,
returnCost: 0, otherCosts: 0, buyoutPct: 100, thresholdPct: 0, promoDiscountPct: 0
});
}
await seedSettings();
await seedCosts();
bindSettingsInputs();
bindButtons();
bindCostInputs();
bindTextInputs();
bindDiscInputs();
document.addEventListener('input', function (ev) {
var t = ev.target;
if (!t || !t.classList) return;
if (t.classList.contains('price-input') || t.classList.contains('cost-input')) scheduleSummary();
});
document.addEventListener('wbmg:promo', function (ev) {
var pct = ev && ev.detail && typeof ev.detail.pct === 'number' ? ev.detail.pct : null;
if (pct === null) return;
var st = Engine.getState();
var row = st && st.active ? st.active.row : null;
var field = row ? row.querySelector('.disc-input') : null;
if (field) field.value = String(Math.round(pct));
var global = document.getElementById('s-promo');
if (global) global.value = String(Math.round(pct));
scheduleSummary();
});
await Engine.init({});
var firstInput = document.querySelector('.price-input');
if (params.has('price') && firstInput) {
firstInput.value = params.get('price');
firstInput.dispatchEvent(new Event('input', { bubbles: true }));
}
window.setTimeout(function () {
var extra = Number(params.get('rows') || 0);
for (var i = 0; i < extra; i++) addDemoRow();
if (params.has('cost')) {
var costInput = document.querySelector('.cost-input');
if (costInput) {
costInput.value = params.get('cost');
costInput.dispatchEvent(new Event('input', { bubbles: true }));
}
}
if (params.has('promo')) applyDiscountToAll(params.get('promo'));
if (params.get('mode') === 'manual') Engine.enableManual({ price: 1990, sku: '123456' });
else Engine.activateFirst();
var st = Engine.getState();
if (st.overlay) {
document.body.classList.add('with-rail');
st.overlay.pinCorner();
}
scheduleSummary();
}, 200);
if (params.get('selftest') === '1') {
window.setTimeout(function () {
runSelfTest().catch(function (err) {
var out = document.createElement('div');
out.id = 'selftest';
out.textContent = 'SELFTEST FAIL: ' + (err && err.message ? err.message : String(err));
document.body.appendChild(out);
});
}, 900);
}
async function runSelfTest() {
var failures = [];
var wait = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };
function check(name, actual, expected) {
var a = String(actual === null || actual === undefined ? '' : actual).replace(/\s+/g, ' ').trim();
var e = String(expected).replace(/\s+/g, ' ').trim();
if (a !== e) failures.push(name + ': «' + a + '» вместо «' + e + '»');
}
var host = document.getElementById('wbmg-host');
var shadow = host && host.shadowRoot;
if (!shadow) {
failures.push('панель не создана');
} else {
var q = function (sel) { var el = shadow.querySelector(sel); return el ? el.textContent : ''; };
check('прибыль', q('.profit .value'), '717 ₽');
check('маржа', q('.metrics .margin'), '36%');
check('ROI', q('.metrics .roi'), '84%');
check('цена', q('.price-line .price'), '1 990 ₽');
check('артикул', q('.price-line .sku'), '#123456');
var chips = document.querySelectorAll('.wbmg-chip');
check('количество чипов', chips.length, 1);
check('чип', chips[0] && chips[0].textContent, '717 ₽ · 36%');
check('кандидатов ровно 3 (настройки не считаются ценой)', Engine.scan().length, 3);
var range = shadow.querySelector('.promo-range');
range.value = '50';
range.dispatchEvent(new Event('input', { bubbles: true }));
check('стоп-сигнал акции', String(q('.promo-line')).indexOf('СТОП') === 0, true);
range.value = '0';
range.dispatchEvent(new Event('input', { bubbles: true }));
check('подсказка максимальной скидки', String(q('.promo-line')).indexOf('45%') > -1, true);
var rows = document.querySelectorAll('tr[data-sku]');
if (rows.length > 1) {
var nameCell = rows[1].querySelector('td:nth-child(2)');
if (nameCell) {
nameCell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
check('клик по строке переключает позицию', q('.price-line .sku'), '#234567');
}
}
var summaryText = function () {
var el = document.getElementById('summary');
return el ? el.textContent : '';
};
var beforePromo = summaryText();
var chipOf = function (i) {
var tr = document.querySelectorAll('tr[data-sku]')[i];
var chip = tr ? tr.querySelector('.wbmg-chip') : null;
return chip ? chip.textContent : '';
};
var chipRow1Before = chipOf(0);
var chipRow2Before = chipOf(1);
range.value = '30';
range.dispatchEvent(new Event('input', { bubbles: true }));
await wait(300);
check('поле скидки синхронизировано', document.getElementById('s-promo').value, '30');
check('итог изменился из-за скидки', summaryText() !== beforePromo, true);
check('чип активной строки пересчитался', chipOf(1) !== chipRow2Before, true);
check('чип другой строки не тронут', chipOf(0) === chipRow1Before, true);
var discInput = document.querySelectorAll('.disc-input')[0];
if (discInput) {
var summaryBeforeRow = summaryText();
discInput.value = '40';
discInput.dispatchEvent(new Event('input', { bubbles: true }));
await wait(300);
check('скидка строки попала в итог', summaryText() !== summaryBeforeRow, true);
check('чип первой строки пересчитался', chipOf(0) !== chipRow1Before, true);
discInput.value = '0';
discInput.dispatchEvent(new Event('input', { bubbles: true }));
await wait(300);
}
range.value = '0';
range.dispatchEvent(new Event('input', { bubbles: true }));
await wait(300);
check('поле скидки обнулилось', document.getElementById('s-promo').value, '0');
check('итог вернулся к базовому', summaryText(), beforePromo);
var sortBtn = document.getElementById('btn-sort');
if (sortBtn) {
sortBtn.click();
await wait(250);
var firstSku = document.querySelector('tr[data-sku]').dataset.sku;
check('сортировка: убыточный сверху', firstSku, '345678');
}
var simBtn = document.querySelector('.sim-btn[data-commission]');
if (simBtn) {
simBtn.click();
await wait(300);
var simText = (document.getElementById('sim-result') || {}).textContent || '';
check('симулятор посчитал сценарий', simText.indexOf('убыточных станет') > -1, true);
check('симулятор показал разницу', simText.indexOf('разница') > -1, true);
}
}
var out = document.createElement('div');
out.id = 'selftest';
out.textContent = failures.length ? ('SELFTEST FAIL: ' + failures.join(' | ')) : 'SELFTEST OK';
document.body.appendChild(out);
document.title = failures.length ? 'SELFTEST FAIL' : 'SELFTEST OK';
}
})();
;
