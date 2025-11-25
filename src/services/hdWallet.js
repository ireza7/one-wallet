const bip39 = require('bip39');
const { hdkey } = require('@harmony-js/crypto');
const { Harmony } = require('@harmony-js/core');
const { ChainID, ChainType } = require('@harmony-js/utils');
const { MASTER_MNEMONIC, HARMONY_RPC_URL } = require('../config/env');

const hmy = new Harmony(HARMONY_RPC_URL, {
  chainType: ChainType.Harmony,
  chainId: ChainID.HmyMainnet
});

const seed = bip39.mnemonicToSeedSync(MASTER_MNEMONIC);
const hdWallet = hdkey.fromMasterSeed(seed);

function getPath(index) {
  return `m/44'/1023'/0'/0/${index}`;
}

function deriveWallet(index) {
  const path = getPath(index);
  const child = hdWallet.derive(path);
  const privateKey = child.privateKey.toString('hex');
  const address = hmy.crypto.getAddressFromPrivateKey(privateKey);
  return {
    privateKey: '0x' + privateKey,
    address: address.bech32
  };
}

module.exports = {
  deriveWallet
};
