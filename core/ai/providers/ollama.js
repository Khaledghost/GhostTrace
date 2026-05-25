const fetch = globalThis.fetch || require('node-fetch');

async function complete({ baseUrl, model, system, user, maxTokens, temperature }) {
  const url = `${(baseUrl || 'http://localhost:11434').replace(/\/$/, '')}/api/chat`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature, num_predict: maxTokens },
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(parseInt(process.env.AI_TIMEOUT_MS || '120000', 10)),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error || `Ollama HTTP ${resp.status}`);
  return data.message?.content || data.response || '';
}

async function* stream({ baseUrl, model, system, user, temperature }) {
  const url = `${(baseUrl || 'http://localhost:11434').replace(/\/$/, '')}/api/chat`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: true,
      options: { temperature },
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ],
    }),
  });

  if (!resp.ok) throw new Error(`Ollama stream HTTP ${resp.status}`);

  const reader = resp.body?.getReader?.();
  if (!reader) {
    yield await complete({ baseUrl, model, system, user, temperature });
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n').filter(Boolean);
    buffer = '';
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.message?.content) yield parsed.message.content;
      } catch (_) { buffer += line; }
    }
  }
}

module.exports = { complete, stream };
