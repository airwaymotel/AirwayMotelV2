import React from 'react';

/*
 * StatusBadge — the single source of truth for status pills across the app.
 * Mono-caps text on a desaturated signal wash. `tone` picks the signal:
 * 'moss' (free/success) | 'clay' (occupied/late) | 'amber' (attention) | 'neutral'.
 *
 * Pass either a known `status` string OR an explicit `tone`.
 */
const STATUS_TO_TONE = {
  // rooms
  available: 'moss',
  occupied: 'clay',
  maintenance: 'amber',
  cleaning: 'amber',
  reserved: 'neutral',
  // stays
  active: 'moss',
  checked_out: 'neutral',
  checkedout: 'neutral',
  'checked out': 'neutral',
  evicted: 'clay',
  no_show: 'clay',
  noshow: 'clay',
  // generic
  success: 'moss',
  completed: 'moss',
  error: 'clay',
  cancelled: 'clay',
  'pending pay': 'amber',
  'checking out': 'amber',
  'checkout due': 'amber',
};

const TONE_STYLES = {
  moss: 'bg-moss-dim/40 text-moss',
  clay: 'bg-clay-dim/40 text-clay',
  amber: 'bg-amber-dim/40 text-amber',
  neutral: 'bg-surface-hover text-on-surface-variant',
};

export default function StatusBadge({ status, tone, className = '', children }) {
  const resolvedTone = tone || STATUS_TO_TONE[String(status).toLowerCase()] || 'neutral';
  const label = children || status;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-mono text-[10px] font-medium uppercase tracking-[0.12em] ${TONE_STYLES[resolvedTone]} ${className}`}
    >
      <span className={`w-1 h-1 rounded-full ${dotColor(resolvedTone)}`} />
      {label}
    </span>
  );
}

function dotColor(tone) {
  return {
    moss: 'bg-moss',
    clay: 'bg-clay',
    amber: 'bg-amber',
    neutral: 'bg-on-surface-faint',
  }[tone] || 'bg-on-surface-faint';
}
