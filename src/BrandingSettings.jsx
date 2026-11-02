import React,{useEffect,useState} from 'react';
import {GraduationCap,ShoppingBag,ImagePlus,Trash2,RotateCcw,Save} from 'lucide-react';
import {supabase} from './supabase.js';
import {compressPhoto,MAX_UPLOAD_BYTES} from './catalogPhotos.js';
import {createCheckoutToken} from './checkoutToken.js';
import {DEFAULT_BRANDING,COLOR_CHOICES,normalizeBranding,validateBranding,brandCssVariables} from './catalogBranding.js';

const MODES=[{key:'student',label:'Kiriman Santri',Icon:GraduationCap},{key:'general',label:'Belanja Umum',Icon:ShoppingBag}];

export default function BrandingSettings({value,onSave,loadError=''}){
  const [selected,setSelected]=useState('student');
  const [drafts,setDrafts]=useState(()=>({student:normalizeBranding('student',value?.student),general:normalizeBranding('general',value?.general)}));
  const [uploading,setUploading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{
    setDrafts({student:normalizeBranding('student',value?.student),general:normalizeBranding('general',value?.general)});
  },[value]);
  const current=drafts[selected];
  const update=(values)=>{setDrafts(prev=>({...prev,[selected]:{...prev[selected],...values}}));setMessage('');setError('');};
  const changeMode=(mode)=>{if(uploading||saving)return;setSelected(mode);setMessage('');setError('');};
  const revertColors=()=>update({primary_color:DEFAULT_BRANDING[selected].primary_color,soft_color:DEFAULT_BRANDING[selected].soft_color});

  async function uploadLogo(event){
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>MAX_UPLOAD_BYTES){setError('Pilih PNG, JPG, atau WEBP maksimal 5 MB.');return;}
    setUploading(true);setMessage('');setError('');
    try{
      const {blob,extension}=await compressPhoto(file);
      const fileId=createCheckoutToken();
      const path=`branding/${selected}/${fileId}.${extension}`;
      const storage=supabase.storage.from('product-images');
      const {error:uploadError}=await storage.upload(path,blob,{contentType:blob.type,upsert:false});
      if(uploadError)throw new Error(uploadError.message);
      const url=storage.getPublicUrl(path).data.publicUrl;
      update({logo_url:url});
      setMessage('Logo berhasil diunggah. Tekan Simpan Tampilan untuk menggunakannya di katalog.');
    }catch(e){setError('Unggah logo gagal: '+(e?.message||'Periksa koneksi dan izin Storage.'));}
    finally{setUploading(false);}
  }

  async function save(event){
    event.preventDefault();
    if(uploading||saving)return;
    try{
      const validated=validateBranding(selected,drafts[selected]);
      setSaving(true);setMessage('');setError('');
      await onSave(selected,validated);
      setMessage('Berhasil disimpan. Buka atau segarkan halaman katalog untuk melihat perubahan.');
    }catch(e){setError(e?.message||'Gagal menyimpan tampilan.');}
    finally{setSaving(false);}
  }
  return <section className="panel brandingAdminPanel">
    <h2>Identitas & Tampilan Katalog</h2>
    <p className="muted">Logo, nama, dan warna setiap katalog diatur sendiri. Perubahan di sini tidak mengubah produk, stok, atau pesanan.</p>
    {loadError&&<p role="alert" className="errorText">Pengaturan tampilan belum dapat dibaca: {loadError}. Jalankan SQL V33.1 dahulu dan muat ulang halaman.</p>}
    <div className="brandingModeButtons" role="group" aria-label="Pilih katalog yang diatur">
      {MODES.map(({key,label,Icon})=><button type="button" key={key} className={selected===key?'active':''} onClick={()=>changeMode(key)} disabled={saving||uploading} aria-pressed={selected===key}><Icon size={19}/>{label}</button>)}
    </div>
    <form onSubmit={save} className="brandingForm">
      <label>Nama katalog
        <input maxLength={70} required value={current.display_name} onChange={e=>update({display_name:e.target.value})} placeholder="Nama katalog"/>
      </label>
      <div className="brandingLogoField">
        <b>Logo resmi (opsional)</b>
        <div className="brandingLogoLine">
          <div className="brandingLogoPreview">{current.logo_url?<img src={current.logo_url} alt="Pratinjau logo"/>:selected==='student'?<GraduationCap size={40}/>:<ShoppingBag size={40}/>}</div>
          <div className="brandingLogoControls">
            <label className="brandingUploadButton"><ImagePlus size={18}/>{uploading?'Mengunggah...':'Unggah Logo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} disabled={uploading||saving}/></label>
            {current.logo_url&&<button type="button" className="brandingRemoveLogo" onClick={()=>update({logo_url:''})} disabled={uploading||saving}><Trash2 size={16}/> Hapus logo dari katalog</button>}
            <small>PNG, JPG, atau WebP maksimal 5 MB. Foto otomatis diperkecil.</small>
          </div>
        </div>
      </div>
      <fieldset className="brandingColors"><legend>Warna utama (tombol dan identitas)</legend>
        <div className="brandingSwatches">
          {COLOR_CHOICES.map(c=><button key={c} type="button" title={`Pilih warna ${c}`} aria-label={`Warna ${c}`} aria-pressed={current.primary_color.toUpperCase()===c} className={current.primary_color.toUpperCase()===c?'chosen':''} style={{background:c}} onClick={()=>update({primary_color:c})}/>)}
        </div>
        <label className="brandingColorInput">Pilih warna sendiri <input type="color" value={/^#[\da-f]{6}$/i.test(current.primary_color)?current.primary_color:'#176B47'} onChange={e=>update({primary_color:e.target.value})}/></label>
      </fieldset>
      <fieldset className="brandingColors"><legend>Warna latar lembut</legend>
        <label className="brandingColorInput">Pilih warna latar <input type="color" value={/^#[\da-f]{6}$/i.test(current.soft_color)?current.soft_color:'#E9F5EE'} onChange={e=>update({soft_color:e.target.value})}/></label>
        <small>Gunakan warna terang agar tulisan mudah dibaca.</small>
      </fieldset>
      <div className="brandingLivePreview" style={brandCssVariables(current)}>
        <strong>Pratinjau sebelum disimpan</strong>
        <div className="brandingPreviewHeader"><div className="brandingPreviewLogo">{current.logo_url?<img src={current.logo_url} alt=""/>:selected==='student'?<GraduationCap size={25}/>:<ShoppingBag size={25}/>}</div><span>{current.display_name||'Nama Katalog'}</span></div>
        <div className="brandingPreviewContent"><p>Selamat datang, silakan pilih barang yang dibutuhkan.</p><span className="brandingPreviewButton">Mulai Belanja</span></div>
      </div>
      {error&&<p className="errorText" role="alert">{error}</p>}
      {message&&<p className="brandingSuccess" role="status">{message}</p>}
      <div className="brandingFormActions">
        <button type="button" className="brandingReset" onClick={revertColors} disabled={uploading||saving}><RotateCcw size={16}/> Warna Awal</button>
        <button type="submit" className="primary" disabled={uploading||saving||Boolean(loadError)}><Save size={17}/>{saving?'Menyimpan...':'Simpan Tampilan'}</button>
      </div>
    </form>
  </section>;
}
