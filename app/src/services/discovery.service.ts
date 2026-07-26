/**
 * Discovery Service
 *
 * "Il est sur un produit, il voit les similaires et du moins cher vers le
 * plus cher, plus bonne qualité et plus commandé vers moins qualité, plus
 * récent vers vieux." -> wrapper typé autour de la RPC similar_products
 * (migration 20260719000012_discovery_and_notifications.sql). L'UI produit
 * doit permettre à l'utilisateur de changer p_sort_by (chips "Prix
 * croissant", "Meilleure qualité", "Plus récent", "Recommandé") sans
 * recharger la page produit entière.
 */
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';

export type SimilarProductsSort = 'smart' | 'price_asc' | 'price_desc' | 'quality' | 'newest';

export async function getSimilarProducts(
  productId: string,
  sortBy: SimilarProductsSort = 'smart',
  limit = 20,
  offset = 0
): Promise<Product[]> {
  const { data, error } = await supabase.rpc('similar_products', {
    p_product_id: productId,
    p_sort_by: sortBy,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return (data ?? []) as Product[];
}

export default { getSimilarProducts };
