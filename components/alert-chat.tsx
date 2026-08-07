"use client";

import { useRef, useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "¿Por qué es sospechoso este contrato?",
  "¿El contratista tiene otros contratos en el distrito?",
  "¿Qué debería verificar el concejal?",
];

export function AlertChat({
  alertId,
  secopId,
}: {
  alertId?: string;
  secopId?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId, secopId, messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error del servidor");
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }),
      );
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-fg">
            Pregúntale a la IA sobre este contrato
          </h2>
          <p className="text-[11px] text-muted">
            Responde solo con datos reales de SECOP II. Amerita verificación.
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="max-h-[420px] space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted transition hover:border-primary/50 hover:text-fg"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-fg"
                  : "bg-surface-2 text-fg"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Consultando los datos…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-critical-bd bg-critical-bg px-3 py-2 text-sm text-critical">
            {error}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta…"
          className="flex-1 rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-fg outline-none placeholder:text-muted focus:border-primary"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-fg transition hover:opacity-90 disabled:opacity-40"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
