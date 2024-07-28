const assert = require('assert');
const { Transaction, Blockchain } = require('../src/blockchain'); // Adjust path
const { createSignedTx, signingKey } = require('./helpers'); // Ensure these helpers are adapted

const EC = require('elliptic').ec;

const ec = new EC('secp256k1');

describe('Transaction class', function() {
  describe('Constructor', function() {
    it('should correctly initialize the transaction', function() {
      const tx = new Transaction('address1', 'address2', 100);
      assert.strictEqual(tx.fromAddress, 'address1');
      assert.strictEqual(tx.toAddress, 'address2');
      assert.strictEqual(tx.amount, 100);
      assert.ok(tx.timestamp);
      assert.strictEqual(tx.signature, null);
    });
  });

  describe('Sign', function() {
    it('should sign the transaction', function() {
      const tx = createSignedTx();
      assert.ok(tx.signature);
    });

    it('should fail if trying to sign without the from address', function() {
      const tx = createSignedTx();
      tx.fromAddress = null;
      assert.throws(() => { tx.sign(signingKey); }, Error);
    });
  });

  describe('isValid', function() {
    it('should be valid if signed and has all required fields', function() {
      const tx = createSignedTx();
      assert(tx.isValid());
    });

    it('should fail if the signature is invalid', function() {
      const tx = createSignedTx();
      tx.signature = 'invalid';
      assert(!tx.isValid());
    });

    it('should fail if the transaction is not signed', function() {
      const tx = createSignedTx();
      tx.signature = null;
      assert(!tx.isValid());
    });

    it('should fail if the transaction has a negative amount', function() {
      const tx = createSignedTx();
      tx.amount = -10;
      assert(!tx.isValid());
    });

    it('should fail when not having enough balance', () => {
      const blockchain = new Blockchain();
      
      // Generate a key pair for the test
      const keyPair = ec.genKeyPair();
      const walletAddress = keyPair.getPublic('hex');
      
      // Mine a block to give the wallet some balance
      blockchain.minePendingTransactions(walletAddress);
      
      // Try to create a transaction with an amount larger than the balance
      const tx1 = new Transaction(walletAddress, 'recipientAddress', 150);
      tx1.sign(keyPair);
      
      // Check if the transaction is added to the blockchain's pending transactions
      const added = blockchain.addTransaction(tx1);
    
      // Assert the transaction was not added due to insufficient balance
      assert.strictEqual(added, false);
    });

    it('should fail if the transaction has zero amount', function() {
      const tx = createSignedTx();
      tx.amount = 0;
      assert(!tx.isValid());
    });
  });
});

