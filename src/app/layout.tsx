import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CitePath — Can AI Understand Your Business?",
  description:
    "Scan a public business website and discover the signals that make the business clearer to search and AI-powered discovery systems.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
