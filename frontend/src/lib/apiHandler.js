// ============================================================
// CONFIGURAÇÃO E LOGGING
// ============================================================
const API_TIMEOUT = 120000; // 2 minutos
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

function logApiError(context, err) {
  console.error('[API Handler erro]', {
    timestamp: new Date().toISOString(),
    context,
    error: {
      message: err.message,
      status: err.status,
      stack: err.stack,
      code: err.code
    }
  });
}

// ============================================================
// GOOGLE DRIVE HELPERS
// ============================================================
export function conectarGoogleDrive() {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const url = baseUrl + '/api/auth/google-drive';
  window.location.href = url;
}

export async function buscarArquivosDrive() {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const res = await fetch(baseUrl + '/api/drive/arquivos');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao buscar arquivos do Drive.');
  return data.files || [];
}

export async function statusConexaoDrive() {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const res = await fetch(baseUrl + '/api/drive/status');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao verificar estado do Google Drive.');
  return data;
}

// ============================================================
// KEYWORD PLANNER - GOOGLE ADS API (REST)
// ============================================================
export async function callKeywords(keyword, options = {}) {
  const { signal } = options;
  const baseUrl = import.meta.env.VITE_API_URL || '';

  const controller = new AbortController();
  if (signal) {
    if (signal.aborted) throw new Error('Requisição cancelada pelo usuário');
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const responseTimeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    const response = await fetch(baseUrl + '/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword }),
      signal: controller.signal
    });

    clearTimeout(responseTimeout);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Erro HTTP ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data: data.data };
  } catch (err) {
    clearTimeout(responseTimeout);
    if (err.name === 'AbortError') {
      return { success: false, error: 'Requisição cancelada' };
    }
    return { success: false, error: err.message };
  }
}

