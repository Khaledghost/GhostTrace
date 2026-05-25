/**
 * Blocks startup until PostgreSQL accepts connections (container orchestration).
 */
const net = require('net');

const host = process.env.DB_HOST || 'postgres';
const port = parseInt(process.env.DB_PORT || '5432', 10);
const maxAttempts = parseInt(process.env.DB_WAIT_ATTEMPTS || '30', 10);
const delayMs = parseInt(process.env.DB_WAIT_DELAY_MS || '2000', 10);

function tryConnect() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.end();
      resolve();
    });
    socket.setTimeout(3000);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('timeout'));
    });
    socket.on('error', reject);
  });
}

(async () => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await tryConnect();
      console.log(`PostgreSQL is reachable at ${host}:${port}`);
      process.exit(0);
    } catch {
      console.log(`PostgreSQL not ready (${attempt}/${maxAttempts}), retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  console.error(`PostgreSQL unavailable at ${host}:${port} after ${maxAttempts} attempts`);
  process.exit(1);
})();
