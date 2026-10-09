/**
 * Backend admin SD Negeri Ambarukmo.
 * Satu script Apps Script = database (Google Sheet) + storage foto (Drive) + API JSON.
 *
 * Cara memakai: baca SETUP.md.
 * Semua pengaturan tersimpan di Project Settings > Script Properties.
 *   SPREADSHEET_ID   dibuat otomatis oleh `setup()`
 *   DRIVE_FOLDER_ID  dibuat otomatis oleh `setup()`
 *   ADMIN_SECRET     kata sandi yang dipakai dashboard untuk menulis
 */

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
  return jsonOut({ error: 'unknown action' }, 400);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!verifySecret(body.secret)) return jsonOut({ error: 'unauthorized' }, 401);
    const action = body.action;
    if (action === 'login') return jsonOut({ ok: true });
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
  return !!want && !!secret && secret === want;
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

function getContent(skipCache) {
  const cache = CacheService.getScriptCache();
  if (!skipCache) {
    const hit = cache.get(CACHE_KEY);
    if (hit) return JSON.parse(hit);
  }
  const data = {};
  for (const name of Object.keys(SCHEMA)) {
    const rows = readTable(name);
    // sort by order, then by id
    rows.sort((a, b) => (Number(a.order || 0) - Number(b.order || 0)) || String(a.id).localeCompare(String(b.id)));
    data[name] = rows;
  }
  // drop draft announcements from public output
  data.pengumuman = data.pengumuman.filter((r) => !r.draft);
  // normalize dates to ISO yyyy-mm-dd
  data.pengumuman.forEach((r) => { if (r.tanggal instanceof Date) r.tanggal = Utilities.formatDate(r.tanggal, 'UTC', 'yyyy-MM-dd'); });
  cache.put(CACHE_KEY, JSON.stringify(data), CACHE_SECONDS);
  return data;
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
  if (rows.length) {
    const matrix = rows.map((r, i) => header.map((h) => {
      let v = r[h];
      if (h === 'order' && (v === undefined || v === '')) v = i + 1;
      if (v === undefined || v === null) return '';
      return v;
    }));
    sheet.getRange(2, 1, matrix.length, header.length).setValues(matrix);
  }
  CacheService.getScriptCache().remove(CACHE_KEY);
  return { ok: true, saved: rows.length };
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
