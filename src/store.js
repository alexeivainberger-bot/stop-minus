/* Стоп-минус — хранилище настроек.
   Работает и в расширении (chrome.storage.local), и в демо-странице (localStorage).
   Ничего никуда не отправляет. */
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
    telemetryConsent: false
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
      } catch (e) { /* ignore */ }
    }
    if (!raw) {
      try {
        raw = JSON.parse(root.localStorage.getItem(KEY) || 'null');
      } catch (e) { /* ignore */ }
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
      } catch (e) { /* ignore */ }
    }
    try {
      root.localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
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

  /* Импорт выгрузки из Excel: «123456;620», «123456,620», табы, кавычки.
     Строка заголовка и мусор молча пропускаются. */
  function parseCsvCosts(text) {
    var out = {};
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var raw = line.replace(/^\uFEFF/, '').trim();
      if (!raw) return;
      /* Разделитель выбираем по строке: запятая внутри «150,5» — это
         десятичный разделитель, а не разделитель колонок. */
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

  /* Локальный журнал технических событий. Никуда не отправляется.
     Пишется только при явном согласии (галочка в настройках). */
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
