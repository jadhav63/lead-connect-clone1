import test from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';import {encryptBuffer,decryptBuffer} from './crypto.mjs';
test('AES-256-GCM fictional dump round trip',()=>{const key=randomBytes(32),plain=Buffer.from('fictional postgres custom dump\0room 999');const a=encryptBuffer(plain,key),b=encryptBuffer(plain,key);assert.deepEqual(decryptBuffer(a,key),plain);assert.notDeepEqual(a.subarray(6,18),b.subarray(6,18));});
test('tampering is rejected',()=>{const k=randomBytes(32),a=encryptBuffer(Buffer.from('synthetic data'),k);a[a.length-1]^=1;assert.throws(()=>decryptBuffer(a,k));});
test('wrong key rejected',()=>{const a=encryptBuffer(Buffer.from('fictional'),randomBytes(32));assert.throws(()=>decryptBuffer(a,randomBytes(32)));});
test('bad key and truncated header rejected',()=>{assert.throws(()=>encryptBuffer(Buffer.from('x'),Buffer.alloc(8)));assert.throws(()=>decryptBuffer(Buffer.from('LCBAK1'),Buffer.alloc(32)));});
