// V33: normalisasi input pengiriman; ini hanya pemeriksaan UX.
// Validasi terpercaya dijalankan lagi di RPC create_checkout_v33 pada PostgreSQL.
const clean = (form, name) => String(form.get(name) ?? '').trim();

export function readGeneralShipping(form) {
  const shipping = {
    shipping_recipient: clean(form, 'shipping_recipient'),
    shipping_address: clean(form, 'shipping_address'),
    shipping_area: clean(form, 'shipping_area'),
    shipping_city: clean(form, 'shipping_city'),
    shipping_landmark: clean(form, 'shipping_landmark'),
  };
  for (const [key, label, max] of [
    ['shipping_recipient', 'Nama penerima', 150],
    ['shipping_address', 'Alamat lengkap', 500],
    ['shipping_area', 'Kelurahan / Kecamatan', 180],
    ['shipping_city', 'Kota / Kabupaten', 120],
  ]) {
    if (!shipping[key] || shipping[key].length > max) {
      throw new Error(`${label} wajib diisi (maksimal ${max} karakter).`);
    }
  }
  if (shipping.shipping_landmark.length > 200) {
    throw new Error('Patokan alamat maksimal 200 karakter.');
  }
  return shipping;
}

export function generalShippingWhatsApp(shipping) {
  return `\n*PENGIRIMAN BELANJA UMUM*\nPenerima: ${shipping.shipping_recipient}\nAlamat: ${shipping.shipping_address}\nKelurahan / Kecamatan: ${shipping.shipping_area}\nKota / Kabupaten: ${shipping.shipping_city}${shipping.shipping_landmark ? `\nPatokan: ${shipping.shipping_landmark}` : ''}\n*Ongkos kirim belum termasuk total barang; mohon dikonfirmasi kasir.*\n`;
}
