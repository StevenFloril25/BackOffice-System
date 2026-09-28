export default function Cargando() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-slate-200/70" />
        <div className="h-4 w-80 max-w-full rounded-lg bg-slate-200/50" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-white shadow-tarjeta" />
        ))}
      </div>
      <div className="h-80 rounded-2xl bg-white shadow-tarjeta" />
    </div>
  );
}
