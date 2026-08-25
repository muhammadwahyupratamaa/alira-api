# PRD — Personal Finance Tracker

**Working Title:** *(belum ditentukan)*  
**Author:** Muhammad Wahyu Pratama  
**Tanggal:** 25 Agustus 2026  
**Status:** Draft v0.3 — Revised MVP

---

## 1. Ringkasan Produk

Personal Finance Tracker adalah aplikasi web untuk mencatat pemasukan dan pengeluaran, memantau saldo beberapa akun/dompet, serta memahami pola keuangan bulanan dengan cepat.

Produk dibuat pertama-tama untuk kebutuhan pribadi sebagai alat membangun disiplin finansial. Jika terbukti berguna dan konsisten dipakai, produk dapat dikembangkan menjadi aplikasi publik untuk anak muda atau pekerja awal karier.

Nilai utama:

- Pencatatan transaksi dalam waktu kurang dari 10 detik
- Saldo aktual per akun dan total saldo terlihat dengan jelas
- Ringkasan bulanan mudah dipahami tanpa membaca tabel mentah
- Fondasi keamanan dan integritas data yang matang untuk data finansial personal

## 2. Latar Belakang & Masalah

Saat ini belum ada sistem pencatatan keuangan pribadi yang konsisten, sehingga pemasukan, pengeluaran, saldo aktual, dan sisa uang yang dapat ditabung sulit dilacak.

### Masalah Utama

- Tidak ada catatan konsisten mengenai ke mana uang pergi setiap bulan
- Uang tersebar di cash, bank, dan e-wallet sehingga total saldo sulit dipantau
- Tidak ada peringatan dini ketika pengeluaran mulai berlebihan
- Tidak ada gambaran jelas mengenai jumlah yang benar-benar dapat ditabung
- Proses pencatatan yang panjang membuat kebiasaan mencatat mudah terhenti

### Masalah Lanjutan

Masalah berikut tetap penting, tetapi diselesaikan setelah MVP stabil:

- Budget per kategori
- Tagihan rutin
- Cicilan dan hutang
- Target tabungan

### Non-Goals

- Bukan aplikasi investasi atau trading
- Bukan aplikasi akuntansi bisnis
- Bukan aplikasi budgeting kompleks pada fase awal
- Belum terhubung langsung ke rekening bank atau e-wallet
- Belum menyediakan aplikasi mobile native

## 3. Tujuan Produk

- Mencatat pemasukan dan pengeluaran secara cepat dan konsisten
- Menampilkan saldo aktual per account dan total saldo
- Memberikan visibilitas terhadap income, expense, dan net saving bulanan
- Membantu memahami kategori pengeluaran terbesar
- Membangun kebiasaan pencatatan melalui UX minim friction
- Menjadi portfolio full-stack yang menunjukkan security, database design, testing, deployment, dan CI/CD

## 4. Target Pengguna

### Fase 1 — MVP

Single-user secara penggunaan: Muhammad Wahyu Pratama sebagai pengguna utama.

Arsitektur tetap multi-user-ready. Setiap data mempunyai `userId`, kepemilikan data divalidasi, dan aplikasi tidak perlu dirombak apabila dipublikasikan.

### Fase Selanjutnya

Anak muda atau pekerja awal karier yang ingin mengelola keuangan pribadi tanpa kerumitan aplikasi budgeting profesional.

## 5. Prinsip Produk

- **Fast first:** transaksi dapat dicatat dalam kurang dari 10 detik
- **Accurate:** nominal dan saldo tidak boleh mengalami kesalahan pembulatan
- **Simple:** dashboard dapat dipahami dalam beberapa detik
- **Private:** data pengguna tidak dapat diakses pengguna lain
- **Progressive:** fitur kompleks ditambahkan setelah alur utama stabil
- **Mobile-first:** pengalaman pencatatan di ponsel menjadi prioritas

## 6. Ruang Lingkup

### Fase 1 — MVP

