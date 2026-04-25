import { useState, useRef } from 'react';
import { motion } from 'framer-motion';

export default function VoiceRecorder({ onSave }: { onSave: (url: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone ruxsati berilmadi!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
  };

  const saveAudio = async () => {
    if (!audioChunksRef.current.length) return;
    setIsUploading(true);
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', audioBlob, `voice-${Date.now()}.webm`);
    
    try {
      const res = await fetch('/api/v1/upload', {
        method: 'POST', body: formData
      });
      const data = await res.json();
      onSave(data.url);
    } catch (err) {
      alert('Failed to upload audio');
    } finally {
      setIsUploading(false);
    }
  };

  const discardAudio = () => {
    setAudioUrl(null);
    audioChunksRef.current = [];
  };

  return (
    <div className="flex flex-col items-center gap-8 py-6">
      {!audioUrl ? (
        <div className="flex flex-col items-center gap-6">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-32 h-32 glass rounded-full flex items-center justify-center border-4 shadow-2xl transition-all relative group ${
              isRecording ? 'border-rose-500/50 text-rose-500' : 'border-indigo-500/30 text-indigo-400'
            }`}
          >
            {isRecording && (
              <div className="absolute inset-0 bg-rose-500/10 rounded-full animate-ping" />
            )}
            {isRecording ? (
              <svg className="w-12 h-12 relative z-10" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
            ) : (
              <svg className="w-12 h-12 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
            )}
          </motion.button>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
            {isRecording ? "SIGNAL DETECTED — LOGGING…" : "Tap to Initialize Voice Link"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col w-full gap-8">
          <div className="glass p-4 rounded-3xl border-white/5">
            <audio src={audioUrl} controls className="w-full h-10" />
          </div>
          <div className="flex gap-4">
            <button onClick={discardAudio} className="btn-secondary flex-1 py-4 uppercase tracking-widest text-[10px] font-black">Reset Feed</button>
            <button onClick={saveAudio} disabled={isUploading} className="btn-premium flex-1 shadow-indigo-500/20">
              <span className="relative z-10">{isUploading ? 'SYNCING…' : 'AUTHORIZE'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
