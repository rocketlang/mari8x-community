/**
 * Mari8X Agent Onboarding
 *
 * Handles shipping agent registration, API key management,
 * per-port access config, and Telegram alerts configuration.
 *
 * Storage: in-memory Map + JSON file backup at agents.json
 * Auth:    X-Mari8x-Agent-Key header
 */

import { createHash, randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const AGENTS_FILE = join(__dir, '../../agents.json');

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShippingAgent {
  id:            string;
  email:         string;
  name:          string;
  company:       string;
  passwordHash:  string;
  salt:          string;
  apiKey:        string;
  ports:         string[];          // UNLOCODE list this agent manages
  telegram:      TelegramConfig;
  createdAt:     string;
  lastLogin:     string | null;
}

export interface TelegramConfig {
  botToken: string;
  chatId:   string;
  enabled:  boolean;
}

export interface AgentPublic {
  id:        string;
  email:     string;
  name:      string;
  company:   string;
  apiKey:    string;
  ports:     string[];
  telegram:  TelegramConfig;
  createdAt: string;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const agents = new Map<string, ShippingAgent>(); // key: email

function persist() {
  try {
    writeFileSync(AGENTS_FILE, JSON.stringify([...agents.values()], null, 2));
  } catch { /* non-fatal */ }
}

function load() {
  if (!existsSync(AGENTS_FILE)) return;
  try {
    const list: ShippingAgent[] = JSON.parse(readFileSync(AGENTS_FILE, 'utf8'));
    for (const a of list) agents.set(a.email, a);
    console.log(`[onboarding] Loaded ${agents.size} agents`);
  } catch (e) {
    console.error('[onboarding] Failed to load agents.json:', e);
  }
}

load(); // load on startup

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(password + salt).digest('hex');
}

function generateApiKey(): string {
  return 'm8x_' + randomBytes(24).toString('hex');
}

function toPublic(a: ShippingAgent): AgentPublic {
  const { passwordHash, salt, ...pub } = a;
  return pub;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export function registerAgent(params: {
  email:    string;
  name:     string;
  company:  string;
  password: string;
}): { ok: boolean; agent?: AgentPublic; error?: string } {
  if (agents.has(params.email)) {
    return { ok: false, error: 'Email already registered' };
  }

  const salt         = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(params.password, salt);
  const apiKey       = generateApiKey();

  const agent: ShippingAgent = {
    id:           randomBytes(8).toString('hex'),
    email:        params.email.toLowerCase().trim(),
    name:         params.name.trim(),
    company:      params.company.trim(),
    passwordHash,
    salt,
    apiKey,
    ports:        [],
    telegram:     { botToken: '', chatId: '', enabled: false },
    createdAt:    new Date().toISOString(),
    lastLogin:    null,
  };

  agents.set(agent.email, agent);
  persist();
  return { ok: true, agent: toPublic(agent) };
}

export function loginAgent(email: string, password: string): {
  ok: boolean; apiKey?: string; agent?: AgentPublic; error?: string;
} {
  const agent = agents.get(email.toLowerCase().trim());
  if (!agent) return { ok: false, error: 'Agent not found' };

  const hash = hashPassword(password, agent.salt);
  if (hash !== agent.passwordHash) return { ok: false, error: 'Invalid password' };

  agent.lastLogin = new Date().toISOString();
  persist();
  return { ok: true, apiKey: agent.apiKey, agent: toPublic(agent) };
}

export function getAgentByKey(apiKey: string): ShippingAgent | null {
  for (const a of agents.values()) {
    if (a.apiKey === apiKey) return a;
  }
  return null;
}

// ── Port config ───────────────────────────────────────────────────────────────

export function updateAgentPorts(apiKey: string, ports: string[]): {
  ok: boolean; ports?: string[]; error?: string;
} {
  const agent = getAgentByKey(apiKey);
  if (!agent) return { ok: false, error: 'Invalid API key' };

  agent.ports = ports.map((p) => p.toUpperCase().trim()).filter(Boolean);
  persist();
  return { ok: true, ports: agent.ports };
}

// ── Telegram config ───────────────────────────────────────────────────────────

export function updateAgentTelegram(apiKey: string, config: Partial<TelegramConfig>): {
  ok: boolean; telegram?: TelegramConfig; error?: string;
} {
  const agent = getAgentByKey(apiKey);
  if (!agent) return { ok: false, error: 'Invalid API key' };

  agent.telegram = { ...agent.telegram, ...config };
  persist();
  return { ok: true, telegram: agent.telegram };
}

export async function sendTelegramAlert(agent: ShippingAgent, message: string): Promise<boolean> {
  if (!agent.telegram.enabled || !agent.telegram.botToken || !agent.telegram.chatId) {
    return false;
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${agent.telegram.botToken}/sendMessage`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          chat_id:    agent.telegram.chatId,
          text:       message,
          parse_mode: 'Markdown',
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Get all agents subscribed to a given port (for alert fan-out) */
export function getAgentsForPort(portCode: string): ShippingAgent[] {
  const upper = portCode.toUpperCase();
  return [...agents.values()].filter((a) => a.ports.includes(upper));
}

export function getAgentProfile(apiKey: string): AgentPublic | null {
  const a = getAgentByKey(apiKey);
  return a ? toPublic(a) : null;
}

export function listAgents(): AgentPublic[] {
  return [...agents.values()].map(toPublic);
}
