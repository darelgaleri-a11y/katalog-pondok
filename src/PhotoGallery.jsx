import React,{useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Images,ShoppingBag,X} from 'lucide-react';
import {normalizePhotos} from './catalogPhotos.js';

export default function PhotoGallery({images,alt='Foto produk'}) {
  const urls=normalizePhotos(images);
  const [open,setOpen]=useState(false),[index,setIndex]=useState(0);
  const startX=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const onKey=e=>{
      if(e.key==='Escape')setOpen(false);
      if(e.key==='ArrowLeft')setIndex(i=>(i+urls.length-1)%urls.length);
      if(e.key==='ArrowRight')setIndex(i=>(i+1)%urls.length);
    };
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[open,urls.length]);
  const photo=urls[index]||urls[0];
  const advance=diff=>setIndex(i=>(i+diff+urls.length)%urls.length);
  return <>
    <div className="photo productPhotoV329">
      {urls.length?<button className="productPhotoOpen" type="button" onClick={()=>{setIndex(0);setOpen(true)}} aria-label={`Lihat ${urls.length} foto ${alt}`}>
        <img src={urls[0]} alt={alt} loading="lazy" decoding="async"/>{urls.length>1&&<span className="photoCount"><Images size={14}/> 1/{urls.length}</span>}
      </button>:<ShoppingBag size={48} aria-label="Foto belum tersedia"/>}
    </div>
    {open&&<div className="productGalleryOverlay" role="dialog" aria-modal="true" aria-label={`Galeri foto ${alt}`} onClick={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
      <section className="productGalleryModal">
        <div className="galleryModalHead"><strong>{alt}</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Tutup galeri"><X size={22}/></button></div>
        <div className="galleryModalImage" onTouchStart={e=>{startX.current=e.changedTouches[0]?.screenX??null}} onTouchEnd={e=>{const end=e.changedTouches[0]?.screenX;if(startX.current!==null&&typeof end==='number'&&Math.abs(end-startX.current)>45&&urls.length>1)advance(end<startX.current?1:-1);startX.current=null}}>
          <img src={photo} alt={`${alt}, foto ${index+1} dari ${urls.length}`}/>
          {urls.length>1&&<><button type="button" className="galleryPrevious" onClick={()=>advance(-1)} aria-label="Foto sebelumnya"><ChevronLeft size={24}/></button><button type="button" className="galleryNext" onClick={()=>advance(1)} aria-label="Foto berikutnya"><ChevronRight size={24}/></button></>}
        </div>
        {urls.length>1&&<><p className="galleryIndex">Foto {index+1} dari {urls.length} · Geser untuk melihat lainnya</p><div className="galleryThumbnails">{urls.map((url,i)=><button type="button" key={url} className={i===index?'active':''} onClick={()=>setIndex(i)} aria-label={`Tampilkan foto ${i+1}`} aria-current={i===index?'true':undefined}><img src={url} alt="" loading="lazy"/></button>)}</div></>}
      </section>
    </div>}
  </>;
}
