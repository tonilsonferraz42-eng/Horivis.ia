const { execSync } = require('child_process');
const http = require('http');

const PORTS = [3000, 3001];

function isPortInUse(port) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: '127.0.0.1', port: port, method: 'GET', timeout: 500 });
    req.on('response', () => { req.destroy(); resolve(true); });
    req.on('error', () => { req.destroy(); resolve(false); });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function killPort(port) {
  const inUse = await isPortInUse(port);
  if (!inUse) {
    console.log(`[predev] Porta ${port} livre.`);
    return;
  }

  try {
    const stdout = execSync('netstat -ano -p tcp').toString();
    const regex = new RegExp(`\\s+TCP\\s+\\[?::\\]?127\\.0\\.0\\.1:${port}\\].*?([0-9]+)$`, 'mi');
    const match = [...stdout.matchAll(regex)]
      .map(m => parseInt(m[1], 10))
      .filter(pid => !Number.isNaN(pid));

    if (match.length === 0) {
      console.warn(`[predev] Sem PID para porta ${port}.`);
      return;
    }

    const unique = [...new Set(match)];
    console.warn(`[predev] Porta ${port} ocupada. Finalizando processos: ${unique.join(', ')}`);

    for (const pid of unique) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        console.log(`[predev] PID ${pid} finalizado.`);
      } catch {
        console.warn(`[predev] Falha ao finalizar PID ${pid}.`);
      }
    }
  } catch (error) {
    console.error('[predev] Erro ao tentar liberar porta', port, error.message);
  }
}

async function main() {
  console.log('[predev] Garantindo portas limpas...');
  for (const port of PORTS) {
    await killPort(port);
  }
  console.log('[predev] Portas verificadas.');
}

main().catch((error) => {
  console.error('[predev] Erro inesperado:', error);
  process.exit(1);
});