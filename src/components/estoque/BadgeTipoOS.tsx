interface BadgeTipoOSProps {
  tipo: 'LP' | 'OW';
}

export function BadgeTipoOS({ tipo }: BadgeTipoOSProps) {
  return (
    <span
      className="px-2 py-1 rounded text-xs font-bold"
      style={{
        backgroundColor: tipo === 'LP' ? '#FFA50030' : 'rgba(var(--accent-rgb), 0.19)',
        color: tipo === 'LP' ? '#FFA500' : 'var(--text-accent)',
        border: tipo === 'LP' ? '1px solid #FFA50060' : '1px solid rgba(var(--accent-rgb), 0.38)'
      }}
    >
      {tipo}
    </span>
  );
}
