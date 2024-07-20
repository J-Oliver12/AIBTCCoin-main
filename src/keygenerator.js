'use strict';
const EC = require('elliptic').ec;

// Initialize elliptic curve
const ec = new EC('secp256k1');

// Generate key pair
const keyPair = ec.genKeyPair();
const privateKey = keyPair.getPrivate('hex');
const publicKey = keyPair.getPublic('hex');

console.log('Private Key:', privateKey);
console.log('Public Key:', publicKey);
