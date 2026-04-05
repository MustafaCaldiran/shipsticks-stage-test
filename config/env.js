require('dotenv').config();

module.exports = {
  baseUrl: process.env.BASE_URL || 'https://app.staging.shipsticks.com',
  headed: process.env.HEADED === 'true',
  slowMo: parseInt(process.env.SLOW_MO || '0', 10),
  timeout: parseInt(process.env.TIMEOUT || '60000', 10),
  testData: {
    shipmentType: 'One way',
    origin: '1234 Main Street, Los Angeles, CA, USA',
    destination: '4321 Main St, Miami Lakes, FL, USA',
    itemType: 'Golf Bag (Standard)',
    serviceLevel: 'Ground',
    deliveryDate: 'April 8, 2026',
  }
};
