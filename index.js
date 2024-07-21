// Import Blockchain and Transaction classes from the blockchain module
const { Blockchain, Transaction } = require('./src/blockchain');

// Import elliptic library for cryptographic functions
const EC = require('elliptic').ec;

// Create a new elliptic curve instance using the secp256k1 curve
const ec = new EC('secp256k1');

// Generate a new key pair (private and public key)
const keyPair = ec.genKeyPair();
const privateKey = keyPair.getPrivate('hex'); // Extract the private key in hexadecimal format
const publicKey = keyPair.getPublic('hex'); // Extract the public key in hexadecimal format

// Print the generated public and private keys to the console
console.log('Public Key:', publicKey);
console.log('Private Key:', privateKey);

// Create a new instance of the Blockchain class
const myCoin = new Blockchain();

// Function to add an initial balance to an address by creating a transaction
function addInitialBalance(blockchain, address, amount) {
  const initialTx = new Transaction(null, address, amount);
  blockchain.pendingTransactions.push(initialTx);
}

// Log the initial state of the blockchain
console.log("Initial Blockchain State:");
console.log(JSON.stringify(myCoin, null, 2));

// Add initial balance of 1000 to the public key address
addInitialBalance(myCoin, publicKey, 1000);

// Async function to create and mine transactions
(async () => {
  try {
    // Mine the initial transactions to confirm the balance
    await myCoin.minePendingTransactions(publicKey);
    console.log('Initial mining complete!');

    // Log the state of the blockchain after initial mining
    console.log("Blockchain After Initial Mining:");
    console.log(JSON.stringify(myCoin, null, 2));

    // Create a new transaction from the public key address to 'address2' with amount 100
    const tx1 = new Transaction(publicKey, 'address2', 100);
    console.log('New Transaction - From Address:', tx1.fromAddress);
    console.log('New Transaction - To Address:', tx1.toAddress);

    // Sign the transaction with the private key
    tx1.sign(ec.keyFromPrivate(privateKey));
    myCoin.addTransaction(tx1);

    // Mine the new transactions
    await myCoin.minePendingTransactions('miner-address');
    console.log('Mining complete!');

    // Log the state of the blockchain after mining the new transactions
    console.log("Blockchain After Mining New Transactions:");
    console.log(JSON.stringify(myCoin, null, 2));

    // Print the balance of the public key address
    const balancePublicKey = myCoin.getBalanceOfAddress(publicKey);
    const balanceAddress2 = myCoin.getBalanceOfAddress('address2');
    console.log(`Balance of public key: ${balancePublicKey}`);
    console.log(`Balance of address2: ${balanceAddress2}`);

    // Validate the blockchain to ensure its integrity
    const isValid = await myCoin.isChainValid();
    console.log(`Blockchain valid: ${isValid}`);
  } catch (error) {
    // Catch and log any errors that occur during the process
    console.error('Error:', error);
  }
})();
