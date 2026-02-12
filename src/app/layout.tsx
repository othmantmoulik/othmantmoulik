import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Finance Command Center",
  description: "Revenue intelligence, obligation tracking, and smart money allocation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 dark:bg-gray-950 font-sans">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto px-4 py-6 max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
