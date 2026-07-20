import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar .env da pasta backend
dotenv.config({ path: path.join(__dirname, '.env') });

const {
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
} = process.env;

if (!GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET) {
  console.error('Erro: defina GOOGLE_ADS_CLIENT_ID e GOOGLE_ADS_CLIENT_SECRET no backend/.env');
  process.exit(1);
}

const oAuth2Client = new OAuth2Client(
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  'http://localhost:3001/callback'
);

const scopes = ['https://www.googleapis.com/auth/adwords'];

function gerarUrlAutorizacao() {
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });
}

async function obterToken(codigo) {
  try {
    const { tokens } = await oAuth2Client.getToken(codigo);
    const refreshToken = tokens.refresh_token;

    console.log('\nRefresh Token obtido:', refreshToken);

    // Atualizar o arquivo .env com o refresh token
    const envPath = path.join(__dirname, '.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    // Substituir ou adicionar GOOGLE_ADS_REFRESH_TOKEN
    if (envContent.includes('GOOGLE_ADS_REFRESH_TOKEN=')) {
      envContent = envContent.replace(/GOOGLE_ADS_REFRESH_TOKEN=.*/g, `GOOGLE_ADS_REFRESH_TOKEN=${refreshToken}`);
    } else {
      envContent += `\nGOOGLE_ADS_REFRESH_TOKEN=${refreshToken}\n`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log('\nRefresh token guardado em backend/.env');
    console.log('\nPodes fechar este servidor e usar o token nas tuas próximas requisições.');

    process.exit(0);
  } catch (error) {
    console.error('Erro ao obter token:', error.message);
    process.exit(1);
  }
}

const authorizeUrl = gerarUrlAutorizacao();

console.log('\n👉 LINK AQUI:', authorizeUrl, '\n');

const app = express();
const PORT = 3001;

// Rota principal - redireciona para autorização do Google
app.get('/', (req, res) => {
  res.redirect(authorizeUrl);
});

// Rota de callback - captura o código de autorização
app.get('/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    res.send('<h1>Erro</h1><p>Código de autorização não encontrado.</p>');
    return;
  }

  res.send(`
    <html>
      <head>
        <title>HORIVIS - Sucesso!</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          .success { padding: 20px; background: #d4edda; border-left: 4px solid #28a745; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>Sucesso!</h1>
        <div class="success">
          <p><strong>Refresh Token obtido com sucesso!</strong></p>
          <p>O token foi guardado em backend/.env</p>
          <p><strong>Pode fechar esta janela e o terminal.</strong></p>
        </div>
      </body>
    </html>
  `);

  await obterToken(code);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de autenticação HORIVIS rodando em http://localhost:${PORT}`);
});
