// V33.1: public-only visual identities; never mix these with checkout or inventory.
export const DEFAULT_BRANDING = Object.freeze({
  student: Object.freeze({mode:'student',display_name:'Katalog Kiriman Santri',logo_url:'',primary_color:'#176B47',soft_color:'#E9F5EE'}),
  general: Object.freeze({mode:'general',display_name:'Katalog Darel',logo_url:'',primary_color:'#7050E8',soft_color:'#F2EEFF'})
});
export const COLOR_CHOICES=['#176B47','#1E5AA8','#7050E8','#984124','#28364B'];
export const HEX_COLOR=/^#[\da-fA-F]{6}$/;
export const textColor='#17264B';

const clampHex=(value,fallback)=>HEX_COLOR.test(String(value||''))?String(value).toUpperCase():fallback;
export function normalizeBranding(mode,value){
  const defaultBrand=DEFAULT_BRANDING[mode];
  if(!defaultBrand)throw new Error('Katalog tidak dikenal.');
  const logo=String(value?.logo_url||'').trim();
  const name=String(value?.display_name||'').trim();
  return {
    mode,
    display_name:name.slice(0,70)||defaultBrand.display_name,
    logo_url:logo.length<=2048&&/^https:\/\//i.test(logo)?logo:'',
    primary_color:clampHex(value?.primary_color,defaultBrand.primary_color),
    soft_color:clampHex(value?.soft_color,defaultBrand.soft_color)
  };
}

function luminance(color){
  const hex=color.slice(1);
  const channels=[0,2,4].map(pos=>parseInt(hex.slice(pos,pos+2),16)/255).map(n=>n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4);
  return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
}
export function contrastRatio(a,b){
  if(!HEX_COLOR.test(a)||!HEX_COLOR.test(b))return 0;
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
export function validateBranding(mode,draft){
  if(!DEFAULT_BRANDING[mode])throw new Error('Katalog tidak dikenali.');
  const name=String(draft.display_name||'').trim();
  if(!name||name.length>70)throw new Error('Nama katalog wajib diisi (maksimal 70 karakter).');
  if(!HEX_COLOR.test(draft.primary_color)||!HEX_COLOR.test(draft.soft_color))throw new Error('Format warna harus seperti #176B47.');
  if(contrastRatio(draft.primary_color,'#FFFFFF')<4.5)throw new Error('Warna utama terlalu terang untuk tulisan putih. Pilih warna yang lebih gelap.');
  if(contrastRatio(draft.soft_color,textColor)<4.5)throw new Error('Warna latar terlalu gelap untuk tulisan. Pilih latar yang lebih terang.');
  const logo=String(draft.logo_url||'').trim();
  if(logo.length>2048||(logo&&!/^https:\/\//i.test(logo)))throw new Error('Logo harus berupa tautan HTTPS yang valid.');
  return {mode,display_name:name,logo_url:logo,primary_color:draft.primary_color.toUpperCase(),soft_color:draft.soft_color.toUpperCase()};
}
export function brandCssVariables(brand){
  return {'--catalog-primary':brand.primary_color,'--catalog-soft':brand.soft_color};
}
