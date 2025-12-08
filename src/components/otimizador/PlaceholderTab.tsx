import { LucideIcon } from 'lucide-react';

interface PlaceholderTabProps {
  title: string;
  description: string;
  icon: LucideIcon;
  color?: string;
}

export default function PlaceholderTab({
  title,
  description,
  icon: Icon,
  color = 'cyan'
}: PlaceholderTabProps) {
  const colorClasses = {
    cyan: 'from-cyan-400 via-blue-500 to-purple-600',
    green: 'from-green-400 via-emerald-500 to-teal-600',
    purple: 'from-purple-400 via-pink-500 to-red-600',
    yellow: 'from-yellow-400 via-orange-500 to-red-600',
    pink: 'from-pink-400 via-rose-500 to-red-600',
    orange: 'from-orange-400 via-amber-500 to-yellow-600',
    gray: 'from-gray-400 via-slate-500 to-gray-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${colorClasses[color as keyof typeof colorClasses] || colorClasses.cyan} flex items-center gap-3`}>
            <Icon className="w-8 h-8" style={{ color: `var(--${color}-400)` }} />
            {title}
          </h2>
          <p className="text-gray-400 mt-1">{description}</p>
        </div>
      </div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 text-center">
        <Icon className="w-16 h-16 mx-auto text-gray-600 mb-4" />
        <p className="text-gray-400 text-lg">Funcionalidade em desenvolvimento</p>
        <p className="text-gray-500 text-sm mt-2">Esta seção estará disponível em breve</p>
      </div>
    </div>
  );
}
