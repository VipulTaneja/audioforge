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

const colorClasses: Record<KnobColor, string> = {
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
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
  const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const knobSize = size === 'sm' ? 24 : 30;
  
  const normalizedValue = ((value - min) / (max - min)) * 270;
  const rotation = normalizedValue - 135;
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -5 : 5;
    const newValue = Math.max(min, Math.min(max, value + delta));
    onChange(newValue);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`relative rounded-full cursor-pointer transition-colors ${sizeClasses} bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600`}
        onWheel={handleWheel}
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
          viewBox="0 0 40 40"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-gray-300 dark:text-gray-600"
            strokeDasharray={`${Math.PI * 16 * 0.75} ${Math.PI * 16}`}
            strokeLinecap="round"
            transform="rotate(135 20 20)"
          />
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`${colorClasses[color]} opacity-80`}
            strokeDasharray={`${Math.PI * 16 * (normalizedValue / 270)} ${Math.PI * 16}`}
            strokeLinecap="round"
            transform="rotate(135 20 20)"
          />
          <line
            x1="20"
            y1="20"
            x2="20"
            y2="8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={colorClasses[color]}
            transform={`rotate(${rotation} 20 20)`}
          />
        </svg>
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${sizeClasses === 'w-8 h-8' ? 'w-5 h-5' : 'w-6 h-6'} ${colorClasses[color]}`}
          style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)`, transformOrigin: 'center' }}
        />
      </div>
      {showValue && (
        <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
          {value}
        </span>
      )}
      <span className="text-[8px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}
