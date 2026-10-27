/* Демо: имитация таблицы цен кабинета WB.
   Работает прямо из файла, без установки расширения и без сервера. */
(async function () {
  'use strict';

  var S = window.WbMarginStore;
  var Engine = window.WbMarginEngine;

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
    tr.innerHTML =
      '<td class="mono">' + article + '</td>' +
      '<td>Новый товар ' + index + '</td>' +
      '<td class="num">500 ₽</td>' +
      '<td><input class="price-input" type="text" inputmode="decimal" placeholder="Цена, ₽" value="1490"></td>' +
      '<td class="num muted">0%</td>';
    tbody.appendChild(tr);
    Engine.scan();
    var input = tr.querySelector('input');
    try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function bindSettingsInputs() {
    Object.keys(SETTINGS_MAP).forEach(function (key) {
      var input = $(SETTINGS_MAP[key]);
      if (!input) return;
      input.addEventListener('input', async function () {
        var patch = {};
        patch[key] = input.value;
        await S.saveSettings(patch);
        await Engine.reload();
      });
    });
  }

  function bindButtons() {
    var auto = $('btn-auto');
    var manual = $('btn-manual');
    var calibrate = $('btn-calibrate');
    var reset = $('btn-reset');
    var addRow = $('btn-add-row');

    if (auto) auto.addEventListener('click', function () { Engine.activateFirst(); });
    if (addRow) addRow.addEventListener('click', function () { addDemoRow(); });
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
      await seedSettings();
      await Engine.reload();
    });
  }

  await S.load();

  /* Параметры для скриншотов и быстрых проверок:
     demo.html?price=1000    — красная зона
     demo.html?promo=50      — стоп-сигнал по акции
     demo.html?mode=manual   — ручной режим */
  var params = new URLSearchParams(location.search);
  if (params.get('bg') === 'white') document.body.classList.add('bg-white');

  /* ?shot=1 — режим для скриншотов каталога: убираем служебную обвязку демо,
     оставляем продуктовый вид (таблица + панель). */
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

  await seedSettings();
  await seedCosts();
  bindSettingsInputs();
  bindButtons();

  await Engine.init({});

  var firstInput = document.querySelector('.price-input');
  if (params.has('price') && firstInput) {
    firstInput.value = params.get('price');
    firstInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  window.setTimeout(function () {
    if (params.get('mode') === 'manual') Engine.enableManual({ price: 1990, sku: '123456' });
    else Engine.activateFirst();
    if (params.get('panel') === 'corner') {
      document.body.classList.add('with-rail');
      var st = Engine.getState();
      if (st.overlay) st.overlay.pinCorner();
    }
  }, 200);

  if (params.get('selftest') === '1') {
    window.setTimeout(runSelfTest, 900);
  }

  /* Сквозная проверка того, что реально отрисовано: панель, цифры, чип, стоп-сигнал.
     Результат кладём в DOM, чтобы проверять headless-браузером. */
  function runSelfTest() {
    var failures = [];
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

      var range = shadow.querySelector('.promo-range');
      range.value = '50';
      range.dispatchEvent(new Event('input', { bubbles: true }));
      check('стоп-сигнал акции', String(q('.promo-line')).indexOf('СТОП') === 0, true);

      range.value = '0';
      range.dispatchEvent(new Event('input', { bubbles: true }));
      check('подсказка максимальной скидки', String(q('.promo-line')).indexOf('45%') > -1, true);
    }

    var out = document.createElement('div');
    out.id = 'selftest';
    out.textContent = failures.length ? ('SELFTEST FAIL: ' + failures.join(' | ')) : 'SELFTEST OK';
    document.body.appendChild(out);
    document.title = failures.length ? 'SELFTEST FAIL' : 'SELFTEST OK';
  }
})();
