import React from 'react';

/*
 * StatCard — Night Registry style.
 * Flat surface, hairline rule, mono eyebrow label, big serif number.
 * `tone` drives the number color: 'gold' | 'paper' | 'moss' | 'clay'.
 * `isInverse` renders a solid raised-ink block with a gold rule.
 */
const toneToColor = {
  gold: 'text-gold-bright',
  paper: 'text-on-surface',
  moss: 'text-moss',
  clay: 'text-clay',
};

export default function StatCard({
  title,
  value,
  badgeText,
  icon: Icon,
  tone = 'paper',
  isInverse = false,
}) {
  const numberColor = toneToColor[tone] || toneToColor.paper;

  if (isInverse) {
    return (
      <div className="col-span-12 md:col-span-3 bg-surface-raised border border-rule rounded-md p-5 flex flex-col justify-between relative overflow-hidden">
        <span className="absolute top-0 left-0 w-full h-[2px] bg-gold/60" />
        {Icon && (
          <Icon className="w-4 h-4 text-gold mb-6" strokeWidth={1.5} />
        )}
        <div>
          <p className="text-eyebrow text-on-surface-faint mb-2">{title}</p>
          <p className="font-display text-display-md text-gold-bright leading-none">{value}</p>
          {badgeText && <p className="text-mono text-[11px] text-on-surface-variant mt-3">{badgeText}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-12 md:col-span-3 bg-surface border border-rule rounded-md p-5 flex flex-col justify-between transition-colors hover:border-rule-strong">
      <div className="flex items-start justify-between mb-6">
        {Icon && <Icon className="w-4 h-4 text-on-surface-faint" strokeWidth={1.5} />}
        {badgeText && (
          <span className="text-mono text-[11px] text-on-surface-variant tabular-nums">{badgeText}</span>
        )}
      </div>
      <div>
        <p className="text-eyebrow text-on-surface-faint mb-2">{title}</p>
        <p className={`font-display text-display-md leading-none ${numberColor}`}>{value}</p>
      </div>
    </div>
  );
}