- Register, login, refresh session, dan logout
- Kategori default dan kategori custom
- Account sederhana: cash, bank, dan e-wallet
- Saldo awal setiap account
- CRUD transaksi income dan expense
- Quick Add Transaction
- History dengan search, filter, sorting, dan pagination
- Dashboard bulanan
- Saldo per account dan total saldo
- Perbandingan sederhana dengan bulan sebelumnya
- Profil/settings dasar
- Responsive web
- Automated testing untuk alur kritis
- Docker, GitHub Actions, dan deployment VPS

### Fase 2

- Budget per kategori dan notifikasi limit
- Recurring transaction
- Transfer antar-account
- Target tabungan
- Debt/cicilan tracker
- Export CSV dan PDF
- Financial health indicator
- Insight berbasis perhitungan tanpa AI

### Fase 3

- Upload bukti transaksi dan OCR
- Analytics lanjutan
- Prediksi pengeluaran dan anomaly detection sederhana
- Multi-currency
- 2FA, audit log, dan encryption at rest
- Pengembangan menjadi produk multi-user publik

## 7. User Flow — Fase 1

### 7.1 Registrasi & Login

1. User mengisi email dan password
2. Sistem memvalidasi input dan menyimpan password dalam bentuk hash
3. Setelah login, sistem menerbitkan access token dan refresh token
4. Refresh token disimpan sebagai hash di database dan dikirim melalui cookie aman
5. User diarahkan ke onboarding account jika belum mempunyai account
6. Jika account sudah tersedia, user diarahkan ke Dashboard

### 7.2 Onboarding Account

1. User memilih tipe account: cash, bank, atau e-wallet
2. User mengisi nama account dan saldo awal
3. Sistem membuat account pertama
4. User dapat menambah account lain atau menuju Dashboard

### 7.3 Quick Add Transaction

1. User menekan tombol tambah dari Dashboard atau navigasi mobile
2. User mengisi nominal
3. User memilih tipe transaksi, account, dan kategori
4. Tanggal default hari ini dan dapat diubah
5. Catatan bersifat opsional
6. Setelah disimpan, saldo dan dashboard diperbarui tanpa reload manual

### 7.4 Riwayat Transaksi

1. User membuka halaman Transactions
2. User dapat mencari catatan transaksi
3. User dapat memfilter berdasarkan tanggal, account, kategori, dan tipe
4. User dapat mengedit, menduplikasi, atau menghapus transaksi
5. Setelah penghapusan, sistem menyediakan Undo dalam waktu singkat

### 7.5 Dashboard

1. Sistem menampilkan total saldo seluruh account
2. Sistem menampilkan income, expense, dan net saving bulan berjalan
3. Sistem menampilkan breakdown expense per kategori
4. Sistem menampilkan perbandingan dengan bulan sebelumnya
5. Sistem menampilkan lima transaksi terbaru
6. User dapat membuka transaksi berdasarkan account atau kategori

## 8. Screens

| Screen | Fungsi Utama |
| --- | --- |
| Login / Register | Autentikasi |
| Account Onboarding | Membuat account pertama dan saldo awal |
| Dashboard | Saldo, summary, chart, dan transaksi terbaru |
| Transactions | History, search, filter, pagination, dan CRUD |
| Quick Add | Input transaksi dengan friction minimal |
| Accounts | Melihat saldo dan mengelola account |
| Categories | Mengelola kategori custom |
| Profile / Settings | Password, preferensi, dan logout |

## 9. Acceptance Criteria

### 9.1 Authentication

- [ ] Email valid dan unik
- [ ] Password minimal 8 karakter serta mengandung huruf dan angka
- [ ] Password tidak pernah disimpan atau dikembalikan dalam plain text
- [ ] Access token aktif sekitar 15 menit
- [ ] Refresh token aktif sekitar 7 hari
- [ ] Refresh token disimpan sebagai hash dan dirotasi setiap digunakan
- [ ] Logout mencabut refresh session
- [ ] Login, register, dan refresh terkena rate limiting

### 9.2 Account

