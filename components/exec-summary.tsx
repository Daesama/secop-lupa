"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

export function ExecSummary() {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/summary")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setText(d.summary ?? "");
      })
      .catch(() => alive && setText(""))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (!loading && !text) return null;

  return (
    <div className="card-soft mt-4 flex items-start gap-3 rounded-2xl p-5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">
          Resumen ejecutivo · IA
        </div>
        {loading ? (
          <div className="mt-2 space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-surface-2" />
            <div className="h-3 w-11/12 animate-pulse rounded bg-surface-2" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-surface-2" />
          </div>
        ) : (
          <p className="mt-1.5 leading-relaxed text-fg/90">{text}</p>
        )}
      </div>
    </div>
  );
}
