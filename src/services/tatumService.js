const axios = require('axios');
const { TATUM_API_KEY, WEBHOOK_URL } = require('../config/env');

async function subscribeToAddress(address) {
  try {
    // مستندات Tatum V3/V4 برای ساخت Subscription
    // نکته: برای Harmony One معمولا chain را 'ONE' می‌شناسد
    const response = await axios.post(
      'https://api.tatum.io/v3/subscription',
      {
        type: 'ADDRESS_TRANSACTION', 
        attr: {
          address: address,
          chain: 'ONE',
          url: WEBHOOK_URL
        }
      },
      {
        headers: {
          'x-api-key': TATUM_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`[Tatum] Subscribed to ${address}. Sub ID: ${response.data.id}`);
    return response.data.id;

  } catch (error) {
    // اگر ارور داد که قبلا سابسکرایب شده، مشکلی نیست
    const msg = error.response?.data?.message || error.message;
    console.warn(`[Tatum] Subscription warning for ${address}:`, msg);
    return null;
  }
}

module.exports = { subscribeToAddress };