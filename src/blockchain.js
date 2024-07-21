// Use strict mode for better error handling and performance
'use strict';

// Import required modules
const crypto = require('crypto'); // For hashing
const EC = require('elliptic').ec; // For elliptic curve cryptography
const ec = new EC('secp256k1'); // Instantiate elliptic curve with 'secp256k1'
const debug = require('debug')('AIBTCcoin:blockchain'); // For debugging
const db = require('./db'); // Database module

// Transaction class definition
class Transaction {
  constructor(fromAddress, toAddress, amount) {
    this.fromAddress = fromAddress; // Address of sender
    this.toAddress = toAddress; // Address of receiver
    this.amount = amount; // Amount to be transferred
    this.timestamp = Date.now(); // Timestamp of the transaction
    this.signature = null; // Signature of the transaction
    this.blockHash = ''; // Hash of the block containing this transaction
  }

  // Calculate the hash of the transaction
  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(this.fromAddress + this.toAddress + this.amount + this.timestamp)
      .digest('hex');
  }

  // Sign the transaction with the given signing key
  sign(signingKey) {
    console.log('Signing Public Key:', signingKey.getPublic('hex'));
    console.log('Transaction From Address:', this.fromAddress);
    
    // Ensure the signing key matches the fromAddress
    if (signingKey.getPublic('hex') !== this.fromAddress) {
      throw new Error('You cannot sign transactions for other wallets!');
    }

    // Calculate the transaction hash and sign it
    const hashTx = this.calculateHash();
    const sig = signingKey.sign(hashTx, 'base64');
    this.signature = sig.toDER('hex');
  }

  // Validate the transaction
  isValid() {
    if (this.fromAddress === null) return true; // Allow mining rewards
  
    if (!this.signature || this.signature.length === 0) {
      throw new Error('No signature in this transaction');
    }

    // Verify the signature
    const publicKey = ec.keyFromPublic(this.fromAddress, 'hex');
    return publicKey.verify(this.calculateHash(), this.signature);
  }
  
  // Save the transaction to the database
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

  // Load a transaction from the database
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

// Block class definition
class Block {
  constructor(timestamp, transactions, previousHash = '') {
    this.previousHash = previousHash; // Hash of the previous block
    this.timestamp = timestamp; // Timestamp of block creation
    this.transactions = transactions; // Transactions included in the block
    this.nonce = 0; // Nonce for mining
    this.hash = this.calculateHash(); // Hash of the block
    this.difficulty = 2; // Mining difficulty
  }

  // Calculate the hash of the block
  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(this.previousHash + this.timestamp + JSON.stringify(this.transactions.map(tx => {
        const { blockHash, ...txWithoutBlockHash } = tx; // Exclude blockHash from transaction data
        return txWithoutBlockHash;
      })) + this.nonce)
      .digest('hex');
  }
  
  // Mine the block by finding a hash that satisfies the difficulty
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

  // Validate all transactions in the block
  hasValidTransactions() {
    for (const tx of this.transactions) {
      if (!tx.isValid()) {
        return false;
      }
    }
    return true;
  }

  // Save the block and its transactions to the database
  async save() {
    const query = 'INSERT INTO blocks (hash, previous_hash, timestamp, nonce, difficulty) VALUES (?, ?, ?, ?, ?)';
    const values = [this.hash, this.previousHash, this.timestamp, this.nonce, this.difficulty];

    return new Promise((resolve, reject) => {
      db.query(query, values, async (err, results) => {
        if (err) return reject(err);
        
        for (const tx of this.transactions) {
          tx.blockHash = this.hash; // Set blockHash for each transaction
          await tx.save(); // Save each transaction
        }
        
        resolve(results);
      });
    });
  }

  // Load a block and its transactions from the database
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
              const transaction = await Transaction.load(tx.hash); // Load each transaction
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

// Blockchain class definition
class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()]; // Initialize blockchain with genesis block
    this.difficulty = 2; // Mining difficulty
    this.pendingTransactions = []; // Transactions waiting to be mined
    this.miningReward = 100; // Reward for mining a block
  }

  // Create the genesis block
  createGenesisBlock() {
    return new Block(Date.now(), [], '0');
  }

  // Get the latest block in the chain
  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  // Mine pending transactions and reward the miner
  async minePendingTransactions(miningRewardAddress) {
    const rewardTx = new Transaction(null, miningRewardAddress, this.miningReward);
    this.pendingTransactions.push(rewardTx);

    const block = new Block(Date.now(), this.pendingTransactions, this.getLatestBlock().hash);
    block.mineBlock(this.difficulty);

    debug('Block successfully mined!');
    
    await block.save(); // Save the mined block

    this.chain.push(block); // Add the block to the chain
    this.pendingTransactions = []; // Clear pending transactions
  }

  // Add a new transaction to the list of pending transactions
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

    // Ensure there are no pending transactions exceeding the wallet balance
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

  // Get the balance of a given address
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

  // Validate the entire blockchain
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
    
      // Validate the block hash
      if (currentBlock.hash !== currentBlock.calculateHash()) {
        console.log(`Block ${i} hash invalid`);
        console.log(`Expected hash: ${currentBlock.hash}`);
        console.log(`Actual hash: ${currentBlock.calculateHash()}`);
        return false;
      }
    
      // Validate the link between blocks
      if (currentBlock.previousHash !== previousBlock.hash) {
        console.log(`Block ${i} previous hash invalid`);
        return false;
      }
    
      // Validate all transactions in the block
      if (!currentBlock.hasValidTransactions()) {
        console.log(`Block ${i} has invalid transactions`);
        return false;
      }
    }

    return true;
  }
}

// Export the classes for use in other modules
module.exports = { Blockchain, Block, Transaction };





