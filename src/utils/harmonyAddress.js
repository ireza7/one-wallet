const { bech32 } = require('bech32');
const { getAddress } = require('ethers');

function oneToHex(addr) {
  if (addr.toLowerCase().startsWith('one1')) {
    const decoded = bech32.decode(addr);
    const bytes = Buffer.from(bech32.fromWords(decoded.words));
    const hex = '0x' + bytes.toString('hex');
    return getAddress(hex);
  }
  // assume it's already hex
  return getAddress(addr);
}

function hexToOne(addr) {
  const hex = addr.startsWith('0x') ? addr.slice(2) : addr;
  const bytes = Buffer.from(hex, 'hex');
  const words = bech32.toWords(bytes);
  return bech32.encode('one', words);
}

module.exports = {
  oneToHex,
  hexToOne
};
