// V32.8: setiap variasi adalah produk/stok tersendiri. Kompatibel dengan
// checkout V6/V7/V32.7, pengembalian stok V7/V8 dan save_catalog_v10.
export const normalizeVariantText = value => String(value ?? '').trim().replace(/\s+/g, ' ');

export function variantDisplayName(baseName, size, color) {
  const options = [size && `Ukuran ${normalizeVariantText(size)}`, color && `Warna ${normalizeVariantText(color)}`].filter(Boolean);
  return `${normalizeVariantText(baseName)} — ${options.join(' / ')}`;
}

export function groupProducts(products) {
  const groups = [];
  const byId = new Map();
  for (const product of products) {
    const key = product.variantGroupId ? `group:${product.variantGroupId}` : `item:${product.id}`;
    if (!byId.has(key)) {
      const group = { key, representative: product, variants: [] };
      byId.set(key, group);
      groups.push(group);
    }
    byId.get(key).variants.push(product);
  }
  return groups;
}

export function validateVariants(variants) {
  if (!Array.isArray(variants) || variants.length < 1 || variants.length > 50) {
    return 'Gunakan 1 sampai 50 variasi per produk.';
  }
  const seen = new Set();
  for (const variant of variants) {
    const size = normalizeVariantText(variant.size);
    const color = normalizeVariantText(variant.color);
    if (!size && !color) return 'Setiap variasi harus memiliki ukuran atau warna.';
    if (size.length > 50 || color.length > 50) return 'Ukuran atau warna terlalu panjang (maksimal 50 karakter).';
    const key = `${size.toLocaleLowerCase('id-ID')}\u0000${color.toLocaleLowerCase('id-ID')}`;
    if (seen.has(key)) return 'Ada kombinasi ukuran dan warna yang sama. Periksa kembali.';
    seen.add(key);
    if (!Number.isSafeInteger(Number(variant.stock)) || Number(variant.stock) < 0 || Number(variant.stock) > 100000000) {
      return 'Stok setiap variasi harus bilangan bulat antara 0 dan 100 juta.';
    }
    if (!Number.isSafeInteger(Number(variant.price)) || Number(variant.price) < 0 || Number(variant.price) > 100000000000) {
      return 'Harga setiap variasi harus rupiah bulat yang valid.';
    }
  }
  return '';
}

export function makeVariantProducts({ groupId, baseName, storeId, category, audience, image, images, variants, generateId }) {
  const error = validateVariants(variants);
  if (error) throw new Error(error);
  const name = normalizeVariantText(baseName);
  if (!name || name.length > 150) throw new Error('Nama produk wajib diisi (maksimal 150 karakter).');
  return variants.map(v => {
    const size = normalizeVariantText(v.size), color = normalizeVariantText(v.color);
    return {
      id: v.id || generateId(),
      variantGroupId: groupId,
      variantBaseName: name,
      variantSize: size,
      variantColor: color,
      storeId,
      category,
      audience,
      image,
      images: Array.isArray(images) ? images : image ? [image] : [],
      name: variantDisplayName(name, size, color),
      price: Number(v.price),
      stock: Number(v.stock)
    };
  });
}
