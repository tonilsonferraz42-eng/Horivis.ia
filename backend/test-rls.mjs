import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const SUPABASE_URL = 'https://djanaqrmndrediqxslir.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYW5hcXJtbmRyZWRpcXhzbGlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NTEzODcsImV4cCI6MjA5ODEyNzM4N30.pYzOPp0HQS3iudsfHjOBaaFmEgigf7tI7NptCcOZGqY';

async function login(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return await res.json();
}

async function queryAnalises(token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/analises?limit=5`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function insertAnalise(token, userId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/analises`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      user_id: userId,
      modulo: 'teste-rls',
      produto: 'teste-' + Date.now(),
      resultado: { test: true },
      score: 50,
      status: 'ok'
    })
  });
  return { status: res.status };
}

(async () => {
  console.log('=== TESTE DE SEGURANCA RLS ===\n');

  // 1) Teste sem token
  console.log('1. Requisicao SEM token:');
  const r1 = await fetch(`${SUPABASE_URL}/rest/v1/analises?limit=1`, {
    headers: { apikey: ANON_KEY }
  });
  console.log(`   Status: ${r1.status} ${r1.statusText}`);
  if (r1.status === 401) console.log('   ✅ RLS ativo (rejeitou sem token)');
  else console.log('   ❌ RLS NAO ativo (permitiu sem token)');

  // 2) Login admin
  console.log('\n2. Login admin@horivis.com:');
  const admin = await login('admin@horivis.com', 'Admin123!');
  if (!admin.access_token) {
    console.log('   ❌ Falha login admin:', admin.error?.message || JSON.stringify(admin).substring(0,100));
    process.exit(1);
  }
  console.log(`   ✅ Token obtido (${admin.access_token.substring(0,20)}...)`);
  console.log(`   User ID: ${admin.user.id}`);

  // 3) Inserir analise como admin
  console.log('\n3. Inserir analise como admin:');
  const ins = await insertAnalise(admin.access_token, admin.user.id);
  console.log(`   Status: ${ins.status}`);
  if (ins.status === 201) console.log('   ✅ Inseriu com sucesso');
  else console.log('   ⚠️  Resposta inesperada');

  // 4) Admin ve as proprias analises
  console.log('\n4. Admin lista analises:');
  const q1 = await queryAnalises(admin.access_token);
  console.log(`   Status: ${q1.status}, Resultados: ${q1.data?.length || 0}`);
  if (q1.data?.length > 0) console.log('   ✅ Admin ve os proprios dados');

  // 5) Criar/Login user2
  console.log('\n5. Criar/login user2 (teste2@horivis.com):');
  const signup = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teste2@horivis.com', password: 'Teste123!' })
  });
  const signupData = await signup.json();
  let user2Token = signupData.access_token;
  let user2Id = signupData.user?.id;
  
  if (!user2Token) {
    // Tenta login (se ja existia)
    const login2 = await login('teste2@horivis.com', 'Teste123!');
    user2Token = login2.access_token;
    user2Id = login2.user?.id;
  }
  
  if (user2Token) {
    console.log(`   ✅ Token user2 obtido (${user2Token.substring(0,20)}...)`);
    console.log(`   User ID: ${user2Id}`);

    // 6) User2 tenta ver dados do admin
    console.log('\n6. User2 lista analises (NAO deve ver dados do admin):');
    const q2 = await queryAnalises(user2Token);
    console.log(`   Status: ${q2.status}, Resultados: ${q2.data?.length || 0}`);
    if (q2.data?.length === 0) console.log('   ✅ RLS isolou dados! User2 nao ve dados do admin');
    else if (q2.data?.length > 0) console.log('   ❌ RLS FALHOU! User2 ve dados de outro usuario');
  } else {
    console.log('   ⚠️  Nao foi possivel obter token user2');
  }

  console.log('\n=== TESTE CONCLUIDO ===');
})();