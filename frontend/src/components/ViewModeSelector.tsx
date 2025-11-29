import React from 'react';
import { ViewMode } from '../store/useFileStore';
import { Code, BookOpen, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mode: ViewMode) => void;
}

export const ViewModeSelector: React.FC<Props> = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl border border-gray-600 w-full max-w-lg p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Choose View Mode</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X size={24} />
          </button>
        </div>

        <p className="text-gray-400 mb-6">
          Select how you want to view the Core Source Code files:
        </p>

        <div className="space-y-4">
          {/* Understanding View */}
          <button
            onClick={() => onSelect('understanding')}
            className="w-full p-5 bg-gray-700 hover:bg-gray-650 border-2 border-gray-600 hover:border-purple-500 rounded-xl transition-all text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-600/20 rounded-lg group-hover:bg-purple-600/30">
                <BookOpen size={28} className="text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">Understanding View</h3>
                <p className="text-sm text-gray-400">
                  Shows function names with AI-generated descriptions. Code structure is preserved but implementation details are summarized. Great for learning and code review.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-purple-400">
                  <span className="px-2 py-1 bg-purple-600/20 rounded">Faster Loading</span>
                  <span className="px-2 py-1 bg-purple-600/20 rounded">AI Summaries</span>
                </div>
              </div>
            </div>
          </button>

          {/* Full Code View */}
          <button
            onClick={() => onSelect('full')}
            className="w-full p-5 bg-gray-700 hover:bg-gray-650 border-2 border-gray-600 hover:border-blue-500 rounded-xl transition-all text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-600/20 rounded-lg group-hover:bg-blue-600/30">
                <Code size={28} className="text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">Full Code View</h3>
                <p className="text-sm text-gray-400">
                  Shows complete source code with all implementation details. Best for editing and detailed code analysis.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-blue-400">
                  <span className="px-2 py-1 bg-blue-600/20 rounded">Complete Code</span>
                  <span className="px-2 py-1 bg-blue-600/20 rounded">Editable</span>
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
