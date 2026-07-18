import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "./AuthGuard";
import ErrorBoundary from "./components/ErrorBoundary";
import GlobalErrorOverlay from "./components/GlobalErrorOverlay";

export const metadata: Metadata = {
  title: "Porchlight",
  description: "Your home's trusted guide to repairs, upgrades, and upkeep.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <GlobalErrorOverlay />
        <ErrorBoundary>
          <AuthGuard>{children}</AuthGuard>
        </ErrorBoundary>
      </body>
    </html>
  );
}
