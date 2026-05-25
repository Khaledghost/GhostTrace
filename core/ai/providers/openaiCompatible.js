const fetch = globalThis.fetch || require('node-fetch');

async function complete({ apiKey, baseUrl, model, system, user, jsonMode, maxTokens, temperature }) {
  const url = `${(baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`;
  const body = {
    model,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user },
    ],
    max_tokens: maxTokens,
    temperature,
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(parseInt(process.env.AI_TIMEOUT_MS || '60000', 10)),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error?.message || data?.message || `HTTP ${resp.status}`);
  }
  return data.choices?.[0]?.message?.content || '';
}

async function* stream(opts) {
  const url = `${(opts.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      stream: true,
      messages: [
        ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
        { role: 'user', content: opts.user },
      ],
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(err.slice(0, 200));
  }

  const reader = resp.body?.getReader?.();
  if (!reader) {
    yield await complete(opts);
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') return;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch (_) { /* skip */ }
    }
  }
}

module.exports = { complete, stream };
