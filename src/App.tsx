/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { auth, db, signInWithGoogle } from './lib/firebase';
import { Project, Chapter } from './types';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { ProjectEditor } from './components/ProjectEditor';
import { ReaderMode } from './components/ReaderMode';
import { CharacterList } from './components/CharacterList';
import { LoreManager } from './components/LoreManager';
import { ScheduleManager } from './components/ScheduleManager';
import { VisualManager } from './components/VisualManager';
import { AIChat } from './components/AIChat';
import { LogIn, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [view, setView] = useState<'dashboard' | 'editor' | 'reader' | 'characters' | 'lore' | 'schedule' | 'chat' | 'storyboard'>('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) {
        setProjects([]);
        setActiveProject(null);
        setChapters([]);
        setView('dashboard');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeProject) {
      setChapters([]);
      return;
    }

    const q = query(
      collection(db, 'projects', activeProject.id, 'chapters'),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const caps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chapter));
      setChapters(caps);
    });

    return () => unsubscribe();
  }, [activeProject?.id]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'projects'),
      where('ownerId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      setProjects(projs);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSelectProject = (project: Project) => {
    setActiveProject(project);
    setView('editor');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-editorial-bg">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <BookOpen className="w-8 h-8 text-editorial-accent" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-editorial-bg flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-12 rounded-[40px] shadow-sm text-center border border-editorial-border"
        >
          <div className="w-20 h-20 bg-editorial-sidebar rounded-[32px] flex items-center justify-center mx-auto mb-8 border border-editorial-border">
            <BookOpen className="w-10 h-10 text-editorial-accent" />
          </div>
          <h1 className="text-5xl font-serif font-light text-editorial-accent mb-4 italic">Lumen Scribe</h1>
          <p className="text-editorial-muted mb-12 font-sans text-sm leading-relaxed">
            Seu tomo digital para a forja de mundos, tecelagem de personagens e registros de crônicas inesquecíveis.
          </p>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-editorial-accent text-white py-5 px-6 rounded-full hover:opacity-90 transition-all font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-black/10"
          >
            <LogIn className="w-5 h-5" />
            Entrar no Refúgio
          </button>
        </motion.div>
        <p className="mt-8 text-[10px] text-editorial-muted font-bold uppercase tracking-widest opacity-50">© 2024 Lumen Scribe Editorial</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-editorial-bg flex font-sans text-editorial-accent antialiased">
      <Sidebar
        activeView={view}
        setView={setView}
        hasActiveProject={!!activeProject}
        onBackToDashboard={() => {
          setView('dashboard');
          setActiveProject(null);
        }}
      />
      
      <main className="flex-1 flex flex-col min-w-0">
        <Navbar user={user} activeProject={activeProject} />
        
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              <Dashboard
                key="dashboard"
                projects={projects}
                onSelectProject={handleSelectProject}
              />
            )}
            {activeProject && (
              <>
                {view === 'editor' && (
                  <ProjectEditor
                    key="editor"
                    project={activeProject}
                  />
                )}
                {view === 'reader' && (
                  <ReaderMode
                    key="reader"
                    project={activeProject}
                    chapters={chapters}
                    onBack={() => setView('editor')}
                  />
                )}
                {view === 'characters' && (
                  <CharacterList
                    key="characters"
                    project={activeProject}
                    chapters={chapters}
                  />
                )}
                {view === 'storyboard' && (
                  <VisualManager
                    key="storyboard"
                    project={activeProject}
                    mode="storyboard"
                  />
                )}
                {view === 'lore' && (
                  <LoreManager
                    key="lore"
                    project={activeProject}
                    chapters={chapters}
                  />
                )}
                {view === 'schedule' && (
                  <ScheduleManager
                    key="schedule"
                    project={activeProject}
                  />
                )}
                {view === 'chat' && (
                  <AIChat
                    key="chat"
                    project={activeProject}
                  />
                )}
              </>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
