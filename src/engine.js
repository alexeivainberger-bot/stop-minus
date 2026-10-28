/* Стоп-минус — движок страницы.
   Три режима (как в ТЗ):
     1) авто        — эвристика находит поле цены и рисует блок рядом;
     2) калибровка  — пользователь один раз кликает по полю цены, путь сохраняется;
     3) ручной      — плавающая панель с ручным вводом цены и артикула.
   Принципы: только чтение, никаких запросов к маркетплейсу, никаких кликов
   по чужим кнопкам. Всё, что создаёт движок, живёт в своей панели/чипах. */
(function (root) {
  'use strict';

  var C = root.WbMarginCalc;
  var S = root.WbMarginStore;
  var OV = root.WbMarginOverlay;
  var CHIP_ID = 'wbmg-chip-style';

  /* Один и тот же input не должен получать второй слушатель и второй чип:
     MutationObserver пересканирует страницу часто, поэтому элементы кэшируем. */
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
    /* Вёрстка может быть без таблицы: поднимаемся вверх, пока не найдём
       контейнер, в тексте которого есть артикул (карточки, div-сетки). */
    var node = el.parentElement;
    var depth = 0;
    while (node && depth < 4) {
      /* Не поднимаемся до body/main: иначе «строкой» станет вся страница,
         в тексте которой есть артикул, — и обычное поле настроек станет «ценой». */
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

  function resolveCost(item) {
    if (!item) return null;
    /* Сначала значение из строки (демо/тестовые данные, где себестоимость
       можно править прямо в таблице), потом — сохранённые себестоимости. */
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
    if (input.getAttribute('data-wbmg-ignore')) return -1; /* поле себестоимости в демо — не цена */

    /* Дешёвый отсев: поле без намёка на цену и без числа — точно не наше.
       Дорогие проверки (layout, computed style) остаются только для кандидатов. */
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
      mode: state.mode
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
    var promoPct = C.toNum(state.settings.promoDiscountPct);
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
        state.settings.promoDiscountPct = pct;
        S.saveSettings({ promoDiscountPct: pct });
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

    /* Esc — убрать панель с глаз, не трогая страницу. */
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || state.calibrating || !state.overlay) return;
      state.overlay.hide();
    });

    /* Клик по любому месту строки (артикул, название, себестоимость)
       переключает панель на эту позицию — не только клик по цене. */
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
      try { item.input.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
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
