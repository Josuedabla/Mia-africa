/**
 * Algolia Search Service (client-side, READ-ONLY)
 *
 * This used to also expose indexProduct/deleteProduct/updateSettings/
 * clearIndex methods, which only work with an Algolia write/admin key.
 * Because AlgoliaService was constructed with a single "searchApiKey"
 * config value, wiring those write methods up on the client would have
 * required shipping the write/admin key (VITE_ALGOLIA_WRITE_KEY /
 * VITE_ALGOLIA_ADMIN_KEY) to the browser - letting anyone who extracted it
 * overwrite or wipe the whole product catalog.
 *
 * Indexing now happens server-side instead, in the syncProductToAlgolia
 * Cloud Function (functions/src/algolia-sync.ts), triggered automatically
 * whenever a `products/{productId}` Firestore document is written. This
 * client service therefore only performs read/search calls with the
 * public, search-only VITE_ALGOLIA_SEARCH_KEY, which Algolia is designed
 * to expose safely in frontend code.
 */
import algoliasearch from 'algoliasearch';

interface AlgoliaConfig {
  appId: string;
  searchApiKey: string;
  indexName: string;
}

class AlgoliaService {
  private client: ReturnType<typeof algoliasearch>;
  private index: ReturnType<ReturnType<typeof algoliasearch>['initIndex']>;

  constructor(config: AlgoliaConfig) {
    this.client = algoliasearch(config.appId, config.searchApiKey);
    this.index = this.client.initIndex(config.indexName);
  }

  /**
   * Search products
   */
  async search(query: string, options?: {
    filters?: string;
    facets?: string[];
    hitsPerPage?: number;
    page?: number;
  }) {
    try {
      const searchParams: Record<string, unknown> = {
        hitsPerPage: options?.hitsPerPage || 20,
        page: options?.page || 0,
      };
      if (options?.filters) searchParams.filters = options.filters;
      if (options?.facets) searchParams.facets = options.facets;

      return await this.index.search(query, searchParams);
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  }

  /**
   * Search with facets (country, category, price range)
   */
  async searchWithFacets(query: string, options?: {
    country?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    hitsPerPage?: number;
    page?: number;
  }) {
    try {
      const filters: string[] = [];

      if (options?.country) filters.push(`country:"${options.country}"`);
      if (options?.category) filters.push(`category:"${options.category}"`);
      if (options?.minPrice !== undefined || options?.maxPrice !== undefined) {
        const minPrice = options?.minPrice || 0;
        const maxPrice = options?.maxPrice || 999999;
        filters.push(`price:[${minPrice} TO ${maxPrice}]`);
      }

      return await this.search(query, {
        filters: filters.length > 0 ? filters.join(' AND ') : undefined,
        facets: ['category', 'country', 'price'],
        hitsPerPage: options?.hitsPerPage || 20,
        page: options?.page || 0,
      });
    } catch (error) {
      console.error('Error searching with facets:', error);
      throw error;
    }
  }

  /**
   * Get autocomplete suggestions
   */
  async getAutocomplete(query: string) {
    try {
      const results = await this.index.search(query, {
        hitsPerPage: 10,
        attributesToSnippet: ['name', 'description'],
      });
      return results.hits;
    } catch (error) {
      console.error('Error getting autocomplete:', error);
      throw error;
    }
  }
}

export const algoliaService = new AlgoliaService({
  appId: import.meta.env.VITE_ALGOLIA_APP_ID,
  searchApiKey: import.meta.env.VITE_ALGOLIA_SEARCH_KEY,
  indexName: import.meta.env.VITE_ALGOLIA_INDEX_NAME,
});
export default AlgoliaService;
