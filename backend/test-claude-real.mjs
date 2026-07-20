import fetch from 'node-fetch';

(async () => {
  console.log('=== TESTE REAL CLAUDE VIA PROXY BACKEND ===\n');

  const systemPrompt = 'Você é um analista de ofertas de marketing digital. Responda APENAS em JSON válido, sem texto extra, sem markdown.';
  const userPrompt = 'Analise a oferta "Prodentim" (suplemento para saúde dental) e dê um score de 1-100 considerando potencial de mercado. Responda no formato: {"produto": "Prodentim", "score": XX, "motivo": "texto curto explicando o score"}';

  const payload = {
    model: 'claude-sonnet-5',
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  };

  console.log('Enviando requisicao para http://localhost:3001/api/claude/v1/messages...\n');

  const res = await fetch('http://localhost:3001/api/claude/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  console.log('STATUS:', res.status, res.statusText);

  const data = await res.json();

  if (res.ok) {
    console.log('\n✅ SUCESSO - Resposta do Claude:');
    console.log(data.content[0].text);
    console.log('\nTokens usados:', JSON.stringify(data.usage));
  } else {
    console.log('\n❌ FALHA:');
    console.log(JSON.stringify(data, null, 2));
  }

  console.log('\n=== TESTE CONCLUIDO ===');
})();
