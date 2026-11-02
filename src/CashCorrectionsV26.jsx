import React,{useEffect,useMemo,useState} from 'react';
import {supabase} from './supabase.js';
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);
function csv(x){const s=String(x??'');return '"'+(/^[=+@\-\t\r]/.test(s)?"'":'')+s.replaceAll('"','""')+'"'}
const today=()=>new Date().toLocaleDateString('en-CA');
export default function CashCorrectionsV26(){
 const [receipts,setReceipts]=useState([]),[voids,setVoids]=useState([]),[date,setDate]=useState(today()),[reason,setReason]=useState(''),[chosen,setChosen]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 async function reload(){setLoading(true);setError('');try{
  const pull=async (table,cols,sort)=>{let result=[];for(let start=0;;start+=500){const {data,error}=await supabase.from(table).select(cols).order(sort,{ascending:false}).order('id',{ascending:false}).range(start,start+499);if(error)throw error;result.push(...(data||[]));if((data||[]).length<500)break;}return result};
  const [r,v]=await Promise.all([pull('payment_reconciliations','id,order_id,amount,payment_method,reference_no,received_at,created_at','created_at'),pull('payment_voids_v26','id,receipt_id,reason,voided_at,voided_by','voided_at')]);setReceipts(r);setVoids(v);
 }catch(e){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{reload()},[]);
 const voidIds=useMemo(()=>new Set(voids.map(v=>v.receipt_id)),[voids]);
 const receiptMap=useMemo(()=>new Map(receipts.map(r=>[r.id,r])),[receipts]);
 const dayEvents=useMemo(()=>{
  const events=[];
  for(const r of receipts)if(r.received_at?.slice(0,10)===date)events.push({id:r.id,kind:'Masuk',amount:Number(r.amount),method:r.payment_method,ref:r.reference_no,at:r.received_at});
  for(const v of voids){const r=receiptMap.get(v.receipt_id);if(r&&v.voided_at?.slice(0,10)===date)events.push({id:v.id,kind:'Koreksi',amount:-Number(r.amount),method:r.payment_method,ref:r.reference_no,at:v.voided_at});}
  return events.sort((a,b)=>a.at.localeCompare(b.at));
 },[receipts,voids,receiptMap,date]);
 const received=dayEvents.filter(e=>e.amount>0).reduce((a,e)=>a+e.amount,0),corrections=-dayEvents.filter(e=>e.amount<0).reduce((a,e)=>a+e.amount,0);
 const byMethod=['Transfer bank','QRIS'].map(method=>({method,total:dayEvents.filter(e=>e.method===method).reduce((a,e)=>a+e.amount,0)}));
 async function voidReceipt(e){e.preventDefault();if(!chosen||reason.trim().length<10)return setError('Pilih pembayaran dan isi alasan minimal 10 karakter.');if(!window.confirm('Batalkan catatan pembayaran ini? Peristiwa ini akan tercatat permanen, dan tidak dapat dibatalkan kembali.'))return;
  setBusy(true);setError('');setSuccess('');try{const {error}=await supabase.rpc('void_payment_v26',{p_receipt_id:chosen,p_reason:reason.trim()});if(error)throw error;setChosen('');setReason('');setSuccess('Koreksi dicatat. Jika perlu, catat pembayaran pengganti di menu Rekonsiliasi.');await reload()}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 function exportCsv(){const lines=[['Waktu','Jenis','Metode','Referensi','Nominal'],...dayEvents.map(e=>[e.at,e.kind,e.method,e.ref,e.amount])];const blob=new Blob(['\uFEFF'+lines.map(l=>l.map(csv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`kas-harian-${date}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <section className="panel"><div className="sectionHead"><div><h2>Koreksi Pembayaran & Kas Harian</h2><p className="muted">Catatan internal manual, bukan bukti settlement bank. Tanggal pengelompokan memakai tanggal ISO/UTC dari database.</p></div><button onClick={reload} disabled={loading}>{loading?'Memuat...':'Muat ulang'}</button></div>
 {error&&<p className="errorText" role="alert">{error}</p>}{success&&<p role="status">{success}</p>}
 <div className="opsStats"><div><b>{money(received)}</b><small>Penerimaan pada tanggal terpilih</small></div><div><b>{money(corrections)}</b><small>Koreksi dicatat hari itu</small></div><div><b>{money(received-corrections)}</b><small>Kas bersih berdasarkan catatan</small></div><div><b>{voids.length}</b><small>Total koreksi tercatat</small></div></div>
 <label>Tanggal kas (UTC)<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button type="button" onClick={exportCsv} disabled={loading||Boolean(error)}>Unduh CSV kas tanggal ini</button>
 <div className="opsTableWrap"><table className="opsTable"><thead><tr><th>Metode</th><th>Nilai bersih</th></tr></thead><tbody>{byMethod.map(x=><tr key={x.method}><td>{x.method}</td><td>{money(x.total)}</td></tr>)}</tbody></table></div>
 <h3>Peristiwa kas ({dayEvents.length})</h3><div className="opsTableWrap"><table className="opsTable"><thead><tr><th>Waktu (UTC)</th><th>Jenis</th><th>Metode</th><th>Referensi</th><th>Nilai</th></tr></thead><tbody>{dayEvents.map(e=><tr key={e.id}><td>{new Date(e.at).toLocaleString('id-ID',{timeZone:'UTC'})}</td><td>{e.kind}</td><td>{e.method}</td><td>{e.ref}</td><td>{money(e.amount)}</td></tr>)}</tbody></table></div>
 <form className="editor" style={{maxWidth:650}} onSubmit={voidReceipt}><h3>Koreksi catatan pembayaran</h3><p className="muted">Pembatalan tidak menghapus transaksi asli, tidak mengubah status pesanan, dan tidak memengaruhi stok. Referensi asli tetap tidak bisa dipakai ulang.</p><label>Pilih catatan yang akan dikoreksi<select required value={chosen} onChange={e=>setChosen(e.target.value)}><option value="">Pilih pembayaran</option>{receipts.filter(r=>!voidIds.has(r.id)).map(r=><option key={r.id} value={r.id}>{r.reference_no} · {money(r.amount)} · #{r.order_id.slice(0,8)}</option>)}</select></label><label>Alasan koreksi (wajib, minimal 10 karakter)<textarea value={reason} minLength={10} maxLength={500} rows={3} required onChange={e=>setReason(e.target.value)} placeholder="Contoh: nominal salah input; pembayaran pengganti akan dicatat"/></label><button className="primary" disabled={busy||loading||!chosen||reason.trim().length<10}>{busy?'Menyimpan...':'Simpan koreksi dengan jejak audit'}</button></form>
 <details><summary>Riwayat koreksi ({voids.length})</summary>{voids.map(v=>{const r=receiptMap.get(v.receipt_id);return <p key={v.id} className="muted">{new Date(v.voided_at).toLocaleString('id-ID')} · {r?.reference_no||v.receipt_id} · {money(r?.amount||0)} · Alasan: {v.reason}</p>})}</details>
 <p className="muted">Penting: menu Rekonsiliasi memperhitungkan catatan yang dibatalkan. Dashboard Keuangan berbasis status pesanan tetap berbeda dari laporan penerimaan kas.</p>
 </section>
}
