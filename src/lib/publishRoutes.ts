import express from 'express';
import admin from 'firebase-admin';
import { authenticateUser, AuthenticatedRequest } from './auth';

const router = express.Router();
const adminDb = admin.firestore();

/**
 * Realiza o Snapshot (Deploy) de um projeto para o catálogo público.
 * Segue o modelo "Google Sites" - Draft vs Live.
 */
router.post('/project', authenticateUser, async (req: AuthenticatedRequest, res: express.Response) => {
  const { projectId, chapters, lore, characters } = req.body;
  const userId = req.user?.uid;

  if (!projectId || !chapters || !userId) return res.status(400).json({ error: 'missing_payload' });

  try {
    const projectRef = adminDb.doc(`projects/${projectId}`);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists || projectSnap.data()?.ownerId !== userId) {
      return res.status(403).json({ error: 'unauthorized_publish' });
    }

    const projectData = projectSnap.data()!;
    const batch = adminDb.batch();

    // 1. Atualiza/Cria a obra no Catálogo Público (PublishedWork)
    const workRef = adminDb.collection('published_works').doc(projectId);
    batch.set(workRef, {
      id: projectId,
      title: projectData.title,
      synopsis: projectData.description,
      coverImage: projectData.coverImage || '',
      authorId: userId,
      authorName: projectData.authorName || 'Autor Desconhecido',
      genre: projectData.genre || 'Original',
      tags: projectData.tags || [],
      pricing: {
        isFree: !projectData.monetizationEnabled,
        pricingModel: projectData.monetizationEnabled ? 'per_chapter' : 'free'
      },
      stats: {
        views: projectData.stats?.views || 0,
        favorites: projectData.stats?.favorites || 0,
        chaptersCount: chapters.length
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 2. Cria Snapshots Imutáveis dos Capítulos (PublishedChapters)
    // Nota: O conteúdo no rascunho pode continuar mudando, mas o leitor vê este snapshot.
    for (const chap of chapters) {
      const pubChapterId = `pub_${projectId}_${chap.id}`;
      const pubChapterRef = adminDb.collection('published_chapters').doc(pubChapterId);
      
      batch.set(pubChapterRef, {
        id: pubChapterId,
        workId: projectId,
        chapterId: chap.id,
        title: chap.title,
        content: chap.content,
        order: chap.order,
        isPremium: chap.isPremium,
        priceCoins: chap.priceCoins || 20,
        publishedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // 3. Snapshots de Lore e Personagens (acesso gratuito para worldbuilding)
    if (lore && Array.isArray(lore)) {
      for (const entry of lore) {
        const loreRef = adminDb.collection('published_works').doc(projectId).collection('lore').doc(entry.id);
        batch.set(loreRef, {
          id: entry.id,
          category: entry.category,
          title: entry.title,
          content: entry.content
        });
      }
    }

    if (characters && Array.isArray(characters)) {
      for (const char of characters) {
        const charRef = adminDb.collection('published_works').doc(projectId).collection('characters').doc(char.id);
        batch.set(charRef, {
          id: char.id,
          name: char.name,
          role: char.role,
          description: char.description
        });
      }
    }

    // 3. Inicializa ou atualiza documento de estatísticas
    const statsRef = adminDb.collection('work_stats').doc(projectId);
    batch.set(statsRef, {
      workId: projectId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();
    res.json({ success: true, message: 'Snapshot de realidade implantado com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;