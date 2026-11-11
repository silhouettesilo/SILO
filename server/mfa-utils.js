'use strict';

const crypto = require('node:crypto');
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = 0, value = 0, out = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { out += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input) {
  let bits = 0, value = 0;
  const out = [];
  for (const char of String(input).toUpperCase().replace(/=|\s/g, '')) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error('Invalid authenticator secret.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

function totpCounter(secret, counter) {
  const key = base32Decode(secret);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', key).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 1000000).padStart(6, '0');
}

function verifyTotp(secret, code, lastCounter = -1, nowMs = Date.now()) {
  if (!/^\d{6}$/.test(String(code || ''))) return null;
  const current = Math.floor(nowMs / 30000);
  for (let drift = -1; drift <= 1; drift++) {
    const counter = current + drift;
    if (counter <= lastCounter || counter < 0) continue;
    const expected = totpCounter(secret, counter);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(code)))) return counter;
  }
  return null;
}

function encryptSecret(secret, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decryptSecret(value, key) {
  const [iv, tag, data] = String(value || '').split('.');
  if (!iv || !tag || !data) throw new Error('Authenticator secret is unavailable.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

function makeRecoveryCodes(hash) {
  const codes = Array.from({ length: 10 }, () => crypto.randomBytes(5).toString('hex').toUpperCase());
  return { codes, hashes: codes.map(hash) };
}

module.exports = { base32Encode, base32Decode, totpCounter, verifyTotp, encryptSecret, decryptSecret, makeRecoveryCodes };
