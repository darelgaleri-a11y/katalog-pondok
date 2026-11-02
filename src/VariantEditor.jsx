import React, {useState} from 'react';
import {Plus, Trash2} from 'lucide-react';
import {validateVariants, normalizeVariantText} from './productVariants.js';
import PhotoFields from './PhotoFields.jsx';
import {normalizePhotos} from './catalogPhotos.js';

// Tidak menghapus ID variasi yang pernah tersimpan: pengembalian stok pesanan lama
// tetap bisa menemukan produk berdasarkan ID variasi tersebut.
export default function VariantEditor({editing, groupVariants, stores, onSave, onCancel, money}) {
  const existing = groupVariants.length > 0;
  const first = groupVariants[0] || {};
  const [rows,setRows] = useState(() => existing
    ? groupVariants.map(v => ({id:v.id, size:v.variantSize||'', color:v.variantColor||'', price:String(v.price), stock:String(v.stock)}))
    : [{key:'initial',size:'M',color:'',price:'',stock:'0'}]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const update = (i,field,value) => setRows(current=>current.map((v,j)=>i===j?{...v,[field]:value}:v));
  const addRow = () => setRows(current=>current.length>=50?current:[...current,{key:`new-${Date.now()}-${Math.random()}`,size:'',color:'',price:current.at(-1)?.price||'',stock:'0'}]);
  const removeRow = index => setRows(current=>current.filter((_,i)=>i!==index));
  async function submit(e) {
    e.preventDefault();
    if(busy)return;
    const form=e.currentTarget;
    const f=new FormData(form);
    const baseName=normalizeVariantText(f.get('name'));
    const storeId=String(f.get('storeId')||'');
    const category=normalizeVariantText(f.get('category'));
    const audience=String(f.get('audience'));
    if(f.get('imagesPending')==='yes')return setError('Tunggu foto selesai diunggah.');
    let images;
    try { images=normalizePhotos(JSON.parse(String(f.get('images')||'[]'))); } catch {return setError('Daftar foto tidak valid.');}
    if(!baseName || baseName.length>150 || !stores.some(s=>s.id===storeId))return setError('Nama produk dan toko wajib valid.');
    const issue=validateVariants(rows);
    if(issue)return setError(issue);

    setError('');setBusy(true);
    try { await onSave({baseName,storeId,category,audience,images,variants:rows}); }
    catch(err){setError(err.message||'Gagal menyimpan variasi.');}
    finally {setBusy(false);}
  }
  return <form className="variantEditorForm" onSubmit={submit}>
    <p className="muted">Satu produk bisa memiliki beberapa ukuran dan warna. Setiap pilihan mempunyai harga dan stok sendiri.</p>
    <label>Toko<select name="storeId" required defaultValue={first.storeId||editing.storeId||stores[0]?.id}>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <label>Nama produk<input name="name" required maxLength="150" defaultValue={first.variantBaseName||''} placeholder="Contoh: Baju Koko Santri"/></label>
    <label>Kategori<input name="category" defaultValue={first.category||'Pakaian'}/></label>
    <label>Tersedia untuk<select name="audience" defaultValue={first.audience||'both'}><option value="both">Umum & Santri</option><option value="general">Umum saja</option><option value="student">Santri saja</option></select></label>
    <PhotoFields name="images" title="Foto produk dengan variasi (maks. 5)" initialUrls={normalizePhotos(first.images, first.image)} folder="products" max={5}/>
    <div className="variantEditorHead"><strong>Daftar Ukuran / Warna</strong><small>Harga dan stok boleh berbeda untuk setiap baris.</small></div>
    {rows.map((row,i)=><div className="variantEditorRow" key={row.id||row.key}>
      <div className="variantEditorRowTitle"><strong>Variasi {i+1}</strong>{!row.id&&rows.length>1&&<button className="variantRemove" type="button" onClick={()=>removeRow(i)} aria-label={`Hapus variasi baru ${i+1}`}><Trash2 size={16}/> Hapus</button>}</div>
      <div className="variantEditorFields">
        <label>Ukuran<input value={row.size} onChange={e=>update(i,'size',e.target.value)} maxLength="50" placeholder="M, L, XL..."/></label>
        <label>Warna<input value={row.color} onChange={e=>update(i,'color',e.target.value)} maxLength="50" placeholder="Hitam, putih..."/></label>
        <label>Harga (Rp)<input type="number" min="0" max="100000000000" step="1" required value={row.price} onChange={e=>update(i,'price',e.target.value)}/></label>
        <label>Stok<input type="number" min="0" max="100000000" step="1" required value={row.stock} onChange={e=>update(i,'stock',e.target.value)}/></label>
      </div>
      {row.id&&<small className="muted">Variasi lama tidak dapat dihapus agar riwayat pesanan dan pengembalian stok tetap aman. Isi stok 0 jika sementara tidak dijual.</small>}
    </div>)}
    <button type="button" className="variantAdd" onClick={addRow} disabled={rows.length>=50}><Plus size={17}/> Tambah pilihan ukuran / warna</button>
    {error&&<p className="errorText" role="alert">{error}</p>}
    <button type="submit" className="primary big" disabled={busy}>{busy?'Menyimpan variasi...':'Simpan Produk & Variasi'}</button>
    <button type="button" onClick={onCancel} disabled={busy}>Batal</button>
    {existing&&<small className="muted">Jika stok berubah saat pembeli checkout, angka terkini akan dilindungi oleh Supabase. Pastikan stok setelah menyimpan.</small>}
  </form>;
}
