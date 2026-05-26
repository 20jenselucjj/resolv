import type { SystemInfo } from './collector';

interface RegisterResponse {
  data: {
    asset_id: string;
    agent_token: string;
  };
}

interface ApiOkResponse {
  data: {
    ok: boolean;
    asset_id?: string;
  };
}

async function request<T>(
  apiUrl: string,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
  } = {}
): Promise<T> {
  const { method = 'GET', body, token } = options;
  const url = apiUrl.replace(/\/+$/, '') + path;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`API ${method} ${path} failed (${res.status}): ${errorBody}`);
      return null as unknown as T;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.error(`API ${method} ${path} error:`, err);
    return null as unknown as T;
  }
}

export async function registerAgent(
  apiUrl: string,
  hostname: string,
  agentVersion: string,
  agentSecret: string
): Promise<{ asset_id: string; agent_token: string } | null> {
  const result = await request<RegisterResponse>(apiUrl, '/api/assets/agent/register', {
    method: 'POST',
    body: {
      hostname,
      agent_version: agentVersion,
      agent_secret: agentSecret,
    },
  });
  if (!result || !result.data) return null;
  return result.data;
}

export async function checkin(
  apiUrl: string,
  agentToken: string,
  systemInfo: SystemInfo
): Promise<void> {
  await request<ApiOkResponse>(apiUrl, '/api/assets/agent/checkin', {
    method: 'POST',
    token: agentToken,
    body: {
      hostname: systemInfo.hostname,
      agent_version: systemInfo.agent_version,
      ip_address: systemInfo.ip_address,
      mac_address: systemInfo.mac_address,
      domain: systemInfo.domain,
      os: systemInfo.os,
      hardware: systemInfo.hardware,
      network_adapters: systemInfo.network_adapters,
      software: systemInfo.software,
      current_user: systemInfo.current_user,
    },
  });
}

export async function heartbeat(
  apiUrl: string,
  agentToken: string
): Promise<void> {
  await request<ApiOkResponse>(apiUrl, '/api/assets/agent/heartbeat', {
    method: 'POST',
    token: agentToken,
  });
}

export async function disconnect(
  apiUrl: string,
  agentToken: string
): Promise<void> {
  await request<ApiOkResponse>(apiUrl, '/api/assets/agent/disconnect', {
    method: 'POST',
    token: agentToken,
  });
}
