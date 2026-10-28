const crypto = require('crypto');

const pair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

console.log('=== JWT_PRIVATE_KEY ===');
console.log(pair.privateKey);

console.log('=== JWT_PUBLIC_KEY ===');
console.log(pair.publicKey);
