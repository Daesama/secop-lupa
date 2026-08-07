"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { formatCOP } from "@/lib/utils/format";
import type { GraphData } from "@/lib/queries";

const W = 640;
const H = 460;
const CX = W / 2;
const CY = H / 2;
const R = 165;
const MAX = 14;

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function NetworkGraph({ data }: { data: GraphData }) {
  const [hover, setHover] = useState<number | null>(null);
  const list = data.nodes.slice(0, MAX);
  const extra = data.nodes.length - list.length;
  const accent = data.accent;

  const nodes = list.map((c, i) => {
    const angle = (2 * Math.PI * i) / list.length - Math.PI / 2;
    return { ...c, x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle), angle };
  });

  return (
    <section className="card-soft mt-6 overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <span
          className="grid h-7 w-7 place-items-center rounded-lg"
          style={{ color: accent, backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)` }}
        >
          <Share2 className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-fg">Red de contratación</h2>
          <p className="text-[11px] text-muted">
            {list.length} vínculo(s). Pasa el cursor sobre cada nodo.
          </p>
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <defs>
            <radialGradient id="hubgrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={accent} stopOpacity={0.85} />
              <stop offset="100%" stopColor={accent} />
            </radialGradient>
          </defs>

          {nodes.map((n, i) => (
            <line
              key={`e${i}`}
              x1={CX}
              y1={CY}
              x2={n.x}
              y2={n.y}
              strokeWidth={hover === i ? 2.5 : 1.5}
              className="ng-edge"
              style={{
                animationDelay: `${i * 40}ms`,
                stroke: hover === i ? accent : "var(--border)",
              }}
            />
          ))}

          {nodes.map((n, i) => {
            const r = 9 + Math.min(11, Math.log10((n.value || 1) / 1e7 + 1) * 6);
            const rightSide = Math.cos(n.angle) >= 0;
            return (
              <g
                key={`n${i}`}
                className="ng-node cursor-pointer"
                style={{ animationDelay: `${120 + i * 45}ms` }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r}
                  fill={hover === i ? accent : "var(--primary)"}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
                <text
                  x={n.x + (rightSide ? r + 6 : -(r + 6))}
                  y={n.y + 4}
                  textAnchor={rightSide ? "start" : "end"}
                  className="fill-[color:var(--muted)] text-[11px] font-medium"
                >
                  {truncate(n.name, 16)}
                </text>
              </g>
            );
          })}

          <g className="ng-hub">
            <circle cx={CX} cy={CY} r={32} fill="url(#hubgrad)" />
            <circle cx={CX} cy={CY} r={32} fill="none" stroke={accent} strokeOpacity={0.25} strokeWidth={12} />
            <Share2 x={CX - 10} y={CY - 10} width={20} height={20} color="#fff" />
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-1 px-4 text-center">
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: accent }}
          >
            {truncate(data.hub, 40)}
          </span>
          <span className="text-[11px] text-muted">
            {truncate(data.subtitle, 46)} · {formatCOP(data.totalValue)}
            {extra > 0 ? ` · +${extra} más` : ""}
          </span>
        </div>

        {hover !== null && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-1.5 text-center text-xs shadow-lg">
            <div className="font-semibold text-fg">{list[hover].name}</div>
            <div className="text-muted">
              {list[hover].count} contrato(s) · {formatCOP(list[hover].value)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
