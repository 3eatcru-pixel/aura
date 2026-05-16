import React, { createContext, useContext, ReactNode, useState, useMemo, useCallback } from 'react';
import { Project, Chapter, Character } from '../types';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ProjectContextType {
  project: Project;
  chapters: Chapter[];
  characters: Character[];
  activeChapterId: string | null;
  isGuest: boolean;
  activeChapter: Chapter | undefined;
  isSyncing: boolean;
  setIsSyncing: (val: boolean) => void;
  saveChapter: (chapterId: string, data: Partial<Chapter>) => Promise<void>;
  drafts: Record<string, { title: string; content: string }>;
  setChapterDraft: (id: string, data: { title?: string; content?: string }) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ 
  children, 
  project, 
  chapters, 
  characters, 
  activeChapterId, 
  isGuest 
}: ProjectContextType & { children: ReactNode }) {
  // Note: we destructure from a broader type but manage local sync state here
  return <RealProjectProvider project={project} chapters={chapters} characters={characters} activeChapterId={activeChapterId} isGuest={isGuest}>{children}</RealProjectProvider>;
}

// Internal provider to manage state logic properly
interface InternalProviderProps {
  children: ReactNode;
  project: Project;
  chapters: Chapter[];
  characters: Character[];
  activeChapterId: string | null;
  isGuest: boolean;
}
function RealProjectProvider({ children, project, chapters, characters, activeChapterId, isGuest }: InternalProviderProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { title: string; content: string }>>({});

  const activeChapter = useMemo(() => 
    chapters.find(c => c.id === activeChapterId) || chapters[0],
  [chapters, activeChapterId]);

  const setChapterDraft = useCallback((id: string, data: { title?: string; content?: string }) => {
    setDrafts(prev => ({
      ...prev,
      [id]: { 
        title: data.title ?? (prev[id]?.title || chapters.find(c => c.id === id)?.title || ''),
        content: data.content ?? (prev[id]?.content || chapters.find(c => c.id === id)?.content || '')
      }
    }));
  }, [chapters]);

  const saveChapter = useCallback(async (chapterId: string, data: Partial<Chapter>) => {
    if (isGuest || !project.id) return;
    
    setIsSyncing(true);
    try {
      const chapterRef = doc(db, 'projects', project.id, 'chapters', chapterId);
      const projectRef = doc(db, 'projects', project.id);
      
      await Promise.all([
        updateDoc(chapterRef, { ...data, updatedAt: serverTimestamp() }),
        updateDoc(projectRef, { updatedAt: serverTimestamp() })
      ]);
    } catch (error) {
      console.error("Critical failure during sync:", error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [project.id, isGuest]);

  const value = useMemo(() => ({
    project,
    chapters,
    characters,
    activeChapterId,
    isGuest,
    activeChapter,
    isSyncing,
    setIsSyncing,
    saveChapter,
    drafts,
    setChapterDraft
  }), [project, chapters, characters, activeChapterId, isGuest, activeChapter, isSyncing, saveChapter, drafts, setChapterDraft]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject deve ser usado dentro de um ProjectProvider');
  }
  return context;
}