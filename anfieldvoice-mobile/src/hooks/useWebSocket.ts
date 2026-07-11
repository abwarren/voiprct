// ============================================================================
// AnfieldVoice — WebSocket Hook
// Real-time gate call signalling (Slice 1)
// ============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import * as api from '../api/client';
import type { WsMessage, WsIncomingCall, WsCallUpdated } from '../types';

const WS_BASE = __DEV__
  ? 'ws://192.168.1.100:8000'
  : 'wss://api.anfieldvoice.co.za';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

interface UseWebSocketReturn {
  state: ConnectionState;
  incomingCall: WsIncomingCall | null;
  lastEvent: WsMessage | null;
  clearIncomingCall: () => void;
  send: (data: Record<string, unknown>) => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [incomingCall, setIncomingCall] = useState<WsIncomingCall | null>(null);
  const [lastEvent, setLastEvent] = useState<WsMessage | null>(null);

  const connect = useCallback(async () => {
    const token = await api.getStoredToken();
    if (!token) return;

    setState('connecting');
    const url = `${WS_BASE}/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setState('connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsMessage;
        setLastEvent(data);

        switch (data.type) {
          case 'connected':
            break;
          case 'incoming_call':
            setIncomingCall(data);
            break;
          case 'call_updated':
            if (data.call_status !== 'ringing') {
              setIncomingCall((prev) =>
                prev && prev.call_id === data.call_id ? null : prev,
              );
            }
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setState('disconnected');
      wsRef.current = null;
      // Reconnect after 3s
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const clearIncomingCall = useCallback(() => setIncomingCall(null), []);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { state, incomingCall, lastEvent, clearIncomingCall, send };
}
