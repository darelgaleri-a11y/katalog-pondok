// Token checkout harus UUID v4; Postgres memvalidasi p_order.checkout_token sebagai uuid.
// crypto.randomUUID hanya tersedia di secure context (HTTPS / localhost).
// crypto.getRandomValues tersedia di banyak browser termasuk HTTP jaringan lokal.
// Tidak boleh fallback ke Math.random karena kode akses juga dipakai untuk pelacakan pesanan.
const uuidV4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCheckoutTokenUuid(token) {
  return typeof token==='string' && uuidV4.test(token);
}

export function createCheckoutToken(cryptoApi=globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID==='function') {
    const uuid=cryptoApi.randomUUID();
    if (isCheckoutTokenUuid(uuid)) return uuid;
  }
  if (typeof cryptoApi?.getRandomValues!=='function') {
    throw new Error('Browser tidak mendukung pembuatan kode pesanan yang aman. Gunakan Chrome atau Firefox terbaru, atau buka alamat HTTPS.');
  }
  const bytes=new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  // RFC 4122 UUID v4: version 4 dan variant 10.
  bytes[6]=(bytes[6]&15)|64;
  bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export function getOrCreateCheckoutToken(previousToken,cryptoApi=globalThis.crypto) {
  return isCheckoutTokenUuid(previousToken)?previousToken:createCheckoutToken(cryptoApi);
}
