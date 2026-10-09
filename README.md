# Website SD Negeri Ambarukmo

Website resmi SD Negeri Ambarukmo (Caturtunggal, Depok, Sleman). Ini versi baru dari project Mobirise `ambarukmo`,
dengan desain dan posisi foto yang sama, tapi lebih ringan dan lebih halus.

Dibuat pakai HTML, CSS, dan JavaScript biasa, **tanpa build dan tanpa framework**. Cukup upload semua file ke hosting.

## Halaman

| File | Isi |
|---|---|
| `index.html` | Beranda: sambutan kepala sekolah, video kegiatan |
| `visi-misi.html` | Visi, misi, dan tujuan |
| `guru-pegawai.html` | Kepala sekolah, guru, dan tenaga kependidikan |
| `pendaftaran.html` | Pendaftaran peserta didik baru (tombol ke WhatsApp) |
| `pengumuman.html` | Pengumuman / berita |
| `fasilitas.html` | Ruang kelas, ruang guru, fasilitas tambahan |
| `ekstrakurikuler.html` | Daftar ekstrakurikuler |
| `kegiatan-sekolah.html` | Dokumentasi kegiatan sekolah |
| `komunitas-sedamba.html` | Komunitas Belajar SEDAMBA |
| `sedamba.html` | Agenda, foto, dan video SEDAMBA |
| `parenting.html` | Kegiatan parenting |
| `galeri.html` | Galeri foto dan video |
| `hubungi-kami.html` | Media sosial dan kontak |

```
assets/
  css/style.css   semua tampilan (warna, font, layout)
  js/main.js      menu HP, slider, popup foto, animasi, video
  img/            foto (WebP, sudah dikompres)
  fonts/          font Acme dan Kanit (disimpan lokal, tidak perlu Google Fonts)
```

## Cara melihat di komputer

Buka folder ini lalu jalankan server lokal, contohnya:

```
python -m http.server 8000
```

lalu buka `http://localhost:8000`. Bisa juga pakai ekstensi **Live Server** di VS Code.
(Kalau `index.html` dibuka langsung dengan dobel-klik, font kadang tidak termuat, karena aturan keamanan browser untuk `file://`.)

## Cara upload ke hosting

Upload **semua isi folder** (semua file `.html` dan folder `assets`) ke `public_html` (cPanel),
atau hubungkan repo ini ke GitHub Pages / Netlify / Vercel. Tidak ada perintah build.

## Dashboard admin

Konten berikut diatur dari dashboard di `/dashboard/` (login pakai ADMIN_SECRET), tanpa mengedit HTML:
pengumuman, guru & pegawai, ekstrakurikuler, kegiatan sekolah, fasilitas, album galeri, video kegiatan,
dan brosur PPDB. Data disimpan di Google Sheet, foto di Google Drive, lewat Apps Script
(lihat `apps-script/SETUP.md`). Halaman publik memuat data itu lewat `assets/js/content.js`; kalau
dashboard belum berisi data atau tidak bisa dihubungi, isi HTML bawaan yang tampil.

Tambahkan `?debug=1` di alamat halaman (misalnya `pengumuman.html?debug=1`) untuk melihat apa yang
dimuat dari dashboard. Menu **Cek Koneksi** di dashboard mengetes jalur ke Apps Script.

## Cara mengedit

- **Teks**: buka file `.html` halaman yang mau diubah, cari teksnya, lalu ganti.
- **Menu, kontak, dan footer** ada di setiap halaman. Kalau mau mengubahnya, pakai *Find & Replace in Files*
  di VS Code supaya semua halaman ikut berubah.
- **Warna** diatur di bagian paling atas `assets/css/style.css` (`--primary`, `--sage`, dll).

### Menambah atau mengganti foto

1. Ubah foto ke format **WebP** dengan lebar maksimal sekitar 1200 px (misalnya lewat [squoosh.app](https://squoosh.app)).
2. Simpan ke `assets/img/`.
3. Di HTML, salin satu blok foto yang sudah ada lalu ganti `src`, `width`, `height`, dan `alt` (deskripsi foto).
   Untuk foto galeri, atribut `data-full` juga harus diisi path foto yang sama.
   Kalau fotonya tidak punya versi kecil `-640.webp`, hapus saja atribut `srcset` dan `sizes`.

### Menambah video YouTube

Salin satu blok `<button class="yt" data-id="...">`, lalu ganti `data-id` dengan ID video
(bagian setelah `youtu.be/`) dan ganti juga alamat thumbnail `i.ytimg.com/vi/ID/hqdefault.jpg`.
Video baru dimuat saat diklik, jadi halaman tetap ringan.

## Fitur

- Menu melayang yang mengecil saat di-scroll. Di HP jadi menu hamburger dengan dropdown yang membuka halus.
- Slider foto bisa digeser di HP, di-drag pakai mouse, atau pakai tombol panah.
- Klik foto galeri untuk membukanya di popup besar (bisa digeser, pakai tombol panah, tombol Esc untuk menutup).
- Animasi muncul halus saat di-scroll (otomatis mati kalau perangkat diatur untuk mengurangi animasi).
- Foto WebP dengan lazy-load, plus versi kecil khusus untuk HP.
- Judul tab, deskripsi untuk Google, dan teks alternatif (alt) foto sudah diisi di setiap halaman.
