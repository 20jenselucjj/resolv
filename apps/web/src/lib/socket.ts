import { io, Socket } from 'socket.io-client';

const inferredWsUrl = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    try {
      return new URL(apiUrl).origin;
    } catch {}
  }

  if (typeof window === 'undefined') return 'http://localhost:3001';
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${window.location.hostname}:3001`;
})();

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || inferredWsUrl;

let socket: Socket | null = null;

function buildSocket(): Socket {
  return io(WS_URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    withCredentials: false,
    auth: (cb) => {
      if (typeof window === 'undefined') return cb({});
      const token = localStorage.getItem('resolv_token');
      cb(token ? { token } : {});
    },
  });
}

export function createSocket(): Socket {
  const s = buildSocket();
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.info('[Socket] created', { url: WS_URL, transports: ['polling', 'websocket'] });
  }
  return s;
}

export function getSocket(): Socket {
  if (!socket) {
    socket = buildSocket();

    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.info('[Socket] initialized', { url: WS_URL, transports: ['polling', 'websocket'] });
    }
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}
