import { FileSearch } from "lucide-react";
import { ContractSearch } from "@/components/contract-search";

export const dynamic = "force-dynamic";

export default function ContractsPage() {
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
            Pega el ID de cualquier contrato de SECOP II —aunque no tenga
            alerta— y la IA lo evalúa.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ContractSearch />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
        <p className="font-medium text-fg">¿Cómo funciona?</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Buscamos el contrato en la base; si no está, lo traemos en vivo de SECOP.</li>
          <li>Calculamos señales reales (comparación por categoría, historial del contratista, concentración de la entidad).</li>
          <li>La IA evalúa confiabilidad, qué lo hace dudoso y qué verificar, y puedes chatear o pedir la ruta de acción.</li>
        </ul>
        <p className="mt-3 text-xs">
          El ID tiene la forma <code className="rounded bg-surface-2 px-1">CO1.PCCNTR.XXXXXXX</code>{" "}
          y aparece en la URL/detalle del contrato en SECOP II.
        </p>
      </div>
    </div>
  );
}
