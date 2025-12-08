import { AlertCircle, Package, DollarSign, ShoppingCart } from 'lucide-react';

interface DashboardStats {
  lpPendentes: {
    osCount: number;
    pecasCount: number;
    valorTotal: number;
    semID: number;
    semPreco: number;
  };
  owPendentes: {
    osCount: number;
    pecasCount: number;
    valorTotal: number;
    semID: number;
    semPreco: number;
  };
  pecasSemPreco: Array<{
    codigo_peca: string;
    descricao: string;
    count: number;
    lpCount: number;
    owCount: number;
  }>;
}

interface EstoqueDashboardProps {
  stats: DashboardStats;
  onRegistrarPreco: (codigoPeca: string, descricao: string) => void;
}

export function EstoqueDashboard({ stats, onRegistrarPreco }: EstoqueDashboardProps) {
  return (
    <div className="space-y-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="premium-card p-4" style={{ borderColor: '#FFA50060' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#FFA50020' }}>
              <ShoppingCart className="w-5 h-5" style={{ color: '#FFA500' }} />
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded" style={{
              backgroundColor: '#FFA50030',
              color: '#FFA500',
              border: '1px solid #FFA50060'
            }}>
              LP
            </span>
          </div>
          <h3 className="text-sm font-bold text-gray-400 mb-2">PENDENTES LP</h3>
          <div className="space-y-1">
            <p className="text-2xl font-bold" style={{ color: '#FFA500' }}>
              {stats.lpPendentes.osCount} OSs
            </p>
            <p className="text-xs text-gray-500">{stats.lpPendentes.pecasCount} peças</p>
            {stats.lpPendentes.valorTotal > 0 && (
              <p className="text-sm font-bold text-[#39FF14] mt-2">
                R$ {stats.lpPendentes.valorTotal.toFixed(2)}
              </p>
            )}
          </div>
        </div>

        <div className="premium-card p-4" style={{ borderColor: '#00D4FF60' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#00D4FF20' }}>
              <ShoppingCart className="w-5 h-5" style={{ color: '#00D4FF' }} />
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded" style={{
              backgroundColor: '#00D4FF30',
              color: '#00D4FF',
              border: '1px solid #00D4FF60'
            }}>
              OW
            </span>
          </div>
          <h3 className="text-sm font-bold text-gray-400 mb-2">PENDENTES OW</h3>
          <div className="space-y-1">
            <p className="text-2xl font-bold" style={{ color: '#00D4FF' }}>
              {stats.owPendentes.osCount} OSs
            </p>
            <p className="text-xs text-gray-500">{stats.owPendentes.pecasCount} peças</p>
            {stats.owPendentes.valorTotal > 0 && (
              <p className="text-sm font-bold text-[#39FF14] mt-2">
                R$ {stats.owPendentes.valorTotal.toFixed(2)}
              </p>
            )}
          </div>
        </div>

        <div className="premium-card p-4" style={{ borderColor: '#FFBF0060' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#FFBF0020' }}>
              <DollarSign className="w-5 h-5" style={{ color: '#FFBF00' }} />
            </div>
            <AlertCircle className="w-5 h-5" style={{ color: '#FFBF00' }} />
          </div>
          <h3 className="text-sm font-bold text-gray-400 mb-2">0 STK E SEM PREÇO</h3>
          <div className="space-y-1">
            <p className="text-2xl font-bold" style={{ color: '#FFBF00' }}>
              {stats.pecasSemPreco.length} PNs
            </p>
            <p className="text-xs text-gray-500">
              {stats.lpPendentes.semPreco} LP, {stats.owPendentes.semPreco} OW
            </p>
          </div>
        </div>

        <div className="premium-card p-4" style={{ borderColor: '#FF006460' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#FF006420' }}>
              <Package className="w-5 h-5" style={{ color: '#FF0064' }} />
            </div>
            <AlertCircle className="w-5 h-5" style={{ color: '#FF0064' }} />
          </div>
          <h3 className="text-sm font-bold text-gray-400 mb-2">SEM ESTOQUE</h3>
          <div className="space-y-1">
            <p className="text-2xl font-bold" style={{ color: '#FF0064' }}>
              {stats.lpPendentes.semID + stats.owPendentes.semID} peças
            </p>
            <p className="text-xs text-gray-500">
              {stats.lpPendentes.semID} LP, {stats.owPendentes.semID} OW
            </p>
          </div>
        </div>
      </div>

      {stats.pecasSemPreco.length > 0 && (
        <div className="premium-card">
          <div className="border-b border-[#FFBF00]/20 p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#FFBF00]" />
              <h3 className="text-lg font-bold text-[#FFBF00]">
                PEÇAS SEM ESTOQUE E SEM PREÇO REGISTRADO - AÇÃO NECESSÁRIA
              </h3>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Registre os preços GSPN para permitir a criação de pedidos
            </p>
          </div>
          <div className="p-4 space-y-3">
            {stats.pecasSemPreco.map((peca) => (
              <div
                key={peca.codigo_peca}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: '#FFBF0010', border: '1px solid #FFBF0030' }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-gray-200">{peca.descricao}</p>
                    <span className="text-xs font-mono text-gray-400">({peca.codigo_peca})</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{peca.count} requisições</span>
                    {peca.lpCount > 0 && (
                      <span style={{ color: '#FFA500' }}>{peca.lpCount} LP</span>
                    )}
                    {peca.owCount > 0 && (
                      <span style={{ color: '#00D4FF' }}>{peca.owCount} OW</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onRegistrarPreco(peca.codigo_peca, peca.descricao)}
                  className="neon-button text-xs px-4 py-2 whitespace-nowrap"
                  style={{
                    backgroundColor: '#FFBF0020',
                    color: '#FFBF00',
                    borderColor: '#FFBF0060'
                  }}
                >
                  REGISTRAR PREÇO GSPN
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
