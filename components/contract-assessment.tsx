"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Scale,
  Search,
  ShieldCheck,
  Check,
} from "lucide-react";

interface Assessment {
  nivel_sospecha: "alto" | "medio" | "bajo";
  puntaje: number;
  titular: string;
  resumen_ejecutivo: string;
  confiabilidad: { nivel: "alta" | "media" | "baja"; motivo: string };
  dimensiones: {
    dimension: string;
    estado: "normal" | "atencion" | "critico" | "sin_datos";
    lectura: string;
  }[];
  hallazgos: {
    titulo: string;
    evidencia: string;
    implicacion: string;
    solidez: "alta" | "media" | "baja";
  }[];
  explicaciones_legitimas: string[];
  que_verificar: { accion: string; donde: string; para_que: string }[];
  limitaciones: string[];
}

const NIVEL = {
  alto: {
    label: "Sospecha alta",
    cls: "bg-critical-bg text-critical border-critical-bd",
    bar: "var(--critical)",
    Icon: AlertTriangle,
  },
  medio: {
    label: "Sospecha media",
    cls: "bg-suspicious-bg text-suspicious border-suspicious-bd",
    bar: "var(--suspicious)",
    Icon: HelpCircle,
  },
  bajo: {
    label: "Sospecha baja",
    cls: "bg-low-bg text-low border-low-bd",
    bar: "var(--low)",
    Icon: CheckCircle2,
  },
};

const DIMENSION_LABEL: Record<string, string> = {
  precio: "Precio",
  competencia: "Competencia",
  concentracion: "Concentración",
  ejecucion: "Ejecución",
  red: "Red societaria",
  integridad_datos: "Integridad del dato",
};

const ESTADO: Record<string, { color: string; label: string }> = {
  normal: { color: "var(--low)", label: "Normal" },
  atencion: { color: "var(--suspicious)", label: "Atención" },
  critico: { color: "var(--critical)", label: "Crítico" },
  sin_datos: { color: "var(--muted)", label: "Sin datos" },
};

const SOLIDEZ: Record<string, string> = {
  alta: "Evidencia sólida",
  media: "Evidencia media",
  baja: "Evidencia débil",
};

/** Etapas del análisis: la evaluación tarda, y el usuario debe ver por qué. */
const ETAPAS = [
  "Reuniendo el universo comparable de la categoría…",
  "Cruzando historial del contratista y de la entidad…",
  "Midiendo concentración, ritmo y red societaria…",
  "Redactando la evaluación con las cifras…",
];

export function ContractAssessment({ secopId }: { secopId: string }) {
  const [a, setA] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [etapa, setEtapa] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);

  async function run() {
    setLoading(true);
    setError(null);
    setEtapa(0);
    timer.current = setInterval(
      () => setEtapa((e) => Math.min(e + 1, ETAPAS.length - 1)),
      6000,
    );
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
      if (timer.current) clearInterval(timer.current);
      setLoading(false);
    }
  }

  const n = a ? (NIVEL[a.nivel_sospecha] ?? NIVEL.medio) : null;

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-fg">Evaluación forense con IA</h2>
          <p className="text-[11px] text-muted">
            Cifras calculadas sobre datos reales de SECOP II; la IA solo interpreta
            y cita la evidencia.
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
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-fg">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {ETAPAS[etapa]}
            </div>
            <p className="text-[11px] text-muted">
              El análisis profundo puede tardar hasta un minuto.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-critical-bd bg-critical-bg px-3 py-2 text-sm text-critical">
            {error}
          </div>
        )}

        {a && n && (
          <div className="space-y-6">
            {/* Veredicto */}
            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${n.cls}`}
                >
                  <n.Icon className="h-4 w-4" /> {n.label}
                </span>
                <span className="text-sm font-semibold tabular-nums text-fg">
                  {a.puntaje}
                  <span className="text-muted">/100</span>
                </span>
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Confiabilidad {a.confiabilidad.nivel}
                </span>
              </div>

              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(0, Math.min(100, a.puntaje))}%`,
                    background: n.bar,
                  }}
                />
              </div>

              <h3 className="mt-4 font-display text-lg font-bold leading-snug text-fg text-balance">
                {a.titular}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-fg/90">
                {a.resumen_ejecutivo}
              </p>
              <p className="mt-3 border-t border-border pt-2.5 text-[11px] leading-relaxed text-muted">
                <span className="font-medium text-fg/70">Sobre los datos:</span>{" "}
                {a.confiabilidad.motivo}
              </p>
            </div>

            {/* Semáforo por dimensión */}
            {a.dimensiones.length > 0 && (
              <div>
                <SectionTitle>Diagnóstico por dimensión</SectionTitle>
                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  {a.dimensiones.map((d, i) => {
                    const e = ESTADO[d.estado] ?? ESTADO.sin_datos;
                    return (
                      <div
                        key={i}
                        className="rounded-xl border border-border bg-surface p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: e.color }}
                          />
                          <span className="text-xs font-semibold text-fg">
                            {DIMENSION_LABEL[d.dimension] ?? d.dimension}
                          </span>
                          <span
                            className="ml-auto text-[10px] font-medium uppercase tracking-wide"
                            style={{ color: e.color }}
                          >
                            {e.label}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted">
                          {d.lectura}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hallazgos con su evidencia */}
            {a.hallazgos.length > 0 && (
              <div>
                <SectionTitle>Hallazgos y su evidencia</SectionTitle>
                <div className="mt-2.5 space-y-2.5">
                  {a.hallazgos.map((h, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border bg-surface p-3.5"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-suspicious" />
                        <h4 className="flex-1 text-sm font-semibold text-fg">
                          {h.titulo}
                        </h4>
                        <span className="shrink-0 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted">
                          {SOLIDEZ[h.solidez] ?? h.solidez}
                        </span>
                      </div>
                      <p className="mt-2.5 rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-[11px] leading-relaxed tabular-nums text-fg/90">
                        {h.evidencia}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-muted">
                        {h.implicacion}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contrapeso */}
            {a.explicaciones_legitimas.length > 0 && (
              <div className="rounded-xl border border-border bg-surface-2 p-3.5">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-fg">
                    Por qué podría ser normal
                  </h3>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {a.explicaciones_legitimas.map((e, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Plan de verificación */}
            {a.que_verificar.length > 0 && (
              <div>
                <SectionTitle>Plan de verificación</SectionTitle>
                <ol className="mt-2.5 space-y-2.5">
                  {a.que_verificar.map((q, i) => (
                    <li
                      key={i}
                      className="flex gap-3 rounded-xl border border-border bg-surface p-3.5"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-fg">{q.accion}</p>
                        <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                          <Search className="h-3 w-3" /> {q.donde}
                        </p>
                        <p className="mt-1.5 flex gap-1.5 text-xs leading-relaxed text-muted">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-low" />
                          {q.para_que}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Límites del análisis */}
            {a.limitaciones.length > 0 && (
              <div className="border-t border-border pt-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Qué NO permite concluir este análisis
                </h3>
                <ul className="mt-1.5 space-y-1">
                  {a.limitaciones.map((l, i) => (
                    <li key={i} className="text-[11px] leading-relaxed text-muted">
                      · {l}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={run}
              className="text-xs font-medium text-primary hover:underline"
            >
              Volver a evaluar
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
      {children}
    </h3>
  );
}
