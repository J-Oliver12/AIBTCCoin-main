const assert = require('assert');
const { Block } = require('../src/blockchain'); // Ensure correct path
const { createSignedTx } = require('./helpers'); // Ensure this helper is adapted to your project

let blockObj = null;

beforeEach(function() {
  const transactions = [createSignedTx()];
  blockObj = new Block(1, 'a1', Date.now(), transactions, 1); // Updated constructor parameters
});

describe('Block class', function() {
  beforeEach(function() {
    const transactions = [createSignedTx()];
    blockObj = new Block(1, 'a1', Date.now(), transactions, 1);
  });

  describe('Constructor', function() {
    it('should correctly save parameters', function() {
      assert.strictEqual(blockObj.previousHash, 'a1');
      assert.ok(blockObj.timestamp);
      assert.strictEqual(blockObj.transactions.length, 1);
      assert.strictEqual(blockObj.nonce, 0);
      assert.ok(blockObj.merkleRoot);
    });

    it('should correctly save parameters without "previousHash"', function() {
      const transactions = [createSignedTx()];
      blockObj = new Block(1, '', Date.now(), transactions, 1);
      assert.strictEqual(blockObj.previousHash, '');
      assert.ok(blockObj.timestamp);
      assert.strictEqual(blockObj.transactions.length, 1);
      assert.strictEqual(blockObj.nonce, 0);
      assert.ok(blockObj.merkleRoot);
    });
  });

  describe('Calculate hash', function() {
    it('should correctly calculate the SHA256', function() {
      blockObj.timestamp = 1625245440000; // Fixed timestamp
      blockObj.mineBlock(0); // Adjust difficulty if needed
      assert.strictEqual(
        blockObj.hash,
        blockObj.calculateHash()
      );
    });

    it('should change when we tamper with the tx', function() {
      const origHash = blockObj.calculateHash();
      blockObj.timestamp = Date.now();
      assert.notStrictEqual(blockObj.calculateHash(), origHash);
    });
  });

  describe('has valid transactions', function() {
    it('should return true with all valid tx', function() {
      blockObj.transactions = [
        createSignedTx(),
        createSignedTx(),
        createSignedTx()
      ];
      assert(blockObj.hasValidTransactions());
    });

    it('should return false when a single tx is bad', function() {
      const badTx = createSignedTx();
      badTx.amount = 1337;
      blockObj.transactions = [
        createSignedTx(),
        badTx
      ];
      assert(!blockObj.hasValidTransactions());
    });
  });
});