- [ ] User dapat membuat account CASH, BANK, atau EWALLET
- [ ] Nama wajib dan saldo awal dapat bernilai nol atau lebih
- [ ] Saldo dihitung dari saldo awal + income - expense
- [ ] User hanya dapat mengakses account miliknya
- [ ] Account yang memiliki transaksi dinonaktifkan, bukan dihapus permanen
- [ ] Minimal satu account aktif tersedia untuk mencatat transaksi

### 9.3 Category

- [ ] Sistem menyediakan kategori default INCOME dan EXPENSE
- [ ] Kategori default tidak dapat diedit atau dihapus user
- [ ] User dapat membuat kategori custom
- [ ] Nama custom unik berdasarkan user, tipe, dan nama
- [ ] Kategori yang pernah digunakan dinonaktifkan, bukan hard delete
- [ ] Kategori nonaktif tetap tampil pada riwayat lama
- [ ] Kategori INCOME hanya untuk transaksi INCOME, begitu juga EXPENSE

### 9.4 Transaction

- [ ] Nominal lebih besar dari nol
- [ ] Tipe wajib INCOME atau EXPENSE
- [ ] Account dan kategori wajib dipilih dan masih aktif
- [ ] Tipe transaksi harus sama dengan tipe kategori
- [ ] Tanggal default hari ini dan dapat diubah ke masa lalu
- [ ] Transaksi masa depan ditolak pada MVP
- [ ] Catatan opsional dengan batas panjang
- [ ] Saldo dan dashboard diperbarui setelah create, update, delete, atau restore
- [ ] User dapat menduplikasi transaksi lama
- [ ] Delete menggunakan soft delete agar mendukung Undo

### 9.5 History, Search & Filter

- [ ] Search mencocokkan catatan transaksi
- [ ] Filter tersedia untuk tanggal, account, kategori, dan tipe
- [ ] Beberapa filter dapat digunakan bersamaan
- [ ] Pagination dilakukan backend
- [ ] Urutan default: tanggal transaksi terbaru, lalu waktu pembuatan terbaru
- [ ] Filter disimpan di URL query

### 9.6 Dashboard

- [ ] Menampilkan total saldo seluruh account aktif
- [ ] Menampilkan saldo masing-masing account
- [ ] Menampilkan monthly income, expense, dan net saving
- [ ] Menampilkan breakdown expense per kategori
- [ ] Menampilkan perbandingan dengan bulan sebelumnya
- [ ] Menampilkan lima transaksi terbaru
- [ ] Tidak ada data finansial yang di-hardcode
- [ ] Empty state tersedia

## 10. Business Rules

### Perhitungan

```text
accountBalance = initialBalance + totalIncome - totalExpense
totalBalance   = jumlah saldo seluruh account aktif
netSaving      = monthlyIncome - monthlyExpense
```

Saving rate baru ditampilkan pada Fase 2:

```text
savingRate = (monthlyIncome - monthlyExpense) / monthlyIncome × 100%
```

Jika monthly income nol, saving rate tidak dihitung.

### Tanggal

- Timestamp disimpan dalam UTC
- Timezone default `Asia/Jakarta`
- Batas awal dan akhir bulan dihitung berdasarkan timezone user
- `transactionDate` adalah tanggal finansial yang dipilih user

### Nominal

- Gunakan Prisma `Decimal` / PostgreSQL `NUMERIC`, bukan Float
- API mengirim nominal sebagai string agar presisi tidak hilang
- Frontend memformat nominal ke Rupiah hanya untuk tampilan
- Currency MVP hanya IDR

## 11. Non-Functional Requirements

### Security

- Password di-hash dengan bcrypt, salt rounds minimal 10
- Access token short-lived
- Refresh token di-hash, dapat dicabut, dan dirotasi
- Refresh token dikirim melalui cookie `httpOnly`, `secure`, dan `sameSite` yang sesuai
- Global Validation Pipe menggunakan whitelist dan menolak properti tidak dikenal
- Helmet, HTTPS production, dan CORS whitelist eksplisit
- Secret disimpan melalui environment variables
- Data sensitif tidak ditulis ke log
- Semua query privat dibatasi menggunakan `userId` dari token
- `userId` dari body atau query tidak dipercaya untuk otorisasi
- Production error tidak membocorkan stack trace

