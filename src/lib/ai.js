const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

export const FOFOQUEIRO_PROMPT = `
Você é "Meu Parceiro", um assistente conversacional polido, atencioso e profissional.
Sua língua principal é o PORTUGUÊS, mas você ajuda o usuário a treinar conversação em {{language}}.

REGRAS CRÍTICAS:
- MANTENHA A CONCORDÂNCIA: Sua gramática deve ser IMPECÁVEL e 100% natural, soando como um professor ou colega de trabalho educado. Nunca use traduções literais.
- SEJA PROFISSIONAL: Seja educado e direto. Evite gírias informais, fofocas ou tom exagerado. 
- SE O USUÁRIO FALAR EM PORTUGUÊS: Responda EXCLUSIVAMENTE em português, com calma e clareza. Não force o inglês.
- Se o usuário tentar praticar {{language}}, responda no idioma, faça correções construtivas e continue a conversa de forma natural.
- Respostas ULTRA CURTAS. No máximo 1-2 frases para manter o diálogo dinâmico.
- Sempre termine passando a palavra para o usuário de forma natural (ex: "O que você acha sobre isso?").

CONTEXTO:
- Nome do usuário: {{userName}}
- Língua de prática: {{language}}
`;

async function callGroq(messages, systemInstructions) {
  if (!GROQ_API_KEY) throw new Error("No Groq Key");
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemInstructions },
        ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
      ],
      max_tokens: 100,
      temperature: 0.9 // Higher temperature for more personality/irony
    })
  });
  
  if (!response.ok) throw new Error(`Groq error: ${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGemini(messages, systemInstructions) {
  if (!GEMINI_API_KEY) throw new Error("No Gemini Key");
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const contents = messages.map(m => {
    const parts = [{ text: m.content }];
    if (m.image) {
      parts.push({ inline_data: { mime_type: "image/jpeg", data: m.image } });
    }
    return {
      role: m.role === 'user' ? 'user' : 'model',
      parts: parts
    };
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstructions }] },
      contents: contents,
      tools: [{ googleSearch: {} }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 100 }
    })
  });

  if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

export async function getAIResponse(messages, userName, language, base64Image = null) {
  const systemInstructions = FOFOQUEIRO_PROMPT
    .replace("{{userName}}", userName)
    .replace("{{language}}", language);

  let recentMessages = messages.slice(-4);
  while (recentMessages.length > 0 && recentMessages[0].role !== 'user') {
    recentMessages.shift();
  }

  const geminiMessages = JSON.parse(JSON.stringify(recentMessages));
  if (base64Image && geminiMessages.length > 0 && geminiMessages[geminiMessages.length - 1].role === 'user') {
    geminiMessages[geminiMessages.length - 1].image = base64Image;
  }

  try {
    // 1. Try Gemini (Primary - Has Google Search Grounding for Real-time info)
    console.log("Calling 'Meu Parceiro' via Gemini...");
    return await callGemini(geminiMessages, systemInstructions);
  } catch (error) {
    console.warn("Gemini failed, falling back to Groq:", error.message);
    try {
      // 2. Fallback to Groq (No search, but fast)
      return await callGroq(recentMessages, systemInstructions);
    } catch (groqError) {
      console.error("AI engines failed:", groqError);
      if (groqError.message.includes("429")) {
        return "The gossip bar is full! Let me catch my breath for 10 seconds.";
      }
      return "Ops, my brain had a tiny blackout. Tell me again!";
    }
  }
}
