/**
 * Генератори hash барои пароли муаллим.
 * Истифода / Использование:  node tools/hash-password.js "пароли-нав"
 */
const crypto = require('crypto');
const pass = process.argv[2];
if (!pass) {
  console.error('Истифода: node tools/hash-password.js "пароли-нав"');
  process.exit(1);
}
const hash = crypto.createHash('sha256').update(pass, 'utf8').digest('hex');
console.log('\nПарол / Пароль : ' + pass);
console.log('Hash (SHA-256) : ' + hash);
console.log('\nИнро ба config.js гузоред / вставьте в config.js:');
console.log("  adminPassHash: '" + hash + "',\n");
