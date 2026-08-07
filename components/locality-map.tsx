"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { formatCOP } from "@/lib/utils/format";

// Disposición esquemática (aprox. norte→sur) de las 20 localidades de Bogotá.
// `k` es un fragmento distintivo para casar con los datos normalizados.
const TILES: { label: string; k: string; col: number; row: number }[] = [
  { label: "Suba", k: "SUBA", col: 1, row: 1 },
  { label: "Usaquén", k: "USAQUEN", col: 4, row: 1 },
  { label: "Engativá", k: "ENGATIVA", col: 1, row: 2 },
  { label: "Barrios Unidos", k: "BARRIOS", col: 3, row: 2 },
  { label: "Chapinero", k: "CHAPINERO", col: 4, row: 2 },
  { label: "Fontibón", k: "FONTIBON", col: 1, row: 3 },
  { label: "Teusaquillo", k: "TEUSAQUILLO", col: 3, row: 3 },
  { label: "Santa Fe", k: "SANTAFE", col: 4, row: 3 },
  { label: "Kennedy", k: "KENNEDY", col: 1, row: 4 },
  { label: "Puente Aranda", k: "PUENTEARANDA", col: 2, row: 4 },
  { label: "Los Mártires", k: "MARTIRES", col: 3, row: 4 },
  { label: "Candelaria", k: "CANDELARIA", col: 4, row: 4 },
  { label: "Bosa", k: "BOSA", col: 1, row: 5 },
  { label: "Antonio Nariño", k: "NARINO", col: 3, row: 5 },
  { label: "San Cristóbal", k: "CRISTOBAL", col: 4, row: 5 },
  { label: "Ciudad Bolívar", k: "BOLIVAR", col: 2, row: 6 },
  { label: "Tunjuelito", k: "TUNJUELITO", col: 3, row: 6 },
  { label: "Rafael Uribe", k: "URIBE", col: 4, row: 6 },
  { label: "Usme", k: "USME", col: 3, row: 7 },
  { label: "Sumapaz", k: "SUMAPAZ", col: 3, row: 8 },
];

type Data = Record<string, { count: number; value: number }>;

function findData(k: string, data: Data) {
  for (const key in data) if (key.includes(k) || k.includes(key)) return data[key];
  return null;
}

export function LocalityMap({ data }: { data: Data }) {
  const [hover, setHover] = useState<number | null>(null);
  const enriched = TILES.map((t) => ({ ...t, d: findData(t.k, data) }));
  const max = Math.max(1, ...enriched.map((t) => t.d?.value ?? 0));

  return (
    <section className="card-soft rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
          <MapPin className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-fg">
            Contratación por localidad
          </h3>
          <p className="text-[11px] text-muted">
            Valor contratado por Alcaldías Locales. Más oscuro = más plata.
          </p>
        </div>
      </div>

      <div className="relative mt-4">
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gridTemplateRows: "repeat(8, minmax(0, 1fr))",
          }}
        >
          {enriched.map((t, i) => {
            const v = t.d?.value ?? 0;
            const intensity = v > 0 ? 0.18 + 0.82 * (v / max) : 0;
            return (
              <div
                key={t.label}
                style={{
                  gridColumn: t.col,
                  gridRow: t.row,
                  backgroundColor:
                    v > 0
                      ? `color-mix(in srgb, var(--primary) ${Math.round(intensity * 100)}%, var(--surface))`
                      : "var(--surface-2)",
                }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className="flex aspect-square cursor-default flex-col items-center justify-center rounded-lg border border-border p-1 text-center transition hover:ring-2 hover:ring-primary"
              >
                <span
                  className="text-[9px] font-semibold leading-tight sm:text-[10px]"
                  style={{ color: intensity > 0.55 ? "#fff" : "var(--muted)" }}
                >
                  {t.label}
                </span>
              </div>
            );
          })}
        </div>

        {hover !== null && enriched[hover].d && (
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-1.5 text-center text-xs shadow-lg">
            <div className="font-semibold text-fg">{enriched[hover].label}</div>
            <div className="text-muted">
              {formatCOP(enriched[hover].d!.value)} · {enriched[hover].d!.count} contratos
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
