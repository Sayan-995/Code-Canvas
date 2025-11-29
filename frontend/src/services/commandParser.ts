export interface ParsedCommand {
  intent: 'show' | 'unknown';
  targetType: 'files' | 'functions' | 'both';
  searchTerm: string;
}

export function parseCommand(input: string): ParsedCommand {
  const normalized = input.toLowerCase().trim();
  
  // If input is empty, return early
  if (!normalized) {
    return {
      intent: 'unknown',
      targetType: 'both',
      searchTerm: '',
    };
  }
  
  // Default: assume intent is 'show' (always search)
  let intent: 'show' | 'unknown' = 'show';
  let targetType: 'files' | 'functions' | 'both' = 'both';
  let searchTerm = '';

  // Detect target type
  if (normalized.includes('file') || normalized.includes('files')) {
    targetType = 'files';
  } else if (
    normalized.includes('function') ||
    normalized.includes('functions') ||
    normalized.includes('method') ||
    normalized.includes('methods')
  ) {
    targetType = 'functions';
  }

  // Extract search term by removing common filler words
  const wordsToRemove = [
    'show', 'find', 'display', 'highlight', 'search', 'get', 'give',
    'me', 'the', 'a', 'an', 'for', 'in', 'with',
    'file', 'files', 'function', 'functions', 'method', 'methods'
  ];

  const words = normalized.split(/\s+/);
  const searchWords = words.filter(word => !wordsToRemove.includes(word));
  searchTerm = searchWords.join(' ').trim();

  // If no search term after filtering, use original input
  // This handles cases like "auth.js" or single keywords
  if (!searchTerm) {
    searchTerm = normalized;
  }

  return {
    intent,
    targetType,
    searchTerm,
  };
}
