import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/components/auth-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Airway Motel — Admin",
  description: "Motel management system for Airway Motel. Room status, check-in, checkout, guest history, and billing.",
  keywords: ["Airway Motel", "motel management", "night registry", "check-in", "checkout"],
  authors: [{ name: "Airway Motel" }],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' fill='none'><rect width='40' height='40' rx='10' fill='%23f59e0b'/><path d='M12 28L20 12L28 28' stroke='white' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'/><path d='M15 22H25' stroke='white' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'/></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster position="top-right" richColors />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
