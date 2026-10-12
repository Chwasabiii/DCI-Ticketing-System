import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PMSG Desk",
  description: "Centralized ticketing, tracking, and monitoring for DCI PMSG",
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
