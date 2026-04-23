function extractText(value) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(extractText).filter(Boolean).join("\n");
  }
  if (value && typeof value === "object") {
    if (typeof value.text === "string") {
      return value.text;
    }
    if (Array.isArray(value.content)) {
      return extractText(value.content);
    }
    if (Array.isArray(value.output)) {
      return extractText(value.output);
    }
    if (Array.isArray(value.candidates)) {
      return extractText(value.candidates);
    }
    if (Array.isArray(value.parts)) {
      return extractText(value.parts);
    }
    if (value.message) {
      return extractText(value.message);
    }
  }
  return "";
}

function parseJsonFromText(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const match = trimmed.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) {
      throw error;
    }
    return JSON.parse(match[0]);
  }
}

async function postJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Provider request failed (${response.status}): ${text}`);
  }

  return text ? JSON.parse(text) : {};
}

function buildRequest(config, profile, task, modelOverride) {
  return {
    model:
      modelOverride?.model ||
      (profile.aiProvider === modelOverride?.provider && profile.aiModel !== "creator-local-v1" ? profile.aiModel : null) ||
      (profile.aiProvider === config.name && profile.aiModel !== "creator-local-v1" ? profile.aiModel : null) ||
      config.model,
    system: task.system,
    user: task.user
  };
}

async function callOpenAI(config, request) {
  const payload = {
    model: request.model || config.model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: request.system }]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: request.user }]
      }
    ]
  };

  const json = await postJson(`${config.baseUrl}/responses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${request.apiKey}`
    },
    body: JSON.stringify(payload)
  });

  return extractText(json.output_text || json.output);
}

async function callOpenAICompatible(config, request) {
  const json = await postJson(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${request.apiKey}`
    },
    body: JSON.stringify({
      model: request.model || config.model,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user }
      ]
    })
  });

  return extractText(json.choices?.[0]?.message?.content);
}

async function callAnthropic(config, request) {
  const json = await postJson(`${config.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": request.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: request.model || config.model,
      max_tokens: 2000,
      system: request.system,
      messages: [{ role: "user", content: request.user }]
    })
  });

  return extractText(json.content);
}

async function callGemini(config, request) {
  const model = request.model || config.model;
  const url = `${config.baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(request.apiKey)}`;
  const json = await postJson(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: request.system }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: request.user }]
        }
      ]
    })
  });

  return extractText(json.candidates);
}

async function callOpenRouter(config, request) {
  const json = await postJson(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${request.apiKey}`
    },
    body: JSON.stringify({
      model: request.model || config.model,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user }
      ]
    })
  });

  return extractText(json.choices?.[0]?.message?.content);
}

function getAvailableProviders(providers) {
  const available = [];
  for (const [name, config] of Object.entries(providers.providers || {})) {
    if (config.type !== "local" && config.enabled && process.env[config.apiKeyEnv]) {
      available.push(name);
    }
  }
  return available;
}

export function formatProviderError(providers) {
  const available = getAvailableProviders(providers);
  const allProviders = Object.entries(providers.providers || {})
    .filter(([_, config]) => config.type !== "local")
    .map(([name, config]) => `  - ${name} (env: ${config.apiKeyEnv})`)
    .join("\n");

  if (available.length > 0) {
    return `No provider is currently active. Available providers with API keys:\n${available.map(n => `  - ${n}`).join("\n")}\n\nUse "creator providers use <name>" to switch.`;
  }

  return `No AI provider configured. Please set up a provider:\n${allProviders}\n\nSteps:\n  1. Choose a provider from the list above\n  2. Export its API key (e.g., export OPENROUTER_API_KEY=your_key)\n  3. Enable it: creator profile provider <name> --enable\n  4. Test: creator providers test`;
}

export async function generateWithProvider({ providers, profile, task, modelOverride }) {
  const providerName = modelOverride?.provider || profile.aiProvider || providers.defaultProvider;
  const config = providers.providers?.[providerName];

  if (!config) {
    throw new Error(formatProviderError(providers));
  }

  if (config.type === "local") {
    throw new Error(formatProviderError(providers));
  }

  if (!config.enabled) {
    throw new Error(`Provider "${providerName}" is disabled. Enable it with: creator profile provider ${providerName} --enable`);
  }

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Missing API key for ${providerName}. Expected env var: ${config.apiKeyEnv}\n\nExport it with: export ${config.apiKeyEnv}=your_key`);
  }

  const request = {
    ...buildRequest({ ...config, name: providerName }, profile, task, modelOverride),
    apiKey
  };

  let text = "";
  if (config.type === "openai") {
    text = await callOpenAI(config, request);
  } else if (config.type === "openai_compatible") {
    text = await callOpenAICompatible(config, request);
  } else if (config.type === "anthropic") {
    text = await callAnthropic(config, request);
  } else if (config.type === "gemini") {
    text = await callGemini(config, request);
  } else if (config.type === "openrouter") {
    text = await callOpenRouter(config, request);
  } else {
    throw new Error(`Unsupported provider type: ${config.type} for ${providerName}`);
  }

  return {
    provider: providerName,
    model: request.model,
    mode: "remote",
    text
  };
}

export function tryParseJson(text, fallback) {
  try {
    return parseJsonFromText(text);
  } catch (error) {
    return fallback;
  }
}

export async function probeProvider(name, config, profile, options = {}) {
  const result = {
    provider: name,
    type: config.type,
    enabled: Boolean(config.enabled),
    model: options.model || config.model,
    baseUrl: config.baseUrl || "",
    apiKeyEnv: config.apiKeyEnv || "",
    status: "ok",
    mode: "config",
    detail: "Ready"
  };

  if (config.type === "local") {
    result.detail = "Local fallback provider";
    return result;
  }

  if (!config.enabled) {
    result.status = "warn";
    result.detail = "Provider disabled";
    return result;
  }

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    result.status = "warn";
    result.detail = `Missing env var ${config.apiKeyEnv}`;
    return result;
  }

  if (options.live === false) {
    result.detail = `API key detected in ${config.apiKeyEnv}`;
    return result;
  }

  const request = {
    ...buildRequest({ ...config, name }, profile, {
      system: "You are a provider connectivity probe. Reply with exactly: OK",
      user: "Reply with exactly: OK"
    }, { provider: name, model: options.model }),
    apiKey
  };

  try {
    let text = "";
    if (config.type === "openai") {
      text = await callOpenAI(config, request);
    } else if (config.type === "openai_compatible") {
      text = await callOpenAICompatible(config, request);
    } else if (config.type === "anthropic") {
      text = await callAnthropic(config, request);
    } else if (config.type === "gemini") {
      text = await callGemini(config, request);
    } else if (config.type === "openrouter") {
      text = await callOpenRouter(config, request);
    } else {
      result.status = "warn";
      result.detail = `Unsupported provider type: ${config.type}`;
      return result;
    }

    result.mode = "live";
    result.detail = text.trim() ? `Live request succeeded: ${text.trim().slice(0, 80)}` : "Live request succeeded";
    return result;
  } catch (error) {
    result.status = "error";
    result.mode = "live";
    result.detail = error instanceof Error ? error.message : String(error);
    return result;
  }
}
