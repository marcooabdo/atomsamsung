import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Job {
  id: string;
  unidade_id: string;
  os_id: string | null;
  modulo: string;
  status: string;
  is_running: boolean;
  created_at: string;
  finished_at: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
}

interface JobStatusCardProps {
  unidadeId: string;
  onJobRunningChange?: (isRunning: boolean) => void;
}

export function JobStatusCard({ unidadeId, onJobRunningChange }: JobStatusCardProps) {
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    loadCurrentJob();

    const channel = supabase
      .channel('jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `unidade_id=eq.${unidadeId}`
        },
        (payload) => {
          console.log('Job change:', payload);
          loadCurrentJob();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [unidadeId]);

  // Polling de 5 em 5 segundos quando tem job running
  useEffect(() => {
    if (!currentJob?.is_running) return;

    const interval = setInterval(() => {
      console.log('🔄 Polling job status...');
      loadCurrentJob();
    }, 5000);

    return () => clearInterval(interval);
  }, [currentJob?.is_running]);

  useEffect(() => {
    if (onJobRunningChange) {
      onJobRunningChange(currentJob?.is_running || false);
    }
  }, [currentJob?.is_running, onJobRunningChange]);

  // Timer progressivo enquanto o job está rodando
  useEffect(() => {
    if (!currentJob) return;

    if (currentJob.is_running) {
      // Calcula quantos segundos já passaram desde o início
      const start = new Date(currentJob.created_at).getTime();
      const initialElapsed = Math.max(0, Math.floor((Date.now() - start) / 1000));
      setElapsedSeconds(initialElapsed);

      // Inicia contador progressivo
      const interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);

      return () => clearInterval(interval);
    } else {
      // Job finalizado, usa tempo real do banco
      if (currentJob.finished_at) {
        const start = new Date(currentJob.created_at).getTime();
        const end = new Date(currentJob.finished_at).getTime();
        const seconds = Math.max(0, Math.floor((end - start) / 1000));
        setElapsedSeconds(seconds);
      }
    }
  }, [currentJob?.is_running, currentJob?.created_at, currentJob?.finished_at]);

  const loadCurrentJob = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('unidade_id', unidadeId)
      .eq('modulo', 'pipeline_operacional')
      .is('os_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error loading job:', error);
      return;
    }

    setCurrentJob(data);
  };

  if (!currentJob) {
    return null;
  }

  const getStatusIcon = () => {
    if (currentJob.is_running) {
      return <Activity className="w-4 h-4 text-[#00D4FF] animate-pulse" />;
    }
    if (currentJob.status === 'concluido') {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    if (currentJob.status === 'erro') {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    return <Clock className="w-4 h-4 text-yellow-500" />;
  };

  const getStatusColor = () => {
    if (currentJob.is_running) return '#00D4FF';

    // Se o job terminou, usa cor baseada no tempo desde a última sincronização
    if (currentJob.finished_at) {
      const timeSinceFinished = Date.now() - new Date(currentJob.finished_at).getTime();
      const minutesSince = timeSinceFinished / (1000 * 60);

      if (minutesSince <= 30) return '#10B981'; // Verde - até 30 min
      if (minutesSince <= 60) return '#F59E0B'; // Amarelo - até 1h
      if (minutesSince <= 90) return '#FB923C'; // Laranja - até 1h30
      return '#EF4444'; // Vermelho - mais de 1h30
    }

    if (currentJob.status === 'erro') return '#EF4444';
    return '#F59E0B';
  };

  const getTimeElapsed = () => {
    if (elapsedSeconds < 60) return `${elapsedSeconds}s`;
    const minutes = Math.floor(elapsedSeconds / 60);
    if (minutes < 60) return `${minutes}m ${elapsedSeconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const statusColor = getStatusColor();

  return (
    <div
      className="premium-card p-3 animate-[slideDown_0.3s_ease-out]"
      style={{
        background: `linear-gradient(135deg, ${statusColor}15 0%, ${statusColor}05 100%)`,
        border: `1px solid ${statusColor}40`,
        boxShadow: `0 0 20px ${statusColor}20`
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{
            background: `${statusColor}20`,
            border: `1px solid ${statusColor}40`,
            boxShadow: `0 0 10px ${statusColor}30`
          }}>
            {getStatusIcon()}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-200">
                {currentJob.is_running ? 'Sincronizando' : 'Sincronização'} {currentJob.modulo === 'pipeline_operacional' ? 'Pipeline Operacional' : currentJob.modulo}
              </h3>
              {currentJob.is_running && (
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00D4FF] animate-pulse" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00D4FF] animate-pulse" style={{ animationDelay: '200ms' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00D4FF] animate-pulse" style={{ animationDelay: '400ms' }}></div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1">
              <p className="text-xs text-gray-400">
                Status: <span className="font-medium" style={{ color: statusColor }}>
                  {currentJob.is_running ? 'Em execução' : currentJob.status}
                </span>
              </p>

              <span className="text-xs text-gray-500">•</span>

              <p className="text-xs text-gray-400">
                Tempo: <span className="font-medium text-gray-300">{getTimeElapsed()}</span>
              </p>
            </div>
          </div>
        </div>

        {!currentJob.is_running && (
          <div className="text-right">
            <p className="text-[10px] text-gray-500">Finalizado em</p>
            <p className="text-xs text-gray-400 font-medium">
              {currentJob.finished_at ? new Date(currentJob.finished_at).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
              }) : '-'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
