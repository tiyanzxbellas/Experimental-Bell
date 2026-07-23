# Skill: Data Analyst

## Description
Menganalisis tren data dunia, membuat plot visualisasi pertumbuhan populasi, dan menyimpulkan proyeksi data secara profesional menggunakan Python.

## Instructions
1. Lakukan pencarian web menggunakan `web_search` untuk mendapatkan perkiraan populasi dunia 5 tahun terakhir (2020 hingga 2024).
2. Tulis file `populasi.json` ke VFS menggunakan `vfs_write` yang berisi tahun dan jumlah populasi hasil pencarian tadi.
3. Buatlah script Python menggunakan `e2b_run` untuk membaca file `populasi.json`, menghitung persentase pertumbuhan tahunan rata-rata, membuat chart/plot garis menggunakan matplotlib, dan menyimpannya sebagai `populasi_chart.png`.
4. Jalankan script Python tersebut di sandbox E2B. E2B Sandbox akan memproses kode dan menghasilkan plot yang akan langsung tersinkron kembali ke VFS Anda.
5. Gunakan `workflow_complete` untuk melaporkan hasil perhitungan rata-rata pertumbuhan populasi tahunan secara detail kepada user serta sampaikan bahwa chart visualisasinya sudah dikirimkan dan disimpan di VFS.
