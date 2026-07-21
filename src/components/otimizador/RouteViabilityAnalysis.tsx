import { useState, useMemo } from 'react';
import {
  DollarSign, Fuel, BedDouble, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Settings2, Info, Truck, Target
} from 'lucide-react';

interface OSFinanceiro {
  id: string;
  numero_os: string;
  tipo_os: string;
  is_cortesia: boolean;
  valor_total: number;
  lucro_ow: number;
  km_ida_volta: number;
  cliente_nome: string;
  cliente_cidade: string;
}

interface RouteViabilityProps {
  osFinanceiros: OSFinanceiro[];
  kmTotal: number;
  diasPernoite: number;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function RouteViabilityAnalysis({ osFinanceiros, kmTotal, diasPernoite }: RouteViabilityProps) {
  const [expanded, setExpanded] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  const [custoKmLitro, setCustoKmLitro] = useState(6);
  const [kmPorLitro, setKmPorLitro] = useState(8);
  const [custoHotelDia, setCustoHotelDia] = useState(200);
  const [valorKmLP, setValorKmLP] = useState(1.38);
  const [multiplicadorMinimo, setMultiplicadorMinimo] = useState(5);

  const analise = useMemo(() => {
    let receitaOW = 0;
    let receitaLP = 0;
    let qtdOW = 0;
    let qtdLP = 0;
    let qtdCortesia = 0;

    const detalhes: Array<{
      numero_os: string;
      tipo: string;
      receita: number;
      descricao: string;
      cliente_nome: string;
      cliente_cidade: string;
    }> = [];

    for (const os of osFinanceiros) {
      if (os.tipo_os === 'OW' && !os.is_cortesia) {
        const lucro = os.lucro_ow;
        receitaOW += lucro;
        qtdOW++;
        detalhes.push({
          numero_os: os.numero_os,
          tipo: 'OW',
          receita: lucro,
          descricao: `Lucro OS OW`,
          cliente_nome: os.cliente_nome,
          cliente_cidade: os.cliente_cidade,
        });
      } else {
        const kmValor = os.km_ida_volta * valorKmLP;
        receitaLP += kmValor;
        const kmSo = (os.km_ida_volta / 2).toFixed(1);
        if (os.is_cortesia) {
          qtdCortesia++;
          detalhes.push({
            numero_os: os.numero_os,
            tipo: 'Cortesia',
            receita: kmValor,
            descricao: `Base-Cliente ${kmSo}km x2 = ${os.km_ida_volta.toFixed(1)}km x ${formatCurrency(valorKmLP)}`,
            cliente_nome: os.cliente_nome,
            cliente_cidade: os.cliente_cidade,
          });
        } else {
          qtdLP++;
          detalhes.push({
            numero_os: os.numero_os,
            tipo: 'LP',
            receita: kmValor,
            descricao: `Base-Cliente ${kmSo}km x2 = ${os.km_ida_volta.toFixed(1)}km x ${formatCurrency(valorKmLP)}`,
            cliente_nome: os.cliente_nome,
            cliente_cidade: os.cliente_cidade,
          });
        }
      }
    }

    const receitaTotal = receitaOW + receitaLP;

    const litrosConsumidos = kmTotal / kmPorLitro;
    const custoCombustivel = litrosConsumidos * custoKmLitro;
    const custoHotel = diasPernoite * custoHotelDia;
    const custoTotal = custoCombustivel + custoHotel;

    const multiplicador = custoTotal > 0 ? receitaTotal / custoTotal : 0;
    const viavel = multiplicador >= multiplicadorMinimo;

    const deficitParaViavel = viavel ? 0 : (custoTotal * multiplicadorMinimo) - receitaTotal;

    return {
      receitaOW,
      receitaLP,
      receitaTotal,
      custoCombustivel,
      custoHotel,
      custoTotal,
      multiplicador,
      viavel,
      deficitParaViavel,
      qtdOW,
      qtdLP,
      qtdCortesia,
      detalhes,
      litrosConsumidos,
    };
  }, [osFinanceiros, kmTotal, diasPernoite, custoKmLitro, kmPorLitro, custoHotelDia, valorKmLP, multiplicadorMinimo]);

  const badgeColor = analise.viavel ? '#10B981' : '#EF4444';
  const badgeIcon = analise.viavel ? CheckCircle2 : AlertTriangle;
  const BadgeIcon = badgeIcon;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${badgeColor}30` }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 transition-all"
        style={{ backgroundColor: badgeColor + '08' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: badgeColor + '20' }}
          >
            <BadgeIcon className="w-5 h-5" style={{ color: badgeColor }} />
          </div>
          <div className="text-left">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Análise de Viabilidade da Rota
            </span>
            <div className="flex items-center gap-3 mt-0.5">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: badgeColor + '20', color: badgeColor }}
              >
                {analise.viavel ? 'ROTA VIÁVEL' : 'ROTA NÃO VIÁVEL'}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {analise.multiplicador.toFixed(1)}x retorno ({multiplicadorMinimo}x mínimo)
              </span>
            </div>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
        ) : (
          <ChevronDown className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
        )}
      </button>

      {expanded && (
        <div className="p-5 space-y-5" style={{ backgroundColor: 'var(--bg-card)' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl p-3" style={{ backgroundColor: '#10B98110', border: '1px solid #10B98130' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5" style={{ color: '#10B981' }} />
                <span className="text-[10px] font-medium" style={{ color: '#10B981' }}>Receita Total</span>
              </div>
              <p className="text-lg font-bold" style={{ color: '#10B981' }}>{formatCurrency(analise.receitaTotal)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: '#EF444410', border: '1px solid #EF444430' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />
                <span className="text-[10px] font-medium" style={{ color: '#EF4444' }}>Custo Total</span>
              </div>
              <p className="text-lg font-bold" style={{ color: '#EF4444' }}>{formatCurrency(analise.custoTotal)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: badgeColor + '10', border: `1px solid ${badgeColor}30` }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-3.5 h-3.5" style={{ color: badgeColor }} />
                <span className="text-[10px] font-medium" style={{ color: badgeColor }}>Multiplicador</span>
              </div>
              <p className="text-lg font-bold" style={{ color: badgeColor }}>{analise.multiplicador.toFixed(1)}x</p>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: '#3B82F610', border: '1px solid #3B82F630' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3.5 h-3.5" style={{ color: '#3B82F6' }} />
                <span className="text-[10px] font-medium" style={{ color: '#3B82F6' }}>Saldo</span>
              </div>
              <p className="text-lg font-bold" style={{ color: '#3B82F6' }}>
                {formatCurrency(analise.receitaTotal - analise.custoTotal)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#10B981' }}>
                Receitas
              </h4>

              {analise.qtdOW > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#F9731615', color: '#F97316' }}>OW</span>
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Lucro OS Garantia ({analise.qtdOW})</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: '#10B981' }}>{formatCurrency(analise.receitaOW)}</span>
                </div>
              )}

              {(analise.qtdLP > 0 || analise.qtdCortesia > 0) && (
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#10B98115', color: '#10B981' }}>LP</span>
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      KM LP/Cortesia ({analise.qtdLP + analise.qtdCortesia})
                    </span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: '#10B981' }}>{formatCurrency(analise.receitaLP)}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#EF4444' }}>
                Custos
              </h4>
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="flex items-center gap-2">
                  <Fuel className="w-4 h-4" style={{ color: '#F59E0B' }} />
                  <div>
                    <span className="text-sm block" style={{ color: 'var(--text-primary)' }}>Combustivel</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                      {kmTotal.toFixed(0)} km / {kmPorLitro} km/l = {analise.litrosConsumidos.toFixed(1)}L x {formatCurrency(custoKmLitro)}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-bold" style={{ color: '#EF4444' }}>{formatCurrency(analise.custoCombustivel)}</span>
              </div>

              {diasPernoite > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="flex items-center gap-2">
                    <BedDouble className="w-4 h-4" style={{ color: '#6366F1' }} />
                    <div>
                      <span className="text-sm block" style={{ color: 'var(--text-primary)' }}>Hotel</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                        {diasPernoite} {diasPernoite === 1 ? 'diaria' : 'diarias'} x {formatCurrency(custoHotelDia)}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-bold" style={{ color: '#EF4444' }}>{formatCurrency(analise.custoHotel)}</span>
                </div>
              )}
            </div>
          </div>

          {!analise.viavel && (
            <div className="rounded-xl p-4" style={{ backgroundColor: '#EF444410', border: '1px solid #EF444430' }}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#EF4444' }}>
                    Rota não atinge o retorno mínimo de {multiplicadorMinimo}x
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Faltam <strong style={{ color: '#EF4444' }}>{formatCurrency(analise.deficitParaViavel)}</strong> em receita para atingir o multiplicador mínimo.
                    Considere:
                  </p>
                  <ul className="mt-2 space-y-1">
                    <li className="text-xs flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: '#F97316' }} />
                      Aprovar mais OS OW (garantia) para encaixar na rota
                    </li>
                    <li className="text-xs flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: '#10B981' }} />
                      Aguardar mais OS LP serem adicionadas a esta rota
                    </li>
                    <li className="text-xs flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: '#3B82F6' }} />
                      Agrupar com OS de outras rotas proximas
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {analise.viavel && (
            <div className="rounded-xl p-4" style={{ backgroundColor: '#10B98110', border: '1px solid #10B98130' }}>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#10B981' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#10B981' }}>
                    Rota viável! Retorno de {analise.multiplicador.toFixed(1)}x sobre o investimento
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    A receita estimada de {formatCurrency(analise.receitaTotal)} supera o custo operacional de {formatCurrency(analise.custoTotal)} em mais de {multiplicadorMinimo}x.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)' }}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Parametros de Custo
              {showConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showConfig && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3 p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
                <div>
                  <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Custo Combustivel (R$/L)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={custoKmLitro}
                    onChange={(e) => setCustoKmLitro(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Rendimento (km/L)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={kmPorLitro}
                    onChange={(e) => setKmPorLitro(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Hotel (R$/dia)
                  </label>
                  <input
                    type="number"
                    step="10"
                    min="0"
                    value={custoHotelDia}
                    onChange={(e) => setCustoHotelDia(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Valor KM LP (R$/km)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorKmLP}
                    onChange={(e) => setValorKmLP(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Multiplicador Min.
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={multiplicadorMinimo}
                    onChange={(e) => setMultiplicadorMinimo(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <Info className="w-3 h-3" />
                Detalhamento por OS
              </h4>
              <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#F97316' }} />
                  OW: {analise.qtdOW}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#10B981' }} />
                  LP: {analise.qtdLP}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#6B7280' }} />
                  Cortesia: {analise.qtdCortesia}
                </span>
              </div>
            </div>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {analise.detalhes.map((d, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        backgroundColor: d.tipo === 'OW' ? '#F9731615' : d.tipo === 'LP' ? '#10B98115' : '#6B728015',
                        color: d.tipo === 'OW' ? '#F97316' : d.tipo === 'LP' ? '#10B981' : '#6B7280',
                      }}
                    >
                      {d.tipo}
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-medium block truncate" style={{ color: 'var(--text-primary)' }}>
                        OS {d.numero_os} - {d.cliente_nome}
                      </span>
                      <span className="text-[10px] block" style={{ color: 'var(--text-secondary)' }}>
                        {d.cliente_cidade} | {d.descricao}
                      </span>
                    </div>
                  </div>
                  <span
                    className="text-xs font-bold flex-shrink-0 ml-2"
                    style={{ color: d.receita >= 0 ? '#10B981' : '#EF4444' }}
                  >
                    {formatCurrency(d.receita)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
              <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>Resumo do Calculo</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              <span>KM Total da Rota: <strong style={{ color: 'var(--text-primary)' }}>{kmTotal.toFixed(1)} km</strong></span>
              <span>Litros Estimados: <strong style={{ color: 'var(--text-primary)' }}>{analise.litrosConsumidos.toFixed(1)} L</strong></span>
              <span>Combustivel: <strong style={{ color: '#EF4444' }}>{formatCurrency(analise.custoCombustivel)}</strong></span>
              <span>Hotel ({diasPernoite} noites): <strong style={{ color: '#EF4444' }}>{formatCurrency(analise.custoHotel)}</strong></span>
              <span>Receita OW: <strong style={{ color: '#10B981' }}>{formatCurrency(analise.receitaOW)}</strong></span>
              <span>Receita LP/Cortesia: <strong style={{ color: '#10B981' }}>{formatCurrency(analise.receitaLP)}</strong></span>
            </div>

            <div className="mt-3 pt-2" style={{ borderTop: '1px solid var(--border-primary)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  Retorno sobre custo:
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-primary)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (analise.multiplicador / multiplicadorMinimo) * 100)}%`,
                        backgroundColor: analise.viavel ? '#10B981' : '#EF4444',
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold" style={{ color: badgeColor }}>
                    {analise.multiplicador.toFixed(1)}x / {multiplicadorMinimo}x
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
