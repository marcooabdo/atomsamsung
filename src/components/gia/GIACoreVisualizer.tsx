import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface GIACoreVisualizerProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  mode: 'voice' | 'text';
  compact?: boolean;
}

interface OrbConfig {
  id: number;
  baseX: number;
  baseY: number;
  size: number;
  opacity: number;
  layer: number;
}

export function GIACoreVisualizer({ state, compact }: GIACoreVisualizerProps) {
  const orbs = useMemo<OrbConfig[]>(() => {
    const configs: OrbConfig[] = [];
    configs.push({ id: 0, baseX: 0, baseY: 0, size: 22, opacity: 1, layer: 0 });

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      configs.push({
        id: i + 1,
        baseX: Math.cos(angle) * 32,
        baseY: Math.sin(angle) * 32,
        size: 8 + (i % 3) * 2,
        opacity: 0.7 + (i % 2) * 0.15,
        layer: 1,
      });
    }

    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + 0.31;
      configs.push({
        id: i + 7,
        baseX: Math.cos(angle) * 58,
        baseY: Math.sin(angle) * 58,
        size: 4 + (i % 4),
        opacity: 0.4 + (i % 3) * 0.1,
        layer: 2,
      });
    }

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.6;
      configs.push({
        id: i + 17,
        baseX: Math.cos(angle) * 82,
        baseY: Math.sin(angle) * 82,
        size: 2 + (i % 3),
        opacity: 0.2 + (i % 2) * 0.1,
        layer: 3,
      });
    }

    return configs;
  }, []);

  const isSpeaking = state === 'speaking' || state === 'listening';
  const isThinking = state === 'thinking';
  const isIdle = state === 'idle';

  const getOrbAnimation = (orb: OrbConfig) => {
    const scaleBase = isIdle ? 0.75 : 1;
    const scaleRange = isSpeaking ? 0.35 : isThinking ? 0.18 : 0.06;
    const moveRange = isSpeaking ? 10 : isThinking ? 5 : 1.5;
    const duration = isSpeaking
      ? 0.6 + orb.layer * 0.25
      : isThinking
        ? 1.8 + orb.layer * 0.4
        : 3.5 + orb.layer * 0.8;

    return {
      animate: {
        x: [
          orb.baseX - moveRange,
          orb.baseX + moveRange * 0.7,
          orb.baseX - moveRange * 0.4,
          orb.baseX + moveRange,
          orb.baseX - moveRange,
        ],
        y: [
          orb.baseY + moveRange * 0.5,
          orb.baseY - moveRange,
          orb.baseY + moveRange * 0.7,
          orb.baseY - moveRange * 0.5,
          orb.baseY + moveRange * 0.5,
        ],
        scale: [
          scaleBase,
          scaleBase + scaleRange,
          scaleBase + scaleRange * 0.4,
          scaleBase + scaleRange * 0.85,
          scaleBase,
        ],
        opacity: isIdle
          ? [orb.opacity * 0.5, orb.opacity * 0.7, orb.opacity * 0.5]
          : [orb.opacity, orb.opacity * 1.15, orb.opacity * 0.75, orb.opacity * 1.1, orb.opacity],
      },
      transition: {
        duration,
        repeat: Infinity,
        ease: 'easeInOut' as const,
        delay: orb.id * 0.04,
      },
    };
  };

  const stateLabel = isIdle
    ? 'STANDBY'
    : state === 'listening'
      ? 'OUVINDO'
      : isThinking
        ? 'PROCESSANDO'
        : 'RESPONDENDO';

  const stateColor = isIdle ? '#2d3748' : state === 'listening' ? '#00ffc8' : '#00d2ff';
  const height = compact ? 140 : 200;

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ height }}>
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 220,
          height: 220,
          background: `radial-gradient(circle, rgba(0,210,255,${isIdle ? '0.02' : '0.06'}), transparent 70%)`,
          filter: 'blur(50px)',
        }}
        animate={{
          scale: isSpeaking ? [1, 1.35, 1] : isThinking ? [1, 1.18, 1] : [1, 1.06, 1],
        }}
        transition={{ duration: isSpeaking ? 1.2 : isThinking ? 2.5 : 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute rounded-full"
        style={{
          width: 180,
          height: 180,
          border: `1px solid rgba(0,210,255,${isIdle ? '0.04' : '0.1'})`,
        }}
        animate={{
          scale: isSpeaking ? [1, 1.06, 1] : [1, 1.02, 1],
          rotate: [0, 360],
        }}
        transition={{
          scale: { duration: 2, repeat: Infinity },
          rotate: { duration: 40, repeat: Infinity, ease: 'linear' },
        }}
      />

      {!isIdle && [0, 1, 2].map(i => (
        <motion.div
          key={`pulse-${i}`}
          className="absolute rounded-full"
          style={{
            width: 100,
            height: 100,
            border: `1px solid rgba(0,210,255,${isSpeaking ? '0.2' : '0.12'})`,
          }}
          initial={{ scale: 0.6, opacity: 0.5 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.85, ease: 'easeOut' }}
        />
      ))}

      <div className="relative" style={{ width: 180, height: 180 }}>
        {orbs.map(orb => {
          const anim = getOrbAnimation(orb);
          const glowIntensity = isIdle ? 0.15 : isSpeaking ? 0.5 : 0.3;
          return (
            <motion.div
              key={orb.id}
              className="absolute rounded-full"
              style={{
                width: orb.size,
                height: orb.size,
                left: '50%',
                top: '50%',
                marginLeft: -orb.size / 2,
                marginTop: -orb.size / 2,
                background:
                  orb.layer === 0
                    ? 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(200,230,255,0.5))'
                    : orb.layer === 1
                      ? 'radial-gradient(circle at 30% 30%, rgba(230,245,255,0.85), rgba(160,210,250,0.25))'
                      : orb.layer === 2
                        ? 'radial-gradient(circle at 30% 30%, rgba(210,230,250,0.6), rgba(130,180,230,0.12))'
                        : 'radial-gradient(circle at 30% 30%, rgba(190,210,240,0.4), rgba(100,160,220,0.08))',
                boxShadow:
                  orb.layer === 0
                    ? `0 0 ${orb.size * 1.5}px rgba(255,255,255,${glowIntensity * 0.8}), 0 0 ${orb.size * 3}px rgba(0,210,255,${glowIntensity * 0.4})`
                    : `0 0 ${orb.size}px rgba(200,230,255,${glowIntensity * orb.opacity * 0.5})`,
              }}
              animate={anim.animate}
              transition={anim.transition}
            />
          );
        })}
      </div>

      <motion.div
        className="absolute flex items-center gap-2"
        style={{ bottom: compact ? 4 : 8 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.div
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: stateColor,
            boxShadow: !isIdle ? `0 0 6px ${stateColor}` : 'none',
          }}
          animate={{ opacity: isIdle ? [0.4, 0.8, 0.4] : [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span
          className="text-[10px] tracking-[0.2em] uppercase font-medium"
          style={{
            color: stateColor,
            textShadow: !isIdle ? `0 0 10px ${stateColor}40` : 'none',
          }}
        >
          {stateLabel}
        </span>
      </motion.div>
    </div>
  );
}
