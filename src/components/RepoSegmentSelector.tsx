import React, { useState } from 'react';
import { FileSegment, ViewMode } from '../store/useFileStore';
import { Check, ChevronDown, ChevronRight, Loader2, ArrowRight } from 'lucide-react';
import { ViewModeSelector } from './ViewModeSelector';

interface Props {
  segments: FileSegment[];
  onConfirm: (selectedFiles: string[], selectedCategories: Set<string>, viewMode: ViewMode) => void;
  onBack: () => void;
  isLoading?: boolean;
}

export const RepoSegmentSelector: React.FC<Props> = ({ segments, onConfirm, onBack, isLoading }) => {
  const [selectedSegments, setSelectedSegments] = useState<Set<string>>(
    new Set(segments.filter(s => s.category === 'Core Source Code').map(s => s.category))
  );
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());
  const [showViewModeSelector, setShowViewModeSelector] = useState(false);

  const toggleSegment = (category: string) => {
    const newSelected = new Set(selectedSegments);
    if (newSelected.has(category)) {
      newSelected.delete(category);
    } else {
      newSelected.add(category);
    }
    setSelectedSegments(newSelected);
  };

  const toggleExpand = (category: string) => {
    const newExpanded = new Set(expandedSegments);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedSegments(newExpanded);
  };

  const handleConfirm = () => {
    // If Core Source Code is selected, show view mode selector
    if (selectedSegments.has('Core Source Code')) {
      setShowViewModeSelector(true);
    } else {
      proceedWithConfirm('full');
    }
  };

  const proceedWithConfirm = (viewMode: ViewMode) => {
    const selectedFiles = segments
      .filter(s => selectedSegments.has(s.category))
      .flatMap(s => s.files);
    setShowViewModeSelector(false);
    onConfirm(selectedFiles, selectedSegments, viewMode);
  };

  const handleViewModeSelect = (mode: ViewMode) => {
    proceedWithConfirm(mode);
  };

  const totalFiles = segments.reduce((acc, s) => acc + s.files.length, 0);
  const selectedFiles = segments
    .filter(s => selectedSegments.has(s.category))
    .reduce((acc, s) => acc + s.files.length, 0);

  const selectAll = () => setSelectedSegments(new Set(segments.map(s => s.category)));
  const selectNone = () => setSelectedSegments(new Set());


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6">
      <ViewModeSelector
        isOpen={showViewModeSelector}
        onClose={() => setShowViewModeSelector(false)}
        onSelect={handleViewModeSelect}
      />
      <div className="w-full max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Select Code Segments</h1>
        <p className="text-gray-400 mb-6">
          AI has categorized your repository into logical segments. Select which parts to load on the canvas.
        </p>

        <div className="flex gap-4 mb-4">
          <button onClick={selectAll} className="text-sm text-blue-400 hover:text-blue-300">Select All</button>
          <button onClick={selectNone} className="text-sm text-gray-400 hover:text-gray-300">Clear All</button>
          <span className="text-sm text-gray-500 ml-auto">
            {selectedFiles} / {totalFiles} files selected
          </span>
        </div>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
          {segments.map((segment) => (
            <div key={segment.category} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <div className="flex items-center p-4 cursor-pointer hover:bg-gray-750" onClick={() => toggleSegment(segment.category)}>
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center mr-3 transition-colors ${
                  selectedSegments.has(segment.category) ? 'bg-blue-600 border-blue-600' : 'border-gray-500'
                }`}>
                  {selectedSegments.has(segment.category) && <Check size={14} />}
                </div>
                <span className="text-2xl mr-3">{segment.icon}</span>
                <div className="flex-1">
                  <h3 className="font-semibold">{segment.category}</h3>
                  <p className="text-sm text-gray-400">{segment.description}</p>
                </div>
                <span className="text-sm text-gray-500 mr-3">{segment.files.length} files</span>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExpand(segment.category); }}
                  className="p-1 hover:bg-gray-700 rounded"
                >
                  {expandedSegments.has(segment.category) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
              </div>
              
              {expandedSegments.has(segment.category) && (
                <div className="border-t border-gray-700 bg-gray-850 p-3 max-h-48 overflow-y-auto">
                  {segment.files.map((file) => (
                    <div key={file} className="text-sm text-gray-400 py-1 px-2 hover:bg-gray-700 rounded truncate">
                      {file}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-4 mt-6">
          <button onClick={onBack} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedFiles === 0 || isLoading}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <><Loader2 className="animate-spin" size={20} /> Loading files...</>
            ) : (
              <>Load {selectedFiles} files <ArrowRight size={20} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
