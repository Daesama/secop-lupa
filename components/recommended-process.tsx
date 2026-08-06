"use client";

import { useState } from "react";
import {
  Compass,
  Loader2,
  AlertTriangle,
  FileText,
  Copy,
  Check,
} from "lucide-react";

interface Paso {
  titulo: string;
  detalle: string;
}
interface DerechoPeticion {
  asunto: string;
  destinatario: string;
  cuerpo: string;
}
interface Ruta {
  advertencia: string;
  pasos: Paso[];
  preguntas_derecho_peticion: string[];
  derecho_peticion: DerechoPeticion;
}

export function RecommendedProcess({ alertId }: { alertId: string }) {
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error del servidor");
      setRuta(data as Ruta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  function copyPeticion() {
    if (!ruta) return;
    const dp = ruta.derecho_peticion;
    navigator.clipboard.writeText(
      `Asunto: ${dp.asunto}\nPara: ${dp.destinatario}\n\n${dp.cuerpo}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
          <Compass className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-fg">Ruta recomendada</h2>
          <p className="text-[11px] text-muted">
            Qué hacer para verificar los hechos antes de cualquier denuncia.
          </p>
        </div>
      </div>

      <div className="px-5 py-4">
        {!ruta && !loading && (
          <button
            onClick={generate}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition hover:opacity-90"
          >
            <Compass className="h-4 w-4" /> Generar ruta recomendada
          </button>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Analizando el debido
            proceso…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-critical-bd bg-critical-bg px-3 py-2 text-sm text-critical">
            {error}
          </div>
        )}

        {ruta && (
          <div className="space-y-5">
            {/* Advertencia */}
            <div className="flex gap-3 rounded-xl border border-suspicious-bd bg-suspicious-bg p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-suspicious" />
              <p className="text-sm leading-relaxed text-fg">
                {ruta.advertencia}
              </p>
            </div>

            {/* Pasos */}
            <ol className="space-y-3">
              {ruta.pasos.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-fg">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-fg">{p.titulo}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted">
                      {p.detalle}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            {/* Derecho de petición */}
            <div className="rounded-xl border border-border bg-bg">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-fg">
                  Borrador de derecho de petición
                </span>
                <button
                  onClick={copyPeticion}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted transition hover:text-fg"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-low" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </>
                  )}
                </button>
              </div>
              <div className="space-y-1 px-4 py-3 text-sm">
                <p>
                  <span className="text-muted">Para:</span>{" "}
                  <span className="text-fg">
                    {ruta.derecho_peticion.destinatario}
                  </span>
                </p>
                <p>
                  <span className="text-muted">Asunto:</span>{" "}
                  <span className="text-fg">{ruta.derecho_peticion.asunto}</span>
                </p>
                <p className="mt-2 whitespace-pre-line leading-relaxed text-fg">
                  {ruta.derecho_peticion.cuerpo}
                </p>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-muted">
              Guía procedimental generada con IA a partir de datos públicos. No
              sustituye asesoría jurídica; verifique la información antes de
              actuar.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
