/* Стоп-минус — разбор CSV-выгрузки с ценами.
   Работает и в Node (тесты), и в браузере. Ничего не отправляет. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WbMarginAudit = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var HEADER = {
    article: ['артикул', 'article', 'sku', 'арт', 'код', 'id'],
    price: ['цена', 'price', 'цена продажи', 'текущая цена', 'цена, руб', 'цена руб'],
    cost: ['себестоимость', 'cost', 'закупка', 'закуп', 'себес', 'закупочная цена'],
    qty: ['количество', 'кол-во', 'колво', 'qty', 'quantity', 'остаток', 'шт']
  };

  function norm(value) {
    return String(value || '')
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function num(value) {
    var text = String(value === null || value === undefined ? '' : value)
      .replace(/\s|\u00a0/g, '')
      .replace(/[₽руб.]/gi, '')
      .replace(',', '.');
    if (!text) return null;
    var parsed = Number(text);
    return isFinite(parsed) ? parsed : null;
  }

  function detectDelimiter(line) {
    var counts = { ';': 0, ',': 0, '\t': 0 };
    var quoted = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') quoted = !quoted;
      else if (!quoted && counts[ch] !== undefined) counts[ch]++;
    }
    if (counts[';'] >= counts[','] && counts[';'] >= counts['\t'] && counts[';'] > 0) return ';';
    if (counts['\t'] > 0 && counts['\t'] >= counts[',']) return '\t';
    return ',';
  }

  function splitLine(line, delimiter) {
    var out = [];
    var field = '';
    var quoted = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (quoted) {
        if (ch === '"') {
          if (line[i + 1] === '"') { field += '"'; i++; }
          else quoted = false;
        } else field += ch;
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === delimiter) {
        out.push(field);
        field = '';
      } else field += ch;
    }
    out.push(field);
    return out;
  }

  function columnIndex(header, synonyms) {
    for (var c = 0; c < header.length; c++) {
      var cell = norm(header[c]);
      for (var s = 0; s < synonyms.length; s++) {
        if (cell === synonyms[s] || cell.indexOf(synonyms[s]) === 0) return c;
      }
    }
    return -1;
  }

  function parse(text) {
    var raw = String(text || '').replace(/^\uFEFF/, '');
    var lines = raw.split(/\r?\n/).filter(function (line) { return line.trim() !== ''; });
    if (!lines.length) return { ok: false, error: 'Файл пустой' };

    var delimiter = detectDelimiter(lines[0]);
    var start = 0;
    var header = null;
    for (var i = 0; i < Math.min(lines.length, 10); i++) {
      var cells = splitLine(lines[i], delimiter);
      if (columnIndex(cells, HEADER.price) !== -1) {
        header = cells;
        start = i + 1;
        break;
      }
    }

    if (!header) {
      return { ok: false, error: 'Не нашёл колонку с ценой. Нужен CSV с заголовками «Артикул; Цена; Себестоимость».' };
    }

    var priceCol = columnIndex(header, HEADER.price);
    var costCol = columnIndex(header, HEADER.cost);
    var articleCol = columnIndex(header, HEADER.article);
    var qtyCol = columnIndex(header, HEADER.qty);

    var rows = [];
    var skipped = 0;
    var noCost = 0;

    for (var r = start; r < lines.length; r++) {
      var parts = splitLine(lines[r], delimiter);
      var price = num(parts[priceCol]);
      if (price === null || price <= 0) { skipped++; continue; }
      var cost = costCol === -1 ? null : num(parts[costCol]);
      var article = articleCol === -1 ? '' : String(parts[articleCol] || '').trim();
      var qty = qtyCol === -1 ? 1 : (num(parts[qtyCol]) || 0);
      qty = Math.max(1, Math.round(qty));
      if (cost === null) { noCost++; cost = 0; }
      rows.push({ article: article, price: price, cost: cost, qty: qty });
    }

    if (!rows.length) {
      return { ok: false, error: 'В файле не нашлось строк с ценой. Проверь, что цены — числа.', skipped: skipped };
    }

    return {
      ok: true,
      rows: rows,
      total: rows.length,
      skipped: skipped,
      noCost: noCost,
      delimiter: delimiter,
      columns: { price: priceCol, cost: costCol, article: articleCol, qty: qtyCol }
    };
  }

  return { parse: parse, num: num };
});
