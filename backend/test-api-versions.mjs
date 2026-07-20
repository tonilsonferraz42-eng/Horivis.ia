import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

async function testarVersao(versao, cid, token, dt) {
  const urls = [
    `https://googleads.googleapis.com/${versao}/customers/${cid}/keywordPlanIdeas:generateKeywordIdeas`,
    `https://googleads.googleapis.com/${versao}/customers/${cid}/keywordPlanIdeas:generate`,
    `https://googleads.googleapis.com/${versao}/customers:listAccessibleCustomers`,
  ];
  for (const url of urls) {
    try {
      const method = url.includes('listAccessibleCustomers') ? 'GET' : 'POST';
      const body = method === 'POST' ? {
        keywordAndUrlSeed: { keywords: ['prodentim'], url: 'https://www.google.com/' },
        includeAdultKeywords: false,
        language: 'languageConstants/1000',
        geoTargetConstants: ['geoTargetConstants/2840']
      } : undefined;
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'developer-token': dt,
          ...(method === 'POST' ? { 'login-customer-id': cid, 'Content-Type': 'application/json' } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const txt = await res.text();
      console.log(`v${versao} ${url.split('/').pop()}: ${res.status} ${res.statusText}`);
      if (res.ok) console.log(`  OK: ${txt.substring(0, 200)}`);
      else if (txt.length < 200) console.log(`  ERR: ${txt.substring(0, 200)}`);
      else console.log(`  ERR: ${res.status}`);
    } catch (e) {
      console.log(`v${versao} ERRO: ${e.message}`);
    }
  }
}

(async () => {
  // Obter token
  const p = new URLSearchParams();
  p.append('grant_type', 'refresh_token');
  p.append('client_id', process.env.GOOGLE_ADS_CLIENT_ID);
  p.append('client_secret', process.env.GOOGLE_ADS_CLIENT_SECRET);
  p.append('refresh_token', process.env.GOOGLE_ADS_REFRESH_TOKEN);
  
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: p
  });
  const j = await r.json();
  const token = j.access_token;
  console.log(`Token: ${token ? 'OK' : 'FAIL'}`);
  if (!token) { console.log(JSON.stringify(j)); return; }

  const cid = '3781487970';
  const dt = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  // Testar v14 e v15
  await testarVersao('v14', cid, token, dt);
  await testarVersao('v15', cid, token, dt);
  await testarVersao('v16', cid, token, dt);
})();