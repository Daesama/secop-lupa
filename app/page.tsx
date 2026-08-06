export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold text-[#1a365d]">
        Seguimiento SECOP II — Bogotá
      </h1>
      <p className="text-gray-600">
        Análisis con IA de la contratación pública de Bogotá para control
        político. El pipeline de datos (Hito 1) ya está en marcha: sincroniza
        contratos de SECOP II hacia la base de datos.
      </p>
      <p className="text-sm text-gray-500">
        Dashboard, alertas y reportes llegan en los próximos hitos. Consulta{" "}
        <code className="rounded bg-gray-100 px-1 py-0.5">SETUP.md</code> para la
        puesta en marcha.
      </p>
    </main>
  );
}
