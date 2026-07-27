import { execSync } from 'child_process';
import http from 'http';

const PORTS = [3000, 3001];

function isPortInUse(port) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: '127.0.0.1', port, method: 'GET', timeout: 500 });
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
    const stdout = execSync(`lsof -ti tcp:${port}`).toString().trim();
    if (!stdout) {
      console.warn(`[predev] Sem PID para porta ${port}.`);
      return;
    }
    const pids = [...new Set(stdout.split('\n').map(pid => pid.trim()).filter(Boolean))];
    console.warn(`[predev] Porta ${port} ocupada. Finalizando processos: ${pids.join(', ')}`);
    for (const pid of pids) {
      try {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
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