// lib/llm-client.js
// Cliente Anthropic unificado: directo (ANTHROPIC_API_KEY) o vía cursor-api-proxy (CURSOR_API_KEY).

import Anthropic from '@anthropic-ai/sdk';
import { ensureProxyRunning } from 'cursor-api-proxy';
import { logger } from './logger.js';

let _client = null;
let _initPromise = null;

/** @returns {'cursor'|'anthropic'|null} */
export function llmProvider() {
  const pref = (process.env.LLM_PROVIDER || '').toLowerCase();
  if (pref === 'cursor' && process.env.CURSOR_API_KEY) return 'cursor';
  if (pref === 'anthropic' && process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.CURSOR_API_KEY) return 'cursor';
  return null;
}

export function hasLlmKey() {
  return llmProvider() !== null;
}

/** Anthropic web_search nativo solo con API directa. */
export function supportsNativeWebSearch() {
  return llmProvider() === 'anthropic';
}

export function getModel() {
  if (process.env.LLM_MODEL) return process.env.LLM_MODEL;
  return llmProvider() === 'cursor' ? 'composer-2.5' : 'claude-sonnet-4-5';
}

export function llmKeyError() {
  return 'Falta CURSOR_API_KEY o ANTHROPIC_API_KEY en el entorno.';
}

function proxyRootUrl() {
  const raw = process.env.CURSOR_PROXY_URL || 'http://127.0.0.1:8765';
  return raw.replace(/\/v1\/?$/, '').replace(/\/$/, '');
}

export async function getLlmClient() {
  if (_client) return _client;
  if (!_initPromise) _initPromise = initLlmClient();
  await _initPromise;
  if (!_client) throw new Error(llmKeyError());
  return _client;
}

export async function initLlmClient() {
  if (_client) return _client;

  const provider = llmProvider();
  if (!provider) return null;

  if (provider === 'cursor') {
    const root = proxyRootUrl();
    await ensureProxyRunning({ baseUrl: root });
    _client = new Anthropic({
      baseURL: root,
      apiKey: process.env.CURSOR_BRIDGE_API_KEY || 'unused'
    });
    logger.info({ baseURL: root, model: getModel() }, '[llm] Cursor API (proxy)');
    return _client;
  }

  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  logger.info({ model: getModel() }, '[llm] Anthropic directo');
  return _client;
}
