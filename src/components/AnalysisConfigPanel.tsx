/**
 * Analysis Configuration Panel for Code Canvas
 * Allows toggling ESLint and TypeScript checks with per-repository configuration
 * 
 * Requirements: 5.1, 5.2, 5.3
 * - WHERE ESLint configuration is enabled, apply ESLint rules during analysis
 * - WHERE TypeScript configuration is enabled, perform TSC type checks
 * - Allow configuration of ESLint and TSC settings on a per-repository basis
 */

import React from 'react';
import { X, Settings, AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAnalysisStore } from '../store/useAnalysisStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AnalysisConfigPanel: React.FC<Props> = ({ isOpen, onClose }) => {
  const { 
    analysisConfig, 
    setAnalysisConfig, 
    analysisResults, 
    isAnalyzing,
    clearAnalysisResults,
    clearCache
  } = useAnalysisStore();

  if (!isOpen) return null;

  // Calculate total diagnostics across all files
  const totalErrors = Array.from(analysisResults.values())
    .flatMap(r => r.diagnostics)
    .filter(d => d.severity === 'error').length;
  
  const totalWarnings = Array.from(analysisResults.values())
    .flatMap(r => r.diagnostics)
    .filter(d => d.severity === 'warning').length;

  const handleToggleESLint = () => {
    setAnalysisConfig({ eslintEnabled: !analysisConfig.eslintEnabled });
  };

  const handleToggleTypeScript = () => {
    setAnalysisConfig({ typescriptEnabled: !analysisConfig.typescriptEnabled });
  };

  const handleClearResults = () => {
    clearAnalysisResults();
    clearCache();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl border border-gray-600 w-full max-w-md p-6 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <Settings size={24} className="text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Analysis Settings</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X size={24} />
          </button>
        </div>

        {/* Status Summary */}
        <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-sm">Analysis Status</span>
            {isAnalyzing ? (
              <span className="flex items-center gap-2 text-blue-400 text-sm">
                <Loader2 size={14} className="animate-spin" />
                Analyzing...
              </span>
            ) : (
              <span className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle2 size={14} />
                Ready
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <span className="flex items-center gap-1 text-red-400 text-sm">
              <AlertCircle size={14} />
              {totalErrors} errors
            </span>
            <span className="flex items-center gap-1 text-yellow-400 text-sm">
              <AlertTriangle size={14} />
              {totalWarnings} warnings
            </span>
          </div>
        </div>

        {/* Configuration Options */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
            Static Analysis Tools
          </h3>

          {/* ESLint Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg border border-gray-600">
            <div className="flex-1">
              <h4 className="text-white font-medium">ESLint</h4>
              <p className="text-gray-400 text-sm mt-1">
                Lint JavaScript/TypeScript code for common issues
              </p>
            </div>
            <button
              onClick={handleToggleESLint}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                analysisConfig.eslintEnabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  analysisConfig.eslintEnabled ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* TypeScript Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg border border-gray-600">
            <div className="flex-1">
              <h4 className="text-white font-medium">TypeScript</h4>
              <p className="text-gray-400 text-sm mt-1">
                Type checking for TypeScript files
              </p>
            </div>
            <button
              onClick={handleToggleTypeScript}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                analysisConfig.typescriptEnabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  analysisConfig.typescriptEnabled ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <button
            onClick={handleClearResults}
            className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors text-sm"
          >
            Clear All Results & Cache
          </button>
        </div>

        {/* Info */}
        <p className="text-gray-500 text-xs mt-4 text-center">
          Changes apply immediately to all open files
        </p>
      </div>
    </div>
  );
};
