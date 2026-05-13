import React, { useState, useEffect } from 'react';
import { Project, WritingSchedule } from '../types';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Calendar, Plus, Target, CheckCircle2, Circle, Clock, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../lib/utils';
import { differenceInDays } from 'date-fns';

interface ScheduleManagerProps {
  project: Project;
  key?: string;
}

export function ScheduleManager({ project }: ScheduleManagerProps) {
  const [schedules, setSchedules] = useState<WritingSchedule[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ title: '', goal: 1000, deadline: '', currentProgress: 0 });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'projects', project.id, 'schedules'), (snap) => {
      setSchedules(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WritingSchedule)));
    });
    return () => unsub();
  }, [project.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.deadline) return;

    try {
      await addDoc(collection(db, 'projects', project.id, 'schedules'), {
        ...formData,
        deadline: new Date(formData.deadline),
        updatedAt: serverTimestamp(),
        currentProgress: Number(formData.currentProgress) || 0,
        goal: Number(formData.goal)
      });
      setIsAdding(false);
      setFormData({ title: '', goal: 1000, deadline: '', currentProgress: 0 });
    } catch (err) {
      console.error(err);
    }
  };

  const updateProgress = async (id: string, current: number, goal: number) => {
    const newVal = prompt("Atualizar progresso de palavras:", current.toString());
    if (newVal === null) return;
    
    await updateDoc(doc(db, 'projects', project.id, 'schedules', id), {
      currentProgress: Number(newVal),
      updatedAt: serverTimestamp()
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Remover este objetivo?")) {
      await deleteDoc(doc(db, 'projects', project.id, 'schedules', id));
    }
  };

  return (
    <div className="p-16 max-w-5xl mx-auto w-full h-full overflow-y-auto bg-editorial-bg">
      <div className="flex items-center justify-between mb-20">
        <div>
          <h2 className="text-4xl font-serif font-light text-editorial-accent italic mb-2">Objetivos Temporais</h2>
          <p className="text-editorial-muted font-sans text-sm">Mantenha a frequência para forjar sua grande obra.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-editorial-accent text-white px-8 py-3.5 rounded-full hover:opacity-90 transition-all shadow-xl shadow-black/10 font-bold text-[10px] uppercase tracking-widest"
        >
          <Plus className="w-5 h-5" />
          Nova Meta
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-8 rounded-[38px] border border-editorial-accent shadow-2xl mb-16 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6">
              <button onClick={() => setIsAdding(false)} className="text-editorial-muted hover:text-editorial-accent transition-colors"><Plus className="w-6 h-6 rotate-45" /></button>
            </div>
            <h3 className="text-xl font-serif font-bold mb-8 italic">Traçar Novo Destino</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-2 col-span-2">
                <label className="text-[10px] font-bold text-editorial-muted uppercase tracking-widest">Inscrição do Objetivo</label>
                <input
                  required
                  type="text"
                  placeholder="Ex: Alvorecer da Página 1, O Crepúsculo da Revisão..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-editorial-sidebar border border-editorial-border rounded-xl py-4 px-5 outline-none focus:border-editorial-accent transition-all text-sm"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-editorial-muted uppercase tracking-widest">Volume Alvo (Palavras)</label>
                <input
                  required
                  type="number"
                  value={formData.goal}
                  onChange={(e) => setFormData({ ...formData, goal: Number(e.target.value) })}
                  className="bg-editorial-sidebar border border-editorial-border rounded-xl py-4 px-5 outline-none focus:border-editorial-accent transition-all text-sm"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-editorial-muted uppercase tracking-widest">Data Limite</label>
                <input
                  required
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="bg-editorial-sidebar border border-editorial-border rounded-xl py-4 px-5 outline-none focus:border-editorial-accent transition-all text-sm"
                />
              </div>

              <div className="col-span-2 pt-4">
                <button
                  type="submit"
                  className="w-full bg-editorial-accent text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-black/10 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Registrar Meta no Tomo
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-8">
        {schedules.map((s) => {
          const progress = Math.min((s.currentProgress / s.goal) * 100, 100);
          
          let deadlineDate: Date | null = null;
          if (s.deadline) {
            if (typeof s.deadline.toDate === 'function') {
              deadlineDate = s.deadline.toDate();
            } else {
              deadlineDate = new Date(s.deadline);
            }
          }
          
          const daysLeft = deadlineDate && !isNaN(deadlineDate.getTime()) 
            ? differenceInDays(deadlineDate, new Date()) 
            : null;
            
          const isDone = progress === 100;

          return (
            <motion.div
              key={s.id}
              layout
              className={cn(
                "bg-white p-8 rounded-[38px] border border-editorial-border flex items-center gap-8 group transition-all shadow-sm hover:border-editorial-accent",
                isDone && "bg-editorial-sidebar opacity-60"
              )}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `conic-gradient(#1A1A1A ${progress}%, #E2DED0 0)` }}>
                <div className="w-[85%] h-[85%] bg-white rounded-xl flex items-center justify-center text-[10px] font-bold text-editorial-accent">
                  {Math.round(progress)}%
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className={cn("text-xl font-serif font-bold text-editorial-accent truncate", isDone && "line-through italic")}>{s.title}</h3>
                  {isDone && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                </div>
                <div className="flex items-center gap-6 text-[10px] font-bold text-editorial-muted uppercase tracking-widest">
                  <div className="flex items-center gap-2"><Target className="w-3.5 h-3.5" /> {s.currentProgress} / {s.goal} pal.</div>
                  <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {daysLeft < 0 ? 'Expirado' : `Restam ${daysLeft} dias`}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                 <button
                   onClick={() => updateProgress(s.id, s.currentProgress, s.goal)}
                   className="px-6 py-2.5 bg-editorial-sidebar text-editorial-accent border border-editorial-border rounded-full font-bold text-[10px] uppercase tracking-widest hover:bg-editorial-accent hover:text-white transition-all shadow-sm"
                 >
                   Atualizar
                 </button>
                 <button
                    onClick={() => handleDelete(s.id)}
                    className="p-3 text-editorial-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                 >
                    <Trash2 className="w-5 h-5" />
                 </button>
              </div>
            </motion.div>
          );
        })}

        {schedules.length === 0 && !isAdding && (
          <div className="text-center py-24 bg-white/40 rounded-[48px] border border-dashed border-editorial-border mt-12">
            <Calendar className="w-12 h-12 text-editorial-border mx-auto mb-6 opacity-30" />
            <p className="text-editorial-accent font-serif text-xl italic mb-2">Sua jornada não possui marcos.</p>
            <p className="text-editorial-muted text-sm font-sans mb-10">Mapeie o futuro da sua escrita agora.</p>
            <button 
              onClick={() => setIsAdding(true)}
              className="bg-editorial-accent text-white px-10 py-4 rounded-full font-bold text-xs uppercase tracking-widest shadow-xl shadow-black/10"
            >
              Definir Primeiro Alvo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
