'use client';

import { useRef, useEffect, useState } from 'react';

interface WaveformProps {
  assetId?: string;
  color: string;
  currentTime: number;
  isPlaying: boolean;
  stemType: string;
  audioDuration?: number;
}

export function Waveform({ assetId, color, currentTime, isPlaying, stemType, audioDuration }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 60 });
  const [waveformData, setWaveformData] = useState<number[] | null>(null);
  const [waveformDuration, setWaveformDuration] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) return;
    
    setIsLoading(true);
    setError(null);
    setWaveformDuration(null);
    
    const fetchWaveform = async () => {
      try {
        const response = await fetch(`/api/v1/assets/${assetId}/waveform`);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Waveform fetch error:', response.status, errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        const data = await response.json();
        setWaveformData(data.peaks || null);
        if (data.duration) {
          setWaveformDuration(data.duration);
        }
      } catch (err) {
        console.error('Failed to fetch waveform:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setWaveformData(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchWaveform();
  }, [assetId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      setCanvasSize({
        width: rect.width,
        height: rect.height || 60,
      });
    };

    updateCanvasSize();

    const observer = new ResizeObserver(() => {
      updateCanvasSize();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const { width, height } = canvasSize;
    if (!canvas || width <= 0 || height <= 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    const effectiveDuration = audioDuration || waveformDuration || 0;
    const clampedTime = Math.min(currentTime, effectiveDuration);
    const progress = effectiveDuration > 0 ? (clampedTime / effectiveDuration) * 100 : 0;
    const progressX = (Math.min(progress, 100) / 100) * width;
    
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      if (waveformData && waveformData.length > 0) {
        const gap = 1;
        const availableBars = Math.max(1, Math.floor(width / 3));
        const barCount = Math.max(1, Math.min(waveformData.length, availableBars));
        const barWidth = width / barCount;
        
        for (let i = 0; i < barCount; i++) {
          const x = i * barWidth;
          const isPlayed = x < progressX;
          const samplePosition = barCount === 1 ? 0 : (i / (barCount - 1)) * (waveformData.length - 1);
          const lowerIndex = Math.floor(samplePosition);
          const upperIndex = Math.min(waveformData.length - 1, Math.ceil(samplePosition));
          const interpolationFactor = samplePosition - lowerIndex;
          const lowerValue = Math.abs(waveformData[lowerIndex] ?? 0);
          const upperValue = Math.abs(waveformData[upperIndex] ?? lowerValue);
          const avgAmplitude = lowerValue + (upperValue - lowerValue) * interpolationFactor;
          const barHeight = Math.max(4, avgAmplitude * height * 0.9);
          
          ctx.fillStyle = isPlayed ? color : '#9ca3af';
          ctx.fillRect(x, (height - barHeight) / 2, Math.max(1, barWidth - gap), barHeight);
        }
      } else {
        const seed = stemType.charCodeAt(0) + stemType.charCodeAt(stemType.length - 1);
        const barCount = Math.max(1, Math.floor(width / 4));
        const barWidth = width / barCount;
        
        for (let i = 0; i < barCount; i++) {
          const x = i * barWidth;
          const isPlayed = x < progressX;
          
          const noise = Math.sin(i * 0.3 + seed) * 0.3 + Math.sin(i * 0.7 + seed * 2) * 0.2 + Math.sin(i * 1.5 + seed * 0.5) * 0.5;
          const barHeight = Math.max(4, (Math.abs(noise) + 0.2) * height * 0.8);
          
          ctx.fillStyle = isPlayed ? color : '#d1d5db';
          ctx.fillRect(x, (height - barHeight) / 2, Math.max(1, barWidth - 1), barHeight);
        }
      }
    };
    
    draw();
    
    if (isPlaying) {
      const animate = () => { draw(); animationRef.current = requestAnimationFrame(animate); };
      animationRef.current = requestAnimationFrame(animate);
    }
    
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [canvasSize, currentTime, waveformDuration, audioDuration, color, isPlaying, stemType, waveformData]);
  
  return (
    <div ref={containerRef} className="w-full h-full rounded flex items-center justify-center" style={{ minHeight: '60px', height: '60px' }}>
      {isLoading ? (
        <div className="text-[10px] text-gray-400">...</div>
      ) : error ? (
        <div className="text-[10px] text-red-400" title={error}>No</div>
      ) : (
        <canvas 
          ref={canvasRef} 
          className="w-full h-full rounded" 
          style={{ display: 'block', minHeight: '60px', height: '60px' }} 
        />
      )}
    </div>
  );
}
