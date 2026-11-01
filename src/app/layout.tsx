import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CIRT Platform",
  description: "Cyber incident response and threat intelligence management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
