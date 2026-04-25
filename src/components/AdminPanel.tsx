import React, { useEffect, useState, useRef } from 'react';

type UserStatus = 'ACTIVE' | 'FROZEN' | 'BANNED';

interface LeaderboardEntry {
  id: string;
  user: string;
  region: string;
  score: number;
  timeTaken: number;
  violations: number;
  finalScore: number;
  status: UserStatus;
  telegramId: string;
}

interface AuditLog {
  id: string;
  user: string;
  action: string;
  createdAt: string;
}

export default function AdminPanel() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDashboardData = async () => {
    try {
      const [lbRes, logsRes] = await Promise.all([
        fetch('/api/v1/admin/leaderboard'),
        fetch('/api/v1/admin/audit-logs')
      ]);
      const lbData = await lbRes.json();
      const logsData = await logsRes.json();
      
      setLeaderboard(lbData);
      setLogs(logsData);
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  const changeUserStatus = async (telegramId: string, status: UserStatus) => {
    if (!window.confirm(`WARNING: Are you sure you want to change this user to ${status}?`)) return;
    try {
      await fetch(`/api/v1/admin/user/${telegramId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      setLeaderboard(prev => prev.map(u => u.telegramId === telegramId ? { ...u, status } : u));
    } catch (err) {
      alert("Failed to update user status on the server.");
    }
  };

  const downloadExport = () => {
    window.open('/api/v1/admin/export', '_blank');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('csvFile', file);

    try {
      setIsImporting(true);
      const res = await fetch('/api/v1/admin/questions/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      alert(`Success! Securely imported ${data.count} questions into the testing bank.`);
    } catch (err: any) {
      alert(`Error importing questions: ${err.message}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"/>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex justify-between items-center px-8 py-6 bg-white border-b border-slate-200 shadow-sm z-10">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Ustoz AI Mission Control</h1>
            <p className="text-sm text-slate-500 font-semibold mt-1">Real-Time Exam Analytics & Security Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {isImporting ? 'Importing...' : 'Bulk Import Questions'}
            </button>
            <button 
              onClick={downloadExport}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
              </svg>
              Export Full Dataset
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 flex gap-8">
          <div className="flex-[3] bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col min-h-0">
            <div className="mb-6 flex justify-between items-end">
              <div>
                <h2 className="text-xl font-black text-slate-800">Dynamic Leaderboard Rankings</h2>
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                  Formula: (Raw Score * 10) + Speed Bonus - (Violations * 50)
                </p>
              </div>
              <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] uppercase font-black tracking-widest animate-pulse border border-emerald-200">
                Live Polling Active
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto flex-1 rounded-2xl border border-slate-200 bg-slate-50/50">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white border-b border-slate-200 sticky top-0 shadow-sm z-10">
                  <tr className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                    <th className="px-6 py-5">Rank</th>
                    <th className="px-6 py-5">Participant Identity</th>
                    <th className="px-6 py-5 whitespace-nowrap">Final Score</th>
                    <th className="px-6 py-5">Raw Integrity</th>
                    <th className="px-6 py-5">Security Flags</th>
                    <th className="px-6 py-5">System Status</th>
                    <th className="px-6 py-5 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm bg-white">
                  {leaderboard.map((entry, index) => (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-5 font-black text-slate-400 text-lg">#{index + 1}</td>
                      <td className="px-6 py-5">
                        <p className="font-bold text-slate-900">{entry.user}</p>
                        <p className="text-xs font-semibold text-slate-400">{entry.region}</p>
                      </td>
                      <td className="px-6 py-5 font-black text-indigo-600 text-2xl">
                        {entry.finalScore}
                      </td>
                      <td className="px-6 py-5 font-medium text-slate-600">
                        <span className="font-bold text-slate-800">{entry.score}%</span> 
                        <span className="mx-2 text-slate-300">|</span> 
                        {entry.timeTaken}s
                      </td>
                      <td className="px-6 py-5">
                        {entry.violations > 0 ? (
                          <span className="px-3 py-1.5 bg-rose-100 text-rose-700 font-bold rounded-lg text-xs border border-rose-200 flex items-center w-fit gap-1.5">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                            {entry.violations} Warnings
                          </span>
                        ) : (
                          <span className="text-slate-300 font-black">-</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1.5 font-bold rounded-lg text-[10px] uppercase tracking-widest border ${
                          entry.status === 'BANNED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          entry.status === 'FROZEN' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right opacity-40 group-hover:opacity-100 transition-opacity">
                        {entry.status !== 'BANNED' && (
                          <button onClick={() => changeUserStatus(entry.telegramId, 'BANNED')} className="ml-2 px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 rounded-lg font-bold text-xs border border-rose-200 shadow-sm transition-colors">
                            Ban
                          </button>
                        )}
                        {entry.status !== 'FROZEN' && entry.status !== 'BANNED' && (
                          <button onClick={() => changeUserStatus(entry.telegramId, 'FROZEN')} className="ml-2 px-3 py-1.5 bg-white hover:bg-sky-50 text-sky-600 rounded-lg font-bold text-xs border border-sky-200 shadow-sm transition-colors">
                            Freeze
                          </button>
                        )}
                        {entry.status !== 'ACTIVE' && (
                          <button onClick={() => changeUserStatus(entry.telegramId, 'ACTIVE')} className="ml-2 px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-600 rounded-lg font-bold text-xs border border-emerald-200 shadow-sm transition-colors">
                            Pardon
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex-[1] bg-slate-900 rounded-3xl shadow-xl border border-slate-800 p-6 flex flex-col min-h-0 text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-50"></div>
            
            <h2 className="text-xl font-black mb-1 flex items-center gap-2">
              <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Live Telemetry Log
            </h2>
            <p className="text-xs font-bold text-slate-400 mb-6 uppercase tracking-widest">Anti-Cheat System Triggers</p>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {logs.map((log) => (
                <div key={log.id} className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm text-slate-200">{log.user}</span>
                    <span className="text-[10px] font-bold text-slate-500 tracking-wider">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-rose-400 flex items-center gap-2 bg-rose-500/10 w-fit px-2.5 py-1 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                    {log.action}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
