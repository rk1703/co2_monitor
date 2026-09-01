const fs = require('fs');
const path = require('path');
const net = require('net');
const tls = require('tls');
const dns = require('dns');
const { Client } = require('ldapts');

// 1. Read .env.local or .env
let env = {};
const envPaths = ['.env.local', '.env'];
for (const p of envPaths) {
  const fullPath = path.join(__dirname, p);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = match[2] ? match[2].trim() : '';
        if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
          value = value.substring(1, value.length - 1);
        }
        if (!env[match[1]]) env[match[1]] = value;
      }
    });
    console.log(`Loaded environment from: ${p}`);
    break;
  }
}

const LDAP_URL = env.LDAP_URL || 'ldaps://JSWSL-DOL-SDC05.JSW.IN:636';
const LDAP_DOMAIN = env.LDAP_DOMAIN || 'JSW.IN';
const LDAP_REJECT_UNAUTHORIZED = env.LDAP_REJECT_UNAUTHORIZED !== 'false';
const JWT_SECRET = env.JWT_SECRET;

console.log('\n--- LDAP CONFIGURATION ON THIS MACHINE ---');
console.log('LDAP_URL:', LDAP_URL);
console.log('LDAP_DOMAIN:', LDAP_DOMAIN);
console.log('LDAP_REJECT_UNAUTHORIZED:', env.LDAP_REJECT_UNAUTHORIZED || '(not set, defaults to true)');
console.log('JWT_SECRET configured:', !!JWT_SECRET);
console.log('-----------------------------------------\n');

if (!env.LDAP_REJECT_UNAUTHORIZED || env.LDAP_REJECT_UNAUTHORIZED === 'true') {
  console.warn('⚠️ WARNING: LDAP_REJECT_UNAUTHORIZED is not "false". Internal enterprise domain certificates may fail TLS validation unless LDAP_REJECT_UNAUTHORIZED=false is set in .env.local\n');
}

const urlMatch = LDAP_URL.match(/^ldaps?:\/\/([^:/]+)(?::(\d+))?/);
if (!urlMatch) {
  console.error('❌ Invalid LDAP_URL format:', LDAP_URL);
  process.exit(1);
}

const host = urlMatch[1];
const defaultPort = LDAP_URL.startsWith('ldaps://') ? 636 : 389;
const port = Number(urlMatch[2] || defaultPort);

async function testTcp(h, p, useTls = false) {
  return new Promise((resolve) => {
    console.log(`Testing TCP connectivity to ${h}:${p} (TLS: ${useTls})...`);
    const socket = useTls 
      ? tls.connect({ host: h, port: p, rejectUnauthorized: false, timeout: 5000 })
      : net.createConnection({ host: h, port: p, timeout: 5000 });

    socket.on('connect', () => {
      console.log(`✅ TCP Connected successfully to ${h}:${p}`);
      socket.destroy();
      resolve(true);
    });
    socket.on('secureConnect', () => {
      console.log(`✅ TLS Handshake successful with ${h}:${p}`);
      socket.destroy();
      resolve(true);
    });
    socket.on('error', (err) => {
      console.error(`❌ Connection failed to ${h}:${p} - Error: ${err.message} (${err.code})`);
      socket.destroy();
      resolve(false);
    });
    socket.on('timeout', () => {
      console.error(`❌ Connection timed out to ${h}:${p} (Firewall blocking port?)`);
      socket.destroy();
      resolve(false);
    });
  });
}

async function runDiagnostics() {
  // 1. DNS
  console.log(`1. Resolving hostname "${host}" via DNS...`);
  try {
    const addresses = await dns.promises.lookup(host, { all: true });
    console.log('✅ DNS Resolved:', addresses.map(a => `${a.address} (IPv${a.family})`).join(', '));
  } catch (err) {
    console.error(`❌ DNS Resolution failed for ${host}:`, err.message);
  }

  console.log('');
  // 2. Port connectivity
  await testTcp(host, port, LDAP_URL.startsWith('ldaps://'));
  if (port !== 389) await testTcp(host, 389, false);
  if (port !== 636) await testTcp(host, 636, true);

  console.log('');
  // 3. LDAP authentication test
  const testUser = process.argv[2] || 'ravikant.baghel';
  const testPass = process.argv[3];

  if (!testPass) {
    console.log(`To test credentials, run: node diagnose_ldap.js <username> <password>`);
    return;
  }

  const userUPN = testUser.includes('@') ? testUser : `${testUser}@${LDAP_DOMAIN}`;
  console.log(`3. Testing Active Directory bind for "${userUPN}"...`);

  const client = new Client({
    url: LDAP_URL,
    tlsOptions: {
      rejectUnauthorized: env.LDAP_REJECT_UNAUTHORIZED !== 'false',
    },
    timeout: 10000,
    connectTimeout: 10000,
  });

  try {
    await client.bind(userUPN, testPass);
    console.log(`🎉 SUCCESS: Active Directory bind successful for ${userUPN}!`);
    await client.unbind();
  } catch (err) {
    console.error(`❌ Authentication failed:`, err.message);
    if (err.code) console.error(`Error Code:`, err.code);
    if (err.name) console.error(`Error Name:`, err.name);
  }
}

runDiagnostics();
