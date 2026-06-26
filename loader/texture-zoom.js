/*!
 * azb texture-zoom — лайтбокс для миниатюр текстур в карточках товаров.
 * Источник: https://github.com/videojam46-beep/azbuka46-assets/blob/main/loader/texture-zoom.js
 *
 * Что делает: по клику на миниатюру текстуры открывает её крупно по центру
 * экрана на затемнённом фоне. Повторный клик (по картинке, по фону, по крестику
 * или Esc) — закрывает. Конфиг не нужен, подключил — работает.
 *
 * Подключение в HEAD сайта Tilda (один раз на сайт):
 *   <script src="https://cdn.jsdelivr.net/gh/videojam46-beep/azbuka46-assets@main/loader/texture-zoom.js"></script>
 *
 * Подхватываются миниатюры по селекторам (см. SELECTOR ниже):
 *   • .azb-tile-plate img            — текстуры/позиции плитки
 *   • .azb-prod--catalog .azb-texture-tile img — текстуры Apoluza
 *   • .azb-substrate__img            — текстуры оснований
 */
(function () {
  'use strict';

  if (window.__azbTextureZoom) return; // защита от двойного подключения
  window.__azbTextureZoom = true;

  var SELECTOR = [
    '.azb-tile-plate img',
    '.azb-prod--catalog .azb-texture-tile img',
    '.azb-substrate__img'
  ].join(',');

  var box = null;     // корневой элемент оверлея
  var boxImg = null;  // крупная картинка
  var boxCap = null;  // подпись
  var lastFocus = null;

  // ── подпись к текстуре: figcaption → .azb-substrate__label → alt/title ──────
  function captionFor(img) {
    var fig = img.closest('figure');
    if (fig) {
      var fc = fig.querySelector('figcaption');
      if (fc && fc.textContent.trim()) return fc.textContent.trim();
    }
    var wrap = img.closest('.azb-substrate');
    if (wrap) {
      var lbl = wrap.querySelector('.azb-substrate__label');
      if (lbl && lbl.textContent.trim()) return lbl.textContent.trim();
    }
    return (img.getAttribute('alt') || img.getAttribute('title') || '').trim();
  }

  // ── создаём оверлей один раз ────────────────────────────────────────────────
  function ensureBox() {
    if (box) return;
    box = document.createElement('div');
    box.className = 'azb-lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML =
      '<button class="azb-lightbox__close" type="button" aria-label="Закрыть">&times;</button>' +
      '<figure class="azb-lightbox__fig">' +
        '<img class="azb-lightbox__img" alt="">' +
        '<figcaption class="azb-lightbox__cap"></figcaption>' +
      '</figure>';
    document.body.appendChild(box);
    boxImg = box.querySelector('.azb-lightbox__img');
    boxCap = box.querySelector('.azb-lightbox__cap');

    // закрытие: клик по фону, по картинке, по крестику
    box.addEventListener('click', function () { close(); });
    // клики внутри figure не должны «проваливаться» — но картинку закрываем,
    // поэтому стопаем всплытие только у подписи, чтобы выделять текст было можно
    boxCap.addEventListener('click', function (e) { e.stopPropagation(); });
  }

  function open(img) {
    ensureBox();
    var src = img.currentSrc || img.src;
    var cap = captionFor(img);
    boxImg.src = src;
    boxImg.alt = cap || '';
    boxCap.textContent = cap;
    boxCap.style.display = cap ? '' : 'none';
    lastFocus = document.activeElement;
    document.documentElement.classList.add('azb-lightbox-lock');
    // принудительный reflow для запуска transition
    box.offsetWidth; // eslint-disable-line no-unused-expressions
    box.classList.add('is-open');
    var btn = box.querySelector('.azb-lightbox__close');
    if (btn) btn.focus();
  }

  function close() {
    if (!box) return;
    box.classList.remove('is-open');
    document.documentElement.classList.remove('azb-lightbox-lock');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  // ── делегированный клик: работает для блоков, отрисованных в любой момент ────
  document.addEventListener('click', function (e) {
    var img = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
    if (!img) return;
    // не перехватываем, если миниатюра обёрнута в ссылку
    if (img.closest('a')) return;
    if (!(img.currentSrc || img.src)) return;
    e.preventDefault();
    open(img);
  }, false);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && box && box.classList.contains('is-open')) close();
  });
})();
