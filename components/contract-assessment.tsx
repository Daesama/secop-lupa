"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";

interface Assessment {
  nivel_sospecha: "alto" | "medio" | "bajo";
  confiabilidad: string;
  resumen: string;
  factores_de_duda: string[];
  que_verificar: string[];
}

const NIVEL = {
  alto: { label: "Sospecha alta", cls: "bg-critical-bg text-critical border-critical-bd", Icon: AlertTriangle },
  medio: { label: "Sospecha media", cls: "bg-suspicious-bg text-suspicious border-suspicious-bd", Icon: HelpCircle },
  bajo: { label: "Sospecha baja", cls: "bg-low-bg text-low border-low-bd", Icon: CheckCircle2 },
};

export function ContractAssessment({ secopId }: { secopId: string }) {
  const [a, setA] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secopId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error del servidor");
      setA(data as Assessment);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-fg">Evaluación con IA</h2>
          <p className="text-[11px] text-muted">
            Confiabilidad, factores de duda y qué verificar, a partir de las
            señales reales.
          </p>
        </div>
      </div>

      <div className="px-5 py-4">
        {!a && !loading && (
          <button
            onClick={run}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" /> Evaluar este contrato
          </button>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Evaluando con los datos…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-critical-bd bg-critical-bg px-3 py-2 text-sm text-critical">
            {error}
          </div>
        )}

        {a && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {(() => {
                const n = NIVEL[a.nivel_sospecha] ?? NIVEL.medio;
                return (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${n.cls}`}
                  >
                    <n.Icon className="h-4 w-4" /> {n.label}
                  </span>
                );
              })()}
              <span className="text-sm text-muted">{a.confiabilidad}</span>
            </div>

            <p className="leading-relaxed text-fg/90">{a.resumen}</p>

            {a.factores_de_duda.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-fg">
                  Qué lo hace dudoso
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {a.factores_de_duda.map((f, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-suspicious" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {a.que_verificar.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-fg">Qué verificar</h3>
                <ul className="mt-2 space-y-1.5">
                  {a.que_verificar.map((q, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
