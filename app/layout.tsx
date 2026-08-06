import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Seguimiento SECOP II — Bogotá",
  description:
    "Análisis con IA de la contratación pública de Bogotá (SECOP II): detección de patrones y alertas para control político.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-gray-50 text-gray-900">
        <header className="border-b border-gray-200 bg-[#1a365d] text-white">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
            <a href="/" className="font-semibold tracking-tight">
              Seguimiento SECOP II · Bogotá
            </a>
            <nav className="ml-auto flex gap-5 text-sm text-blue-100">
              <a href="/" className="hover:text-white">
                Dashboard
              </a>
              <a href="/alerts" className="hover:text-white">
                Alertas
              </a>
            </nav>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-gray-500">
            Análisis automatizado con IA de la contratación pública de Bogotá.
            Los patrones detectados ameritan verificación y no implican por sí
            mismos una irregularidad. Fuente: SECOP II (datos.gov.co).
          </div>
        </footer>
      </body>
    </html>
  );
}
