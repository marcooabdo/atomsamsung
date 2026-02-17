import { useEffect, useState } from 'react';

export function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-[#00D4FF] font-bold tabular-nums text-sm">
      {time.toLocaleTimeString('pt-BR')}
    </span>
  );
}
