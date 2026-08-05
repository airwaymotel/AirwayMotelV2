'use client';

import { useInView } from '@/lib/use-in-view';
import { cn } from '@/lib/utils';

interface AnimateOnScrollProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  animation?: 'fade-up' | 'fade-in' | 'slide-in-left' | 'slide-in-right' | 'scale-in';
}

const animations = {
  'fade-up': 'animate-fade-up',
  'fade-in': 'animate-fade-in',
  'slide-in-left': 'animate-slide-in-left',
  'slide-in-right': 'animate-slide-in-right',
  'scale-in': 'animate-scale-in',
};

export default function AnimateOnScroll({
  children,
  className,
  delay = 0,
  animation = 'fade-up',
}: AnimateOnScrollProps) {
  const { ref, isInView } = useInView();

  return (
    <div
      ref={ref}
      className={cn(
        'opacity-0',
        isInView && animations[animation],
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
