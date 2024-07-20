'use strict';
const crypto = require('crypto');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');
const debug = require('debug')('AIBTCcoin:blockchain');
const db = require('./db');  

class Transaction {
  constructor(fromAddress, toAddress, amount) {
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.amount = amount;
    this.timestamp = Date.now();
    this.signature = null; 
    this.blockHash = ''; 
  }

  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(this.fromAddress + this.toAddress + this.amount + this.timestamp)
      .digest('hex');
  }

  sign(signingKey) {
    console.log('Signing Public Key:', signingKey.getPublic('hex'));
    console.log('Transaction From Address:', this.fromAddress);
    
    if (signingKey.getPublic('hex') !== this.fromAddress) {
      throw new Error('You cannot sign transactions for other wallets!');
    }
  
    const hashTx = this.calculateHash();
    const sig = signingKey.sign(hashTx, 'base64');
    this.signature = sig.toDER('hex');
  }

  isValid() {
    if (this.fromAddress === null) return true;
  
    if (!this.signature || this.signature.length === 0) {
      throw new Error('No signature in this transaction');
    }
  
    const publicKey = ec.keyFromPublic(this.fromAddress, 'hex');
    return publicKey.verify(this.calculateHash(), this.signature);
  }
  
  async save() {
    const query = 'INSERT INTO transactions (hash, from_address, to_address, amount, timestamp, signature, block_hash) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const values = [this.calculateHash(), this.fromAddress, this.toAddress, this.amount, this.timestamp, this.signature, this.blockHash];

    return new Promise((resolve, reject) => {
      db.query(query, values, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });
  }

  static async load(hash) {
    const query = 'SELECT * FROM transactions WHERE hash = ?';

    return new Promise((resolve, reject) => {
      db.query(query, [hash], (err, results) => {
        if (err) return reject(err);
        if (results.length > 0) {
          const result = results[0];
          const tx = new Transaction(result.from_address, result.to_address, result.amount);
          tx.timestamp = result.timestamp;
          tx.signature = result.signature;
          tx.blockHash = result.block_hash;
          resolve(tx);
        } else {
          resolve(null);
        }
      });
    });
  }
}

class Block {
  constructor(timestamp, transactions, previousHash = '') {
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.nonce = 0;
    this.hash = this.calculateHash();
    this.difficulty = 2;  
  }

  calculateHash() {
    return crypto
        .createHash('sha256')
        .update(this.previousHash + this.timestamp + JSON.stringify(this.transactions.map(tx => {
          const { blockHash, ...txWithoutBlockHash } = tx; 
          return txWithoutBlockHash;
        })) + this.nonce)
        .digest('hex');
  }
  
  mineBlock(difficulty) {
    while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join('0')) {
        this.nonce++;
        this.hash = this.calculateHash();
    }

    console.log("Block mined:");
    console.log("Previous Hash:", this.previousHash);
    console.log("Timestamp:", this.timestamp);
    console.log("Transactions:", JSON.stringify(this.transactions));
    console.log("Nonce:", this.nonce);
    console.log("Hash:", this.hash);

    console.log(`Block mined: ${this.hash}`);
  }

  hasValidTransactions() {
    for (const tx of this.transactions) {
      if (!tx.isValid()) {
        return false;
      }
    }
    return true;
  }

  async save() {
    const query = 'INSERT INTO blocks (hash, previous_hash, timestamp, nonce, difficulty) VALUES (?, ?, ?, ?, ?)';
    const values = [this.hash, this.previousHash, this.timestamp, this.nonce, this.difficulty];

    return new Promise((resolve, reject) => {
      db.query(query, values, async (err, results) => {
        if (err) return reject(err);
        
        for (const tx of this.transactions) {
          tx.blockHash = this.hash;
          await tx.save();
        }
        
        resolve(results);
      });
    });
  }

  static async load(hash) {
    const query = 'SELECT * FROM blocks WHERE hash = ?';

    return new Promise((resolve, reject) => {
      db.query(query, [hash], async (err, results) => {
        if (err) return reject(err);
        
        if (results.length > 0) {
          const result = results[0];
          const block = new Block(result.timestamp, [], result.previous_hash);
          block.hash = result.hash;
          block.nonce = result.nonce;
          block.difficulty = result.difficulty;

          const txQuery = 'SELECT hash FROM transactions WHERE block_hash = ?';
          db.query(txQuery, [block.hash], async (err, txResults) => {
            if (err) return reject(err);
            
            for (const tx of txResults) {
              const transaction = await Transaction.load(tx.hash);
              if (transaction) block.transactions.push(transaction);
            }

            resolve(block);
          });
        } else {
          resolve(null);
        }
      });
    });
  }
}

