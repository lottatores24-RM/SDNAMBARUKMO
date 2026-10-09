/* SD Negeri Ambarukmo: interaksi halaman (menu, animasi, slider, lightbox, video) */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobileNav = window.matchMedia('(max-width: 1100px)');

  /* ---------- menu ---------- */
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');

  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 40);
  }
  if (header) {
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function closeDropdowns(except) {
    document.querySelectorAll('.nav__item--open').forEach(function (item) {
      if (item === except) return;
      item.classList.remove('nav__item--open');
      item.querySelector('.nav__link').setAttribute('aria-expanded', 'false');
    });
  }

  function setNav(open) {
    header.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
    if (!open) closeDropdowns();
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      setNav(!header.classList.contains('nav-open'));
    });
  }

  document.querySelectorAll('.nav__item--dropdown > .nav__link').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.parentElement;
      var open = !item.classList.contains('nav__item--open');
      closeDropdowns(item);
      item.classList.toggle('nav__item--open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.navbar')) {
      closeDropdowns();
      if (header && header.classList.contains('nav-open')) setNav(false);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeDropdowns();
    if (header && header.classList.contains('nav-open')) {
      setNav(false);
      toggle.focus();
    }
  });

  mobileNav.addEventListener('change', function () {
    if (header) setNav(false);
  });

  /* ---------- animasi muncul saat di-scroll ---------- */
  var revealItems = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealItems.forEach(function (el) { io.observe(el); });
  } else {
    revealItems.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- slider (geser, drag, tombol, titik) ---------- */
  document.querySelectorAll('.slider').forEach(function (slider) {
    var track = slider.querySelector('.slider__track');
    var slides = Array.prototype.slice.call(track.children);
    var prev = slider.querySelector('.slider__btn--prev');
    var next = slider.querySelector('.slider__btn--next');
    var dotsWrap = slider.querySelector('.slider__dots');
    var dots = [];

    function step() {
      var s = slides[0];
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return s ? s.getBoundingClientRect().width + gap : track.clientWidth;
    }
    function maxScroll() { return track.scrollWidth - track.clientWidth - 2; }
    function current() { return Math.round(track.scrollLeft / step()); }

    function go(dir) {
      if (dir > 0 && track.scrollLeft >= maxScroll()) track.scrollTo({ left: 0 });
      else if (dir < 0 && track.scrollLeft <= 2) track.scrollTo({ left: track.scrollWidth });
      else track.scrollBy({ left: dir * step() });
    }
    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });

    if (dotsWrap) {
      slides.forEach(function (_, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Ke foto ' + (i + 1));
        b.addEventListener('click', function () { track.scrollTo({ left: i * step() }); });
        dotsWrap.appendChild(b);
        dots.push(b);
      });
    }
    function update() {
      var i = track.scrollLeft >= maxScroll() ? slides.length - 1 : current();
      dots.forEach(function (d, j) { d.setAttribute('aria-current', String(j === i)); });
    }
    var raf;
    track.addEventListener('scroll', function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    }, { passive: true });
    update();

    // geser pakai mouse (desktop); sentuh di HP sudah ditangani browser
    var startX = 0, startLeft = 0, moved = false, down = false;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false;
      startX = e.clientX; startLeft = track.scrollLeft;
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 6) { moved = true; track.classList.add('is-dragging'); }
      if (moved) track.scrollLeft = startLeft - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false;
      if (moved) {
        track.classList.remove('is-dragging');
        var target = Math.round(track.scrollLeft / step()) * step();
        track.scrollTo({ left: target });
      }
    });
    track.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
  });

  /* ---------- lightbox ---------- */
  var groups = {};
  document.querySelectorAll('[data-lightbox]').forEach(function (el) {
    var g = el.getAttribute('data-lightbox');
    (groups[g] = groups[g] || []).push(el);
  });

  if (Object.keys(groups).length) {
    var icon = function (d) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
    };
    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Tampilan foto');
    box.innerHTML =
      '<div class="lightbox__stage"><img class="lightbox__img" alt=""></div>' +
      '<button type="button" class="lightbox__btn lightbox__close" aria-label="Tutup">' + icon('M6 6l12 12M18 6 6 18') + '</button>' +
      '<button type="button" class="lightbox__btn lightbox__prev" aria-label="Foto sebelumnya">' + icon('m15 18-6-6 6-6') + '</button>' +
      '<button type="button" class="lightbox__btn lightbox__next" aria-label="Foto berikutnya">' + icon('m9 18 6-6-6-6') + '</button>' +
      '<p class="lightbox__count" aria-live="polite"></p>';
    document.body.appendChild(box);

    var img = box.querySelector('.lightbox__img');
    var count = box.querySelector('.lightbox__count');
    var stage = box.querySelector('.lightbox__stage');
    var list = [], index = 0, opener = null;

    var show = function (i) {
      index = (i + list.length) % list.length;
      var el = list[index];
      var src = el.getAttribute('data-full');
      img.classList.add('is-loading');
      var pre = new Image();
      pre.onload = pre.onerror = function () {
        img.src = src;
        img.alt = el.getAttribute('data-alt') || (el.querySelector('img') ? el.querySelector('img').alt : '');
        img.classList.remove('is-loading');
      };
      pre.src = src;
      count.textContent = (index + 1) + ' / ' + list.length;
      box.querySelector('.lightbox__prev').hidden = list.length < 2;
      box.querySelector('.lightbox__next').hidden = list.length < 2;
      // muat duluan foto berikutnya biar terasa cepat
      if (list.length > 1) new Image().src = list[(index + 1) % list.length].getAttribute('data-full');
    };
    var open = function (group, el) {
      list = groups[group];
      opener = el;
      show(list.indexOf(el));
      box.classList.add('is-open');
      document.body.classList.add('no-scroll');
      box.querySelector('.lightbox__close').focus();
    };
    var close = function () {
      box.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
      if (opener) opener.focus();
    };

    Object.keys(groups).forEach(function (g) {
      groups[g].forEach(function (el) {
        el.addEventListener('click', function (e) { e.preventDefault(); open(g, el); });
      });
    });
    box.querySelector('.lightbox__close').addEventListener('click', close);
    box.querySelector('.lightbox__prev').addEventListener('click', function () { show(index - 1); });
    box.querySelector('.lightbox__next').addEventListener('click', function () { show(index + 1); });
    stage.addEventListener('click', function (e) { if (e.target === stage) close(); });
    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') show(index + 1);
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'Tab') {
        var f = Array.prototype.filter.call(box.querySelectorAll('button'), function (b) { return !b.hidden; });
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    var tx = null;
    stage.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (tx === null) return;
      var dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
      tx = null;
    });
  }

  /* ---------- video YouTube: iframe baru dimuat saat diklik ---------- */
  document.querySelectorAll('.yt').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-id');
      var frame = document.createElement('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      frame.title = btn.getAttribute('aria-label') || 'Video YouTube';
      frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      frame.allowFullscreen = true;
      var holder = document.createElement('div');
      holder.className = 'yt';
      holder.appendChild(frame);
      btn.replaceWith(holder);
      frame.focus();
    });
  });

  doc.classList.add('js-ready');
})();
