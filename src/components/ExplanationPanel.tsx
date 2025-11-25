import React from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useExplanationStore } from '../store/useExplanationStore';

export const ExplanationPanel: React.FC = () => {
  const { isOpen, title, content, isLoading, closeExplanation } = useExplanationStore();

  return (
    <>
      {/* Overlay for mobile/focus if needed, currently just the panel */}
      <div 
        className={`fixed top-0 right-0 h-full bg-[#1e1e1e] border-l border-[#333] shadow-2xl z-[5000] transition-transform duration-300 ease-in-out flex flex-col w-[400px] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#333] bg-[#252526]">
          <div className="flex items-center gap-2 text-purple-400">
            <Sparkles size={18} />
            <span className="font-semibold text-gray-100">AI Explanation</span>
          </div>
          <button 
            onClick={closeExplanation}
            className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-700 rounded"
            title="Close Panel"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar text-gray-300 leading-relaxed">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
              <Loader2 size={32} className="animate-spin text-purple-500" />
              <p className="text-sm">Analyzing code structure...</p>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              {title && <h3 className="text-lg font-bold text-white mb-4 border-b border-gray-700 pb-2">{title}</h3>}
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => <h1 className="text-xl font-bold text-purple-300 mt-4 mb-2" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-lg font-bold text-purple-300 mt-4 mb-2" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-md font-bold text-purple-300 mt-3 mb-1" {...props} />,
                  strong: ({node, ...props}) => <strong className="text-cyan-300 font-semibold" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 my-2 pl-2" {...props} />,
                  li: ({node, ...props}) => <li className="text-gray-300" {...props} />,
                  p: ({node, ...props}) => <p className="mb-3 text-gray-300" {...props} />,
                  code: ({node, ...props}) => <code className="bg-gray-800 text-orange-300 px-1 py-0.5 rounded text-xs font-mono" {...props} />,
                  pre: ({node, ...props}) => <pre className="bg-gray-800 p-3 rounded-lg my-3 overflow-x-auto border border-gray-700" {...props} />,
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
      
      {/* Toggle Button (Visible when closed?) - Optional, user said "contract to left" which implies hiding to right. 
          If they meant it stays as a small bar on the right, we can add that. 
          For now, standard slide-in behavior. 
      */}
    </>
  );
};
