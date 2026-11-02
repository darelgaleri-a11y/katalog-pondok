import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCheckoutToken,isCheckoutTokenUuid} from '../src/checkoutToken.js';

test('V32.9.1 file upload uses secure UUID generator with HTTP LAN fallback',()=>{
 const source=fs.readFileSync(new URL('../src/PhotoFields.jsx',import.meta.url),'utf8');
 assert.match(source,/import \{createCheckoutToken\} from '\.\/checkoutToken\.js'/);
 assert.match(source,/const id=createCheckoutToken\(\)/);
 assert.doesNotMatch(source,/globalThis\.crypto\?\.randomUUID\?\.\(\)/);
 assert.doesNotMatch(source,/Math\.random/);
});
test('V32.9.1 fallback uses crypto.getRandomValues to generate UUID on local HTTP',()=>{
 const cryptoApi={getRandomValues(bytes){bytes.set(Array.from({length:16},(_,i)=>i+1));return bytes;}};
 const value=createCheckoutToken(cryptoApi);
 assert.equal(value,'01020304-0506-4708-890a-0b0c0d0e0f10');
 assert.ok(isCheckoutTokenUuid(value));
});
test('V32.9.1 fails closed without a cryptographic random source',()=>{
 assert.throws(()=>createCheckoutToken({}),/Browser tidak mendukung/);
});
