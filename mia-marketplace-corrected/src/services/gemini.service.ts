/**
 * Gemini AI Service (client-side)
 *
 * This no longer calls generativelanguage.googleapis.com directly with a
 * secret API key (that key would otherwise ship inside the public JS
 * bundle - see functions/src/gemini.ts for why). All calls are now proxied
 * through Firebase Cloud Functions callables, which keep the key server
 * side and enforce a daily per-user quota.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

interface GenerateDescriptionRequest {
  productName: string;
  category: string;
  price: number;
  features?: string[];
  targetAudience?: string;
}

export type ProductTone =
  | 'professionnel'
  | 'premium'
  | 'persuasif'
  | 'simple'
  | 'luxe'
  | 'tiktok-viral';

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

interface GeneratePriceAdviceRequest {
  productName: string;
  category: string;
  currentPrice: number;
  competitorPrices?: number[];
  demandLevel?: 'low' | 'medium' | 'high';
}

interface PriceAdviceResponse {
  suggestedPrice: number;
  reasoning: string;
  priceRange: { min: number; max: number };
}

class GeminiService {
  /**
   * Generate product description using AI
   */
  async generateProductDescription(request: GenerateDescriptionRequest): Promise<string> {
    const call = httpsCallable<GenerateDescriptionRequest, { description: string }>(
      functions,
      'generateProductDescription'
    );
    const { data } = await call(request);
    return data.description;
  }

  /**
   * Generate price advice using AI
   */
  async generatePriceAdvice(request: GeneratePriceAdviceRequest): Promise<PriceAdviceResponse> {
    const call = httpsCallable<GeneratePriceAdviceRequest, PriceAdviceResponse>(
      functions,
      'generatePriceAdvice'
    );
    const { data } = await call(request);
    return data;
  }

  /**
   * Generate customer support response
   */
  async generateSupportResponse(question: string, productContext?: string): Promise<string> {
    const call = httpsCallable<{ question: string; productContext?: string }, { message: string }>(
      functions,
      'generateSupportResponse'
    );
    const { data } = await call({ question, productContext });
    return data.message;
  }
  /**
   * MIA AI Description Generator - generates a full product listing
   * (HTML description + SEO title/description + keywords) from the
   * vendor's raw notes, tone choice, keywords and special instructions.
   */
  async generateProductListing(request: GenerateListingRequest): Promise<GenerateListingResponse> {
    const call = httpsCallable<GenerateListingRequest, GenerateListingResponse>(
      functions,
      'generateProductListing'
    );
    const { data } = await call(request);
    return data;
  }
}

export const geminiService = new GeminiService();
export default GeminiService;
