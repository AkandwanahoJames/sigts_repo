/**
 * OpenAI-compatible Chat Completions (works with api.openai.com and many proxies).
 * Uses Node 18+ global fetch — no extra dependency.
 */

function readChatEnv() {
    const apiKey =
        process.env.SIGTS_CHAT_OPENAI_API_KEY ||
        process.env.OPENAI_API_KEY ||
        '';
    const baseUrl = (process.env.SIGTS_CHAT_OPENAI_BASE || process.env.OPENAI_BASE_URL || 'https://api.openai.com')
        .replace(/\/$/, '');
    const model = process.env.SIGTS_CHAT_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
    const maxTokens = Math.min(1600, Math.max(128, Number(process.env.SIGTS_CHAT_MAX_TOKENS || 768) || 768));
    const timeoutMs = Math.min(120000, Math.max(5000, Number(process.env.SIGTS_CHAT_TIMEOUT_MS || 22000) || 22000));
    const tRaw = Number(process.env.SIGTS_CHAT_TEMPERATURE);
    const temperature =
        Number.isFinite(tRaw) && tRaw >= 0 && tRaw <= 2 ? tRaw : 0.52;
    const disabled =
        /^0|false|no|off$/i.test(String(process.env.SIGTS_CHAT_DISABLE_LLM || '').trim()) ||
        /^0|false|no|off$/i.test(String(process.env.DISABLE_AI_CHAT_LLM || '').trim());
    return { apiKey: apiKey.trim(), baseUrl, model, maxTokens, timeoutMs, temperature, disabled };
}

/**
 * @param {object} opts
 * @param {Array<{role:string, content:string}>} opts.messages OpenAI-format messages (system optional inside)
 * @returns {Promise<{ text: string, rawUsage?: object }>}
 */
async function completeChat(opts) {
    const { apiKey, baseUrl, model, maxTokens, timeoutMs, temperature: envTemperature, disabled } = readChatEnv();
    if (disabled || !apiKey) {
        const err = new Error('LLM_DISABLED');
        err.code = 'LLM_DISABLED';
        throw err;
    }

    const messages = opts.messages;
    if (!Array.isArray(messages) || !messages.length) {
        throw new Error('completeChat: messages required');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const url = `${baseUrl}/v1/chat/completions`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: opts.model || model,
                messages,
                max_tokens: opts.maxTokens ?? maxTokens,
                temperature: typeof opts.temperature === 'number' ? opts.temperature : envTemperature,
            }),
            signal: controller.signal,
        });

        const rawText = await res.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (_) {
            const err = new Error(`OpenAI-compatible API non-JSON (${res.status}): ${rawText.slice(0, 280)}`);
            err.status = res.status;
            throw err;
        }

        if (!res.ok) {
            const msg = data?.error?.message || JSON.stringify(data).slice(0, 400);
            const err = new Error(`${res.status}: ${msg}`);
            err.status = res.status;
            throw err;
        }

        const text = data?.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim()) {
            throw new Error('OpenAI-compatible API returned empty assistant message');
        }

        return { text: text.trim(), rawUsage: data.usage || null };
    } finally {
        clearTimeout(timer);
    }
}

function isLLMConfigured() {
    const { apiKey, disabled } = readChatEnv();
    return Boolean(apiKey) && !disabled;
}

module.exports = { completeChat, readChatEnv, isLLMConfigured };
