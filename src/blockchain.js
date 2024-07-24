'use strict';

const crypto = require('crypto'); // Required for creating cryptographic hashes
const EC = require('elliptic').ec; // Required for elliptic curve cryptography
const db = require('./db'); // Database module for interacting with the database
const { Node, MerkleTree } = require('./merkleTree'); // Importing MerkleTree and Node classes

const ec = new EC('secp256k1'); // Initialize the elliptic curve for cryptography

class Transaction {
  constructor(fromAddress, toAddress, amount, timestamp = Date.now(), signature = null, blockHash = '') {
    this.fromAddress = fromAddress; // Address sending the funds
    this.toAddress = toAddress; // Address receiving the funds
    this.amount = amount; // Amount of funds being transferred
    this.timestamp = timestamp; // Timestamp of when the transaction was created
    this.signature = signature; // Digital signature for transaction validation
    this.blockHash = blockHash; // Hash of the block this transaction is included in (if any)
    this.hash = this.calculateHash(); // Calculate the transaction hash
  }

  // Calculate the hash of the transaction
  calculateHash() {
    return crypto.createHash('sha256')
      .update(this.fromAddress + this.toAddress + this.amount + this.timestamp)
      .digest('hex');
  }

  // Sign the transaction using the provided key pair
  sign(keyPair) {
    const hashTx = this.calculateHash(); // Get the hash of the transaction
    if (keyPair.getPublic('hex') !== this.fromAddress) {
      throw new Error('You cannot sign transactions for other wallets!');
    }
    const sig = keyPair.sign(hashTx, 'hex'); // Sign the transaction hash
    this.signature = sig.toDER('hex'); // Set the signature
  }

  // Validate the transaction
  isValid() {
    const hashToVerify = this.calculateHash(); // Calculate the hash to verify
    if (this.fromAddress === null) return true; // Allow transactions with no sender (e.g., mining reward)
    if (!this.signature || this.signature.length === 0) {
      return false; // Transaction must be signed
    }
    try {
      const key = ec.keyFromPublic(this.fromAddress, 'hex'); // Load the public key from the address
      return key.verify(hashToVerify, this.signature); // Verify the signature
    } catch (error) {
      return false; // If any error occurs, the transaction is invalid
    }
  }

  // Save the transaction to the database
  save() {
    return new Promise((resolve, reject) => {
      const query = 'INSERT INTO transactions (hash, from_address, to_address, amount, timestamp, signature, block_hash) VALUES (?, ?, ?, ?, ?, ?, ?)';
      const values = [this.hash, this.fromAddress, this.toAddress, this.amount, this.timestamp, this.signature, this.blockHash];
      db.query(query, values, (err, results) => {
        if (err) {
          return reject(err); // If there is an error, reject the promise
        }
        resolve(results); // Resolve with the database result
      });
    });
  }

  // Load a transaction from the database
  static async load(hash) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM transactions WHERE hash = ?';
      db.query(query, [hash], (err, results) => {
        if (err) return reject(err); // If there is an error, reject the promise
        if (results.length > 0) {
          const txData = results[0]; // Get the transaction data from the result
          const tx = new Transaction(txData.from_address, txData.to_address, txData.amount, txData.timestamp, txData.signature, txData.block_hash);
          tx.hash = txData.hash; // Set the hash
          resolve(tx); // Resolve with the transaction object
        } else {
          resolve(null); // If no results found, resolve with null
        }
      });
    });
  }
}

class Block {
  constructor(index, previousHash, timestamp, transactions, difficulty) {
    this.index = index; // Block index in the blockchain
    this.previousHash = previousHash; // Hash of the previous block
    this.timestamp = timestamp; // Timestamp of when the block was created
    this.transactions = transactions; // Array of transactions in this block
    this.difficulty = difficulty; // Mining difficulty for this block
    this.merkleRoot = this.calculateMerkleRoot(); // Root hash of the Merkle tree
    this.nonce = 0; // Nonce for mining (initially set to 0)
    this.hash = this.calculateHash(); // Calculate the block hash
  }

