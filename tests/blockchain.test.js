const assert = require('assert');
const { Blockchain, Transaction } = require('../src/blockchain');
const { createSignedTx, signingKey, createBlockchainWithTx, createBCWithMined } = require('./helpers');

let blockchain = null;

beforeEach(async function() {
  blockchain = new Blockchain();
  await blockchain.minePendingTransactions(signingKey.getPublic('hex'));
});

describe('Blockchain class', function() {
  describe('Constructor', function() {
    it('should properly initialize fields', function() {
      assert.strictEqual(blockchain.difficulty, 2);
      assert.deepStrictEqual(blockchain.pendingTransactions, []);
      assert.strictEqual(blockchain.miningReward, 100);
    });
  });

  describe('addTransaction', function() {
    it('should correctly add new tx', async function() {
      const validTx = createSignedTx();
      blockchain.addTransaction(validTx);

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
      const tx1 = createSignedTx();
      assert.throws(() => { blockchain.addTransaction(tx1); }, Error);
    });
  });

  describe('wallet balance', function() {
    it('should give mining rewards', async function() {
      const validTx = createSignedTx();
      blockchain.addTransaction(validTx);
      blockchain.addTransaction(validTx);

      await blockchain.minePendingTransactions('b2');

      assert.strictEqual(await blockchain.getBalanceOfAddress('b2'), 100);
    });

    it('should correctly reduce wallet balance', async function() {
      const walletAddr = signingKey.getPublic('hex');
      const blockchain = await createBlockchainWithTx();

      await blockchain.minePendingTransactions(walletAddr);
      assert.strictEqual(await blockchain.getBalanceOfAddress(walletAddr), 180);
    });

    it('should work with cyclic transactions', async function() {
      const walletAddr = signingKey.getPublic('hex');
      const blockchain = await createBlockchainWithTx();

      assert.strictEqual(await blockchain.getBalanceOfAddress(walletAddr), 80);

      const tx = new Transaction(walletAddr, walletAddr, 80);
      tx.timestamp = 1;
      tx.sign(signingKey);

      blockchain.addTransaction(tx);
      await blockchain.minePendingTransactions('no_addr');
      assert.strictEqual(await blockchain.getBalanceOfAddress(walletAddr), 80);
    });
  });

  describe('minePendingTransactions', function() {
    it('should not allow pending transactions to go below zero', async function() {
      const blockchain = await createBlockchainWithTx();
      const walletAddr = signingKey.getPublic('hex');

      assert.strictEqual(await blockchain.getBalanceOfAddress('wallet2'), 0);
      assert.strictEqual(await blockchain.getBalanceOfAddress(walletAddr), 80);

      blockchain.addTransaction(createSignedTx(80));

      assert.throws(() => { blockchain.addTransaction(createSignedTx(80)); }, Error);

      await blockchain.minePendingTransactions(walletAddr);

      assert.strictEqual(await blockchain.getBalanceOfAddress(walletAddr), 0);
      assert.strictEqual(await blockchain.getBalanceOfAddress('wallet2'), 80);
    });
  });

  describe('helper functions', function() {
    it('should correctly set first block to genesis block', async function() {
      const genesisBlock = blockchain.createGenesisBlock();
      assert.deepStrictEqual(await Block.load(genesisBlock.hash), genesisBlock);
    });
  });

  describe('isChainValid', function() {
    it('should return true if no tampering', async function() {
      const blockchain = await createBlockchainWithTx();
      assert(await blockchain.isChainValid());
    });

    it('should fail when genesis block has been tampered with', async function() {
      blockchain.chain[0].timestamp = 39708;
      assert(!await blockchain.isChainValid());
    });

    it('should fail when a tx is invalid', async function() {
      const blockchain = await createBlockchainWithTx();
      blockchain.chain[2].transactions[1].amount = 897397;
      assert(!await blockchain.isChainValid());
    });

    it('should fail when a block has been changed', async function() {
      const blockchain = await createBlockchainWithTx();
      blockchain.chain[1].timestamp = 897397;
      assert(!await blockchain.isChainValid());
    });

    it('should fail when a previous block hash has been changed', async function() {
      const blockchain = await createBlockchainWithTx();
      blockchain.chain[1].transactions[0].amount = 897397;
      blockchain.chain[1].hash = blockchain.chain[1].calculateHash();
      assert(!await blockchain.isChainValid());
    });
  });

  describe('getAllTransactionsForWallet', function() {
    it('should get all Transactions for a Wallet', async function() {
      const blockchain = await createBCWithMined();
      const validTx = createSignedTx();
      blockchain.addTransaction(validTx);
      blockchain.addTransaction(validTx);

      await blockchain.minePendingTransactions('b2');
      blockchain.addTransaction(validTx);
      blockchain.addTransaction(validTx);
      await blockchain.minePendingTransactions('b2');

      const txsForB2 = await blockchain.getAllTransactionsForWallet('b2');
      assert.strictEqual(txsForB2.length, 2);
      const txsForSigningKey = await blockchain.getAllTransactionsForWallet(signingKey.getPublic('hex'));
      assert.strictEqual(txsForSigningKey.length, 5);
      
      for (const trans of txsForB2) {
        assert.strictEqual(trans.amount, 100);
        assert.strictEqual(trans.fromAddress, null);
        assert.strictEqual(trans.toAddress, 'b2');
      }
    });
  });
});

