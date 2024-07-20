const assert = require('assert');
const { Transaction } = require('../src/blockchain');
const { createSignedTx, signingKey } = require('./helpers');

describe('Transaction class', function() {
  describe('Constructor', function() {
    it('should correctly initialize the transaction', function() {
      const tx = createSignedTx();
      assert.strictEqual(tx.fromAddress, signingKey.getPublic('hex'));
      assert.strictEqual(tx.toAddress, 'b2');
      assert.strictEqual(tx.amount, 10);
      assert.strictEqual(tx.timestamp, 0);
      assert.strictEqual(tx.signature, 'sig');
    });
  });

  describe('Sign', function() {
    it('should sign the transaction', function() {
      const tx = createSignedTx();
      assert.strictEqual(tx.signature, 'sig');
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

    it('should fail if the transaction has zero amount', function() {
      const tx = createSignedTx();
      tx.amount = 0;
      assert(!tx.isValid());
    });
  });
});

