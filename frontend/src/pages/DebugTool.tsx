import React, { useState } from 'react';
import axios from 'axios';
import './DebugTool.css';

interface FileBlob {
  path: string;
  content: string;
}

interface DebugResponse {
  explanation: string;
  patch: string;
  confidence: number;
}

const DebugTool: React.FC = () => {
  const [stackTrace, setStackTrace] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<DebugResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const fileBlobs: FileBlob[] = await Promise.all(
        Array.from(files).map(async (file) => {
          const content = await file.text();
          return { path: file.name, content };
        })
      );
      const response = await axios.post<DebugResponse>('http://localhost:8000/debug/solve', {
        stack_trace: stackTrace,
        files: fileBlobs,
      });
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="debug-tool">
      <h2>AI Debugging Assistant</h2>
      <form onSubmit={handleSubmit} className="debug-form">
        <label>
          Stack Trace / Error Log:
          <textarea
            value={stackTrace}
            onChange={(e) => setStackTrace(e.target.value)}
            rows={6}
            required
          />
        </label>
        <label>
          Source Files (select one or more):
          <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Analyzing…' : 'Run Debugger'}
        </button>
      </form>
      {error && <div className="error">Error: {error}</div>}
      {result && (
        <div className="result">
          <h3>Explanation (confidence {result.confidence * 100}% )</h3>
          <p>{result.explanation}</p>
          <h3>Suggested Patch</h3>
          <pre>{result.patch}</pre>
        </div>
      )}
    </div>
  );
};

export default DebugTool;
