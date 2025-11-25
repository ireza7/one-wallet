
const ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function bech32Polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) chk ^= GEN[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp) {
  const ret = [];
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}

function bech32CreateChecksum(hrp, data) {
  const values = bech32HrpExpand(hrp).concat(data);
  const polymod = bech32Polymod(values.concat([0, 0, 0, 0, 0, 0])) ^ 1;
  const ret = [];
  for (let i = 0; i < 6; i++) {
    ret.push((polymod >> (5 * (5 - i))) & 31);
  }
  return ret;
}

function bech32Encode(hrp, data) {
  const combined = data.concat(bech32CreateChecksum(hrp, data));
  let out = hrp + "1";
  for (const v of combined) out += ALPHABET[v];
  return out;
}

function convertBits(data, fromBits, toBits, pad = true) {
  let acc = 0;
  let bits = 0;
  const ret = [];
  const maxv = (1 << toBits) - 1;

  for (const value of data) {
    if (value < 0 || value >> fromBits !== 0) return null;
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }

  if (pad) {
    if (bits > 0) {
      ret.push((acc << (toBits - bits)) & maxv);
    }
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
    return null;
  }

  return ret;
}

function hexToBech32(hexAddress) {
  let hex = hexAddress.toLowerCase().replace(/^0x/, "");
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  const words = convertBits(bytes, 8, 5, true);
  return bech32Encode("one", words);
}

function bech32ToHex(oneAddress) {
  const addr = oneAddress.toLowerCase();
  if (!addr.startsWith("one1")) throw new Error("invalid harmony address");

  const pos = addr.indexOf("1");
  const dataPart = addr.slice(pos + 1);

  const values = [];
  for (const c of dataPart) {
    const idx = ALPHABET.indexOf(c);
    if (idx === -1) throw new Error("invalid character in address");
    values.push(idx);
  }

  const data = values.slice(0, -6);
  const bytes = convertBits(data, 5, 8, false);
  return "0x" + bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}

module.exports = {
  hexToBech32,
  bech32ToHex,
};
