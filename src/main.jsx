import DailyCloseWibV31 from './DailyCloseWibV31.jsx';
import AdjustmentsV30 from './AdjustmentsV30.jsx';
import MonthlyWibV28 from './MonthlyWibV28.jsx';
import DailyCloseV27 from './DailyCloseV27.jsx';
import CashCorrectionsV26 from './CashCorrectionsV26.jsx';
import ReconciliationDashboard from './ReconciliationDashboard.jsx';
import FinanceDashboard from './FinanceDashboard.jsx';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ShoppingBag,ShoppingCart,Store,Plus,Trash2,Pencil,ArrowLeft,MessageCircle,Minus,CheckCircle2,GraduationCap,Users,CalendarDays,Settings,BookOpen} from 'lucide-react';
import './style.css';
import {supabase, configured} from './supabase.js';
import {getOrCreateCheckoutToken} from './checkoutToken.js';
import {getOrCreateCheckoutClientRef} from './checkoutClientRef.js';
import {groupProducts, makeVariantProducts} from './productVariants.js';
import VariantProductCard from './VariantProductCard.jsx';
import VariantEditor from './VariantEditor.jsx';
import PhotoFields from './PhotoFields.jsx';
import PhotoGallery from './PhotoGallery.jsx';
import GeneralShippingFields from './GeneralShippingFields.jsx';
import {readGeneralShipping,generalShippingWhatsApp} from './shippingDetails.js';
import {normalizePhotos,photoForProduct,readPhotoField} from './catalogPhotos.js';
import BrandingSettings from './BrandingSettings.jsx';
import {DEFAULT_BRANDING,normalizeBranding,brandCssVariables} from './catalogBranding.js';

const GUIDE_STORAGE_KEY='katalog-darel-v325-guide-seen';
const activeRoute=()=>window.location.pathname.replace(/\/$/,'')||'/';
const routeMode=()=>activeRoute()==='/santri'?'student':['/umum','/belanja-umum'].includes(activeRoute())?'general':null;

