const { Blockchain, Transaction } = require('./src/blockchain');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

// Generate key pair
const keyPair = ec.genKeyPair();
const privateKey = keyPair.getPrivate('hex');
const publicKey = keyPair.getPublic('hex');

// Debug statements
console.log('Public Key:', publicKey);
console.log('Private Key:', privateKey);

// Create blockchain instance
const myCoin = new Blockchain();

// Function to add an initial balance to an address
function addInitialBalance(blockchain, address, amount) {
  const initialTx = new Transaction(null, address, amount);
  blockchain.pendingTransactions.push(initialTx);
}

// Log the initial state of the blockchain
console.log("Initial Blockchain State:");
console.log(JSON.stringify(myCoin, null, 2));

// Add initial balance to the public key address
addInitialBalance(myCoin, publicKey, 1000);

// Create and sign an initial transaction
(async () => {
  try {
    // Mine the initial transactions to confirm the balance
    await myCoin.minePendingTransactions(publicKey);
    console.log('Initial mining complete!');

    // Log the state of the blockchain after initial mining
    console.log("Blockchain After Initial Mining:");
    console.log(JSON.stringify(myCoin, null, 2));

    // Create and sign a new transaction
    const tx1 = new Transaction(publicKey, 'address2', 100);
    console.log('New Transaction - From Address:', tx1.fromAddress);
    console.log('New Transaction - To Address:', tx1.toAddress);

    tx1.sign(ec.keyFromPrivate(privateKey));
    myCoin.addTransaction(tx1);

    // Mine the new transactions
    await myCoin.minePendingTransactions('miner-address');
    console.log('Mining complete!');

    // Log the state of the blockchain after mining the new transactions
    console.log("Blockchain After Mining New Transactions:");
    console.log(JSON.stringify(myCoin, null, 2));

    // Print balances
    const balancePublicKey = myCoin.getBalanceOfAddress(publicKey);
    const balanceAddress2 = myCoin.getBalanceOfAddress('address2');
    console.log(`Balance of public key: ${balancePublicKey}`);
    console.log(`Balance of address2: ${balanceAddress2}`);

    // Validate the chain
    const isValid = await myCoin.isChainValid();
    console.log(`Blockchain valid: ${isValid}`);
  } catch (error) {
    console.error('Error:', error);
  }
})();
