const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const knowledgeBase = `
AxelAi PropOS is positioned as an AI assistant for property operations and real estate workflows.
For Texas real estate questions:
- The Information About Brokerage Services form is commonly referred to as the IABS form.
- Steering means influencing a buyer or tenant toward or away from an area, property, or community based on protected characteristics.
- One acre is 43,560 square feet. To convert square feet to acres, divide square feet by 43,560.
- Real estate answers should be practical, cite uncertainty plainly, and tell users to confirm legal, licensing, tax, and contract issues with qualified professionals or official Texas sources.
`

const systemPrompt = `
You are AxelAi PropOS Search, a concise assistant for Texas real estate and property operations.
Use the embedded knowledge first. If the question asks about current law, forms, prices, rules, market data, or anything time-sensitive, say that the user should verify against current official sources.
Do not claim live web access. Do not invent citations. Keep the answer direct and useful.

Embedded knowledge:
${knowledgeBase}
`

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  Response.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init.headers || {}),
    },
  })

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, { status: 405 })
  }

  let question = ""
  try {
    const body = await req.json()
    question = typeof body?.question === "string" ? body.question.trim() : ""
  } catch {
    return jsonResponse({ error: "Invalid JSON request body." }, { status: 400 })
  }

  if (!question) {
    return jsonResponse({ error: "Question is required." }, { status: 400 })
  }

  if (!process.env.NETLIFY_AI_GATEWAY_BASE_URL || !process.env.NETLIFY_AI_GATEWAY_KEY) {
    return jsonResponse(
      {
        error:
          "AI Gateway is not configured for this deploy. Enable Netlify AI Gateway or set the required gateway environment variables.",
      },
      { status: 503 },
    )
  }

  const aiResponse = await fetch(`${process.env.NETLIFY_AI_GATEWAY_BASE_URL}/openai/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NETLIFY_AI_GATEWAY_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    }),
  })

  if (!aiResponse.ok) {
    return jsonResponse({ error: "The AI backend could not answer right now." }, { status: 502 })
  }

  const data = await aiResponse.json()
  const answer = data?.choices?.[0]?.message?.content?.trim()

  return jsonResponse({
    answer: answer || "No answer returned.",
    usedWeb: false,
  })
}
