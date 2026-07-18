import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "./AuthGuard";
import ErrorBoundary from "./components/ErrorBoundary";
import GlobalErrorOverlay from "./components/GlobalErrorOverlay";
import BootBeacon from "./components/BootBeacon";

export const metadata: Metadata = {
  title: "Porchlight",
  description: "Your home's trusted guide to repairs, upgrades, and upkeep.",
};

// Runs during initial HTML parse — before, and independent of, React hydration.
// Opt in per-page by adding ?debug to the URL (e.g. http://<ip>:3000/?debug).
// It paints a fixed panel and records boot milestones + environment facts +
// uncaught errors, so a device with no visible console (a phone) can still show
// exactly how far boot got. If it shows the env line but nothing from React,
// the JS bundle never executed.
const BOOT_DIAGNOSTIC = `
(function () {
  try {
    if (!/[?&]debug\\b/.test(location.search)) return;
    var panel = document.createElement('div');
    panel.setAttribute('style', 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;max-height:45vh;overflow:auto;background:rgba(20,16,14,0.92);color:#EADFD2;font:11px/1.45 ui-monospace,Menlo,Consolas,monospace;padding:8px 10px;white-space:pre-wrap;word-break:break-word;');
    function render() { panel.textContent = boot.log.join('\\n'); }
    var boot = { log: [], push: function (m) { boot.log.push(new Date().toISOString().slice(11, 23) + '  ' + m); render(); } };
    window.__boot = boot;
    function ready() {
      if (!document.body) { setTimeout(ready, 0); return; }
      document.body.appendChild(panel);
      render();
    }
    ready();
    var ls = 'n/a';
    try { localStorage.setItem('__b', '1'); localStorage.removeItem('__b'); ls = 'ok'; } catch (e) { ls = 'BLOCKED (' + (e && e.name) + ')'; }
    boot.push('inline script ran');
    boot.push('env: secureContext=' + window.isSecureContext + ' crypto.subtle=' + !!(window.crypto && window.crypto.subtle) + ' navigator.locks=' + !!(navigator.locks) + ' localStorage=' + ls);
    boot.push('url=' + location.href);
    boot.push('ua=' + navigator.userAgent);
    window.addEventListener('error', function (e) { boot.push('window.error: ' + (e.message || e.error)); });
    window.addEventListener('unhandledrejection', function (e) { boot.push('unhandledrejection: ' + (e.reason && (e.reason.message || e.reason))); });
  } catch (e) { /* diagnostics must never break the app */ }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <script dangerouslySetInnerHTML={{ __html: BOOT_DIAGNOSTIC }} />
        <BootBeacon />
        <GlobalErrorOverlay />
        <ErrorBoundary>
          <AuthGuard>{children}</AuthGuard>
        </ErrorBoundary>
      </body>
    </html>
  );
}
