import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { OAuth2Client } from 'google-auth-library';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env');
dotenv.config({ path: envPath });

const checkEnv = () => {
  const required = [
    'PORT',
    'FRONTEND_ORIGIN',
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_ADS_REFRESH_TOKEN',
    'GOOGLE_DRIVE_CLIENT_ID',
    'GOOGLE_DRIVE_CLIENT_SECRET',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_BASE_URL'
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[FATAL] Variáveis de ambiente em falta: ${missing.join(', ')}`);
    console.error(`[FATAL] Ficheiro .env esperado em: ${envPath}`);
    process.exit(1);
  }
};
checkEnv();

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// MIDDLEWARES
// ============================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS dinâmico (aceita origin do frontend via env ou localhost)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
  res.header("Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, anthropic-version, x-api-key");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ============================================================
// LOGGING ESTRUTURADO
// ============================================================
const log = {
  info: (msg, ctx = {}) => console.log(`[INFO] ${new Date().toISOString()} ${msg}`, JSON.stringify(ctx)),
  error: (msg, ctx = {}) => console.error(`[ERROR] ${new Date().toISOString()} ${msg}`, JSON.stringify(ctx)),
  warn: (msg, ctx = {}) => console.warn(`[WARN] ${new Date().toISOString()} ${msg}`, JSON.stringify(ctx)),
};

// ============================================================
// PROXY PARA API ANTHROPIC (CLAUDE)
// ============================================================
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5';

app.post('/api/claude/v1/messages', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const startTime = Date.now();

  log.info('Proxy Claude: requisição recebida', {
    requestId,
    bodyKeys: Object.keys(req.body),
    hasSystem: !!req.body.system,
    model: req.body.model
  });

  if (!ANTHROPIC_API_KEY) {
    log.error('Proxy Claude: ANTHROPIC_API_KEY não configurada', { requestId });
    return res.status(500).json({
      error: 'Erro de configuração do servidor',
      message: 'Chave de API Anthropic não configurada',
      requestId
    });
  }

  try {
    const response = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(req.body),
      timeout: 120000 // 2 minutos (Node não suporta timeout no fetch nativo, usamos AbortController abaixo)
    });

    const data = await response.json();

    if (!response.ok) {
      log.error('Proxy Claude: erro na API Anthropic', {
        requestId,
        status: response.status,
        error: data.error || data
      });
      return res.status(response.status).json({
        error: data.error?.message || data.message || 'Erro na API Anthropic',
        status: response.status,
        requestId,
        ...data
      });
    }

    const duration = Date.now() - startTime;
    log.info('Proxy Claude: sucesso', {
      requestId,
      duration,
      tokensUsed: data.usage
    });

    return res.status(200).json(data);

  } catch (err) {
    const duration = Date.now() - startTime;
    log.error('Proxy Claude: exceção no servidor', {
      requestId,
      error: err.message,
      stack: err.stack,
      duration
    });

    // Timeout / rede
    if (err.code === 'UND_ERR_CONNECT_TIMEOUT' || err.code === 'UND_ERR_HEADERS_TIMEOUT' ||
        err.message?.includes('timeout') || err.message?.includes('ETIMEDOUT')) {
      return res.status(504).json({
        error: 'Timeout ao conectar ao serviço de IA',
        message: 'A requisição demorou demasiado. Tente novamente.',
        requestId
      });
    }

    return res.status(502).json({
      error: 'Erro de conexão com o serviço de IA',
      message: err.message,
      requestId
    });
  }
});

// ============================================================
// KEYWORD PLANNER - GOOGLE ADS API (REST)
// ============================================================
app.post('/api/keywords', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const startTime = Date.now();
  const { keyword } = req.body || {};

  log.info('Keyword Planner: requisição recebida', { requestId, keyword });

  if (!keyword || typeof keyword !== 'string' || keyword.trim().length < 2) {
    return res.status(400).json({
      error: 'Informe uma palavra-chave válida com pelo menos 2 caracteres.',
      requestId
    });
  }

  try {
    const accessToken = await obterAccessTokenGoogleAds();
    const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');

    if (!/^\d{10}$/.test(customerId)) {
      return res.status(500).json({ error: 'GOOGLE_ADS_CUSTOMER_ID inválido no .env', requestId });
    }

    const url = `https://googleads.googleapis.com/v14/customers/${customerId}/keywordPlanIdeas:generateKeywordIdeas`;
    const body = {
      keywordAndUrlSeed: { keywords: [keyword.trim()], url: 'https://www.google.com/' },
      includeAdultKeywords: false,
      includeKeywordsSearchVolume: true,
      includeSuggestedKeywords: true,
      keywordPlanNetwork: 'GOOGLE_SEARCH_AND_PARTNERS',
      language: 'languageConstants/1000',
      geoTargetConstants: ['geoTargetConstants/2840']
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        'login-customer-id': customerId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      let errPayload = text;
      try { errPayload = JSON.parse(text); } catch {}
      return res.status(response.status).json({ error: 'Falha na Google Ads API', status: response.status, details: errPayload, requestId });
    }

    const data = await response.json();
    return res.json({ data, requestId });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno no /api/keywords', message: err.message, requestId });
  }
});

