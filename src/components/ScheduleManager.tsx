import React, { useState } from 'react';
import { Calendar, CheckCircle2, Circle, Clock, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project } from '../types';
import { cn } from '../lib/utils';

export function ScheduleManager({ project }: { project: Project }) {
  const [milestones, setMilestones] = useState([
    { id: '1', title: 'Concluir Prólogo', date: '2026-06-01', completed: true },
    { id: '2', title: 'Desenvolver Antagonista', date: '2026-06-15', completed: false },
    { id: '3', title: 'Finalizar Primeiro Arco', date: '2026-07-20', completed: false },
  ]);

  const toggleMilestone = (id: string) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, completed: !m.completed } : m));
  };

  return (
    <div className="flex-1 p-8 md:p-12 cinematic-grid bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-editorial-accent" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Cronograma / Planejamento</h2>
          </div>
          <h1 className="text-4xl font-brand uppercase tracking-tight text-white mb-2">Linha do Tempo</h1>
          <p className="text-white/30 text-sm font-light italic">"{project.title}" — Gestão de prazos e metas criativas.</p>
        </header>

        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {milestones.map((m) => (
              <motion.div
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={m.id}
                className={cn(
                  "flex items-center justify-between p-6 rounded-2xl border transition-all",
                  m.completed 
                    ? "bg-green-500/5 border-green-500/10 opacity-60" 
                    : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
                )}
              >
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => toggleMilestone(m.id)}
                    className={cn(
                      "w-6 h-6 rounded-lg flex items-center justify-center transition-all",
                      m.completed ? "bg-green-500 text-black" : "border-2 border-white/10 text-white/10 hover:border-editorial-accent"
                    )}
                  >
                    {m.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  </button>
                  <div>
                    <h3 className={cn(
                      "text-sm font-brand uppercase tracking-widest transition-all",
                      m.completed ? "text-white/40 line-through" : "text-white"
                    )}>
                      {m.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5 opacity-30">
                       <Clock className="w-3 h-3" />
                       <span className="text-[10px] font-black uppercase tracking-widest">{m.date}</span>
                    </div>
                  </div>
                </div>
                
                <button className="p-2 text-white/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          <button className="w-full py-6 border-2 border-dashed border-white/5 rounded-2xl flex items-center justify-center gap-3 text-white/20 hover:text-editorial-accent hover:border-editorial-accent/20 hover:bg-editorial-accent/[0.02] transition-all group">
            <Plus className="w-4 h-4 group-hover:scale-125 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Adicionar Marco de Produção</span>
          </button>
        </div>
      </div>
    </div>
  );
}
