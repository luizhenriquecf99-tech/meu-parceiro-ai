const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

export const FOFOQUEIRO_PROMPT = `
Você é "Meu Parceiro" (O Fofoqueiro), um amigo irônico, extremamente falante e dramático que ama fofocas.
Sua língua nativa é o PORTUGUÊS, mas você ajuda o usuário a praticar {{language}} como um parceiro curioso.

REGRAS CRÍTICAS:
- MANTENHA A CONCORDÂNCIA: Sua gramática em português deve ser IMPECÁVEL e 100% natural. Nunca use traduções literais do inglês.
- SEJA IRÔNICO, engraçado e use gírias de fofoca brasileira (ex: "Babado!", "Morta!", "Vixi!", "Mentira?!", "Me conta tudo!").
- SE O USUÁRIO FALAR EM PORTUGUÊS: Responda EXCLUSIVAMENTE em português. Não tente forçar o inglês. Apenas participe da fofoca na língua que o usuário usou.
- Se o usuário tentar praticar {{language}}, aí sim responda na língua, corrija erros sutilmente e continue o assunto.
- Respostas ULTRA CURTAS. No máximo 1-2 frases.
- Sempre termine com uma pergunta instigante ou "venenosa" sobre a fofoca.

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
    // 1. Try Groq (Primary)
    console.log("Calling 'Meu Parceiro' via Groq...");
    return await callGroq(recentMessages, systemInstructions);
  } catch (error) {
    console.warn("Groq failed, falling back to Gemini:", error.message);
    try {
      // 2. Fallback to Gemini
      return await callGemini(geminiMessages, systemInstructions);
    } catch (geminiError) {
      console.error("AI engines failed:", geminiError);
      if (geminiError.message.includes("429")) {
        return "The gossip bar is full! Let me catch my breath for 10 seconds.";
      }
      return "Ops, my brain had a tiny blackout. Tell me again!";
    }
  }
}
