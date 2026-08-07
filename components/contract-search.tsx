"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function ContractSearch({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);

  function go(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (v.length < 3) return;
    // Si parece un ID de SECOP (CO1.PCCNTR / CO1.NTC), ir directo al análisis
    // (trae en vivo si no está en la base). Si es texto, mostrar resultados.
    if (/^co1\./i.test(v)) router.push(`/contracts/${encodeURIComponent(v)}`);
    else router.push(`/contracts?q=${encodeURIComponent(v)}`);
  }

  return (
    <form onSubmit={go} className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Contratista, entidad, objeto, o ID de contrato/proceso…"
          className="w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-3 text-sm text-fg outline-none placeholder:text-muted focus:border-primary"
        />
      </div>
      <button
        type="submit"
        className="rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-fg transition hover:opacity-90"
      >
        Buscar
      </button>
    </form>
  );
}
