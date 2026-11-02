import React,{useEffect,useMemo,useState} from 'react';
import {supabase} from './supabase.js';
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const paidStatuses=['paid','prepared','completed'];
function csvCell(x){const s=String(x??'');return '"'+(/^[=+@\-\t\r]/.test(s)?"'":'')+s.replaceAll('"','""')+'"'}
export default function FinanceDashboard(){
 const [all,setAll]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 const [from,setFrom]=useState(''),[until,setUntil]=useState(''),[mode,setMode]=useState('all');
 async function reload(){setLoading(true);setError('');setLoaded(false);try{
  const list=[];const size=500;let offset=0;
  for(;;){const {data,error}=await supabase.from('orders').select('id,created_at,mode,status,payment_method,total_estimate,items,expired_at').order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+size-1);
    if(error)throw error;list.push(...(data||[]));if((data||[]).length<size)break;offset+=size;
  }setAll(list);setLoaded(true);
 }catch(e){setError('Gagal memuat laporan: '+e.message);setAll([])}finally{setLoading(false)}}
 useEffect(()=>{reload()},[]);
 const filtered=useMemo(()=>all.filter(o=>{const date=String(o.created_at||'').slice(0,10);return (!from||date>=from)&&(!until||date<=until)&&(mode==='all'||o.mode===mode)}),[all,from,until,mode]);
 const result=useMemo(()=>{
  const isCancelled=o=>o.status==='cancelled'||Boolean(o.expired_at);
  const paid=filtered.filter(o=>paidStatuses.includes(o.status)&&!isCancelled(o));
  const waiting=filtered.filter(o=>!paidStatuses.includes(o.status)&&!isCancelled(o));
  const cancelled=filtered.filter(isCancelled);
  const stores=new Map();
  for(const o of paid){for(const item of (Array.isArray(o.items)?o.items:[])){
    const key=String(item.store_id||item.store_name||'tanpa-toko');const name=String(item.store_name||'Toko tidak diketahui');
    const subtotal=n(item.subtotal);const row=stores.get(key)||{id:key,name,total:0,units:0,lines:0};row.total+=subtotal;row.units+=n(item.quantity);row.lines++;stores.set(key,row);
  }}
  const total=arr=>arr.reduce((s,o)=>s+n(o.total_estimate),0);
  return {paid,waiting,cancelled,paidTotal:total(paid),waitingTotal:total(waiting),cancelTotal:total(cancelled),stores:[...stores.values()].sort((a,b)=>b.total-a.total),general:paid.filter(o=>o.mode==='general'),student:paid.filter(o=>o.mode==='student')};
 },[filtered]);
 function exportCsv(){if(!loaded||loading||error)return;
  const rows=[['ID Pesanan','Tanggal Checkout (UTC)','Layanan','Status','Metode Pembayaran','Total Nominal','Kategori Rekap'],...filtered.map(o=>[o.id,o.created_at,o.mode==='student'?'Kiriman santri':'Umum',o.status,o.payment_method,n(o.total_estimate),o.status==='cancelled'||o.expired_at?'Batal/kedaluwarsa':paidStatuses.includes(o.status)?'Pembayaran terverifikasi (status)':'Belum terverifikasi'])];
  const body='\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');const blob=new Blob([body],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='laporan-keuangan-v24.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="panel"><div className="sectionHead"><div><h2>Rekap Keuangan</h2><p className="muted">Nilai berdasarkan status pesanan yang dikonfirmasi admin, bukan mutasi bank atau kas sesungguhnya.</p></div><button type="button" onClick={reload} disabled={loading}>{loading?'Memuat...':'Muat ulang'}</button></div>
 {error&&<p role="alert">{error}</p>}{loading&&<p role="status">Memuat seluruh pesanan secara bertahap...</p>}
 <div className="orderFilters"><label>Dari tanggal checkout<input aria-label="Dari tanggal checkout" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Sampai tanggal checkout<input aria-label="Sampai tanggal checkout" type="date" min={from||undefined} value={until} onChange={e=>setUntil(e.target.value)}/></label><label>Layanan<select value={mode} onChange={e=>setMode(e.target.value)}><option value="all">Semua</option><option value="general">Umum</option><option value="student">Santri</option></select></label><button type="button" disabled={!loaded||loading||Boolean(error)} onClick={exportCsv}>Unduh CSV Keuangan</button></div>
 <p className="muted">Filter tanggal berdasarkan tanggal checkout dalam UTC. Tidak menyertakan identitas pribadi dalam CSV. Data baru dianggap terverifikasi bila statusnya Dibayar, Disiapkan, atau Selesai; status Dikonfirmasi belum dihitung lunas.</p>
 {loaded&&!loading&&!error&&<><div className="opsStats"><div><b>{money(result.paidTotal)}</b><small>Nilai pesanan pembayaran terverifikasi ({result.paid.length})</small></div><div><b>{money(result.waitingTotal)}</b><small>Nilai belum diverifikasi ({result.waiting.length})</small></div><div><b>{money(result.cancelTotal)}</b><small>Nilai batal/kedaluwarsa ({result.cancelled.length})</small></div><div><b>{money(result.general.reduce((a,o)=>a+n(o.total_estimate),0))}</b><small>Terverifikasi · Umum</small></div><div><b>{money(result.student.reduce((a,o)=>a+n(o.total_estimate),0))}</b><small>Terverifikasi · Santri</small></div><div><b>{filtered.length}</b><small>Total pesanan dalam filter</small></div></div>
 <h3>Rekap per toko (barang pada pesanan terverifikasi)</h3><p className="muted">Untuk kiriman santri lintas toko, nilai dialokasikan dari subtotal masing-masing barang. Tidak menghitung biaya tambahan di luar item.</p><div className="opsTableWrap"><table className="opsTable"><thead><tr><th>Toko</th><th>Unit</th><th>Subtotal</th></tr></thead><tbody>{result.stores.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.units}</td><td>{money(s.total)}</td></tr>)}{!result.stores.length&&<tr><td colSpan="3">Belum ada pesanan terverifikasi pada filter ini.</td></tr>}</tbody></table></div></>}
 <p className="muted">Perhatian: Status dibayar/disiapkan/selesai merupakan catatan manual. Cocokkan laporan dengan transfer/QRIS kasir sebelum menyatakan pendapatan final. Laporan ini belum merupakan akuntansi, tidak menghitung laba, biaya, atau pengembalian uang.</p></section>;
}
