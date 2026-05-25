const { GoogleGenerativeAI } = require('@google/generative-ai');

async function complete({ apiKey, model, system, user, maxTokens, temperature }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const m = genAI.getGenerativeModel({
    model: model || 'gemini-1.5-flash',
    systemInstruction: system,
    generationConfig: { maxOutputTokens: maxTokens, temperature },
  });
  const result = await m.generateContent(user);
  return result.response.text();
}

module.exports = { complete };
