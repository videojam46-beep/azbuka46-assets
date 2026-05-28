/*!
 * azb prices-loader — динамический прайс из Я.Диска для карточек товаров.
 * Источник: https://github.com/videojam46-beep/azbuka46-assets/blob/main/loader/prices-loader.js
 *
 * Подключение в HEAD сайта Tilda:
 *   <script>
 *     window.AZB_PRICES_CONFIG = {
 *       url: 'https://disk.yandex.ru/d/XXXXXXXXXXXXX',  // публичная ссылка на prices.csv
 *       cacheTTL: 300,    // секунды, localStorage-кэш (по умолчанию 300 = 5 мин)
 *       debug: false      // включить логи в консоль
 *     };
 *   </script>
 *   <script src="https://cdn.jsdelivr.net/gh/videojam46-beep/azbuka46-assets@main/loader/prices-loader.js"></script>
 *
 * Если конфига нет или fetch упал — ничего не меняется, цены из HTML остаются как fallback.
 */
(function () {
  'use strict';

  var CFG = window.AZB_PRICES_CONFIG;
  if (!CFG || !CFG.url) return; // нет конфига — тихий выход, дефолты HTML работают

  var CACHE_KEY = 'azb-prices-cache-v1';
  var TTL = (CFG.cacheTTL || 300) * 1000; // мс
  var DEBUG = !!CFG.debug;

  function log() {
    if (DEBUG && window.console) console.log.apply(console, ['[azb-prices]'].concat([].slice.call(arguments)));
  }
  function warn() {
    if (DEBUG && window.console) console.warn.apply(console, ['[azb-prices]'].concat([].slice.call(arguments)));
  }

  // ── localStorage cache ─────────────────────────────────────────────────────
  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (Date.now() - obj.t > TTL) return null;
      return obj.csv;
    } catch (e) { return null; }
  }
  function writeCache(csv) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), csv: csv })); }
    catch (e) { /* localStorage full / disabled — ничего страшного */ }
  }

  // ── получение прямого URL файла из Я.Диск API (для disk.yandex.ru / yadi.sk)
  function resolveUrl(url) {
    if (/disk\.yandex\.|yadi\.sk/.test(url)) {
      var api = 'https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=' + encodeURIComponent(url);
      return fetch(api).then(function (r) {
        if (!r.ok) throw new Error('Я.Диск API HTTP ' + r.status);
        return r.json();
      }).then(function (json) { return json.href; });
    }
    // Иначе — direct URL (Mail.ru direct link, Object Storage, jsDelivr и т.п.)
    return Promise.resolve(url);
  }

  // ── простой CSV-парсер с поддержкой кавычек и escape ──────────────────────
  function parseCsvLine(line, delim) {
    var out = [], cur = '', inQ = false, i = 0;
    while (i < line.length) {
      var ch = line.charAt(i);
      if (inQ) {
        if (ch === '"') {
          if (line.charAt(i + 1) === '"') { cur += '"'; i += 2; continue; } // escaped ""
          inQ = false; i++; continue;
        }
        cur += ch; i++;
      } else {
        if (ch === delim) { out.push(cur); cur = ''; i++; continue; }
        if (ch === '"' && cur === '') { inQ = true; i++; continue; }
        cur += ch; i++;
      }
    }
    out.push(cur);
    return out;
  }

  // Автоопределение разделителя: Excel в RU-локали пишет «;», в EN — «,».
  // Считаем оба символа в неcomment-строках и берём что чаще.
  function detectDelimiter(text) {
    var lines = text.split(/\r?\n/);
    var sample = '', count = 0;
    for (var i = 0; i < lines.length && count < 10; i++) {
      var l = lines[i].trim();
      if (!l || l.charAt(0) === '#') continue;
      sample += l + '\n';
      count++;
    }
    var commas = (sample.match(/,/g) || []).length;
    var semis = (sample.match(/;/g) || []).length;
    return semis > commas ? ';' : ',';
  }

  function parseCsv(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // BOM
    var delim = detectDelimiter(text);
    log('CSV разделитель:', delim === ';' ? '«;» (RU Excel)' : '«,» (стандарт)');
    var map = Object.create(null);
    var lines = text.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;                         // пустая
      if (line.charAt(0) === '#') continue;        // комментарий-секция
      var fields = parseCsvLine(line, delim);
      if (fields.length < 4) continue;             // битая строка
      var product = fields[0].trim();
      if (!product || product === 'product') continue; // шапка / пусто
      var row = fields[1].trim();
      var tier = fields[2].trim();
      var price = fields[3].trim();
      if (!row || !tier) continue;
      map[product + '|' + row + '|' + tier] = price;
    }
    return map;
  }

  // ── подстановка цен в DOM ─────────────────────────────────────────────────
  function applyPrices(priceMap) {
    var count = 0;
    var cards = document.querySelectorAll('[data-product]');
    for (var c = 0; c < cards.length; c++) {
      var card = cards[c];
      var product = card.getAttribute('data-product');
      if (!product) continue;
      var rows = card.querySelectorAll('tr[data-pack], tr[data-thickness], tr[data-epdm], tr[data-fraction]');
      for (var r = 0; r < rows.length; r++) {
        var tr = rows[r];
        var row = tr.getAttribute('data-pack')
               || tr.getAttribute('data-thickness')
               || tr.getAttribute('data-epdm')
               || tr.getAttribute('data-fraction');
        if (!row) continue;
        var cells = tr.querySelectorAll('td[data-tier]');
        for (var t = 0; t < cells.length; t++) {
          var td = cells[t];
          var tier = td.getAttribute('data-tier');
          var key = product + '|' + row + '|' + tier;
          if (priceMap[key] !== undefined) {
            td.textContent = priceMap[key]; // только textContent — XSS невозможен
            count++;
          }
        }
      }
    }
    log('применено ячеек:', count);
  }

  // ── основной запуск ───────────────────────────────────────────────────────
  function run() {
    var cached = readCache();
    if (cached) {
      log('из кэша');
      applyPrices(parseCsv(cached));
      return;
    }
    log('загружаю прайс:', CFG.url);
    resolveUrl(CFG.url)
      .then(function (direct) { return fetch(direct); })
      .then(function (r) {
        if (!r.ok) throw new Error('CSV HTTP ' + r.status);
        return r.text();
      })
      .then(function (csv) {
        writeCache(csv);
        applyPrices(parseCsv(csv));
      })
      .catch(function (err) {
        warn('ошибка загрузки прайса:', err && err.message ? err.message : err);
        // Дефолты в HTML остаются — сайт продолжает работать.
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
