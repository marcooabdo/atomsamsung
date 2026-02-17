import type { GIAAgentConfig, MuralTarefa } from './types';
import { agentMatchesTask } from './utils';

interface AgentLoadBarProps {
  agents: GIAAgentConfig[];
  tasks: MuralTarefa[];
  activeAgentIdx: number;
  onAgentClick: (idx: number) => void;
}

export function AgentLoadBar({ agents, tasks, activeAgentIdx, onAgentClick }: AgentLoadBarProps) {
  return (
    <div
      className="relative z-10 flex-shrink-0 px-4 py-0 flex items-center gap-1 overflow-x-auto"
      style={{ background: 'rgba(3,5,16,0.8)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      <span
        className="text-[9px] font-mono text-slate-700 uppercase tracking-widest pr-3 flex-shrink-0 py-2.5"
        style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >
        CARGA<br />AGENTES
      </span>
      <div className="flex items-center gap-1 overflow-x-auto py-2" style={{ scrollbarWidth: 'none' }}>
        {agents.map((agent, idx) => {
          const agentTasks = tasks.filter((t) => agentMatchesTask(agent, t));
          const isActive = idx === activeAgentIdx;
          const pct = Math.min((agentTasks.length / agent.maxLoad) * 100, 100);
          return (
            <button
              key={agent.shortName}
              onClick={() => onAgentClick(idx)}
              className="flex-shrink-0 flex flex-col items-start px-3 py-1.5 rounded-xl transition-all"
              style={{
                background: isActive ? `${agent.color}12` : 'transparent',
                border: `1px solid ${isActive ? `${agent.color}40` : 'transparent'}`,
                minWidth: 80,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background: agentTasks.length > 0 ? agent.color : '#1E293B',
                    boxShadow: agentTasks.length > 0 ? `0 0 4px ${agent.color}` : 'none',
                  }}
                />
                <span
                  className="text-[10px] font-black tracking-wider font-mono"
                  style={{ color: isActive ? agent.color : agentTasks.length > 0 ? `${agent.color}90` : '#334155' }}
                >
                  {agent.shortName}
                </span>
                {agentTasks.filter((t) => t.prioridade === 'alta').length > 0 && (
                  <span
                    className="text-[8px] font-black px-1 rounded animate-pulse font-mono"
                    style={{ background: 'rgba(239,68,68,0.2)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}
                  >
                    {agentTasks.filter((t) => t.prioridade === 'alta').length}!
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 w-full">
                <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  {agentTasks.length > 0 && (
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 80
                          ? `linear-gradient(90deg, ${agent.color}, #EF4444)`
                          : `linear-gradient(90deg, ${agent.color}80, ${agent.color})`,
                        boxShadow: `0 0 3px ${agent.color}60`,
                      }}
                    />
                  )}
                </div>
                <span
                  className="text-[8px] font-mono tabular-nums flex-shrink-0"
                  style={{ color: agentTasks.length > 0 ? agent.color : '#1E293B' }}
                >
                  {agentTasks.length}/{agent.maxLoad}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