// ============================================================
// CLIENTE API CENTRALIZADO COM RETRY E TIMEOUT
// ============================================================
export async function callClaude(systemOrMessages, userPrompt, options = {}) {
  let systemPrompt = '';
  let messages = [];

  // Suporta dois formatos de chamada:
  //   1. callClaude(messages[], { module, signal })  ← usado nos módulos do Dashboard
  //   2. callClaude(systemPrompt, userPrompt, { module, signal })  ← legado
  if (Array.isArray(systemOrMessages)) {
    // Formato 1: primeiro arg é array de mensagens, segundo arg é options
    messages = systemOrMessages;
    options = userPrompt || {};
  } else {
    // Formato 2: primeiro arg é systemPrompt, segundo é userPrompt (string)
    systemPrompt = systemOrMessages;
    messages = [{ role: 'user', content: userPrompt }];
  }

  const {
    module = 'unknown',
    signal,
    retries = MAX_RETRIES
  } = options;

  // 1. Verifica cache primeiro (se cache habilitado e não for forçada atualização)
  if (!options.skipCache) {
    const rawForCache = JSON.stringify(messages);
    const cacheKey = btoa(systemPrompt + rawForCache).substring(0, 50);
    const cached = localStorage.getItem('horivis_cache_' + cacheKey);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < 86400000) { // 24h
          return { success: true, data, fromCache: true };
        }
      } catch { /* cache corrompido, ignora */ }
    }
  }

  // 2. Monta payload
  const payload = {
    model: import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-sonnet-5',
    max_tokens: 4096,
    messages
  };
  if (systemPrompt) {
    payload.system = systemPrompt;
  }

  // 3. Implementação manual de timeout
  const timeoutId = setTimeout(() => {
    if (signal && signal.aborted === false) {
      signal.abort();
    }
  }, API_TIMEOUT);

  // 4. Loop de retry com backoff exponencial
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Cancela requisição anterior se houver retry
      const controller = new AbortController();
      if (signal) {
        if (signal.aborted) throw new Error('Requisição cancelada pelo usuário');
        // Encadeia sinais
        signal.addEventListener('abort', () => controller.abort(), { once: true });
      }

      clearTimeout(timeoutId);
      const responseTimeout = setTimeout(() => controller.abort(), API_TIMEOUT);

      console.log(`[API] Tentativa ${attempt + 1}/${retries + 1}`, {
        module,
        model: payload.model,
        hasSystem: !!systemPrompt,
        timestamp: new Date().toISOString()
      });

      const response = await fetch(import.meta.env.VITE_API_URL + '/api/claude/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(responseTimeout);

      // Se cancelado, lança erro para ser tratado no catch
      if (signal?.aborted || controller.signal.aborted) {
        throw new Error('Requisição cancelada');
      }

      // Sucesso
      if (response.ok) {
        const result = await response.json();
        const text = result.content[0].text;

        // Guarda no cache
        if (!options.skipCache) {
          const rawForCache = JSON.stringify(messages);
          const cacheKey = btoa(systemPrompt + rawForCache).substring(0, 50);
          localStorage.setItem('horivis_cache_' + cacheKey,
            JSON.stringify({ data: text, timestamp: Date.now() })
          );
        }

        return { success: true, data: text, fromCache: false };
      }

      // Erro HTTP - tenta extrair mensagem
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: { message: `HTTP ${response.status}` } };
      }

      const error = new Error(
        errorData.error?.message ||
        errorData.message ||
        `Erro HTTP ${response.status}`
      );
      error.status = response.status;
      error.data = errorData;

      // Classifica erro
      if (response.status === 401) {
        error.userMessage = '🔑 Chave de API inválida. Contacta o suporte.';
        error.type = 'auth';
      } else if (response.status === 429) {
        error.userMessage = '⏱ Limite de requisições excedido. Aguarda 30s e tenta novamente.';
        error.type = 'rate_limit';
      } else if (response.status === 402 || response.status === 529 ||
        error.message?.toLowerCase().includes('credit') ||
        error.message?.toLowerCase().includes('quota')) {
        error.userMessage = '💳 Créditos ou quota esgotados. Acede a console.anthropic.com';
        error.type = 'quota';
      } else if (response.status >= 500) {
        error.userMessage = '⚠️ Serviço temporariamente indisponível. Tenta mais tarde.';
        error.type = 'server';
      } else if (response.status === 404) {
        error.userMessage = '🔍 Serviço não encontrado. Verifica a configuração.';
        error.type = 'not_found';
      } else {
        error.userMessage = `❌ Erro na requisição (${response.status}). Tenta novamente.`;
        error.type = 'http_error';
      }

      lastError = error;

      // Não faz retry para erros de autenticação ou configuração
      if (error.type === 'auth' || error.type === 'not_found') break;

      // Backoff exponencial antes de retry
      if (attempt < retries) {
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      break;

    } catch (err) {
      clearTimeout(timeoutId);

      // Cancelamento pelo usuário
      if (err.message === 'Requisição cancelada' ||
        err.name === 'AbortError') {
        console.warn('[API] Requisição cancelada', { module, timestamp: new Date().toISOString() });
        return {
          success: false,
          error: '⏹ Análise cancelada',
          fromDemo: true
        };
      }

      // Erro de rede / timeout
      if (err.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        err.code === 'UND_ERR_HEADERS_TIMEOUT' ||
        err.message?.includes('timeout') ||
        err.message?.includes('ETIMEDOUT') ||
        err.name === 'AbortError' && !signal?.aborted) {

        lastError = new Error('Timeout na conexão com o serviço');
        lastError.userMessage = '⏱ Requisição demorou demasiado. Tenta novamente.';
        lastError.type = 'timeout';

        if (attempt < retries) {
          const delay = RETRY_DELAY * Math.pow(2, attempt);
          console.warn(`[API] Timeout (tentativa ${attempt + 1}). Retry em ${delay}ms`, { module });
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        break;
      }

      // Sem conexão
      if (!navigator.onLine || err.message?.includes('fetch') ||
        err.message?.includes('NetworkError') || err.message?.includes('Network request failed')) {
        lastError = new Error('Sem ligação à internet');
        lastError.userMessage = '📡 Sem ligação à internet. Verifica a tua conexão.';
        lastError.type = 'network';
        break; // Não retry para erros de rede
      }

      // Outros erros
      lastError = err;
      lastError.userMessage = `❌ Erro inesperado: ${err.message || 'Tenta novamente'}`;
      lastError.type = 'unknown';
      break;
    }
  }

  // Log final com contexto completo
  logApiError(`${module} - Falha após ${retries + 1} tentativa(s)`, lastError);

  // Retorna mensagem amigável
  return {
    success: false,
    error: lastError?.userMessage || '❌ Erro desconhecido. Tenta novamente.',
    fromDemo: true,
    type: lastError?.type || 'unknown'
  };
}
