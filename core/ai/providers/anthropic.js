const fetch = globalThis.fetch || require('node-fetch');

async function complete({ apiKey, model, system, user, maxTokens, temperature }) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: system || 'You are a helpful security analyst.',
      messages: [{ role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(parseInt(process.env.AI_TIMEOUT_MS || '60000', 10)),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error?.message || `Anthropic HTTP ${resp.status}`);
  }
  const block = data.content?.find((b) => b.type === 'text');
  return block?.text || '';
}

module.exports = { complete };