  // Calculate the Merkle root for the transactions in the block
  calculateMerkleRoot() {
    if (this.transactions.length === 0) {
      return '0'.repeat(64); // Return a default hash if there are no transactions
    }
    const hashes = this.transactions.map(tx => tx.hash); // Get hashes of all transactions
    const merkleTree = new MerkleTree(hashes); // Create a Merkle tree with the transaction hashes
    return merkleTree.getRootHash(); // Get the root hash of the Merkle tree
  }

  // Calculate the hash of the block
  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(this.previousHash + this.timestamp + this.merkleRoot + this.nonce + JSON.stringify(this.transactions.map(tx => {
        const { blockHash, ...txWithoutBlockHash } = tx; // Exclude blockHash from transaction data
        return txWithoutBlockHash; // Convert transactions to JSON string
      })))
      .digest('hex');
  }

  // Mine the block by finding a hash that meets the difficulty requirements
  mineBlock(difficulty) {
    while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join('0')) {
      this.nonce++; // Increment the nonce
      this.hash = this.calculateHash(); // Recalculate the block hash
    }
  }

  // Check if all transactions in the block are valid
  hasValidTransactions() {
    for (const tx of this.transactions) {
      if (!tx.isValid()) {
        console.error(`Invalid transaction: ${tx.hash}`); // Log invalid transactions
        return false;
      }
    }
    return true; // All transactions are valid
  }

  // Save the block to the database
  async save() {
    const query = 'INSERT INTO blocks (hash, previous_hash, timestamp, nonce, difficulty, merkle_root) VALUES (?, ?, ?, ?, ?, ?)';
    const values = [this.hash, this.previousHash, this.timestamp, this.nonce, this.difficulty, this.merkleRoot];
    return new Promise((resolve, reject) => {
      db.query(query, values, async (err, results) => {
        if (err) {
          return reject(err); // If there is an error, reject the promise
        }
        try {
          // Save all transactions in this block
          for (const tx of this.transactions) {
            tx.blockHash = this.hash;
            await tx.save(); // Save each transaction
          }
          
          // Save Merkle tree nodes to the database
          const merkleTree = new MerkleTree(this.transactions.map(tx => tx.hash));
          await merkleTree.saveNodesToDatabase(this.hash);
          
          resolve(results); // Resolve with the database result
        } catch (saveErr) {
          reject(saveErr); // If there is an error saving transactions or Merkle tree, reject the promise
        }
      });
    });
  }

  // Load a block from the database
  static async load(hash) {
    const query = 'SELECT * FROM blocks WHERE hash = ?';
    return new Promise((resolve, reject) => {
      db.query(query, [hash], async (err, results) => {
        if (err) return reject(err); // If there is an error, reject the promise
        if (results.length > 0) {
          const result = results[0]; // Get the block data from the result
          const block = new Block(result.index, result.previous_hash, result.timestamp, [], result.difficulty);
          block.hash = result.hash; // Set the block hash
          block.nonce = result.nonce; // Set the nonce
          block.merkleRoot = result.merkle_root; // Set the Merkle root

          // Load transactions for the block
          const txQuery = 'SELECT hash FROM transactions WHERE block_hash = ?';
          db.query(txQuery, [block.hash], async (err, txResults) => {
            if (err) return reject(err); // If there is an error, reject the promise
            for (const tx of txResults) {
              const transaction = await Transaction.load(tx.hash); // Load each transaction
              if (transaction) {
                if (!transaction.isValid()) {
                  console.error(`Invalid transaction in block ${block.index}: ${tx.hash}`);
                  return reject(new Error(`Invalid transaction in block ${block.index}`));
                }
                block.transactions.push(transaction); // Add valid transactions to the block
              }
            }
            // Validate the block's hash and Merkle root
            if (block.hash !== block.calculateHash()) {
              console.error(`Invalid block hash for block ${block.index}`);
              return reject(new Error(`Invalid block hash for block ${block.index}`));
            }
            if (block.merkleRoot !== block.calculateMerkleRoot()) {
              console.error(`Invalid Merkle root for block ${block.index}`);
              return reject(new Error(`Invalid Merkle root for block ${block.index}`));
            }
            resolve(block); // Resolve with the block object
          });
        } else {
          resolve(null); // If no results found, resolve with null
        }
      });
    });
  }
}

