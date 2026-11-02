import test from 'node:test';
import assert from 'node:assert/strict';
import {createCheckoutToken,getOrCreateCheckoutToken,isCheckoutTokenUuid} from '../src/checkoutToken.js';

const deterministicCrypto={
  getRandomValues(array){array.set(Array.from({length:array.length},(_,i)=>i));return array;},
};

test('browser HTTPS: randomUUID normal produces valid checkout token',()=>{
  const fromBrowser='b68ae96b-9b2e-41a9-a34d-c8c9230f3098';
  assert.equal(createCheckoutToken({randomUUID:()=>fromBrowser}),fromBrowser);
});
test('browser HTTP LAN: fallback getRandomValues generates valid UUID v4',()=>{
  const token=createCheckoutToken(deterministicCrypto);
  assert.equal(token,'00010203-0405-4607-8809-0a0b0c0d0e0f');
  assert.ok(isCheckoutTokenUuid(token));
});
test('legacy id-* token is replaced automatically on retry',()=>{
  const token=getOrCreateCheckoutToken('id-1760000000-abc123',deterministicCrypto);
  assert.ok(isCheckoutTokenUuid(token));
});
test('valid token reused for retry so request stays idempotent',()=>{
  const token='b68ae96b-9b2e-41a9-a34d-c8c9230f3098';
  assert.equal(getOrCreateCheckoutToken(token,{}),token);
});
test('no random generator: fails closed without Math.random token',()=>{
  assert.throws(()=>createCheckoutToken({}),/Browser tidak mendukung/);
});
test('invalid randomUUID result cannot bypass validation',()=>{
  assert.equal(createCheckoutToken({randomUUID:()=> 'id-invalid',...deterministicCrypto}), '00010203-0405-4607-8809-0a0b0c0d0e0f');
});
