/*!
 * azb carousel — листалка фото в карточке товара (media-карусель).
 * Источник: https://github.com/videojam46-beep/azbuka46-assets/blob/main/loader/carousel.js
 *
 * Что делает: превращает .azb-carousel в слайдер — стрелки ‹ ›, свайп на
 * телефоне, стрелки клавиатуры. Цветные чипы .azb-colorchip с атрибутом
 * data-go="N" в том же .azb-prod__media работают как переключатели цвета.
 * Метка .azb-carousel__label показывает название текущего цвета (из data-color
 * или alt активного слайда). Конфиг не нужен — подключил, работает.
 *
 * Подключение в HEAD сайта Tilda (один раз на сайт):
 *   <script src="https://cdn.jsdelivr.net/gh/videojam46-beep/azbuka46-assets@main/loader/carousel.js"></script>
 *
 * Разметка (см. блок sportex-klassik):
 *   <div class="azb-carousel" data-azb-carousel>
 *     <div class="azb-carousel__track">
 *       <div class="azb-carousel__slide"><img src="…" data-color="Синий"></div> …
 *     </div>
 *     <button class="azb-carousel__nav azb-carousel__nav--prev">‹</button>
 *     <button class="azb-carousel__nav azb-carousel__nav--next">›</button>
 *     <span class="azb-carousel__label"></span>
 *   </div>
 */
(function () {
  'use strict';

  if (window.__azbCarousel) return; // защита от двойного подключения
  window.__azbCarousel = true;

  function initOne(root) {
    if (root.getAttribute('data-azb-ready')) return;
    root.setAttribute('data-azb-ready', '1');

    var track = root.querySelector('.azb-carousel__track');
    if (!track) return;
    var slides = [].slice.call(track.children);
    var n = slides.length;
    if (!n) return;

    var prev = root.querySelector('.azb-carousel__nav--prev');
    var next = root.querySelector('.azb-carousel__nav--next');
    var label = root.querySelector('.azb-carousel__label');

    // чипы-переключатели ищем во всём media-блоке (родитель карусели)
    var scope = root.closest('.azb-prod__media') || root.parentNode || root;
    var chips = [].slice.call(scope.querySelectorAll('[data-go]'));

    var index = 0;

    function colorOf(i) {
      var img = slides[i] ? slides[i].querySelector('img') : null;
      if (!img) return '';
      return (img.getAttribute('data-color') || img.getAttribute('alt') || '').trim();
    }

    function render() {
      track.style.transform = 'translateX(' + (-index * 100) + '%)';
      if (prev) prev.disabled = (index <= 0);
      if (next) next.disabled = (index >= n - 1);
      if (label) label.textContent = colorOf(index);
      for (var c = 0; c < chips.length; c++) {
        var gi = parseInt(chips[c].getAttribute('data-go'), 10);
        if (gi === index) chips[c].classList.add('is-active');
        else chips[c].classList.remove('is-active');
      }
    }

    function go(i) {
      if (i < 0) i = 0;
      if (i > n - 1) i = n - 1;
      index = i;
      render();
    }

    if (prev) prev.addEventListener('click', function () { go(index - 1); });
    if (next) next.addEventListener('click', function () { go(index + 1); });

    for (var c = 0; c < chips.length; c++) {
      (function (chip) {
        chip.addEventListener('click', function () {
          var gi = parseInt(chip.getAttribute('data-go'), 10);
          if (!isNaN(gi)) go(gi);
        });
      })(chips[c]);
    }

    // клавиатура (когда карусель в фокусе)
    if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '0');
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    });

    // свайп по горизонтали (порог 40px), вертикальный скролл не мешаем
    var sx = 0, sy = 0, tracking = false;
    root.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0];
      sx = t.clientX; sy = t.clientY; tracking = true;
    }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) go(index + 1); else go(index - 1);
      }
    }, { passive: true });

    render();
  }

  function initAll() {
    var list = document.querySelectorAll('[data-azb-carousel]');
    for (var i = 0; i < list.length; i++) initOne(list[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
  // Tilda дорисовывает блоки асинхронно — подстрахуемся повторным проходом
  setTimeout(initAll, 800);
  window.addEventListener('load', initAll);
})();
