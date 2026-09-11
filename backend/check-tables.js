import db from './lib/db.js';

console.log('=== membership 表结构 ===');
const membershipInfo = db.prepare("PRAGMA table_info(membership)").all();
membershipInfo.forEach(col => {
  console.log(`${col.name} (${col.type})`);
});

console.log('\n=== wallet 表结构 ===');
const walletInfo = db.prepare("PRAGMA table_info(wallet)").all();
walletInfo.forEach(col => {
  console.log(`${col.name} (${col.type})`);
});

console.log('\n=== wallet_transactions 表结构 ===');
const transactionsInfo = db.prepare("PRAGMA table_info(wallet_transactions)").all();
transactionsInfo.forEach(col => {
  console.log(`${col.name} (${col.type})`);
});

db.close();
