import React, { useRef, useState, useEffect } from 'react';

export default function DrawingCanvas({ onSave }: { onSave: (url: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#020617'; // Slate 950
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#6366F1'; // Indigo 500
      }
    }
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const endDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext('2d')?.beginPath();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    ctx.lineTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.strokeStyle = '#6366F1';
    }
  };

  const saveDrawing = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsUploading(true);
    canvas.toBlob(async (blob) => {
      if (!blob) return setIsUploading(false);
      
      const formData = new FormData();
      formData.append('file', blob, `drawing-${Date.now()}.png`);
      
      try {
        const res = await fetch('/api/v1/upload', {
          method: 'POST', body: formData
        });
        const data = await res.json();
        onSave(data.url);
      } catch (err) {
        alert('Failed to upload drawing');
      } finally {
        setIsUploading(false);
      }
    });
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full glass p-3 rounded-[2.5rem] border-white/5">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="w-full h-auto bg-slate-950 rounded-[2rem] touch-none shadow-inner"
          onMouseDown={startDrawing}
          onMouseUp={endDrawing}
          onMouseMove={draw}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchEnd={endDrawing}
          onTouchMove={draw}
        />
      </div>
      <div className="flex gap-4 w-full">
        <button onClick={clearCanvas} className="btn-secondary flex-1 py-4 uppercase tracking-widest text-[10px] font-black">Reset Core</button>
        <button onClick={saveDrawing} disabled={isUploading} className="btn-premium flex-1 shadow-indigo-500/20">
          <span className="relative z-10">{isUploading ? 'SYNCING…' : 'AUTHORIZE'}</span>
        </button>
      </div>
    </div>
  );
}
