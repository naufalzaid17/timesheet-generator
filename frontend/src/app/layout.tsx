import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BRUTAL TIMESHEET | Automate Your Timesheets",
  description: "Automate your monthly BNI timesheets into Excel or PDF format in seconds. Clean, fast, and structured.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
