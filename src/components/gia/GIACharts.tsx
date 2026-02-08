import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, PieChart as PieChartIcon, Activity } from 'lucide-react';

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface MultiSeriesDataPoint {
  label: string;
  values: { name: string; value: number }[];
}

const defaultColors = [
  '#00d2ff',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

const colorMap: Record<string, { accent: string; bg: string; border: string; glow: string; badge: string }> = {
  cyan: {
    accent: '#00d2ff',
    bg: 'rgba(0,210,255,0.05)',
    border: 'rgba(0,210,255,0.12)',
    glow: '0 0 20px rgba(0,210,255,0.06)',
    badge: 'rgba(0,210,255,0.1)',
  },
  green: {
    accent: '#10b981',
    bg: 'rgba(16,185,129,0.06)',
    border: 'rgba(16,185,129,0.15)',
    glow: '0 0 20px rgba(16,185,129,0.08)',
    badge: 'rgba(16,185,129,0.12)',
  },
  amber: {
    accent: '#f59e0b',
    bg: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.15)',
    glow: '0 0 20px rgba(245,158,11,0.08)',
    badge: 'rgba(245,158,11,0.12)',
  },
  red: {
    accent: '#ef4444',
    bg: 'rgba(239,68,68,0.06)',
    border: 'rgba(239,68,68,0.15)',
    glow: '0 0 20px rgba(239,68,68,0.08)',
    badge: 'rgba(239,68,68,0.12)',
  },
  blue: {
    accent: '#3b82f6',
    bg: 'rgba(59,130,246,0.06)',
    border: 'rgba(59,130,246,0.15)',
    glow: '0 0 20px rgba(59,130,246,0.08)',
    badge: 'rgba(59,130,246,0.12)',
  },
};

interface ChartCardProps {
  title: string;
  color?: string;
  delay?: number;
  children: React.ReactNode;
  icon?: typeof BarChart3;
  subtitle?: string;
}

