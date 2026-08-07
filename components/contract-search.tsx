"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function ContractSearch() {
  const router = useRouter();
  const [id, setId] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const v = id.trim();
    if (v) router.push(`/contracts/${encodeURIComponent(v)}`);
  }

  return (
    <form onSubmit={go} className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="Pega el ID del contrato de SECOP (ej. CO1.PCCNTR.9684625)"
          className="w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-3 text-sm text-fg outline-none placeholder:text-muted focus:border-primary"
        />
      </div>
      <button
        type="submit"
        className="rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-fg transition hover:opacity-90"
      >
        Analizar
      </button>
    </form>
  );
}
