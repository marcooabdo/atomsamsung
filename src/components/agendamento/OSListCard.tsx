import { MapPin, Clock, Package, Phone, Navigation, CheckCircle, AlertCircle, Wrench, AlertTriangle, RotateCcw } from 'lucide-react';
import { getStatusColor, getStatusLabel } from './CustomMarker';
import { normalizarCidade } from '../../lib/cidadeNormalize';

interface OSListCardProps {
  agendamento: any;
  isSelected: boolean;
  onClick: () => void;
  showDistance?: boolean;
  distanceKm?: number;
}

export function OSListCard({ agendamento, isSelected, onClick, showDistance, distanceKm }: OSListCardProps) {
  const statusColor = getStatusColor(agendamento.status || 'pendente');
  const statusLabel = getStatusLabel(agendamento.status || 'pendente');

  const tempoEmAtendimento = () => {
    if (agendamento.status !== 'em_andamento' || !agendamento.tem_checkin) return null;

    return 'Em atendimento';
  };

  return (
    <div
      onClick={onClick}
      className={`premium-card p-4 cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'ring-2 ring-offset-2 ring-offset-black'
          : 'hover:scale-[1.02]'
      }`}
      style={{
        borderColor: isSelected ? statusColor : `${statusColor}40`,
        boxShadow: isSelected ? `0 0 20px ${statusColor}60` : 'none'
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: statusColor }}
          />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: statusColor }}>
            {statusLabel}
          </span>
        </div>

        {showDistance && distanceKm !== undefined && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Navigation className="w-3 h-3" />
            {distanceKm.toFixed(1)} km
          </div>
        )}
      </div>

      {agendamento.resultado_visita && (
        <div className={`flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-md text-xs font-bold border ${
          agendamento.resultado_visita === 'reparo_sucesso'
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            : agendamento.resultado_visita === 'peca_defeito'
            ? 'bg-red-500/15 text-red-400 border-red-500/30'
            : agendamento.resultado_visita === 'improdutiva_revisita'
            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
        }`}>
          {agendamento.resultado_visita === 'reparo_sucesso' ? (
            <><Wrench className="w-3.5 h-3.5" /> Reparo com Sucesso</>
          ) : agendamento.resultado_visita === 'peca_defeito' ? (
            <><AlertTriangle className="w-3.5 h-3.5" /> Peça com Defeito</>
          ) : agendamento.resultado_visita === 'improdutiva_revisita' ? (
            <><RotateCcw className="w-3.5 h-3.5" /> Improdutiva / Revisita</>
          ) : (
            agendamento.resultado_visita
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-white font-bold text-sm">
              {agendamento.cliente_nome || 'Cliente não informado'}
            </h3>
            <p className="text-xs text-gray-400">
              OS: {agendamento.numero_os_samsung || agendamento.numero_os_interna || 'S/N'}
            </p>
          </div>

          {agendamento.tipo_atendimento && (
            <span
              className="px-2 py-1 rounded text-xs font-bold"
              style={{
                backgroundColor: `${statusColor}20`,
                color: statusColor,
                border: `1px solid ${statusColor}40`
              }}
            >
              {agendamento.tipo_atendimento}
            </span>
          )}
        </div>

        {agendamento.cliente_telefone && (
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <Phone className="w-3 h-3" />
            {agendamento.cliente_telefone}
          </div>
        )}

        {agendamento.cliente_endereco && (
          <div className="flex items-start gap-2 text-xs text-gray-300">
            <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-2">
              {agendamento.cliente_endereco}
              {agendamento.cliente_bairro && `, ${agendamento.cliente_bairro}`}
              {agendamento.cliente_cidade && ` - ${normalizarCidade(agendamento.cliente_cidade)}`}
            </span>
          </div>
        )}

        {agendamento.horario_inicio && (
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <Clock className="w-3 h-3" />
            {agendamento.horario_inicio} - {agendamento.horario_fim || ''}
          </div>
        )}

        {tempoEmAtendimento() && (
          <div className="flex items-center gap-2 text-xs text-[#00D4FF] font-semibold">
            <Clock className="w-3 h-3 animate-pulse" />
            {tempoEmAtendimento()}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2 border-t border-gray-700/50">
          {agendamento.tem_checkin && (
            <div className="flex items-center gap-1 text-xs text-[#39FF14]">
              <CheckCircle className="w-3 h-3" />
              Check-in
            </div>
          )}

          {agendamento.tem_checkout && (
            <div className="flex items-center gap-1 text-xs text-[#39FF14]">
              <CheckCircle className="w-3 h-3" />
              Check-out
            </div>
          )}

          {agendamento.pecas_ativas > 0 && (
            <div className="flex items-center gap-1 text-xs text-[#FFBF00]">
              <Package className="w-3 h-3" />
              {agendamento.pecas_ativas} peça{agendamento.pecas_ativas > 1 ? 's' : ''}
            </div>
          )}

          {agendamento.os_confirmado_cliente && (
            <div className="flex items-center gap-1 text-xs text-[#9D4EDD]">
              <CheckCircle className="w-3 h-3" />
              Confirmado
            </div>
          )}

          {!agendamento.os_confirmado_cliente && agendamento.status === 'confirmado' && (
            <div className="flex items-center gap-1 text-xs text-[#FF0064]">
              <AlertCircle className="w-3 h-3" />
              Pendente Confirmação
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
