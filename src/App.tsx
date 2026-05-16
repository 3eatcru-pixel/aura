// src/App.tsx
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, doc } from 'firebase/firestore';
import { auth, db, signInWithGoogle } from './lib/firebase';
import { Project, Chapter, Character, LoreEntry } from './types';
import { handleFirestoreError, OperationType } from './lib/firestoreUtils';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ProjectEditor } from './components/ProjectEditor';
import { AdminDashboard } from './components/AdminDashboard';
import { ReaderMode } from './components/ReaderMode';
import { ScheduleManager } from './components/ScheduleManager';
import { AIChat } from './components/AIChat';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { Catalog } from './components/Catalog';
import { ArrowRight, BookOpen, Cloud, Database, Layers3, Shield, Sparkles, AlertTriangle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { WalletProvider, useWallet } from './context/WalletContext';
import { cn } from './lib/utils';

const AUTH_LOADING_TIMEOUT_MS = 2500;

const ADMIN_EMAILS = ['3eatcru@gmail.com', 'marcelokbite@gamil.com'];

interface AppContentProps {
  user: User | null;
  loading: boolean;
  projects: Project[];
  publicProjects: Project[];
  activeProjectId: string | null;
  setActiveProjectId: React.Dispatch<React.SetStateAction<string | null>>;
  activeView: 'dashboard' | 'editor' | 'reader' | 'characters' | 'lore' | 'schedule' | 'storyboard' | 'chat' | 'catalog' | 'admin' | 'analytics';
  setActiveView: React.Dispatch<React.SetStateAction<'dashboard' | 'editor' | 'reader' | 'characters' | 'lore' | 'schedule' | 'storyboard' | 'chat' | 'catalog' | 'admin' | 'analytics'>>;
  activeChapterId: string | null;
  setActiveChapterId: React.Dispatch<React.SetStateAction<string | null>>;
  isZenMode: boolean;
  setIsZenMode: React.Dispatch<React.SetStateAction<boolean>>;
  characters: Character[];
  loreEntries: LoreEntry[];
  chapters: Chapter[];
  activeUniverseId: string | null;
  setActiveUniverseId: React.Dispatch<React.SetStateAction<string | null>>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [publicProjects, setPublicProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'dashboard' | 'editor' | 'reader' | 'characters' | 'lore' | 'schedule' | 'storyboard' | 'chat' | 'catalog' | 'admin' | 'analytics'>('dashboard');
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [isZenMode, setIsZenMode] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loreEntries, setLoreEntries] = useState<LoreEntry[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  const [activeUniverseId, setActiveUniverseId] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    const loadingGuard = window.setTimeout(() => setLoading(false), AUTH_LOADING_TIMEOUT_MS);
    return () => {
      window.clearTimeout(loadingGuard);
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProjects([]);
      return;
    }

    const q = query(
      collection(db, 'projects'),
      where('ownerId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubProjects = onSnapshot(q, (snap) => {
      setProjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'projects');
    });

    return () => unsubProjects();
  }, [user]);

  useEffect(() => {
    if (!activeProjectId) {
      setCharacters([]);
      setLoreEntries([]);
      setChapters([]);
      setActiveChapterId(null);
      return;
    }

    const unsubChars = onSnapshot(
      collection(db, 'projects', activeProjectId, 'characters'),
      (snap) => {
        setCharacters(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Character)));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `projects/${activeProjectId}/characters`);
      }
    );

    const unsubLore = onSnapshot(
      collection(db, 'projects', activeProjectId, 'lore'),
      (snap) => {
        setLoreEntries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoreEntry)));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `projects/${activeProjectId}/lore`);
      }
    );

    const unsubChapters = onSnapshot(
      query(collection(db, 'projects', activeProjectId, 'chapters'), orderBy('order', 'asc')),
      (snap) => {
        const fetchedChapters = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chapter));
        setChapters(fetchedChapters);
        // Auto-select first chapter if none active
        if (fetchedChapters.length > 0 && !activeChapterId) {
          setActiveChapterId(fetchedChapters[0].id);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `projects/${activeProjectId}/chapters`);
      }
    );

    return () => {
      unsubChars();
      unsubLore();
      unsubChapters();
    };
  }, [activeProjectId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      // O balance vai atualizar via polling ou refresh manual no context
      const clearUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, clearUrl);
      alert('Pagamento confirmado! Suas moedas foram adicionadas.');
    }
  }, []);

  return (
    <WalletProvider>
      <AppContent 
        {...{user, loading, projects, publicProjects, activeProjectId, setActiveProjectId, activeView, setActiveView, 
             activeChapterId, setActiveChapterId, isZenMode, setIsZenMode, characters, loreEntries, chapters, activeUniverseId, setActiveUniverseId}} 
      />
    </WalletProvider>
  );
}

