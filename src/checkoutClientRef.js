// Pengenal browser anonim untuk pembatasan checkout, bukan nomor WhatsApp.
// Browser tidak dapat membaca nomor pengirim WhatsApp secara otomatis.
import {createCheckoutToken,isCheckoutTokenUuid} from './checkoutToken.js';

const KEY='katalog-darel-client-ref-v327';

export function getOrCreateCheckoutClientRef(storage=globalThis.localStorage,cryptoApi=globalThis.crypto){
  try {
    const existing=storage.getItem(KEY);
    if(isCheckoutTokenUuid(existing))return existing;
    const fresh=createCheckoutToken(cryptoApi);
    storage.setItem(KEY,fresh);
    return fresh;
  }catch(e){
    throw new Error('Browser tidak dapat menyimpan pengenal pesanan. Izinkan penyimpanan situs atau buka dengan Chrome/Firefox biasa.');
  }
}
