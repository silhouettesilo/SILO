'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { base32Encode, base32Decode, totpCounter, verifyTotp, encryptSecret, decryptSecret, makeRecoveryCodes } = require('../server/mfa-utils');

const raw = Buffer.from('Hello!\xde\xad\xbe\xef', 'binary');
assert.deepEqual(base32Decode(base32Encode(raw)), raw, 'Base32 round trip');
// RFC 6238 SHA-1 test vector at 59 seconds, truncated to six digits.
const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
assert.equal(totpCounter(secret, 1), '287082');
const nowMs = 59000;
assert.equal(verifyTotp(secret, '287082', -1, nowMs), 1);
assert.equal(verifyTotp(secret, '287082', 1, nowMs), null, 'A TOTP counter cannot be replayed');
const key = crypto.randomBytes(32), encrypted = encryptSecret('authenticator-secret', key);
assert.equal(decryptSecret(encrypted, key), 'authenticator-secret');
assert.throws(() => decryptSecret(encrypted, crypto.randomBytes(32)), 'Authenticated encryption rejects the wrong key');
const recovery = makeRecoveryCodes(value => crypto.createHash('sha256').update(value).digest('hex'));
assert.equal(recovery.codes.length, 10);
assert.equal(new Set(recovery.codes).size, 10);
assert.equal(recovery.hashes.length, 10);
assert.ok(recovery.hashes.every(hash => hash.length === 64));
console.log('MFA security checks passed: base32, RFC TOTP vector, replay protection, AES-GCM and recovery codes.');