// Componente interno para acessar o useWallet
function AppContent({
  user, loading, projects, publicProjects, activeProjectId, setActiveProjectId, activeView, setActiveView, 
  activeChapterId, setActiveChapterId, isZenMode, setIsZenMode, characters, loreEntries, chapters, activeUniverseId, setActiveUniverseId 
}: AppContentProps) {
  const { balance } = useWallet();
  const [announcement, setAnnouncement] = useState<{ text: string; active: boolean; type: 'info' | 'warning' | 'critical' } | null>(null);
  const [isAnnouncementDismissed, setIsAnnouncementDismissed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'announcement'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAnnouncement(data.active ? { text: data.text, active: data.active, type: data.type || 'info' } : null);
      }
    }, (err) => {
      console.warn("Announcement Fetch Error (non-fatal):", err.message);
    });
    return () => unsub();
  }, []);

  const allAvailableProjects = [...projects, ...publicProjects];
  const activeProject = allAvailableProjects.find(p => p.id === activeProjectId);
  const isGuest = user?.isAnonymous || false;
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);
  const activeProjectFormat = activeProject?.format || activeProject?.type || null;

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#050505] text-editorial-accent cinematic-grid">
        <div className="flex flex-col items-center gap-6">
          <motion.div
            animate={{ scale: [1, 1.14, 1], opacity: [0.55, 1, 0.55] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="w-16 h-16 rounded-2xl border border-editorial-accent/20 bg-editorial-accent/5 flex items-center justify-center shadow-neon"
          >
            <Sparkles className="w-8 h-8" />
          </motion.div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-white/40">
            Inicializando estação criativa
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen w-screen bg-[#050505] text-white overflow-hidden cinematic-grid">
        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-h-screen w-full max-w-7xl mx-auto px-6 py-8 md:px-12 flex flex-col"
        >
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-editorial-accent flex items-center justify-center shadow-neon shrink-0">
                <Sparkles className="w-5 h-5 text-black" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-brand uppercase tracking-[0.18em] text-white truncate">AUDTRILHA</p>
                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-white/35 truncate">Creative OS</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-editorial-accent shadow-neon" />
              <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/45">Local-first workspace</span>
            </div>
          </header>

          <section className="flex-1 grid lg:grid-cols-[1.02fr_0.98fr] gap-8 lg:gap-14 items-center py-6 md:py-12">
            <div className="max-w-3xl space-y-4 md:space-y-6 text-center lg:text-left">
              <div className="space-y-4 md:space-y-5">
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.36em] text-editorial-accent/80">
                  narrativa / manga / mundos
                </p>
                <h1 className="max-w-3xl text-3xl sm:text-5xl lg:text-6xl font-brand uppercase leading-[1.1] md:leading-[1.02] text-white">
                  Estação de produção para universos narrativos.
                </h1>
                <p className="max-w-2xl mx-auto lg:mx-0 text-xs md:text-base leading-6 md:leading-8 text-white/50 font-light px-4 lg:px-0">
                  Organize romances, personagens, lore, assets visuais e assistência de escrita em um ambiente escuro, modular e estruturado.
                </p>
              </div>

              <div className="hidden sm:grid sm:grid-cols-3 gap-3">
                {[
                  { icon: Layers3, label: 'Projetos', text: 'Volumes e capítulos' },
                  { icon: Database, label: 'Acervo', text: 'Lore e personagens' },
                  { icon: Cloud, label: 'Drive', text: 'Preservação opcional' }
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                    <item.icon className="w-4 h-4 text-editorial-accent mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/80">{item.label}</p>
                    <p className="mt-1 text-[11px] text-white/35">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full max-w-md mx-auto lg:ml-auto">
              <div className="rounded-2xl border border-white/10 bg-[#090909]/88 shadow-[0_30px_100px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.03] p-5 md:p-7">
                <div className="flex items-start justify-between gap-4 pb-6 md:pb-8 border-b border-white/10">
                  <div>
                    <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Acesso seguro</p>
                    <h2 className="mt-2 md:mt-3 text-xl md:text-2xl font-brand uppercase tracking-[0.1em] md:tracking-[0.12em] text-editorial-accent">Console criativo</h2>
                  </div>
                  <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl border border-editorial-accent/20 bg-editorial-accent/5 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-editorial-accent" />
                  </div>
                </div>

                <div className="py-6 md:py-8 space-y-4 md:space-y-5">
                  <p className="text-xs md:text-sm leading-6 md:leading-7 text-white/40">
                    Entre com Google para gerenciar seus universos e manter o trabalho preparado para uso local e preservação externa.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5 md:p-3 flex items-center gap-3">
                      <BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4 text-editorial-accent shrink-0" />
                      <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-white/50">Escrita</p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5 md:p-3 flex items-center gap-3">
                      <Layers3 className="w-3.5 h-3.5 md:w-4 md:h-4 text-editorial-accent shrink-0" />
                      <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-white/50">Produção</p>
                    </div>
                  </div>
                  <button
                    onClick={signInWithGoogle}
                    className="w-full h-12 md:h-14 bg-editorial-accent text-[#080808] rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-[0.15em] md:tracking-[0.18em] hover:shadow-neon active:scale-[0.98] transition-all flex items-center justify-center gap-2 md:gap-3"
                  >
                    Acessar estação
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-5 md:pt-6 border-t border-white/10 flex items-center justify-between gap-3">
                  <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] md:tracking-[0.22em] text-white/20 whitespace-nowrap">Distribuído</span>
                  <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] md:tracking-[0.22em] text-editorial-accent/50 whitespace-nowrap">Offline-ready</span>
                </div>
              </div>
            </div>
          </section>
        </motion.main>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-editorial-bg text-[#EAEAEA] overflow-hidden">
      {/* Mobile Top Header */}
      <header className="md:hidden h-16 border-b border-white/5 bg-[#080808]/80 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-[60]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-editorial-accent flex items-center justify-center shadow-neon">
            <Sparkles className="w-4 h-4 text-black" />
          </div>
          <div>
            <p className="text-[10px] font-brand uppercase tracking-[0.2em] leading-none">AUDTRILHA</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-full border border-white/5">
             <span className="text-[10px] font-black text-editorial-accent">☕</span>
             <span className="text-[10px] font-bold">{balance}</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl bg-white/5 border border-white/10 active:scale-95 transition-all text-white/60"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <div className="space-y-1 w-5 flex flex-col items-end">
              <div className="h-0.5 w-full bg-current rounded-full" />
              <div className="h-0.5 w-2/3 bg-current rounded-full" />
              <div className="h-0.5 w-full bg-current rounded-full" />
            </div>}
          </button>
        </div>
      </header>

      {/* Sidebar - Responsive Backdrop and Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] md:hidden"
          />
        )}
      </AnimatePresence>

      <div className={cn(
        "fixed inset-y-0 left-0 z-[80] md:relative md:z-10 transition-transform duration-500 ease-smooth-expo md:translate-x-0 w-72 h-full",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {!isZenMode && (
          <Sidebar 
            activeView={activeView} 
            setView={(view) => {
              setActiveView(view);
              setIsMobileMenuOpen(false);
            }} 
            hasActiveProject={!!activeProjectId}
            onBackToDashboard={() => {
              setActiveProjectId(null);
              setActiveView('dashboard');
              setIsMobileMenuOpen(false);
            }} 
            activeProjectFormat={activeProjectFormat}
            isGuest={isGuest}
            isAdmin={isAdmin}
          />
        )}
      </div>
      
      <main className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
        {/* Global Announcement HUD */}
        <AnimatePresence>
          {announcement && !isZenMode && !isAnnouncementDismissed && (
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 z-40 w-[90%] md:w-auto"
            >
              <div className={cn(
                "px-4 md:px-6 py-2 md:py-2.5 backdrop-blur-md border rounded-full flex items-center justify-between md:justify-start gap-4 shadow-neon-small group transition-colors",
                announcement.type === 'critical' 
                  ? "bg-red-500/10 border-red-500/20 text-red-400" 
                  : announcement.type === 'warning'
                  ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500"
                  : "bg-editorial-accent/10 border-editorial-accent/20 text-editorial-accent"
              )}>
                <div className="flex items-center gap-2 truncate">
                   {announcement.type === 'critical' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <Sparkles className="w-3.5 h-3.5 shrink-0" />}
                   <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest opacity-90 truncate">{announcement.text}</p>
                </div>
                <button onClick={() => setIsAnnouncementDismissed(true)} className="p-1 hover:text-white opacity-40 transition-colors">
                   <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wallet HUD - Hidden on mobile as it is in the header */}
        <div className="hidden md:block absolute right-6 top-6 z-40">
          <div className="px-3 py-2 bg-white/6 border border-white/6 rounded-full flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-editorial-accent/10 flex items-center justify-center text-editorial-accent font-black">☕</div>
            <div className="text-sm font-black">{balance} <span className="text-xs font-medium text-white/50">moedas</span></div>
          </div>
        </div>
        <AnimatePresence mode="wait">
          {activeView === 'dashboard' ? (
            <Dashboard 
              onSelectProject={(id) => {
                setActiveProjectId(id);
                const isOwner = projects.some(p => p.id === id);
                setActiveUniverseId(allAvailableProjects.find(p => p.id === id)?.universeId || null);
                setActiveView(isOwner ? 'editor' : 'reader');
              }}
              onViewAnalytics={(id) => {
                setActiveProjectId(id);
                setActiveView('analytics');
              }}
            />
          ) : activeProject ? (
            <motion.div
              key={activeProjectId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col"
            >
              {['editor', 'characters', 'lore', 'storyboard'].includes(activeView) && activeProject && (
                <ProjectEditor 
                  project={activeProject}
                  chapters={chapters}
                  characters={characters}
                  loreEntries={loreEntries}
                  activeChapterId={activeChapterId}
                  setActiveChapterId={setActiveChapterId}
                  isZenMode={isZenMode}
                  setIsZenMode={setIsZenMode}
                  activeTab={activeView as any}
                  isGuest={isGuest}
                />
              )}
              {activeView === 'reader' && activeProject && (
                <ReaderMode 
                  project={activeProject} 
                  chapters={chapters} 
                  onBack={() => setActiveView('editor')}
                  projectFormat={activeProject.format}
                />
              )}
              {activeView === 'schedule' && activeProject && (
                <ScheduleManager project={activeProject} />
              )}
              {activeView === 'chat' && activeProject && (
                <AIChat project={activeProject} isGuest={isGuest} projectFormat={activeProjectFormat || activeProject.format} />
              )}
              {activeView === 'analytics' && activeProject && (
                <AnalyticsPanel project={activeProject} onClose={() => setActiveView('dashboard')} />
              )}
            </motion.div>
          ) : activeView === 'catalog' ? (
            <Catalog 
              onSelectWork={(id) => {
                setActiveProjectId(id);
                setActiveView('reader');
              }} 
            />
          ) : activeView === 'admin' && isAdmin ? (
            <AdminDashboard />
          ) : activeProjectId ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#080808]">
               <motion.div 
                 animate={{ rotate: 360 }}
                 transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                 className="mb-8"
               >
                  <Sparkles className="w-12 h-12 text-editorial-accent opacity-20" />
               </motion.div>
               <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 animate-pulse">Sintonizando Frequência Literária...</p>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <button onClick={() => setActiveView('dashboard')} className="text-editorial-accent">
                Voltar ao Dashboard
              </button>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
