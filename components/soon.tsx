import { Construction } from "lucide-react";

export function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-fg">{title}</h1>
      <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-surface-2 text-muted">
          <Construction className="h-6 w-6" />
        </div>
        <p className="mt-4 max-w-sm text-sm text-muted">{note}</p>
      </div>
    </div>
  );
}
