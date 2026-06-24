# Retail POS — Sistem Manajemen Toko Retail

Sistem manajemen transaksi, stok, produk, dan promo untuk toko retail multi-counter.
Dibangun dengan **Next.js 14 (App Router) + TypeScript + MongoDB (Mongoose) + TailwindCSS**.

---

## ⚠️ Catatan Penting Sebelum Mulai

Project ini ditulis lengkap (semua source code) namun **belum pernah dijalankan/di-test**
secara langsung, karena dibuat di environment tanpa akses internet (tidak bisa `npm install`).
Setelah kamu install dependencies di komputer/server sendiri, kemungkinan ada error kecil
(versi package, typo minor) yang perlu diperbaiki. Beri tahu saya errornya dan saya bantu perbaiki.

---

## 🚀 Setup Awal

### 1. Prasyarat
- Node.js 18+ dan npm
- MongoDB (local install, atau gunakan MongoDB Atlas gratis)

### 2. Install dependencies
```bash
npm install
```

### 3. Konfigurasi environment
```bash
cp .env.example .env.local
```
Edit `.env.local`:
```
MONGODB_URI=mongodb://localhost:27017/retail-pos
NEXTAUTH_SECRET=<generate dengan: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
```

### 4. Jalankan MongoDB lokal (jika belum punya)
```bash
# macOS (via Homebrew)
brew services start mongodb-community

# atau via Docker
docker run -d -p 27017:27017 --name retail-mongo mongo:7
```

### 5. Seed data awal (user admin + produk contoh)
```bash
npm run seed
```
Setelah ini akan terbuat:

| User ID | Role | Password |
|---|---|---|
| 0000001 | Super Admin | admin123 |
| 2405004 | Supervisor | spv123 |
| 2212010 | Sales Associate | sa123 |

**Wajib ganti password ini setelah login pertama kali (lewat halaman Pengguna).**

### 6. Jalankan aplikasi
```bash
npm run dev
```
Buka http://localhost:3000 — login dengan salah satu akun di atas.

---

## Struktur Project

```
src/
├── app/
│   ├── login/                  Halaman login
│   ├── dashboard/               Semua halaman setelah login
│   │   ├── page.tsx             Dashboard utama (KPI, target, trafik)
│   │   ├── transactions/        Modul Transaksi (list, new, [id], [id]/edit)
│   │   ├── incoming/             Modul Datang Barang
│   │   ├── returns/              Modul Return Barang ke Supplier
│   │   ├── products/             Manajemen Produk
│   │   ├── promos/                Manajemen Promo (+ history)
│   │   ├── users/                  Manajemen Pengguna (super_admin only)
│   │   └── reports/
│   │       ├── stock/             Buku Stok + export Excel
│   │       └── revenue/           Analisa Omset multi-tahun
│   └── api/                     Semua API routes (REST, App Router)
├── models/                      Semua Mongoose schema
├── lib/
│   ├── mongodb.ts                Koneksi DB dengan caching
│   ├── auth.ts                    NextAuth config
│   ├── rbac.ts                     Role permission matrix
│   ├── stockService.ts              Logic mutasi stok terpusat
│   ├── transactionService.ts         Orkestrasi create/status transaksi
│   ├── importTransactions.ts          Parser CSV/Excel + grouping baris
│   └── validators/                     Zod schemas
└── components/                  Komponen UI reusable
```

---

## Role & Permission

| Role | Transaksi | Stok | Produk/Promo | Pengguna |
|---|---|---|---|---|
| Super Admin | Full | Full | Full | Full |
| Admin/Post | Full | Full | Full | - |
| SPV | Create/Edit, lihat semua | Lihat + export | Lihat | - |
| SA (Sales) | Create (transaksi sendiri) | Lihat | Lihat | - |

Login menggunakan User ID 7 digit sebagai username (bukan email).

---

## Modul yang Sudah Dibangun Penuh

- Transaksi: CRUD, multi-item per transaksi, import CSV/Excel (grouping otomatis
  berdasarkan transaction_id), ubah status (success/cancel/exchange) dengan efek
  stok otomatis, autocomplete produk + promo aktif saat input.
- Datang Barang: input manual, upload foto surat jalan, otomatis menambah stok.
- Return Barang: input manual, upload foto surat jalan, otomatis mengurangi stok.
- Produk: CRUD, soft-delete (discontinued).
- Promo: CRUD dengan riwayat perubahan (history), status aktif/upcoming/expired
  dihitung otomatis dari startDate/endDate (tidak disimpan sebagai field).
