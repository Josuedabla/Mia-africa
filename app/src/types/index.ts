/**
 * Shared domain types, aligned with the Postgres schema
 * (supabase/migrations/). Field names are snake_case to match what
 * Supabase's query builder actually returns - no camelCase mapping
 * layer, to avoid a whole class of "works in TS, breaks at runtime"
 * bugs from an unmapped field.
 */

export interface ProductMedia {
  id: string;
  product_id: string;
  media_type: 'image' | 'video';
  url: string;
  position: number;
  width?: number;
  height?: number;
}

export interface Product {
  id: string;
  shop_id: string;
  shop_name?: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  price: number;
  original_price?: number;
  currency?: string;
  images?: string[];       // convenience field, populated client-side from product_media
  product_media?: ProductMedia[];
  stock?: number;
  status?: 'draft' | 'active' | 'archived';
  country_code?: string;
  tags?: string[];
  keywords?: string[];
  seo_title?: string;
  seo_description?: string;
  rating?: number;
  review_count?: number;
  views?: number;
  likes_count?: number;
  sales_count?: number;
  is_trending?: boolean;
  is_new?: boolean;
  is_boosted?: boolean;
  ai_generated?: boolean;
  quality_score?: number;
  created_at?: string;
  external_video_url?: string;  // lien YouTube/TikTok optionnel (Partie 4 du plan)
}

export interface Shop {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  country_code: string;
  location?: unknown; // PostGIS geography, only relevant server-side / in nearby_shops()
  logo_url?: string;
  banner_url?: string;
  phone?: string;
  whatsapp_number?: string;
  status?: 'active' | 'suspended';
  rating?: number;
  review_count?: number;
  product_count?: number;
  total_sales?: number;
  seller_score?: number;
  created_at?: string;
}

/** Agrégats de confiance publics d'une boutique (RPC get_shop_trust_stats). */
export interface ShopTrustStats {
  total_likes: number;
  total_orders: number;
  total_followers: number;
  total_reviews: number;
  avg_rating: number;
  member_since?: string;
  verified: boolean;
}

export interface Review {
  id: string;
  product_id: string;
  order_id: string;
  customer_id: string;
  author_name?: string;
  rating: number;
  comment?: string;
  created_at?: string;
}

export interface Order {
  id: string;
  customer_id: string;
  shop_id: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  payment_method?: 'wallet' | 'moneroo' | 'chariow' | 'cash_on_delivery';
  total: number;
  commission_amount?: number;
  vendor_share?: number;
  currency?: string;
  created_at?: string;
}
