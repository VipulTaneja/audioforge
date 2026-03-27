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

const colorClasses: Record<KnobColor, { bg: string; ring: string; indicator: string; glow: string }> = {
  blue: { bg: 'bg-blue-500', ring: 'bg-blue-600', indicator: 'bg-white', glow: 'shadow-blue-500/50' },
  purple: { bg: 'bg-purple-500', ring: 'bg-purple-600', indicator: 'bg-white', glow: 'shadow-purple-500/50' },
  amber: { bg: 'bg-amber-500', ring: 'bg-amber-600', indicator: 'bg-white', glow: 'shadow-amber-500/50' },
  emerald: { bg: 'bg-emerald-500', ring: 'bg-emerald-600', indicator: 'bg-white', glow: 'shadow-emerald-500/50' },
  rose: { bg: 'bg-rose-500', ring: 'bg-rose-600', indicator: 'bg-white', glow: 'shadow-rose-500/50' },
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
  const outerSize = size === 'sm' ? 'w-9 h-9' : 'w-12 h-12';
  const innerSize = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const knobSize = size === 'sm' ? 28 : 36;
  
  const normalizedValue = ((value - min) / (max - min)) * 270;
  const rotation = normalizedValue - 135;
  const indicatorRotation = rotation;
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -5 : 5;
    const newValue = Math.max(min, Math.min(max, value + delta));
    onChange(newValue);
  };

  const handleDragStart = (e: React.MouseEvent) => {
    const startY = e.clientY;
    const startValue = value;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const sensitivity = (max - min) / 150;
      const newValue = Math.max(min, Math.min(max, startValue + deltaY * sensitivity));
      onChange(Math.round(newValue));
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const c = colorClasses[color];

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`relative cursor-pointer select-none`}
        onWheel={handleWheel}
        onMouseDown={handleDragStart}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
      >
        {/* Outer ring with 3D effect */}
        <div className={`${outerSize} rounded-full bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-600 dark:to-gray-800 shadow-lg`}>
          {/* Inner ring */}
          <div className={`absolute inset-[3px] ${innerSize} rounded-full bg-gradient-to-br from-gray-200 to-gray-400 dark:from-gray-700 dark:to-gray-900`}>
            {/* Knob body */}
            <div className={`absolute inset-[2px] ${size === 'sm' ? 'w-[22px] h-[22px]' : 'w-[28px] h-[28px]'} left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-gray-300 to-gray-500 dark:from-gray-600 dark:to-gray-800 shadow-inner`}>
              {/* Value arc background */}
              <svg
                width={knobSize - 4}
                height={knobSize - 4}
                viewBox="0 0 40 40"
                className="absolute top-0 left-0"
              >
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  strokeWidth="3"
                  className="text-gray-400/30 dark:text-gray-500/30"
                  strokeDasharray={`${Math.PI * 16 * 0.75} ${Math.PI * 16}`}
                  strokeLinecap="round"
                  transform="rotate(135 20 20)"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  strokeWidth="3"
                  className={`${c.ring}`}
                  strokeDasharray={`${Math.PI * 16 * (normalizedValue / 270)} ${Math.PI * 16}`}
                  strokeLinecap="round"
                  transform="rotate(135 20 20)"
                  style={{ filter: `drop-shadow(0 0 3px ${c.glow})` }}
                />
              </svg>
              
              {/* Indicator dot */}
              <div
                className={`absolute w-1.5 h-1.5 rounded-full ${c.indicator}`}
                style={{
                  top: '15%',
                  left: '50%',
                  transform: `translateX(-50%) rotate(${indicatorRotation}deg)`,
                  transformOrigin: 'center 85%',
                  boxShadow: '0 0 4px rgba(255,255,255,0.8)'
                }}
              />
            </div>
          </div>
        </div>
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
