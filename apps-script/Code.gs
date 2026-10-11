/**
 * Backend admin SD Negeri Ambarukmo.
 * Satu script Apps Script = database (Google Sheet) + storage foto (Drive) + API JSON.
 *
 * Cara memakai: baca SETUP.md.
 * Semua pengaturan tersimpan di Project Settings > Script Properties.
 *   SPREADSHEET_ID   dibuat otomatis oleh `setup()`
 *   DRIVE_FOLDER_ID  dibuat otomatis oleh `setup()`
 *   ADMIN_SECRET     kunci darurat: hanya untuk membuat / mereset akun admin
 *   ADMIN_USER, ADMIN_PASS, NOTIFY_EMAIL, SESSIONS
 *                    akun login dashboard; diisi lewat dashboard, jangan diubah manual
 */

/** Alamat dashboard, dipakai sebagai link di email notifikasi. */
const DASHBOARD_URL = 'https://sdnmbarukmo.vercel.app/dashboard/';

const CACHE_KEY = 'content-v1';
const CACHE_SECONDS = 20;

const SCHEMA = {
  pengumuman: ['id', 'tanggal', 'label', 'judul', 'brosur', 'naskah', 'draft', 'order'],
  guru: ['id', 'kelompok', 'nama', 'jabatan', 'foto', 'order'],
  ekskul: ['id', 'nama', 'foto', 'naskah', 'order'],
  kegiatan_sekolah: ['id', 'judul', 'foto', 'keterangan', 'order'],
  fasilitas: ['id', 'grup', 'nama', 'foto', 'order'],
  galeri_album: ['id', 'slug', 'judul', 'order'],
  galeri_foto: ['id', 'album', 'foto', 'order'],
  video: ['id', 'youtube_id', 'judul', 'order'],
  brosur_ppdb: ['id', 'foto'],
};

/* ===================== setup ===================== */
/** Jalankan sekali dari editor Apps Script. Membuat folder Drive, spreadsheet,
 *  dan ADMIN_SECRET acak. ID dan URL dicetak di log. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty('DRIVE_FOLDER_ID');
  if (!folderId) {
    const folder = DriveApp.createFolder('SDN Ambarukmo - Foto Dashboard');
    folderId = folder.getId();
    props.setProperty('DRIVE_FOLDER_ID', folderId);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
  let sheetId = props.getProperty('SPREADSHEET_ID');
  if (!sheetId) {
    const ss = SpreadsheetApp.create('SDN Ambarukmo - Data Dashboard');
    sheetId = ss.getId();
    props.setProperty('SPREADSHEET_ID', sheetId);
    const first = ss.getSheets()[0];
    first.setName('_meta');
    first.getRange('A1').setValue('key');
    first.getRange('B1').setValue('value');
    for (const name of Object.keys(SCHEMA)) {
      const s = ss.insertSheet(name);
      s.getRange(1, 1, 1, SCHEMA[name].length).setValues([SCHEMA[name]]);
      s.setFrozenRows(1);
    }
    ss.getRange(1, 1); // noop
  }
  if (!props.getProperty('ADMIN_SECRET')) {
    const secret = Utilities.base64EncodeWebSafe(Utilities.getUuid() + Utilities.getUuid()).slice(0, 24);
    props.setProperty('ADMIN_SECRET', secret);
  }
  Logger.log('SPREADSHEET_ID = ' + sheetId);
  Logger.log('DRIVE_FOLDER_ID = ' + folderId);
  Logger.log('ADMIN_SECRET = ' + props.getProperty('ADMIN_SECRET'));
  Logger.log('Sheet: https://docs.google.com/spreadsheets/d/' + sheetId);
  Logger.log('Folder: https://drive.google.com/drive/folders/' + folderId);
}

/* ===================== API ===================== */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'content';
  if (action === 'content') return jsonOut(getContent(e.parameter.fresh === '1'));
  if (action === 'ping') return jsonOut({ ok: true, time: new Date().toISOString() });
  if (action === 'auth-status') return jsonOut({ ok: true, hasAccount: !!account_(), version: 3 });
  return jsonOut({ error: 'unknown action' }, 400);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    // Actions that don't need a session.
    if (action === 'login') return jsonOut(login(body.username, body.password));
    if (action === 'setup-account') return jsonOut(setupAccount(body));
    if (action === 'forgot') return jsonOut(forgotPassword(body.username));
    if (action === 'reset') return jsonOut(resetPassword(body.username, body.code, body.newPassword));
    // Everything else needs a valid login session.
    const session = checkSession_(body.token);
    if (!session) return jsonOut({ error: 'unauthorized' }, 401);
    if (action === 'logout') return jsonOut(logout(session));
    if (action === 'account') return jsonOut(accountInfo());
    if (action === 'change-password') return jsonOut(changePassword(session, body.oldPassword, body.newPassword));
    if (action === 'change-account') return jsonOut(changeAccount(body.password, body.username, body.email));
    if (action === 'admin-content') return jsonOut(getAdminContent());
    if (action === 'save') return jsonOut(saveTable(body.table, body.rows));
    if (action === 'upload') return jsonOut(uploadPhoto(body.filename, body.mime, body.base64));
    if (action === 'delete-photo') return jsonOut(deletePhoto(body.url));
    return jsonOut({ error: 'unknown action' }, 400);
  } catch (err) {
    return jsonOut({ error: String(err && err.message || err) }, 500);
  }
}

