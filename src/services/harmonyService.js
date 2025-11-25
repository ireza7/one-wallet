const { ethers } = require("ethers");
const { HARMONY_RPC_URL } = require("../config/env");

const provider = new ethers.JsonRpcProvider(HARMONY_RPC_URL);

function oneToHex(oneAddress) {
    if (oneAddress.startsWith("one1")) {
        return ethers.getAddress(ethers.decodeBech32Address(oneAddress));
    }
    return oneAddress;
}

function hexToOne(hexAddress) {
    return ethers.encodeBech32Address("one", hexAddress);
}

async function getBalance(address) {
    const hexAddr = oneToHex(address);
    const balance = await provider.getBalance(hexAddr);
    return Number(ethers.formatEther(balance));
}

async function sendTransaction(privateKey, to, amount) {
    const wallet = new ethers.Wallet(privateKey, provider);

    const tx = await wallet.sendTransaction({
        to: oneToHex(to),
        value: ethers.parseEther(amount.toString()),
        gasLimit: 21000n
    });

    const receipt = await tx.wait();

    return {
        txHash: tx.hash,
        confirmation: receipt
    };
}

module.exports = {
    getBalance,
    sendTransaction,
    oneToHex,
    hexToOne
};