- Pengguna: CRUD dengan role & counter assignment (super_admin only).
- Buku Stok: kartu stok lengkap (mutasi masuk/keluar/saldo), export ke Excel
  dengan styling.
- Analisa Omset: perbandingan omset bulanan antar tahun, dengan grafik dan target.
- Dashboard: omset bulan ini, growth vs bulan lalu, target & achievement toko +
  per-SA, trafik harian (grafik), ringkasan stok.

---

## Format Import CSV/Excel Transaksi

Download template di halaman Transaksi, tombol Template CSV. Kolom yang didukung
(case-insensitive, beberapa alias diterima, lihat src/lib/importTransactions.ts):

```
transaction_id, date, counter_id, bon_number, product_id, product_description,
qty, normal_price, promo_description, promo_value, final_price,
sale_by_user_id, post_by_user_id, spv_id, status, notes
```

Baris dengan transaction_id yang sama akan digabung menjadi satu transaksi dengan
banyak item. Jika transaction_id dikosongkan, baris dikelompokkan berdasarkan
kombinasi date + counter_id + bon_number.

---

## Catatan Desain Database

- Datang Barang dan Return Barang adalah collection terpisah (StockIncoming,
  StockReturn), masing-masing punya field upload foto surat jalan.
- Stock menyimpan saldo terkini per produk per counter.
- StockLedger adalah buku stok (append-only), setiap mutasi (datang, return,
  jual, pembalikan jual) tercatat di sini dan menjadi sumber untuk export Excel.
- Promo tidak menyimpan field status, status aktif/upcoming/expired dihitung
  saat query berdasarkan startDate/endDate vs waktu sekarang, sesuai permintaan.
- Transaksi yang statusnya diubah dari success ke cancel/exchange (atau
  sebaliknya) akan otomatis memicu mutasi stok melalui transactionService.ts.

---

## Changelog Terbaru

**Perbaikan bug:**
- Fixed: form Buat Transaksi gagal submit karena field `postByUserId`/`saleByUserId`
  kosong saat session belum selesai loading (race condition). Sekarang form
  auto-sync begitu session resolve, plus validasi front-end yang menampilkan
  pesan error spesifik (field mana yang salah) bukan cuma "Validasi gagal".

**Fitur baru:**
- Halaman **Laporan Penjualan** (`/dashboard/reports/sales`) — histori detail
  per item (bukan per transaksi) + rekap per produk/SA/counter, menggunakan AG Grid.
- **Buku Stok** diubah total ke format kalender bulanan (seperti spreadsheet
  STOCK REPORT): satu baris per produk, satu kolom per tanggal, menampilkan
  qty IN (barang datang), OUT (penjualan, dengan tanda "R" untuk return),
  start/ending stock — pakai AG Grid, bisa cari produk dan ganti periode
  bulan/tahun, serta export ke Excel dengan format serupa.
- **Import CSV/Excel** ditambahkan di 5 modul: Datang Barang, Return Barang,
  Produk, Promo, dan Pengguna — masing-masing punya template CSV sendiri
  (tombol download template tersedia di tiap modal import).

**Catatan teknis:**
- AG Grid (`ag-grid-community` + `ag-grid-react`) ditambahkan sebagai dependency
  untuk semua tabel data-besar (Laporan Penjualan, Buku Stok). Menggunakan
  Theming API (v32+) dengan tema kustom mengikuti warna brand aplikasi.
- `StockLedger` sekarang menyimpan `deliveryNoteNumber` di setiap entry —
  baik dari surat jalan datang/return barang, maupun nomor bon transaksi
  penjualan — sehingga Buku Stok bisa menampilkan keterangan referensi
  di kolom kanan / tooltip sel.
- Import untuk Datang Barang & Return Barang mendukung pengelompokan baris
  jadi satu dokumen multi-item (sama seperti import Transaksi), tapi
  **tidak mendukung upload foto surat jalan via import** — foto harus
  ditambahkan manual lewat form edit setelah data masuk.

---



1. Testing menyeluruh setelah npm install di environment kamu sendiri.
2. Cloud storage untuk foto surat jalan (saat ini disimpan di public/uploads
   lokal di server, tidak ideal untuk deployment serverless seperti Vercel).
3. Halaman kelola Target (SalesTarget sudah ada modelnya dan dipakai di
   dashboard, tapi belum ada UI untuk admin meng-input target bulanan).
4. Audit log lebih lengkap untuk transaksi (siapa yang edit, kapan).
5. Rate limiting dan validasi keamanan tambahan sebelum production.
