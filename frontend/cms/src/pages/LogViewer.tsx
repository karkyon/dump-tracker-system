import { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';

export default function LogViewer() {
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      const res = await apiService.get('/debug/logs/recent?lines=200');
      const lines: string[] = (res.data?.data?.logs || []);
      setLogs(lines);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchLogs();
    if (running) {
      const id = setInterval(fetchLogs, 3000);
      return () => clearInterval(id);
    }
  }, [running]);

  const filtered = filter ? logs.filter(l => l.includes(filter)) : logs;

  return (
    <div style={{ padding: 16, background: '#0d1117', minHeight: '100vh', color: '#c9d1d9', fontFamily: 'monospace' }}>
      <h2 style={{ color: '#58a6ff', marginBottom: 12 }}>📋 バックエンドログビューア</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setRunning(r => !r)}
          style={{ padding: '6px 16px', background: running ? '#da3633' : '#238636', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          {running ? '⏹ 停止' : '▶ リアルタイム監視'}
        </button>
        <button onClick={fetchLogs}
          style={{ padding: '6px 16px', background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 6, cursor: 'pointer' }}>
          🔄 更新
        </button>
        <input placeholder="フィルター（例: error, 400, operationId）" value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ flex: 1, padding: '6px 12px', background: '#161b22', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 6 }} />
        <button onClick={() => setFilter('')}
          style={{ padding: '6px 12px', background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 6, cursor: 'pointer' }}>
          クリア
        </button>
      </div>
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 12, height: 'calc(100vh - 140px)', overflowY: 'auto', fontSize: 12 }}>
        {filtered.map((line, i) => (
          <div key={i} style={{
            padding: '2px 0',
            color: line.includes('error') || line.includes('Error') ? '#ff7b72'
                 : line.includes('warn') ? '#e3b341'
                 : line.includes('✅') ? '#3fb950'
                 : '#c9d1d9',
            borderBottom: '1px solid #21262d'
          }}>{line}</div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ marginTop: 8, color: '#8b949e', fontSize: 11 }}>
        {filtered.length}件表示 {running ? '| 🟢 リアルタイム監視中（3秒更新）' : ''}
      </div>
    </div>
  );
}
