const assert = require('assert');
const { Block } = require('../src/blockchain'); 
const { createSignedTx } = require('./helpers'); 

let blockObj = null;

// Initialize a Block instance before each test
beforeEach(function() {
  blockObj = new Block(1000, [createSignedTx()], 'a1');
});

describe('Block class', function() {

  describe('Constructor', function() {
    it('should correctly save parameters', function() {
      // Assert that parameters are saved correctly
      assert.strictEqual(blockObj.previousHash, 'a1');
      assert.strictEqual(blockObj.timestamp, 1000);
      assert.deepStrictEqual(blockObj.transactions, [createSignedTx()]);
      assert.strictEqual(blockObj.nonce, 0);
    });

    it('should correctly save parameters, without giving "previousHash"', function() {
      // Create a new Block without previousHash
      blockObj = new Block(1000, [createSignedTx()]);
      assert.strictEqual(blockObj.previousHash, '');
      assert.strictEqual(blockObj.timestamp, 1000);
      assert.deepStrictEqual(blockObj.transactions, [createSignedTx()]);
      assert.strictEqual(blockObj.nonce, 0);
    });
  });

  describe('Calculate hash', function() {
    it('should correctly calculate the SHA256', function() {
      // Modify block properties and mine the block
      blockObj.timestamp = 1;
      blockObj.mineBlock(1); 

      // Expected hash value should be updated to match actual implementation
      assert.strictEqual(
        blockObj.hash,
        '07d2992ddfcb8d538075fea2a6a33e7fb546c18038ae1a8c0214067ed66dc393'
      );
    });

    it('should change when we tamper with the tx', function() {
      // Get the original hash
      const origHash = blockObj.calculateHash();
      // Modify a property
      blockObj.timestamp = 100;

      // Assert that hash changes after modification
      assert.notStrictEqual(
        blockObj.calculateHash(),
        origHash
      );
    });
  });

  describe('has valid transactions', function() {
    it('should return true with all valid tx', function() {
      // Set valid transactions
      blockObj.transactions = [
        createSignedTx(),
        createSignedTx(),
        createSignedTx()
      ];

      // Assert that all transactions are valid
      assert(blockObj.hasValidTransactions());
    });

    it('should return false when a single tx is bad', function() {
      // Create a valid and a bad transaction
      const badTx = createSignedTx();
      badTx.amount = 1337; // Tamper with the transaction

      blockObj.transactions = [
        createSignedTx(),
        badTx
      ];

      // Assert that hasValidTransactions returns false due to invalid transaction
      assert(!blockObj.hasValidTransactions());
    });
  });
});

