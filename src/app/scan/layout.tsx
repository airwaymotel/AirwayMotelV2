import { Suspense } from 'react';

export default function ScanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Minimal layout — no sidebar, no header, just the full-screen mobile scan page
  // Suspense boundary required for useSearchParams in the page
  return <Suspense>{children}</Suspense>;
}