class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 2;
    this.pendingTransactions = [];
    this.miningReward = 100;
  }

  createGenesisBlock() {
    return new Block(Date.now(), [], '0');
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  async minePendingTransactions(miningRewardAddress) {
    const rewardTx = new Transaction(null, miningRewardAddress, this.miningReward);
    this.pendingTransactions.push(rewardTx);

    const block = new Block(Date.now(), this.pendingTransactions, this.getLatestBlock().hash);
    block.mineBlock(this.difficulty);

    debug('Block successfully mined!');
    
    await block.save();

    this.chain.push(block);
    this.pendingTransactions = [];
  }

  addTransaction(transaction) {
    if (!transaction.fromAddress || !transaction.toAddress) {
      throw new Error('Transaction must include from and to address');
    }

    if (!transaction.isValid()) {
      throw new Error('Cannot add invalid transaction to chain');
    }

    if (transaction.amount <= 0) {
      throw new Error('Transaction amount should be higher than 0');
    }

    const walletBalance = this.getBalanceOfAddress(transaction.fromAddress);
    console.log(`Wallet balance for ${transaction.fromAddress}: ${walletBalance}`);
    if (walletBalance < transaction.amount) {
      throw new Error('Not enough balance');
    }

    const pendingTxForWallet = this.pendingTransactions.filter(
      tx => tx.fromAddress === transaction.fromAddress
    );

    if (pendingTxForWallet.length > 0) {
      const totalPendingAmount = pendingTxForWallet
        .map(tx => tx.amount)
        .reduce((prev, curr) => prev + curr, 0);

      const totalAmount = totalPendingAmount + transaction.amount;
      if (totalAmount > walletBalance) {
        throw new Error(
          'Pending transactions for this wallet is higher than its balance.'
        );
      }
    }

    this.pendingTransactions.push(transaction);
    debug('Transaction added: %s', transaction);
  }

  getBalanceOfAddress(address) {
    let balance = 0;

    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.fromAddress === address) {
          balance -= tx.amount;
        }

        if (tx.toAddress === address) {
          balance += tx.amount;
        }
      }
    }

    return balance;
  }

  async isChainValid() {
    const genesisBlock = this.chain[0];
    if (genesisBlock.hash !== genesisBlock.calculateHash()) {
      console.log('Genesis block hash invalid');
      return false;
    }

    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      console.log(`Validating Block ${i}`);
      console.log("Current Block Hash:", currentBlock.hash);
      console.log("Calculated Hash:", currentBlock.calculateHash());
      console.log("Previous Hash:", currentBlock.previousHash);
      console.log("Timestamp:", currentBlock.timestamp);
      console.log("Transactions:", JSON.stringify(currentBlock.transactions));
      console.log("Nonce:", currentBlock.nonce);
    
      if (currentBlock.hash !== currentBlock.calculateHash()) {
        console.log(`Block ${i} hash invalid`);
        console.log(`Expected hash: ${currentBlock.hash}`);
        console.log(`Actual hash: ${currentBlock.calculateHash()}`);
        return false;
      }
    
      if (currentBlock.previousHash !== previousBlock.hash) {
        console.log(`Block ${i} previous hash invalid`);
        return false;
      }
    
      if (!currentBlock.hasValidTransactions()) {
        console.log(`Block ${i} has invalid transactions`);
        return false;
      }
    }

    return true;
  }
}

module.exports = { Blockchain, Block, Transaction };




