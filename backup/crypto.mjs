import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {readFile,writeFile,open} from 'node:fs/promises';
const MAGIC=Buffer.from('LCBAK1'),AAD=Buffer.from('LeadConnectBackup-v1'),NONCE=12,TAG=16;
export function encryptBuffer(plain,key,nonce=randomBytes(NONCE)) {
 if(!Buffer.isBuffer(key)||key.length!==32)throw Error('AES key must be exactly 32 bytes');
 if(!Buffer.isBuffer(nonce)||nonce.length!==NONCE)throw Error('GCM nonce must be 12 bytes');
 const c=createCipheriv('aes-256-gcm',key,nonce,{authTagLength:TAG});c.setAAD(AAD);
 const ciphertext=Buffer.concat([c.update(plain),c.final()]);return Buffer.concat([MAGIC,nonce,c.getAuthTag(),ciphertext]);
}
export function decryptBuffer(archive,key) {
 if(!Buffer.isBuffer(key)||key.length!==32)throw Error('AES key must be exactly 32 bytes');
 if(archive.length<MAGIC.length+NONCE+TAG||!archive.subarray(0,6).equals(MAGIC))throw Error('Invalid or truncated archive');
 const n=archive.subarray(6,18),tag=archive.subarray(18,34),data=archive.subarray(34);
 const d=createDecipheriv('aes-256-gcm',key,n,{authTagLength:TAG});d.setAAD(AAD);d.setAuthTag(tag);return Buffer.concat([d.update(data),d.final()]);
}
export async function encryptFile(input,output,key){const src=await readFile(input);const sealed=encryptBuffer(src,key);const h=await open(output,'wx',0o600);try{await h.writeFile(sealed);await h.sync()}finally{await h.close()}src.fill(0);sealed.fill(0)}
export async function decryptFile(input,output,key){const enc=await readFile(input);const plain=decryptBuffer(enc,key);const h=await open(output,'wx',0o600);try{await h.writeFile(plain);await h.sync()}finally{await h.close();enc.fill(0);plain.fill(0)}}
export function newKey(){return randomBytes(32)}
