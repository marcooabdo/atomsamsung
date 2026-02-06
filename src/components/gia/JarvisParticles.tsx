import { useRef, useEffect, useCallback } from 'react';

interface JarvisParticlesProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
  angle: number;
  speed: number;
  orbit: number;
  orbitSpeed: number;
  layer: number;
}

export function JarvisParticles({ state }: JarvisParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef(0);
  const timeRef = useRef(0);
  const stateRef = useRef(state);

  stateRef.current = state;

  const createParticle = useCallback((cx: number, cy: number, layer: number): Particle => {
    const angle = Math.random() * Math.PI * 2;
    const isActive = stateRef.current !== 'idle';
    const baseOrbit = layer === 0 ? 30 + Math.random() * 40 : layer === 1 ? 70 + Math.random() * 50 : 120 + Math.random() * 60;
    const orbit = isActive ? baseOrbit * (1 + Math.random() * 0.5) : baseOrbit * 0.7;

    return {
      x: cx + Math.cos(angle) * orbit,
      y: cy + Math.sin(angle) * orbit,
      vx: 0,
      vy: 0,
      size: layer === 0 ? 1.5 + Math.random() * 1.5 : layer === 1 ? 1 + Math.random() * 1.2 : 0.5 + Math.random() * 1,
      opacity: 0.3 + Math.random() * 0.7,
      life: Math.random() * 200,
      maxLife: 150 + Math.random() * 150,
      angle,
      speed: (0.002 + Math.random() * 0.005) * (layer === 0 ? 1 : layer === 1 ? 0.7 : 0.4),
      orbit,
      orbitSpeed: 0.001 + Math.random() * 0.003,
      layer,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const particleCount = 180;
    particlesRef.current = [];
    for (let i = 0; i < particleCount; i++) {
      const layer = i < 50 ? 0 : i < 110 ? 1 : 2;
      particlesRef.current.push(createParticle(cx, cy, layer));
    }

    let animId: number;

    const animate = () => {
      timeRef.current += 1;
      const t = timeRef.current;
      const currentState = stateRef.current;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const centerX = w / 2;
      const centerY = h / 2;

      ctx.clearRect(0, 0, w, h);

      const isSpeaking = currentState === 'speaking';
      const isThinking = currentState === 'thinking';
      const isListening = currentState === 'listening';
      const isIdle = currentState === 'idle';

      const pulseBase = isSpeaking ? 1.3 : isThinking ? 1.1 : isListening ? 1.15 : 1;
      const pulseAmplitude = isSpeaking ? 0.25 : isThinking ? 0.12 : isListening ? 0.15 : 0.05;
      const pulseFreq = isSpeaking ? 0.06 : isThinking ? 0.03 : 0.04;
      const globalPulse = pulseBase + Math.sin(t * pulseFreq) * pulseAmplitude;

      const glowRadius = isSpeaking ? 80 : isThinking ? 60 : isListening ? 70 : 35;
      const glowGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius * globalPulse);
      glowGrad.addColorStop(0, `rgba(180, 220, 255, ${isSpeaking ? 0.08 : 0.03})`);
      glowGrad.addColorStop(0.5, `rgba(120, 180, 255, ${isSpeaking ? 0.04 : 0.015})`);
      glowGrad.addColorStop(1, 'rgba(100, 160, 255, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, w, h);

      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        const speedMult = isSpeaking ? 3 : isThinking ? 1.8 : isListening ? 2 : 1;
        p.angle += p.speed * speedMult;

        const orbitPulse = p.orbit * globalPulse;
        const wobble = isSpeaking
          ? Math.sin(t * 0.08 + p.angle * 3) * 15
          : isThinking
            ? Math.sin(t * 0.04 + p.angle * 2) * 8
            : Math.sin(t * 0.02 + p.angle) * 3;

        const targetX = centerX + Math.cos(p.angle) * (orbitPulse + wobble);
        const targetY = centerY + Math.sin(p.angle) * (orbitPulse + wobble) * 0.85;

        const lerp = isIdle ? 0.02 : 0.05;
        p.x += (targetX - p.x) * lerp;
        p.y += (targetY - p.y) * lerp;

        p.life += 1;
        const lifeRatio = p.life / p.maxLife;
        const fadeIn = Math.min(lifeRatio * 5, 1);
        const fadeOut = lifeRatio > 0.8 ? 1 - (lifeRatio - 0.8) / 0.2 : 1;

        const twinkle = isSpeaking
          ? 0.5 + Math.sin(t * 0.1 + i * 0.5) * 0.5
          : 0.7 + Math.sin(t * 0.05 + i * 0.3) * 0.3;

        const alpha = p.opacity * fadeIn * fadeOut * twinkle * (isIdle ? 0.5 : 1);

        if (alpha <= 0) {
          particles[i] = createParticle(centerX, centerY, p.layer);
          continue;
        }

        if (p.life > p.maxLife) {
          particles[i] = createParticle(centerX, centerY, p.layer);
          continue;
        }

        const sizeMultiplier = isSpeaking ? 1.3 + Math.sin(t * 0.1 + i) * 0.3 : 1;
        const drawSize = p.size * sizeMultiplier;

        if (p.layer === 0 && !isIdle) {
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, drawSize * 4);
          glow.addColorStop(0, `rgba(200, 230, 255, ${alpha * 0.3})`);
          glow.addColorStop(1, 'rgba(200, 230, 255, 0)');
          ctx.fillStyle = glow;
          ctx.fillRect(p.x - drawSize * 4, p.y - drawSize * 4, drawSize * 8, drawSize * 8);
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, drawSize, 0, Math.PI * 2);
        ctx.fillStyle = p.layer === 0
          ? `rgba(230, 245, 255, ${alpha})`
          : p.layer === 1
            ? `rgba(200, 220, 240, ${alpha * 0.8})`
            : `rgba(170, 195, 220, ${alpha * 0.6})`;
        ctx.fill();
      }

      if (!isIdle) {
        const connDist = isSpeaking ? 60 : 45;
        ctx.lineWidth = 0.3;
        for (let i = 0; i < particles.length; i++) {
          if (particles[i].layer > 1) continue;
          for (let j = i + 1; j < particles.length; j++) {
            if (particles[j].layer > 1) continue;
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < connDist) {
              const lineAlpha = (1 - dist / connDist) * 0.15;
              ctx.strokeStyle = `rgba(180, 210, 240, ${lineAlpha})`;
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [createParticle]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  );
}
