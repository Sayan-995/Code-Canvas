import { useEffect, useState, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useFileStore, Drawing } from '../store/useFileStore';

const getBackendUrl = () => import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// Convert HTTP/HTTPS to WS/WSS for WebSocket connections
const getWSURL = () => {
  const backendUrl = getBackendUrl();
  if (backendUrl.startsWith('https://')) {
    return backendUrl.replace('https://', 'wss://');
  } else if (backendUrl.startsWith('http://')) {
    return backendUrl.replace('http://', 'ws://');
  }
  return backendUrl;
};

export const useCollaboration = (roomId: string | null) => {
  const { setDrawings } = useFileStore();
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const yArrayRef = useRef<Y.Array<Drawing> | null>(null);

  useEffect(() => {
    if (!roomId) {
        setStatus('disconnected');
        return;
    }

    const wsUrl = getWSURL();
    console.log('Connecting to Yjs WebSocket:', wsUrl);
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(wsUrl, roomId, ydoc);

    const yDrawings = ydoc.getArray<Drawing>('drawings');
    yArrayRef.current = yDrawings;

    setStatus('connecting');

    provider.on('status', ({ status }: { status: string }) => {
      setStatus(status === 'connected' ? 'connected' : 'disconnected');
    });

    yDrawings.observe(() => {
      setDrawings(yDrawings.toArray());
    });

    // Initial sync if data exists
    if (yDrawings.length > 0) {
        setDrawings(yDrawings.toArray());
    }
    
    return () => {
      provider.destroy();
      ydoc.destroy();
      yArrayRef.current = null;
    };
  }, [roomId, setDrawings]);

  const addDrawingToYjs = (drawing: Drawing) => {
    if (yArrayRef.current) {
        yArrayRef.current.push([drawing]);
    }
  };

  const updateDrawingInYjs = (id: string, updates: Partial<Drawing>) => {
      if (yArrayRef.current) {
          const arr = yArrayRef.current.toArray();
          const index = arr.findIndex(d => d.id === id);
          if (index !== -1) {
              const old = arr[index];
              yArrayRef.current.delete(index, 1);
              yArrayRef.current.insert(index, [{ ...old, ...updates }]);
          }
      }
  };

  const removeDrawingFromYjs = (id: string) => {
      if (yArrayRef.current) {
          const arr = yArrayRef.current.toArray();
          const index = arr.findIndex(d => d.id === id);
          if (index !== -1) {
              yArrayRef.current.delete(index, 1);
          }
      }
  };
  
  return { status, addDrawingToYjs, updateDrawingInYjs, removeDrawingFromYjs };
};

