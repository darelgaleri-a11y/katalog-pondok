import fs from 'node:fs';

const file = 'src/main.jsx';
if (!fs.existsSync(file)) {
  console.error('src/main.jsx tidak ditemukan. Jalankan script dari folder utama proyek.');
  process.exit(1);
}

let source = fs.readFileSync(file, 'utf8');
const fieldPattern = /<label\b[^>]*>[\s\S]*?Nama pemesan[\s\S]*?<input\b(?=[^>]*\bname=["']name["'])[^>]*\/?>[\s\S]*?<\/label>/g;
const matches = [...source.matchAll(fieldPattern)];

if (matches.length > 1) {
  console.error('Ditemukan lebih dari satu field Nama pemesan. Tidak ada file yang diubah.');
  process.exit(1);
}

if (matches.length === 1) {
  const match = matches[0];
  const before = source.slice(Math.max(0, match.index - 220), match.index);
  const isAlreadyGeneralOnly = /mode\s*===\s*['"]general['"]\s*&&\s*\{?\s*$/.test(before);
  if (!isAlreadyGeneralOnly) {
    const original = match[0];
    source = source.slice(0, match.index) +
      `{mode==='general'&&${original}}` +
      source.slice(match.index + original.length);
    console.log('Field Nama pemesan dibatasi hanya untuk Belanja Umum.');
  } else {
    console.log('Field Nama pemesan sudah dibatasi hanya untuk Belanja Umum.');
  }
} else {
  console.log('Field Nama pemesan tidak ditemukan; tidak ada field baru yang ditambahkan.');
}

const oldPrivacy = '<p>Nama pemesan dipakai untuk mencatat serta menindaklanjuti pesanan. Nomor WhatsApp pemesan tidak diminta oleh katalog; kasir dapat melihat nomor pengirim setelah pesan dikirim lewat WhatsApp. Pada Belanja Umum, alamat dan nama penerima dipakai untuk pengiriman dan diberikan kepada kasir toko terkait. Untuk kiriman santri, nama santri, kamar/kelas, tujuan putra/putri, dan tanggal penyerahan juga dipakai agar kiriman sampai kepada penerima yang tepat.</p>';
const newPrivacy = `<p>{mode==='general'?'Nama pemesan dipakai untuk mencatat serta menindaklanjuti pesanan. Nomor WhatsApp pemesan tidak diminta oleh katalog; kasir dapat melihat nomor pengirim setelah pesan dikirim lewat WhatsApp. Alamat dan nama penerima dipakai untuk pengiriman dan diberikan kepada kasir toko terkait.':'Untuk kiriman santri, nama pemesan tidak diperlukan. Nama santri, kamar/kelas, tujuan putra/putri, dan tanggal penyerahan dipakai agar kiriman sampai kepada penerima yang tepat.'}</p>`;

if (source.includes(oldPrivacy)) {
  source = source.replace(oldPrivacy, newPrivacy);
  console.log('Keterangan privasi diperbarui sesuai jenis pesanan.');
} else if (!source.includes('Untuk kiriman santri, nama pemesan tidak diperlukan.')) {
  console.warn('Teks privasi berbeda dari versi yang diaudit; bagian privasi tidak diubah.');
}

fs.writeFileSync(file, source, 'utf8');
console.log('Selesai. File yang diubah: src/main.jsx');
