import { X, AlertTriangle, CheckCircle2, XCircle, Info, Package } from 'lucide-react';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DiagnosticoBlockModalProps extends BaseModalProps {}

export function DiagnosticoBlockModal({ isOpen, onClose }: DiagnosticoBlockModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="modal-panel shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <XCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Movimentação Bloqueada</h3>
            <p className="text-red-100 text-sm">OS em diagnóstico</p>
          </div>
        </div>

        <div className="p-6">
          <p className="mb-4">
            Esta OS está em <span className="font-semibold text-red-600">DIAGNÓSTICO</span> e não pode ser movida manualmente.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Para liberar a movimentação:
            </h4>
            <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
              <li>Clique em <span className="font-medium">"Análise Concluída"</span> no card da OS</li>
              <li>Descreva a análise realizada</li>
              <li>A OS será movida automaticamente para <span className="font-medium">"Negociação em Andamento"</span></li>
            </ol>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium shadow-lg hover:shadow-xl"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConfirmMoveModalProps extends BaseModalProps {
  fromColumn: string;
  toColumn: string;
  onConfirm: () => void;
}

export function ConfirmMoveModal({ isOpen, onClose, fromColumn, toColumn, onConfirm }: ConfirmMoveModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="modal-panel shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Confirmar Movimentação</h3>
            <p className="text-orange-100 text-sm">Verificação necessária</p>
          </div>
        </div>

        <div className="p-6">
          <p className="mb-4">
            Você está movendo uma OS de <span className="font-semibold text-orange-600">"{fromColumn}"</span> para <span className="font-semibold text-blue-600">"{toColumn}"</span>.
          </p>

          <p className="modal-label mb-6">
            Deseja continuar com esta movimentação?
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 border border-[var(--border-primary)] py-3 rounded-lg hover:bg-black/5 transition-all font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium shadow-lg hover:shadow-xl"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PecasAtivasBlockModalProps extends BaseModalProps {
  pecas: Array<{
    codigo_peca?: string;
    status: string;
    numero_pedido_samsung?: string;
  }>;
  statusLabels: Record<string, string>;
}

export function PecasAtivasBlockModal({ isOpen, onClose, pecas, statusLabels }: PecasAtivasBlockModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="modal-panel shadow-2xl max-w-2xl w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Movimentação Bloqueada</h3>
            <p className="text-red-100 text-sm">Peças em processo ativo</p>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-900 font-semibold mb-2">
              Esta OS possui {pecas.length} peça(s) em processo ativo:
            </p>
            <ul className="space-y-2">
              {pecas.map((peca, idx) => {
                const statusLabel = statusLabels[peca.status] || peca.status;
                return (
                  <li key={idx} className="flex items-start gap-2 text-sm text-red-800">
                    <span className="text-red-500 mt-1">•</span>
                    <span>
                      <span className="font-medium">{peca.codigo_peca || 'N/A'}</span> - {statusLabel}
                      {peca.numero_pedido_samsung && (
                        <span className="text-red-600"> (Pedido #{peca.numero_pedido_samsung})</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Para desbloquear a movimentação:
            </h4>
            <div className="space-y-2 text-sm text-blue-800">
              <div>
                <span className="font-medium">• Pedido Ativo:</span> Cancele em Estoque → Transferências
              </div>
              <div>
                <span className="font-medium">• Peça Atendida:</span> Técnico deve postar GI ou devolver
              </div>
              <div>
                <span className="font-medium">• Em Uso:</span> Técnico deve postar GI ou devolver
              </div>
              <div>
                <span className="font-medium">• GI Pendente:</span> Estoque deve aprovar/reprovar em Devoluções
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-green-900 mb-2">Ou mova para estas colunas permitidas:</h4>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                'Rotas (Preta, Vermelha, Azul, Verde, Rosa, Amarela, Laranja)',
                'Em Rota IH',
                'Reparo Concluído',
                'Em Reparo CI',
                'Aguardando Peça',
                'Peça em Trânsito',
                'Peça Disponível',
                'Aguardando Fechamento',
                'Fechar OS'
              ].map((col, idx) => (
                <span key={idx} className="bg-green-100 text-green-800 px-2 py-1 rounded">
                  {col}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium shadow-lg hover:shadow-xl"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

interface ErrorModalProps extends BaseModalProps {
  title: string;
  message: string;
}

export function ErrorModal({ isOpen, onClose, title, message }: ErrorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="modal-panel shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <XCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-red-100 text-sm">Ocorreu um erro</p>
          </div>
        </div>

        <div className="p-6">
          <p className="mb-6 whitespace-pre-line">
            {message}
          </p>

          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-gray-600 to-gray-700 text-white py-3 rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all font-medium shadow-lg hover:shadow-xl"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

interface SuccessModalProps extends BaseModalProps {
  title: string;
  message: string;
}

export function SuccessModal({ isOpen, onClose, title, message }: SuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="modal-panel shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-green-100 text-sm">Operação concluída</p>
          </div>
        </div>

        <div className="p-6">
          <p className="mb-6 whitespace-pre-line">
            {message}
          </p>

          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-medium shadow-lg hover:shadow-xl"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

interface InfoModalProps extends BaseModalProps {
  title: string;
  message: string;
}

export function InfoModal({ isOpen, onClose, title, message }: InfoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="modal-panel shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Info className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-blue-100 text-sm">Informação</p>
          </div>
        </div>

        <div className="p-6">
          <p className="mb-6 whitespace-pre-line">
            {message}
          </p>

          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium shadow-lg hover:shadow-xl"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