function verifySecret(secret) {
  const want = PropertiesService.getScriptProperties().getProperty('ADMIN_SECRET');
  return !!want && !!secret && safeEqual_(String(secret), want);
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ===================== content ===================== */
function openSheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('belum setup, jalankan setup() dulu');
  return SpreadsheetApp.openById(id);
}

function readTable(name) {
  const sheet = openSheet().getSheetByName(name);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const header = values[0];
  return values.slice(1).filter((r) => r.some((c) => c !== '' && c !== null)).map((row) => {
    const obj = {};
    header.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function isDraft(v) {
  if (v === true) return true;
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'ya' || s === 'yes';
}

function tz() {
  try { return openSheet().getSpreadsheetTimeZone(); } catch (e) { return Session.getScriptTimeZone(); }
}

function readAll(includeDrafts) {
  const zone = tz();
  const data = {};
  for (const name of Object.keys(SCHEMA)) {
    const rows = readTable(name);
    rows.sort((a, b) => (Number(a.order || 0) - Number(b.order || 0)) || String(a.id).localeCompare(String(b.id)));
    data[name] = rows;
  }
  data.pengumuman.forEach((r) => {
    if (r.tanggal instanceof Date) r.tanggal = Utilities.formatDate(r.tanggal, zone, 'yyyy-MM-dd');
    r.draft = isDraft(r.draft);
  });
  if (!includeDrafts) data.pengumuman = data.pengumuman.filter((r) => !r.draft);
  return data;
}

/** Public content (no drafts), cached briefly. */
function getContent(skipCache) {
  const cache = CacheService.getScriptCache();
  if (!skipCache) {
    const hit = cache.get(CACHE_KEY);
    if (hit) return JSON.parse(hit);
  }
  const data = readAll(false);
  cache.put(CACHE_KEY, JSON.stringify(data), CACHE_SECONDS);
  return data;
}

/** Admin view: everything in the sheet, including drafts, never cached. */
function getAdminContent() {
  const props = PropertiesService.getScriptProperties();
  return {
    content: readAll(true),
    meta: {
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + props.getProperty('SPREADSHEET_ID'),
      folderUrl: 'https://drive.google.com/drive/folders/' + props.getProperty('DRIVE_FOLDER_ID'),
      version: 3,
    },
  };
}

function saveTable(name, rows) {
  const header = SCHEMA[name];
  if (!header) throw new Error('tabel tidak dikenal: ' + name);
  const sheet = openSheet().getSheetByName(name) || openSheet().insertSheet(name);
  // ensure header
  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  sheet.setFrozenRows(1);
  const rowCount = sheet.getLastRow() - 1;
  if (rowCount > 0) sheet.getRange(2, 1, rowCount, sheet.getLastColumn()).clearContent();
  // dates stay plain text (yyyy-mm-dd) so the sheet's timezone can't shift them
  const dateCol = header.indexOf('tanggal');
  if (dateCol >= 0) sheet.getRange(2, dateCol + 1, Math.max(rows.length, 1), 1).setNumberFormat('@');
  if (rows.length) {
    const matrix = rows.map((r, i) => header.map((h) => {
      let v = r[h];
      if (h === 'order' && (v === undefined || v === '')) v = i + 1;
      if (v === undefined || v === null) return '';
      return v;
    }));
    sheet.getRange(2, 1, matrix.length, header.length).setValues(matrix);
  }
  SpreadsheetApp.flush();
  CacheService.getScriptCache().remove(CACHE_KEY);
  return { ok: true, saved: rows.length, stored: readTable(name).length };
}

/* ===================== Drive upload ===================== */
function folder() {
  const id = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
  if (!id) throw new Error('belum setup, jalankan setup() dulu');
  return DriveApp.getFolderById(id);
}

function uploadPhoto(filename, mime, base64) {
  if (!filename || !base64) throw new Error('filename dan base64 wajib');
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mime || 'image/webp', safeName(filename));
  const file = folder().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const id = file.getId();
  return { id, url: 'https://lh3.googleusercontent.com/d/' + id + '=w1600', filename: file.getName() };
}

function deletePhoto(url) {
  if (!url) return { ok: true };
  const m = String(url).match(/[-\w]{25,}/);
  if (!m) return { ok: true };
  try { DriveApp.getFileById(m[0]).setTrashed(true); } catch (e) {}
  return { ok: true };
}

function safeName(name) {
  const base = String(name).replace(/[^\w.-]+/g, '_').slice(0, 60);
  return Date.now() + '-' + base;
}

/* ===================== akun login ===================== */
const SESSION_DAYS = 30;
const MAX_SESSIONS = 40;
const LOGIN_MAX_FAILS = 5;
const LOCK_SECONDS = 15 * 60;

function props_() { return PropertiesService.getScriptProperties(); }

function account_() {
  const p = props_();
  const user = p.getProperty('ADMIN_USER');
  const pass = p.getProperty('ADMIN_PASS');
  if (!user || !pass) return null;
  return { user, pass, email: p.getProperty('NOTIFY_EMAIL') || '' };
}

function normUser_(u) { return String(u || '').trim().toLowerCase(); }

function validUser_(u) {
  if (!/^[a-z0-9._-]{3,32}$/.test(u)) throw new Error('Username 3–32 karakter, hanya huruf, angka, titik, strip, atau garis bawah (tanpa spasi).');
}
function validPass_(p) {
  p = String(p || '');
  if (p.length < 8) throw new Error('Password minimal 8 karakter.');
  if (p.length > 100) throw new Error('Password maksimal 100 karakter.');
}
function validEmail_(e) {
  e = String(e || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('Alamat email tidak valid.');
  return e;
}

function toHex_(bytes) {
  return bytes.map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
function sha256_(text) {
  return toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8));
}
function randomToken_() {
  return sha256_(Utilities.getUuid() + Utilities.getUuid() + Date.now());
}

/** Salted, iterated HMAC-SHA256. Stored as "salt$hash". */
function hashPassword_(password, salt) {
  salt = salt || randomToken_().slice(0, 32);
  const key = Utilities.newBlob(salt).getBytes();
  let d = Utilities.computeHmacSha256Signature(Utilities.newBlob(String(password)).getBytes(), key);
  for (let i = 0; i < 400; i++) d = Utilities.computeHmacSha256Signature(d, key);
  return salt + '$' + Utilities.base64Encode(d);
}
function checkPassword_(password, stored) {
  const salt = String(stored || '').split('$')[0];
  return !!salt && safeEqual_(hashPassword_(password, salt), stored);
}
function safeEqual_(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/* ----- sesi login (disimpan sebagai hash, berlaku 30 hari) ----- */
function readSessions_() {
  try { return JSON.parse(props_().getProperty('SESSIONS') || '{}'); } catch (e) { return {}; }
}
function writeSessions_(map) {
  const now = Date.now();
  const live = Object.keys(map).filter((k) => map[k] > now).sort((a, b) => map[b] - map[a]).slice(0, MAX_SESSIONS);
  const out = {};
  live.forEach((k) => { out[k] = map[k]; });
  props_().setProperty('SESSIONS', JSON.stringify(out));
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function newSession_(clearOthers) {
  const token = randomToken_();
  withLock_(() => {
    const map = clearOthers ? {} : readSessions_();
    map[sha256_(token)] = Date.now() + SESSION_DAYS * 864e5;
    writeSessions_(map);
  });
  return token;
}
/** Returns the session key (hash) when the token is valid. */
function checkSession_(token) {
  if (!token) return null;
  const key = sha256_(token);
  const exp = readSessions_()[key];
  return exp && exp > Date.now() ? key : null;
}
function endSessions_(keepKey) {
  withLock_(() => {
    const map = readSessions_();
    const out = {};
    if (keepKey && map[keepKey]) out[keepKey] = map[keepKey];
    writeSessions_(out);
  });
}

/* ----- aksi ----- */
function login(username, password) {
  const acc = account_();
  if (!acc) return { error: 'Akun admin belum dibuat. Pilih "Buat akun / kunci darurat".' };
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('login-fails') || 0);
  if (fails >= LOGIN_MAX_FAILS) return { error: 'Terlalu banyak percobaan gagal. Coba lagi 15 menit lagi.' };
  if (normUser_(username) !== acc.user || !checkPassword_(password, acc.pass)) {
    cache.put('login-fails', String(fails + 1), LOCK_SECONDS);
    return { error: 'Username atau password salah.' };
  }
  cache.remove('login-fails');
  return { ok: true, token: newSession_(false), username: acc.user };
}

function logout(sessionKey) {
  withLock_(() => {
    const map = readSessions_();
    delete map[sessionKey];
    writeSessions_(map);
  });
  return { ok: true };
}

function accountInfo() {
  const acc = account_();
  return { ok: true, username: acc ? acc.user : '', email: acc ? acc.email : '' };
}

/** Pertama kali, atau reset darurat: butuh ADMIN_SECRET dari Script Properties. */
function setupAccount(body) {
  if (!verifySecret(body.secret)) return { error: 'Kunci darurat (ADMIN_SECRET) salah.' };
  const user = normUser_(body.username);
  validUser_(user);
  validPass_(body.password);
  const email = validEmail_(body.email);
  const before = account_();
  const p = props_();
  p.setProperty('ADMIN_USER', user);
  p.setProperty('ADMIN_PASS', hashPassword_(body.password));
  p.setProperty('NOTIFY_EMAIL', email);
  CacheService.getScriptCache().remove('login-fails');
  const token = newSession_(true);
  const what = before ? 'direset memakai kunci darurat' : 'dibuat';
  const lines = [
    'Akun dashboard admin ' + what + ' pada ' + nowText_() + '.',
    'Username: ' + user,
    'Email notifikasi: ' + email,
    before ? 'Semua perangkat yang sebelumnya login sudah dikeluarkan.' : '',
  ];
  const mail = notify_([email].concat(before && before.email && before.email !== email ? [before.email] : []), 'Akun dashboard ' + what, lines);
  return { ok: true, token, username: user, mail };
}

function changePassword(sessionKey, oldPassword, newPassword) {
  const acc = account_();
  if (!acc) return { error: 'Akun admin belum dibuat.' };
  if (!checkPassword_(oldPassword, acc.pass)) return { error: 'Password lama salah.' };
  validPass_(newPassword);
  if (oldPassword === newPassword) return { error: 'Password baru sama dengan yang lama.' };
  props_().setProperty('ADMIN_PASS', hashPassword_(newPassword));
  endSessions_(sessionKey); // perangkat lain harus login ulang
  const mail = notify_([acc.email], 'Password dashboard diganti', [
    'Password akun dashboard admin (username: ' + acc.user + ') baru saja diganti pada ' + nowText_() + '.',
    'Perangkat lain yang sedang login sudah dikeluarkan otomatis.',
    'Kalau ini bukan kamu, segera buka dashboard lalu klik "Lupa password" untuk membuat password baru.',
  ]);
  return { ok: true, mail };
}

function changeAccount(password, username, email) {
  const acc = account_();
  if (!acc) return { error: 'Akun admin belum dibuat.' };
  if (!checkPassword_(password, acc.pass)) return { error: 'Password salah.' };
  const user = normUser_(username || acc.user);
  validUser_(user);
  const mailTo = validEmail_(email || acc.email);
  if (user === acc.user && mailTo === acc.email) return { ok: true, username: user, email: mailTo, unchanged: true };
  const p = props_();
  p.setProperty('ADMIN_USER', user);
  p.setProperty('NOTIFY_EMAIL', mailTo);
  const lines = ['Pengaturan akun dashboard admin diubah pada ' + nowText_() + '.'];
  if (user !== acc.user) lines.push('Username: ' + acc.user + ' → ' + user);
  if (mailTo !== acc.email) lines.push('Email notifikasi: ' + (acc.email || '-') + ' → ' + mailTo);
  lines.push('Kalau ini bukan kamu, segera hubungi pengelola website.');
  const to = [mailTo].concat(acc.email && acc.email !== mailTo ? [acc.email] : []);
  const mail = notify_(to, 'Akun dashboard diubah', lines);
  return { ok: true, username: user, email: mailTo, mail };
}

/** Kirim kode 6 angka ke email notifikasi (berlaku 15 menit). */
function forgotPassword(username) {
  const generic = { ok: true, message: 'Kalau username benar, kode reset sudah dikirim ke email terdaftar.' };
  const acc = account_();
  const cache = CacheService.getScriptCache();
  if (cache.get('reset-wait')) return { error: 'Kode baru saja dikirim. Tunggu 1 menit sebelum minta lagi.' };
  if (!acc || normUser_(username) !== acc.user || !acc.email) return generic;
  const n = parseInt(sha256_(Utilities.getUuid()).slice(0, 12), 16) % 1000000;
  const code = ('000000' + n).slice(-6);
  cache.put('reset-code', JSON.stringify({ hash: sha256_(code), tries: 0 }), 15 * 60);
  cache.put('reset-wait', '1', 60);
  const mail = notify_([acc.email], 'Kode reset password: ' + code, [
    'Ada permintaan reset password dashboard admin (username: ' + acc.user + ') pada ' + nowText_() + '.',
    'Kode reset: ' + code,
    'Kode berlaku 15 menit. Kalau kamu tidak meminta reset, abaikan email ini; password tidak berubah.',
  ]);
  if (!mail.sent) return { error: 'Email gagal dikirim: ' + mail.error };
  return { ok: true, message: generic.message, sentTo: maskEmail_(acc.email) };
}

function resetPassword(username, code, newPassword) {
  const acc = account_();
  const cache = CacheService.getScriptCache();
  const raw = cache.get('reset-code');
  if (!acc || !raw || normUser_(username) !== acc.user) return { error: 'Kode salah atau sudah kedaluwarsa. Minta kode baru.' };
  const rec = JSON.parse(raw);
  if (!safeEqual_(sha256_(String(code || '').trim()), rec.hash)) {
    rec.tries += 1;
    if (rec.tries >= 5) cache.remove('reset-code');
    else cache.put('reset-code', JSON.stringify(rec), 15 * 60);
    return { error: rec.tries >= 5 ? 'Kode salah 5 kali. Minta kode baru.' : 'Kode salah.' };
  }
  validPass_(newPassword);
  cache.remove('reset-code');
  cache.remove('login-fails');
  props_().setProperty('ADMIN_PASS', hashPassword_(newPassword));
  const token = newSession_(true);
  const mail = notify_([acc.email], 'Password dashboard direset', [
    'Password akun dashboard admin (username: ' + acc.user + ') direset memakai kode email pada ' + nowText_() + '.',
    'Semua perangkat lain sudah dikeluarkan.',
    'Kalau ini bukan kamu, segera minta kode reset baru dan ganti password.',
  ]);
  return { ok: true, token, username: acc.user, mail };
}

/* ----- email ----- */
function notify_(to, subject, lines) {
  to = to.filter(Boolean);
  if (!to.length) return { sent: false, error: 'email notifikasi belum diisi' };
  lines = lines.filter(Boolean);
  const text = lines.join('\n\n') + '\n\nDashboard: ' + DASHBOARD_URL + '\n\nEmail ini dikirim otomatis, tidak perlu dibalas.';
  const html = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:560px">' +
    '<h2 style="margin:0 0 12px;color:#1f5f4f;font-size:18px">Dashboard SD Negeri Ambarukmo</h2>' +
    lines.map((l) => '<p style="margin:0 0 12px">' + escapeHtml_(l) + '</p>').join('') +
    '<p style="margin:20px 0"><a href="' + DASHBOARD_URL + '" style="background:#2e7d6b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Buka dashboard</a></p>' +
    '<p style="margin:0;color:#888;font-size:12px">Email ini dikirim otomatis, tidak perlu dibalas.</p></div>';
  try {
    MailApp.sendEmail({ to: to.join(','), subject: '[Dashboard SDN Ambarukmo] ' + subject, body: text, htmlBody: html, name: 'Dashboard SD Negeri Ambarukmo' });
    return { sent: true, to: to.map(maskEmail_) };
  } catch (err) {
    return { sent: false, error: String(err && err.message || err) };
  }
}

function escapeHtml_(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function maskEmail_(e) {
  const parts = String(e).split('@');
  if (parts.length !== 2) return e;
  return parts[0].slice(0, 2) + '***@' + parts[1];
}
function nowText_() {
  const d = new Date();
  const zone = 'Asia/Jakarta';
  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const f = (p) => Utilities.formatDate(d, zone, p);
  return hari[Number(f('u')) % 7] + ', ' + Number(f('d')) + ' ' + bulan[Number(f('M')) - 1] + ' ' + f('yyyy') + ' pukul ' + f('HH.mm') + ' WIB';
}

/** Jalankan sekali dari editor setelah update: memberi izin kirim email
 *  dan mengirim email tes ke akun Google pemilik script. */
function tesEmail() {
  const to = props_().getProperty('NOTIFY_EMAIL') || Session.getEffectiveUser().getEmail();
  const r = notify_([to], 'Tes email', ['Email notifikasi dashboard berfungsi (' + nowText_() + ').']);
  Logger.log(r.sent ? 'Email tes terkirim ke ' + to : 'Gagal: ' + r.error);
}
