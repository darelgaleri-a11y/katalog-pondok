import React,{useState} from 'react';
import {ArrowLeft,ArrowRight,ImagePlus,Trash2} from 'lucide-react';
import {compressPhoto,normalizePhotos,MAX_UPLOAD_BYTES} from './catalogPhotos.js';
import {supabase} from './supabase.js';
import {createCheckoutToken} from './checkoutToken.js';

// Editor minimal: berkas tersimpan di Supabase Storage, katalog hanya menyimpan URL.
export default function PhotoFields({name='images',initialUrls=[],max=5,folder='products',title='Foto produk'}) {
  const [photos,setPhotos] = useState(()=>normalizePhotos(initialUrls, '', max));
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [link,setLink] = useState('');
  const remaining = max-photos.length;
  async function upload(event) {
    const files = [...(event.target.files||[])];
    event.target.value='';
    if (!files.length) return;
    if (files.length > remaining) {setError(`Maksimal ${max} foto. Hapus foto lama sebelum menambah.`);return;}
    if (files.some(f=>f.size>MAX_UPLOAD_BYTES)) {setError('Ukuran foto asli maksimal 5 MB per foto.');return;}
    setBusy(true);setError('');
    try {
      for(const file of files) {
        const {blob,extension}=await compressPhoto(file);
        // Gunakan UUID aman juga pada HTTP jaringan lokal (crypto.getRandomValues).
        const id=createCheckoutToken();
        const path=`${folder}/${id}.${extension}`;
        const {error:uploadError}=await supabase.storage.from('product-images').upload(path,blob,{contentType:blob.type,upsert:false});
        if(uploadError)throw new Error('Unggah foto gagal: '+uploadError.message);
        const url=supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
        setPhotos(prev=>normalizePhotos([...prev,url], '', max));
      }
    } catch(e) {setError(e.message||'Gagal memproses foto. Foto yang sudah terunggah tetap bisa digunakan.');}
    finally {setBusy(false);}
  }
  function addLink() {
    const url=link.trim();
    if(!/^https:\/\//i.test(url)) {setError('Gunakan tautan foto HTTPS.');return;}
    if(photos.length>=max) {setError('Batas jumlah foto sudah tercapai.');return;}
    setPhotos(old=>normalizePhotos([...old,url],'',max));setLink('');setError('');
  }
  function move(index, offset) {
    setPhotos(prev=>{const next=[...prev];const j=index+offset;if(j<0||j>=next.length)return prev;[next[index],next[j]]=[next[j],next[index]];return next;});
  }
  return <section className="photoAdminFields" aria-label={title}>
    <h3>{title} <small>({photos.length}/{max})</small></h3>
    <p className="muted">Foto pertama menjadi foto utama. Bisa diurutkan dan dihapus. Gambar dikompres otomatis agar ringan.</p>
    <input type="hidden" name={name} value={JSON.stringify(photos)}/>
    <input type="hidden" name={`${name}Pending`} value={busy?'yes':'no'}/>
    <div className="photoAdminList">
      {photos.map((url,i)=><div className="photoAdminThumb" key={url}>
        <img src={url} alt={`${title} ${i+1}`} loading="lazy"/>
        <small>{i===0?'Foto utama':`Foto ${i+1}`}</small>
        <div className="photoAdminActions">
          <button type="button" disabled={busy||i===0} onClick={()=>move(i,-1)} aria-label={`Geser foto ${i+1} ke kiri`}><ArrowLeft size={16}/></button>
          <button type="button" disabled={busy||i===photos.length-1} onClick={()=>move(i,1)} aria-label={`Geser foto ${i+1} ke kanan`}><ArrowRight size={16}/></button>
          <button type="button" disabled={busy} onClick={()=>setPhotos(v=>v.filter(x=>x!==url))} aria-label={`Hapus foto ${i+1} dari katalog`}><Trash2 size={16}/></button>
        </div>
      </div>)}
    </div>
    {remaining>0&&<label className="photoUploadLabel"><ImagePlus size={20}/>{busy?'Mengunggah foto...':`Tambah foto (maksimal ${max})`}<input type="file" accept="image/png,image/jpeg,image/webp" multiple={max>1} onChange={upload} disabled={busy}/></label>}
    <details className="photoLinkDetails"><summary>Atau gunakan tautan foto HTTPS</summary><div className="photoLinkRow"><input type="url" placeholder="https://..." value={link} onChange={e=>setLink(e.target.value)} disabled={busy||!remaining}/><button type="button" disabled={busy||!remaining} onClick={addLink}>Tambah</button></div></details>
    {busy&&<p role="status" className="muted">Tunggu foto selesai diunggah sebelum menyimpan data.</p>}
    {error&&<p role="alert" className="errorText">{error}</p>}
  </section>;
}
