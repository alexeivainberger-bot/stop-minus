/* Стоп-минус — оверлей.
   Панель в Shadow DOM: не конфликтует со стилями кабинета.
   Только отображение: ничего не кликает и не меняет в чужом интерфейсе. */
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

      /* Себестоимость не задана: не показываем «прибыль» из воздуха. */
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

      /* Симуляция акции считаем ДО вывода цифр: при скидке > 0 главные числа
         показывают экономику уже со скидкой, а не только базовую цену. */
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

      /* Явное сравнение «без скидки → со скидкой», чтобы не приходилось
         сопоставлять числа из разных мест. */
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

      /* При включённой скидке отдельная плашка «продажа в минус» не нужна:
         стоп-сигнал уже есть в строке акции. */
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
      try { refs.mPrice.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
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
      /* Сообщаем странице (демо) о смене скидки, чтобы обновились суммы и поле. */
      try {
        document.dispatchEvent(new CustomEvent('wbmg:promo', { detail: { pct: pct } }));
      } catch (e) { /* старые браузеры — просто пропускаем */ }
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
      /* Если ни снизу, ни сверху места нет — встаём справа от поля, но не
         залезаем на шапку кабинета: верх прижимаем к границе экрана. */
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

    /* Прижать панель к правому нижнему углу (демо, скриншоты, «убери с глаз»). */
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
