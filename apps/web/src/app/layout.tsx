import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAINS CRM Sales",
  description: "Sarawak Information Systems — Sales CRM. Claritas × EIAAW Solutions.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-white text-charcoal font-sans antialiased">{children}</body>
    </html>
  );
}
