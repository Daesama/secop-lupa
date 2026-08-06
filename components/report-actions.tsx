"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileBarChart, Loader2, Printer } from "lucide-react";

export function GenerateReportButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al generar");
      router.push(`/reports/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={generate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Redactando con IA…
          </>
        ) : (
          <>
            <FileBarChart className="h-4 w-4" /> Generar nuevo reporte
          </>
        )}
      </button>
      {error && <p className="text-sm text-critical">{error}</p>}
    </div>
  );
}

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition hover:opacity-90 print:hidden"
    >
      <Printer className="h-4 w-4" /> Descargar PDF
    </button>
  );
}