// ============================================================
// GOOGLE ADS - OAUTH2 HELPER
// ============================================================
async function obterAccessTokenGoogleAds() {
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('client_id', process.env.GOOGLE_ADS_CLIENT_ID);
  params.append('client_secret', process.env.GOOGLE_ADS_CLIENT_SECRET);
  params.append('refresh_token', process.env.GOOGLE_ADS_REFRESH_TOKEN);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Falha ao obter access token: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return data.access_token;
}

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      hasAnthropicKey: !!ANTHROPIC_API_KEY,
      frontendOrigin: FRONTEND_ORIGIN
    }
  });
});

// ============================================================
// GOOGLE DRIVE - AUTENTICAÇÃO OAUTH2
// ============================================================
const GOOGLE_DRIVE_CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const GOOGLE_DRIVE_CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

let driveOAuthClient = null;
if (GOOGLE_DRIVE_CLIENT_ID && GOOGLE_DRIVE_CLIENT_SECRET) {
  driveOAuthClient = new OAuth2Client(
    GOOGLE_DRIVE_CLIENT_ID,
    GOOGLE_DRIVE_CLIENT_SECRET,
    `${FRONTEND_ORIGIN}/dashboard`
  );
}

// Armazenamento em memória de tokens (em produção use banco/cache)
const driveTokens = new Map();

// Rota: iniciar autenticação Google Drive
app.get('/auth/google-drive', (req, res) => {
  if (!driveOAuthClient) {
    return res.status(500).json({
      error: 'Google Drive não configurado',
      message: 'GOOGLE_DRIVE_CLIENT_ID e GOOGLE_DRIVE_CLIENT_SECRET não definidos no backend/.env'
    });
  }

  const scopes = ['https://www.googleapis.com/auth/drive.file'];

  const url = driveOAuthClient.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: req.query.userId || 'default'
  });

  log.info('Google Drive: URL de autorização gerada');
  res.redirect(url);
});

