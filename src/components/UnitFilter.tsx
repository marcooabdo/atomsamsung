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
  const { usuario, unidadesAdicionais } = useAuth();

  const canSeeAllUnits = (usuario?.tipo === 'master' || usuario?.tipo === 'diretoria') && !usuario?.unidade_id;
  const userUnidade = usuario?.unidade_id;
  const hasAdditionalUnits = unidadesAdicionais.length > 0;

  if (!canSeeAllUnits && !hasAdditionalUnits) {
    if (!userUnidade) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30">
          <Building2 className="w-4 h-4 text-red-400" />
          <span className="text-xs font-semibold text-red-300">Sem unidade vinculada</span>
        </div>
      );
    }
    const unidade = unidades.find(u => u.id === userUnidade);
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00D4FF]/5 border border-[#00D4FF]/20">
        <Building2 className="w-4 h-4 text-[#00D4FF]" />
        <span className="text-xs font-semibold text-[#00D4FF]">{unidade?.nome || 'Carregando...'}</span>
      </div>
    );
  }

  const availableUnits = canSeeAllUnits
    ? unidades
    : unidades.filter(u => u.id === userUnidade || unidadesAdicionais.includes(u.id));

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00D4FF]/5 border border-[#00D4FF]/20">
      <Building2 className="w-4 h-4 text-[#00D4FF]" />
      <select
        value={selectedUnidade}
        onChange={(e) => onUnidadeChange(e.target.value)}
        className="neon-input py-1 text-xs"
      >
        {canSeeAllUnits && <option value="">Todas as Unidades</option>}
        {!canSeeAllUnits && <option value="">Minhas Unidades</option>}
        {availableUnits.map(u => (
          <option key={u.id} value={u.id}>{u.nome}</option>
        ))}
      </select>
    </div>
  );
}
