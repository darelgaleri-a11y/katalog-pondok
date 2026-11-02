import React from 'react';
import {MapPin,Truck} from 'lucide-react';

// Dipasang hanya untuk mode belanja umum; kiriman santri tidak meminta alamat rumah.
export default function GeneralShippingFields() {
  return <fieldset className="generalShippingFields">
    <legend><MapPin size={20} aria-hidden="true"/> Alamat Pengiriman</legend>
    <p className="muted">Barang akan dikirim ke alamat ini. Pastikan nama penerima dan alamat benar.</p>
    <label>Nama penerima barang<input name="shipping_recipient" required maxLength={150} autoComplete="name" placeholder="Nama orang yang menerima paket"/></label>
    <label>Alamat lengkap<input name="shipping_address" required maxLength={500} autoComplete="street-address" placeholder="Jalan, nomor rumah, RT/RW"/></label>
    <label>Kelurahan / Desa dan Kecamatan<input name="shipping_area" required maxLength={180} placeholder="Contoh: Menteng, Jekan Raya"/></label>
    <label>Kota / Kabupaten<input name="shipping_city" required maxLength={120} autoComplete="address-level2" placeholder="Contoh: Palangka Raya"/></label>
    <label>Patokan rumah (tidak wajib)<input name="shipping_landmark" maxLength={200} placeholder="Contoh: Samping masjid"/></label>
    <div className="shippingFeeNotice"><Truck size={21} aria-hidden="true"/><p><b>Ongkos kirim belum termasuk.</b> Kasir akan mengonfirmasi biaya kirim dan total akhir sebelum pembayaran.</p></div>
  </fieldset>;
}
