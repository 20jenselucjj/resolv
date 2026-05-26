import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export interface Config {
  apiUrl: string;
  agentSecret: string;
  assetId: string;
  agentToken: string;
  checkinIntervalMs: number;
  heartbeatIntervalMs: number;
}

const DEFAULTS: Config = {
  apiUrl: 'http://localhost:3001',
  agentSecret: '',
  assetId: '',
  agentToken: '',
  checkinIntervalMs: 300000,
  heartbeatIntervalMs: 30000,
};

function getConfigPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'agent-config.json');
}

export function getConfig(): Config {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch (err) {
    console.error('Failed to read config, using defaults:', err);
  }
  return { ...DEFAULTS };
}

export function saveConfig(partial: Partial<Config>): Config {
  const configPath = getConfigPath();
  const current = getConfig();
  const updated: Config = { ...current, ...partial };
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save config:', err);
  }
  return updated;
}
