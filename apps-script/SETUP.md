# Setup dashboard (sekali saja, sekitar 5 menit)

Dashboard pakai akun Google **lo sendiri** sebagai database (Google Sheet) dan tempat
simpan foto (Google Drive). Script-nya bikin folder dan spreadsheet otomatis — lo
cukup copy-paste kode, klik beberapa tombol, lalu kirim satu URL ke gw.

## 1. Buat project Apps Script

1. Login ke Google pakai akun yang mau jadi admin (misal `lottatores24@gmail.com`).
2. Buka [script.google.com](https://script.google.com) → **New project** (judul: `SDN Ambarukmo Dashboard`).
3. Hapus semua isi editor, lalu **copy-paste** semua isi `apps-script/Code.gs` dari
   repo ini (bisa dibuka di GitHub).
4. Klik ikon disket (💾) untuk simpan.

## 2. Jalankan `setup()` sekali

1. Di editor, pastikan dropdown fungsi (atas) menunjuk ke `setup`.
2. Klik tombol **Run** (▶).
3. Muncul permintaan izin → **Review permissions** → pilih akun lo → **Advanced**
   → **Go to SDN Ambarukmo Dashboard (unsafe)** → **Allow**. (Pesan "unsafe"
   normal, karena script-nya buatan sendiri, bukan dari Google.)
4. Setelah selesai, buka menu **View → Logs** (atau `Ctrl + Enter`).
   Lo bakal lihat 5 baris:

   ```
   SPREADSHEET_ID = 1abc...
   DRIVE_FOLDER_ID = 1xyz...
   ADMIN_SECRET = aB3kL...
   Sheet: https://docs.google.com/spreadsheets/d/1abc...
   Folder: https://drive.google.com/drive/folders/1xyz...
   ```

   **`ADMIN_SECRET` ini adalah kata sandi dashboard lo.** Catat baik-baik.

## 3. Deploy sebagai Web App

1. Pojok kanan atas: **Deploy → New deployment**.
2. Icon gerigi → pilih **Web app**.
3. Isi:
   - **Description**: `Dashboard SDN Ambarukmo v1`
   - **Execute as**: **Me** (`lottatores24@gmail.com`)
   - **Who has access**: **Anyone** (ini wajib supaya web publik bisa baca JSON;
     tapi tulis tetap aman karena harus pakai ADMIN_SECRET)
4. Klik **Deploy** → **Authorize access** (kalau diminta lagi).
5. Muncul **Web app URL** yang berakhiran `/exec`. **Copy** URL itu.

## 4. Kirim ke gw

Balas chat ini dengan 2 hal:
- **Web app URL** (yang berakhir `/exec`)
- **ADMIN_SECRET** dari log tadi

Begitu masuk, gw tulis setting-nya ke dashboard dan web publik, terus push.
Lo tinggal buka dashboard, login pakai ADMIN_SECRET, dan langsung bisa edit konten.

> Kalau mau ubah ADMIN_SECRET di kemudian hari: buka project Apps Script → ⚙️
> **Project Settings → Script Properties** → ubah nilai `ADMIN_SECRET`.

## Update Apps Script (setiap kali Code.gs di repo berubah)

URL `/exec` **tidak berubah**, jadi dashboard dan web tidak perlu diubah.

1. Buka project di [script.google.com](https://script.google.com).
2. Hapus semua isi editor, lalu copy-paste ulang isi `apps-script/Code.gs` terbaru. Simpan (Ctrl+S).
3. **Deploy → Manage deployments** → klik ikon pensil ✎ di deployment yang ada.
4. Di **Version**, pilih **New version** → **Deploy**.

Kalau langkah 3–4 dilewati, Google tetap menjalankan kode lama walaupun editornya sudah berisi kode baru.

## Catatan

- Setiap kali kode `Code.gs` di repo berubah, **ulangi langkah 1 (copy-paste) + Deploy → Manage deployments → ✎ → New version**.
  URL `/exec`-nya **tidak berubah**.
- Semua foto yang di-upload lewat dashboard tersimpan di folder Drive yang
  dibuat tadi, otomatis diset "siapa saja yang punya link bisa lihat".
- Spreadsheet-nya bisa dibuka manual kapan saja (link ada di log). Isi manual
  juga boleh, dashboard akan ikut membaca.
