import React from 'react';

/*
 * InitialsAvatar — Night Registry palette.
 * Replaces the old blue hex array with ink/gold/paper tones so avatars
 * sit naturally on the dark canvas. Keeps the deterministic hash logic.
 */

const COLORS = [
  '#B89770', // gold
  '#9A7B4F', // deep gold
  '#7A9E7A', // moss
  '#B57268', // clay
  '#807A6E', // faint stone
  '#5C554A', // outline
  '#D4B893', // bright gold
  '#6E6557', // muted bronze
];

const getInitials = (name) => {
  if (!name) return '—';
  const parts = name.split(' ').filter((p) => p.trim() !== '');
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function InitialsAvatar({ name, className = 'w-10 h-10' }) {
  const initials = getInitials(name);
  const colorIndex = name ? (name.charCodeAt(0) + name.length) % COLORS.length : 0;
  const bgColor = COLORS[colorIndex];

  return (
    <div
      className={`rounded-full flex items-center justify-center font-mono font-medium text-background shrink-0 overflow-hidden border border-rule ${className}`}
      style={{ backgroundColor: bgColor }}
      title={name}
    >
      <span className="text-[0.4em] leading-none select-none tracking-wider">{initials}</span>
    </div>
  );
}
