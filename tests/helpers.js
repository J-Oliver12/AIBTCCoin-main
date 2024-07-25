const { Transaction, Blockchain } = require('../src/blockchain');
const EC = require('elliptic').ec;

const ec = new EC('secp256k1');

function createSignedTx(amount = 10) {
  const keyPair = ec.genKeyPair();
  const publicKey = keyPair.getPublic('hex');
  
  const tx = new Transaction(publicKey, 'b2', amount);
  tx.timestamp = Date.now();
  
  tx.sign(keyPair);

  return tx;
}

async function createBlockchainWithTx() {
  const blockchain = new Blockchain();
  const tx = createSignedTx(50);
  blockchain.addTransaction(tx);
  await blockchain.minePendingTransactions('miner-address');
  return blockchain;
}

async function createBCWithMined() {
  const blockchain = new Blockchain();
  await blockchain.minePendingTransactions('miner-address');
  return blockchain;
}

const keyPair = ec.genKeyPair();

module.exports = {
  createSignedTx,
  createBlockchainWithTx,
  createBCWithMined,
  signingKey: keyPair
};






