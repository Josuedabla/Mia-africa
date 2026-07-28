/**
 * useFavorite - état "favori" d'un seul produit, pour le bouton coeur de
 * ProductPage. Pas de state global partagé (chaque page produit vérifie
 * son propre statut au montage) - plus simple et suffisant, une future
 * page "Mes favoris" listera plutôt tout via getMyFavoriteProducts().
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { isProductFavorited, toggleFavorite } from '../services/db.service';

interface UseFavoriteReturn {
  isFavorited: boolean;
  loading: boolean;
  toggling: boolean;
  toggle: () => Promise<void>;
}

export function useFavorite(productId: string | undefined): UseFavoriteReturn {
  const { user, isAuthenticated } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!productId || !isAuthenticated || !user) {
      setIsFavorited(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    isProductFavorited(productId, user.id)
      .then((result) => {
        if (!cancelled) setIsFavorited(result);
      })
      .catch(() => {
        if (!cancelled) setIsFavorited(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId, isAuthenticated, user?.id]);

  const toggle = useCallback(async () => {
    if (!productId || toggling) return;
    if (!isAuthenticated) {
      throw new Error('UNAUTHENTICATED');
    }

    setToggling(true);
    const previous = isFavorited;
    setIsFavorited(!previous); // optimiste - remis en place si l'appel échoue
    try {
      const result = await toggleFavorite(productId);
      setIsFavorited(result);
    } catch (error) {
      setIsFavorited(previous);
      throw error;
    } finally {
      setToggling(false);
    }
  }, [productId, isFavorited, toggling, isAuthenticated]);

  return { isFavorited, loading, toggling, toggle };
}
