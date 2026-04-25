import React, { useEffect, useState, useRef, useCallback } from 'react';

type UserStatus = 'ACTIVE' | 'FROZEN' | 'BANNED';

interface DashboardStats {
  users: number; tests: number; results: number;
}

interface LeaderboardEntry {
  id: string; user: string; region: string; score: number;
  timeTaken: number; violations: number; finalScore: number;
  status: UserStatus; telegramId: string; testTitle: string;
}

interface AuditLog {
  id: string; user: string; action: string; description: string; createdAt: string;
}

interface TestInfo {
  id: string; title: string; subject: string; description: string | null;
  startDate: string; endDate: string; timeLimitMs: number;
  _count: { questions: number; results: number };
}

interface QuestionInfo {
  id: string; content: string; type: string; mediaUrl: string | null; options: { id: string; text: string }[];
  correctOption: string; points: number; testId: string;
}

export default function AdminPanel() {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token') || '');
  const [isAuthed, setIsAuthed] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [tests, setTests] = useState<TestInfo[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ users: 0, tests: 0, results: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'tests' | 'questions'>('dashboard');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [uploadKey, setUploadKey] = useState(0); // For forcing file input reset
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Test form state
  const [testForm, setTestForm] = useState({
    title: '', subject: '', description: '',
    startDate: '', endDate: '', timeLimitMinutes: '30'
  });
  const [editingTestId, setEditingTestId] = useState<string | null>(null);

  // Question form state
  const [questions, setQuestions] = useState<QuestionInfo[]>([]);
  const [selectedTestForQuestions, setSelectedTestForQuestions] = useState<TestInfo | null>(null);
  const [questionForm, setQuestionForm] = useState<{
    type: string; content: string; mediaUrl: string; options: {id: string; text: string}[]; correctOption: string; points: number;
  }>({ type: 'RADIO', content: '', mediaUrl: '', options: [{id: 'A', text: ''}, {id: 'B', text: ''}, {id: 'C', text: ''}, {id: 'D', text: ''}], correctOption: 'A', points: 1 });
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const getAuthHeaders = useCallback(() => ({
    'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'
  }), [token]);

  const login = () => {
    localStorage.setItem('admin_token', token);
    setIsAuthed(true);
  };

  const fetchAll = useCallback(async () => {
    const headers = getAuthHeaders();
    try {
      const [lbRes, logsRes, testsRes, statsRes] = await Promise.all([
        fetch('/api/v1/admin/leaderboard', { headers }),
        fetch('/api/v1/admin/audit-logs', { headers }),
        fetch('/api/v1/admin/tests', { headers }),
        fetch('/api/v1/admin/stats', { headers })
      ]);
      if ([lbRes, logsRes, testsRes].some(r => r.status === 401 || r.status === 403)) {
        setIsAuthed(false); return;
      }
      setLeaderboard(await lbRes.json());
      setLogs(await logsRes.json());
      setTests(await testsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) { console.error("Admin fetch error", err); }
    finally { setIsLoading(false); }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (!isAuthed) return;
    setIsLoading(true);
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [isAuthed]);

  const changeUserStatus = async (telegramId: string, status: UserStatus) => {
    if (!confirm(`Change user to ${status}?`)) return;
    try {
      await fetch(`/api/v1/admin/user/${telegramId}/status`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ status })
      });
      setLeaderboard(prev => prev.map(u => u.telegramId === telegramId ? { ...u, status } : u));
    } catch { alert("Failed to update status"); }
  };

  const downloadExport = async () => {
    try {
      const res = await fetch('/api/v1/admin/export', { headers: getAuthHeaders() });
      if (!res.ok) { alert('Export failed'); return; }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'Ustoz_AI_Database_Export.csv';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch { alert('Export failed'); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTestId) { alert('Avval testni tanlang!'); return; }
    const formData = new FormData();
    formData.append('csvFile', file);
    formData.append('testId', selectedTestId);
    try {
      setIsImporting(true);
      const res = await fetch('/api/v1/admin/questions/import', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      alert(`✅ ${data.count} ta savol import qilindi!\n${data.errors?.length ? 'Xatoliklar:\n' + data.errors.join('\n') : ''}`);
      fetchAll();
    } catch (err: any) { alert(`Error: ${err.message}`); }
    finally { 
      setIsImporting(false); 
      setUploadKey(prev => prev + 1); // Force input remount
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/v1/upload', {
        method: 'POST', body: formData
      });
      if (!res.ok) throw new Error('Fayl yuklashda xatolik');
      const data = await res.json();
      setQuestionForm(prev => ({...prev, mediaUrl: data.url}));
    } catch (err: any) { alert(err.message); }
  };

  const saveTest = async () => {
    const body = {
      title: testForm.title, subject: testForm.subject, description: testForm.description || null,
      startDate: testForm.startDate, endDate: testForm.endDate,
      timeLimitMs: parseInt(testForm.timeLimitMinutes) * 60 * 1000
    };
    if (!body.title || !body.subject || !body.startDate || !body.endDate) {
      alert('Barcha maydonlarni to\'ldiring!'); return;
    }
    try {
      const url = editingTestId ? `/api/v1/admin/tests/${editingTestId}` : '/api/v1/admin/tests';
      const method = editingTestId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error);
      setTestForm({ title: '', subject: '', description: '', startDate: '', endDate: '', timeLimitMinutes: '30' });
      setEditingTestId(null);
      fetchAll();
    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  const deleteTest = async (id: string) => {
    if (!confirm('Bu testni o\'chirishni xohlaysizmi? Barcha savollar va natijalar ham o\'chadi!')) return;
    try {
      await fetch(`/api/v1/admin/tests/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      fetchAll();
    } catch { alert('Failed to delete test'); }
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setToken('');
    setIsAuthed(false);
  };

  const editTest = (t: TestInfo) => {
    setEditingTestId(t.id);
    setTestForm({
      title: t.title, subject: t.subject, description: t.description || '',
      startDate: t.startDate.slice(0, 16), endDate: t.endDate.slice(0, 16),
      timeLimitMinutes: String(t.timeLimitMs / 60000)
    });
    setActiveView('tests');
  };

  const fetchQuestions = async (testId: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/v1/admin/tests/${testId}/questions`, { headers: getAuthHeaders() });
      if (res.ok) setQuestions(await res.json());
    } catch { alert('Failed to fetch questions'); }
    finally { setIsLoading(false); }
  };

  const openQuestionsView = (t: TestInfo) => {
    setSelectedTestForQuestions(t);
    setActiveView('questions');
    fetchQuestions(t.id);
  };

  const saveQuestion = async () => {
    if (!selectedTestForQuestions) return;
    if (!questionForm.content) {
      alert('Savol matnini kiriting!'); return;
    }
    try {
      const url = editingQuestionId ? `/api/v1/admin/questions/${editingQuestionId}` : '/api/v1/admin/questions';
      const method = editingQuestionId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: getAuthHeaders(),
        body: JSON.stringify({ ...questionForm, testId: selectedTestForQuestions.id })
      });
      if (!res.ok) throw new Error('Saqlashda xatolik');
      setQuestionForm({ type: 'RADIO', content: '', mediaUrl: '', options: [{id: 'A', text: ''}, {id: 'B', text: ''}, {id: 'C', text: ''}, {id: 'D', text: ''}], correctOption: 'A', points: 1 });
      setEditingQuestionId(null);
      fetchQuestions(selectedTestForQuestions.id);
      fetchAll();
    } catch (err: any) { alert(err.message); }
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm("O'chirishni xohlaysizmi?")) return;
    try {
      await fetch(`/api/v1/admin/questions/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (selectedTestForQuestions) fetchQuestions(selectedTestForQuestions.id);
      fetchAll();
    } catch { alert('O\'chirishda xatolik'); }
  };

  const editQuestion = (q: QuestionInfo) => {
    setEditingQuestionId(q.id);
    setQuestionForm({ type: q.type || 'RADIO', content: q.content, mediaUrl: q.mediaUrl || '', options: q.options.map(o => ({...o})), correctOption: q.correctOption, points: q.points });
  };

  // Login screen
  if (!isAuthed) {
    return (
      <div className="flex h-screen items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
        <div className="mesh-bg opacity-30" />
        <div className="anime-bg-container">
          <img src="/wallpaper.png" className="anime-bg-image" alt="Background" />
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" />
        </div>
        <div className="glass-card w-full max-w-sm pop-in relative z-10 border-white/10 shadow-indigo-500/20">
          <div className="p-10 text-center border-b border-white/5 bg-white/5">
            <div className="icon-3d mx-auto mb-8 floating scale-125">
              <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full" />
              <svg className="w-16 h-16 text-indigo-400 relative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="hero-text text-3xl mb-2 italic">Control Core</h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Authorization Required</p>
          </div>
          <div className="p-10 flex flex-col gap-6">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 italic">Protocol Token</p>
              <input 
                type="password" 
                value={token} 
                onChange={e => setToken(e.target.value)}
                placeholder="••••••••••••" 
                onKeyDown={e => e.key === 'Enter' && login()}
                className="input-futuristic"
              />
            </div>
            <button onClick={login} className="btn-premium w-full shadow-indigo-500/20">
              <span className="relative z-10">Access Dashboard</span>
              <svg className="w-4 h-4 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--purple-light)', borderTopColor: 'var(--orange-main)' }} />
          <p className="font-bold text-sm" style={{ color: 'var(--text-muted)' }}>Synchronizing Mission Data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <div className="mesh-bg opacity-30" />
      <div className="anime-bg-container">
        <img src="/wallpaper.png" className="anime-bg-image" alt="Background" />
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
      </div>
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        <header className="glass px-8 py-6 flex justify-between items-center border-b border-white/5 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-2xl border-white/10 shadow-indigo-500/20">🛸</div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white italic uppercase leading-none">Control Core</h1>
              <p className="text-slate-500 text-[10px] font-black mt-1 uppercase tracking-[0.2em]">Secure Testing Protocol v4.0</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex glass p-1 rounded-2xl border-white/5">
              <button 
                onClick={() => setActiveView('dashboard')}
                className={`px-6 py-2.5 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all ${
                  activeView === 'dashboard' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40' : 'text-slate-400 hover:text-white'}`}
              >
                Analytics
              </button>
              <button 
                onClick={() => setActiveView('tests')}
                className={`px-6 py-2.5 font-black rounded-xl text-[10px] uppercase tracking-widest transition-all ${
                  activeView === 'tests' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40' : 'text-slate-400 hover:text-white'}`}
              >
                Manage Protocols
              </button>
            </div>
            
            <div className="h-10 w-[1px] bg-white/5 mx-2"></div>

            <div className="flex items-center gap-2">
              <select 
                value={selectedTestId} 
                onChange={e => setSelectedTestId(e.target.value)}
                className="input-futuristic py-2 px-4 text-[10px] w-48 font-black uppercase tracking-widest"
              >
                <option value="" className="bg-slate-900">Import Target</option>
                {tests.map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.title}</option>)}
              </select>

              <button 
                onClick={() => selectedTestId ? fileInputRef.current?.click() : alert('Select import target first!')}
                disabled={isImporting}
                className="btn-secondary py-2.5 px-6 text-[10px] uppercase font-black tracking-widest border-indigo-500/20"
              >
                {isImporting ? 'Syncing…' : 'Import CSV'}
              </button>
            </div>

            <button 
              onClick={logout}
              className="w-10 h-10 glass rounded-xl flex items-center justify-center text-rose-500 border-rose-500/20 hover:bg-rose-500/10 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
          <input key={uploadKey} type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
        </header>

        {activeView === 'tests' ? (
          <div className="flex-1 overflow-y-auto p-10">
            <div className="max-w-5xl mx-auto space-y-10">
              <div className="glass-card p-10 slide-up border-white/5 bg-white/5">
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-2xl border-white/10 shadow-indigo-500/20">✍️</div>
                  <h2 className="text-2xl font-black text-white italic uppercase tracking-tight">
                    {editingTestId ? 'Edit Exam Protocol' : 'Create New Test'}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 ml-1 italic">Test Title</label>
                    <input placeholder="Protocol Designation" value={testForm.title} onChange={e => setTestForm({...testForm, title: e.target.value})}
                      className="input-futuristic" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 ml-1 italic">Subject</label>
                    <input placeholder="e.g. Mathematics" value={testForm.subject} onChange={e => setTestForm({...testForm, subject: e.target.value})}
                      className="input-futuristic" />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 ml-1 italic">Description (Optional)</label>
                    <input placeholder="A brief overview for students" value={testForm.description} onChange={e => setTestForm({...testForm, description: e.target.value})}
                      className="input-futuristic" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 ml-1 italic">Starts At</label>
                    <input type="datetime-local" value={testForm.startDate} onChange={e => setTestForm({...testForm, startDate: e.target.value})}
                      className="input-futuristic" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 ml-1 italic">Ends At</label>
                    <input type="datetime-local" value={testForm.endDate} onChange={e => setTestForm({...testForm, endDate: e.target.value})}
                      className="input-futuristic" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 ml-1 italic">Time Limit (Minutes)</label>
                    <input type="number" value={testForm.timeLimitMinutes} onChange={e => setTestForm({...testForm, timeLimitMinutes: e.target.value})}
                      className="input-futuristic" />
                  </div>
                </div>
                
                <div className="flex gap-4 mt-12">
                  <button onClick={saveTest} className="btn-premium px-12">
                    <span className="relative z-10">{editingTestId ? '💾 Update Protocol' : '➕ Initialize Protocol'}</span>
                  </button>
                  {editingTestId && (
                    <button 
                      onClick={() => { setEditingTestId(null); setTestForm({ title: '', subject: '', description: '', startDate: '', endDate: '', timeLimitMinutes: '30' }); }}
                      className="btn-secondary px-8"
                    >
                      Abort
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black flex items-center gap-3" style={{ color: 'var(--text-head)' }}>
                    <span className="text-3xl">📋</span> Active Protocols
                  </h2>
                  <button onClick={() => { setIsLoading(true); fetchAll(); }} className="btn-ghost py-2.5 px-4 text-xs">Refresh 🔄</button>
                </div>
                
                {tests.length === 0 ? (
                  <div className="glass-card p-20 text-center border-white/5 bg-white/5">
                    <p className="text-5xl mb-6">📭</p>
                    <p className="font-black text-slate-500 uppercase tracking-widest text-sm">No protocols initialized.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {tests.map(t => {
                      const now = new Date();
                      const start = new Date(t.startDate);
                      const end = new Date(t.endDate);
                      const status = now < start ? 'upcoming' : now > end ? 'ended' : 'active';
                      const statusColor = status === 'active' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : status === 'upcoming' ? 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'bg-slate-700';
                      
                      return (
                        <div key={t.id} className="glass-card p-6 flex items-center gap-6 hover:border-white/20 transition-all cursor-default border-white/5 bg-white/5">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${statusColor} animate-pulse`}></div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-black text-lg text-white italic uppercase tracking-tight truncate">{t.title}</h3>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-400/10 px-3 py-1 rounded-lg border border-indigo-400/20">{t.subject}</span>
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">⏱ {t.timeLimitMs / 60000}M</span>
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">🧩 {t._count.questions} PHASES</span>
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">📊 {t._count.results} LOGS</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => openQuestionsView(t)} className="btn-secondary py-2 px-5 text-[10px]">SAVOLLAR</button>
                            <button onClick={() => editTest(t)} className="btn-secondary py-2 px-5 text-[10px]">EDIT</button>
                            <button onClick={() => deleteTest(t.id)} className="px-5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-black rounded-2xl text-[10px] transition-all border border-rose-500/20">DELETE</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeView === 'questions' && selectedTestForQuestions ? (
          <div className="flex-1 overflow-y-auto p-10">
            <div className="max-w-5xl mx-auto space-y-8">
              <button onClick={() => setActiveView('tests')} className="btn-ghost py-2 px-4 text-xs mb-2 flex items-center gap-2">
                ← Back to Tests
              </button>
              
              <div className="glass-card p-10 slide-up border-white/5 bg-white/5">
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-2xl border-white/10 shadow-indigo-500/20">❓</div>
                  <h2 className="text-2xl font-black text-white italic uppercase tracking-tight">
                    {editingQuestionId ? 'Modify Data Phase' : 'Initialize New Phase'}
                  </h2>
                </div>

                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 ml-1 italic">Phase Type</label>
                      <select value={questionForm.type} onChange={e => {
                        const newType = e.target.value;
                        let newCorrect = questionForm.correctOption;
                        if (newType === 'TRUE_FALSE') newCorrect = 'TRUE';
                        else if (newType === 'RADIO') newCorrect = 'A';
                        else newCorrect = '';
                        setQuestionForm({...questionForm, type: newType, correctOption: newCorrect});
                      }}
                        className="input-futuristic"
                      >
                        <option value="RADIO" className="bg-slate-900">Multiple Choice (A-D)</option>
                        <option value="TRUE_FALSE" className="bg-slate-900">True / False</option>
                        <option value="TEXT" className="bg-slate-900">Short Text Answer</option>
                        <option value="RANGE" className="bg-slate-900">Range / Slider</option>
                        <option value="VOICE" className="bg-slate-900">Voice Submission</option>
                        <option value="DRAWING" className="bg-slate-900">Drawing / Canvas</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 ml-1 italic">Media Attachment</label>
                      <div className="relative">
                        <input type="file" accept="image/*,video/*,audio/*" onChange={handleMediaUpload}
                          className="w-full h-14 opacity-0 absolute inset-0 cursor-pointer z-10" />
                        <div className="input-futuristic flex items-center justify-between pointer-events-none">
                          <span className="text-slate-500 italic text-xs">Choose File…</span>
                          <span className="text-[10px] font-black uppercase tracking-widest bg-white/5 px-3 py-1 rounded-lg">Upload</span>
                        </div>
                      </div>
                      {questionForm.mediaUrl && <p className="text-[10px] text-emerald-500 font-black truncate mt-2 italic">✓ DATA_LINK: {questionForm.mediaUrl}</p>}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 ml-1 italic">Question Content (Markdown Supported)</label>
                    <textarea placeholder="Ask something brilliant…" value={questionForm.content} onChange={e => setQuestionForm({...questionForm, content: e.target.value})}
                      className="input-futuristic min-h-[140px] resize-none"
                    />
                  </div>
                  
                  {questionForm.type === 'RADIO' && (
                    <div className="grid grid-cols-2 gap-6">
                      {questionForm.options.slice(0, 4).map((opt, i) => (
                        <div key={opt.id} className="flex items-center gap-4">
                          <span className="w-12 h-12 rounded-[1.2rem] bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-black border border-indigo-500/20">{opt.id}</span>
                          <input placeholder={`Option ${opt.id} text…`} value={opt.text} onChange={e => {
                            const newOpts = questionForm.options.map((o, idx) => 
                              idx === i ? { ...o, text: e.target.value } : o
                            );
                            setQuestionForm({...questionForm, options: newOpts});
                          }} className="input-futuristic flex-1" />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 ml-1 italic">Correct Identifier</label>
                      {questionForm.type === 'RADIO' ? (
                        <select value={questionForm.correctOption} onChange={e => setQuestionForm({...questionForm, correctOption: e.target.value})}
                          className="input-futuristic font-black italic">
                          {questionForm.options.slice(0, 4).map(o => <option key={o.id} value={o.id} className="bg-slate-900">{o.id}</option>)}
                        </select>
                      ) : questionForm.type === 'TRUE_FALSE' ? (
                        <select value={questionForm.correctOption} onChange={e => setQuestionForm({...questionForm, correctOption: e.target.value})}
                          className="input-futuristic font-black italic">
                          <option value="TRUE" className="bg-slate-900">True</option>
                          <option value="FALSE" className="bg-slate-900">False</option>
                        </select>
                      ) : (questionForm.type === 'VOICE' || questionForm.type === 'DRAWING') ? (
                        <div className="w-full px-6 py-4 rounded-2xl bg-indigo-500/5 text-indigo-400 font-black text-xs flex items-center gap-3 border border-indigo-500/20 italic">
                          <span className="text-xl">🛡️</span> Manual Evaluation Required
                        </div>
                      ) : (
                        <input placeholder="Exact expected answer" value={questionForm.correctOption} onChange={e => setQuestionForm({...questionForm, correctOption: e.target.value})}
                          className="input-futuristic font-black italic" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 ml-1 italic">Point Yield</label>
                      <input type="number" value={questionForm.points} onChange={e => setQuestionForm({...questionForm, points: parseInt(e.target.value) || 1})}
                        className="input-futuristic font-black italic" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-12">
                  <button onClick={saveQuestion} className="btn-premium px-12">
                    <span className="relative z-10">{editingQuestionId ? '💾 Commit Changes' : '➕ Save Phase'}</span>
                  </button>
                  {editingQuestionId && (
                    <button onClick={() => { setEditingQuestionId(null); setQuestionForm({ type: 'RADIO', content: '', mediaUrl: '', options: [{id: 'A', text: ''}, {id: 'B', text: ''}, {id: 'C', text: ''}, {id: 'D', text: ''}], correctOption: 'A', points: 1 }); }}
                      className="btn-secondary px-8">Abort</button>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black text-white italic uppercase tracking-tight flex items-center gap-4">
                    <div className="w-10 h-10 glass rounded-xl flex items-center justify-center text-xl border-white/10">🧩</div>
                    Phases for {selectedTestForQuestions.title}
                  </h2>
                  <div className="h-[1px] flex-1 mx-6 bg-white/5" />
                </div>
                
                {questions.length === 0 ? (
                  <div className="glass-card p-20 text-center border-white/5 bg-white/5">
                    <p className="text-4xl mb-4">🧩</p>
                    <p className="font-black text-slate-500 uppercase tracking-widest text-sm italic">Protocol stream empty.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="glass-card flex-col items-start gap-6 p-8 hover:border-white/20 transition-all border-white/5 bg-white/5">
                        <div className="flex justify-between w-full items-start">
                          <div className="flex items-center gap-4">
                            <span className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-black text-sm italic shadow-lg shadow-indigo-500/20">{idx + 1}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-400/10 px-3 py-1 rounded-lg border border-indigo-400/20">{q.type}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-400/10 px-3 py-1 rounded-lg border border-indigo-400/20">{q.points} PTS</span>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => editQuestion(q)} className="btn-secondary py-2 px-6 text-[10px]">EDIT</button>
                            <button onClick={() => deleteQuestion(q.id)} className="px-6 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-black rounded-2xl text-[10px] transition-all border border-rose-500/20">DELETE</button>
                          </div>
                        </div>
                        
                        <p className="font-black text-xl text-white italic leading-relaxed tracking-tight">{q.content}</p>
                        
                        {q.mediaUrl && (
                          <div className="w-full max-w-sm rounded-[2rem] overflow-hidden glass p-2 border-white/5">
                             <img src={q.mediaUrl} alt="Media" className="w-full h-auto rounded-[1.5rem]" />
                          </div>
                        )}

                        {q.type === 'RADIO' && (
                          <div className="grid grid-cols-2 gap-4 w-full">
                            {q.options.slice(0,4).map(o => (
                              <div key={o.id} className={`p-5 rounded-2xl border-2 flex items-center gap-4 transition-all ${o.id === q.correctOption ? 'bg-indigo-500/10 border-indigo-500/50 shadow-lg shadow-indigo-500/10' : 'bg-white/5 border-white/5'}`}>
                                <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${o.id === q.correctOption ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-500'}`}>{o.id}</span>
                                <span className={`text-sm font-bold ${o.id === q.correctOption ? 'text-indigo-400 italic' : 'text-slate-400'}`}>{o.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* DASHBOARD VIEW */
          <div className="flex-1 overflow-y-auto p-10 flex flex-col gap-10">
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-8 slide-up">
              {[
                { label: 'Active Personnel', value: stats.users, icon: '👥', color: 'indigo' },
                { label: 'Exam Protocols', value: stats.tests, icon: '📝', color: 'purple' },
                { label: 'Data Packets', value: stats.results, icon: '📈', color: 'emerald' },
              ].map((s, i) => (
                <div key={i} className="glass-card p-8 border-white/5 flex flex-col gap-6 group hover:border-white/20">
                  <div className={`w-14 h-14 glass rounded-2xl flex items-center justify-center text-3xl shadow-inner border-white/10 group-hover:scale-110 transition-transform`}>
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-4xl font-black text-white italic tracking-tighter">{s.value}</p>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-10 flex-1 min-h-0">
              <div className="flex-[3] glass-card flex flex-col min-h-0 slide-up border-white/5" style={{ animationDelay: '0.1s' }}>
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                  <div>
                    <h2 className="text-xl font-black text-white italic uppercase tracking-tight">Security Telemetry</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Live Feed • Synchronization Active</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={downloadExport} className="btn-secondary py-2 px-6 text-[10px] uppercase font-black tracking-widest">Generate Report</button>
                  </div>
                </div>
                
                <div className="overflow-auto flex-1 custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 glass border-b border-white/5">
                      <tr className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">
                        <th className="px-8 py-6">ID</th>
                        <th className="px-8 py-6">Subject</th>
                        <th className="px-8 py-6">Intelligence</th>
                        <th className="px-8 py-6">Stability</th>
                        <th className="px-8 py-6">Anomalies</th>
                        <th className="px-8 py-6">Status</th>
                        <th className="px-8 py-6 text-right">Directives</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {leaderboard.length === 0 ? (
                        <tr><td colSpan={7} className="px-8 py-20 text-center text-slate-600 font-bold italic uppercase tracking-widest">Waiting for synchronization…</td></tr>
                      ) : leaderboard.map((entry, index) => (
                        <tr key={entry.id} className="hover:bg-white/5 transition-all group">
                          <td className="px-8 py-6 font-black text-slate-600 text-xs">#{index + 1}</td>
                          <td className="px-8 py-6">
                            <p className="font-bold text-white text-sm">{entry.user}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{entry.region}</p>
                          </td>
                          <td className="px-8 py-6">
                             <span className="text-2xl font-black text-indigo-400 italic">{entry.finalScore}</span>
                             <span className="text-[10px] font-bold text-slate-600 ml-1">XP</span>
                          </td>
                          <td className="px-8 py-6 text-xs font-bold text-slate-400">
                             <div className="flex items-center gap-2">
                               <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                 <div className="h-full bg-indigo-500" style={{ width: `${entry.score}%` }} />
                               </div>
                               <span>{entry.score}%</span>
                             </div>
                          </td>
                          <td className="px-8 py-6">
                            {entry.violations > 0 ? (
                              <span className="px-3 py-1 bg-rose-500/20 text-rose-500 font-black rounded-lg text-[10px] border border-rose-500/30">{entry.violations} DETECTED</span>
                            ) : <span className="text-slate-700 text-xs">—</span>}
                          </td>
                          <td className="px-8 py-6">
                            <span className={`px-3 py-1 font-black rounded-lg text-[9px] uppercase border ${
                              entry.status === 'BANNED' ? 'bg-rose-500 text-white border-transparent' :
                              entry.status === 'FROZEN' ? 'bg-sky-500 text-white border-transparent' :
                              'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'}`}>{entry.status}</span>
                          </td>
                          <td className="px-8 py-6 text-right opacity-0 group-hover:opacity-100 transition-all">
                            <div className="flex justify-end gap-2">
                               <button onClick={() => changeUserStatus(entry.telegramId, 'ACTIVE')} className="w-8 h-8 glass rounded-lg flex items-center justify-center text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10">✓</button>
                               <button onClick={() => changeUserStatus(entry.telegramId, 'FROZEN')} className="w-8 h-8 glass rounded-lg flex items-center justify-center text-sky-500 border-sky-500/20 hover:bg-sky-500/10">❄</button>
                               <button onClick={() => changeUserStatus(entry.telegramId, 'BANNED')} className="w-8 h-8 glass rounded-lg flex items-center justify-center text-rose-500 border-rose-500/20 hover:bg-rose-500/10">×</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex-[1] glass-card flex flex-col min-h-0 bg-white/5 border-white/5 slide-up" style={{ animationDelay: '0.2s' }}>
                <div className="p-8 border-b border-white/5">
                   <h2 className="text-lg font-black text-white italic uppercase flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                     Security Log
                   </h2>
                   <p className="text-[10px] font-black text-slate-500 mt-1 uppercase tracking-widest">Autonomous Detection</p>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {logs.map(log => (
                    <div key={log.id} className="p-5 rounded-2xl glass border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-bold text-xs text-white uppercase italic">{log.user}</span>
                        <span className="text-[9px] font-bold text-slate-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[9px] font-black text-indigo-400 bg-indigo-400/10 w-fit px-2 py-0.5 rounded-md uppercase tracking-widest mb-3">
                        {log.action}
                      </p>
                      <p className="text-[11px] text-slate-400 leading-relaxed font-medium">{log.description}</p>
                    </div>
                  ))}
                  {logs.length === 0 && <p className="text-center text-slate-600 font-bold py-10 italic uppercase text-[10px] tracking-widest">Log stream empty…</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
