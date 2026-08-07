import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSearch, ChevronRight } from "lucide-react";
import { ContractSearch } from "@/components/contract-search";
import { searchContracts } from "@/lib/queries";
import { formatCOP } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  // Si la búsqueda contiene un ID de SECOP, ir directo al análisis del contrato.
  const idMatch = q?.match(/CO1\.(?:PCCNTR|NTC)\.[0-9]+/i);
  if (idMatch) redirect(`/contracts/${encodeURIComponent(idMatch[0].toUpperCase())}`);
  const results = q ? await searchContracts(q) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <FileSearch className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-fg">
            Analizar un contrato
          </h1>
          <p className="mt-1 text-muted">
            Busca por contratista, entidad, objeto o ID. La IA lo evalúa.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ContractSearch initial={q ?? ""} />
      </div>

      {q ? (
        results.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
            <p className="font-medium text-fg">Sin resultados para “{q}”</p>
            <p className="mt-1 text-sm text-muted">
              Busca por otro término, o si tienes el ID del contrato
              (CO1.PCCNTR.…) puedes{" "}
              <Link
                href={`/contracts/${encodeURIComponent(q)}`}
                className="text-primary hover:underline"
              >
                analizarlo directamente
              </Link>{" "}
              (lo traemos en vivo de SECOP si no está en la base).
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            <p className="text-sm text-muted">{results.length} resultado(s)</p>
            {results.map((c) => (
              <Link
                key={c.secop_id}
                href={`/contracts/${encodeURIComponent(c.secop_id)}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition hover:border-primary/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-fg">
                    {c.contractor_name ?? "—"}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {c.entity_name} · {c.contract_object ?? ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">{c.secop_id}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-fg">
                  {formatCOP(c.contract_value)}
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
              </Link>
            ))}
          </div>
        )
      ) : (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
          <p className="font-medium text-fg">¿Cómo funciona?</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              Busca por nombre del contratista, entidad, objeto, o pega un ID
              (de contrato CO1.PCCNTR o de proceso CO1.NTC).
            </li>
            <li>
              Elige el contrato de los resultados; la IA lo evalúa (confiabilidad,
              qué lo hace dudoso, qué verificar) y puedes pedir la ruta o chatear.
            </li>
            <li>
              Si el ID de contrato no está en la base, lo traemos en vivo de SECOP.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
