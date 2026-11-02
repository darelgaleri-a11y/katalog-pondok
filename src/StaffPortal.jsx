import React,{useEffect,useState} from 'react';
import {supabase,configured} from './supabase.js';
const mask=s=>s?String(s).slice(0,1)+'••••':'—';
const todayWib=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export default function StaffPortal(){
 const [user,setUser]=useState(null),[busy,setBusy]=useState(true),[profile,setProfile]=useState(null),[items,setItems]=useState([]),[date,setDate]=useState(todayWib()),[loading,setLoading]=useState(false),[error,setError]=useState(''),[changing,setChanging]=useState(''),[showNames,setShowNames]=useState(false),[recipient,setRecipient]=useState({}),[method,setMethod]=useState({}),[confirmed,setConfirmed]=useState({});
 const [view,setView]=useState('pending'),[selectedReceipt,setSelectedReceipt]=useState(null);
 const pending=items.filter(o=>!o.handed_at),completed=items.filter(o=>!!o.handed_at);
 const shownOrders=view==='pending'?pending:completed;
 useEffect(()=>{let live=true;supabase?.auth.getUser().then(({data})=>{if(live)setUser(data.user||null)}).catch(e=>setError(e.message)).finally(()=>{if(live)setBusy(false)});const {data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{if(live){setUser(session?.user||null);setProfile(null);setItems([])}});return()=>{live=false;subscription.unsubscribe()}},[]);
 useEffect(()=>{if(!user)return;let live=true;supabase.rpc('my_staff_profile_v19').then(({data,error})=>{if(live){setProfile(data||null);if(error)setError(error.message)}});return()=>{live=false}},[user?.id]);
 async function load(){if(!profile)return;setLoading(true);setError('');try{let results=[];for(let off=0;off<100000;off+=200){let {data,error}=await supabase.rpc('staff_orders_v19',{p_delivery_date:date||null,p_limit:200,p_offset:off});if(error)throw error;const page=Array.isArray(data)?data:[];results.push(...page);if(page.length<200)break;}setItems(results)}catch(e){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{if(profile)load()},[profile?.gender,date]);
 async function deliver(o){
  const name=(recipient[o.id]||'').trim();const how=method[o.id]||'';
  if(name.length<2||name.length>100){setError('Isi nama penerima antara 2–100 karakter.');return}
  if(!['langsung','perwakilan_pondok'].includes(how)){setError('Pilih cara penerimaan.');return}
  if(!confirmed[o.id]){setError('Centang pernyataan setelah barang benar-benar diserahkan.');return}
  if(changing||!window.confirm(`Catat barang pesanan #${o.id.slice(0,8).toUpperCase()} telah diterima oleh ${name}? Catatan tidak dapat diubah melalui portal petugas.`))return;
  setChanging(o.id);setError('');
  try{const {error}=await supabase.rpc('staff_receipt_v20',{p_order_id:o.id,p_recipient_name:name,p_receipt_method:how});if(error)throw error;setSelectedReceipt(null);await load()}
  catch(e){setError(e.message)}finally{setChanging('')}
 }
 async function login(e){e.preventDefault();let f=new FormData(e.currentTarget);setError('');const {error}=await supabase.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error)setError(error.message)}
 if(!configured)return <main className="staffPage"><h1>Supabase belum dikonfigurasi</h1></main>;
 return <main className="staffPage"><header className="staffHeader"><div><h1>Petugas Serah-Terima</h1><p>Akses terbatas · Kiriman Santri</p></div><a href="/">Beranda</a></header>{busy?<p>Memeriksa akun…</p>:!user?<section className="panel"><h2>Login Petugas</h2><form onSubmit={login}><label>Email<input name="email" type="email" required /></label><label>Password<input name="password" type="password" required /></label><button className="primary">Masuk</button></form></section>:!profile?<section className="panel"><p>Akun {user.email} belum terdaftar sebagai petugas aktif. Hubungi admin utama.</p><button onClick={()=>supabase.auth.signOut()}>Keluar</button></section> :<><section className="panel staffSimpleHead"><h2>Kiriman Santri {profile.gender==='male'?'Putra':'Putri'}</h2><p>Selamat bertugas, {profile.officer_name}. Pilih kiriman yang perlu diserahkan.</p>
 <div className="staffStats"><div><strong>{pending.length}</strong><span>Belum diserahkan</span></div><div><strong>{completed.length}</strong><span>Sudah diserahkan</span></div></div>
 <div className="staffControls"><label>Tanggal kiriman<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button type="button" onClick={()=>setDate('')}>Semua tanggal</button><button type="button" disabled={loading} onClick={load}>{loading?'Memuat...':'Perbarui daftar'}</button><button type="button" onClick={()=>supabase.auth.signOut()}>Keluar</button></div>
 <div className="simpleSubNav" role="group" aria-label="Filter kiriman"><button className={view==='pending'?'active':''} onClick={()=>{setView('pending');setSelectedReceipt(null)}}>Belum Diserahkan ({pending.length})</button><button className={view==='done'?'active':''} onClick={()=>{setView('done');setSelectedReceipt(null)}}>Sudah Diserahkan ({completed.length})</button></div>
 </section>
 {shownOrders.map(o=><article className="panel staffOrderSimple" key={o.id}><div className="sectionHead"><h3>Pesanan #{o.id.slice(0,8).toUpperCase()}</h3><small>{o.delivery_date}</small></div>
 <p>Santri: {showNames?o.student_name:mask(o.student_name)} · Kamar: {showNames?o.student_room:'[disamarkan]'}</p>
 <ul>{(o.items||[]).map((i,n)=><li key={n}>{i.product_name} × {i.quantity} ({i.store_name})</li>)}</ul>
 {o.handed_at?<p className="successText"><strong>Sudah diserahkan</strong> · {new Date(o.handed_at).toLocaleString('id-ID')}<br/>Penerima: {showNames?(o.recipient_name||'Catatan lama'):'[disamarkan]'}</p>:<>
 <button className="primary simpleDeliveryButton" type="button" onClick={()=>setSelectedReceipt(v=>v===o.id?null:o.id)} aria-expanded={selectedReceipt===o.id}>{selectedReceipt===o.id?'Tutup formulir':'Sudah Diserahkan'}</button>
 {selectedReceipt===o.id&&<div className="receiptForm"><p className="muted">Isi sesudah barang benar-benar diterima. Catatan ini tidak bisa diubah.</p><label>Nama penerima barang<input value={recipient[o.id]||''} maxLength={100} onChange={e=>setRecipient(p=>({...p,[o.id]:e.target.value}))} placeholder="Nama penerima" /></label><label>Diterima oleh<select value={method[o.id]||''} onChange={e=>setMethod(p=>({...p,[o.id]:e.target.value}))}><option value="">Pilih penerima</option><option value="langsung">Santri langsung</option><option value="perwakilan_pondok">Perwakilan pondok</option></select></label><label><input type="checkbox" checked={!!confirmed[o.id]} onChange={e=>setConfirmed(p=>({...p,[o.id]:e.target.checked}))}/> Saya memastikan barang telah diterima.</label><button className="primary" type="button" disabled={Boolean(changing)||!confirmed[o.id]||!(recipient[o.id]||'').trim()||!method[o.id]} onClick={()=>deliver(o)}>{changing===o.id?'Menyimpan...':'Simpan Bukti Penerimaan'}</button></div>}
 </>}
 </article>)}
 {view==='pending'&&pending.length===0&&<p className="panel">Tidak ada kiriman yang menunggu. Terima kasih!</p>}{view==='done'&&completed.length===0&&<p className="panel">Belum ada kiriman yang diserahkan pada pilihan ini.</p>}
 <label className="staffPrivacy"><input type="checkbox" checked={showNames} onChange={e=>setShowNames(e.target.checked)}/> Tampilkan nama dan kamar saat diperlukan</label>
 </>}{error&&<p role="alert" className="errorText">{error}</p>}</main>
}
