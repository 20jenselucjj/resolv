// oauth-token-refresh.ts — Lightweight HTTPS POST for OAuth token refresh
// Separate from oauth.ts to avoid circular dependencies with outbound-email.ts

import https from 'https';
import { URL } from 'url';

export async function oauthTokenRefresh(
  url: string,
  body: Record<string, string>
): Promise<any> {
  const parsed = new URL(url);
  const params = new URLSearchParams(body).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(params),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString()));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Failed to parse token response: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(params);
    req.end();
  });
}
