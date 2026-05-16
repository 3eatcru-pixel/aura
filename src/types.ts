export interface Project {
  id: string;
  title: string;
  description?: string;
  ownerId: string;
  authorName?: string;
  format?: string;
  type?: string;
  genre?: string;
  tags?: string[];
  coverImage?: string;
  monetizationEnabled?: boolean;
  universeId?: string;
  stats?: {
    views: number;
    favorites: number;
  };
  updatedAt: any;
}

export interface Chapter {
  id: string;
  title: string;
  content?: string;
  order: number;
  isPremium?: boolean;
  priceCoins?: number;
}

export interface Character {
  id: string;
  name: string;
  role?: string;
  description?: string;
}

export interface LoreEntry {
  id: string;
  title: string;
  category: string;
  content: string;
}

export interface WorkStats {
  workId: string;
  unlocks: number;
  revenueBRL: number;
  views: number;
  favorites: number;
  updatedAt: any;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  balanceBRL?: number;
  totalCoinsEarned?: number;
  pixKey?: string;
  fullName?: string;
}

export interface PublishedWork {
  id: string;
  title: string;
  synopsis: string;
  coverImage?: string;
  authorId: string;
  authorName: string;
  genre: string;
  tags: string[];
  stats: {
    views: number;
    favorites: number;
    chaptersCount: number;
    uniqueReaders: number;
    totalRevenueCoins: number;
  };
  pricing: {
    isFree: boolean;
    pricingModel: 'per_chapter' | 'subscription' | 'free';
  };
  updatedAt: any;
}
