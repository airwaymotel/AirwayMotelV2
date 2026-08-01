'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  badgeText?: string;
  icon: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
  isInverse?: boolean;
}

const toneClasses = {
  default: 'text-foreground',
  success: 'text-green-600',
  warning: 'text-amber-600',
  destructive: 'text-red-600',
};

export default function StatCard({
  title,
  value,
  badgeText,
  icon: Icon,
  tone = 'default',
  isInverse = false,
}: StatCardProps) {
  if (isInverse) {
    return (
      <Card className="bg-primary text-primary-foreground border-0 shadow-md">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <Icon className="w-4 h-4 opacity-70" strokeWidth={1.5} />
            {badgeText && (
              <span className="text-xs opacity-70 font-mono">{badgeText}</span>
            )}
          </div>
          <p className="text-xs uppercase tracking-wider opacity-60 mb-1">{title}</p>
          <p className="text-2xl font-bold leading-none">{value}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          {badgeText && (
            <span className="text-xs text-muted-foreground font-mono">{badgeText}</span>
          )}
        </div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{title}</p>
        <p className={`text-2xl font-bold leading-none ${toneClasses[tone]}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
