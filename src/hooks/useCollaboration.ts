import { useEffect, useState, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useFileStore, Drawing } from '../store/useFileStore';

export const useCollaboration = (roomId: string | null) => {
  const { setDrawings } = useFileStore();
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const yArrayRef = useRef<Y.Array<Drawing> | null>(null);

  useEffect(() => {
    if (!roomId) {
        setStatus('disconnected');
        return;
    }

    const ydoc = new Y.Doc();
    // Use y-websocket provider connecting to our backend
    // Note: You need to run a y-websocket server or compatible endpoint
    // Since we have a custom socket.io backend, we might need a different approach or a separate y-websocket server.
    // For now, let's try the public demo server or a local one if you run `npx y-websocket`
    // If you want to use your existing backend (port 3001), it needs to support y-websocket protocol.
    // Assuming we want to use the public one for testing or a local one on 1234 (default for y-websocket)
    // But user asked to remove 4444.
    
    // Let's use a public demo for now to fix the error, or we can implement y-websocket on the backend.
    // Given the constraints, let's try to connect to the backend port 3001 assuming we will add y-websocket support there.
    const provider = new WebsocketProvider('ws://localhost:3001', roomId, ydoc);

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

