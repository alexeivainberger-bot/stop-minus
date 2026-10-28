/* Стоп-минус — расчётное ядро.
   Чистая логика: без DOM, без chrome.*, без сети.

   Формула (согласована в ТЗ):
     Комиссия         = Цена x k% / 100
     Налог            = Цена x t% / 100
     РасходыВозвраты  = returnCost x (1 - buyout/100)
     Прибыль          = Цена - Себестоимость - Упаковка - Логистика
                        - Комиссия - Налог - РасходыВозвраты - Прочие
     Маржа            = Прибыль / Цена x 100
     Вложено          = Себестоимость + Упаковка + Логистика + Прочие
     ROI              = Прибыль / Вложено x 100

   Акция: скидка уменьшает цену, а комиссия и налог считаются уже
   от цены со скидкой - поэтому маржа падает быстрее, чем кажется.
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WbMarginCalc = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

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

  /* Фиксированные затраты: не зависят от цены. */
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

    /* Деньги округляем до копеек: иначе «цена в ноль» вылезает как -5e-14
       и продажа «в минус» определяется на пустом месте. */
    var commission = round(price * commissionPct / 100, 2);
    var tax = round(price * taxPct / 100, 2);
    var returnsCost = round(returnCost * (1 - buyoutPct / 100), 2);
    var profit = round(price - cost - packaging - logistics - commission - tax - returnsCost - otherCosts, 2);
    var marginPct = price > 0 ? (profit / price) * 100 : 0;
    var invested = cost + packaging + logistics + otherCosts;
    var roiPct = invested > 0 ? (profit / invested) * 100 : 0;

    var status = 'ok';
    if (price <= 0) {
      /* Цены нет — считать нечего, показываем прочерк, а не убыток от фикс. затрат. */
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

  /* Минимальная цена, при которой маржа равна targetMarginPct.
     targetMarginPct = 0 -> цена «в ноль».
     Решение: P*(1 - k - t - m) = фикс.затраты. */
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

  /* Максимальная скидка в %, при которой маржа ещё не ниже targetMarginPct.
     Цена со скидкой: P*(1 - d), а комиссия и налог — тоже от неё.
     (1-d) * P * (1 - k - t - m) = фикс.затраты  =>
     d = 1 - фикс.затраты / (P * (1 - k - t - m)) */
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

  /* Маржа при скидке discountPct (для UI и тестов). */
  function promoResult(raw, discountPct) {
    var p = pick(raw);
    var d = Math.min(Math.max(toNum(discountPct), 0), 100);
    var discountedPrice = Math.max(toNum(p.price), 0) * (1 - d / 100);

    /* Скидка 100%: товар уходит бесплатно, значит теряются фиксированные
       затраты. Обычный compute(price = 0) вернул бы «пусто», поэтому считаем явно. */
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
    var rounded = Math.round(v);
    return (rounded === 0 && v < 0 ? 0 : rounded) + '%';
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
    warningText: warningText,
    statusLabel: statusLabel
  };
});
