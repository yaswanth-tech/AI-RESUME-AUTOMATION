const assert = require('assert');
const fs = require('fs');
const path = require('path');

function runSafeRouteLoggingTests() {
  const routeDirectory = path.join(__dirname, '../routes');
  for (const filename of fs.readdirSync(routeDirectory).filter(name => name.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(routeDirectory, filename), 'utf8');
    assert(!/console\.(?:error|warn)\(\s*(?:error|e)\s*\)/i.test(source), `${filename} must not log raw error objects`);
    assert(!/console\.(?:error|warn)\([^\n]*,\s*(?:error|e)\s*\)/i.test(source), `${filename} must not append raw errors to logs`);
    assert(!/res\.status\(500\)\.json\([^\n]*(?:error|e)\.(?:message|stack)/i.test(source), `${filename} must not expose server error details`);
  }
  console.log('✔ Route errors do not log raw errors or expose server messages');
}

module.exports = runSafeRouteLoggingTests;
if (require.main === module) runSafeRouteLoggingTests();
