import { LayoutDashboard, PenTool, Users, Map, Calendar, MessageSquare, Book, ChevronLeft, Layout, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface SidebarProps {
  activeView: string;
  setView: (view: any) => void;
  hasActiveProject: boolean;
  onBackToDashboard: () => void;
}

export function Sidebar({ activeView, setView, hasActiveProject, onBackToDashboard }: SidebarProps) {
  const menuItems = [
    { id: 'editor', icon: PenTool, label: 'Escritório' },
    { id: 'reader', icon: Book, label: 'Modo Leitura' },
    { id: 'storyboard', icon: Layout, label: 'Storyboard' },
    { id: 'characters', icon: Users, label: 'Personagens' },
    { id: 'lore', icon: Map, label: 'Enciclopédia' },
    { id: 'schedule', icon: Calendar, label: 'Cronograma' },
    { id: 'chat', icon: MessageSquare, label: 'Oráculo IA' },
  ];

  return (
    <motion.aside 
      initial={false}
      whileHover={{ width: 260 }}
      className="w-20 bg-editorial-sidebar border-r border-editorial-border flex flex-col py-8 z-40 transition-all duration-500 group/sidebar overflow-hidden shadow-[10px_0_30px_rgba(0,0,0,0.5)]"
    >
      <div className="px-5 mb-10 flex items-center gap-4 overflow-hidden shrink-0">
        <div 
          className="w-10 h-10 bg-editorial-accent rounded-2xl flex items-center justify-center text-white font-brand text-2xl cursor-pointer shadow-[0_0_15px_rgba(124,58,237,0.4)] hover:scale-110 transition-all shrink-0 active:scale-95" 
          onClick={onBackToDashboard}
        >
          L
        </div>
        <div className="flex flex-col opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-500">
          <span className="font-brand text-2xl tracking-widest text-[#EAEAEA]">LUMEN</span>
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-editorial-accent">Ateliê Criativo</span>
        </div>
      </div>

      <nav className="flex flex-col space-y-2 px-3 flex-1 overflow-y-auto custom-scrollbar">
        <button
          onClick={onBackToDashboard}
          className={cn(
            "p-3.5 rounded-2xl transition-all duration-300 flex items-center gap-4 group/item",
            activeView === 'dashboard' 
              ? "text-white bg-white/10 shadow-neon border border-white/20" 
              : "text-editorial-muted hover:text-white hover:bg-white/5"
          )}
        >
          <LayoutDashboard className={cn("w-6 h-6 shrink-0 transition-transform duration-300 group-hover/item:scale-110", activeView === 'dashboard' && "text-editorial-accent")} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap">Dashboard</span>
        </button>

        <div className="h-px bg-white/5 mx-2 my-4" />

        {hasActiveProject && menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={cn(
              "p-3.5 rounded-2xl transition-all duration-300 flex items-center gap-4 group/item relative",
              activeView === item.id 
                ? "text-white bg-white/10 shadow-neon border border-white/20" 
                : "text-editorial-muted hover:text-white hover:bg-white/5"
            )}
          >
            {activeView === item.id && (
              <motion.div 
                layoutId="active-indicator"
                className="absolute left-[-4px] w-1 h-8 bg-editorial-accent rounded-full shadow-[0_0_10px_#7C3AED]"
              />
            )}
            <item.icon className={cn("w-6 h-6 shrink-0 transition-all duration-300 group-hover/item:scale-110", activeView === item.id && "text-editorial-accent")} />
            <span className={cn(
              "text-[9px] font-black uppercase tracking-[0.2em] transition-opacity duration-500 whitespace-nowrap",
              activeView === item.id ? "opacity-100" : "opacity-0 group-hover/sidebar:opacity-100"
            )}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      <div className="mt-8 px-4 py-6 mb-4 mx-3 bg-white/5 rounded-[32px] border border-white/10 opacity-0 group-hover/sidebar:opacity-100 transition-all duration-500 flex flex-col gap-3 group-hover/sidebar:translate-y-0 translate-y-4">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-editorial-accent/20 flex items-center justify-center border border-editorial-accent/30">
               <Sparkles className="w-4 h-4 text-editorial-accent" />
            </div>
            <div className="flex flex-col">
               <span className="text-[9px] font-black uppercase tracking-widest text-[#EAEAEA]">Nível de Escrita</span>
               <div className="w-24 h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                  <div className="w-2/3 h-full bg-editorial-accent shadow-[0_0_10px_#7C3AED]"></div>
               </div>
            </div>
         </div>
      </div>

      <div className="px-5 flex items-center gap-4 shrink-0 mt-auto">
        <div className="w-10 h-10 rounded-2xl border border-white/10 flex items-center justify-center text-[10px] font-black text-[#EAEAEA] shrink-0 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
          BC
        </div>
        <div className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-500 flex flex-col min-w-0">
           <span className="text-[9px] font-black uppercase tracking-widest text-[#EAEAEA] truncate">Beat Cru</span>
           <span className="text-[8px] font-bold text-editorial-accent uppercase tracking-widest truncate">Status: Ativo</span>
        </div>
      </div>
    </motion.aside>
  );
}
