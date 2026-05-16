import React from 'react';
import { LayoutDashboard, BookOpen, Settings, Shield, Sparkles, ChevronLeft, MessageSquare, Calendar, Database, Layers3 } from 'lucide-react';
import { cn } from '../lib/utils';

export function Sidebar({ activeView, setView, hasActiveProject, onBackToDashboard, isGuest, isAdmin }: any) { 
  const NavItem = ({ id, label, icon: Icon, disabled = false }: any) => (
    <button
      disabled={disabled}
      onClick={() => setView(id)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all relative group",
        activeView === id 
          ? "text-editorial-accent bg-white/[0.03]" 
          : "text-white/30 hover:text-white hover:bg-white/[0.02]",
        disabled && "opacity-20 cursor-not-allowed"
      )}
    >
      <Icon className={cn("w-3.5 h-3.5 transition-transform", activeView === id ? "scale-110" : "group-hover:scale-110")} />
      {label}
      {activeView === id && (
        <div className="absolute left-0 w-[2px] h-4 bg-editorial-accent rounded-full" />
      )}
    </button>
  );

  return (
    <div className="w-full md:w-72 bg-[#050505] border-r border-white/5 flex flex-col h-full pt-10 pb-6 relative overflow-hidden">
      {/* Background visual element */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-editorial-accent/5 blur-[80px] rounded-full -mr-16 -mt-16 pointer-events-none" />

      <div className="flex items-center gap-4 px-6 mb-12 relative">
        <div className="w-10 h-10 rounded-2xl bg-editorial-accent flex items-center justify-center shadow-neon group cursor-pointer transition-transform hover:scale-105 active:scale-95">
          <Sparkles className="w-5 h-5 text-black" />
        </div>
        <div className="flex flex-col">
          <p className="text-xs font-brand uppercase tracking-[0.3em] text-white font-black">ORÁCULO</p>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-[1px] bg-editorial-accent" />
            <p className="text-[8px] font-mono uppercase tracking-[0.2em] text-editorial-accent/50">v. 4.0.0</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-10 px-3">
        <div>
           <div className="flex items-center gap-2 px-3 mb-4">
             <p className="text-xs font-serif italic text-white/20 tracking-wide uppercase">Workspace</p>
             <div className="flex-1 h-[1px] bg-white/5" />
           </div>
           <div className="space-y-1">
             <NavItem id="dashboard" label="Mesa de Trabalho" icon={LayoutDashboard} />
             <NavItem id="catalog" label="Acervo Global" icon={BookOpen} />
           </div>
        </div>

        {hasActiveProject && (
          <div>
             <div className="flex items-center justify-between px-3 mb-4">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-serif italic text-white/20 tracking-wide uppercase">Laboratório</p>
                  <div className="w-1 h-1 rounded-full bg-editorial-accent/30" />
                </div>
                <button 
                  onClick={onBackToDashboard}
                  className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-white/10 hover:text-editorial-accent"
                  title="Voltar ao Painel"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
             </div>
             <div className="space-y-1">
               <NavItem id="editor" label="Pergaminhos" icon={Layers3} />
               <NavItem id="characters" label="Biografias" icon={Database} />
               <NavItem id="lore" label="Arquivos de Lore" icon={Database} />
               <NavItem id="chat" label="Dialogar com IA" icon={MessageSquare} />
               <NavItem id="schedule" label="Cronologia" icon={Calendar} />
             </div>
          </div>
        )}

        {isAdmin && (
          <div>
             <p className="px-3 mb-4 text-[8px] font-black uppercase tracking-[0.4em] text-white/20 font-mono">Kernel Access</p>
             <div className="space-y-1">
               <NavItem id="admin" label="Administração" icon={Shield} />
             </div>
          </div>
        )}
      </div>

      <div className="px-6 pt-8 border-t border-white/5 mt-auto">
        <div className="flex flex-col gap-4">
          <button 
            disabled 
            className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-white/10 hover:text-white transition-colors group cursor-not-allowed"
          >
            <Settings className="w-3.5 h-3.5 opacity-50" />
            Preferências
          </button>
          
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
             {isGuest ? (
               <div className="flex items-center gap-2">
                 <div className="w-1 h-1 rounded-full bg-yellow-500 animate-pulse" />
                 <p className="text-[8px] font-black uppercase tracking-widest text-white/30">Acesso Visitante</p>
               </div>
             ) : (
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-green-500/50" />
                    <p className="text-[8px] font-mono uppercase tracking-widest text-white/20">Sync Active</p>
                 </div>
                 <span className="text-[7px] font-black text-editorial-accent py-0.5 px-1 bg-editorial-accent/10 rounded">BETA</span>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  ); 
}