### Data Integrity

- Nominal menggunakan Decimal/NUMERIC
- Validasi aplikasi diperkuat database constraint
- Operasi multi-record menggunakan database transaction
- Unique constraint dan foreign key diterapkan
- Entity yang masih direferensikan menggunakan soft delete/nonaktif
- Dashboard dihitung dari sumber transaksi, bukan saldo mutable terpisah

### Performance & Reliability

- Target response CRUD standar kurang dari 300 ms pada skala MVP
- Pagination wajib untuk daftar transaksi
- Index: `userId`, `transactionDate`, `accountId`, `categoryId`, `type`, `deletedAt`
- Dashboard menggunakan database aggregation
- Hindari N+1 query
- Health check tersedia
- Logging terstruktur tanpa data sensitif
- Error handling konsisten melalui global exception filter
- Migration dijalankan secara terkontrol
- Backup database disiapkan setelah production aktif

### Usability & Accessibility

- Input transaksi selesai kurang dari 10 detik
- Mobile-first responsive layout
- Form dapat digunakan dengan keyboard
- Loading, empty, success, dan error state tersedia
- Konfirmasi digunakan untuk aksi berisiko
- Warna bukan satu-satunya indikator income/expense
- Elemen interaktif memiliki label jelas

## 12. Tech Stack

| Layer | Pilihan | Catatan |
| --- | --- | --- |
| Backend | NestJS | Module, Guard, Pipe, Interceptor, Exception Filter |
| Bahasa | TypeScript | Backend dan frontend |
| Database | PostgreSQL | Constraint dan aggregation kuat |
| ORM | Prisma | Decimal untuk seluruh nominal |
| Frontend | React + Vite | SPA terpisah dari REST API |
| Styling | Tailwind CSS | Mobile-first |
| Data Fetching | TanStack Query | Cache dan mutation invalidation |
| Form | React Hook Form | Form management |
| Frontend Validation | Zod | Schema validation |
| Chart | Chart.js | Visualisasi dashboard |
| Auth | JWT + rotating refresh token | Refresh melalui secure httpOnly cookie |
| Backend Test | Jest + Supertest | Unit dan e2e |
| Frontend Test | Vitest + React Testing Library | Component dan interaction |
| API Docs | Swagger / OpenAPI | Dokumentasi endpoint |
| Deployment | Docker + GitHub Actions + VPS | Automated test dan deploy |

## 13. Data Model — MVP

### User

```text
id            UUID PK
email         String UNIQUE
passwordHash  String
currency      String DEFAULT "IDR"
timezone      String DEFAULT "Asia/Jakarta"
createdAt     DateTime
updatedAt     DateTime
```

### RefreshSession

```text
id          UUID PK
userId      UUID FK -> User
tokenHash   String
expiresAt   DateTime
revokedAt   DateTime nullable
userAgent   String nullable
createdAt   DateTime
```

### Account

```text
id              UUID PK
userId          UUID FK -> User
name            String
type            Enum: CASH | BANK | EWALLET
initialBalance  Decimal
isActive        Boolean DEFAULT true
createdAt       DateTime
updatedAt       DateTime
```

### Category

```text
id         UUID PK
userId     UUID nullable FK -> User
name       String
type       Enum: INCOME | EXPENSE
icon       String nullable
color      String nullable
isDefault  Boolean DEFAULT false
isActive   Boolean DEFAULT true
createdAt  DateTime
updatedAt  DateTime
```

`userId = null` digunakan untuk kategori default sistem. Kategori custom selalu memiliki `userId`.

### Transaction

```text
id               UUID PK
userId           UUID FK -> User
accountId        UUID FK -> Account
categoryId       UUID FK -> Category
type             Enum: INCOME | EXPENSE
amount           Decimal
transactionDate  DateTime
note             String nullable
createdAt        DateTime
updatedAt        DateTime
deletedAt        DateTime nullable
```

