const { Harmony } = require('@harmony-js/core');
const { ChainID, ChainType, Unit } = require('@harmony-js/utils');
const { HARMONY_RPC_URL } = require('../config/env');

const hmy = new Harmony(HARMONY_RPC_URL, {
  chainType: ChainType.Harmony,
  chainId: ChainID.HmyMainnet
});

async function getBalance(address) {
  const res = await hmy.blockchain.getBalance({ address });
  if (res.result) {
    return Number(hmy.utils.fromWei(res.result, 'ether'));
  }
  return 0;
}

async function sendTransaction(fromPrivateKey, toAddress, amountOne) {
  const wallet = hmy.wallet.addByPrivateKey(fromPrivateKey);

  const txn = hmy.transactions.newTx({
    to: toAddress,
    value: hmy.utils.toWei(amountOne.toString(), 'ether'),
    gasLimit: '21000',
    gasPrice: new Unit('1').asGwei().toWei()
  });

  const signedTx = await wallet.signTransaction(txn);
  const [sentTx, hash] = await signedTx.sendTransaction();
  const confirmation = await sentTx.confirm(hash);

  return {
    txHash: hash,
    confirmation
  };
}

module.exports = {
  getBalance,
  sendTransaction
};
