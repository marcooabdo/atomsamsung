interface BadgeTipoOSProps {
  tipo: 'LP' | 'OW';
}

export function BadgeTipoOS({ tipo }: BadgeTipoOSProps) {
  return (
    <span
      className="px-2 py-1 rounded text-xs font-bold"
      style={{
        backgroundColor: tipo === 'LP' ? '#FFA50030' : '#00D4FF30',
        color: tipo === 'LP' ? '#FFA500' : '#00D4FF',
        border: `1px solid ${tipo === 'LP' ? '#FFA500' : '#00D4FF'}60`
      }}
    >
      {tipo}
    </span>
  );
}
