const assert = require('assert');
const { Blockchain, Transaction } = require('../src/blockchain'); // Adjust path
const { createSignedTx, signingKey, createBlockchainWithTx, createBCWithMined } = require('./helpers'); // Ensure these helpers are adapted

let blockchain = null;

beforeEach(async function() {
  blockchain = new Blockchain();
  await blockchain.minePendingTransactions(signingKey.getPublic('hex'));
});

describe('Blockchain class', function() {
  beforeEach(async function() {
    blockchain = new Blockchain();
    await blockchain.minePendingTransactions(signingKey.getPublic('hex'));
  });

  describe('Constructor', function() {
    it('should properly initialize fields', function() {
      assert.strictEqual(blockchain.difficulty, 0);
      assert.deepStrictEqual(blockchain.pendingTransactions, []);
      assert.strictEqual(blockchain.miningReward, 100);
    });
  });

  describe('addTransaction', function() {
    it('should correctly add new tx', async function() {
      const validTx = createSignedTx();
      const result = blockchain.addTransaction(validTx);
      assert.strictEqual(result, true);
      assert.deepStrictEqual(blockchain.pendingTransactions[0], validTx);
    });

    it('should fail for tx without from address', function() {
      const validTx = createSignedTx();
      validTx.fromAddress = null;
      assert.throws(() => { blockchain.addTransaction(validTx); }, Error);
    });

    it('should fail for tx without to address', function() {
      const validTx = createSignedTx();
      validTx.toAddress = null;
      assert.throws(() => { blockchain.addTransaction(validTx); }, Error);
    });

    it('should fail when tx is not valid', function() {
      const validTx = createSignedTx();
      validTx.amount = 1000;
      assert.throws(() => { blockchain.addTransaction(validTx); }, Error);
    });

    it('should fail when tx has negative or zero amount', function() {
      const tx1 = createSignedTx(0);
      assert.throws(() => { blockchain.addTransaction(tx1); }, Error);
      const tx2 = createSignedTx(-20);
      assert.throws(() => { blockchain.addTransaction(tx2); }, Error);
    });

    it('should fail when not having enough balance', async function() {
      const blockchain = new Blockchain();
      const walletAddress = signingKey.getPublic('hex');
      await blockchain.minePendingTransactions(walletAddress);

      const tx = new Transaction(walletAddress, 'recipientAddress', 150);
      tx.sign(signingKey);
      
      const result = blockchain.addTransaction(tx);
      assert.strictEqual(result, false);
    });
  });

  describe('wallet balance', function() {
    it('should give mining rewards', function() {
      const balance = blockchain.getBalanceOfAddress(signingKey.getPublic('hex'));
      assert.strictEqual(balance, 100);
    });

    it('should correctly reduce wallet balance', async function() {
      const blockchain = new Blockchain();
      const walletAddress = signingKey.getPublic('hex');
      await blockchain.minePendingTransactions(walletAddress);
      const tx = new Transaction(walletAddress, 'recipientAddress', 100);
      tx.sign(signingKey);
      blockchain.addTransaction(tx);
      await blockchain.minePendingTransactions(walletAddress);
      const balance = blockchain.getBalanceOfAddress(walletAddress);
      assert.strictEqual(balance, 0);
    });

    it('should work with cyclic transactions', async function() {
      const blockchain = new Blockchain();
      const walletAddress1 = signingKey.getPublic('hex');
      const walletAddress2 = 'recipientAddress';
      await blockchain.minePendingTransactions(walletAddress1);
      const tx1 = new Transaction(walletAddress1, walletAddress2, 50);
      tx1.sign(signingKey);
      blockchain.addTransaction(tx1);
      await blockchain.minePendingTransactions(walletAddress1);

      const tx2 = new Transaction(walletAddress2, walletAddress1, 30);
      const signingKey2 = 'anotherPrivateKey'; // Replace with walletAddress2's key
      tx2.sign(signingKey2);
      blockchain.addTransaction(tx2);
      await blockchain.minePendingTransactions(walletAddress2);
      const balance1 = blockchain.getBalanceOfAddress(walletAddress1);
      const balance2 = blockchain.getBalanceOfAddress(walletAddress2);
      assert.strictEqual(balance1, 80);
      assert.strictEqual(balance2, 20);
    });

    it('should not allow pending transactions to go below zero', () => {
      const blockchain = new Blockchain();
      const walletAddress = 'walletAddress1';
      const tx1 = new Transaction(walletAddress, 'recipientAddress', -10);
      assert.throws(() => {
        blockchain.addTransaction(tx1);
      }, Error, 'Transaction amount should be greater than 0.');
    });
  });

  describe('helper functions', function() {
    it('should correctly set first block to genesis block', function() {
      assert.strictEqual(blockchain.chain[0].index, 0);
      assert.strictEqual(blockchain.chain[0].previousHash, '0');
    });
  });

  describe('isChainValid', function() {
    it('should fail when genesis block has been tampered with', function() {
      blockchain.chain[0].hash = 'tampered_hash';
      assert.strictEqual(blockchain.isChainValid(), false);
    });

    it('should fail when a tx is invalid', function() {
      const invalidTx = createSignedTx({ amount: -10 });
      blockchain.chain[1].transactions.push(invalidTx);
      assert.strictEqual(blockchain.isChainValid(), false);
    });
  });
});