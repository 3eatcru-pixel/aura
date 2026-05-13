import { Timestamp } from "firebase/firestore";

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  createdAt: any;
}

export interface Universe {
  id: string;
  title: string;
  description?: string;
  ownerId: string;
  createdAt: any;
  updatedAt: any;
}

export interface Project {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  ownerId: string;
  universeId?: string; // Para vincular a um universo/mundo
  type: 'novel' | 'manga' | 'script' | 'comic' | 'rpg' | 'lore';
  currentContent?: string;
  genre?: string;
  updatedAt: any;
  createdAt: any;
}

export interface StoryItem {
  id: string;
  name: string;
  description?: string;
  type: 'item' | 'magic' | 'function' | 'location' | 'lore';
  properties?: string;
  imageUrl?: string;
  updatedAt: any;
}

export interface Character {
  id: string;
  name: string;
  description?: string;
  role?: string;
  traits?: string;
  goals?: string;      // Objetivos principais
  fears?: string;      // Medos e traumas
  vocalTone?: string;   // Tom de voz/personalidade na fala
  history?: string;    // Biografia/Background
  imageUrl?: string; // Foto do personagem
  isAutoDetected?: boolean;
  updatedAt: any;
}

export interface ArtAsset {
  id: string;
  title: string;
  imageUrl: string;
  description?: string;
  type: 'concept' | 'panel' | 'background';
  pageNumber?: number;
  createdAt: any;
}

export interface Lore {
  id: string;
  title: string;
  content: string;
  category: 'world' | 'lore' | 'note' | 'rpg' | 'item' | 'magic' | 'faction' | 'timeline';
  properties?: string;
  updatedAt: any;
}

export interface LoreVersion {
  id: string;
  content: string;
  note?: string;
  createdAt: any;
}

export interface Version {
  id: string;
  content: string;
  note?: string;
  createdAt: any;
}

export interface WritingSchedule {
  id: string;
  goal: number;
  deadline: any;
  currentProgress: number;
  title: string;
  updatedAt: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: any;
}

export interface Chapter {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  order: number;
  groupTitle?: string; // Título do Capítulo (Agrupador de Páginas)
  ambientAudioUrl?: string; // Para trilha sonora/ambiance do capítulo
  updatedAt: any;
  createdAt: any;
}

export interface AuditIssue {
  id: string;
  category: 'UX' | 'Narrative' | 'Character' | 'Visual' | 'Technical' | 'Emotional';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  suggestion: string;
  location?: string; // e.g. "Chapter 4" or "UI"
}

export interface AuditReport {
  id: string;
  overallScore: number; // 0-100
  timestamp: any;
  issues: AuditIssue[];
  metrics: {
    uxEfficiency: number;
    narrativeCohesion: number;
    characterDepth: number;
    visualClarity: number;
    technicalHealth: number;
    emotionalImpact: number;
  };
}

export interface CinematicNode {
  id: string;
  type: 'panel' | 'scene' | 'text' | 'ref';
  x: number;
  y: number;
  width: number;
  height: number;
  content: {
    imageUrl?: string;
    description?: string;
    cameraAngle?: string;
    shotType?: string;
    balloonText?: string;
    balloonType?: 'normal' | 'scream' | 'thought' | 'whisper';
    mood?: string;
    persistentCharacterIds?: string[];
  };
  order: number;
  createdAt: any;
}

export interface CinematicState {
  nodes: CinematicNode[];
  zoom: number;
  center: { x: number, y: number };
}
