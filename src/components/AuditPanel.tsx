import React from 'react';
import { motion } from 'motion/react';
import { Shield, Layout, Users, Eye, Zap, AlertTriangle, CheckCircle2, ChevronRight, BarChart3, Activity, Info, X, RefreshCw } from 'lucide-react';
import { AuditReport, AuditIssue } from '../types';
import { cn } from '../lib/utils';

interface AuditPanelProps {
  report: AuditReport | null;
  isLoading: boolean;
  onClose: () => void;
  onAuditClick: () => void;
}

export function AuditPanel({ report, isLoading, onClose, onAuditClick }: AuditPanelProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'UX': return <Layout className="w-4 h-4" />;
      case 'Narrative': return <Shield className="w-4 h-4" />;
      case 'Character': return <Users className="w-4 h-4" />;
      case 'Visual': return <Eye className="w-4 h-4" />;
      case 'Technical': return <Zap className="w-4 h-4" />;
      case 'Emotional': return <Activity className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'low': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-white/40 bg-white/5 border-white/10';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-8 border-b border-white/5 bg-white/2">
        <div className="flex items-center justify-between mb-8">
           <div className="space-y-1">
             <h3 className="font-brand text-2xl text-editorial-accent tracking-widest uppercase">Observatório</h3>
             <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Auditoria Creativa e Sistêmica</p>
           </div>
           <button 
             onClick={onClose}
             className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white transition-colors"
           >
             <X className="w-5 h-5" />
           </button>
        </div>

        <div className="mb-8">
           <button 
             onClick={onAuditClick}
             disabled={isLoading}
             className="w-full py-4 bg-editorial-accent text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-neon disabled:opacity-50 flex items-center justify-center gap-3"
           >
             {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
             {isLoading ? "Sincronizando Heurísticas..." : "Iniciar Varredura IA"}
           </button>
        </div>

        {report && (
          <div className="grid grid-cols-2 gap-4">
             <div className="col-span-2 p-6 rounded-[32px] bg-editorial-accent/5 border border-editorial-accent/20 flex items-center justify-between">
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-editorial-accent uppercase tracking-widest">Quality Score</p>
                   <p className="text-4xl font-brand text-white">{report.overallScore}<span className="text-sm text-white/40 font-sans ml-1">/100</span></p>
                </div>
                <div className="w-16 h-16 rounded-full border-4 border-editorial-accent/20 flex items-center justify-center relative">
                   <svg className="w-full h-full -rotate-90">
                      <circle 
                        cx="32" cy="32" r="28" 
                        fill="transparent" 
                        stroke="currentColor" 
                        strokeWidth="4" 
                        className="text-editorial-accent"
                        style={{ strokeDasharray: 176, strokeDashoffset: 176 - (176 * report.overallScore) / 100 }}
                      />
                   </svg>
                   <BarChart3 className="w-6 h-6 absolute text-editorial-accent" />
                </div>
             </div>
             
             {Object.entries(report.metrics).map(([key, value]) => (
               <div key={key} className="p-4 rounded-2xl bg-white/2 border border-white/5">
                  <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-2">{key.replace(/([A-Z])/g, ' $1')}</p>
                  <div className="flex items-center justify-between">
                    <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden mr-3">
                       <div className="h-full bg-editorial-accent" style={{ width: `${value}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-white/80">{value}%</span>
                  </div>
               </div>
             ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
        {!report && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-30">
             <Shield className="w-16 h-16" />
             <div className="space-y-1">
               <p className="text-[11px] font-black uppercase tracking-widest">Aguardando Varredura</p>
               <p className="text-[9px] font-medium leading-relaxed max-w-[200px]">Inicie a auditoria para que o Arquiteto IA avalie a integridade do seu projeto.</p>
             </div>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center py-20 gap-4">
             <Activity className="w-12 h-12 text-editorial-accent animate-pulse" />
             <p className="text-[9px] font-black uppercase tracking-widest text-white/40 animate-pulse">Sincronizando Heurísticas de Matriz...</p>
          </div>
        )}

        {report && report.issues.map((issue) => (
          <motion.div 
            key={issue.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-[32px] bg-white/2 border border-white/5 group hover:border-editorial-accent/30 transition-all flex flex-col gap-4"
          >
             <div className="flex items-center justify-between">
                <div className={cn("px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border flex items-center gap-2", getPriorityColor(issue.priority))}>
                   <AlertTriangle className="w-3 h-3" /> {issue.priority}
                </div>
                <div className="flex items-center gap-2 text-white/30 text-[9px] font-black uppercase tracking-widest">
                   {getCategoryIcon(issue.category)}
                   {issue.category}
                </div>
             </div>

             <div className="space-y-2">
                <h4 className="text-sm font-bold text-[#EAEAEA] tracking-wide">{issue.title}</h4>
                <p className="text-[10px] text-white/50 leading-relaxed">{issue.description}</p>
             </div>

             <div className="p-4 bg-editorial-accent/5 rounded-2xl border border-editorial-accent/10 space-y-2">
                <div className="flex items-center gap-2 text-[8px] font-black text-editorial-accent uppercase tracking-widest">
                   <ChevronRight className="w-3 h-3" /> Recomendação
                </div>
                <p className="text-[10px] italic text-[#EAEAEA]/80 font-sans">{issue.suggestion}</p>
             </div>

             {issue.location && (
               <div className="pt-2 flex items-center gap-2 text-[8px] font-black text-white/20 uppercase tracking-widest">
                  <CheckCircle2 className="w-3 h-3" /> Localização: {issue.location}
               </div>
             )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
