import { cn } from '@/lib/utils';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn('shrink-0 overflow-hidden rounded-full bg-amber-500/15', className)}
      title={name}
      aria-label={name}
    >
      <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
        <text
          x="20"
          y="20"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-amber-600 dark:fill-amber-400 font-semibold"
          style={{ fontSize: 16 }}
        >
          {getInitials(name)}
        </text>
      </svg>
    </div>
  );
}
