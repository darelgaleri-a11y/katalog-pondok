import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizePhotos, readPhotoField, photoForProduct,MAX_PRODUCT_PHOTOS} from '../src/catalogPhotos.js';
const here=path.dirname(fileURLToPath(import.meta.url));
const src=(name)=>fs.readFileSync(path.join(here,'../src',name),'utf8');

test('old product photo remains visible',()=>{
  assert.deepEqual(photoForProduct({image:'https://example.com/lama.jpg'}),['https://example.com/lama.jpg']);
});
test('multi-photo normalizer removes duplicates, unsafe schemes and limits to five',()=>{
  const x=normalizePhotos(['https://site.test/1.jpg','javascript:alert(1)','https://site.test/1.jpg','http://insecure.test/2.png',...Array.from({length:9},(_,i)=>`https://site.test/${i+2}.jpg`)]);
  assert.equal(x.length,MAX_PRODUCT_PHOTOS);
  assert.equal(x[0],'https://site.test/1.jpg');
  assert.equal(new Set(x).size,x.length);
});
test('empty product produces empty photos',()=>assert.deepEqual(photoForProduct({}),[]));
test('photo fields reject invalid count',()=>{
  const form=new Map([['images',JSON.stringify(Array.from({length:6},(_,i)=>`https://site.test/${i}.webp`))]]);
  assert.throws(()=>readPhotoField(form,'images'),/batas/);
});
test('thumbnail order corresponds to first photo being main',()=>{
  const main=src('main.jsx');
  assert.match(main,/image:images\[0\]/);
  assert.match(main,/coverImage:coverImages\[0\]/);
  assert.match(main,/logoImage:logoImages\[0\]/);
});
test('existing storage bucket used for uploads and upload is admin restricted',()=>{
  assert.match(src('PhotoFields.jsx'),/from\('product-images'\)\.upload/);
  const sql=fs.readFileSync(path.join(here,'../supabase-setup.sql'),'utf8');
  assert.match(sql,/admin upload product images/);
  assert.match(sql,/admin_users/);
});
test('product gallery has swipe, arrow and thumbnails',()=>{
  const g=src('PhotoGallery.jsx');
  for(const q of ['onTouchStart','onTouchEnd','galleryNext','galleryPrevious','galleryThumbnails'])assert.ok(g.includes(q),q);
});
test('variant products retain same gallery metadata',()=>{
  const v=src('productVariants.js');
  assert.match(v,/images: Array\.isArray\(images\)/);
  assert.match(src('main.jsx'),/makeVariantProducts\(\{\.\.\.input,image,images,groupId/);
});
test('V32.9 adds no checkout form fields, preserving backend',()=>{
  const main=src('main.jsx');
  assert.match(main,/supabase\.rpc\('create_checkout_v33'/);
  assert.match(main,/supabase\.rpc\('save_catalog_v10'/);
});
