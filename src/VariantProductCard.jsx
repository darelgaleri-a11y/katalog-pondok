import React, {useState} from 'react';
import {ShoppingBag, Plus} from 'lucide-react';
import {normalizeVariantText} from './productVariants.js';
import {photoForProduct} from './catalogPhotos.js';
import PhotoGallery from './PhotoGallery.jsx';

export default function VariantProductCard({group, money, onAdd}) {
  const [selectedId, setSelectedId] = useState('');
  const variants = group.variants;
  const product = group.representative;
  const selected = variants.find(v => v.id === selectedId);
  const minPrice = Math.min(...variants.map(v => Number(v.price)));
  const maxPrice = Math.max(...variants.map(v => Number(v.price)));
  const hasStock = variants.some(v => v.stock > 0);
  const baseName = product.variantBaseName || product.name;
  const label = v => [v.variantSize && `Ukuran ${normalizeVariantText(v.variantSize)}`, v.variantColor && `Warna ${normalizeVariantText(v.variantColor)}`].filter(Boolean).join(' · ');
  return <article className="productCard variantProductCard">
    <PhotoGallery images={photoForProduct(product)} alt={baseName}/>
    <div className="cardContent">
      <small>{product.category}</small>
      <h3>{baseName}</h3>
      <b>{selected ? money(selected.price) : minPrice===maxPrice ? money(minPrice) : `Mulai ${money(minPrice)}`}</b>
      <label className="variantSelectLabel">Ukuran / warna
        <select value={selectedId} onChange={e=>setSelectedId(e.target.value)} aria-label={`Pilih ukuran dan warna untuk ${baseName}`}>
          <option value="">Pilih ukuran / warna dahulu</option>
          {variants.map(v=><option key={v.id} value={v.id} disabled={v.stock<=0}>{label(v)} — {money(v.price)}{v.stock<=0?' (Habis)':''}</option>)}
        </select>
      </label>
      <p className="variantStockNote" aria-live="polite">{selected?`Stok pilihan: ${selected.stock}`:hasStock?'Pilih variasi sebelum membeli':'Semua variasi sedang habis'}</p>
      <button className="primary" disabled={!selected||selected.stock<=0} onClick={()=>onAdd(selected)}><Plus size={17}/> {!hasStock?'Habis':selected?'Keranjang':'Pilih variasi'}</button>
    </div>
  </article>;
}