class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()]; // Start with the genesis block
    this.difficulty = 0; // Initial difficulty (for mining)
    this.pendingTransactions = []; // Transactions waiting to be mined
    this.miningReward = 100; // Reward for mining a new block
  }

  // Create the first block of the blockchain (genesis block)
  createGenesisBlock() {
    return new Block(0, '0', Date.now(), [], this.difficulty);
  }

  // Get the latest block in the blockchain
  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  // Mine pending transactions and add a new block to the blockchain
  async minePendingTransactions(miningRewardAddress) {
    const rewardTx = new Transaction(null, miningRewardAddress, this.miningReward); // Create a reward transaction
    this.pendingTransactions.push(rewardTx); // Add reward transaction to pending transactions

    // Create a new block with pending transactions
    const block = new Block(this.chain.length, this.getLatestBlock().hash, Date.now(), this.pendingTransactions, this.difficulty);
    block.mineBlock(this.difficulty); // Mine the block

    await block.save(); // Save the block to the database

    this.chain.push(block); // Add the block to the blockchain
    this.pendingTransactions = []; // Clear pending transactions
  }

  // Add a new transaction to the list of pending transactions
  addTransaction(transaction) {
    if (!transaction.fromAddress || !transaction.toAddress) {
      throw new Error('Transaction must include from and to address.');
    }
    if (transaction.amount <= 0) {
      throw new Error('Transaction amount should be greater than 0.');
    }
    if (!transaction.isValid()) {
      throw new Error('Cannot add invalid transaction to the chain.');
    }
    this.pendingTransactions.push(transaction); // Add the transaction to pending transactions
  }

  // Get the balance of a specific address
  getBalanceOfAddress(address) {
    let balance = 0;
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.fromAddress === address) {
          balance -= tx.amount; // Deduct amount if address is sender
        }
        if (tx.toAddress === address) {
          balance += tx.amount; // Add amount if address is recipient
        }
      }
    }
    return balance; // Return the balance
  }

  // Check if the blockchain is valid
  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Check if the current block's hash is valid
      if (currentBlock.hash !== currentBlock.calculateHash()) {
        console.error(`Invalid hash at block ${currentBlock.index}`);
        return false;
      }

      // Check if the previous hash matches the previous block's hash
      if (currentBlock.previousHash !== previousBlock.hash) {
        console.error(`Invalid previous hash at block ${currentBlock.index}`);
        return false;
      }

      // Check if the Merkle root is valid
      const calculatedMerkleRoot = currentBlock.calculateMerkleRoot();
      if (currentBlock.merkleRoot !== calculatedMerkleRoot) {
        console.error(`Invalid Merkle root in block ${currentBlock.index}`);
        console.error(`Stored Merkle root: ${currentBlock.merkleRoot}`);
        console.error(`Calculated Merkle root: ${calculatedMerkleRoot}`);
        return false;
      }
    }
    return true; // Blockchain is valid
  }

  // Load the blockchain from the database
  static async load() {
    const blockchain = new Blockchain();
    const query = 'SELECT * FROM blocks ORDER BY index ASC';
    return new Promise((resolve, reject) => {
      db.query(query, async (err, results) => {
        if (err) return reject(err); // If there is an error, reject the promise
        for (const result of results) {
          const block = await Block.load(result.hash); // Load each block
          if (block) {
            blockchain.chain.push(block); // Add the block to the blockchain
          }
        }

        // Validate the blockchain after loading
        if (!blockchain.isChainValid()) {
          console.error("Blockchain is invalid");
          reject(new Error("Blockchain is invalid"));
        } else {
          console.log("Blockchain is valid");
          resolve(blockchain); // Resolve with the loaded blockchain
        }
      });
    });
  }
}

module.exports = {
  Blockchain,
  Transaction,
  Block
};

