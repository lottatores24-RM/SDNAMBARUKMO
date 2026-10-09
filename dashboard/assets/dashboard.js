/* Dashboard admin SD Negeri Ambarukmo - vanilla SPA */
(function () {
  'use strict';

  const CFG = window.SDN_CONFIG || {};
  const API = CFG.API_URL || '';
  const SITE = CFG.SITE || 'SD Negeri Ambarukmo';
  const LOGO = '../assets/img/logo-sd.webp';
  const SECRET_KEY = 'sdn.secret';

  /* ---------- utilities ---------- */
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(el.style, attrs[k]);
      else if (attrs[k] === true) el.setAttribute(k, '');
      else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
    return el;
  };
  const icon = (d) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = d;
    return svg;
  };
  const uuid = () => Math.random().toString(36).slice(2, 10);
  const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const todayIso = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const toast = (msg, kind) => {
    const el = document.getElementById('toast');
    el.className = 'toast show' + (kind === 'err' ? ' toast--err' : '');
    el.textContent = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2600);
  };

  /* ---------- API client ---------- */
  const secret = () => localStorage.getItem(SECRET_KEY) || '';
  async function apiGet(action, fresh) {
    const u = new URL(API);
    u.searchParams.set('action', action);
    if (fresh) u.searchParams.set('fresh', '1');
    const r = await fetch(u.toString(), { method: 'GET' });
    if (!r.ok) throw new Error('API ' + r.status);
    return r.json();
  }
  async function apiPost(action, payload) {
    const r = await fetch(API, {
      method: 'POST',
      // Simple body (no custom header) avoids CORS preflight on Apps Script.
      body: JSON.stringify(Object.assign({ action, secret: secret() }, payload || {})),
    });
    if (!r.ok) throw new Error('API ' + r.status);
    const text = await r.text();
    let j;
    try { j = JSON.parse(text); } catch (_) {
      throw new Error('Google membalas bukan JSON (kemungkinan halaman login/izin): ' + text.replace(/\s+/g, ' ').slice(0, 120));
    }
    if (j && j.error) throw new Error(j.error);
    return j;
  }

  /* ---------- image: convert to WebP in browser ---------- */
  async function toWebp(file, maxW) {
    maxW = maxW || 1600;
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = URL.createObjectURL(file);
    });
    const w = Math.min(maxW, img.naturalWidth);
    const h = Math.round(img.naturalHeight * (w / img.naturalWidth));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.82));
    URL.revokeObjectURL(img.src);
    return blob;
  }
  const blobToBase64 = (blob) => new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.readAsDataURL(blob);
  });
  async function uploadImage(file, filename) {
    const blob = file.type && file.type.includes('webp') ? file : await toWebp(file);
    const base64 = await blobToBase64(blob);
    const safe = (filename || file.name || 'foto').replace(/\.[a-z]+$/i, '') + '.webp';
    const r = await apiPost('upload', { filename: safe, mime: 'image/webp', base64 });
    return r.url;
  }

  /* ---------- sections ---------- */
  const SECTIONS = [
    { key: 'overview', title: 'Beranda', icon: '<path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/>', single: 'overview' },
    { key: 'pengumuman', title: 'Pengumuman', icon: '<path d="M4 11v4a4 4 0 0 0 4 4h1l5 3V5l-5 3H8a4 4 0 0 0-4 4z"/><path d="M18 8a4 4 0 0 1 0 8"/>',
      sort: 'date-desc',
      fields: [
        { name: 'judul', label: 'Judul', type: 'text', required: true },
        { name: 'label', label: 'Label (contoh: Prestasi, Peringatan)', type: 'text' },
        { name: 'tanggal', label: 'Tanggal', type: 'date', required: true, default: todayIso },
        { name: 'brosur', label: 'Foto / brosur', type: 'image', hint: 'Opsional. Tampil di sebelah naskah.' },
        { name: 'naskah', label: 'Naskah', type: 'textarea', required: true, hint: 'Pisahkan paragraf dengan baris kosong.' },
        { name: 'draft', label: 'Simpan sebagai draft (belum ditayangkan)', type: 'checkbox' },
      ],
      list: (r) => ({ title: r.judul, meta: [fmtDate(r.tanggal), r.label].filter(Boolean), thumb: r.brosur, draft: !!r.draft }),
    },
    { key: 'guru', title: 'Guru & Pegawai', icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
      fields: [
        { name: 'nama', label: 'Nama', type: 'text', required: true },
        { name: 'jabatan', label: 'Jabatan', type: 'text', required: true, hint: 'Contoh: Guru Kelas III' },
        { name: 'kelompok', label: 'Kelompok', type: 'select', required: true,
          options: [['kepsek', 'Kepala Sekolah'], ['kelas', 'Guru Kelas'], ['mapel', 'Guru Mata Pelajaran'], ['kependidikan', 'Tenaga Kependidikan']] },
        { name: 'foto', label: 'Foto', type: 'image', required: true, hint: 'Idealnya potret rasio 4:5.' },
      ],
      list: (r) => ({ title: r.nama, meta: [r.jabatan], thumb: r.foto }),
      groupBy: (r) => r.kelompok,
      groupLabel: { kepsek: 'Kepala Sekolah', kelas: 'Guru Kelas', mapel: 'Guru Mata Pelajaran', kependidikan: 'Tenaga Kependidikan' },
    },
    { key: 'ekskul', title: 'Ekstrakurikuler', icon: '<path d="M12 2v4"/><path d="M4 10h16"/><rect x="3" y="10" width="18" height="12" rx="2"/><path d="M8 14h8"/>',
      fields: [
        { name: 'nama', label: 'Nama ekstrakurikuler', type: 'text', required: true, hint: 'Ditulis huruf besar, misal: PRAMUKA.' },
        { name: 'foto', label: 'Foto', type: 'image', required: true },
        { name: 'naskah', label: 'Deskripsi', type: 'textarea', required: true },
      ],
      list: (r) => ({ title: r.nama, meta: [textSnippet(r.naskah, 90)], thumb: r.foto }),
    },
    { key: 'kegiatan_sekolah', title: 'Kegiatan Sekolah', icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
      fields: [
        { name: 'judul', label: 'Judul kegiatan', type: 'text', required: true },
        { name: 'foto', label: 'Foto', type: 'image', required: true },
        { name: 'keterangan', label: 'Keterangan (opsional)', type: 'textarea', hint: 'Boleh kosong jika judul sudah jelas.' },
      ],
      list: (r) => ({ title: r.judul, meta: [textSnippet(r.keterangan, 80)].filter(Boolean), thumb: r.foto }),
    },
    { key: 'fasilitas', title: 'Fasilitas', icon: '<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-7h6v7"/>',
      fields: [
        { name: 'grup', label: 'Kelompok', type: 'select', required: true,
          options: [['kelas', 'Ruang Kelas'], ['guru', 'Ruang Kepala Sekolah & Guru'], ['lain', 'Fasilitas Tambahan']] },
        { name: 'nama', label: 'Nama (hanya untuk Fasilitas Tambahan)', type: 'text', hint: 'Contoh: Masjid, Ruang TIK.' },
        { name: 'foto', label: 'Foto', type: 'image', required: true },
      ],
      list: (r) => ({ title: r.nama || ({ kelas: 'Ruang kelas', guru: 'Ruang guru', lain: 'Fasilitas' })[r.grup], meta: [({ kelas: 'Ruang Kelas', guru: 'Ruang Guru', lain: 'Fasilitas Tambahan' })[r.grup]], thumb: r.foto }),
      groupBy: (r) => r.grup,
      groupLabel: { kelas: 'Ruang Kelas', guru: 'Ruang Kepala Sekolah & Guru', lain: 'Fasilitas Tambahan' },
    },
    { key: 'galeri', title: 'Galeri', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
      custom: 'galeri',
    },
    { key: 'video', title: 'Video Kegiatan', icon: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
      fields: [
        { name: 'youtube_id', label: 'URL YouTube atau ID', type: 'youtube', required: true, hint: 'Boleh paste URL lengkap, ID-nya diambil otomatis.' },
        { name: 'judul', label: 'Judul video', type: 'text', required: true },
      ],
      list: (r) => ({ title: r.judul, meta: ['youtu.be/' + r.youtube_id], thumb: ytThumb(r.youtube_id) }),
    },
    { key: 'brosur_ppdb', title: 'Brosur PPDB', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
      single: 'brosur',
      fields: [{ name: 'foto', label: 'Brosur Pendaftaran Peserta Didik Baru', type: 'image', required: true, hint: 'Idealnya minimal 1200px lebar. Tampil di halaman Pendaftaran.' }],
    },
    { key: 'diagnosa', title: 'Cek Koneksi', icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>', custom: 'diagnosa' },
  ];

  function textSnippet(t, n) {
    const s = String(t || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  function ytId(input) {
    if (!input) return '';
    const s = String(input).trim();
    if (/^[\w-]{11}$/.test(s)) return s;
    const m = s.match(/(?:v=|be\/|embed\/|shorts\/)([\w-]{11})/);
    return m ? m[1] : s;
  }
  function ytThumb(id) { return id ? 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg' : ''; }

  /* ---------- app state ---------- */
  const state = {
    content: null,
    section: 'overview',
    editing: null, // { table, row } or { table, index }
    loading: false,
    saving: false,
  };

  // Seed rows whose id isn't in the sheet yet (brosur: only when no brosur exists).
  function missingSeed() {
    const seed = window.SDN_SEED || {};
    const c = state.content || {};
    const out = {};
    for (const table of Object.keys(seed)) {
      const have = c[table] || [];
      if (table === 'brosur_ppdb') {
        if (!have.some((r) => r.foto)) out[table] = seed[table];
        continue;
      }
      const ids = new Set(have.map((r) => String(r.id)));
      const add = seed[table].filter((r) => !ids.has(String(r.id)));
      if (add.length) out[table] = add;
    }
    return out;
  }
  const missingCount = () => Object.values(missingSeed()).reduce((n, l) => n + l.length, 0);

  async function importSeed() {
    const add = missingSeed();
    const lines = Object.entries(add).map(([t, l]) => `• ${t.replace(/_/g, ' ')}: ${l.length}`).join('\n');
    if (!lines) return toast('Semua data awal sudah ada');
    if (!confirm('Tambahkan data awal yang belum ada di Google Sheet?\n\n' + lines + '\n\nData yang sudah ada tidak diubah atau dihapus.')) return;
    try {
      for (const table of Object.keys(add)) {
        const existing = table === 'brosur_ppdb' ? [] : (state.content[table] || []);
        const rows = existing.concat(add[table]).map((r, i) => Object.assign({}, r, { order: i + 1 }));
        toast('Mengimpor ' + table.replace(/_/g, ' ') + '…');
        const res = await apiPost('save', { table, rows });
        if (typeof res.saved !== 'number') throw new Error('Apps Script tidak menjawab seperti biasa');
        state.content[table] = rows;
      }
      await refreshFromServer();
      toast('Data awal berhasil diimpor');
      renderShell();
    } catch (e) {
      toast('Impor gagal: ' + e.message, 'err');
    }
  }

  /* ---------- bootstrap ---------- */
  function start() {
    if (!API) return renderConfigMissing();
    if (!secret()) return renderLogin();
    load();
  }

  function renderConfigMissing() {
    document.getElementById('app').innerHTML = '';
    document.getElementById('app').append(
      h('div', { class: 'login' },
        h('div', { class: 'login__card' },
          h('h1', null, 'Setup dulu'),
          h('p', null, 'API_URL belum diisi di dashboard/assets/config.js. Lihat apps-script/SETUP.md.'),
        ),
      ),
    );
  }

  function renderLogin() {
    const err = h('p', { class: 'login__err' });
    const input = h('input', { type: 'password', placeholder: 'ADMIN_SECRET dari Apps Script', autocomplete: 'current-password' });
    const btn = h('button', { type: 'submit' }, 'Masuk');
    const form = h('form', { onSubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      if (!input.value.trim()) return;
      btn.disabled = true;
      try {
        localStorage.setItem(SECRET_KEY, input.value.trim());
        await apiPost('login');
        start();
      } catch (ex) {
        localStorage.removeItem(SECRET_KEY);
        err.textContent = 'Sandi salah atau koneksi gagal. Coba lagi.';
        btn.disabled = false;
      }
    } },
      h('label', { for: 'sec' }, 'Kata sandi'),
      input,
      btn,
      err,
    );
    document.getElementById('app').innerHTML = '';
    document.getElementById('app').append(
      h('div', { class: 'login' },
        h('div', { class: 'login__card' },
          h('div', { class: 'login__brand' },
            h('img', { src: LOGO, alt: '' }),
            h('b', null, SITE),
          ),
          h('h1', null, 'Dashboard Admin'),
          h('p', null, 'Masuk pakai ADMIN_SECRET.'),
          form,
          h('div', { class: 'login__hint' },
            'Lupa sandi? Buka Apps Script → ⚙️ Project Settings → ', h('code', null, 'ADMIN_SECRET'),
          ),
        ),
      ),
    );
    input.focus();
  }

  // Read the sheet as-is (drafts included). Older Apps Script deployments
  // don't know 'admin-content'; fall back to the public read and flag it.
  async function refreshFromServer() {
    try {
      const r = await apiPost('admin-content');
      state.content = r.content;
      state.meta = r.meta || {};
      state.backendOutdated = false;
    } catch (e) {
      if (!/unknown action/.test(e.message)) throw e;
      state.content = await apiGet('content', true);
      state.meta = {};
      state.backendOutdated = true;
    }
  }

  async function load() {
    state.loading = true;
    renderShell();
    try {
      await refreshFromServer();
      state.loading = false;
      renderShell();
    } catch (ex) {
      toast('Gagal memuat data: ' + ex.message, 'err');
      state.loading = false;
    }
  }

  function renderShell() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    const nav = h('nav');
    SECTIONS.forEach((s) => {
      const b = h('button', {
        class: s.key === state.section ? 'active' : '',
        onClick: () => { state.section = s.key; state.editing = null; renderShell(); },
      }, icon(s.icon), s.title);
      nav.append(b);
    });
    app.append(
      h('div', { class: 'app' },
        h('aside', { class: 'sidebar' },
          h('div', { class: 'sidebar__brand' },
            h('img', { src: LOGO, alt: '' }),
            h('div', null, h('b', null, 'SDN Ambarukmo'), h('small', null, 'Dashboard admin')),
          ),
          nav,
          h('div', { class: 'sidebar__foot' },
            h('span', null, '🔒 Masuk'),
            h('button', { onClick: () => { if (confirm('Keluar dari dashboard?')) { localStorage.removeItem(SECRET_KEY); start(); } } }, 'Keluar'),
          ),
        ),
        h('main', { class: 'main' }, renderSection()),
      ),
    );
  }

  function renderSection() {
    if (state.section === 'diagnosa') return renderDiagnosa();
    if (state.loading) return h('p', null, 'Memuat data…');
    if (!state.content) return h('p', null, 'Data gagal dimuat. Buka menu "Cek Koneksi" untuk melihat penyebabnya.');
    const sec = SECTIONS.find((s) => s.key === state.section);
    if (sec.single === 'overview') return renderOverview();
    if (sec.single === 'brosur') return renderSingleImage(sec);
    if (sec.custom === 'galeri') return renderGaleri();
    if (sec.custom === 'diagnosa') return renderDiagnosa();
    return renderList(sec);
  }

  /* ---------- overview ---------- */
  function renderOverview() {
    const c = state.content;
    const stats = [
      ['pengumuman', 'Pengumuman', c.pengumuman.length],
      ['guru', 'Guru & pegawai', c.guru.length],
      ['ekskul', 'Ekstrakurikuler', c.ekskul.length],
      ['kegiatan_sekolah', 'Kegiatan sekolah', c.kegiatan_sekolah.length],
      ['galeri', 'Album foto', c.galeri_album.length],
      ['video', 'Video kegiatan', c.video.length],
      ['fasilitas', 'Fasilitas', c.fasilitas.length],
    ];
    return h('div', null,
      h('div', { class: 'page-head' },
        h('div', null, h('h1', null, 'Dashboard'), h('p', null, 'Ringkasan konten yang sedang tampil di website.')),
        h('div', { class: 'page-head__actions' },
          window.SDN_SEED && missingCount() ? h('button', { class: 'btn', onClick: importSeed }, `⬇ Impor data awal (${missingCount()} belum ada)`) : null,
          h('a', { class: 'btn btn--ghost', href: '/', target: '_blank', rel: 'noopener' }, 'Buka website'),
        ),
      ),
      state.backendOutdated ? h('div', { class: 'card', style: { padding: '1rem 1.25rem', marginBottom: '1.25rem', borderColor: '#e0b252', background: '#fff8e6' } },
        h('b', null, '⚠ Apps Script perlu diperbarui. '),
        'Kode Apps Script lo masih versi lama, jadi dashboard belum bisa mengecek isi Google Sheet. Ikuti langkah "Update Apps Script" di apps-script/SETUP.md.',
      ) : null,
      state.meta && state.meta.spreadsheetUrl ? h('p', { style: { marginBottom: '1rem', color: 'var(--muted)' } },
        'Data tersimpan di ', h('a', { href: state.meta.spreadsheetUrl, target: '_blank', rel: 'noopener' }, 'Google Sheet'),
        ', foto di ', h('a', { href: state.meta.folderUrl, target: '_blank', rel: 'noopener' }, 'folder Google Drive'), '.',
      ) : null,
      h('div', { class: 'overview' }, ...stats.map(([k, lbl, n]) => h('button', {
        class: 'stat',
        onClick: () => { state.section = k; renderShell(); },
        style: { textAlign: 'left', border: 'none', cursor: 'pointer', width: '100%' },
      }, h('b', null, n), h('span', null, lbl)))),
    );
  }

  /* ---------- single image (brosur) ---------- */
  function renderSingleImage(sec) {
    const rows = state.content[sec.key] || [];
    const row = rows[0] || { id: '1' };
    const data = { ...row };
    const slot = createPhotoSlot(data.foto, (url) => { data.foto = url; });
    return h('div', null,
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, sec.title))),
      h('div', { class: 'card editor' },
        h('h2', null, sec.fields[0].label),
        sec.fields[0].hint ? h('p', { class: 'editor__sub' }, sec.fields[0].hint) : null,
        slot,
        h('div', { class: 'editor__foot' },
          h('span', null, ''),
          h('button', { class: 'btn', onClick: async () => {
            if (!data.foto) return toast('Foto belum dipilih', 'err');
            await persist(sec.key, [{ id: '1', foto: data.foto }]);
          } }, 'Simpan'),
        ),
      ),
    );
  }

  /* ---------- generic list ---------- */
  function renderList(sec) {
    const rows = (state.content[sec.key] || []).slice();
    sortRows(rows, sec.sort);
    const sections = [];
    if (sec.groupBy) {
      const order = Object.keys(sec.groupLabel || {});
      const grouped = {};
      rows.forEach((r) => { const g = sec.groupBy(r) || 'lain'; (grouped[g] = grouped[g] || []).push(r); });
      const keys = order.length ? order : Object.keys(grouped);
      keys.forEach((k) => { if (grouped[k]) sections.push({ title: (sec.groupLabel || {})[k] || k, rows: grouped[k], groupValue: k }); });
      // trailing groups not in order list
      Object.keys(grouped).forEach((k) => { if (!keys.includes(k)) sections.push({ title: (sec.groupLabel || {})[k] || k, rows: grouped[k], groupValue: k }); });
    } else {
      sections.push({ title: '', rows });
    }

    const addBtn = h('button', { class: 'btn', onClick: () => edit(sec, null) }, '+ Tambah');
    const head = h('div', { class: 'page-head' },
      h('div', null, h('h1', null, sec.title), h('p', null, `${rows.length} data`)),
      h('div', { class: 'page-head__actions' }, addBtn),
    );
    const content = h('div');
    if (!rows.length) content.append(h('div', { class: 'empty' }, 'Belum ada data. Klik tombol “+ Tambah” untuk membuat yang pertama.'));
    sections.forEach((grp) => {
      if (grp.title) content.append(h('h3', { style: { marginTop: '1.5rem', marginBottom: '.75rem' } }, grp.title, h('span', { style: { color: '#999', fontWeight: 400, marginLeft: '.5rem' } }, grp.rows.length + (sec.key === 'guru' ? ' orang' : ' foto'))));
      const ul = h('ul', { class: 'items' });
      grp.rows.forEach((r) => ul.append(renderItem(sec, r)));
      enableDrag(ul, sec, grp.rows);
      content.append(ul);
    });

    return h('div', null, head, content);
  }

  function renderItem(sec, r) {
    const meta = sec.list(r);
    const thumb = meta.thumb
      ? h('img', { class: 'item__thumb', src: meta.thumb, alt: '', loading: 'lazy' })
      : h('div', { class: 'item__thumb item__thumb--letter' }, (meta.title || '?')[0].toUpperCase());
    const metas = h('div', { class: 'item__meta' },
      ...(meta.meta || []).map((m) => h('span', null, m)),
      meta.draft ? h('span', { class: 'item__tag item__tag--draft' }, 'DRAFT') : null,
    );
    return h('li', { class: 'item', draggable: 'true', 'data-id': r.id },
      h('span', { class: 'item__drag', title: 'Geser untuk urut ulang' }, '⠿'),
      thumb,
      h('div', { class: 'item__body' },
        h('div', { class: 'item__title' }, meta.title || '(tanpa judul)'),
        metas,
      ),
      h('div', { class: 'item__actions' },
        h('button', { class: 'btn btn--ghost btn--sm', onClick: () => edit(sec, r) }, 'Edit'),
        h('button', { class: 'btn btn--danger btn--sm', onClick: () => removeRow(sec, r) }, 'Hapus'),
      ),
    );
  }

  function sortRows(rows, mode) {
    if (mode === 'date-desc') rows.sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')));
    else rows.sort((a, b) => (Number(a.order || 0) - Number(b.order || 0)));
  }

  function enableDrag(ul, sec, rows) {
    let dragged = null;
    ul.addEventListener('dragstart', (e) => {
      const li = e.target.closest('li.item'); if (!li) return;
      dragged = li;
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    ul.addEventListener('dragend', async () => {
      if (!dragged) return;
      dragged.classList.remove('dragging');
      dragged = null;
      const ids = [...ul.querySelectorAll('li.item')].map((li) => li.getAttribute('data-id'));
      // reorder rows accordingly, write back to full table
      const all = state.content[sec.key].slice();
      const map = Object.fromEntries(all.map((r) => [String(r.id), r]));
      const reordered = ids.map((id) => map[id]).filter(Boolean);
      // keep rows not in this group as-is (for grouped lists)
      const inThisGroup = new Set(rows.map((r) => String(r.id)));
      const others = all.filter((r) => !inThisGroup.has(String(r.id)));
      const merged = [...others, ...reordered];
      merged.forEach((r, i) => { r.order = i + 1; });
      await persist(sec.key, merged);
    });
    ul.addEventListener('dragover', (e) => {
      e.preventDefault();
      const li = e.target.closest('li.item'); if (!li || li === dragged) return;
      const rect = li.getBoundingClientRect();
      const after = (e.clientY - rect.top) / rect.height > 0.5;
      li.parentNode.insertBefore(dragged, after ? li.nextSibling : li);
    });
  }

  async function removeRow(sec, r) {
    if (!confirm(`Hapus "${sec.list(r).title}"?`)) return;
    const rows = state.content[sec.key].filter((x) => String(x.id) !== String(r.id));
    await persist(sec.key, rows);
    if (r.foto) try { await apiPost('delete-photo', { url: r.foto }); } catch (_) {}
    if (r.brosur) try { await apiPost('delete-photo', { url: r.brosur }); } catch (_) {}
  }

  /* ---------- editor ---------- */
  function edit(sec, row) {
    const isNew = !row;
    const data = Object.assign({}, row || {});
    if (isNew) {
      data.id = uuid();
      sec.fields.forEach((f) => { if (f.default) data[f.name] = typeof f.default === 'function' ? f.default() : f.default; });
    }
    const form = h('div', { class: 'editor' },
      h('h2', null, isNew ? 'Tambah baru' : 'Edit'),
      h('p', { class: 'editor__sub' }, sec.title),
    );
    const fields = {};
    sec.fields.forEach((f) => {
      let wrap, elRef;
      if (f.type === 'image') {
        elRef = createPhotoSlot(data[f.name], (url) => { data[f.name] = url; });
        wrap = h('div', { class: 'field' },
          h('label', null, f.label + (f.required ? ' *' : '')),
          elRef,
          f.hint ? h('div', { class: 'field__hint' }, f.hint) : null,
        );
      } else if (f.type === 'textarea') {
        const inp = h('textarea', null, data[f.name] || '');
        inp.addEventListener('input', () => { data[f.name] = inp.value; });
        elRef = inp;
        wrap = h('div', { class: 'field' },
          h('label', null, f.label + (f.required ? ' *' : '')),
          inp,
          f.hint ? h('div', { class: 'field__hint' }, f.hint) : null,
        );
      } else if (f.type === 'select') {
        const sel = h('select');
        f.options.forEach(([v, l]) => sel.append(h('option', { value: v, selected: data[f.name] === v }, l)));
        sel.addEventListener('change', () => { data[f.name] = sel.value; });
        if (!data[f.name]) data[f.name] = f.options[0][0];
        elRef = sel;
        wrap = h('div', { class: 'field' },
          h('label', null, f.label + (f.required ? ' *' : '')),
          sel,
          f.hint ? h('div', { class: 'field__hint' }, f.hint) : null,
        );
      } else if (f.type === 'checkbox') {
        const chk = h('input', { type: 'checkbox' });
        chk.checked = !!data[f.name];
        chk.addEventListener('change', () => { data[f.name] = chk.checked; });
        elRef = chk;
        wrap = h('div', { class: 'field field--inline' }, chk, h('label', null, f.label));
      } else if (f.type === 'youtube') {
        const inp = h('input', { type: 'text', value: data[f.name] || '', placeholder: 'https://youtu.be/…' });
        const prev = h('div', { class: 'yt-input__preview' });
        const upd = () => {
          const id = ytId(inp.value);
          data[f.name] = id;
          prev.innerHTML = '';
          if (id) prev.append(h('img', { src: ytThumb(id), alt: '' }));
          else prev.textContent = 'Thumbnail video akan muncul di sini';
        };
        inp.addEventListener('input', upd); upd();
        elRef = inp;
        wrap = h('div', { class: 'field yt-input' },
          h('label', null, f.label + (f.required ? ' *' : '')),
          inp,
          prev,
          f.hint ? h('div', { class: 'field__hint' }, f.hint) : null,
        );
      } else {
        const inp = h('input', { type: f.type || 'text', value: data[f.name] || '' });
        inp.addEventListener('input', () => { data[f.name] = inp.value; });
        elRef = inp;
        wrap = h('div', { class: 'field' },
          h('label', null, f.label + (f.required ? ' *' : '')),
          inp,
          f.hint ? h('div', { class: 'field__hint' }, f.hint) : null,
        );
      }
      fields[f.name] = elRef;
      form.append(wrap);
    });
    form.append(h('div', { class: 'editor__foot' },
      h('button', { class: 'btn btn--ghost', onClick: () => { state.editing = null; renderShell(); } }, 'Batal'),
      h('div', { style: { display: 'flex', gap: '.5rem' } },
        h('button', { class: 'btn', onClick: async () => {
          // validate
          for (const f of sec.fields) {
            if (f.required && !data[f.name]) return toast(`Isi dulu: ${f.label}`, 'err');
          }
          const list = (state.content[sec.key] || []).slice();
          const i = list.findIndex((r) => String(r.id) === String(data.id));
          if (i >= 0) list[i] = data; else list.push(data);
          await persist(sec.key, list);
          state.editing = null;
          renderShell();
        } }, 'Simpan'),
      ),
    ));
    state.editing = { sec, data };
    const app = document.getElementById('app');
    app.innerHTML = '';
    renderShell();
    const main = app.querySelector('.main');
    main.innerHTML = '';
    main.append(form);
  }

  /* ---------- photo picker ---------- */
  function createPhotoSlot(currentUrl, onChange) {
    const slot = h('div', { class: 'photo-pick__slot' + (currentUrl ? ' has' : '') });
    const chip = h('span', { class: 'photo-pick__chip' }, 'Foto saat ini');
    const dropHint = h('div', null, h('p', null, '📷 Belum ada foto.'), h('p', { style: { marginTop: '.5rem' } }, 'Klik Pilih / seret foto ke sini.'));
    const img = h('img', { alt: '' });
    if (currentUrl) { img.src = currentUrl; slot.append(chip, img); } else { slot.append(dropHint); }

    const input = h('input', { type: 'file', accept: 'image/*' });
    const progress = h('div', { class: 'photo-pick__progress' }, h('span'));
    const pickBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onClick: () => input.click() }, 'Pilih foto…');
    const clearBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onClick: () => { onChange(''); img.removeAttribute('src'); slot.classList.remove('has'); slot.innerHTML = ''; slot.append(dropHint); } }, 'Hapus');

    async function handle(file) {
      if (!file || !file.type.startsWith('image/')) return;
      pickBtn.disabled = true;
      progress.classList.add('show');
      progress.querySelector('span').style.width = '30%';
      try {
        const url = await uploadImage(file);
        progress.querySelector('span').style.width = '100%';
        onChange(url);
        slot.innerHTML = '';
        img.src = url;
        slot.append(chip, img);
        slot.classList.add('has');
        toast('Foto berhasil diunggah');
      } catch (e) {
        toast('Gagal unggah: ' + e.message, 'err');
      } finally {
        setTimeout(() => progress.classList.remove('show'), 600);
        progress.querySelector('span').style.width = '0';
        pickBtn.disabled = false;
      }
    }
    input.addEventListener('change', () => input.files && handle(input.files[0]));
    slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('dragover'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('dragover'));
    slot.addEventListener('drop', (e) => { e.preventDefault(); slot.classList.remove('dragover'); if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });
    slot.addEventListener('click', (e) => { if (e.target === slot || e.target === dropHint || dropHint.contains(e.target)) input.click(); });

    return h('div', { class: 'photo-pick' }, slot, h('div', { class: 'photo-pick__actions' }, pickBtn, clearBtn, input), progress);
  }

  /* ---------- galeri (album → photos) ---------- */
  function renderGaleri() {
    const albums = state.content.galeri_album.slice();
    sortRows(albums);
    const match = state.galeriAlbum ? albums.find((a) => a.slug === state.galeriAlbum) : null;
    if (match) return renderAlbumDetail(match);

    const addBtn = h('button', { class: 'btn', onClick: () => {
      const judul = prompt('Nama album baru?');
      if (!judul) return;
      const sl = slug(judul) || uuid();
      if (albums.find((a) => a.slug === sl)) return toast('Nama album sudah ada', 'err');
      const next = albums.concat([{ id: uuid(), slug: sl, judul, order: albums.length + 1 }]);
      persist('galeri_album', next);
    } }, '+ Album baru');
    const head = h('div', { class: 'page-head' },
      h('div', null, h('h1', null, 'Galeri'), h('p', null, `${albums.length} album, ${state.content.galeri_foto.length} foto total`)),
      h('div', { class: 'page-head__actions' }, addBtn),
    );
    const ul = h('ul', { class: 'items' });
    albums.forEach((a) => {
      const fotos = state.content.galeri_foto.filter((f) => f.album === a.slug);
      ul.append(h('li', { class: 'item', 'data-id': a.id },
        h('span', { class: 'item__drag' }, '⠿'),
        fotos[0] && fotos[0].foto ? h('img', { class: 'item__thumb', src: fotos[0].foto, alt: '' }) : h('div', { class: 'item__thumb item__thumb--letter' }, (a.judul || '?')[0]),
        h('div', { class: 'item__body' },
          h('div', { class: 'item__title' }, a.judul),
          h('div', { class: 'item__meta' }, h('span', null, fotos.length + ' foto')),
        ),
        h('div', { class: 'item__actions' },
          h('button', { class: 'btn btn--ghost btn--sm', onClick: () => { state.galeriAlbum = a.slug; renderShell(); } }, 'Buka'),
          h('button', { class: 'btn btn--ghost btn--sm', onClick: async () => {
            const nama = prompt('Nama album:', a.judul); if (!nama) return;
            const next = albums.map((x) => x.id === a.id ? { ...x, judul: nama } : x);
            await persist('galeri_album', next);
          } }, 'Ubah nama'),
          h('button', { class: 'btn btn--danger btn--sm', onClick: async () => {
            if (!confirm(`Hapus album "${a.judul}" beserta ${fotos.length} foto di dalamnya?`)) return;
            await persist('galeri_album', albums.filter((x) => x.id !== a.id));
            await persist('galeri_foto', state.content.galeri_foto.filter((f) => f.album !== a.slug));
          } }, 'Hapus'),
        ),
      ));
    });
    enableDrag(ul, { key: 'galeri_album', list: () => ({}) }, albums);
    return h('div', null, head, ul);
  }

  function renderAlbumDetail(album) {
    const fotos = state.content.galeri_foto.filter((f) => f.album === album.slug).slice();
    sortRows(fotos);
    const head = h('div', { class: 'page-head' },
      h('div', null,
        h('button', { class: 'btn btn--ghost btn--sm', onClick: () => { state.galeriAlbum = null; renderShell(); } }, '← Semua album'),
        h('h1', { style: { marginTop: '.5rem' } }, album.judul),
        h('p', null, `${fotos.length} foto`),
      ),
      h('div', { class: 'page-head__actions' },
        h('button', { class: 'btn', onClick: () => document.getElementById('add-foto').click() }, '+ Tambah foto'),
      ),
    );
    const input = h('input', { id: 'add-foto', type: 'file', accept: 'image/*', multiple: '', style: { display: 'none' } });
    input.addEventListener('change', async () => {
      for (const file of Array.from(input.files)) {
        try {
          const url = await uploadImage(file);
          const next = state.content.galeri_foto.concat([{ id: uuid(), album: album.slug, foto: url, order: state.content.galeri_foto.length + 1 }]);
          await persist('galeri_foto', next);
        } catch (e) { toast('Gagal unggah ' + file.name + ': ' + e.message, 'err'); }
      }
    });
    const grid = h('div', { style: { display: 'grid', gap: '.75rem', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' } });
    fotos.forEach((f) => grid.append(h('div', { style: { position: 'relative', background: '#000', borderRadius: '10px', overflow: 'hidden', aspectRatio: '1/1' } },
      h('img', { src: f.foto, alt: '', style: { width: '100%', height: '100%', objectFit: 'cover' } }),
      h('button', { class: 'btn btn--danger btn--sm', style: { position: 'absolute', top: '.4rem', right: '.4rem' }, onClick: async () => {
        if (!confirm('Hapus foto ini?')) return;
        await persist('galeri_foto', state.content.galeri_foto.filter((x) => x.id !== f.id));
        try { await apiPost('delete-photo', { url: f.foto }); } catch (_) {}
      } }, 'Hapus'),
    )));
    if (!fotos.length) grid.append(h('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, 'Album kosong. Klik “+ Tambah foto” untuk mengisi.'));
    return h('div', null, head, input, grid);
  }

  /* ---------- diagnostics ---------- */
  function renderDiagnosa() {
    const out = h('pre', { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#111', color: '#dfe', padding: '1rem', borderRadius: '10px', fontSize: '.85rem', minHeight: '8rem', margin: '1rem 0 0' } }, 'Klik "Jalankan cek" untuk mulai.');
    const write = (line) => { out.textContent += line + '\n'; };
    async function raw(label, init, url) {
      const t0 = Date.now();
      try {
        const r = await fetch(url || API, init);
        const text = await r.text();
        write(`${label}: HTTP ${r.status} dalam ${Date.now() - t0} ms, tipe ${r.headers.get('content-type') || '-'}`);
        write('  isi: ' + text.replace(/\s+/g, ' ').slice(0, 300));
        try { return JSON.parse(text); } catch (_) { write('  ⚠ bukan JSON'); return null; }
      } catch (e) {
        write(`${label}: GAGAL (${e.message}) setelah ${Date.now() - t0} ms`);
        return null;
      }
    }
    async function run() {
      out.textContent = '';
      write('Dashboard: ' + location.href);
      write('API_URL : ' + API);
      write('Sandi tersimpan: ' + (secret() ? 'ya (' + secret().length + ' karakter)' : 'TIDAK'));
      write('');
      const u = new URL(API); u.searchParams.set('action', 'content'); u.searchParams.set('fresh', '1');
      const pub = await raw('1. GET publik (dipakai website)', { method: 'GET' }, u.toString());
      if (pub && pub.pengumuman) write('  → pengumuman publik: ' + pub.pengumuman.length);
      write('');
      const login = await raw('2. POST login', { method: 'POST', body: JSON.stringify({ action: 'login', secret: secret() }) });
      if (login && login.ok) write('  → sandi diterima');
      else if (login && login.error) write('  → ditolak: ' + login.error);
      else if (login && login.pengumuman) write('  → ⚠ POST diperlakukan sebagai GET (body hilang)');
      write('');
      const adm = await raw('3. POST admin-content (versi Apps Script)', { method: 'POST', body: JSON.stringify({ action: 'admin-content', secret: secret() }) });
      if (adm && adm.meta) write('  → Apps Script versi ' + (adm.meta.version || '?') + ', isi Sheet: pengumuman=' + adm.content.pengumuman.length + ', video=' + adm.content.video.length);
      else if (adm && adm.error === 'unknown action') write('  → ⚠ Apps Script MASIH VERSI LAMA (belum Deploy → New version)');
      write('');
      write('Selesai. Screenshot semua teks di kotak ini dan kirim ke admin web.');
    }
    return h('div', null,
      h('div', { class: 'page-head' },
        h('div', null, h('h1', null, 'Cek Koneksi'), h('p', null, 'Mengetes jalur dashboard → Apps Script → Google Sheet. Tidak mengubah data apa pun.')),
        h('div', { class: 'page-head__actions' },
          h('button', { class: 'btn', onClick: run }, 'Jalankan cek'),
          h('button', { class: 'btn btn--ghost', onClick: () => { navigator.clipboard && navigator.clipboard.writeText(out.textContent).then(() => toast('Hasil disalin')); } }, 'Salin hasil'),
        ),
      ),
      out,
    );
  }

  /* ---------- persist ---------- */
  async function persist(table, rows) {
    state.saving = true;
    try {
      const normalized = rows.map((r, i) => Object.assign({ order: i + 1 }, r));
      const res = await apiPost('save', { table, rows: normalized });
      // Trust the sheet, not local state: re-read and confirm the row count.
      if (typeof res.stored === 'number' && res.stored !== normalized.length) {
        throw new Error(`Google Sheet hanya menyimpan ${res.stored} dari ${normalized.length} baris`);
      }
      if (typeof res.saved !== 'number') {
        throw new Error('Apps Script tidak menjawab seperti biasa. Data kemungkinan tidak tersimpan.');
      }
      await refreshFromServer();
      toast('Tersimpan ke Google Sheet');
      renderShell();
    } catch (e) {
      toast('Gagal menyimpan: ' + e.message, 'err');
    } finally {
      state.saving = false;
    }
  }

  start();
})();