### Relasi

- User memiliki banyak RefreshSession, Account, Category custom, dan Transaction
- Account memiliki banyak Transaction
- Category memiliki banyak Transaction

## 14. Data Model — Fase Lanjutan

```text
Budget: id, userId, categoryId, month, year, monthlyLimit
Goal: id, userId, name, targetAmount, currentAmount, deadline, status
Debt: id, userId, name, totalAmount, remainingAmount, dueDate, installmentAmount, status
RecurringTransaction: id, userId, accountId, categoryId, type, amount, frequency, nextRunAt, isActive
Attachment: id, transactionId, fileUrl, mimeType, extractedData, createdAt
```

## 15. API Endpoint — Fase 1

### Auth

```http
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/logout-all
GET    /auth/me
```

### Accounts

```http
GET    /accounts
POST   /accounts
GET    /accounts/:id
PATCH  /accounts/:id
DELETE /accounts/:id
```

`DELETE /accounts/:id` menonaktifkan account jika telah memiliki transaksi.

### Categories

```http
GET    /categories?type=&includeInactive=
POST   /categories
PATCH  /categories/:id
DELETE /categories/:id
```

Kategori default tidak dapat diubah. Kategori custom yang sudah direferensikan dinonaktifkan.

### Transactions

```http
GET    /transactions?startDate=&endDate=&accountId=&categoryId=&type=&search=&page=&limit=&sort=
POST   /transactions
GET    /transactions/:id
PATCH  /transactions/:id
POST   /transactions/:id/duplicate
DELETE /transactions/:id
POST   /transactions/:id/restore
```

### Dashboard

```http
GET    /dashboard/summary?month=&year=&accountId=
GET    /dashboard/category-breakdown?month=&year=&type=EXPENSE
GET    /dashboard/recent-transactions?limit=5
```

### Profile & System

```http
GET    /profile
PATCH  /profile/preferences
PATCH  /profile/password
GET    /health
GET    /docs
```

Semua endpoint selain auth publik, health, dan docs wajib melalui JWT Guard. Query selalu dibatasi dengan `userId` dari token.

## 16. Dashboard Specification

### Summary Cards

- Total Balance
- Monthly Income
- Monthly Expense
- Net Saving

### Visualisasi

- Doughnut chart expense berdasarkan kategori
- Bar atau line chart income dan expense per periode
- Perbandingan persentase dengan bulan sebelumnya

### Account Overview

- Nama dan tipe account
- Saldo berjalan
- Status aktif/nonaktif

### Recent Transactions

- Maksimal lima transaksi terbaru
- Nominal, kategori, account, tanggal, dan catatan
- Tombol cepat edit dan duplicate

Jika belum ada transaksi, tampilkan panduan singkat dan tombol Quick Add.

## 17. UX Quick Add

Input inti:

1. Nominal
2. INCOME atau EXPENSE
3. Account
4. Category
5. Tanggal, default hari ini
6. Catatan opsional

Optimasi:

- Fokus awal langsung ke nominal
- Mengingat account dan kategori terakhir
- Mendukung submit dengan keyboard
- Floating action button pada mobile
- Toast sukses dengan tombol Undo
- Gunakan modal atau bottom sheet agar user tidak perlu berpindah halaman

## 18. Testing Strategy

### Backend Unit

- Perhitungan saldo
- Validasi nominal dan kecocokan tipe kategori
- Auth token rotation
- Ownership authorization

### Backend E2E

- Register → login → refresh → logout
- Membuat account dengan saldo awal
- CRUD kategori custom dan transaksi
- User A tidak dapat mengakses data User B
- Soft delete dan restore
- Filter dan pagination
- Akurasi dashboard aggregation

### Frontend

- Validasi form
- Loading, error, empty, dan success state
- Quick Add interaction
- Filter transaksi
- Dashboard berdasarkan API response

### Manual Acceptance

- Alur nyaman digunakan pada mobile dan desktop
- Input transaksi selesai kurang dari 10 detik
- Saldo akurat setelah create, update, delete, dan restore

