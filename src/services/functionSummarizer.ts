const GEMINI_API_KEY = 'AIzaSyA2u56h76HNeokU4g9QjhYv65HoXqtW0ew';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export interface FunctionSummary {
  name: string;
  description: string;
  params?: string;
  returns?: string;
}

// Cache for function summaries to avoid re-fetching
const summaryCache = new Map<string, FunctionSummary[]>();

export const summarizeFunctions = async (code: string, filePath: string): Promise<FunctionSummary[]> => {
  // Check cache first
  const cacheKey = `${filePath}:${code.length}`;
  if (summaryCache.has(cacheKey)) {
    return summaryCache.get(cacheKey)!;
  }

  const prompt = `
Analyze this code and extract all functions/methods. For each, provide a brief description.
Return ONLY a JSON array (no markdown, no explanation):
[{"name": "functionName", "description": "What it does in 1 sentence", "params": "param types", "returns": "return type"}]

If no functions found, return: []

Code:
${code.slice(0, 8000)}
`;

  try {
    const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
      })
    });

    if (!response.ok) throw new Error('API Error');

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const summaries = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    
    // Cache the result
    summaryCache.set(cacheKey, summaries);
    return summaries;
  } catch (error) {
    console.error('Function summarization failed:', error);
    return [];
  }
};

// Generate understanding view content from code
export const generateUnderstandingView = (code: string, summaries: FunctionSummary[]): string => {
  if (summaries.length === 0) {
    return `// No functions detected in this file\n// Original file length: ${code.split('\n').length} lines`;
  }

  let result = '// === UNDERSTANDING VIEW ===\n';
  result += `// This file contains ${summaries.length} function(s)\n\n`;

  summaries.forEach((fn) => {
    result += `/**\n`;
    result += ` * ${fn.description}\n`;
    if (fn.params) result += ` * @params ${fn.params}\n`;
    if (fn.returns) result += ` * @returns ${fn.returns}\n`;
    result += ` */\n`;
    result += `function ${fn.name}() { /* ... */ }\n\n`;
  });

  return result;
};

// Clear cache (useful when switching repos)
export const clearSummaryCache = () => {
  summaryCache.clear();
};
