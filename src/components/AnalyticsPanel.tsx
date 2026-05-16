import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Users, Zap, DollarSign, BarChart3, ArrowUpRight } from 'lucide-react';
import { useAnalytics } from '../hooks/useAnalytics';
import { Project } from '../types';

interface AnalyticsPanelProps {
  project: Project;
  onClose: () => void;
}

export function AnalyticsPanel({ project, onClose }: AnalyticsPanelProps) {
  const { stats, isLoading } = useAnalytics(project.id);

  const metrics = [
    { label: 'Leitores Únicos', value: stats?.uniqueReaders || 0, icon: Users, color: 'text-blue-400' },
    { label: 'Capítulos Desbloqueados', value: stats?.unlocks || 0, icon: Zap, color: 'text-yellow-400' },
    { label: 'Visualizações', value: stats?.views || 0, icon: TrendingUp, color: 'text-editorial-accent' },
    { label: 'Receita Bruta (BRL)', value: `R$ ${stats?.revenueBRL?.toFixed(2) || '0,00'}`, icon: DollarSign, color: 'text-green-400' },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#080808] p-10 h-full overflow-y-auto custom-scrollbar">
      <header className="flex items-center justify-between mb-12">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-editorial-accent">
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Data_Nexus</span>
          </div>
          <h2 className="text-4xl font-brand text-white uppercase tracking-widest">Performance da Obra</h2>
          <p className="text-white/30 text-xs font-light tracking-widest italic">{project.title}</p>
        </div>
        <button onClick={onClose} className="text-white/20 hover:text-white uppercase text-[10px] font-black tracking-widest">Fechar Painel</button>
      </header>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-editorial-accent/20 border-t-editorial-accent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {metrics.map((m, i) => (
              <motion.div 
                key={m.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-8 bg-white/[0.02] border border-white/5 rounded-[32px] space-y-4 hover:border-white/10 transition-all"
              >
                <div className="flex items-center justify-between">
                  <m.icon className={`w-5 h-5 ${m.color}`} />
                  <ArrowUpRight className="w-4 h-4 text-white/10" />
                </div>
                <div>
                  <p className="text-3xl font-brand text-white">{m.value}</p>
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/30 mt-1">{m.label}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Futuro: Gráfico de tendência (Chart.js ou Recharts) */}
          <div className="h-64 rounded-[40px] bg-white/[0.01] border border-white/5 border-dashed flex flex-col items-center justify-center text-white/20 space-y-4">
            <BarChart3 className="w-12 h-12 opacity-20" />
            <p className="text-[9px] font-black uppercase tracking-[0.4em]">Mapeamento de Tendência em Desenvolvimento</p>
          </div>

          <footer className="pt-10 border-t border-white/5">
            <div className="p-6 bg-editorial-accent/5 border border-editorial-accent/10 rounded-2xl flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-editorial-accent uppercase tracking-widest">Próximo Payout Estimado</p>
                <p className="text-xs text-white/60 italic">Seu saldo acumulado está sendo processado para o próximo ciclo de repasse.</p>
              </div>
              <span className="text-xl font-brand text-white">R$ {(stats?.revenueBRL || 0).toFixed(2)}</span>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}