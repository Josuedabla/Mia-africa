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
    if (error) {
      // supabase-js's functions.invoke() throws a generic
      // FunctionsHttpError("Edge Function returned a non-2xx status
      // code") on any non-2xx response - it does NOT surface the JSON
      // body the function actually returned (e.g. { error: "Daily
      // Gemini quota (50) reached." }). The real message is only
      // available on error.context, which is the raw fetch Response.
      // Without this, every failure (quota, missing fields, Gemini
      // API down, etc.) looked identical to the user.
      const context = (error as { context?: Response }).context;
      if (context && typeof context.json === 'function') {
        try {
          const body = await context.clone().json();
          if (body?.error) throw new Error(String(body.error));
        } catch {
          // context wasn't JSON (or already consumed) - fall through to the generic error below.
        }
      }
      throw error;
    }
    if (!data) throw new Error('Réponse vide de MIA AI.');
    return data;
  }
}

export const geminiService = new GeminiService();
export default GeminiService;
