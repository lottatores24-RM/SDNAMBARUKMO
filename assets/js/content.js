/* Loader konten dinamis dari dashboard admin.
   Memuat JSON dari Apps Script, kalau ada data terbaru, mengganti bagian
   halaman yang bertanda `data-dyn="..."`.
   Kalau API gagal atau kosong, konten statis bawaan HTML tetap tampil. */
(function () {
  'use strict';

  // Alamat Apps Script dashboard. Satu sumber kebenaran untuk web publik.
  var API = 'https://script.google.com/macros/s/AKfycby-6V90E8DnFMsTsl_93T6zDHW1LF0UPPFlTslCDMZ5QHXJGG9UQ8x6q9qpjc8aLk7qdg/exec';

  // Mulai debug UI SEBELUM early-return apapun supaya ?debug=1 selalu kelihatan.
  var isDebug = /[?&]debug=1/.test(location.search);
  var dbg = null;
  if (isDebug) {
    dbg = document.createElement('div');
    dbg.style.cssText = 'position:fixed;left:0;right:0;bottom:0;padding:.5rem 1rem;background:#111;color:#dfe;font:12px/1.4 monospace;z-index:9999;white-space:pre-wrap;max-height:40vh;overflow:auto';
    (document.body || document.documentElement).appendChild(dbg);
  }
  function log(msg) { if (dbg) dbg.textContent += msg + '\n'; try { console.log(msg); } catch (_) {} }

  log('[content.js] starting on ' + location.pathname);

  var slots = document.querySelectorAll('[data-dyn]');
  if (!slots.length) { log('[content.js] no data-dyn slots on this page, nothing to do'); return; }

  var CACHE_KEY = 'sdn.content.v1';
  var CACHE_MS = 20 * 1000;

  function readCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || Date.now() - obj.at > CACHE_MS) return null;
      return obj.data;
    } catch (_) { return null; }
  }
  function writeCache(data) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data })); } catch (_) {}
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  // Simple paragraph-break: double newline → <p> boundary; single newline → <br>.
  function toParagraphs(text) {
    if (!text) return '';
    return String(text).trim().split(/\n{2,}/).map(function (p) {
      return '<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>';
    }).join('\n');
  }
  function tag(label) {
    return label ? '<span class="pill">' + escapeHtml(label) + '</span>' : '';
  }
  function iconArrow() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  }
  function iconPlay() {
    return '<svg class="yt__play" viewBox="0 0 68 48" aria-hidden="true"><path d="M66.5 7.7a8.5 8.5 0 0 0-6-6C55.2.3 34 .3 34 .3s-21.2 0-26.5 1.4a8.5 8.5 0 0 0-6 6C.1 13 .1 24 .1 24s0 11 1.4 16.3a8.5 8.5 0 0 0 6 6C12.8 47.7 34 47.7 34 47.7s21.2 0 26.5-1.4a8.5 8.5 0 0 0 6-6C67.9 35 67.9 24 67.9 24s0-11-1.4-16.3z" fill="#f00"/><path d="m45 24-18-10v20z" fill="#fff"/></svg>';
  }

  var RENDER = {
    pengumuman: function (rows) {
      // rows: {id, judul, tanggal, label, brosur, naskah}
      // Already filtered to non-draft on the server.
      if (!rows.length) return '<p class="empty-note" style="text-align:center;color:#4b5048;padding:3rem 1rem">Belum ada pengumuman.</p>';
      // sort newest date first
      rows.sort(function (a, b) { return String(b.tanggal || '').localeCompare(String(a.tanggal || '')); });
      return rows.map(function (r, i) {
        var hasImg = !!r.brosur;
        return (
          '<article class="news">' +
            (hasImg
              ? '<button type="button" class="ph zoomable news__img" data-lightbox="pengumuman" data-full="' + escapeHtml(r.brosur) + '" aria-label="Perbesar foto: ' + escapeHtml(r.judul) + '">' +
                  '<img src="' + escapeHtml(r.brosur) + '" alt="' + escapeHtml(r.judul) + '" loading="' + (i === 0 ? 'eager' : 'lazy') + '" decoding="async">' +
                '</button>'
              : '') +
            '<div class="news__body d7">' +
              tag(r.label) +
              '<p class="news__date" style="color:#4b5048;font-size:.9rem;margin:.1rem 0 .25rem">' + escapeHtml(fmtDate(r.tanggal)) + '</p>' +
              '<h3 class="d5"><b>' + escapeHtml(r.judul) + '</b></h3>' +
              toParagraphs(r.naskah) +
            '</div>' +
          '</article>'
        );
      }).join('\n');
    },

    brosur: function (rows) {
      var r = rows[0];
      if (!r || !r.foto) return '';
      return (
        '<figure class="poster">' +
          '<button type="button" class="ph zoomable poster__img" data-lightbox="pendaftaran" data-full="' + escapeHtml(r.foto) + '" aria-label="Perbesar brosur">' +
            '<img src="' + escapeHtml(r.foto) + '" alt="Brosur Pendaftaran Peserta Didik Baru SD Negeri Ambarukmo" loading="eager" decoding="async">' +
          '</button>' +
          '<figcaption>Brosur PPDB. Klik untuk memperbesar.</figcaption>' +
        '</figure>'
      );
    },

    video: function (rows) {
      if (!rows.length) return '';
      return rows.map(function (r, i) {
        if (!r.youtube_id) return '';
        var id = r.youtube_id;
        return (
          '<article class="video-card" data-reveal>' +
            '<button type="button" class="yt" data-id="' + escapeHtml(id) + '" aria-label="Putar video: ' + escapeHtml(r.judul) + '">' +
              '<img src="https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/hqdefault.jpg" alt="" loading="' + (i < 3 ? 'eager' : 'lazy') + '" decoding="async" width="480" height="360">' + iconPlay() +
            '</button>' +
            '<h3 class="video-card__title">' + escapeHtml(r.judul) + '</h3>' +
          '</article>'
        );
      }).join('\n');
    },
  };

  function paint(data) {
    slots.forEach(function (slot) {
      var key = slot.getAttribute('data-dyn');
      var rows = data && data[key === 'brosur' ? 'brosur_ppdb' : key];
      if (!rows || !RENDER[key]) return;
      // only replace if there's new data (keep default static markup otherwise)
      if (!rows.length) return;
      slot.innerHTML = RENDER[key](rows);
      slot.classList.add('is-dynamic');
      // trigger reveal observer if present
      slot.querySelectorAll('[data-reveal]').forEach(function (el) { el.classList.add('is-visible'); });
    });
  }

  log('[content.js] API_URL = ' + API);
  log('[content.js] slots on this page: ' + Array.prototype.map.call(slots, function (s) { return s.getAttribute('data-dyn'); }).join(', '));

  // Paint from cache immediately for snappy render, then refresh from network.
  var cached = readCache();
  if (cached) { log('[content.js] cache hit, paint from cache'); paint(cached); }

  var url = API + (API.indexOf('?') >= 0 ? '&' : '?') + 'action=content';
  log('[content.js] fetching ' + url);
  var t0 = Date.now();
  fetch(url, { cache: 'no-store' }).then(function (r) {
    log('[content.js] response status=' + r.status + ' after ' + (Date.now() - t0) + 'ms');
    return r.text();
  }).then(function (txt) {
    log('[content.js] body size=' + txt.length + ' chars, head=' + txt.slice(0, 200));
    var data;
    try { data = JSON.parse(txt); } catch (e) { log('[content.js] JSON parse error: ' + e.message); return; }
    if (!data) { log('[content.js] data is null'); return; }
    if (data.error) { log('[content.js] API error: ' + data.error); return; }
    log('[content.js] got rows: pengumuman=' + (data.pengumuman || []).length + ' video=' + (data.video || []).length + ' brosur=' + ((data.brosur_ppdb || [])[0] && (data.brosur_ppdb || [])[0].foto ? 'yes' : 'no'));
    writeCache(data);
    paint(data);
  }).catch(function (e) {
    log('[content.js] fetch failed: ' + e.message);
  });
})();
