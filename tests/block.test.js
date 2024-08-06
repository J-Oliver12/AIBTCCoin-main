const assert = require('assert');
const { Blockchain, Block, Transaction } = require('../src/blockchain'); 
const { createSignedTx } = require('./helpers'); 

let blockObj = null;

beforeEach(function() {
  const transactions = [createSignedTx()];
  const fixedTimestamp = 1625245440000; // Set a fixed timestamp for consistency
  blockObj = new Block(1, 'a1', fixedTimestamp, transactions, 1); // Updated constructor parameters
  blockObj.mineBlock(0); // Adjust difficulty 
});

describe('Block class', function() {
  describe('Constructor', function() {
    it('should correctly save parameters', function() {
      assert.strictEqual(blockObj.previousHash, 'a1');
      assert.ok(blockObj.timestamp); // Check if timestamp is set
      assert.strictEqual(blockObj.transactions.length, 1);
      assert.strictEqual(blockObj.nonce, 0);
      assert.ok(blockObj.merkleRoot); // Check if Merkle root is set
    });

    it('should correctly save parameters, without giving "previousHash"', function() {
      const transactions = [createSignedTx()];
      blockObj = new Block(1, '', Date.now(), transactions, 1);
      assert.strictEqual(blockObj.previousHash, '');
      assert.ok(blockObj.timestamp); // Check if timestamp is set
      assert.strictEqual(blockObj.transactions.length, 1);
      assert.strictEqual(blockObj.nonce, 0);
      assert.ok(blockObj.merkleRoot); // Check if Merkle root is set
    });
  });

  describe('Calculate hash', function() {
    it('should correctly calculate the SHA256', function() {
      const expectedHash = blockObj.calculateHash();
      assert.strictEqual(
        blockObj.hash,
        expectedHash,
        `Expected hash ${expectedHash}, but got ${blockObj.hash}`
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
      badTx.amount = 1337; // Adjust field names and tampering logic as needed
      blockObj.transactions = [
        createSignedTx(),
        badTx
      ];
      assert(!blockObj.hasValidTransactions());
    });
  });
});

describe('Blockchain', function() {
  describe('minePendingTransactions', function() {
    it('should create 10 blocks for 1000 transactions', async function() {
      this.timeout(60000); // Increase timeout to 60 seconds
      
      const blockchain = new Blockchain();
      const miningRewardAddress = 'miner-address';

      // Create 1000 unique transactions
      const transactionSet = new Set();
      while (transactionSet.size < 1000) {
        const tx = createSignedTx();
        if (!transactionSet.has(tx.hash)) {
          transactionSet.add(tx.hash);
          blockchain.pendingTransactions.push(tx);
        }
      }

      // Ensure 1000 unique transactions are added
      assert.strictEqual(blockchain.pendingTransactions.length, 1000);

      // Mine pending transactions
      for (let i = 0; i < 10; i++) {
        await blockchain.minePendingTransactions(miningRewardAddress);
      }

      // Check if 10 blocks have been created
      assert.strictEqual(blockchain.chain.length, 11); // 1 genesis block + 10 mined blocks
    });
  });
});




