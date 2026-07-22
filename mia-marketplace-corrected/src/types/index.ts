/**
 * Shared domain types. This file did not exist at all before this fix,
 * even though ProductPage.tsx and ShopPage.tsx both imported from
 * '../types' - another build-breaking import discovered while wiring the
 * gift/boost panel into ProductPage. Field names below match how each
 * property is actually used across ProductPage.tsx, ShopPage.tsx,
 * algolia.service.ts and the vendor product form.
 */

export interface Product {
  id: string;
  shopId: string;
  shopName?: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  images?: string[];
  image?: string; // legacy single-image fallback, some older records may only have this
  stock?: number;
  status?: 'draft' | 'active' | 'archived';
  country?: string;
  tags?: string[];
  keywords?: string[];
  seoTitle?: string;
  seoDescription?: string;
  rating?: number;
  reviewCount?: number;
  isTrending?: boolean;
  isNew?: boolean;
  isBoosted?: boolean;
  aiGenerated?: boolean;
  qualityScore?: { overall: number };
  stats?: { views: number; likes: number; sales: number };
}

export interface Shop {
  id: string;
  vendorId: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  country: string;
  location?: string;
  phone?: string;
  whatsappNumber?: string;
  logoUrl?: string;
  bannerUrl?: string;
  status?: 'active' | 'suspended';
  rating?: number;
  reviewCount?: number;
  productCount?: number;
  totalSales?: number;
  sellerScore?: number;
}

export interface Review {
  id: string;
  productId: string;
  customerId: string;
  orderId?: string;
  authorName?: string;
  rating: number;
  comment?: string;
}
