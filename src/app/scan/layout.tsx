export default function ScanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Minimal layout — no sidebar, no header, just the full-screen mobile scan page
  return <>{children}</>;
}
