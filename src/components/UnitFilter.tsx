import { useAuth } from '../contexts/AuthContext';
import { Building2 } from 'lucide-react';

interface Unidade {
  id: string;
  nome: string;
}

interface UnitFilterProps {
  unidades: Unidade[];
  selectedUnidade: string;
  onUnidadeChange: (unidadeId: string) => void;
}

export function UnitFilter({ unidades, selectedUnidade, onUnidadeChange }: UnitFilterProps) {
  const { usuario } = useAuth();

  const canSelectAllUnits = usuario?.tipo === 'master' || usuario?.tipo === 'diretoria';
  const userUnidade = usuario?.unidade_id;

  if (!canSelectAllUnits && userUnidade) {
    const unidade = unidades.find(u => u.id === userUnidade);
    return (
      <div className="premium-card p-4 bg-[#00D4FF]/5 border border-[#00D4FF]/20">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-[#00D4FF]" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Unidade</p>
            <p className="text-sm font-semibold text-[#00D4FF]">{unidade?.nome || 'Carregando...'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-card p-4 bg-[#00D4FF]/5 border border-[#00D4FF]/20">
      <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
        <Building2 className="w-4 h-4" />
        Filtrar por Unidade
      </label>
      <select
        value={selectedUnidade}
        onChange={(e) => onUnidadeChange(e.target.value)}
        className="neon-input"
      >
        <option value="">Todas as Unidades</option>
        {unidades.map(u => (
          <option key={u.id} value={u.id}>{u.nome}</option>
        ))}
      </select>
    </div>
  );
}
