// Define the createSignedTx function
function createSignedTx() {
  return {
    fromAddress: 'public-key',
    toAddress: 'b2',
    amount: 10,
    timestamp: 0,
    signature: 'sig'
  };
}

// Define or import the signingKey object
const signingKey = {
  getPublic: function() {
    return 'public-key'; 
  }
};

// Export the functions and objects
module.exports = {
  createSignedTx,
  signingKey
};


