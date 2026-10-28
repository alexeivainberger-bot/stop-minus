/* Демо: имитация таблицы цен кабинета WB.
   Работает прямо из файла, без установки расширения и без сервера. */
(async function () {
  'use strict';

  var S = window.WbMarginStore;
  var Engine = window.WbMarginEngine;
  var Calc = window.WbMarginCalc;

  /* Диагностика: любая ошибка страницы должна быть видна в ?selftest=1. */
  window.addEventListener('error', function (e) {
    if (!document.body) return;
    var out = document.createElement('div');
    out.id = 'selftest';
    out.textContent = 'SELFTEST FAIL: JS ' + (e && e.message ? e.message : 'error');
    document.body.appendChild(out);
  });

  var summaryTimer = null;

  /* Итог по всем позициям: сколько в плюсе/в минусе и сумма прибыли
     (по одной штуке каждой позиции — количества в демо нет). */
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

  /* Себестоимость в демо можно править прямо в таблице. */
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

  /* Скидка на каждую позицию отдельно. */
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

  /* Артикул и название тоже редактируемые: артикул уходит в data-sku строки. */
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

  /* «Скидка для всех» раскладывается по строкам. */
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

  /* Сортировка: убыточные вперёд, повторное нажатие — наоборот. */
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

  function bindButtons() {
    var auto = $('btn-auto');
    var manual = $('btn-manual');
    var calibrate = $('btn-calibrate');
    var reset = $('btn-reset');
    var addRow = $('btn-add-row');

    /* Удаление строк — один обработчик на таблицу (работает и для базовых,
       и для добавленных строк). */
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

  /* ?zero=1 — обнулить все расходы (для проверки «цена минус закупка») */
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

  /* Ползунок скидки в панели: пишет скидку в строку, синхронизирует её поле. */
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
    /* В демо панель держим в правом нижнем углу, чтобы не закрывать
       итоговую строку и заголовок таблицы. */
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

  /* Сквозная проверка того, что реально отрисовано: панель, цифры, чип, стоп-сигнал.
     Результат кладём в DOM, чтобы проверять headless-браузером. */
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

      /* Клик по названию (не по цене) должен переключить панель на другую позицию */
      var rows = document.querySelectorAll('tr[data-sku]');
      if (rows.length > 1) {
        var nameCell = rows[1].querySelector('td:nth-child(2)');
        if (nameCell) {
          nameCell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          check('клик по строке переключает позицию', q('.price-line .sku'), '#234567');
        }
      }

      /* Скидка меняет итог и чипы: проверяем, что сумма пересчиталась */
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

      /* Скидка на конкретную строку через её поле */
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

      /* Сортировка «убыточные вперёд» */
      var sortBtn = document.getElementById('btn-sort');
      if (sortBtn) {
        sortBtn.click();
        await wait(250);
        var firstSku = document.querySelector('tr[data-sku]').dataset.sku;
        check('сортировка: убыточный сверху', firstSku, '345678');
      }
    }

    var out = document.createElement('div');
    out.id = 'selftest';
    out.textContent = failures.length ? ('SELFTEST FAIL: ' + failures.join(' | ')) : 'SELFTEST OK';
    document.body.appendChild(out);
    document.title = failures.length ? 'SELFTEST FAIL' : 'SELFTEST OK';
  }
})();
