/** Ҳамаи тестҳоро пай дар пай иҷро мекунад. */
const { execFileSync } = require('child_process');
const path = require('path');

const suites = ['protocol', 'security', 'scale', 'wiring'];
let failed = 0;

suites.forEach((name) => {
  console.log('\n████ ' + name.toUpperCase() + ' ████');
  try {
    execFileSync(process.execPath, [path.join(__dirname, name + '.test.js')], { stdio: 'inherit' });
  } catch (e) {
    failed++;
  }
});

console.log(failed ? `\n✖ ${failed} маҷмӯа нагузашт` : '\n✔ ҳамаи маҷмӯаҳо гузаштанд');
process.exit(failed ? 1 : 0);
