import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { WorkStats } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export function useAnalytics(workId: string | null) {
  const [stats, setStats] = useState<WorkStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!workId) {
      setStats(null);
      setIsLoading(false);
      return;
    }

    const statsRef = doc(db, 'work_stats', workId);
    const unsub = onSnapshot(statsRef, (snap) => {
      if (snap.exists()) {
        setStats({ workId: snap.id, ...snap.data() } as WorkStats);
      }
      setIsLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, `work_stats/${workId}`));

    return () => unsub();
  }, [workId]);

  return { stats, isLoading };
}