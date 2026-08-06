"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  TriangleAlert,
  FileBarChart,
  Building2,
  Users,
  FileText,
  Menu,
  X,
  Sun,
  Moon,
  ShieldCheck,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/alerts", label: "Alertas", icon: TriangleAlert },
  { href: "/reports", label: "Reportes", icon: FileBarChart },
  { href: "/entities", label: "Entidades", icon: Building2 },
  { href: "/contractors", label: "Contratistas", icon: Users },
  { href: "/contracts", label: "Contratos", icon: FileText },
];

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  function toggle() {
    const el = document.documentElement;
    const next = !el.classList.contains("dark");
    el.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  }
  return (
    <button
      onClick={toggle}
      aria-label="Cambiar tema"
      className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface text-muted transition hover:text-fg"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-primary text-primary-fg shadow-sm"
                : "text-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            <Icon className="h-[18px] w-[18px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-fg">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-fg">SECOP · Bogotá</div>
        <div className="text-[11px] text-muted">Control ciudadano</div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface lg:flex print:!hidden">
        <Brand />
        <NavLinks />
        <div className="mt-auto px-5 py-4 text-[11px] leading-relaxed text-muted">
          Análisis con IA de la contratación distrital. Fuente: SECOP II.
        </div>
      </aside>

      {/* Drawer móvil */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-surface">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-fg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Columna principal */}
      <div className="lg:pl-64 print:pl-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur sm:px-6 print:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface text-muted hover:text-fg lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-sm font-medium text-muted">
            Seguimiento de contratación pública
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        <main>{children}</main>

        <footer className="border-t border-border px-6 py-5 text-xs text-muted print:hidden">
          Los patrones detectados ameritan verificación y no implican por sí
          mismos una irregularidad. Fuente: SECOP II (datos.gov.co).
        </footer>
      </div>
    </div>
  );
}
