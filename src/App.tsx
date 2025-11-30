import { useEffect } from 'react';
import { CodeEditor } from './components/CodeEditor';

function App() {
  useEffect(() => {
    console.log('App mounted');
    console.log('VITE_BACKEND_URL:', import.meta.env.VITE_BACKEND_URL);
    console.log('MODE:', import.meta.env.MODE);
  }, []);

  return (
    <CodeEditor />
  );
}

export default App;
