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

  /* ---------- bagian yang ditambahkan untuk guru, ekskul, kegiatan, fasilitas, galeri ---------- */
  function slugify(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function img(src, alt, eager) {
    return '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '" loading="' + (eager ? 'eager' : 'lazy') + '" decoding="async">';
  }
  // Photo that opens in the lightbox (same markup as the static pages).
  function zoom(src, alt, cls, group) {
    return '<button type="button" class="ph zoomable ' + (cls || '') + '" data-lightbox="' + escapeHtml(group) + '" data-full="' + escapeHtml(src) + '" aria-label="Perbesar foto: ' + escapeHtml(alt) + '">' + img(src, alt) + '</button>';
  }
  function delay(i, per, step) { return ' style="--delay:' + ((i % per) * step) + 'ms"'; }
  function byOrder(rows) { return rows.slice().sort(function (a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); }); }

  var GROUPS = [['kelas', 'Guru Kelas'], ['mapel', 'Guru Mata Pelajaran'], ['kependidikan', 'Tenaga Kependidikan']];

  var EXTRA = {
    guru: function (data) {
      var rows = byOrder(data.guru || []);
      if (!rows.length) return null;
      var kepsek = rows.filter(function (r) { return r.kelompok === 'kepsek'; })[0];
      var html = '<ul class="stats" data-reveal><li><b>' + rows.length + '</b><span>Pendidik &amp; tenaga kependidikan</span></li>';
      GROUPS.forEach(function (g) {
        html += '<li><b>' + rows.filter(function (r) { return r.kelompok === g[0]; }).length + '</b><span>' + g[1] + '</span></li>';
      });
      html += '</ul>';
      if (kepsek) {
        html += '<article class="leader" data-reveal>' +
          '<div class="ph leader__img">' + img(kepsek.foto, kepsek.nama + ', ' + kepsek.jabatan) + '</div>' +
          '<div class="leader__body"><span class="pill">' + escapeHtml(kepsek.jabatan || 'Kepala Sekolah') + '</span>' +
          '<h3 class="d2"><b>' + escapeHtml(kepsek.nama) + '</b></h3>' +
          '<blockquote class="d7">“Seluruh pendidik, tenaga kependidikan, dan komite sekolah berkomitmen mengelola sekolah untuk menciptakan peserta didik yang berkualitas, kreatif, dan berakhlak mulia.”</blockquote>' +
          '<a class="link-arrow" href="index.html#sambutan">Baca sambutan kepala sekolah ' + iconArrow() + '</a></div></article>';
      }
      GROUPS.forEach(function (g) {
        var list = rows.filter(function (r) { return r.kelompok === g[0]; });
        if (!list.length) return;
        var id = 'grup-' + slugify(g[1]);
        html += '<section class="staff-group" aria-labelledby="' + id + '">' +
          '<div class="staff-group__head" data-reveal><h3 class="d5" id="' + id + '"><b>' + g[1] + '</b></h3><span class="count">' + list.length + ' orang</span></div>' +
          '<div class="staff-grid">' + list.map(function (r, i) {
            return '<article class="staff-card" data-reveal' + delay(i, 4, 80) + '>' +
              '<div class="ph staff-card__img">' + img(r.foto, r.nama + ', ' + r.jabatan) + '</div>' +
              '<div class="staff-card__body"><h4 class="staff-card__name"><b>' + escapeHtml(r.nama) + '</b></h4><span class="pill">' + escapeHtml(r.jabatan) + '</span></div></article>';
          }).join('') + '</div></section>';
      });
      return html;
    },

    ekskul: function (data) {
      var rows = byOrder(data.ekskul || []);
      if (!rows.length) return null;
      var chips = '<nav class="chips" aria-label="Daftar ekstrakurikuler" data-reveal>' + rows.map(function (r) {
        return '<a href="#eskul-' + slugify(r.nama) + '">' + escapeHtml(r.nama) + '</a>';
      }).join('') + '</nav>';
      var grid = '<div class="eskul-grid">' + rows.map(function (r, i) {
        var alt = 'Ekstrakurikuler ' + String(r.nama || '').toLowerCase() + ' SD Negeri Ambarukmo';
        return '<article class="eskul-item" id="eskul-' + slugify(r.nama) + '" data-reveal' + delay(i, 3, 80) + '>' +
          zoom(r.foto, alt, 'eskul-item__img', 'eskul') +
          '<div class="eskul-item__body"><h3 class="d5"><b>' + escapeHtml(r.nama) + '</b></h3>' + toParagraphs(r.naskah) + '</div></article>';
      }).join('') + '</div>';
      return chips + grid;
    },

    kegiatan_sekolah: function (data) {
      var rows = byOrder(data.kegiatan_sekolah || []);
      if (!rows.length) return null;
      return rows.map(function (r, i) {
        return '<article class="activity-card" data-reveal' + delay(i, 3, 80) + '>' +
          zoom(r.foto, r.judul, 'activity-card__img', 'kegiatan') +
          '<div class="activity-card__body"><h3 class="d7"><b>' + escapeHtml(r.judul) + '</b></h3>' +
          (r.keterangan ? toParagraphs(r.keterangan) : '') + '</div></article>';
      }).join('');
    },

    'fasilitas-kelas': function (data) {
      var rows = byOrder((data.fasilitas || []).filter(function (r) { return r.grup === 'kelas'; }));
      if (!rows.length) return null;
      return {
        outer: '<div class="slider slider--rooms" data-dyn="fasilitas-kelas">' +
          '<div class="slider__track" tabindex="0" aria-label="Ruang Kelas: geser untuk melihat foto lain">' +
          rows.map(function (r, i) { return '<div class="slide">' + zoom(r.foto, 'Ruang kelas SD Negeri Ambarukmo ' + (i + 1), '', 'ruang-kelas') + '</div>'; }).join('') +
          '</div>' +
          '<button type="button" class="slider__btn slider__btn--prev" aria-label="Sebelumnya"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>' +
          '<button type="button" class="slider__btn slider__btn--next" aria-label="Berikutnya">' + iconArrow() + '</button>' +
          '<div class="slider__dots"></div></div>',
      };
    },

    'fasilitas-guru': function (data) {
      var rows = byOrder((data.fasilitas || []).filter(function (r) { return r.grup === 'guru'; }));
      if (!rows.length) return null;
      return rows.map(function (r, i) {
        return '<div class="mosaic__item" data-reveal' + delay(i, 4, 80) + '>' + zoom(r.foto, 'Ruang kepala sekolah dan guru ' + (i + 1), '', 'ruang-guru') + '</div>';
      }).join('');
    },

    'fasilitas-lain': function (data) {
      var rows = byOrder((data.fasilitas || []).filter(function (r) { return r.grup === 'lain'; }));
      if (!rows.length) return null;
      return rows.map(function (r, i) {
        return '<figure class="facility" data-reveal' + delay(i, 4, 80) + '>' +
          zoom(r.foto, (r.nama || 'Fasilitas') + ' SD Negeri Ambarukmo', 'facility__img', 'fasilitas') +
          '<figcaption class="d7"><b>' + escapeHtml(r.nama || '') + '</b></figcaption></figure>';
      }).join('');
    },

    'galeri-stats': function (data) {
      var albums = data.galeri_album || [];
      if (!albums.length) return null;
      return '<li><b>' + albums.length + '</b><span>Album foto</span></li>' +
        '<li><b>' + (data.galeri_foto || []).length + '</b><span>Foto kegiatan</span></li>' +
        '<li><b>' + ((data.video || []).length || document.querySelectorAll('.video-cards .video-card').length) + '</b><span>Video kegiatan</span></li>';
    },

    galeri: function (data) {
      var albums = byOrder(data.galeri_album || []);
      if (!albums.length) return null;
      var fotos = byOrder(data.galeri_foto || []);
      return albums.map(function (a, i) {
        var list = fotos.filter(function (f) { return f.album === a.slug && f.foto; });
        if (!list.length) return '';
        var group = 'album-' + slugify(a.slug || a.id);
        return '<article class="album" data-reveal' + delay(i, 4, 70) + '>' +
          '<button type="button" class="album__cover zoomable ph" data-lightbox="' + group + '" data-full="' + escapeHtml(list[0].foto) + '" aria-label="Buka album ' + escapeHtml(a.judul) + ' (' + list.length + ' foto)">' +
          img(list[0].foto, a.judul + ' 1') + '<span class="album__count">' + list.length + ' foto</span></button>' +
          list.slice(1).map(function (f, k) {
            return '<span hidden data-lightbox="' + group + '" data-full="' + escapeHtml(f.foto) + '" data-alt="' + escapeHtml(a.judul + ' ' + (k + 2)) + '"></span>';
          }).join('') +
          '<h3 class="album__title">' + escapeHtml(a.judul) + '</h3></article>';
      }).join('');
    },
  };

  function paint(data) {
    if (!data) return;
    // Re-query each time: some slots (sliders) are swapped for new elements.
    document.querySelectorAll('[data-dyn]').forEach(function (slot) {
      var key = slot.getAttribute('data-dyn');
      var out;
      if (EXTRA[key]) {
        out = EXTRA[key](data);
      } else if (RENDER[key]) {
        var rows = data[key === 'brosur' ? 'brosur_ppdb' : key];
        // only replace if there's data (keep the static markup otherwise)
        if (!rows || !rows.length) return;
        out = RENDER[key](rows);
      }
      if (out == null || out === '') return;
      if (typeof out === 'object' && out.outer) {
        var tmp = document.createElement('div');
        tmp.innerHTML = out.outer;
        var el = tmp.firstChild;
        slot.replaceWith(el);
        if (window.SDN_initSlider) window.SDN_initSlider(el);
        slot = el;
      } else {
        slot.innerHTML = out;
      }
      slot.classList.add('is-dynamic');
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
