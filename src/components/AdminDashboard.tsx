import React, { useState, useEffect } from 'react';
import { Shield, Users, Database, DollarSign, Activity, Bell, Search } from 'lucide-react';
import { collection, query, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    projects: 0,
    published: 0,
    revenue: 0
  });

  const StatCard = ({ label, value, icon: Icon, color }: any) => (
    <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl hover:bg-white/[0.04] transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-3 rounded-2xl", color)}>
          <Icon className="w-5 h-5 text-black" />
        </div>
        <Activity className="w-4 h-4 text-white/10 group-hover:text-white/30 transition-colors" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-1">{label}</p>
      <h3 className="text-3xl font-brand uppercase tracking-tight text-white">{value}</h3>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 md:p-12 cinematic-grid bg-[#050505]">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-end justify-between mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-editorial-accent" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Terminal de Comando / Root</h2>
            </div>
            <h1 className="text-4xl font-brand uppercase tracking-tight text-white">Central Admin</h1>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/40">
                <Search className="w-4 h-4" />
                <input type="text" placeholder="Buscar usuário ou obra..." className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest focus:outline-none placeholder:text-white/10" />
             </div>
             <button className="p-3 rounded-xl bg-editorial-accent/10 border border-editorial-accent/20 text-editorial-accent hover:bg-editorial-accent hover:text-black transition-all">
                <Bell className="w-4 h-4" />
             </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard label="Autores Ativos" value="1,284" icon={Users} color="bg-blue-400" />
          <StatCard label="Universos" value="4,902" icon={Database} color="bg-purple-400" />
          <StatCard label="Obras Públicas" value="856" icon={Activity} color="bg-editorial-accent" />
          <StatCard label="Receita Bruta" value="R$ 12k" icon={DollarSign} color="bg-green-400" />
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
           <section className="bg-white/[0.01] border border-white/5 rounded-[2.5rem] p-8">
              <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white/40 mb-8 flex items-center gap-3">
                 <Activity className="w-4 h-4" />
                 Atividade em Tempo Real
              </h3>
              <div className="space-y-6">
                 {[1, 2, 3, 4].map(i => (
                   <div key={i} className="flex items-center justify-between py-4 border-b border-white/[0.03]">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                            <Users className="w-4 h-4" />
                         </div>
                         <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-white">Novo Capítulo Publicado</p>
                            <p className="text-[9px] font-medium text-white/20 uppercase tracking-widest">Usuário @marcelo_novels</p>
                         </div>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/10">Há 2m</span>
                   </div>
                 ))}
              </div>
           </section>

           <section className="bg-white/[0.01] border border-white/5 rounded-[2.5rem] p-8">
              <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white/40 mb-8 flex items-center gap-3">
                 <Shield className="w-4 h-4" />
                 Alertas do Sistema
              </h3>
              <div className="space-y-4">
                 <div className="p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/10 text-yellow-500/80 text-[10px] font-black uppercase tracking-widest flex gap-4">
                    <Activity className="w-4 h-4 shrink-0" />
                    Pico de tráfego detectado na API Oráculo (Gemini-1.5).
                 </div>
                 <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 text-blue-500/80 text-[10px] font-black uppercase tracking-widest flex gap-4">
                    <Shield className="w-4 h-4 shrink-0" />
                    Sincronização de 124 novos universos concluída com sucesso.
                 </div>
              </div>
           </section>
        </div>
      </div>
    </div>
  );
}
