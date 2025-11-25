const { Wallet } = require('ethers');
const { MASTER_MNEMONIC } = require('../config/env');
const { hexToOne } = require('../utils/harmonyAddress');

function deriveWallet(index) {
  const path = `m/44'/1023'/0'/0/${index}`;
  const wallet = Wallet.fromPhrase(MASTER_MNEMONIC, undefined, path);
  const hexAddress = wallet.address;
  const oneAddress = hexToOne(hexAddress);
  return {
    privateKey: wallet.privateKey,
    hexAddress,
    oneAddress
  };
}

module.exports = {
  deriveWallet
};