const DEMO={stores:[{id:'t1',name:'Toko Pakaian',wa:'6281234567890',description:'Pakaian dan perlengkapan',paymentInfo:'Nomor rekening belum diisi admin.',active:true},{id:'t2',name:'Toko Sepatu',wa:'6289876543210',description:'Sepatu untuk segala kebutuhan',paymentInfo:'Nomor rekening belum diisi admin.',active:true},{id:'t3',name:'Toko Tas',wa:'628111222333',description:'Tas dan aksesori',paymentInfo:'Nomor rekening belum diisi admin.',active:true}],products:[{id:'p1',storeId:'t1',name:'Kaos Oversize',price:85000,stock:15,category:'Atasan',audience:'both',image:'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?w=800'},{id:'p2',storeId:'t1',name:'Kemeja Casual',price:135000,stock:9,category:'Atasan',audience:'general',image:'https://images.unsplash.com/photo-1598032895397-b9472444bf93?w=800'},{id:'p3',storeId:'t2',name:'Sneakers Putih',price:240000,stock:12,category:'Sepatu',audience:'both',image:'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800'},{id:'p4',storeId:'t3',name:'Tas Selempang',price:159000,stock:7,category:'Tas',audience:'student',image:'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800'}],settings:{maleWa:'',femaleWa:'',malePayment:'Nomor rekening putra belum diisi admin.',femalePayment:'Nomor rekening putri belum diisi admin.',deliveryDays:[2,5]}};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const uid=()=>globalThis.crypto?.randomUUID?.()||`id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const money=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(v);
const waNumber=value=>{let s=String(value||'').replace(/\D/g,'');if(s.startsWith('0'))s='62'+s.slice(1);return s};
const validWa=value=>/^\d{10,15}$/.test(waNumber(value));
const transferInfo=value=>{const v=String(value||'').trim();return !v||/rekening\s*\/\s*qris|^hubungi kasir .*informasi rekening|^nomor rekening .*belum diisi admin/i.test(v)?'':v};
const audienceOK=(p,mode)=>((p.audience||'both')==='both'||p.audience===(mode==='general'?'general':'student'));
const dates=(days,n=12)=>{const result=[];const d=new Date();d.setHours(12,0,0,0);for(let i=0;i<90&&result.length<n;i++){const current=new Date(d);current.setDate(current.getDate()+i);if(days.includes(current.getDay())){const iso=`${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`;result.push({iso,label:new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(current)})}}return result};
function App(){
 const [db,setDb]=useState({stores:[],products:[],settings:DEMO.settings});
 const [loaded,setLoaded]=useState(false),[authUser,setAuthUser]=useState(null),[isAdminUser,setIsAdminUser]=useState(false),[authBusy,setAuthBusy]=useState(true),[syncState,setSyncState]=useState('Memuat katalog...'),[cloudError,setCloudError]=useState('');
 const remoteUpdate=useRef(false), initialLoad=useRef(false);
 const [history,setHistory]=useState([]);
 const [expiryBusy,setExpiryBusy]=useState(false);
 const [orders,setOrders]=useState([]),[ordersLoading,setOrdersLoading]=useState(false),[orderCount,setOrderCount]=useState(0),[orderLoadError,setOrderLoadError]=useState(''),[checkoutBusy,setCheckoutBusy]=useState(false),[orderError,setOrderError]=useState(''),[checkoutLink,setCheckoutLink]=useState('');
 const checkoutTokenRef=useRef(null);
 const [revealPersonal,setRevealPersonal]=useState(false),[includePersonalCsv,setIncludePersonalCsv]=useState(false);
 const [orderQuery,setOrderQuery]=useState(''),[orderSearchApplied,setOrderSearchApplied]=useState(''),[orderPage,setOrderPage]=useState(1),[orderDay,setOrderDay]=useState(()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10)),[orderMode,setOrderMode]=useState('all'),[orderStatus,setOrderStatusFilter]=useState('all');
 const orderRequestSeqRef=useRef(0);
 const lastCatalogFetchRef=useRef(0);
 const [opsDate,setOpsDate]=useState('all'),[opsGender,setOpsGender]=useState('all'),[opsShowPersonal,setOpsShowPersonal]=useState(false);
 const [handoverRecords,setHandoverRecords]=useState({}),[handoverBusy,setHandoverBusy]=useState(null);
 const [allStudentOrders,setAllStudentOrders]=useState([]),[opsLoading,setOpsLoading]=useState(false),[opsError,setOpsError]=useState(''),[opsLoaded,setOpsLoaded]=useState(false);
 const [carts,setCarts]=useState(()=>read('multi-carts-v3',{general:{},student:{}}));
 const [mode,setMode]=useState(routeMode),[page,setPage]=useState(()=>routeMode()?'stores':'home'),[storeId,setStoreId]=useState(null),[search,setSearch]=useState(''),[storeSearch,setStoreSearch]=useState('');
 const [showQuickBack,setShowQuickBack]=useState(false);
 const [showGuide,setShowGuide]=useState(false);
 const [guideStep,setGuideStep]=useState(0);
 const [guideIsAutomatic,setGuideIsAutomatic]=useState(false);
 const guideCloseRef=useRef(null);
 const guideDialogRef=useRef(null);
 const guideAutoCheckedRef=useRef(false);
 const [admin,setAdmin]=useState(window.location.pathname.replace(/\/$/,'')==='/admin'),[tab,setTab]=useState('overview'),[editing,setEditing]=useState(null);
 const [showFinanceMore,setShowFinanceMore]=useState(false);
 const [brandingByMode,setBrandingByMode]=useState(DEFAULT_BRANDING);
 const [brandingLoadError,setBrandingLoadError]=useState('');
 // Branding hanya data publik tampilan; terpisah dari transaksi & stok.
 useEffect(()=>{
  if(!configured)return;
  let active=true;
  supabase.from('catalog_branding_v331').select('mode,display_name,logo_url,primary_color,soft_color').then(({data,error})=>{
   if(!active)return;
   if(error){setBrandingLoadError(error.message);return;}
   const next={student:DEFAULT_BRANDING.student,general:DEFAULT_BRANDING.general};
   for(const row of (data||[]))if(row.mode in next)next[row.mode]=normalizeBranding(row.mode,row);
   setBrandingByMode(next);setBrandingLoadError('');
  }).catch(error=>{if(active)setBrandingLoadError(error?.message||'Gagal memuat pengaturan tampilan');});
  return()=>{active=false};
 },[]);
 async function saveBranding(mode,record){
  if(!isAdminUser)throw new Error('Hanya admin yang boleh mengubah tampilan.');
  const {data,error}=await supabase.from('catalog_branding_v331')
   .upsert(record,{onConflict:'mode'}).select('mode,display_name,logo_url,primary_color,soft_color').single();
  if(error)throw new Error('Gagal menyimpan ke Supabase: '+error.message);
  setBrandingByMode(prev=>({...prev,[mode]:normalizeBranding(mode,data)}));
 }
 const customerBrand=mode&&brandingByMode[mode]?brandingByMode[mode]:null;

 // Pengunjung hanya mengambil katalog: tidak menghabiskan koneksi Realtime per HP.
 async function refreshCatalog(){
  const {data,error}=await supabase.from('catalog_state').select('data').eq('id',1).single();
  if(error)throw error;
  lastCatalogFetchRef.current=Date.now();
  remoteUpdate.current=true;
  setDb({stores:data.data.stores||[],products:data.data.products||[],settings:{...DEMO.settings,...data.data.settings}});
  setLoaded(true);
  setSyncState('Terhubung ke Supabase');
 }
 useEffect(()=>{
  if(!configured)return;
  let active=true;
  supabase.from('catalog_state').select('data').eq('id',1).single().then(({data,error})=>{
   if(!active)return;
   if(error){setCloudError('Gagal memuat katalog: '+error.message);setSyncState('Koneksi bermasalah');return}
   remoteUpdate.current=true;
   setDb({stores:data.data.stores||[],products:data.data.products||[],settings:{...DEMO.settings,...data.data.settings}});
   lastCatalogFetchRef.current=Date.now();
   initialLoad.current=true;setLoaded(true);setSyncState('Terhubung ke Supabase');
  }).catch(error=>{
   if(!active)return;
   setCloudError('Gagal memuat katalog: '+(error?.message||'Koneksi terputus'));
   setSyncState('Koneksi bermasalah');
  });
  return()=>{active=false};
 },[]);
 // Hanya admin aktif yang mendengarkan perubahan katalog; pelanggan tidak membuka WebSocket.
 useEffect(()=>{
  if(!configured||!isAdminUser||!admin)return;
  let active=true;
  const channel=supabase.channel('catalog-admin-changes-v323').on('postgres_changes',{event:'UPDATE',schema:'public',table:'catalog_state',filter:'id=eq.1'},payload=>{
   if(!active||!payload.new?.data)return;
   remoteUpdate.current=true;
   setDb({stores:payload.new.data.stores||[],products:payload.new.data.products||[],settings:{...DEMO.settings,...payload.new.data.settings}});
   lastCatalogFetchRef.current=Date.now();setSyncState('Data diperbarui');
  }).subscribe();
  return()=>{active=false;supabase.removeChannel(channel)};
 },[isAdminUser,admin]);
 // Saat pembeli kembali ke tab setelah >2 menit, segarkan tampilan stok tanpa Realtime.
 useEffect(()=>{
  if(!configured||admin)return;
  const onVisible=()=>{if(document.visibilityState==='visible'&&Date.now()-lastCatalogFetchRef.current>120000){
   refreshCatalog().catch(()=>{}); // Validasi final harga/stok tetap oleh RPC checkout.
  }};
  document.addEventListener('visibilitychange',onVisible);
  return()=>document.removeEventListener('visibilitychange',onVisible);
 },[admin]);
 useEffect(()=>{if(!configured)return;let active=true;supabase.auth.getUser().then(({data})=>{if(active)setAuthUser(data.user||null)}).finally(()=>{if(active)setAuthBusy(false)});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(active){setAuthUser(session?.user||null);setIsAdminUser(false)}});return()=>{active=false;subscription.unsubscribe()}},[]);
 useEffect(()=>{if(!configured||!authUser){setIsAdminUser(false);return}let active=true;supabase.from('admin_users').select('user_id').eq('user_id',authUser.id).maybeSingle().then(({data,error})=>{if(active){setIsAdminUser(Boolean(data&&!error));if(error)setCloudError('Verifikasi admin gagal: '+error.message)}});return()=>{active=false}},[authUser?.id]);
 useEffect(()=>{if(!initialLoad.current||!isAdminUser)return;if(remoteUpdate.current){remoteUpdate.current=false;return}setSyncState('Menyimpan perubahan...');const timer=setTimeout(async()=>{const {error}=await supabase.rpc('save_catalog_v10',{p_data:db});if(error){setCloudError('Gagal menyimpan: '+error.message);setSyncState('Gagal menyimpan')}else{setCloudError('');setSyncState('Tersimpan di Supabase')}},450);return()=>clearTimeout(timer)},[db,isAdminUser]);
 // Tutorial hanya muncul sekali per browser, setelah katalog siap; admin tidak terganggu.
 useEffect(()=>{
  if(!configured||!loaded||admin||guideAutoCheckedRef.current)return;
  guideAutoCheckedRef.current=true;
  let sudahPernah=false;
  try{sudahPernah=localStorage.getItem(GUIDE_STORAGE_KEY)==='1'}catch{/* Mode privat mungkin membatasi penyimpanan. */}
  if(!sudahPernah){setGuideStep(0);setGuideIsAutomatic(true);setShowGuide(true)}
 },[loaded,admin,page,mode]);
 function closeGuide(){
  try{localStorage.setItem(GUIDE_STORAGE_KEY,'1')}catch{/* Tutup tetap berfungsi tanpa localStorage. */}
  setShowGuide(false);
 }
 function openGuideManually(){setGuideStep(0);setGuideIsAutomatic(false);setShowGuide(true)}
 // Aksesibilitas: Escape menutup, fokus tetap di dialog, halaman belakang tidak bergulir.
 useEffect(()=>{
  if(!showGuide)return;
  const oldOverflow=document.body.style.overflow;
  const previousFocus=document.activeElement;
  document.body.style.overflow='hidden';
  guideCloseRef.current?.focus();
  const onKeyDown=e=>{
   if(e.key==='Escape'){e.preventDefault();closeGuide();return}
   if(e.key!=='Tab')return;
   const buttons=guideDialogRef.current?.querySelectorAll('button:not([disabled])');
   if(!buttons?.length)return;
   const first=buttons[0],last=buttons[buttons.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  };
  document.addEventListener('keydown',onKeyDown);
  return()=>{
   document.removeEventListener('keydown',onKeyDown);
   document.body.style.overflow=oldOverflow;
   if(previousFocus?.isConnected&&typeof previousFocus.focus==='function')previousFocus.focus();
  };
 },[showGuide]);
 // Tombol Kembali tetap terjangkau di HP ketika daftar toko atau produk panjang.
 useEffect(()=>{
  const onScroll=()=>setShowQuickBack(window.scrollY>240);
  window.addEventListener('scroll',onScroll,{passive:true});
  onScroll();
  return()=>window.removeEventListener('scroll',onScroll);
 },[]);
 useEffect(()=>{localStorage.setItem('multi-carts-v3',JSON.stringify(carts))},[carts]);
 useEffect(()=>{const cb=()=>{const nextMode=routeMode();setAdmin(activeRoute()==='/admin');setMode(nextMode);setStoreId(null);setPage(nextMode?'stores':'home');setSearch('');setStoreSearch('');checkoutTokenRef.current=null;setEditing(null);window.scrollTo(0,0)};window.addEventListener('popstate',cb);return()=>window.removeEventListener('popstate',cb)},[]);
 const ORDERS_PAGE_SIZE=50;
 async function loadOrders(){
  const requestId=++orderRequestSeqRef.current;
  setOrdersLoading(true);setOrderLoadError('');
  try{
   const {data,error}=await supabase.rpc('admin_find_orders_v323',{
    p_page:orderPage,p_page_size:ORDERS_PAGE_SIZE,p_search:orderSearchApplied,
    p_mode:orderMode,p_status:orderStatus,p_day:orderDay||null
   });
   if(error)throw error;
   if(requestId!==orderRequestSeqRef.current)return;
   const pageRows=Array.isArray(data?.orders)?data.orders:[];
   setOrders(pageRows);
   setOrderCount(Number(data?.total||0));
   // Riwayat hanya pesanan di halaman ini, bukan dibatasi 500 terbaru dari semua pesanan.
   if(pageRows.length){
    const {data:logs,error:logError}=await supabase.from('order_status_history')
      .select('order_id,old_status,new_status,created_at')
      .in('order_id',pageRows.map(o=>o.id)).order('created_at',{ascending:false}).limit(1000);
    if(requestId!==orderRequestSeqRef.current)return;
    if(logError){setHistory([]);setOrderLoadError('Riwayat status belum bisa dimuat: '+logError.message)}
    else setHistory(logs||[]);
   }else setHistory([]);
  }catch(e){
   if(requestId===orderRequestSeqRef.current){setOrderLoadError('Gagal memuat pesanan: '+e.message);setOrders([]);setOrderCount(0)}
  }finally{if(requestId===orderRequestSeqRef.current)setOrdersLoading(false)}
 }
 useEffect(()=>{const timer=setTimeout(()=>{setOrderPage(1);setOrderSearchApplied(orderQuery.trim())},350);return()=>clearTimeout(timer)},[orderQuery]);
 useEffect(()=>{if(isAdminUser&&admin&&tab==='orders')loadOrders()},[isAdminUser,admin,tab,orderPage,orderMode,orderStatus,orderDay,orderSearchApplied]);
 async function loadAllStudentOrders(){
  if(!isAdminUser)return;setOpsLoading(true);setOpsError('');setOpsLoaded(false);
  try{const batch=500;let offset=0;const collected=[];while(true){const {data,error}=await supabase.from('orders').select('*').eq('mode','student').order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+batch-1);if(error)throw error;collected.push(...(data||[]));if((data||[]).length<batch)break;offset+=batch;}setAllStudentOrders(collected);const {data:handovers,error:handoverError}=await supabase.from('student_handovers').select('order_id,handed_at,officer_name,notes,recipient_name,receipt_method');if(handoverError)throw handoverError;setHandoverRecords(Object.fromEntries((handovers||[]).map(h=>[h.order_id,h])));setOpsLoaded(true);}
  catch(e){setOpsError('Gagal memuat laporan lengkap: '+e.message);setAllStudentOrders([])}finally{setOpsLoading(false)}
 }
 async function recordHandover(order){
  if(!isAdminUser||handoverRecords[order.id]||handoverBusy)return;
  if(['cancelled','expired'].includes(order.status)||order.expired_at)return alert('Pesanan batal/kedaluwarsa tidak bisa diserahkan.');
  if(!['paid','prepared','completed'].includes(order.status))return alert('Verifikasi pembayaran terlebih dahulu melalui kasir sebelum pencatatan penyerahan.');
  const officer=window.prompt('Nama petugas yang menyerahkan barang:');if(officer===null)return;
  if(!officer.trim()||officer.trim().length>100)return alert('Isi nama petugas (maksimal 100 karakter).');
  const recipient=window.prompt('Nama penerima kiriman (santri atau perwakilan pondok):');if(recipient===null)return;
  if(recipient.trim().length<2||recipient.trim().length>100)return alert('Nama penerima wajib 2–100 karakter.');
  const kind=window.prompt('Cara penerimaan: tulis 1 untuk langsung oleh santri, atau 2 untuk perwakilan pondok','1');if(kind===null)return;
  if(!['1','2'].includes(kind.trim()))return alert('Pilih 1 atau 2.');
  const receiptMethod=kind.trim()==='1'?'langsung':'perwakilan_pondok';
  if(!window.confirm(`Konfirmasi barang sudah benar-benar diserahkan untuk pesanan #${order.id.slice(0,8).toUpperCase()} kepada ${recipient.trim()} oleh ${officer.trim()}? Pencatatan hanya dapat dilakukan sekali.`))return;
  setHandoverBusy(order.id);
  try{const {error}=await supabase.rpc('admin_receipt_v21',{p_order_id:order.id,p_officer_name:officer.trim(),p_recipient_name:recipient.trim(),p_receipt_method:receiptMethod});if(error)throw error;await loadAllStudentOrders();await loadOrders();}
  catch(e){alert('Gagal mencatat serah-terima: '+e.message)}finally{setHandoverBusy(null)}
 }
 async function expireReservations(){if(!window.confirm('Batalkan pesanan yang masih menunggu konfirmasi lebih dari 2 jam dan kembalikan stok? Pesanan yang telah dikonfirmasi/dibayar tidak terpengaruh.'))return;setExpiryBusy(true);try{const {data,error}=await supabase.rpc('expire_pending_orders_v8',{p_limit:100});if(error)throw error;await loadOrders();alert(`${data} pesanan kedaluwarsa diproses. Jalankan lagi jika masih ada lebih dari 100 pesanan tertunda.`)}catch(e){alert('Gagal memeriksa reservasi: '+e.message)}finally{setExpiryBusy(false)}}
 async function setOrderStatus(order,value){if(value==='cancelled'&&!window.confirm('Batalkan pesanan ini? Stok yang direservasi akan dikembalikan.'))return;const {data,error}=await supabase.rpc('update_order_status_v7',{p_order_id:order.id,p_status:value});if(error)return alert('Gagal mengubah status: '+error.message);setOrders(prev=>prev.map(o=>o.id===order.id?data:o));await loadOrders()}
 // Hasil sudah difilter di database, tidak hanya dari 200 pesanan terakhir.
 const filteredOrders=orders;
 const orderPages=Math.max(1,Math.ceil(orderCount/ORDERS_PAGE_SIZE));
 const studentOrders=allStudentOrders.filter(o=>o.delivery_date);
 const operationDates=[...new Set(studentOrders.map(o=>o.delivery_date))].sort();
 const opsOrders=studentOrders.filter(o=>(opsDate==='all'||o.delivery_date===opsDate)&&(opsGender==='all'||o.student_gender===opsGender));
 const activeOps=opsOrders.filter(o=>!['cancelled','expired'].includes(o.status)&&!o.expired_at);
 const opsByStatus=(status)=>activeOps.filter(o=>o.status===status).length;
 const handedOverCount=activeOps.filter(o=>Boolean(handoverRecords[o.id])).length;
 const pendingDeliveryCount=activeOps.filter(o=>['paid','prepared','completed'].includes(o.status)&&!handoverRecords[o.id]).length;
 const opsTotal=activeOps.reduce((sum,o)=>sum+Number(o.total_estimate||0),0);
 const opsGroups=operationDates.map(d=>({date:d,male:studentOrders.filter(o=>o.delivery_date===d&&o.student_gender==='male'&&!['cancelled','expired'].includes(o.status)&&!o.expired_at).length,female:studentOrders.filter(o=>o.delivery_date===d&&o.student_gender==='female'&&!['cancelled','expired'].includes(o.status)&&!o.expired_at).length}));
 function printPreparation(){
  if(!opsLoaded||opsLoading||opsError)return alert('Tunggu sampai laporan lengkap selesai dimuat.');
  if(!opsOrders.length)return alert('Belum ada kiriman pada filter ini.');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const masked=v=>opsShowPersonal?String(v||'—'):maskName(v);
  const html=`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Daftar Persiapan Kiriman</title><style>body{font:14px Arial;padding:24px;color:#111}table{border-collapse:collapse;width:100%}th,td{padding:8px;border:1px solid #bbb;text-align:left;vertical-align:top}h1{font-size:22px}.muted{color:#555}@media print{button{display:none}}</style></head><body><h1>Daftar Persiapan Kiriman Santri</h1><p>${esc(opsDate==='all'?'Semua tanggal':opsDate)} · ${esc(opsGender==='all'?'Putra & Putri':opsGender==='male'?'Putra':'Putri')} · ${esc(opsOrders.length)} pesanan (termasuk yang dibatalkan)</p><p class="muted">Laporan paginasi seluruh pesanan santri. Periksa ulang sebelum penyerahan. Status pembayaran harus dikonfirmasi kasir.</p><table><thead><tr><th>Pesanan</th><th>Tanggal</th><th>Tujuan</th><th>Santri / Kamar</th><th>Produk</th><th>Status</th><th>Serah-terima & penerima</th><th>Checklist</th></tr></thead><tbody>${opsOrders.map(o=>`<tr><td>${esc(o.id.slice(0,8).toUpperCase())}</td><td>${esc(o.delivery_date)}</td><td>${o.student_gender==='male'?'Putra':'Putri'}</td><td>${esc(masked(o.student_name))} / ${esc(opsShowPersonal?o.student_room:'[disamarkan]')}</td><td>${esc((o.items||[]).map(i=>`${i.store_name}: ${i.product_name} x${i.quantity}`).join('; '))}</td><td>${esc(o.status)}${o.expired_at?' (kedaluwarsa)':''}</td><td>${handoverRecords[o.id]?esc('Diserahkan '+handoverRecords[o.id].handed_at+' oleh '+(opsShowPersonal?handoverRecords[o.id].officer_name:'[petugas disamarkan]')+'; penerima: '+(opsShowPersonal?(handoverRecords[o.id].recipient_name||'[catatan lama]'):'[disamarkan]')+'; metode: '+(handoverRecords[o.id].receipt_method||'[catatan lama]')):'Belum tercatat'}</td><td>☐ Disiapkan ☐ Diserahkan</td></tr>`).join('')}</tbody></table><p><button onclick="window.print()">Cetak / Simpan PDF</button></p></body></html>`;
  const w=window.open('','_blank');if(!w)return alert('Izinkan pop-up untuk mencetak daftar.');w.document.write(html);w.document.close();
 }
 function exportPreparation(){
  if(!opsLoaded||opsLoading||opsError)return alert('Laporan belum selesai dimuat.');
  if(!opsOrders.length)return alert('Tidak ada kiriman untuk diekspor.');
  if(opsShowPersonal&&!window.confirm('CSV ini berisi nama dan kamar santri. Lanjutkan?'))return;
  const safe=v=>{let x=String(v??'').replace(/[\r\n]/g,' ');if(/^[\s]*[=+@-]/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"'};
  const rows=[['Nomor Pesanan','Tanggal Penyerahan','Tujuan','Nama Santri','Kamar','Status','Petugas Penyerahan','Waktu Penyerahan','Nama Penerima','Metode Penerimaan','Produk','Nilai Estimasi'],...opsOrders.map(o=>[o.id,o.delivery_date,o.student_gender==='male'?'Putra':'Putri',opsShowPersonal?o.student_name:maskName(o.student_name),opsShowPersonal?o.student_room:'[disamarkan]',o.status,(opsShowPersonal?handoverRecords[o.id]?.officer_name:'[disamarkan]')||'',handoverRecords[o.id]?.handed_at||'',opsShowPersonal?(handoverRecords[o.id]?.recipient_name||''):'[disamarkan]',handoverRecords[o.id]?.receipt_method||'',(o.items||[]).map(i=>`${i.store_name}: ${i.product_name} x${i.quantity}`).join('; '),o.total_estimate])];
  const csv='\uFEFF'+rows.map(r=>r.map(safe).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`kiriman-santri-${opsDate==='all'?'semua':opsDate}-${opsGender}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function exportOrders(){
  if(!filteredOrders.length)return alert('Tidak ada pesanan untuk diekspor.');
  if(includePersonalCsv&&!window.confirm('CSV akan memuat nomor WhatsApp, nama santri, kamar, dan catatan yang mungkin sensitif. Lanjutkan ekspor lengkap?'))return;
  const columns=['ID','Waktu','Jenis','Nama Pemesan','WA Pemesan','Nama Santri','Kamar','Putra/Putri','Tanggal Penyerahan','Penerima Pengiriman','Alamat Pengiriman','Kelurahan / Kecamatan','Kota / Kabupaten','Patokan','Metode Pembayaran','Total Estimasi','Status','Kasir WA','Ringkasan Produk','Catatan'];
  const safe=v=>{let x=String(v??'').replace(/\r|\n/g,' ');if(/^[\s]*[=+@-]/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"'};
  const lines=[columns,...filteredOrders.map(o=>[o.id,o.created_at,o.mode==='student'?'Santri':'Umum',includePersonalCsv?o.customer_name:maskName(o.customer_name),includePersonalCsv?o.customer_phone:maskPhone(o.customer_phone),includePersonalCsv?o.student_name:maskName(o.student_name),includePersonalCsv?o.student_room:'[disamarkan]',o.student_gender==='male'?'Putra':o.student_gender==='female'?'Putri':'',o.delivery_date,includePersonalCsv?o.shipping_recipient:'[disamarkan]',includePersonalCsv?o.shipping_address:'[disamarkan]',includePersonalCsv?o.shipping_area:'[disamarkan]',includePersonalCsv?o.shipping_city:'[disamarkan]',includePersonalCsv?o.shipping_landmark:'[disamarkan]',o.payment_method,o.total_estimate,o.status,includePersonalCsv?o.cashier_wa:maskPhone(o.cashier_wa),(o.items||[]).map(i=>`${i.store_name}: ${i.product_name} x${i.quantity}`).join('; '),includePersonalCsv?o.note:'[disamarkan]'])];
  const blob=new Blob(['\uFEFF'+lines.map(row=>row.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`rekap-pesanan-${includePersonalCsv?'lengkap':'privat'}-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const maskPhone=v=>{const digits=String(v||'');return !digits?'—':digits.length>4?'••••••'+digits.slice(-4):'••••'};
 const maskName=v=>v?String(v).slice(0,1)+'••••':'—';
 const store=db.stores.find(s=>s.id===storeId);
 const visibleProducts=useMemo(()=>db.products.filter(p=>audienceOK(p,mode||'general')&&db.stores.some(s=>s.id===p.storeId&&s.active)),[db,mode]);
 const products=visibleProducts.filter(p=>p.storeId===storeId&&(p.name.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID'))||(p.variantBaseName||'').toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID'))));
 const productCards=groupProducts(products);
 const cart=carts[mode]||{};
 const rows=Object.entries(cart).map(([id,qty])=>({p:db.products.find(p=>p.id===id),qty})).filter(x=>x.p&&x.qty>0&&db.stores.some(s=>s.active&&s.id===x.p.storeId)&&audienceOK(x.p,mode));
 const generalCheckoutStore=db.stores.find(s=>s.id===rows[0]?.p.storeId) || store;
 const total=rows.reduce((sum,x)=>sum+x.qty*x.p.price,0),count=rows.reduce((sum,x)=>sum+x.qty,0);
 const availableDates=dates(db.settings.deliveryDays||[2,5]);
 function navigateHome(){const lane=routeMode();checkoutTokenRef.current=null;setMode(lane);setStoreId(null);setPage(lane?'stores':'home');setSearch('');setStoreSearch('');window.scrollTo(0,0)}
 function selectCustomerLane(nextMode){const route=nextMode==='student'?'/santri':'/umum';if(activeRoute()!==route)window.history.replaceState({},'',route);checkoutTokenRef.current=null;setMode(nextMode);setPage('stores');setStoreId(null);setSearch('');setStoreSearch('');window.scrollTo(0,0)}
 function backToShop(){if(page==='stores')return;else if(page==='store')setPage('stores');else if(page==='cart')setPage(storeId?'store':'stores');window.scrollTo(0,0)}
 function openCart(){setPage('cart');window.scrollTo(0,0)}
 function updateCart(fn){checkoutTokenRef.current=null;setCarts(prev=>({...prev,[mode]:fn(prev[mode]||{})}))}
 function add(p){updateCart(prev=>{let current={...prev};if(mode==='general')current=Object.fromEntries(Object.entries(current).filter(([id])=>db.products.find(x=>x.id===id)?.storeId===p.storeId));return {...current,[p.id]:Math.min(p.stock,(current[p.id]||0)+1)}})}
 function changeQty(p,qty){updateCart(prev=>{const next={...prev};if(qty<=0)delete next[p.id];else next[p.id]=Math.min(p.stock,qty);return next})}
 async function checkout(e){e.preventDefault();if(checkoutBusy)return;setOrderError('');setCheckoutLink('');if(!rows.length)return alert('Keranjang kosong.');if(rows.some(({p,qty})=>qty>p.stock))return alert('Ada jumlah pesanan yang melebihi stok.');const f=new FormData(e.currentTarget),name=String(f.get('name')||'').trim(),pay='Transfer bank';
 if(!name)return alert('Nama pemesan wajib diisi.');let target='',extra='',bankInfo='';
 let shipping={};
 if(mode==='general'){try{shipping=readGeneralShipping(f)}catch(shippingError){setOrderError(shippingError.message);return}}
 if(mode==='student'){
 const student=String(f.get('student')||'').trim(),room=String(f.get('room')||'').trim(),gender=String(f.get('gender')),delivery=String(f.get('delivery'));
 if(!student||!room||!availableDates.some(d=>d.iso===delivery))return alert('Isi identitas santri dan pilih tanggal penyerahan yang tersedia.');
 target=waNumber(gender==='male'?db.settings.maleWa:db.settings.femaleWa);
 if(!validWa(target))return alert(`Nomor WhatsApp kasir kiriman ${gender==='male'?'putra':'putri'} belum diatur admin.`);
 bankInfo=transferInfo(gender==='male'?db.settings.malePayment:db.settings.femalePayment);
 extra=`\nLayanan: *KIRIMAN SANTRI ${gender==='male'?'PUTRA':'PUTRI'}*\nNama santri: ${student}\nKamar/kelas: ${room}\nTanggal penyerahan: ${availableDates.find(d=>d.iso===delivery)?.label}\n`;
 }else{
 target=waNumber(generalCheckoutStore?.wa);if(!validWa(target))return alert('Nomor WhatsApp kasir toko belum valid. Hubungi admin toko untuk mengatur nomor kasir.');bankInfo=transferInfo(generalCheckoutStore?.paymentInfo);extra=`\nLayanan: *BELANJA UMUM - KIRIM KE ALAMAT*\nToko: ${generalCheckoutStore.name}\n`+generalShippingWhatsApp(shipping);
 }
 let checkoutToken,clientRef;
 try {
  // Pakai ulang token UUID untuk retry; token legacy `id-...` tidak boleh dikirim ke RPC.
  checkoutToken=getOrCreateCheckoutToken(checkoutTokenRef.current);
  clientRef=getOrCreateCheckoutClientRef();
 } catch (tokenError) {
  setOrderError(tokenError.message);
  return;
 }
 const orderPayload={checkout_token:checkoutToken,client_ref:clientRef,mode,customer_name:name,...shipping,student_name:mode==='student'?String(f.get('student')||'').trim():null,student_room:mode==='student'?String(f.get('room')||'').trim():null,student_gender:mode==='student'?String(f.get('gender')):null,delivery_date:mode==='student'?String(f.get('delivery')):null,payment_method:pay,note:String(f.get('note')||''),items:rows.map(({p,qty})=>({product_id:p.id,quantity:qty}))};
 checkoutTokenRef.current=orderPayload.checkout_token;
 setCheckoutBusy(true);
 const startedAt=performance.now();
 let created,error;
 try {
  const result=await supabase.rpc('create_checkout_v33',{p_order:orderPayload});
  created=result.data;error=result.error;
 } catch(e) {error=e}
 finally {setCheckoutBusy(false)}
 if(error){
  const elapsedMs=Math.round(performance.now()-startedAt);
  // Tidak mencatat identitas santri, nomor WA, atau token ke console.
  console.warn('[Katalog Darel] checkout error',{elapsedMs,code:error.code||'network'});
  const networkProblem=/fetch|network|timeout|gateway|connection/i.test(error.message||'');
  setOrderError(networkProblem
   ?'Koneksi terganggu. Belum bisa dipastikan apakah pesanan tercatat. Jangan membuat pesanan baru; tekan kembali tombol pesan yang sama untuk mencoba aman.'
   :'Pesanan belum dapat dilanjutkan: '+error.message+'. Periksa data atau hubungi kasir bila perlu.');
  if(/stok|produk|harga/i.test(error.message||''))refreshCatalog().catch(()=>{});
  return;
 }
 console.info('[Katalog Darel] checkout success',{elapsedMs:Math.round(performance.now()-startedAt)});
 const orderId=created.id,targetWa=created.cashier_wa,confirmedTotal=Number(created.total);
 const confirmedItems=created.items||[];
 const grouped=[...new Set(confirmedItems.map(x=>x.store_id))].map(id=>{const storeItems=confirmedItems.filter(x=>x.store_id===id);return `*${storeItems[0]?.store_name||'Toko'}*\n`+storeItems.map(x=>`- ${x.product_name} x${x.quantity}: ${money(x.subtotal)}`).join('\n')}).join('\n\n');
 const finalMessage=`Halo kasir, saya ingin membuat pesanan.\n*No. Pesanan: ${orderId.slice(0,8).toUpperCase()}*\n*ID Lengkap: ${orderId}*\n${extra}\n${grouped}\n\n*TOTAL BARANG: ${money(confirmedTotal)}*${mode==='general'?'\n*Belum termasuk ongkos kirim.*':''}\nNama pemesan: ${name}\nMetode bayar: Transfer bank\n\n*REKENING TRANSFER*\n${bankInfo||'Nomor rekening belum diatur admin. Mohon kirim rekening resmi sebelum saya transfer.'}\n\nCatatan: ${String(f.get('note')||'-')}\n\nMohon kasir mengonfirmasi ${mode==='general'?'ongkos kirim dan ':''}total akhir sebelum saya melakukan transfer. Bukti transfer akan dikirim di percakapan ini.`;
 const url=`https://wa.me/${targetWa}?text=${encodeURIComponent(finalMessage)}`;
 setCheckoutLink(url);setOrderError('Pesanan '+orderId.slice(0,8).toUpperCase()+' tersimpan. Silakan lanjutkan lewat WhatsApp kasir. Jika WhatsApp tidak terbuka, klik tautan yang tersedia.');
 window.open(url,'_blank','noopener,noreferrer');
 refreshCatalog().catch(()=>{}); // Perbarui stok lokal setelah checkout berhasil.
 // Token dipertahankan sampai pengguna memulai keranjang baru agar klik ulang tidak membuat pesanan ganda.

 }
 function saveStore(e){
  e.preventDefault();const f=new FormData(e.currentTarget),name=String(f.get('name')||'').trim(),wa=waNumber(f.get('wa'));
  if(!name||!validWa(wa))return alert('Nama dan nomor WA kasir wajib valid.');
  if(f.get('coverImagesPending')==='yes'||f.get('logoImagesPending')==='yes')return alert('Tunggu semua foto selesai diunggah.');
  let coverImages,logoImages;
  try {coverImages=readPhotoField(f,'coverImages','',1);logoImages=readPhotoField(f,'logoImages','',1);}catch(err){return alert(err.message);}
  const record={...editing,id:editing?.id||uid(),name,wa,description:String(f.get('description')||'').trim(),paymentInfo:String(f.get('paymentInfo')||'').trim(),active:editing?.active??true,coverImage:coverImages[0]||'',logoImage:logoImages[0]||''};
  setDb(prev=>({...prev,stores:editing?.id?prev.stores.map(s=>s.id===editing.id?record:s):[...prev.stores,record]}));setEditing(null);
 }
 async function saveProduct(e){
  e.preventDefault();const f=new FormData(e.currentTarget);
  if(f.get('imagesPending')==='yes')return alert('Tunggu foto selesai diunggah.');
  let images;
  try {images=readPhotoField(f,'images');}catch(err){return alert(err.message);}
  const record={...editing,id:editing?.id||uid(),storeId:String(f.get('storeId')),name:String(f.get('name')||'').trim(),category:String(f.get('category')||'').trim(),price:Number(f.get('price')),stock:Number(f.get('stock')),image:images[0]||'',images,audience:String(f.get('audience')||'both')};
  if(!record.name||!db.stores.some(s=>s.id===record.storeId)||!Number.isFinite(record.price)||record.price<0||!Number.isInteger(record.stock)||record.stock<0)return alert('Periksa kembali data produk.');
  if(editing?.id && record.stock!==editing.stock){const {error:stockError}=await supabase.rpc('set_product_stock_v10',{p_product_id:record.id,p_new_stock:record.stock});if(stockError)return alert('Stok gagal disimpan: '+stockError.message+'; perubahan lain belum disimpan.');}
  setDb(prev=>({...prev,products:editing?.id?prev.products.map(p=>p.id===editing.id?record:p):[...prev.products,record]}));setEditing(null);
 }
 async function saveVariantGroup(input) {
  const existingGroup=editing?.variantGroupId || null;
  const prior=db.products.filter(p=>p.variantGroupId===existingGroup && existingGroup);
  const groupId=existingGroup || uid();
  if(!input.variants.length)throw new Error('Isi minimal satu variasi.');
  if(prior.length && prior.some(p=>!input.variants.some(v=>v.id===p.id)))throw new Error('Variasi yang sudah tersimpan tidak boleh dihapus, agar pengembalian stok pesanan lama tidak rusak.');
  const images=normalizePhotos(input.images);
  const image=images[0]||'';
  const records=makeVariantProducts({...input,image,images,groupId,generateId:uid});
  const stockUpdates=records.filter(p=>prior.some(v=>v.id===p.id && v.stock!==p.stock));
  // Stok lama hanya boleh diubah melalui RPC yang mengunci baris katalog.
  // Simpan metadata lewat save_catalog_v10; RPC itu mempertahankan stok DB aktual.
  for(const row of stockUpdates){
    const {error}=await supabase.rpc('set_product_stock_v10',{p_product_id:row.id,p_new_stock:row.stock});
    if(error){await refreshCatalog().catch(()=>{});throw new Error('Stok sebagian pilihan mungkin sudah berubah. Muat ulang admin sebelum mencoba lagi. Detail: '+error.message);}
  }
  // Simpan langsung lewat RPC terproteksi, bukan menunggu autosave UI.
  // Ini penting karena event Realtime dari pengubahan stok dapat melewati autosave.
  const {data:catalogRow,error:readError}=await supabase.from('catalog_state').select('data').eq('id',1).single();
  if(readError || !catalogRow?.data)throw new Error('Gagal membaca katalog terbaru. Periksa ulang stok, lalu coba kembali. '+(readError?.message||''));
  const freshCatalog=catalogRow.data;
  const freshItems=Array.isArray(freshCatalog.products)?freshCatalog.products:[];
  if(prior.length && prior.some(old=>!freshItems.some(item=>item.id===old.id))){
    throw new Error('Ada variasi yang berubah di database sejak editor dibuka. Muat ulang halaman admin terlebih dahulu.');
  }
  const updatedCatalog={...freshCatalog,products:[...freshItems.filter(p=>p.variantGroupId!==groupId),...records]};
  const {data:saved,error:saveError}=await supabase.rpc('save_catalog_v10',{p_data:updatedCatalog});
  if(saveError || !saved)throw new Error('Variasi belum berhasil disimpan: '+(saveError?.message||'Respons katalog kosong'));
  remoteUpdate.current=true;
  setDb({stores:saved.stores||[],products:saved.products||[],settings:{...DEMO.settings,...saved.settings}});
  setSyncState('Tersimpan di Supabase');
  setEditing(null);
 }
 function removeVariantGroup(groupId){
  if(!window.confirm('Hapus semua variasi produk ini? Pastikan tidak ada pesanan tertunda, sebab produk yang dihapus tidak bisa menerima pengembalian stok.'))return;
  const ids=new Set(db.products.filter(p=>p.variantGroupId===groupId).map(p=>p.id));
  setDb(prev=>({...prev,products:prev.products.filter(p=>!ids.has(p.id))}));
  setCarts(prev=>Object.fromEntries(Object.entries(prev).map(([type,items])=>[type,Object.fromEntries(Object.entries(items).filter(([pid])=>!ids.has(pid)))])));
 }
 function saveSettings(e){e.preventDefault();const f=new FormData(e.currentTarget),settings={maleWa:waNumber(f.get('maleWa')),femaleWa:waNumber(f.get('femaleWa')),malePayment:String(f.get('malePayment')||''),femalePayment:String(f.get('femalePayment')||''),deliveryDays:[...f.getAll('day')].map(Number)};if(settings.maleWa&&!validWa(settings.maleWa)||settings.femaleWa&&!validWa(settings.femaleWa))return alert('Format nomor WhatsApp kasir santri belum valid.');if(!settings.deliveryDays.length)return alert('Pilih minimal satu hari penyerahan.');setDb(prev=>({...prev,settings}));alert('Pengaturan santri berhasil disimpan.');}
 function removeStore(id){if(!confirm('Hapus toko dan semua produknya?'))return;setDb(prev=>({...prev,stores:prev.stores.filter(s=>s.id!==id),products:prev.products.filter(p=>p.storeId!==id)}))}
 function removeProduct(id){if(!confirm('Hapus produk?'))return;setDb(prev=>({...prev,products:prev.products.filter(p=>p.id!==id)}));setCarts(prev=>Object.fromEntries(Object.entries(prev).map(([type,items])=>[type,Object.fromEntries(Object.entries(items).filter(([pid])=>pid!==id))])))}
 const goAdminTab=(target)=>{setTab(target);setEditing(null);};
 const financeTabs=['finance','reconciliation','cash','closewib31','monthlywib','adjustmentsv30','closecash'];
 const isFinanceTab=financeTabs.includes(tab);
 const adminContent=<>
  <section className="adminHero simpleAdminHero"><div><span className="eyebrow">ADMIN UTAMA</span><h1>Kelola Belanja Pondok</h1><p>Pilih pekerjaan yang ingin dikerjakan.</p></div><span className="demoTag">KATALOG DAREL · V33.1</span></section>
  <nav className="simpleAdminNav" aria-label="Menu admin utama">
   <button className={tab==='overview'?'active':''} onClick={()=>goAdminTab('overview')}><ShoppingBag size={18}/> Beranda</button>
   <button className={['stores','products'].includes(tab)?'active':''} onClick={()=>goAdminTab('stores')}><Store size={18}/> Toko &amp; Produk</button>
   <button className={tab==='orders'&&orderMode!=='student'?'active':''} onClick={()=>{setOrderMode('all');goAdminTab('orders')}}><ShoppingBag size={18}/> Semua Pesanan</button>
    <button className={tab==='orders'&&orderMode==='student'?'active':''} onClick={()=>{setOrderMode('student');goAdminTab('orders')}}><GraduationCap size={18}/> Pesanan Santri</button>
   <button className={isFinanceTab?'active':''} onClick={()=>{setShowFinanceMore(false);goAdminTab('finance')}}><ShoppingCart size={18}/> Keuangan</button>
   <button className={['settings','branding'].includes(tab)?'active':''} onClick={()=>goAdminTab('settings')}><Settings size={18}/> Pengaturan</button>
  </nav>
  {['settings','branding'].includes(tab)&&<div className="simpleSubNav" role="group" aria-label="Pengaturan admin">
   <button className={tab==='settings'?'active':''} onClick={()=>goAdminTab('settings')}>Kasir &amp; Jadwal</button>
   <button className={tab==='branding'?'active':''} onClick={()=>goAdminTab('branding')}>Identitas &amp; Tampilan</button>
  </div>}
  {['stores','products'].includes(tab)&&<div className="simpleSubNav" role="group" aria-label="Pilihan kelola katalog">
   <button className={tab==='stores'?'active':''} onClick={()=>goAdminTab('stores')}>Daftar Toko</button>
   <button className={tab==='products'?'active':''} onClick={()=>goAdminTab('products')}>Daftar Produk</button>
  </div>}
  {isFinanceTab&&<div className="simpleFinanceNav">
   <div className="simpleSubNav"><button className={tab==='finance'?'active':''} onClick={()=>goAdminTab('finance')}>Ringkasan Keuangan</button>
   <button type="button" aria-expanded={showFinanceMore} onClick={()=>setShowFinanceMore(v=>!v)}>{showFinanceMore?'Tutup Fitur Lanjutan':'Fitur Keuangan Lanjutan'}</button></div>
   {showFinanceMore&&<div className="simpleAdvanced" role="group" aria-label="Fitur keuangan lanjutan">
    {[['reconciliation','Rekonsiliasi'],['cash','Kas & Koreksi'],['closewib31','Tutup Kas WIB'],['monthlywib','Kas Bulanan WIB'],['adjustmentsv30','Jurnal WIB'],['closecash','Tutup Kas Lama']].map(([key,title])=><button key={key} className={tab===key?'active':''} onClick={()=>goAdminTab(key)}>{title}</button>)}
    <p className="muted">Gunakan fitur lanjutan hanya jika diperlukan. Data lama tetap tersimpan.</p>
   </div>}
  </div>}

{tab==='closewib31'?<DailyCloseWibV31/>:null}{tab==='monthlywib'?<MonthlyWibV28/>:null}{tab==='adjustmentsv30'?<AdjustmentsV30/>:null}{tab==='finance'?<FinanceDashboard/>:null}{tab==='cash'?<CashCorrectionsV26/>:null}{tab==='closecash'?<DailyCloseV27/>:null}{tab==='reconciliation'?<ReconciliationDashboard/>:null}{tab==='orders'?<section className="panel"><div className="sectionHead"><h2>Pesanan ({orderCount} ditemukan · halaman {orderPage} dari {orderPages})</h2><button onClick={loadOrders} disabled={ordersLoading}>{ordersLoading?'Memuat...':'Muat ulang'}</button><button type="button" onClick={expireReservations} disabled={expiryBusy||ordersLoading}>{expiryBusy?"Memeriksa...":"Proses Reservasi >2 Jam"}</button></div><div className="orderFilters"><label>Cari pesanan<input value={orderQuery} onChange={e=>setOrderQuery(e.target.value)} placeholder="Nama, nomor WA, kode pesanan, barang..."/></label><label>Jenis<select value={orderMode} onChange={e=>{setOrderMode(e.target.value);setOrderPage(1)}}><option value="all">Semua</option><option value="general">Umum</option><option value="student">Santri</option></select></label><label>Status<select value={orderStatus} onChange={e=>{setOrderStatusFilter(e.target.value);setOrderPage(1)}}><option value="all">Semua</option><option value="awaiting_confirmation">Menunggu konfirmasi</option><option value="confirmed">Dikonfirmasi</option><option value="paid">Dibayar</option><option value="prepared">Disiapkan</option><option value="completed">Selesai</option><option value="cancelled">Dibatalkan / Kedaluwarsa</option></select></label><label>Tanggal pesanan (WIB)<input type="date" value={orderDay} onChange={e=>{setOrderDay(e.target.value);setOrderPage(1)}}/></label><button type="button" onClick={()=>{setOrderDay('');setOrderPage(1)}}>Semua tanggal</button><label className="privacyToggle"><input type="checkbox" checked={includePersonalCsv} onChange={e=>setIncludePersonalCsv(e.target.checked)}/> CSV data lengkap</label><button type="button" onClick={exportOrders} disabled={!filteredOrders.length}>Unduh CSV</button></div><label className="privacyToggle"><input type="checkbox" checked={revealPersonal} onChange={e=>setRevealPersonal(e.target.checked)}/> Tampilkan data pribadi di layar admin</label><p className="muted">Reservasi yang belum dikonfirmasi lebih dari 2 jam dapat kedaluwarsa. Tombol pemeriksaan hanya memproses maksimal 100 pesanan per klik. Pencarian dan jumlah hasil dihitung oleh Supabase untuk seluruh riwayat. Ekspor CSV hanya untuk 50 pesanan pada halaman ini. CSV secara default menyamarkan data pribadi. Aktifkan opsi data lengkap hanya bila diperlukan dan simpan file secara aman.</p>{orderLoadError&&<p className="errorText" role="alert">{orderLoadError}</p>}{ordersLoading&&<p className="muted" role="status">Memuat pesanan...</p>}
 <div className="simpleOrderPagination"><button type="button" disabled={ordersLoading||orderPage<=1} onClick={()=>setOrderPage(v=>Math.max(1,v-1))}>← Sebelumnya</button><span>Halaman {orderPage} / {orderPages} · {orderCount} pesanan</span><button type="button" disabled={ordersLoading||orderPage>=orderPages} onClick={()=>setOrderPage(v=>v+1)}>Berikutnya →</button></div>
 <p className="muted">Pesanan tercatat sebelum WhatsApp dibuka. Status awal belum berarti pesan WhatsApp sudah terkirim atau pembayaran sudah diterima. Periksa manual bersama kasir.</p>{!filteredOrders.length&&<p>Tidak ada pesanan yang sesuai filter.</p>}{filteredOrders.map(o=><article className="orderCard" key={o.id}><div className="sectionHead"><b>#{o.id.slice(0,8).toUpperCase()} · {o.mode==='student'?'Kiriman Santri':'Umum'}</b><small>{new Date(o.created_at).toLocaleString('id-ID')}</small></div><p><strong>{o.customer_name}</strong> {o.customer_phone?` · ${revealPersonal?o.customer_phone:maskPhone(o.customer_phone)}`:''} {o.student_name?` · Santri: ${o.student_name} (${o.student_gender==='male'?'Putra':'Putri'})`:''}</p>{o.student_room&&<p>Kamar: {revealPersonal?o.student_room:'[disamarkan]'} · Penyerahan: {o.delivery_date}</p>}{o.mode==='general'&&o.shipping_address&&<div className="adminShippingSummary"><b>Alamat pengiriman:</b> {revealPersonal?<span>{o.shipping_recipient} — {o.shipping_address}, {o.shipping_area}, {o.shipping_city}{o.shipping_landmark?` (Patokan: ${o.shipping_landmark})`:''}</span>:<span>[disamarkan — aktifkan tampilkan data pribadi untuk melihat]</span>}</div>}<ul>{(o.items||[]).map((i,n)=><li key={n}>{i.store_name} — {i.product_name} × {i.quantity} = {money(i.subtotal)}</li>)}</ul><p><b>Estimasi {money(o.total_estimate)}</b> · {o.payment_method} · Kasir {revealPersonal?o.cashier_wa:maskPhone(o.cashier_wa)}</p><p className="muted">Stok: {o.stock_reserved?'Direservasi':'Tidak direservasi / dikembalikan'}{o.expired_at?' · Kedaluwarsa otomatis/manual '+new Date(o.expired_at).toLocaleString('id-ID'):''}</p><details><summary>Riwayat status</summary>{history.filter(h=>h.order_id===o.id).map((h,i)=><p key={i} className="muted">{new Date(h.created_at).toLocaleString('id-ID')}: {h.old_status||'—'} → {h.new_status}</p>)}{!history.some(h=>h.order_id===o.id)&&<p className="muted">Belum ada riwayat perubahan status.</p>}</details>{o.note&&<p>Catatan: {revealPersonal?o.note:'[disamarkan]'}</p>}<label>Status<select value={o.status} onChange={e=>setOrderStatus(o,e.target.value)}><option value="awaiting_confirmation">Menunggu konfirmasi kasir</option><option value="confirmed">Dikonfirmasi kasir</option><option value="paid">Pembayaran diterima</option><option value="prepared">Sedang disiapkan</option><option value="completed">Selesai (sesudah konfirmasi kasir)</option><option value="cancelled">Dibatalkan</option></select></label></article>)}</section>:tab==='branding'?<BrandingSettings value={brandingByMode} loadError={brandingLoadError} onSave={saveBranding}/>:tab==='settings'?<section className="panel editor"><h2><Settings size={21}/> Kasir & Jadwal Santri</h2><form onSubmit={saveSettings} key={JSON.stringify(db.settings)}><label>WhatsApp kasir putra<input name="maleWa" placeholder="628xxxxxxxxx" defaultValue={db.settings.maleWa}/></label><label>Rekening transfer putra (bank, nomor rekening, atas nama)<textarea name="malePayment" rows="3" placeholder={'Bank: ...\nNomor rekening: ...\nAtas nama: ...'} defaultValue={db.settings.malePayment}/></label><label>WhatsApp kasir putri<input name="femaleWa" placeholder="628xxxxxxxxx" defaultValue={db.settings.femaleWa}/></label><label>Rekening transfer putri (bank, nomor rekening, atas nama)<textarea name="femalePayment" rows="3" placeholder={'Bank: ...\nNomor rekening: ...\nAtas nama: ...'} defaultValue={db.settings.femalePayment}/></label><b>Hari penyerahan kiriman</b><div className="dayOptions">{['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'].map((label,i)=><label key={i}><input type="checkbox" name="day" value={i} defaultChecked={db.settings.deliveryDays.includes(i)}/>{label}</label>)}</div><p className="muted">Orang tua boleh checkout setiap hari. Pilihan tanggal penyerahan hanya muncul pada hari yang dicentang.</p><button className="primary" type="submit">Simpan Pengaturan</button></form></section>:
 tab==='overview'?<section className="panel simpleOverview"><h2>Ringkasan Hari Ini</h2><p className="muted">Pilih menu di bawah untuk mulai bekerja.</p><div className="simpleOverviewStats"><div><strong>{db.stores.filter(s=>s.active).length}</strong><span>Toko aktif</span></div><div><strong>{groupProducts(db.products).length}</strong><span>Produk</span></div><div><strong>→</strong><span>Buka menu Pesanan untuk melihat daftar terbaru</span></div></div><div className="simpleOverviewActions"><button onClick={()=>goAdminTab('stores')}><Store size={19}/> Kelola toko dan produk</button><button onClick={()=>goAdminTab('orders')}><ShoppingBag size={19}/> Lihat pesanan</button><button onClick={()=>{setOrderMode('student');goAdminTab('orders')}}><GraduationCap size={19}/> Pesanan santri</button></div></section>:
 editing!==null?<section className="panel editor"><button className="back" onClick={()=>setEditing(null)}><ArrowLeft size={17}/> Kembali</button><h2>{editing.id?'Ubah':'Tambah'} {tab==='stores'?'Toko':'Produk'}</h2>{tab==='stores'?<form key={editing.id||'new-store'} onSubmit={saveStore}><label>Nama toko<input name="name" required defaultValue={editing.name||''}/></label><label>WhatsApp kasir<input name="wa" required placeholder="628xxxxxxxxx" defaultValue={editing.wa||''}/></label><label>Deskripsi<textarea name="description" defaultValue={editing.description||''}/></label><label>Rekening transfer toko (bank, nomor rekening, atas nama)<textarea name="paymentInfo" rows="3" placeholder={'Bank: ...\nNomor rekening: ...\nAtas nama: ...'} defaultValue={editing.paymentInfo||''}/></label><PhotoFields key={`cover-${editing.id||'new'}`} title="Foto sampul toko" name="coverImages" max={1} folder="stores" initialUrls={[editing.coverImage].filter(Boolean)}/><PhotoFields key={`logo-${editing.id||'new'}`} title="Logo toko (opsional)" name="logoImages" max={1} folder="stores" initialUrls={[editing.logoImage].filter(Boolean)}/><button className="primary" type="submit">Simpan Toko</button></form>:editing.__newVariantGroup||editing.variantGroupId?<VariantEditor key={editing.variantGroupId||'new-group'} editing={editing} groupVariants={db.products.filter(p=>p.variantGroupId===editing.variantGroupId && editing.variantGroupId)} stores={db.stores} money={money} onSave={saveVariantGroup} onCancel={()=>setEditing(null)}/>:<form key={editing.id||'new-product'} onSubmit={saveProduct}><label>Toko<select name="storeId" required defaultValue={editing.storeId||db.stores[0]?.id}>{db.stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Nama produk<input name="name" required defaultValue={editing.name||''}/></label><label>Kategori<input name="category" defaultValue={editing.category||''}/></label><label>Harga (Rp)<input type="number" name="price" min="0" required defaultValue={editing.price??''}/></label><label>Stok<input type="number" name="stock" min="0" step="1" required defaultValue={editing.stock??0}/></label><label>Tersedia untuk<select name="audience" defaultValue={editing.audience||'both'}><option value="both">Umum & Santri</option><option value="general">Umum saja</option><option value="student">Santri saja</option></select></label><PhotoFields key={`photos-${editing.id||'new'}`} title="Foto produk (maks. 5)" name="images" max={5} folder="products" initialUrls={photoForProduct(editing)}/><button className="primary" type="submit">Simpan Produk</button></form>}</section>:<section className="panel"><div className="sectionHead"><h2>Daftar {tab==='stores'?'Toko':'Produk'}</h2><div className="variantListButtons"><button className="primary" type="button" disabled={tab==='products'&&!db.stores.length} onClick={()=>setEditing({})}><Plus size={17}/> Tambah {tab==='stores'?'Toko':'Produk'}</button>{tab==='products'&&<button className="variantAdd" type="button" disabled={!db.stores.length} onClick={()=>setEditing({__newVariantGroup:true})}><Plus size={17}/> Produk dengan ukuran / warna</button>}</div></div><div className="adminList">{tab==='stores'?db.stores.map(s=><div className="adminRow" key={s.id}><div><b>{s.name}</b><p>{s.wa} · {s.active?'Aktif':'Nonaktif'}</p></div><div className="actions"><button onClick={()=>setDb(prev=>({...prev,stores:prev.stores.map(x=>x.id===s.id?{...x,active:!x.active}:x)}))}>{s.active?'Nonaktifkan':'Aktifkan'}</button><button title="Edit" onClick={()=>setEditing(s)}><Pencil size={17}/></button><button title="Hapus" className="danger" onClick={()=>removeStore(s.id)}><Trash2 size={17}/></button></div></div>):groupProducts(db.products).map(group=>{const p=group.representative;const variants=group.variants;const grouped=Boolean(p.variantGroupId);const totalStock=variants.reduce((sum,v)=>sum+Number(v.stock||0),0);const prices=variants.map(v=>Number(v.price));return <div className="adminRow" key={group.key}><div><b>{grouped?p.variantBaseName:p.name}</b><p>{db.stores.find(s=>s.id===p.storeId)?.name} · {grouped?`${variants.length} pilihan · Harga ${money(Math.min(...prices))}${Math.max(...prices)>Math.min(...prices)?`–${money(Math.max(...prices))}`:''}`:money(p.price)} · Total stok {totalStock} · {{both:'Umum & Santri',general:'Umum',student:'Santri'}[p.audience||'both']}</p></div><div className="actions"><button title="Edit" onClick={()=>setEditing(p)}><Pencil size={17}/></button><button title="Hapus" className="danger" onClick={()=>grouped?removeVariantGroup(p.variantGroupId):removeProduct(p.id)}><Trash2 size={17}/></button></div></div>})}</div></section>}
 </>;
 async function login(e){e.preventDefault();const f=new FormData(e.currentTarget);setCloudError('');const {error}=await supabase.auth.signInWithPassword({email:String(f.get('email')),password:String(f.get('password'))});if(error)setCloudError('Login gagal: '+error.message)}
 const adminGate=<section className="panel authPanel"><h2>Login Admin Utama</h2>{!configured?<><p>Supabase belum dikonfigurasi. Isi file <code>.env</code> sesuai README.</p></>:authBusy?<p>Memeriksa sesi login...</p>:!authUser?<form onSubmit={login}><label>Email admin<input type="email" name="email" required/></label><label>Password<input type="password" name="password" required/></label><button className="primary" type="submit">Login</button></form>:<><p>Login sebagai: {authUser.email}</p><p>Akun belum memiliki izin admin. Tambahkan ID akun di tabel admin_users melalui SQL Editor seperti panduan README.</p><button onClick={()=>supabase.auth.signOut()}>Keluar</button></>}{cloudError&&<p className="errorText">{cloudError}</p>}</section>;
 if(!configured)return <main className="setupPage"><h1>Konfigurasi Supabase diperlukan</h1><p>Salin <code>.env.example</code> menjadi <code>.env</code>, isi URL dan anon key, lalu ikuti <code>README.md</code>.</p></main>;
 if(!loaded)return <main className="catalogLoadingScreen"><section className={`catalogLoadingCard${cloudError?' catalogLoadingError':''}`} role={cloudError?'alert':'status'} aria-live="polite" aria-busy={!cloudError}>
  <div className="catalogLoadingArtwork" aria-hidden="true">
   <span className="catalogLoadingHalo"/>
   <span className="catalogLoadingBag">{customerBrand?.logo_url?<img className="catalogLoadingLogoV331" src={customerBrand.logo_url} alt=""/>:<ShoppingBag size={46} strokeWidth={1.9}/>}</span>
   {!cloudError&&<><span className="catalogLoadingSpark one"/><span className="catalogLoadingSpark two"/><span className="catalogLoadingSpark three"/></>}
  </div>
  <h1>{cloudError?'Katalog belum berhasil dimuat':'Sedang menyiapkan katalog...'}</h1>
  <p>{cloudError?'Periksa sambungan internet, lalu coba lagi.':'Sebentar ya, kami sedang mengambil daftar toko dan barang untuk Anda.'}</p>
  {!cloudError&&<><div className="catalogLoadingDots" aria-hidden="true"><span/><span/><span/></div><div className="catalogLoadingTrack" aria-hidden="true"><span/></div></>}
  {cloudError&&<p className="catalogLoadErrorDetails">{cloudError}</p>}
  <button type="button" className={cloudError?'primary catalogLoadRetry':'catalogLoadRetrySubtle'} onClick={()=>window.location.reload()}>{cloudError?'Coba muat ulang':'Muat ulang jika terlalu lama'}</button>
 </section></main>;
 return <div className={!admin&&customerBrand?'brandedCatalog':''} style={!admin&&customerBrand?brandCssVariables(customerBrand):undefined}><header className="topbar"><button className="brand" onClick={()=>{if(admin){window.history.pushState({},'','/');setAdmin(false)}navigateHome()}}>{customerBrand?.logo_url&&!admin?<img className="catalogBrandLogo" src={customerBrand.logo_url} alt=""/>:<ShoppingBag size={25}/>} <span className="catalogBrandText">{!admin&&customerBrand?customerBrand.display_name:'Katalog Darel'}</span></button><nav>{admin?<>{isAdminUser?<button onClick={()=>supabase.auth.signOut()}>Keluar Admin</button>:<span className="muted">Panel Admin</span>}</>:<><button onClick={navigateHome}>Beranda</button>{mode&&<button className="cartBtn" onClick={openCart}><ShoppingCart size={18}/> Keranjang ({count})</button>}</>}</nav></header><main>{cloudError&&isAdminUser&&<p className="errorText">{cloudError}</p>}{admin&&isAdminUser&&<p className="muted syncLine">Status: {syncState}</p>}
 {admin?(isAdminUser?adminContent:adminGate):<>
 {page==='home'&&!mode&&<><section className="hero simpleHero"><span className="eyebrow">SELAMAT DATANG</span><h1>Mau belanja untuk siapa?</h1><p>Silakan pilih salah satu. Tidak perlu membuat akun.</p></section><div className="modeGrid simpleModeGrid">
 <button className="modeCard studentChoice" onClick={()=>selectCustomerLane('student')}><GraduationCap size={40}/><h2>Kirim Barang untuk Santri</h2><p>Untuk orang tua atau wali santri. Pilih barang, lalu kirim pesanan ke WhatsApp kasir pondok.</p><strong>Mulai Kiriman →</strong></button>
 <button className="modeCard" onClick={()=>selectCustomerLane('general')}><ShoppingBag size={40}/><h2>Belanja Umum</h2><p>Pesanan dikirim ke alamat penerima. Ongkos kirim dikonfirmasi kasir toko.</p><strong>Mulai Belanja →</strong></button>
 </div><button type="button" className="guideEntryCard" onClick={openGuideManually}><span className="guideEntryIcon"><BookOpen size={28}/></span><span className="guideEntryText"><strong>Bingung cara belanja?</strong><small>Buka panduan bergambar 4 langkah. Cocok untuk orang tua yang baru pertama memakai Katalog Darel.</small></span><span className="guideEntryAction">Lihat Panduan</span></button><p className="simpleTrack"><MessageCircle size={17}/> Sudah memesan? Untuk bertanya tentang pesanan, chat kasir melalui WhatsApp.</p></>}
 {showGuide&&<div className="guideOverlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)closeGuide()}}><section ref={guideDialogRef} className="guideModal guideOneStep" role="dialog" aria-modal="true" aria-labelledby="guide-title" aria-describedby="guide-description"><div className="guideHeader"><div><span className="eyebrow">PANDUAN CARA BELANJA</span>{customerBrand?.logo_url&&<img className="catalogGuideLogoV331" src={customerBrand.logo_url} alt="Logo katalog"/>}<h2 id="guide-title">Belanja Mudah di {customerBrand?.display_name||"Katalog Darel"}</h2><p id="guide-description">Cukup empat langkah. Panduan ini bisa dilewati kapan saja.</p></div><button ref={guideCloseRef} type="button" className="guideClose" onClick={closeGuide}>{guideIsAutomatic?'Lewati':'Tutup'}</button></div><div className="guideProgress" aria-label={`Langkah ${guideStep+1} dari 4`}><b>Langkah {guideStep+1} dari 4</b><div className="guideProgressDots" aria-hidden="true">{[0,1,2,3].map(n=><span key={n} className={n<=guideStep?'done':''}/>)}</div></div><div className="guideStepsGrid">{[{no:'1',title:mode?'Pilih toko':'Pilih layanan',text:mode==='student'?'Pilih toko yang menyediakan kebutuhan santri.':mode==='general'?'Pilih toko untuk kebutuhan belanja umum.':'Dari beranda, pilih layanan yang ingin digunakan.',tone:'tone0',icon:<Store size={56} strokeWidth={1.8}/>},{no:'2',title:'Pilih barang',text:'Cari barang, pilih variasi ukuran atau warna jika ada, lalu tekan tombol Keranjang.',tone:'tone1',icon:<ShoppingBag size={56} strokeWidth={1.8}/>},{no:'3',title:'Isi data pesanan',text:mode==='student'?'Periksa keranjang, isi nama santri, kamar, tujuan Putra/Putri, dan tanggal kiriman.':mode==='general'?'Periksa keranjang dan isi nama penerima serta alamat pengiriman.':'Periksa keranjang, lalu isi data pemesan sesuai layanan yang dipilih.',tone:'tone2',icon:<ShoppingCart size={56} strokeWidth={1.8}/>},{no:'4',title:'Kirim pesanan ke WhatsApp',text:'Tekan “Pesan Lewat WhatsApp”, lalu saat WhatsApp terbuka tekan Kirim agar kasir menerima pesanan Anda.',tone:'tone0',icon:<MessageCircle size={56} strokeWidth={1.8}/>}].filter((_,i)=>i===guideStep).map(step=><article key={step.no} className="guideStepCard"><div className={`guideStepIllustration ${step.tone}`} aria-hidden="true"><span className="guideStepArtIcon">{step.icon}</span><span className="guideStepArtNum">{step.no}</span></div><div className={`guideStepBadge ${step.tone}`}>Langkah {step.no}</div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div><p className="guideHelpText">Jika perlu bantuan, tanyakan kepada kasir melalui WhatsApp saat memesan.</p><div className="guideActions">{guideStep>0&&<button type="button" className="guidePrevious" onClick={()=>setGuideStep(s=>Math.max(0,s-1))}>← Kembali</button>}<button type="button" className="primary" onClick={()=>{if(guideStep===3)closeGuide();else setGuideStep(s=>Math.min(3,s+1))}}>{guideStep===3?'Mulai Belanja':'Berikutnya →'}</button></div></section></div>}
 {page==='stores'&&mode&&<><section className="storeBanner">{customerBrand?.logo_url?<img className="catalogBannerLogo" src={customerBrand.logo_url} alt=""/>:mode==='student'?<GraduationCap size={34}/>:<Store size={34}/>}<div><div className="catalogBannerName">{customerBrand?.display_name}</div><span className="eyebrow">{mode==='student'?'KIRIMAN SANTRI':'BELANJA UMUM'}</span><h1>{mode==='student'?'Pilih Toko untuk Kiriman Santri':'Pilih Toko untuk Belanja Umum'}</h1><p>{mode==='student'?'Barang dikirim untuk santri di pondok, tanpa alamat rumah. Kiriman mengikuti jadwal Selasa/Jumat.':'Barang dikirim ke alamat penerima. Kasir mengonfirmasi ongkir sebelum pembayaran.'}</p></div></section><button type="button" className="laneGuideShortcut" onClick={openGuideManually}><BookOpen size={18} aria-hidden="true"/> Cara Belanja (4 langkah)</button><div className="storeSearch"><label htmlFor="store-search">Cari toko atau barang</label><input id="store-search" type="search" value={storeSearch} onChange={e=>setStoreSearch(e.target.value)} placeholder="Contoh: Toko Pakaian, kaos..." autoComplete="off"/></div><div className="storeGrid">{db.stores.filter(s=>s.active&&visibleProducts.some(p=>p.storeId===s.id)&&(!storeSearch.trim()||s.name.toLocaleLowerCase('id-ID').includes(storeSearch.trim().toLocaleLowerCase('id-ID'))||visibleProducts.some(p=>p.storeId===s.id&&p.name.toLocaleLowerCase('id-ID').includes(storeSearch.trim().toLocaleLowerCase('id-ID'))))).map((s,i)=><button className="storeCard" key={s.id} onClick={()=>{setStoreId(s.id);setPage('store');setSearch('');window.scrollTo(0,0)}}><div className={'storeIllustration storePhotoV329 tone'+i%3}>{s.coverImage?<img src={s.coverImage} alt={`Foto toko ${s.name}`} loading="lazy" decoding="async"/>:<Store size={45}/>}</div><div className="cardContent">{s.logoImage&&<img className="storeLogoV329" src={s.logoImage} alt="Logo toko" loading="lazy"/>}<h3>{s.name}</h3><p>{s.description}</p><span className="linkText">Lihat produk →</span></div></button>)}</div>{!db.stores.some(s=>s.active&&visibleProducts.some(p=>p.storeId===s.id)&&(!storeSearch.trim()||s.name.toLocaleLowerCase('id-ID').includes(storeSearch.trim().toLocaleLowerCase('id-ID'))||visibleProducts.some(p=>p.storeId===s.id&&p.name.toLocaleLowerCase('id-ID').includes(storeSearch.trim().toLocaleLowerCase('id-ID')))))&&<p role="status">Tidak ada toko atau produk yang cocok. Coba kata kunci lain.</p>}</>}
 {page==='store'&&mode&&store&&<><button type="button" className="back" onClick={backToShop}><ArrowLeft size={18}/> Kembali ke toko</button><section className={`storeBanner ${store.coverImage?'storeBannerWithCover':''}`}>{store.coverImage&&<img className="storeHeroCover" src={store.coverImage} alt="" decoding="async"/>}{store.logoImage?<img className="storeHeroLogo" src={store.logoImage} alt="Logo toko"/>:<Store size={34}/>}<div><span className="eyebrow">{mode==='student'?'KIRIMAN SANTRI':'BELANJA UMUM'}</span><h1>{store.name}</h1><p>{store.description}</p></div></section><div className="sectionHead"><h2>Produk</h2><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari barang..."/></div><div className="productGrid">{productCards.map(group=>{const p=group.representative;const addToCart=chosen=>{if(mode==='general'&&rows.some(x=>x.p.storeId!==chosen.storeId)&&!confirm('Keranjang umum hanya untuk satu toko. Ganti toko dan kosongkan keranjang sebelumnya?'))return;add(chosen)};return p.variantGroupId?<VariantProductCard key={group.key} group={group} money={money} onAdd={addToCart}/>:<article className="productCard" key={p.id}><PhotoGallery images={photoForProduct(p)} alt={p.name}/><div className="cardContent"><small>{p.category}</small><h3>{p.name}</h3><b>{money(p.price)}</b><p>Stok: {p.stock}</p><button className="primary" disabled={!p.stock} onClick={()=>addToCart(p)}><Plus size={17}/> {p.stock?'Keranjang':'Habis'}</button></div></article>})}</div>{!products.length&&<p>Belum ada produk yang cocok.</p>}</>}
 {page==='cart'&&mode&&<><button type="button" className="back" onClick={backToShop}><ArrowLeft size={18}/> Kembali belanja</button><div className="sectionHead"><h2>Keranjang {mode==='student'?'Kiriman Santri':'Belanja Umum'}</h2></div><div className="checkoutSteps" aria-label="Tahap checkout"><span className="stepDone">1. Pilih barang ✓</span><span className="stepActive">2. Isi data & cek total</span><span>3. Konfirmasi WhatsApp</span></div><div className="checkoutGrid"><section className="panel"><h3>Barang Pesanan</h3>{rows.map(({p,qty})=><div className="cartRow" key={p.id}><div><b>{p.name}</b><p>{db.stores.find(s=>s.id===p.storeId)?.name} · {money(p.price)} / pcs</p></div><div className="qty"><button onClick={()=>changeQty(p,qty-1)}><Minus size={15}/></button><b>{qty}</b><button onClick={()=>changeQty(p,qty+1)}><Plus size={15}/></button></div><b>{money(qty*p.price)}</b></div>)}{!rows.length&&<p>Keranjang kosong.</p>}<div className="total"><b>{mode==='general'?'Total barang (belum termasuk ongkir)':'Total estimasi'}</b><strong>{money(total)}</strong></div>{mode==='student'&&<button className="primary" onClick={()=>{setPage('stores');window.scrollTo(0,0)}}>+ Tambah dari toko lain</button>}</section><section className="panel"><h3>{mode==='student'?'Isi Data Orang Tua & Santri':'Isi Data Pembeli & Pengiriman'}</h3><p className="muted">Isi data berikut agar pesanan sampai ke kasir yang tepat.</p><form onSubmit={checkout}><label>Nama pemesan<input name="name" required placeholder="Nama orang tua / pembeli"/></label>{mode==='student'&&<><label>Nama santri<input name="student" required placeholder="Nama lengkap santri"/></label><label>Kamar / Kelas<input name="room" required placeholder="Contoh: Kamar A-05"/></label><label>Santri Putra atau Putri?<select name="gender" defaultValue="male"><option value="male">Santri Putra</option><option value="female">Santri Putri</option></select></label><label>Pilih hari kiriman (Selasa / Jumat)<select name="delivery" required>{availableDates.map(d=><option key={d.iso} value={d.iso}>{d.label}</option>)}</select></label><div className="paymentNote"><b><CalendarDays size={16}/> Jadwal pondok</b><p>Pesanan bisa dibuat setiap hari. Barang diserahkan pada tanggal yang dipilih dari jadwal yang ditetapkan admin.</p></div></>}
 {mode==='general'&&<GeneralShippingFields/>}<div className="paymentNote"><b>Bayar dengan transfer bank</b><p>{mode==='student'?'Rekening transfer sesuai tujuan santri akan dicantumkan di pesan WhatsApp jika sudah diisi admin. Jika belum, tanyakan kepada kasir.':transferInfo(generalCheckoutStore?.paymentInfo)||'Rekening toko belum diatur. Tanyakan rekening resmi kepada kasir.'}</p><small>Jangan transfer sebelum kasir memastikan total akhir dan stok.</small></div><label>Catatan<textarea name="note" rows="3" placeholder="Ukuran, warna, catatan kiriman..."/></label><div className="privacyNotice"><strong>Informasi penggunaan data</strong><p>Nama pemesan dipakai untuk mencatat serta menindaklanjuti pesanan. Nomor WhatsApp pemesan tidak diminta oleh katalog; kasir dapat melihat nomor pengirim setelah pesan dikirim lewat WhatsApp. Pada Belanja Umum, alamat dan nama penerima dipakai untuk pengiriman dan diberikan kepada kasir toko terkait. Untuk kiriman santri, nama santri, kamar/kelas, tujuan putra/putri, dan tanggal penyerahan juga dipakai agar kiriman sampai kepada penerima yang tepat.</p><p>Browser menyimpan pengenal acak untuk membatasi spam pesanan, bukan nomor HP. Informasi pesanan disimpan di Supabase dan dapat diperiksa oleh admin utama; rincian yang diperlukan dikirim kepada kasir terkait melalui WhatsApp saat kamu melanjutkan checkout. WhatsApp merupakan layanan pihak ketiga dengan ketentuan privasinya sendiri.</p><p>Jangan menuliskan data sensitif yang tidak diperlukan pada kolom catatan. Jika ingin menanyakan koreksi atau penghapusan data pesanan, hubungi kasir melalui WhatsApp terkait atau pengelola pondok.</p></div><label className="privacyConsent"><input type="checkbox" name="privacy_acknowledged" required/> Saya sudah membaca dan memahami informasi penggunaan data pesanan di atas.</label><p className="muted">Pesanan akan dicatat ke dashboard sebelum WhatsApp dibuka. Status pembayaran dan pengiriman pesan WhatsApp tetap memerlukan konfirmasi manual.</p><button className="primary big" disabled={!rows.length||checkoutBusy} type="submit"><MessageCircle size={18}/> {checkoutBusy?'Menyimpan pesanan...':'Pesan Lewat WhatsApp'}</button>{orderError&&<p role="status" className="paymentNote">{orderError}{checkoutLink&&<> <a href={checkoutLink} target="_blank" rel="noopener noreferrer">Klik di sini jika WhatsApp belum terbuka</a></>}</p>}</form></section></div></>}
 </>}
 {!admin&&mode&&page==='store'&&showQuickBack&&<button
  type="button" className={`quickBackFloat${count>0?' aboveCart':''}`}
  aria-label="Kembali ke daftar toko"
  onClick={backToShop}><ArrowLeft size={18} aria-hidden="true"/> Kembali ke toko</button>}
 {!admin&&mode&&page!=='cart'&&count>0&&<button className="mobileCartFloat" onClick={openCart} aria-label={`Lihat keranjang berisi ${count} barang`}><ShoppingCart size={19}/> Lihat Keranjang <span>{count} barang · {money(total)}</span></button>}</main><footer><CheckCircle2 size={16}/> Katalog multi-toko · Pembayaran manual via WhatsApp · Data katalog online</footer></div>
}
function HalamanLama({jenis}) {
 const lacak=jenis==='lacak';
 return <main className="legacyNotice"><section className="panel">
  <ShoppingBag size={34} aria-hidden="true"/>
  <h1>{lacak?'Informasi Pesanan':'Informasi untuk Petugas'}</h1>
  <p>{lacak?'Fitur lacak pesanan tidak digunakan lagi agar lebih sederhana.':'Pencatatan serah-terima melalui aplikasi tidak diwajibkan lagi.'}</p>
  <p>Untuk menanyakan pesanan atau memastikan barang sudah sampai, silakan hubungi kasir melalui percakapan WhatsApp saat pemesanan.</p>
  <p className="muted">Data pesanan yang sudah dicatat tetap tersimpan. Halaman ini tidak mengubah status pesanan atau barang.</p>
  <a className="legacyHomeLink" href="/">Kembali ke Katalog</a>
 </section></main>;
}
const path=window.location.pathname.replace(/\/$/,'');
createRoot(document.getElementById('root')).render(path==='/lacak'||path==='/petugas'?<HalamanLama jenis={path.slice(1)}/>:<App/>);
