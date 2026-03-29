export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export function getStatusTone(status: JobStatus): string {
  switch (status) {
    case 'succeeded':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'failed':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
    case 'running':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}

export function getSummaryTone(tone: 'slate' | 'amber' | 'rose'): string {
  switch (tone) {
    case 'amber':
      return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200';
    case 'rose':
      return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200';
    case 'slate':
    default:
      return 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white';
  }
}

export function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={`mt-2 break-all text-sm text-slate-700 dark:text-slate-200 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

export function DetailSection({
  title,
  content,
  emptyLabel,
}: {
  title: string;
  content: unknown;
  emptyLabel: string;
}) {
  const isEmpty =
    content === null ||
    content === undefined ||
    (typeof content === 'string' && content.trim().length === 0);

  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{title}</h4>
      {isEmpty ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</p>
      ) : (
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
          {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
        </pre>
      )}
    </section>
  );
}

export function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'slate' | 'amber' | 'rose';
}) {
  return (
    <div className={`rounded-3xl border px-4 py-4 ${getSummaryTone(tone)}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

type KnobColor = 'blue' | 'purple' | 'amber' | 'emerald' | 'rose';

interface KnobProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  color?: KnobColor;
  size?: 'sm' | 'md';
  showValue?: boolean;
}

const colorClasses: Record<KnobColor, { accent: string; glow: string; indicator: string }> = {
  blue: { accent: '#3b82f6', glow: 'drop-shadow(0 0 4px rgba(59,130,246,0.6))', indicator: '#e0e0e0' },
  purple: { accent: '#a855f7', glow: 'drop-shadow(0 0 4px rgba(168,85,247,0.6))', indicator: '#e0e0e0' },
  amber: { accent: '#f59e0b', glow: 'drop-shadow(0 0 4px rgba(245,158,11,0.6))', indicator: '#e0e0e0' },
  emerald: { accent: '#10b981', glow: 'drop-shadow(0 0 4px rgba(16,185,129,0.6))', indicator: '#e0e0e0' },
  rose: { accent: '#f43f5e', glow: 'drop-shadow(0 0 4px rgba(244,63,94,0.6))', indicator: '#e0e0e0' },
};

export function Knob({
  label,
  value,
  min = 0,
  max = 100,
  onChange,
  color = 'blue',
  size = 'md',
  showValue = true,
}: KnobProps) {
  const knobSize = size === 'sm' ? 36 : 48;
  const center = knobSize / 2;
  const radius = size === 'sm' ? 14 : 18;
  
  const normalizedValue = ((value - min) / (max - min)) * 270;
  const rotation = normalizedValue - 135;
  const c = colorClasses[color];
  
  const arcStart = 135;
  const arcEnd = arcStart + normalizedValue;
  const arcRadius = radius - 2;
  
  const describeArc = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(center, center, arcRadius, endAngle);
    const end = polarToCartesian(center, center, arcRadius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${arcRadius} ${arcRadius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };
  
  function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
    const rad = (angle - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -5 : 5;
    const newValue = Math.max(min, Math.min(max, value + delta));
    onChange(newValue);
  };

  const handleDragStart = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const angle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * 180 / Math.PI;
      let normalizedAngle = (angle + 90 + 360) % 360;
      if (normalizedAngle > 270) normalizedAngle = 0;
      const newValue = Math.round((normalizedAngle / 270) * (max - min) + min);
      onChange(Math.max(min, Math.min(max, newValue)));
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const indicatorEnd = polarToCartesian(center, center, radius - 4, arcEnd);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`relative cursor-pointer select-none ${size === 'sm' ? 'w-9 h-9' : 'w-12 h-12'}`}
        onWheel={handleWheel}
        onMouseDown={handleDragStart}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
      >
        <svg
          width={knobSize}
          height={knobSize}
          viewBox={`0 0 ${knobSize} ${knobSize}`}
          className="absolute inset-0"
        >
          {/* Drop shadow */}
          <defs>
            <filter id={`shadow-${color}-${size}`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3" />
            </filter>
            <linearGradient id={`metal-${color}-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4a4a4a" />
              <stop offset="30%" stopColor="#8a8a8a" />
              <stop offset="50%" stopColor="#6a6a6a" />
              <stop offset="70%" stopColor="#9a9a9a" />
              <stop offset="100%" stopColor="#5a5a5a" />
            </linearGradient>
            <linearGradient id={`knob-${color}-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5a5a5a" />
              <stop offset="40%" stopColor="#3a3a3a" />
              <stop offset="60%" stopColor="#4a4a4a" />
              <stop offset="100%" stopColor="#2a2a2a" />
            </linearGradient>
          </defs>
          
          {/* Base ring - metallic */}
          <circle
            cx={center}
            cy={center}
            r={radius + 2}
            fill="url(#metal-dim)"
            className="opacity-20"
          />
          <circle
            cx={center}
            cy={center}
            r={radius + 2}
            fill="none"
            stroke="#666"
            strokeWidth="1"
            className="opacity-30"
          />
          
          {/* Outer ring with metallic gradient */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="url(#metal-light)"
            filter={`url(#shadow-${color}-${size})`}
          >
            <animate attributeName="opacity" values="1;0.95;1" dur="3s" repeatCount="indefinite" />
          </circle>
          
          {/* Inner ring - darker */}
          <circle
            cx={center}
            cy={center}
            r={radius - 3}
            fill="url(#knob-dim)"
          />
          
          {/* Value arc track */}
          <path
            d={describeArc(arcStart, arcStart + 270)}
            fill="none"
            stroke="#333"
            strokeWidth="3"
            strokeLinecap="round"
            className="opacity-40"
          />
          
          {/* Value arc - colored */}
          {normalizedValue > 0 && (
            <path
              d={describeArc(arcStart, arcEnd)}
              fill="none"
              stroke={c.accent}
              strokeWidth="3"
              strokeLinecap="round"
              style={{ filter: c.glow }}
            />
          )}
          
          {/* Center dot */}
          <circle
            cx={center}
            cy={center}
            r="3"
            fill="#222"
          />
          
          {/* Indicator line */}
          <line
            x1={center}
            y1={center - 6}
            x2={center}
            y2={center - radius + 6}
            stroke={c.indicator}
            strokeWidth={size === 'sm' ? 2 : 2.5}
            strokeLinecap="round"
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: `${center}px ${center}px`,
              filter: `drop-shadow(0 0 2px ${c.accent})`
            }}
          />
          
          {/* Indicator glow */}
          <circle
            cx={indicatorEnd.x}
            cy={indicatorEnd.y}
            r={size === 'sm' ? 2.5 : 3}
            fill={c.accent}
            style={{ filter: c.glow }}
          />
        </svg>
      </div>
      {showValue && (
        <span className="text-[10px] text-gray-600 dark:text-gray-300 font-semibold tabular-nums">
          {value}
        </span>
      )}
      <span className="text-[7px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">
        {label}
      </span>
    </div>
  );
}

interface StereoMeterProps {
  levelL: number;
  levelR: number;
  height?: 'sm' | 'md';
  showLabel?: boolean;
}

export function StereoMeter({ levelL, levelR, height = 'md', showLabel = false }: StereoMeterProps) {
  const barHeight = height === 'sm' ? 'h-10' : 'h-14';
  const barWidth = height === 'sm' ? 'w-2' : 'w-2.5';
  
  const getColor = (level: number) => {
    if (level > 0.82) return 'bg-red-500';
    if (level > 0.55) return 'bg-amber-500';
    return 'bg-emerald-400';
  };
  
  const widthL = Math.max(4, Math.min(100, levelL * 100));
  const widthR = Math.max(4, Math.min(100, levelR * 100));
  
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-end gap-0.5">
        {/* L Channel */}
        <div className={`${barWidth} ${barHeight} rounded-sm bg-gray-200 dark:bg-gray-700 overflow-hidden relative border border-gray-300 dark:border-gray-600`}>
          <div
            className={`absolute bottom-0 left-0 right-0 rounded-sm transition-all duration-75 ${getColor(levelL)}`}
            style={{ height: `${widthL}%` }}
          />
        </div>
        {/* R Channel */}
        <div className={`${barWidth} ${barHeight} rounded-sm bg-gray-200 dark:bg-gray-700 overflow-hidden relative border border-gray-300 dark:border-gray-600`}>
          <div
            className={`absolute bottom-0 left-0 right-0 rounded-sm transition-all duration-75 ${getColor(levelR)}`}
            style={{ height: `${widthR}%` }}
          />
        </div>
      </div>
      {showLabel && (
        <div className="flex gap-1 text-[6px] text-gray-400">
          <span className="w-2 text-center">L</span>
          <span className="w-2 text-center">R</span>
        </div>
      )}
    </div>
  );
}
