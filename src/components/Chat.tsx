import React, { useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { Send, X, MessageSquare } from 'lucide-react';

interface Message {
  user: string;
  text: string;
  time: string;
}

interface ChatProps {
  roomId: string;
  username?: string;
  onClose: () => void;
}

const socket: Socket = io('http://localhost:3001');

export const Chat: React.FC<ChatProps> = ({ roomId, username = 'User', onClose }) => {
  const [currentMessage, setCurrentMessage] = useState('');
  const [messageList, setMessageList] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dragging state
  const [position, setPosition] = useState(() => {
    const width = Math.min(320, window.innerWidth - 20);
    const x = Math.max(10, window.innerWidth - width - 20);
    const y = Math.max(10, window.innerHeight - 450);
    return { x, y };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStartPos.current.x,
          y: e.clientY - dragStartPos.current.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (roomId) {
      socket.emit('join_room', roomId);
    }
  }, [roomId]);

  useEffect(() => {
    const handleReceiveMessage = (data: Message) => {
      setMessageList((list) => [...list, data]);
    };

    socket.on('receive_message', handleReceiveMessage);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageList]);

  const sendMessage = async () => {
    if (currentMessage !== '') {
      const messageData: Message = {
        user: username,
        text: currentMessage,
        time: new Date(Date.now()).getHours() + ':' + new Date(Date.now()).getMinutes(),
      };

      await socket.emit('send_message', { ...messageData, room: roomId });
      setMessageList((list) => [...list, messageData]);
      setCurrentMessage('');
    }
  };

  return (
    <div 
      className="fixed w-[90vw] max-w-80 h-[50vh] max-h-96 bg-gray-800 border border-gray-700 rounded-lg shadow-xl flex flex-col z-50"
      style={{ left: position.x, top: position.y }}
    >
      <div 
        className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-900 rounded-t-lg cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <MessageSquare size={18} className="text-blue-400" />
          <span className="text-white font-medium">Live Chat</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {messageList.map((messageContent, index) => {
          const isMyMessage = messageContent.user === username;
          return (
            <div
              key={index}
              className={`flex flex-col ${isMyMessage ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                  isMyMessage
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-700 text-gray-200 rounded-bl-none'
                }`}
              >
                <p>{messageContent.text}</p>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[10px] text-gray-500">{messageContent.time}</span>
                {!isMyMessage && <span className="text-[10px] text-gray-500">• {messageContent.user}</span>}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-gray-700 bg-gray-900 rounded-b-lg">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={currentMessage}
            onChange={(event) => setCurrentMessage(event.target.value)}
            onKeyPress={(event) => {
              event.key === 'Enter' && sendMessage();
            }}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 text-white text-sm rounded-md px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={sendMessage}
            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1f2937;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4b5563;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
      `}</style>
    </div>
  );
};
