/**
 * Gemini AI Service (client-side) - calls the gemini-listing Supabase
 * Edge Function. The secret Gemini key never leaves the server, and a
 * daily quota per user is enforced server-side.
 */
import { supabase } from '@/lib/supabase';

export type ProductTone = 'professionnel' | 'premium' | 'persuasif' | 'simple' | 'luxe' | 'tiktok-viral';

export interface GenerateListingRequest {
  productName: string;
  category: string;
  price: number;
  features?: string[];
  tone?: ProductTone;
  seoKeywords?: string[];
  specialInstructions?: string;
  country?: string;
}

export interface GenerateListingResponse {
  descriptionHtml: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
}

class GeminiService {
  async generateProductListing(request: GenerateListingRequest): Promise<GenerateListingResponse> {
    const { data, error } = await supabase.functions.invoke<GenerateListingResponse>('gemini-listing', {
      body: request,
    });
    if (error) throw error;
    if (!data) throw new Error('Réponse vide de MIA AI.');
    return data;
  }
}

export const geminiService = new GeminiService();
export default GeminiService;