// Rota: callback OAuth2 do Google Drive
app.get('/auth/google-drive/callback', async (req, res) => {
  if (!driveOAuthClient) {
    return res.status(500).send('Erro: Google Drive não configurado');
  }

  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send('Erro: Código de autorização não encontrado.');
  }

  try {
    const { tokens } = await driveOAuthClient.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      log.warn('Google Drive: refresh_token não retornado. Verifique se prompt=consent está configurado.');
      return res.status(400).send('Erro: Refresh token não obtido. Tente novamente e certifique-se de autorizar o acesso.');
    }

    // Armazenar token associado ao userId
    const userId = state || 'default';
    driveTokens.set(userId, { refreshToken, accessToken: tokens.access_token });

    log.info('Google Drive: autenticação bem-sucedida', { userId });

    res.send(`
      <html>
        <head>
          <title>HORIVIS - Google Drive Conectado</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .success { padding: 20px; background: #d4edda; border-left: 4px solid #28a745; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Sucesso!</h1>
          <div class="success">
            <p><strong>Google Drive conectado com sucesso!</strong></p>
            <p>Pode fechar esta janela e voltar ao dashboard.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    log.error('Google Drive: erro no callback', { error: error.message });
    res.status(500).send(`Erro ao autenticar: ${error.message}`);
  }
});

// Middleware: obter access token válido para Google Drive
async function obterAccessTokenDrive(userId = 'default') {
  const tokenData = driveTokens.get(userId);

  if (!tokenData) {
    throw new Error('Google Drive não autenticado. Conecte em /auth/google-drive');
  }

  const { refreshToken } = tokenData;

  try {
    // Verificar se access token ainda é válido
    const client = new OAuth2Client(
      GOOGLE_DRIVE_CLIENT_ID,
      GOOGLE_DRIVE_CLIENT_SECRET,
      `${FRONTEND_ORIGIN}/dashboard`
    );
    client.setCredentials({ refresh_token: refreshToken });

    const { token } = await client.getAccessToken();
    return token;
  } catch (error) {
    log.error('Google Drive: erro ao renovar access token', { error: error.message });
    throw new Error('Erro ao renovar token de acesso ao Google Drive.');
  }
}

// Rota: listar arquivos do Google Drive
app.get('/api/drive/arquivos', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const userId = req.query.userId || 'default';

  log.info('Google Drive: listar arquivos', { requestId, userId });

  try {
    const accessToken = await obterAccessTokenDrive(userId);

    const response = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=20&fields=files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink)', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      log.error('Google Drive: erro na API', { requestId, status: response.status, error: data.error });
      return res.status(response.status).json({
        error: data.error?.message || 'Erro ao listar arquivos do Google Drive',
        requestId
      });
    }

    log.info('Google Drive: arquivos listados com sucesso', { requestId, quantidade: data.files?.length || 0 });
    res.json({ files: data.files || [], requestId });

  } catch (error) {
    log.error('Google Drive: exceção ao listar arquivos', { requestId, error: error.message });
    res.status(500).json({
      error: error.message,
      requestId
    });
  }
});

// Rota: status da conexão Google Drive
app.get('/api/drive/status', (req, res) => {
  const userId = req.query.userId || 'default';
  const conectado = driveTokens.has(userId);

  res.json({
    conectado,
    hasRefreshToken: !!driveTokens.get(userId)?.refreshToken,
    userId
  });
});

// ============================================================
// AUTENTICAÇÃO (placeholder)
// ============================================================
app.post('/auth', (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const { email, password } = req.body;

  if (!email || !password) {
    log.warn('Auth: credenciais em falta', { requestId, email: email?.substring(0, 3) + '***' });
    return res.status(400).json({ error: 'Email e password são obrigatórios', requestId });
  }

  log.info('Auth: tentativa de login', { requestId, email: email?.substring(0, 3) + '***' });

  // TODO: integrar com Supabase/Google Ads/etc
  res.json({
    status: 'ok',
    message: 'Autenticação realizada com sucesso',
    user: { email },
    requestId
  });
});

// Handler para OPTIONS (pré-verificação CORS)
app.options('*', (req, res) => {
  res.header("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
  res.header("Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS");
  res.sendStatus(200);
});

// ============================================================
// 404
// ============================================================
app.use((req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  log.warn('Rota não encontrada', { path: req.path, method: req.method, requestId });
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.path,
    requestId
  });
});

// ============================================================
// ERROR HANDLER GLOBAL
// ============================================================
app.use((err, req, res, next) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  log.error('Erro não tratado no servidor', {
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    error: 'Erro interno do servidor',
    message: err.message,
    requestId
  });
});

app.listen(PORT, () => {
  log.info('Servidor HORIVIS iniciado', { port: PORT, env: process.env.NODE_ENV || 'development' });
});
