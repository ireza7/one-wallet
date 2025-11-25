const bip39 = require("bip39");
const { ethers } = require("ethers");
const { MASTER_MNEMONIC } = require("../config/env");

function deriveWallet(index) {
    const path = `m/44'/1023'/0'/0/${index}`;
    const seed = bip39.mnemonicToSeedSync(MASTER_MNEMONIC);
    const hdNode = ethers.HDNodeWallet.fromSeed(seed);
    const child = hdNode.derivePath(path);

    return {
        privateKey: child.privateKey,
        address: ethers.encodeBech32Address("one", child.address)
    };
}

module.exports = { deriveWallet };
