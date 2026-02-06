import { motion } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';

interface AudioVisualizerProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
}

interface BlobConfig {
  id: number;
  baseSize: number;
  x: number;
  y: number;
  delay: number;
  color: string;
}

export function AudioVisualizer({ state }: AudioVisualizerProps) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (state === 'idle') return;
    const interval = setInterval(() => {
      setPulse(Math.random());
    }, state === 'speaking' ? 120 : state === 'thinking' ? 300 : 200);
    return () => clearInterval(interval);
  }, [state]);

  const blobs: BlobConfig[] = useMemo(() => [
    { id: 0, baseSize: 80, x: 0, y: 0, delay: 0, color: 'rgba(0, 210, 255, 0.6)' },
    { id: 1, baseSize: 55, x: -40, y: -30, delay: 0.15, color: 'rgba(0, 255, 230, 0.45)' },
    { id: 2, baseSize: 55, x: 40, y: -25, delay: 0.3, color: 'rgba(0, 180, 255, 0.45)' },
    { id: 3, baseSize: 45, x: -25, y: 35, delay: 0.45, color: 'rgba(0, 240, 210, 0.35)' },
    { id: 4, baseSize: 45, x: 30, y: 30, delay: 0.6, color: 'rgba(0, 200, 255, 0.35)' },
    { id: 5, baseSize: 30, x: -55, y: 5, delay: 0.2, color: 'rgba(0, 255, 255, 0.25)' },
    { id: 6, baseSize: 30, x: 55, y: 0, delay: 0.35, color: 'rgba(0, 190, 255, 0.25)' },
  ], []);

  const getAnimationForBlob = (blob: BlobConfig) => {
    const intensity = state === 'speaking' ? 1.4 : state === 'thinking' ? 0.8 : state === 'listening' ? 1.1 : 0.3;
    const speed = state === 'speaking' ? 0.8 : state === 'thinking' ? 2.5 : state === 'listening' ? 1.2 : 4;

    const scaleBase = state === 'idle' ? 0.85 : 1;
    const scaleRange = 0.3 * intensity;
    const moveRange = state === 'speaking' ? 15 : state === 'thinking' ? 8 : 5;

    return {
      animate: {
        scale: [
          scaleBase,
          scaleBase + scaleRange * (0.5 + pulse * 0.5),
          scaleBase + scaleRange * 0.3,
          scaleBase + scaleRange * (0.7 + pulse * 0.3),
          scaleBase,
        ],
        x: blob.x + Math.sin(pulse * Math.PI * 2 + blob.delay * 10) * moveRange,
        y: blob.y + Math.cos(pulse * Math.PI * 2 + blob.delay * 8) * moveRange,
        opacity: state === 'idle' ? 0.4 : 0.8 + pulse * 0.2,
      },
      transition: {
        duration: speed,
        repeat: Infinity,
        repeatType: 'reverse' as const,
        ease: 'easeInOut' as const,
        delay: blob.delay,
      },
    };
  };

  const containerGlow = state === 'speaking'
    ? '0 0 120px rgba(0, 210, 255, 0.25), 0 0 240px rgba(0, 210, 255, 0.1)'
    : state === 'thinking'
      ? '0 0 80px rgba(0, 210, 255, 0.15), 0 0 160px rgba(0, 210, 255, 0.05)'
      : state === 'listening'
        ? '0 0 100px rgba(0, 255, 200, 0.2), 0 0 200px rgba(0, 255, 200, 0.08)'
        : '0 0 40px rgba(0, 210, 255, 0.08)';

  const ringScale = state === 'speaking' ? [1, 1.15, 1] : state === 'thinking' ? [1, 1.08, 1] : state === 'listening' ? [1, 1.12, 1] : [1, 1.03, 1];
  const ringSpeed = state === 'speaking' ? 1.5 : state === 'thinking' ? 3 : 2;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 320, height: 320 }}>
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 280,
          height: 280,
          border: '1px solid rgba(0, 210, 255, 0.08)',
          boxShadow: containerGlow,
        }}
        animate={{ scale: ringScale, rotate: [0, 5, -5, 0] }}
        transition={{ duration: ringSpeed * 2, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute rounded-full"
        style={{
          width: 220,
          height: 220,
          border: '1px solid rgba(0, 210, 255, 0.05)',
        }}
        animate={{ scale: ringScale.map(s => s * 0.98), rotate: [0, -3, 3, 0] }}
        transition={{ duration: ringSpeed * 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
      />

      {state !== 'idle' && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={`ring-pulse-${i}`}
              className="absolute rounded-full"
              style={{
                width: 200,
                height: 200,
                border: '1px solid rgba(0, 210, 255, 0.15)',
              }}
              initial={{ scale: 0.8, opacity: 0.6 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 1,
                ease: 'easeOut',
              }}
            />
          ))}
        </>
      )}

      <div className="relative" style={{ width: 200, height: 200 }}>
        <svg className="absolute inset-0 w-full h-full" style={{ filter: 'blur(40px)' }}>
          <defs>
            <radialGradient id="blob-glow">
              <stop offset="0%" stopColor="rgba(0, 210, 255, 0.3)" />
              <stop offset="100%" stopColor="rgba(0, 210, 255, 0)" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="60" fill="url(#blob-glow)" />
        </svg>

        {blobs.map((blob) => {
          const anim = getAnimationForBlob(blob);
          return (
            <motion.div
              key={blob.id}
              className="absolute rounded-full"
              style={{
                width: blob.baseSize,
                height: blob.baseSize,
                left: '50%',
                top: '50%',
                marginLeft: -blob.baseSize / 2,
                marginTop: -blob.baseSize / 2,
                background: `radial-gradient(circle at 35% 35%, ${blob.color}, rgba(0, 100, 180, 0.1))`,
                boxShadow: `0 0 ${blob.baseSize / 2}px ${blob.color}`,
                filter: 'blur(1px)',
              }}
              animate={anim.animate}
              transition={anim.transition}
            />
          );
        })}

        <motion.div
          className="absolute rounded-full"
          style={{
            width: 20,
            height: 20,
            left: '50%',
            top: '50%',
            marginLeft: -10,
            marginTop: -10,
            background: 'radial-gradient(circle, rgba(255,255,255,0.9), rgba(0, 210, 255, 0.6))',
            boxShadow: '0 0 20px rgba(255,255,255,0.5), 0 0 40px rgba(0, 210, 255, 0.3)',
          }}
          animate={{
            scale: state === 'idle' ? [1, 1.1, 1] : [1, 1.3, 1],
            opacity: [0.8, 1, 0.8],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="absolute bottom-4 flex items-center gap-2">
        <motion.div
          className="w-2 h-2 rounded-full"
          style={{
            background: state === 'idle' ? '#4a5568' : state === 'listening' ? '#00ffcc' : '#00d2ff',
            boxShadow: state === 'idle' ? 'none' : `0 0 8px ${state === 'listening' ? '#00ffcc' : '#00d2ff'}`,
          }}
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span className="text-[11px] tracking-widest uppercase font-medium" style={{
          color: state === 'idle' ? '#4a5568' : '#00d2ff',
          textShadow: state === 'idle' ? 'none' : '0 0 10px rgba(0, 210, 255, 0.5)',
        }}>
          {state === 'idle' && 'Aguardando'}
          {state === 'listening' && 'Ouvindo...'}
          {state === 'thinking' && 'Processando...'}
          {state === 'speaking' && 'Respondendo...'}
        </span>
      </div>
    </div>
  );
}
