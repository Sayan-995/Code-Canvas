const GEMINI_API_KEY = 'AIzaSyA2u56h76HNeokU4g9QjhYv65HoXqtW0ew';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export interface FileSegment {
  category: string;
  description: string;
  files: string[];
  icon: string;
}

export interface SegmentedRepo {
  segments: FileSegment[];
}

export const categorizeRepository = async (filePaths: string[]): Promise<SegmentedRepo> => {
  const prompt = `
You are a code repository analyzer. Given a list of file paths from a repository, categorize them into logical segments.

Return a JSON object with this exact structure (no markdown, just raw JSON):
{
  "segments": [
    {
      "category": "Category Name",
      "description": "Brief description of what these files contain",
      "files": ["path/to/file1", "path/to/file2"],
      "icon": "emoji"
    }
  ]
}

Use these categories (only include categories that have files):
- "Core Source Code" (icon: "💻") - Main application logic, components, hooks, services
- "Configuration" (icon: "⚙️") - Config files like package.json, tsconfig, vite.config, etc.
- "Styles" (icon: "🎨") - CSS, SCSS, styled-components, Tailwind files
- "Assets & Media" (icon: "🖼️") - Images, SVGs, fonts, icons, videos
- "Documentation" (icon: "📚") - README, docs, markdown files, comments
- "Tests" (icon: "🧪") - Test files, spec files, __tests__ folders
- "Types & Interfaces" (icon: "📝") - TypeScript type definitions, .d.ts files
- "Build & Scripts" (icon: "🔧") - Build scripts, CI/CD configs, Dockerfiles
- "Data & Mocks" (icon: "📦") - JSON data, mock files, fixtures, seeds

File paths to categorize:
${filePaths.join('\n')}
`;

  try {
    const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('No response from Gemini');
    }

    return JSON.parse(text) as SegmentedRepo;
  } catch (error) {
    console.error('Repo categorization failed:', error);
    return fallbackCategorization(filePaths);
  }
};


// Fallback categorization when AI fails
const fallbackCategorization = (filePaths: string[]): SegmentedRepo => {
  const segments: Record<string, FileSegment> = {
    core: { category: "Core Source Code", description: "Main application logic", files: [], icon: "💻" },
    config: { category: "Configuration", description: "Project configuration files", files: [], icon: "⚙️" },
    styles: { category: "Styles", description: "Styling files", files: [], icon: "🎨" },
    assets: { category: "Assets & Media", description: "Images and media files", files: [], icon: "🖼️" },
    docs: { category: "Documentation", description: "Documentation files", files: [], icon: "📚" },
    tests: { category: "Tests", description: "Test files", files: [], icon: "🧪" },
    types: { category: "Types & Interfaces", description: "Type definitions", files: [], icon: "📝" },
    build: { category: "Build & Scripts", description: "Build configuration", files: [], icon: "🔧" },
    data: { category: "Data & Mocks", description: "Data and mock files", files: [], icon: "📦" },
  };

  const configFiles = ['package.json', 'tsconfig', 'vite.config', 'webpack.config', '.eslintrc', '.prettierrc', 'tailwind.config'];
  const assetExts = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.mp4', '.mp3', '.woff', '.woff2', '.ttf', '.eot'];
  const styleExts = ['.css', '.scss', '.sass', '.less', '.styled'];
  const docExts = ['.md', '.mdx', '.txt', '.rst'];
  const testPatterns = ['.test.', '.spec.', '__tests__', '__mocks__'];
  const typePatterns = ['.d.ts', 'types/', 'interfaces/'];

  for (const path of filePaths) {
    const lowerPath = path.toLowerCase();
    const fileName = path.split('/').pop() || '';

    if (testPatterns.some(p => lowerPath.includes(p))) {
      segments.tests.files.push(path);
    } else if (typePatterns.some(p => lowerPath.includes(p))) {
      segments.types.files.push(path);
    } else if (configFiles.some(c => lowerPath.includes(c)) || fileName.startsWith('.')) {
      segments.config.files.push(path);
    } else if (assetExts.some(ext => lowerPath.endsWith(ext))) {
      segments.assets.files.push(path);
    } else if (styleExts.some(ext => lowerPath.endsWith(ext))) {
      segments.styles.files.push(path);
    } else if (docExts.some(ext => lowerPath.endsWith(ext))) {
      segments.docs.files.push(path);
    } else if (lowerPath.includes('dockerfile') || lowerPath.includes('.yml') || lowerPath.includes('.yaml') || lowerPath.includes('ci/')) {
      segments.build.files.push(path);
    } else if (lowerPath.endsWith('.json') && !configFiles.some(c => lowerPath.includes(c))) {
      segments.data.files.push(path);
    } else {
      segments.core.files.push(path);
    }
  }

  return {
    segments: Object.values(segments).filter(s => s.files.length > 0)
  };
};
