// Media V32.9: simpan hanya URL (bukan Base64) dalam catalog_state.
export const MAX_PRODUCT_PHOTOS = 5;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_COMPRESSED_BYTES = 2 * 1024 * 1024;

export function normalizePhotos(images, fallback = '', max = MAX_PRODUCT_PHOTOS) {
  const raw = Array.isArray(images) ? images : [];
  const out = [];
  for (const value of [...raw, fallback]) {
    const url = String(value ?? '').trim();
    if (!url || out.includes(url)) continue;
    try { if (new URL(url).protocol !== 'https:') continue; } catch { continue; }
    out.push(url);
    if (out.length >= max) break;
  }
  return out;
}

export function readPhotoField(form, name, fallback = '', max = MAX_PRODUCT_PHOTOS) {
  const raw = String(form.get(name) || '[]');
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('Daftar foto tidak valid. Muat ulang editor.'); }
  if (!Array.isArray(parsed) || parsed.length > max || parsed.some(x => typeof x !== 'string' || x.length > 2048)) {
    throw new Error('Daftar foto melebihi batas atau tidak valid.');
  }
  return normalizePhotos(parsed, '', max);
}

export function photoForProduct(product) {
  return normalizePhotos(product?.images, product?.image);
}

// Kompres otomatis di browser; file asli tidak dikirim ke database Supabase.
export async function compressPhoto(file) {
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) {
    throw new Error('Foto harus JPG, PNG, atau WEBP.');
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Foto awal maksimal 5 MB.');
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Browser tidak dapat memproses foto.');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const toBlob = (type, quality) => new Promise(resolve => canvas.toBlob(resolve, type, quality));
    let blob = await toBlob('image/webp', .8);
    let extension = 'webp';
    if (!blob || blob.type !== 'image/webp') { blob = await toBlob('image/jpeg', .76); extension = 'jpg'; }
    if (!blob || blob.size > MAX_COMPRESSED_BYTES) {
      blob = await toBlob(extension === 'webp' ? 'image/webp' : 'image/jpeg', .58);
    }
    if (!blob || blob.size > MAX_COMPRESSED_BYTES) throw new Error('Foto masih terlalu besar. Coba gambar lebih kecil.');
    return {blob, extension};
  } finally { image.close?.(); }
}