function ChartCard({ title, color = 'cyan', delay = 0, children, icon: Icon = BarChart3, subtitle }: ChartCardProps) {
  const colors = colorMap[color] || colorMap.cyan;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${colors.border}`,
        boxShadow: colors.glow,
      }}
    >
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: colors.badge }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: colors.accent }} />
          </div>
          <div className="flex-1">
            <span
              className="text-[10px] font-bold tracking-wider uppercase block"
              style={{ color: colors.accent }}
            >
              {title}
            </span>
            {subtitle && (
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {subtitle}
              </span>
            )}
          </div>
        </div>
        {children}
      </div>
    </motion.div>
  );
}

export function BarChart({
  data,
  title,
  color = 'cyan',
  delay = 0,
  subtitle
}: {
  data: ChartDataPoint[];
  title: string;
  color?: string;
  delay?: number;
  subtitle?: string;
}) {
  const colors = colorMap[color] || colorMap.cyan;
  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <ChartCard title={title} color={color} delay={delay} icon={BarChart3} subtitle={subtitle}>
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] font-medium truncate pr-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {item.label}
              </span>
              <span className="text-[11px] font-bold tabular-nums" style={{ color: item.color || colors.accent }}>
                {item.value.toLocaleString('pt-BR')}
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${item.color || colors.accent}, ${item.color || colors.accent}99)`,
                  boxShadow: `0 0 8px ${item.color || colors.accent}30`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${(item.value / max) * 100}%` }}
                transition={{ duration: 0.7, delay: delay + i * 0.1, ease: [0.23, 1, 0.32, 1] }}
              />
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

export function ColumnChart({
  data,
  title,
  color = 'cyan',
  delay = 0,
  subtitle
}: {
  data: ChartDataPoint[];
  title: string;
  color?: string;
  delay?: number;
  subtitle?: string;
}) {
  const colors = colorMap[color] || colorMap.cyan;
  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <ChartCard title={title} color={color} delay={delay} icon={BarChart3} subtitle={subtitle}>
      <div className="flex items-end justify-between gap-2 h-40">
        {data.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <div className="flex-1 w-full flex flex-col justify-end">
              <motion.div
                className="w-full rounded-t-lg relative"
                style={{
                  background: `linear-gradient(180deg, ${item.color || colors.accent}, ${item.color || colors.accent}99)`,
                  boxShadow: `0 0 15px ${item.color || colors.accent}30`,
                }}
                initial={{ height: 0 }}
                animate={{ height: `${(item.value / max) * 100}%` }}
                transition={{ duration: 0.7, delay: delay + i * 0.1, ease: [0.23, 1, 0.32, 1] }}
              >
                <motion.span
                  className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold tabular-nums whitespace-nowrap"
                  style={{ color: item.color || colors.accent }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: delay + i * 0.1 + 0.5 }}
                >
                  {item.value}
                </motion.span>
              </motion.div>
            </div>
            <span
              className="text-[9px] font-medium text-center w-full truncate"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              title={item.label}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

export function LineChart({
  data,
  title,
  color = 'cyan',
  delay = 0,
  subtitle
}: {
  data: ChartDataPoint[];
  title: string;
  color?: string;
  delay?: number;
  subtitle?: string;
}) {
  const colors = colorMap[color] || colorMap.cyan;
  const max = Math.max(...data.map(d => d.value), 1);
  const min = Math.min(...data.map(d => d.value), 0);
  const range = max - min || 1;

  const points = data.map((item, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: 100 - ((item.value - min) / range) * 100,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L 100 100 L 0 100 Z`;

  return (
    <ChartCard title={title} color={color} delay={delay} icon={TrendingUp} subtitle={subtitle}>
      <div className="space-y-3">
        <div className="relative h-32">
          <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`gradient-${title}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{ stopColor: colors.accent, stopOpacity: 0.3 }} />
                <stop offset="100%" style={{ stopColor: colors.accent, stopOpacity: 0 }} />
              </linearGradient>
            </defs>

            <motion.path
              d={areaD}
              fill={`url(#gradient-${title})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay }}
            />

            <motion.path
              d={pathD}
              fill="none"
              stroke={colors.accent}
              strokeWidth="2"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay, ease: [0.23, 1, 0.32, 1] }}
              style={{ filter: `drop-shadow(0 0 4px ${colors.accent}80)` }}
            />

            {points.map((point, i) => (
              <motion.circle
                key={i}
                cx={point.x}
                cy={point.y}
                r="2"
                fill={colors.accent}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: delay + 0.8 + i * 0.05 }}
                style={{ filter: `drop-shadow(0 0 3px ${colors.accent})` }}
              />
            ))}
          </svg>
        </div>

        <div className="flex justify-between items-center">
          {data.map((item, i) => (
            <div key={i} className="flex flex-col items-center flex-1">
              <span className="text-[9px] font-bold tabular-nums" style={{ color: colors.accent }}>
                {item.value}
              </span>
              <span className="text-[8px] truncate w-full text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

export function AreaChart({
  data,
  title,
  color = 'cyan',
  delay = 0,
  subtitle
}: {
  data: ChartDataPoint[];
  title: string;
  color?: string;
  delay?: number;
  subtitle?: string;
}) {
  const colors = colorMap[color] || colorMap.cyan;
  const max = Math.max(...data.map(d => d.value), 1);
  const min = Math.min(...data.map(d => d.value), 0);
  const range = max - min || 1;

  const points = data.map((item, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: 100 - ((item.value - min) / range) * 80 - 10,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L 100 100 L 0 100 Z`;

  return (
    <ChartCard title={title} color={color} delay={delay} icon={Activity} subtitle={subtitle}>
      <div className="relative h-40">
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`area-gradient-${title}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: colors.accent, stopOpacity: 0.4 }} />
              <stop offset="100%" style={{ stopColor: colors.accent, stopOpacity: 0.05 }} />
            </linearGradient>
          </defs>

          <motion.path
            d={areaD}
            fill={`url(#area-gradient-${title})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay }}
          />

          <motion.path
            d={pathD}
            fill="none"
            stroke={colors.accent}
            strokeWidth="2.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, delay, ease: [0.23, 1, 0.32, 1] }}
            style={{ filter: `drop-shadow(0 0 6px ${colors.accent}80)` }}
          />
        </svg>

        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1">
          {data.map((item, i) => (
            <div key={i} className="flex flex-col items-center">
              <span className="text-[8px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

export function PieChart({
  data,
  title,
  color = 'cyan',
  delay = 0,
  subtitle
}: {
  data: ChartDataPoint[];
  title: string;
  color?: string;
  delay?: number;
  subtitle?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = -90;

  const slices = data.map((item, i) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;

    const x1 = 50 + 45 * Math.cos((startAngle * Math.PI) / 180);
    const y1 = 50 + 45 * Math.sin((startAngle * Math.PI) / 180);
    const x2 = 50 + 45 * Math.cos(((startAngle + angle) * Math.PI) / 180);
    const y2 = 50 + 45 * Math.sin(((startAngle + angle) * Math.PI) / 180);
    const largeArc = angle > 180 ? 1 : 0;

    return {
      ...item,
      color: item.color || defaultColors[i % defaultColors.length],
      path: `M 50 50 L ${x1} ${y1} A 45 45 0 ${largeArc} 1 ${x2} ${y2} Z`,
      percentage,
    };
  });

  return (
    <ChartCard title={title} color={color} delay={delay} icon={PieChartIcon} subtitle={subtitle}>
      <div className="flex items-center gap-4">
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            {slices.map((slice, i) => (
              <motion.path
                key={i}
                d={slice.path}
                fill={slice.color}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: delay + i * 0.1 }}
                style={{
                  filter: `drop-shadow(0 0 3px ${slice.color}40)`,
                  transformOrigin: 'center',
                }}
              />
            ))}
          </svg>
        </div>

        <div className="flex-1 space-y-1.5">
          {slices.map((slice, i) => (
            <motion.div
              key={i}
              className="flex items-center justify-between gap-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + i * 0.08 }}
            >
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: slice.color,
                    boxShadow: `0 0 6px ${slice.color}80`
                  }}
                />
                <span className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {slice.label}
                </span>
              </div>
              <span className="text-[10px] font-bold tabular-nums" style={{ color: slice.color }}>
                {slice.percentage.toFixed(1)}%
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

export function DonutChart({
  data,
  title,
  color = 'cyan',
  delay = 0,
  subtitle
}: {
  data: ChartDataPoint[];
  title: string;
  color?: string;
  delay?: number;
  subtitle?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = -90;

  const slices = data.map((item, i) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;

    const x1Outer = 50 + 45 * Math.cos((startAngle * Math.PI) / 180);
    const y1Outer = 50 + 45 * Math.sin((startAngle * Math.PI) / 180);
    const x2Outer = 50 + 45 * Math.cos(((startAngle + angle) * Math.PI) / 180);
    const y2Outer = 50 + 45 * Math.sin(((startAngle + angle) * Math.PI) / 180);

    const x1Inner = 50 + 25 * Math.cos(((startAngle + angle) * Math.PI) / 180);
    const y1Inner = 50 + 25 * Math.sin(((startAngle + angle) * Math.PI) / 180);
    const x2Inner = 50 + 25 * Math.cos((startAngle * Math.PI) / 180);
    const y2Inner = 50 + 25 * Math.sin((startAngle * Math.PI) / 180);

    const largeArc = angle > 180 ? 1 : 0;

    return {
      ...item,
      color: item.color || defaultColors[i % defaultColors.length],
      path: `M ${x1Outer} ${y1Outer} A 45 45 0 ${largeArc} 1 ${x2Outer} ${y2Outer} L ${x1Inner} ${y1Inner} A 25 25 0 ${largeArc} 0 ${x2Inner} ${y2Inner} Z`,
      percentage,
    };
  });

  return (
    <ChartCard title={title} color={color} delay={delay} icon={PieChartIcon} subtitle={subtitle}>
      <div className="flex items-center gap-4">
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            {slices.map((slice, i) => (
              <motion.path
                key={i}
                d={slice.path}
                fill={slice.color}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: delay + i * 0.1 }}
                style={{
                  filter: `drop-shadow(0 0 3px ${slice.color}40)`,
                  transformOrigin: 'center',
                }}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-lg font-bold" style={{ color: colorMap[color]?.accent || '#00d2ff' }}>
                {total}
              </div>
              <div className="text-[8px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Total
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-1.5">
          {slices.map((slice, i) => (
            <motion.div
              key={i}
              className="flex items-center justify-between gap-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + i * 0.08 }}
            >
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: slice.color,
                    boxShadow: `0 0 6px ${slice.color}80`
                  }}
                />
                <span className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {slice.label}
                </span>
              </div>
              <span className="text-[10px] font-bold tabular-nums" style={{ color: slice.color }}>
                {slice.percentage.toFixed(1)}%
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

export function RadarChart({
  data,
  title,
  color = 'cyan',
  delay = 0,
  subtitle
}: {
  data: ChartDataPoint[];
  title: string;
  color?: string;
  delay?: number;
  subtitle?: string;
}) {
  const colors = colorMap[color] || colorMap.cyan;
  const max = Math.max(...data.map(d => d.value), 1);
  const numPoints = data.length;
  const centerX = 50;
  const centerY = 50;
  const radius = 40;

  const dataPoints = data.map((item, i) => {
    const angle = (i / numPoints) * 2 * Math.PI - Math.PI / 2;
    const normalizedValue = item.value / max;
    const x = centerX + radius * normalizedValue * Math.cos(angle);
    const y = centerY + radius * normalizedValue * Math.sin(angle);
    return { x, y, angle, item };
  });

  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1];

  return (
    <ChartCard title={title} color={color} delay={delay} icon={Activity} subtitle={subtitle}>
      <div className="relative h-48">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {gridLevels.map((level, i) => {
            const points = Array.from({ length: numPoints }, (_, j) => {
              const angle = (j / numPoints) * 2 * Math.PI - Math.PI / 2;
              const x = centerX + radius * level * Math.cos(angle);
              const y = centerY + radius * level * Math.sin(angle);
              return `${j === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ') + ' Z';

            return (
              <path
                key={i}
                d={points}
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="0.5"
              />
            );
          })}

          {dataPoints.map((_, i) => {
            const angle = (i / numPoints) * 2 * Math.PI - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            return (
              <line
                key={i}
                x1={centerX}
                y1={centerY}
                x2={x}
                y2={y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="0.5"
              />
            );
          })}

          <motion.path
            d={dataPath}
            fill={`${colors.accent}30`}
            stroke={colors.accent}
            strokeWidth="2"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay }}
            style={{
              filter: `drop-shadow(0 0 6px ${colors.accent}80)`,
              transformOrigin: 'center',
            }}
          />

          {dataPoints.map((point, i) => (
            <motion.circle
              key={i}
              cx={point.x}
              cy={point.y}
              r="2"
              fill={colors.accent}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: delay + 0.6 + i * 0.05 }}
              style={{ filter: `drop-shadow(0 0 3px ${colors.accent})` }}
            />
          ))}

          {dataPoints.map((point, i) => {
            const angle = point.angle;
            const labelRadius = radius + 8;
            const labelX = centerX + labelRadius * Math.cos(angle);
            const labelY = centerY + labelRadius * Math.sin(angle);

            return (
              <text
                key={i}
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[6px]"
                fill="rgba(255,255,255,0.5)"
              >
                {point.item.label}
              </text>
            );
          })}
        </svg>
      </div>
    </ChartCard>
  );
}
