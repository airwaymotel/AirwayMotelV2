import React from 'react';

/*
 * SectionCard — a numbered ledger step.
 * Mono gold step number, serif title, hairline rule under the header.
 */
export default function SectionCard({ number, title, children, rightContent }) {
  return (
    <section className="bg-surface border border-rule rounded-md overflow-hidden">
      <div className="px-6 py-4 border-b border-rule flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          {number && (
            <span className="text-mono text-[13px] text-gold tabular-nums">
              {String(number).padStart(2, '0')}
            </span>
          )}
          <h3 className="font-display text-title-md text-on-surface">{title}</h3>
        </div>
        {rightContent && <div className="text-body-sm">{rightContent}</div>}
      </div>
      <div className="p-6">
        {children}
      </div>
    </section>
  );
}
