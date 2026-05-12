import React, { useState, useEffect, useRef } from 'react';
import { Project, Character, Chapter } from '../types';
import { doc, updateDoc, serverTimestamp, collection, onSnapshot, addDoc, query, orderBy, getDocs, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Music, Sparkles, Save, History, Users, Settings2, Trash2, X, ChevronRight, Layout, PenTool, Image as ImageIcon, Lightbulb, Check, AlertCircle, Maximize2, Minimize2, Search, Coffee, Eye, FileText, Zap, Book, Plus, GripVertical, Globe, RotateCcw, RotateCw, Clapperboard, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { detectCharacters, getWritingSuggestion, analyzeManuscript, ImprovementSuggestion, researchTopic, getAutocomplete, getSynonyms, runIntelligentAudit } from '../services/aiService';
import { cn, formatDate } from '../lib/utils';
import { VisualManager } from './VisualManager';
import { LoreManager } from './LoreManager';
import { CharacterList } from './CharacterList';
import { AIChat } from './AIChat';
import { AuditPanel } from './AuditPanel';
import { CinematicDirector } from './CinematicDirector';
import { AuditReport } from '../types';
import { BarChart3, RefreshCw, CheckCircle2, Wand2 } from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ProjectEditorProps {
  project: Project;
  key?: string;
}

type EditorTab = 'writing' | 'visual' | 'settings' | 'lore';

export function ProjectEditor({ project }: ProjectEditorProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState<EditorTab>('writing');
  const [architectMode, setArchitectMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showManuscript, setShowManuscript] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showDirector, setShowDirector] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [researchQuery, setResearchQuery] = useState('');
  const [researchResult, setResearchResult] = useState('');
  const [isResearchLoading, setIsResearchLoading] = useState(false);
  const [sessionWordCount, setSessionWordCount] = useState(0);
  const initialWordCount = useRef(0);
  const [projectMetadata, setProjectMetadata] = useState({ 
    title: project.title, 
    subtitle: (project as any).subtitle || '',
    type: project.type 
  });
  const [versions, setVersions] = useState<any[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [lores, setLores] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<ImprovementSuggestion[]>([]);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null);
  const [visualSubTab, setVisualSubTab] = useState<'characters' | 'art'>('characters');
  const [autocomplete, setAutocomplete] = useState('');
  const [isAutocompleteLoading, setIsAutocompleteLoading] = useState(false);
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [selectedWord, setSelectedWord] = useState('');
  const [synonymPos, setSynonymPos] = useState({ x: 0, y: 0 });
  const [isScriptMode, setIsScriptMode] = useState(project.type === 'script');
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autocompleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const unsubChapters = onSnapshot(
      query(collection(db, 'projects', project.id, 'chapters'), orderBy('order', 'asc')),
      (snap) => {
        const caps = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chapter));
        setChapters(caps);
        
        // Se houver capítulos e nenhum estiver ativo, ativa o primeiro
        if (caps.length > 0 && !activeChapterId) {
          const first = caps[0];
          setActiveChapterId(first.id);
          setContent(first.content || '');
          initialWordCount.current = first.content?.split(/\s+/).filter(x => x).length || 0;
        } 
        // Se não houver capítulos, cria o primeiro
        else if (caps.length === 0 && snap.metadata.fromCache === false) {
           handleCreateChapter("Capítulo 1");
        }
      }
    );

    const unsubChars = onSnapshot(collection(db, 'projects', project.id, 'characters'), (snap) => {
      setCharacters(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Character)));
    });

    const unsubLore = onSnapshot(collection(db, 'projects', project.id, 'lore'), (snap) => {
      setLores(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubVersions = onSnapshot(
      query(collection(db, 'projects', project.id, 'versions'), orderBy('createdAt', 'desc')),
      (snap) => {
        setVersions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    return () => {
      unsubChapters();
      unsubChars();
      unsubLore();
      unsubVersions();
    };
  }, [project.id]);

  useEffect(() => {
    const currentChapter = chapters.find(c => c.id === activeChapterId);
    if (!currentChapter) return;

    const currentWords = content.split(/\s+/).filter(x => x).length;
    setSessionWordCount(Math.max(0, currentWords - initialWordCount.current));

    if (content !== currentChapter.content) {
      setSaveStatus('saving');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      // Autosave after 5 seconds of inactivity
      saveTimeoutRef.current = setTimeout(handleSave, 5000); 
    }

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [content, activeChapterId]);

  // Handle saving when user leaves or closes tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleSave();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      handleSave();
      // Only show warning if saving failed or is in progress
      if (saveStatus === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [content, activeChapterId, saveStatus]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, content]);
    setUndoStack(prev => prev.slice(0, -1));
    setContent(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, content]);
    setRedoStack(prev => prev.slice(0, -1));
    setContent(next);
  };

  const updateContentWithUndo = (newContent: string) => {
    if (newContent === content) return;
    setUndoStack(prev => [...prev.slice(-49), content]); // Keep last 50 states
    setRedoStack([]);
    setContent(newContent);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, undoStack, redoStack]);

  const handleSave = async () => {
    const currentChapter = chapters.find(c => c.id === activeChapterId);
    if (!activeChapterId || !currentChapter || content === currentChapter.content) return;
    
    setSaveStatus('saving');
    try {
      const chapterPath = `projects/${project.id}/chapters/${activeChapterId}`;
      const projectPath = `projects/${project.id}`;
      
      await updateDoc(doc(db, chapterPath), {
        content: content,
        updatedAt: serverTimestamp(),
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, chapterPath));
      
      // Também atualiza o updatedAt do projeto para refletir atividade
      await updateDoc(doc(db, projectPath), {
        updatedAt: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, projectPath));
      
      setSaveStatus('saved');
    } catch (err) {
      console.error("Save process error:", err);
      setSaveStatus('error');
    }
  };

  const handleCreateChapter = async (title?: string) => {
    const nextOrder = chapters.length > 0 ? Math.max(...chapters.map(c => c.order || 0)) + 1 : 1;
    const capTitle = title || `Capítulo ${chapters.length + 1}`;
    
    // Save current content before switching
    const currentChapter = chapters.find(c => c.id === activeChapterId);
    if (currentChapter && content !== currentChapter.content) {
      await handleSave();
    }

    const path = `projects/${project.id}/chapters`;
    setSaveStatus('saving');
    try {
      const docRef = await addDoc(collection(db, path), {
        title: capTitle,
        content: '',
        order: nextOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.CREATE, path));
      
      if (docRef) {
        setActiveChapterId(docRef.id);
        setContent('');
        initialWordCount.current = 0;
        setActiveTab('writing'); // Ensure we go to the writing tab
        setShowManuscript(true); // Keep drawer open to show the new chapter in list
        setSaveStatus('saved');
      }
    } catch (err) {
      console.error("Create chapter error:", err);
      setSaveStatus('error');
      alert("Erro ao criar capítulo.");
    }
  };

  const handleChapterSwitch = (chapterId: string) => {
    // Switch tab even if it's the same chapter, to make it "open"
    setActiveTab('writing');
    setShowManuscript(false);
    
    if (chapterId === activeChapterId) return;

    const currentChapter = chapters.find(c => c.id === activeChapterId);
    if (currentChapter && content !== currentChapter.content) {
      handleSave();
    }
    const target = chapters.find(c => c.id === chapterId);
    if (target) {
      setActiveChapterId(chapterId);
      setContent(target.content || '');
      initialWordCount.current = target.content?.split(/\s+/).filter(x => x).length || 0;
    }
  };

  const handleRenameChapter = async (chapterId: string, oldTitle: string) => {
    const chapter = chapters.find(c => c.id === chapterId);
    const newTitle = prompt("Novo nome do capítulo:", oldTitle);
    if (newTitle === null) return;
    
    const ambientUrl = prompt("Link do Áudio Ambiente/Trilha (Opcional):", chapter?.ambientAudioUrl || '');
    if (ambientUrl === null) return;

    const path = `projects/${project.id}/chapters/${chapterId}`;
    try {
      await updateDoc(doc(db, path), {
        title: newTitle || oldTitle,
        ambientAudioUrl: ambientUrl,
        updatedAt: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, path));
    } catch (err) {
      console.error("Update chapter settings error:", err);
    }
  };

  const handleDeleteChapter = async (chapterId: string, title: string) => {
    if (chapters.length <= 1) {
      alert("O manuscrito precisa de pelo menos um capítulo.");
      return;
    }
    if (!confirm(`Tem certeza que deseja apagar o capítulo "${title}"? Esta ação não pode ser desfeita.`)) return;

    const path = `projects/${project.id}/chapters/${chapterId}`;
    try {
      await deleteDoc(doc(db, path)).catch(err => handleFirestoreError(err, OperationType.DELETE, path));
      if (activeChapterId === chapterId) {
        const remaining = chapters.filter(c => c.id !== chapterId);
        if (remaining.length > 0) {
          handleChapterSwitch(remaining[0].id);
        }
      }
    } catch (err) {
      console.error("Delete chapter error:", err);
    }
  };

  const handleTabChange = (tab: EditorTab) => {
    const currentChapter = chapters.find(c => c.id === activeChapterId);
    if (activeTab !== tab && currentChapter && content !== currentChapter.content) {
      handleSave();
    }
    if (tab !== 'lore') setArchitectMode(false);
    if (tab !== 'writing') {
      setShowManuscript(false);
      setShowResearch(false);
      setShowVersions(false);
      setShowChat(false);
      setShowAudit(false);
      setSuggestions([]);
    }
    setActiveTab(tab);
  };

  const handleAudit = async () => {
    setIsAuditLoading(true);
    try {
      const loreContext = lores.map(l => `[${l.title}]: ${l.content}`).join('\n');
      const charContext = characters.map(c => `${c.name}: ${c.traits}. Bio: ${c.description}`).join('\n');
      const report = await runIntelligentAudit(content, `${loreContext}\n\n${charContext}`, projectMetadata);
      setAuditReport(report);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAuditLoading(false);
    }
  };

  const handleUpdateProjectMetadata = async () => {
    setSaveStatus('saving');
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        ...projectMetadata,
        updatedAt: serverTimestamp()
      });
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const handlePromoteToUniverse = async () => {
    if (!confirm(`Deseja promover "${project.title}" a um Universo? Isso permitirá que você adicione outros volumes (sequências, spin-offs) que compartilham o mesmo compêndio e lore.`)) return;
    
    setSaveStatus('saving');
    try {
      // 1. Create the universe document
      const universeRef = await addDoc(collection(db, 'universes'), {
        title: project.title,
        description: `Universo originado do manuscrito: ${project.title}.`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        authorId: auth.currentUser?.uid || 'anonymous'
      });

      // 2. Link the current project to this new universe
      await updateDoc(doc(db, 'projects', project.id), {
        universeId: universeRef.id,
        updatedAt: serverTimestamp()
      });

      alert("Promoção concluída! Este volume agora faz parte de um Universo compartilhado.");
      window.location.reload(); // Refresh to update context
    } catch (err) {
      console.error(err);
      alert("Erro ao promover a universo.");
      setSaveStatus('error');
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm(`TEM CERTEZA? Isso destruirá permanentemente o manuscrito "${project.title}", todos os capítulos e arte associada.`)) return;
    
    try {
      // Cleanup chapters
      const chaptersSnap = await getDocs(collection(db, 'projects', project.id, 'chapters'));
      for (const d of chaptersSnap.docs) {
        await deleteDoc(d.ref);
      }
      // Cleanup chat
      const chatSnap = await getDocs(collection(db, 'projects', project.id, 'chat'));
      for (const d of chatSnap.docs) {
        await deleteDoc(d.ref);
      }
      // Cleanup characters
      const charSnap = await getDocs(collection(db, 'projects', project.id, 'characters'));
      for (const d of charSnap.docs) {
        await deleteDoc(d.ref);
      }
      // Delete project
      await deleteDoc(doc(db, 'projects', project.id));
      window.location.reload(); // Returns to dashboard since project is gone
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir projeto.");
    }
  };

  const createVersion = async () => {
    const note = prompt("Dê um nome ou nota para esta versão:");
    if (note === null) return;
    
    try {
      await addDoc(collection(db, 'projects', project.id, 'versions'), {
        content,
        note: note || `Versão de ${new Date().toLocaleString()}`,
        createdAt: serverTimestamp(),
      });
      alert("Versão salva com sucesso!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleAiAssist = async () => {
    if (saveStatus === 'saving') {
      alert("Aguarde a sincronização do manuscrito antes de solicitar assistência.");
      return;
    }
    const instruction = prompt("O que você gostaria que a IA fizesse? (Ex: 'continue a cena', 'melhore o diálogo', 'descreva o ambiente')");
    if (!instruction) return;

    setIsAiLoading(true);
    try {
      const storyContext = content.slice(-2000); // Send last 2000 chars as context
      const suggestion = await getWritingSuggestion(project.description || "", storyContext, instruction);
      if (suggestion) {
        setContent(prev => prev + "\n" + suggestion);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAnalyze = async (mode: 'improvements' | 'consistency' | 'show-don-t-tell') => {
    if (!content.trim()) return;
    if (saveStatus === 'saving') {
      alert("Sincronizando mudanças... Por favor, aguarde um momento.");
      return;
    }
    setIsAiLoading(true);
    setSuggestions([]);
    try {
      const loreContext = lores.map(l => `[${l.title}]: ${l.content}`).join('\n');
      const charContext = characters.map(c => 
        `Personagem: ${c.name}. Papel: ${c.role}. Traços: ${c.traits}. Bio: ${c.description}. Objetivos: ${c.goals}. Medos: ${c.fears}.`
      ).join('\n');
      
      const fullLore = `${loreContext}\n\n${charContext}`;
      
      const results = await analyzeManuscript(content, project.description || "", mode, mode === 'consistency' ? fullLore : undefined);
      setSuggestions(results);
      if (results.length > 0) setActiveSuggestionId(results[0].id);
      else alert("Nenhum ponto de melhoria crítico detectado.");
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleResearch = async () => {
    if (!researchQuery.trim()) return;
    setIsResearchLoading(true);
    try {
      const result = await researchTopic(researchQuery);
      setResearchResult(result || "");
    } catch (err) {
      console.error(err);
    } finally {
      setIsResearchLoading(false);
    }
  };

  const insertTemplate = (type: 'scene' | 'beat' | 'panel') => {
    const templates = {
      scene: "\n\n[CENA: Localização - Tempo]\nOBJETIVO: O que o personagem quer?\nCONFLITO: O que impede?\nDESFECHO: Como termina?\n---\n",
      beat: "\n\n[BATIDA: Ação/Reação]\n",
      panel: "\n\n[PAINEL 1]\nVISUAL: Descreva a composição da cena aqui.\nDIÁLOGO:\nPERSONAGEM 1: Sua fala.\n---\n"
    };
    setContent(prev => prev + templates[type]);
  };

  useEffect(() => {
    // Autocomplete Logic
    if (activeTab !== 'writing' || !content.trim()) {
      setAutocomplete('');
      return;
    }

    if (autocompleteTimeoutRef.current) clearTimeout(autocompleteTimeoutRef.current);

    autocompleteTimeoutRef.current = setTimeout(async () => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursor = textarea.selectionStart;
      const textBefore = content.slice(0, cursor);
      const textAfter = content.slice(cursor);

      // Only autocomplete if we are at the end of a sentence or word (space)
      const lastChar = textBefore.slice(-1);
      if (![' ', '.', '!', '?', '\n'].includes(lastChar)) {
        setAutocomplete('');
        return;
      }

      setIsAutocompleteLoading(true);
      try {
        const loreText = `Contexto: ${project.description}. Personagens: ${characters.map(c => c.name).join(', ')}.`;
        const suggestion = await getAutocomplete(loreText, textBefore.slice(-500), textAfter.slice(0, 500));
        setAutocomplete(suggestion);
      } catch (err) {
        console.error(err);
      } finally {
        setIsAutocompleteLoading(false);
      }
    }, 1500); // 1.5s delay after typing

    return () => {
      if (autocompleteTimeoutRef.current) clearTimeout(autocompleteTimeoutRef.current);
    };
  }, [content, activeTab]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && autocomplete) {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursor = textarea.selectionStart;
      const newContent = content.slice(0, cursor) + autocomplete + content.slice(cursor);
      setContent(newContent);
      setAutocomplete('');
      
      // Move cursor after the inserted text
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = cursor + autocomplete.length;
      }, 0);
    }
  };

  const handleSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start !== end) {
      const selectedText = content.slice(start, end).trim();
      if (selectedText && !selectedText.includes(' ') && selectedText.length > 2) {
        setSelectedWord(selectedText);
        // Get bounding rect for positioning (approximate)
        const rect = textarea.getBoundingClientRect();
        // Since we can't easily get cursor position in a plain textarea pixels, 
        // we'll show it near the top or bottom of the editor as a "Selection Assist"
        setSynonymPos({ x: rect.left + 50, y: rect.bottom - 100 });
      } else {
        setSelectedWord('');
        setSynonyms([]);
      }
    } else {
      setSelectedWord('');
      setSynonyms([]);
    }
  };

  const handleGetSynonyms = async () => {
    if (!selectedWord) return;
    setIsAiLoading(true);
    try {
      const sentence = content.slice(Math.max(0, content.indexOf(selectedWord) - 50), content.indexOf(selectedWord) + selectedWord.length + 50);
      const loreText = `Contexto: ${project.description}.`;
      const results = await getSynonyms(selectedWord, sentence, loreText);
      setSynonyms(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const replaceWithSynonym = (synonym: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.slice(0, start) + synonym + content.slice(end);
    setContent(newContent);
    setSelectedWord('');
    setSynonyms([]);
  };

  const applySuggestion = (suggestion: ImprovementSuggestion) => {
    const newContent = content.replace(suggestion.originalText, suggestion.suggestedText);
    setContent(newContent);
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    setActiveSuggestionId(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn("flex h-full transition-all duration-700 bg-editorial-bg text-[#EAEAEA]")}
    >
      {!isZenMode && (
        <div className="w-20 border-r border-white/5 bg-editorial-sidebar flex flex-col items-center py-10 gap-6 shrink-0 z-50">
           <div 
             className="w-12 h-12 bg-editorial-accent/10 rounded-2xl flex items-center justify-center text-editorial-accent mb-6 border border-editorial-accent/20 cursor-pointer hover:bg-editorial-accent hover:text-white transition-all shadow-neon"
             onClick={() => window.location.reload()}
           >
              <Layout className="w-6 h-6" />
           </div>

           <div className="flex flex-col gap-4">
             <button 
               onClick={() => handleTabChange('writing')}
               className={cn("p-4 rounded-2xl transition-all group relative", activeTab === 'writing' ? "text-editorial-accent bg-white/5 shadow-neon" : "text-editorial-muted hover:text-white hover:bg-white/5")}
               title="Área de Escrita"
             >
                <PenTool className="w-5 h-5" />
                {activeTab === 'writing' && <motion.div layoutId="tab-p" className="absolute left-0 w-1 h-6 bg-editorial-accent rounded-full" />}
             </button>
             <button 
               onClick={() => { setShowChat(!showChat); if (!showChat) { setShowManuscript(false); setShowResearch(false); setShowVersions(false); } }}
               className={cn("p-4 rounded-2xl transition-all group relative", showChat ? "text-editorial-accent bg-white/5 shadow-neon" : "text-editorial-muted hover:text-white hover:bg-white/5")}
               title="Oráculo IA"
             >
                <Sparkles className="w-5 h-5" />
             </button>
             <button 
               onClick={() => setShowManuscript(!showManuscript)}
               className={cn("p-4 rounded-2xl transition-all group relative", showManuscript ? "text-editorial-accent bg-white/5 shadow-neon" : "text-editorial-muted hover:text-white hover:bg-white/5")}
               title="Manuscrito"
             >
                <Book className="w-5 h-5" />
             </button>
             <button 
               onClick={() => handleTabChange('visual')}
               className={cn("p-4 rounded-2xl transition-all group relative", activeTab === 'visual' ? "text-editorial-accent bg-white/5 shadow-neon" : "text-editorial-muted hover:text-white hover:bg-white/5")}
               title="Storyboard & Arte"
             >
                <ImageIcon className="w-5 h-5" />
             </button>
             <button 
               onClick={() => { handleTabChange('lore'); setArchitectMode(true); }}
               className={cn("p-4 rounded-2xl transition-all group relative", activeTab === 'lore' ? "text-editorial-accent bg-white/5 shadow-neon" : "text-editorial-muted hover:text-white hover:bg-white/5")}
               title="Enciclopédia"
             >
                <Globe className="w-5 h-5" />
             </button>
             <button 
               onClick={() => setShowResearch(!showResearch)}
               className={cn("p-4 rounded-2xl transition-all group relative", showResearch ? "text-editorial-accent bg-white/5 shadow-neon" : "text-editorial-muted hover:text-white hover:bg-white/5")}
               title="Pesquisa Experimental"
             >
                <Search className="w-5 h-5" />
             </button>
             <button 
               onClick={() => { setShowAudit(!showAudit); if (!showAudit) { setShowManuscript(false); setShowResearch(false); setShowVersions(false); setShowChat(false); } }}
               className={cn("p-4 rounded-2xl transition-all group relative", showAudit ? "text-editorial-accent bg-white/5 shadow-neon" : "text-editorial-muted hover:text-white hover:bg-white/5")}
               title="Observatório de QA"
             >
                <BarChart3 className="w-5 h-5" />
             </button>
             <button 
               onClick={() => { setShowDirector(true); setShowAudit(false); setShowManuscript(false); setShowResearch(false); }}
               className={cn("p-4 rounded-2xl transition-all group relative", showDirector ? "text-editorial-accent bg-white/5 shadow-neon" : "text-editorial-muted hover:text-white hover:bg-white/5")}
               title="Mesa de Direção Cinematográfica"
             >
                <Clapperboard className="w-5 h-5" />
             </button>
           </div>

           <div className="mt-auto flex flex-col gap-4">
              <button 
                onClick={() => setIsZenMode(true)}
                className="p-4 text-editorial-muted hover:text-editorial-accent transition-all hover:bg-white/5 rounded-2xl"
                title="Modo Imersão Total"
              >
                 <Maximize2 className="w-5 h-5" />
              </button>
              <button 
                onClick={() => handleTabChange('settings')}
                className={cn("p-4 rounded-2xl transition-all", activeTab === 'settings' ? "text-editorial-accent bg-white/5 shadow-neon" : "text-editorial-muted hover:text-white hover:bg-white/5")}
              >
                 <Settings2 className="w-5 h-5" />
              </button>
           </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {!isZenMode && (
          <div className="flex items-center justify-between px-10 py-5 border-b border-white/5 bg-editorial-sidebar/50 backdrop-blur-xl z-30">
            <div className="flex items-center gap-6 text-[9px] font-black text-editorial-muted uppercase tracking-[0.2em]">
              {activeTab === 'writing' && (
                <>
                  {saveStatus === 'saving' && (
                    <span className="flex items-center gap-2 text-editorial-accent"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Transmitindo...</span>
                  )}
                  {saveStatus === 'saved' && (
                    <span className="flex items-center gap-2 text-white/40"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Sincronizado</span>
                  )}
                  {saveStatus === 'error' && (
                    <span className="flex items-center gap-2 text-red-500"><AlertCircle className="w-3.5 h-3.5" /> Ruptura na Matriz</span>
                  )}
                  <div className="h-4 w-px bg-white/5" />
                  <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> {content.split(/\s+/).filter(x => x).length} Glifos</span>
                  <div className="h-4 w-px bg-white/5" />
                  <span className="flex items-center gap-1.5 text-editorial-accent"><Zap className="w-3.5 h-3.5" /> +{sessionWordCount} Inserções</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-5">
              {activeTab === 'writing' && (
                <>
                  <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10 glass-panel">
                     <button 
                       onClick={() => handleAnalyze('improvements')}
                       className="flex items-center gap-2 text-editorial-muted px-4 py-2 rounded-xl hover:text-white transition-all font-black text-[9px] uppercase tracking-widest disabled:opacity-50"
                       title="Polimento de Estilo"
                     >
                       <Lightbulb className="w-3.5 h-3.5" /> PROSA
                     </button>
                     <button 
                       onClick={() => handleAnalyze('show-don-t-tell')}
                       className="flex items-center gap-2 text-editorial-muted px-4 py-2 rounded-xl hover:text-white transition-all font-black text-[9px] uppercase tracking-widest disabled:opacity-50"
                       title="Imersão Sensorial"
                     >
                       <Eye className="w-3.5 h-3.5" /> VISÃO
                     </button>
                     <button 
                       onClick={() => handleAnalyze('consistency')}
                       className="flex items-center gap-2 text-editorial-muted px-4 py-2 rounded-xl hover:text-white transition-all font-black text-[9px] uppercase tracking-widest disabled:opacity-50"
                       title="Nexo Narrativo"
                     >
                       <AlertCircle className="w-3.5 h-3.5" /> NEXO
                     </button>
                  </div>

                  <div className="w-px h-8 bg-white/5 mx-1" />
                  
                  <button
                    onClick={() => setIsScriptMode(!isScriptMode)}
                    className={cn(
                      "flex items-center gap-3 px-6 py-2.5 rounded-2xl transition-all font-black text-[9px] uppercase tracking-widest border",
                      isScriptMode ? "bg-editorial-accent text-white border-editorial-accent shadow-neon" : "bg-white/5 text-editorial-muted border-white/10 hover:text-white"
                    )}
                  >
                    <Clapperboard className="w-4 h-4" /> {isScriptMode ? "Modo Roteiro" : "Modo Prosa"}
                  </button>

                  <button
                    onClick={handleAiAssist}
                    disabled={isAiLoading}
                    className="flex items-center gap-3 bg-editorial-accent text-white px-8 py-2.5 rounded-2xl hover:scale-105 active:scale-95 transition-all font-black text-[10px] uppercase tracking-widest disabled:opacity-50 shadow-neon"
                  >
                    <Wand2 className={cn("w-4 h-4", isAiLoading && "animate-spin")} />
                    Assistente
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {isZenMode && (
          <button 
            onClick={() => setIsZenMode(false)}
            className="fixed top-8 right-8 p-3 bg-editorial-bg hover:bg-editorial-sidebar rounded-full text-editorial-muted hover:text-editorial-accent transition-all z-50 border border-editorial-border"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        )}

        <div className="flex-1 overflow-hidden relative bg-[#0D0D0D]">
          <AnimatePresence mode="wait">
            {activeTab === 'lore' && (
              <motion.div
                key="lore"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full bg-editorial-bg"
              >
                <LoreManager project={project} chapters={chapters} initialAssistantOpen={architectMode} />
              </motion.div>
            )}

            {activeTab === 'writing' && (
              <motion.div
                key="writing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full overflow-y-auto custom-scrollbar flex flex-col relative"
              >
                <div className="max-w-[1000px] mx-auto w-full px-12 md:px-20 py-20 min-h-full flex flex-col">
                  {/* Floating Chapter Title */}
                  <div className="mb-16 flex items-center justify-between group">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                         <span className="text-[9px] font-black text-editorial-accent uppercase tracking-[0.4em]">Seção Atual</span>
                         {chapters.find(c => c.id === activeChapterId)?.ambientAudioUrl && (
                           <motion.div 
                             animate={{ scale: [1, 1.2, 1] }}
                             transition={{ duration: 2, repeat: Infinity }}
                             className="flex items-center gap-1.5 bg-editorial-accent/20 px-2 py-0.5 rounded-full border border-editorial-accent/30"
                           >
                             <Music className="w-2.5 h-2.5 text-editorial-accent" />
                             <span className="text-[7px] font-black uppercase text-editorial-accent">Imersão Sonora Ativa</span>
                           </motion.div>
                         )}
                      </div>
                      <h2 
                        onClick={() => {
                          const cap = chapters.find(c => c.id === activeChapterId);
                          if (cap) handleRenameChapter(cap.id, cap.title);
                        }}
                        className="text-4xl md:text-5xl font-brand text-editorial-accent tracking-widest cursor-pointer hover:opacity-80 transition-all uppercase"
                      >
                        {chapters.find(c => c.id === activeChapterId)?.title || "Untitled Codex"}
                      </h2>
                    </div>
                    
                    <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={handleUndo} disabled={undoStack.length === 0} className="p-3 text-editorial-muted hover:text-white disabled:opacity-20 transition-all"><RotateCcw className="w-5 h-5" /></button>
                       <button onClick={handleRedo} disabled={redoStack.length === 0} className="p-3 text-editorial-muted hover:text-white disabled:opacity-20 transition-all"><RotateCw className="w-5 h-5" /></button>
                       <div className="w-px h-6 bg-white/10 my-auto mx-1" />
                       <button onClick={() => insertTemplate(project.type === 'manga' ? 'panel' : 'scene')} className="p-3 text-editorial-muted hover:text-white transition-all" title="Inserir Matriz"><Layers className="w-5 h-5" /></button>
                    </div>
                  </div>

                  <div className="relative flex-1">
                    {/* Ghost Text Overlay for Autocomplete */}
                    <div 
                      className={cn(
                        "absolute inset-0 pointer-events-none text-transparent z-0 whitespace-pre-wrap break-words",
                        isZenMode ? "text-2xl leading-relaxed" : "text-lg leading-loose",
                        isScriptMode || project.type === 'manga' ? "font-mono tracking-tight" : "font-sans font-light"
                      )}
                      aria-hidden="true"
                    >
                      {content}
                      <span className="text-editorial-accent/40 bg-editorial-accent/10 px-0.5 rounded">
                        {autocomplete}
                      </span>
                    </div>

                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => {
                        updateContentWithUndo(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = (e.target.scrollHeight) + 'px';
                      }}
                      onKeyDown={handleKeyDown}
                      onSelect={handleSelection}
                      spellCheck={false}
                      placeholder={isScriptMode ? "CENA 1 - INTERIOR..." : "Sua alma aguarda a primeira palavra..."}
                      className={cn(
                        "w-full resize-none border-none focus:ring-0 text-[#D1D1D1] p-0 placeholder:text-white/10 bg-transparent selection:bg-editorial-accent/30 transition-all min-h-[60vh] relative z-10 whitespace-pre-wrap break-words",
                        isZenMode ? "text-2xl leading-relaxed" : "text-lg leading-loose font-sans",
                        isScriptMode ? "font-mono text-base leading-7 bg-white/2 p-12 rounded-[40px] border border-white/5" : "font-sans font-light",
                        project.type === 'manga' && !isScriptMode && "font-mono text-sm leading-8 bg-white/2 p-10 rounded-[40px] border border-white/5"
                      )}
                    />
                  </div>

                  {/* Navigator Footer */}
                  <div className="mt-32 pb-32 border-t border-white/5 pt-16 flex items-center justify-between">
                     {chapters.indexOf(chapters.find(c => c.id === activeChapterId)!) > 0 ? (
                        <button 
                          onClick={() => {
                            const idx = chapters.indexOf(chapters.find(c => c.id === activeChapterId)!);
                            handleChapterSwitch(chapters[idx - 1].id);
                          }}
                          className="flex flex-col items-start group"
                        >
                           <span className="text-[9px] font-black text-editorial-muted group-hover:text-editorial-accent mb-2 uppercase tracking-[0.3em] flex items-center gap-2">
                              <ChevronRight className="w-4 h-4 rotate-180" /> REGISTRO ANTERIOR
                           </span>
                           <span className="text-xl font-brand text-white/40 group-hover:text-white transition-all uppercase tracking-widest">
                              {chapters[chapters.indexOf(chapters.find(c => c.id === activeChapterId)!) - 1]?.title}
                           </span>
                        </button>
                     ) : <div />}

                     {chapters.indexOf(chapters.find(c => c.id === activeChapterId)!) < chapters.length - 1 ? (
                        <button 
                          onClick={() => {
                            const idx = chapters.indexOf(chapters.find(c => c.id === activeChapterId)!);
                            handleChapterSwitch(chapters[idx + 1].id);
                          }}
                          className="flex flex-col items-end group text-right"
                        >
                           <span className="text-[9px] font-black text-editorial-muted group-hover:text-editorial-accent mb-2 uppercase tracking-[0.3em] flex items-center gap-2">
                              PRÓXIMO REGISTRO <ChevronRight className="w-4 h-4" />
                           </span>
                           <span className="text-xl font-brand text-white/40 group-hover:text-white transition-all uppercase tracking-widest">
                              {chapters[chapters.indexOf(chapters.find(c => c.id === activeChapterId)!) + 1]?.title}
                           </span>
                        </button>
                     ) : (
                        <button 
                          onClick={() => handleCreateChapter()}
                          className="flex items-center gap-3 bg-editorial-accent text-white px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-neon"
                        >
                           <Plus className="w-5 h-5" /> Iniciar Próximo Destino
                        </button>
                     )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'visual' && (
              <motion.div
                key="visual"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full bg-[#0D0D0D] flex flex-col"
              >
                <div className="px-12 py-5 border-b border-white/5 bg-editorial-sidebar/50 flex gap-12">
                   <button 
                     onClick={() => setVisualSubTab('characters')}
                     className={cn(
                       "text-[10px] font-black uppercase tracking-[0.3em] pb-4 border-b-2 transition-all",
                       visualSubTab === 'characters' ? "border-editorial-accent text-editorial-accent shadow-neon" : "border-transparent text-editorial-muted hover:text-white"
                     )}
                   >
                     Galeria de Matrizes (Personagens)
                   </button>
                   <button 
                     onClick={() => setVisualSubTab('art')}
                     className={cn(
                       "text-[10px] font-black uppercase tracking-[0.3em] pb-4 border-b-2 transition-all",
                       visualSubTab === 'art' ? "border-editorial-accent text-editorial-accent shadow-neon" : "border-transparent text-editorial-muted hover:text-white"
                     )}
                   >
                     Referências Visuais & Layout
                   </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  {visualSubTab === 'characters' ? (
                    <CharacterList project={project} chapters={chapters} />
                  ) : (
                    <VisualManager project={project} mode="gallery" />
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full p-20 max-w-4xl mx-auto space-y-16 overflow-y-auto custom-scrollbar"
              >
                 <div className="space-y-4">
                    <h3 className="text-6xl font-brand text-editorial-accent uppercase tracking-widest">Protocolos da Obra</h3>
                    <p className="text-editorial-muted text-[10px] font-black uppercase tracking-[0.4em]">Configurações Fundamentais da Matriz</p>
                 </div>

                 <div className="space-y-12 pb-20">
                    {!project.universeId && (
                      <div className="bg-editorial-accent/5 border border-editorial-accent/20 rounded-[40px] p-12 relative overflow-hidden group">
                         <div className="absolute top-0 right-0 w-64 h-64 bg-editorial-accent/10 blur-[100px] transition-all group-hover:scale-150" />
                         <div className="relative z-10 space-y-8">
                            <div className="flex items-center gap-6">
                               <div className="w-16 h-16 bg-editorial-accent rounded-3xl flex items-center justify-center shadow-neon">
                                  <Globe className="w-8 h-8 text-white" />
                               </div>
                               <div>
                                  <h4 className="font-brand text-3xl text-white tracking-widest uppercase">Volume Independente</h4>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-[#EAEAEA]/40">Status: Solo Instance</p>
                               </div>
                            </div>
                            <p className="text-[#EAEAEA]/60 text-sm leading-relaxed max-w-2xl font-light">
                               Este manuscrito reside em uma instância isolada. Ao promover para um **Universo**, você desbloqueia a capacidade de compartilhar cronologias, lores e personagens entre múltiplos trabalhos e mídias.
                            </p>
                            <button 
                              onClick={handlePromoteToUniverse}
                              className="bg-white text-[#0D0D0D] px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-neon-white"
                            >
                               Codificar Promoção de Universo
                            </button>
                         </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-3">
                       <label className="text-[10px] font-black uppercase tracking-widest text-editorial-muted">Identidade do Volume</label>
                       <input 
                         type="text" 
                         placeholder="Título principal"
                         value={projectMetadata.title} 
                         onChange={(e) => setProjectMetadata(prev => ({ ...prev, title: e.target.value }))}
                         className="bg-white border border-editorial-border rounded-2xl py-4 px-6 outline-none focus:border-editorial-accent transition-all text-xl font-serif"
                       />
                       <input 
                         type="text" 
                         placeholder="Subtítulo ou Volume (Ex: Livro I: O Despertar)"
                         value={projectMetadata.subtitle} 
                         onChange={(e) => setProjectMetadata(prev => ({ ...prev, subtitle: e.target.value }))}
                         className="bg-white border border-editorial-border rounded-2xl py-3 px-6 outline-none focus:border-editorial-accent transition-all text-sm font-serif italic"
                       />
                    </div>
                    <div className="flex flex-col gap-3">
                       <label className="text-[10px] font-black uppercase tracking-widest text-editorial-muted">Formato da Narrativa</label>
                       <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                          {['novel', 'manga', 'script', 'comic', 'rpg', 'lore'].map(type => (
                             <button 
                               key={type}
                               onClick={() => setProjectMetadata(prev => ({ ...prev, type: type as any }))}
                               className={cn(
                                 "py-4 rounded-xl border font-bold text-[10px] uppercase tracking-widest transition-all",
                                 projectMetadata.type === type ? "bg-editorial-accent text-white border-editorial-accent" : "bg-white text-editorial-muted border-editorial-border hover:bg-gray-50"
                               )}
                             >
                                {type}
                             </button>
                          ))}
                       </div>
                    </div>
                 </div>

                 <div className="pt-10 border-t border-editorial-border flex justify-between">
                    <button 
                      onClick={handleDeleteProject}
                      className="flex items-center gap-2 text-red-500 font-bold text-[10px] uppercase tracking-widest hover:italic"
                    >
                       <Trash2 className="w-4 h-4" /> Destruir Manuscrito
                    </button>
                    <button 
                      onClick={handleUpdateProjectMetadata}
                      className="bg-editorial-accent text-white px-10 py-3 rounded-full font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-black/10 hover:opacity-90 transition-all"
                    >
                       {saveStatus === 'saving' ? 'Sincronizando...' : 'Preservar Alterações'}
                    </button>
                 </div>
              </motion.div>
             )}
           </AnimatePresence>
         </div>
       </div>

       <AnimatePresence>
         {showVersions && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="w-96 border-l border-white/5 bg-editorial-sidebar flex flex-col shrink-0 shadow-2xl relative z-40"
          >
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/2">
              <div className="space-y-1">
                 <h3 className="font-brand text-2xl text-editorial-accent tracking-widest uppercase">Arquivo Temporal</h3>
                 <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Sincronia de Matriz</p>
              </div>
              <button 
                onClick={() => setShowVersions(false)} 
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
              {versions.length === 0 ? (
                <div className="text-center py-20 opacity-10">
                   <History className="w-12 h-12 mx-auto mb-4" />
                   <p className="text-[10px] font-black uppercase tracking-widest">Nenhum Registro Encontrado</p>
                </div>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="p-6 rounded-[32px] bg-white/2 border border-white/5 group hover:border-editorial-accent/30 transition-all">
                    <p className="font-sans text-white/80 mb-2">{v.note}</p>
                    <p className="text-[9px] font-black text-editorial-accent/60 uppercase tracking-widest mb-6">{formatDate(v.createdAt?.toDate())}</p>
                    <button
                      onClick={() => {
                        if (confirm("Restaurar esta versão?")) {
                          setContent(v.content);
                        }
                      }}
                      className="text-[9px] font-black uppercase tracking-widest text-[#EAEAEA] border-t border-white/5 pt-4 block w-full text-left hover:text-editorial-accent transition-all"
                    >
                      Recuperar Glifos
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {showManuscript && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="w-96 border-l border-white/5 bg-editorial-sidebar flex flex-col shrink-0 shadow-2xl relative z-40"
          >
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/2">
              <div className="space-y-1">
                 <h3 className="font-brand text-2xl text-editorial-accent tracking-widest uppercase">Codex Manuscrito</h3>
                 <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Sequenciamento de Capítulos</p>
              </div>
              <button onClick={() => setShowManuscript(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 border-b border-white/5">
               <button 
                 onClick={() => handleCreateChapter()}
                 className="w-full flex items-center justify-center gap-3 bg-editorial-accent text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] shadow-neon transition-all"
               >
                  <Plus className="w-5 h-5" /> Iniciar Nova Seção
               </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-4">
               {chapters.map((cap) => (
                 <div 
                   key={cap.id}
                   onClick={() => handleChapterSwitch(cap.id)}
                   className={cn(
                     "group flex items-center gap-5 p-6 rounded-[32px] cursor-pointer transition-all border",
                     activeChapterId === cap.id ? "bg-white/5 border-editorial-accent shadow-neon-small" : "bg-transparent border-transparent hover:bg-white/2"
                   )}
                 >
                    <GripVertical className="w-4 h-4 text-white/10 group-hover:text-editorial-accent transition-colors" />
                    <div className="flex-1 overflow-hidden">
                       <h4 className={cn("font-brand text-lg uppercase tracking-widest truncate", activeChapterId === cap.id ? "text-white" : "text-white/40")}>
                          {cap.title}
                       </h4>
                       <p className="text-[8px] font-black uppercase tracking-widest text-editorial-accent/40">
                          {cap.content?.split(/\s+/).filter(x => x).length || 0} GLIFOS
                       </p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleRenameChapter(cap.id, cap.title); }}
                         className="p-2 text-white/20 hover:text-white rounded-xl hover:bg-white/5 transition-all"
                         title="Configurações da Seção"
                       >
                          <Settings2 className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleDeleteChapter(cap.id, cap.title); }}
                         className="p-2 text-red-500/20 hover:text-red-500 rounded-xl hover:bg-red-500/5 transition-all"
                         title="Purgar Seção"
                       >
                          <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                 </div>
               ))}
            </div>
          </motion.div>
        )}

        {suggestions.length > 0 && activeTab === 'writing' && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="w-96 border-l border-white/5 bg-editorial-sidebar flex flex-col shrink-0 shadow-2xl relative z-40"
          >
             <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/2">
                <div className="space-y-1">
                   <h3 className="font-brand text-2xl text-editorial-accent tracking-widest uppercase">Observatório</h3>
                   <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Refinamento de Prosa</p>
                </div>
                <button onClick={() => setSuggestions([])} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
                {suggestions.map((s) => (
                  <div 
                    key={s.id} 
                    className={cn(
                      "p-8 rounded-[40px] border transition-all cursor-pointer group",
                      activeSuggestionId === s.id ? "bg-white/5 border-editorial-accent shadow-neon-small" : "bg-transparent border-white/5 hover:border-white/10"
                    )}
                    onClick={() => setActiveSuggestionId(s.id)}
                  >
                    <div className="flex items-center gap-2 mb-4">
                       {s.type === 'grammar' && <span className="text-[8px] font-black bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full uppercase border border-blue-500/20">Sintaxe</span>}
                       {s.type === 'style' && <span className="text-[8px] font-black bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full uppercase border border-purple-500/20">Estilo</span>}
                       {s.type === 'consistency' && <span className="text-[8px] font-black bg-orange-500/10 text-orange-400 px-3 py-1 rounded-full uppercase border border-orange-500/20">Nexo</span>}
                       {s.type === 'plot' && <span className="text-[8px] font-black bg-red-500/10 text-red-400 px-3 py-1 rounded-full uppercase border border-red-500/20">Arquitetura</span>}
                    </div>
                    
                    <p className="text-[10px] text-white/40 italic mb-4 line-clamp-3 group-hover:line-clamp-none transition-all">"{s.originalText}"</p>
                    
                    <div className="flex flex-col gap-2 p-5 bg-editorial-accent/5 rounded-2xl mb-6 border border-editorial-accent/20">
                       <span className="text-[8px] font-black text-editorial-accent uppercase tracking-widest opacity-60">Matriz Sugerida</span>
                       <p className="text-xs font-sans leading-relaxed text-[#EAEAEA]">{s.suggestedText}</p>
                    </div>

                    <p className="text-[10px] leading-relaxed text-white/60 mb-8">{s.explanation}</p>

                    <button 
                      onClick={(e) => { e.stopPropagation(); applySuggestion(s); }}
                      className="w-full flex items-center justify-center gap-3 bg-editorial-accent text-white py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:scale-[1.02] transition-all shadow-neon"
                    >
                       <Check className="w-4 h-4" /> Integrar na Obra
                    </button>
                  </div>
                ))}
             </div>
          </motion.div>
        )}

        {showResearch && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="w-96 border-l border-white/5 bg-editorial-sidebar flex flex-col shrink-0 shadow-2xl relative z-40"
          >
             <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/2">
                <div className="space-y-1">
                   <h3 className="font-brand text-2xl text-editorial-accent tracking-widest uppercase">Arquivos de Grounding</h3>
                   <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Pesquisa de Matriz</p>
                </div>
                <button onClick={() => setShowResearch(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
             </div>
             
             <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                   <label className="text-[9px] font-black uppercase tracking-[0.3em] text-editorial-accent">Consultar Realidade Externa</label>
                   <div className="relative">
                      <input 
                        type="text" 
                        value={researchQuery}
                        onChange={(e) => setResearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
                        placeholder="Ex: Armas renascentistas..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-12 outline-none text-[10px] font-black uppercase tracking-widest text-white focus:border-editorial-accent transition-all"
                      />
                      <button 
                        onClick={handleResearch}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-white/20 hover:text-editorial-accent transition-colors"
                      >
                         <Search className="w-4 h-4" />
                      </button>
                   </div>
                </div>

                {isResearchLoading && (
                  <div className="flex flex-col items-center py-20 gap-4">
                     <RefreshCw className="w-8 h-8 text-editorial-accent animate-spin" />
                     <p className="text-[9px] font-black uppercase tracking-widest text-[#EAEAEA]/40 animate-pulse">Varrendo Bases de Dados...</p>
                  </div>
                )}

                {researchResult && !isResearchLoading && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 p-8 rounded-[32px] border border-white/5 shadow-xl"
                  >
                     <p className="text-xs leading-relaxed text-[#EAEAEA]/80 font-sans whitespace-pre-wrap">{researchResult}</p>
                  </motion.div>
                )}
             </div>
          </motion.div>
        )}

        {showChat && activeTab === 'writing' && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="w-96 border-l border-white/5 bg-editorial-sidebar flex flex-col shrink-0 shadow-2xl relative z-40"
          >
             <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/2">
                <div className="space-y-1">
                   <h3 className="font-brand text-2xl text-editorial-accent tracking-widest uppercase">Oráculo da Musa</h3>
                   <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Interface de Co-Criação</p>
                </div>
                <button onClick={() => setShowChat(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
             </div>
             <div className="flex-1 overflow-hidden">
                <AIChat project={project} currentContent={content} />
             </div>
           </motion.div>
        )}

        {showAudit && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="w-96 border-l border-white/5 bg-editorial-sidebar flex flex-col shrink-0 shadow-2xl relative z-40"
          >
             <AuditPanel 
               report={auditReport} 
               isLoading={isAuditLoading} 
               onClose={() => setShowAudit(false)} 
               onAuditClick={handleAudit} 
             />
          </motion.div>
        )}

        <AnimatePresence>
          {showDirector && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="fixed inset-0 z-[100] bg-black"
            >
              <CinematicDirector 
                project={project} 
                characters={characters}
                onClose={() => setShowDirector(false)} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatePresence>
     </motion.div>
  );
}
