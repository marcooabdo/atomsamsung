import { Bot, ArrowRight } from 'lucide-react';

export default function AprovacaoGIA() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }}
      >
        <Bot className="w-7 h-7 text-[#00D4FF]" />
      </div>
      <div className="text-center">
        <h3 className="font-black text-slate-200 text-base mb-1">GIA Logistics foi atualizado</h3>
        <p className="text-sm text-slate-500 font-mono max-w-sm">
          O despachador de rotas agora está integrado na aba{' '}
          <span className="text-[#00D4FF]">Motor de Otimização</span>.
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-600 font-mono">
        <ArrowRight className="w-3.5 h-3.5" />
        Acesse a aba Motor de Otimização para gerenciar rotas
      </div>
    </div>
  );
}
