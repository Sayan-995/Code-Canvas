import React from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  isLoading: boolean;
}

export const ExplanationModal: React.FC<ExplanationModalProps> = ({
  isOpen,
  onClose,
  title,
  content,
  isLoading,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-[#252526] rounded-t-xl">
          <div className="flex items-center gap-2 text-purple-400">
            <Sparkles size={20} />
            <h2 className="text-lg font-semibold text-gray-100">AI Explanation</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-700 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar text-gray-300 leading-relaxed">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-gray-400">
              <Loader2 size={32} className="animate-spin text-purple-500" />
              <p>Analyzing code with Gemini...</p>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <h3 className="text-xl font-bold text-white mb-4 border-b border-gray-700 pb-2">{title}</h3>
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
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-[#252526] rounded-b-xl flex justify-end">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};