## 19. Risiko & Mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Saldo tidak sesuai kondisi nyata | Account dan initial balance masuk MVP |
| Kesalahan pembulatan | Decimal/NUMERIC dan nominal API sebagai string |
| Tipe kategori tidak konsisten | Validasi service dan database |
| Account/kategori masih direferensikan | Nonaktifkan, jangan hard delete |
| IDOR | Scope seluruh query dengan userId dari token |
| Refresh token dicuri | Hash, rotation, revocation, expiry, secure cookie |
| Kehilangan motivasi mencatat | Quick Add, default value, last-used input, mobile-first |
| Stack baru memperlambat progress | Kerjakan per modul dan vertical slice |
| Scope membengkak | Kunci backlog Fase 2/3 |
| Dashboard melambat | Aggregation, index, pagination, hindari N+1 |

## 20. Definition of Done — MVP

- [ ] Register, login, refresh session, dan logout aman
- [ ] Account dengan saldo awal dapat dikelola
- [ ] Kategori default dan custom berfungsi
- [ ] CRUD, duplicate, soft delete, dan restore transaksi berfungsi
- [ ] Quick Add dapat digunakan kurang dari 10 detik
- [ ] Saldo per account dan total saldo akurat
- [ ] Dashboard menampilkan summary, chart, perbandingan, dan transaksi terbaru
- [ ] History dapat dicari, difilter, diurutkan, dan dipaginate
- [ ] Seluruh endpoint privat memvalidasi kepemilikan
- [ ] Automated test mencakup bisnis dan security kritis
- [ ] Swagger/OpenAPI tersedia
- [ ] Responsive pada mobile dan desktop
- [ ] Docker production build berhasil
- [ ] CI menjalankan lint dan test
- [ ] Deployment VPS melalui GitHub Actions berhasil

## 21. Roadmap

1. **Foundation:** NestJS, React, PostgreSQL, Prisma, Docker, environment, CI
2. **Authentication:** JWT, rotating refresh session, Guard, profile
3. **Finance Core:** category, account, initial balance, transaction, ownership
4. **Product Experience:** Quick Add, history, filter, pagination, responsive UI
5. **Dashboard:** aggregation, breakdown, comparison, account overview
6. **Quality & Release:** testing, security review, Swagger, Docker, CI/CD, VPS
7. **Fase 2:** budgeting, recurring transaction, transfer, goals, debt, export

## 22. Metrik Keberhasilan

### Product

- Transaksi dicatat dalam kurang dari 10 detik
- Pengguna mencatat transaksi beberapa kali per minggu
- Tidak ada jeda pencatatan lebih dari tiga hari selama evaluasi
- Saldo aplikasi sesuai saldo aktual
- Dashboard digunakan untuk evaluasi bulanan

### Technical

- Tidak ada endpoint privat yang dapat mengakses data user lain
- Seluruh test kritis lulus di CI
- CRUD standar memenuhi target kurang dari 300 ms pada skala MVP
- Tidak ada Float untuk data nominal
- Deployment repeatable melalui pipeline

## 23. Keputusan Produk & Teknis

- Backend: NestJS + TypeScript
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Database: PostgreSQL
- ORM: Prisma
- Currency MVP: IDR
- Timezone default: Asia/Jakarta
- Arsitektur multi-user-ready, penggunaan awal personal
- Account sederhana dan saldo awal masuk MVP
- Quick Add menjadi fitur utama MVP
- Saldo dihitung dari initial balance dan transaksi, bukan saldo mutable
- Transfer, budget, goal, debt tracker, OCR, dan multi-currency tetap fase lanjutan

## 24. Open Questions

- [ ] Nama produk final
- [ ] Monorepo atau repository frontend/backend terpisah
- [ ] Gaya visual dan design system
- [ ] Domain frontend dan subdomain API
- [ ] Durasi Undo transaksi setelah soft delete
- [ ] Prioritas pertama Fase 2: budgeting atau debt tracker