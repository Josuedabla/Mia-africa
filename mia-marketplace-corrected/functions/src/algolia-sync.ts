/**
 * Firestore -> Algolia sync.
 *
 * The frontend algolia.service.ts used to be built with an
 * ALGOLIA_ADMIN_KEY / ALGOLIA_WRITE_KEY reachable from client code, which
 * would let anyone who extracted that key overwrite or delete the entire
 * product catalog. Indexing is now done server-side, triggered directly by
 * Firestore writes, so the write/admin key never has to leave the backend.
 * The client only ever needs the public, read-only ALGOLIA_SEARCH_KEY.
 */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import algoliasearch from 'algoliasearch';

// Same key value as VITE_ALGOLIA_WRITE_KEY previously in the client .env.
// Set it with: firebase functions:secrets:set ALGOLIA_WRITE_KEY
export const ALGOLIA_WRITE_KEY = defineSecret('ALGOLIA_WRITE_KEY');

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID ?? 'LUVI2Y21SH';
const ALGOLIA_INDEX_NAME = process.env.ALGOLIA_INDEX_NAME ?? 'mia_products';

export const syncProductToAlgolia = onDocumentWritten(
  { document: 'products/{productId}', secrets: [ALGOLIA_WRITE_KEY] },
  async (event) => {
    const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_WRITE_KEY.value());
    const index = client.initIndex(ALGOLIA_INDEX_NAME);
    const productId = event.params.productId;

    const after = event.data?.after;
    if (!after || !after.exists) {
      // Document deleted -> remove from the search index too.
      await index.deleteObject(productId);
      return;
    }

    const data = after.data() ?? {};
    await index.saveObject({
      objectID: productId,
      id: productId,
      shopId: data.shopId,
      name: data.name,
      description: data.description,
      category: data.category,
      subcategory: data.subcategory ?? null,
      price: data.price,
      oldPrice: data.oldPrice ?? null,
      currency: data.currency,
      images: data.images ?? [],
      stock: data.stock ?? 0,
      status: data.status,
      country: data.country,
      tags: data.tags ?? [],
      shopName: data.shopName,
      rating: data.rating ?? 0,
      reviewCount: data.reviewCount ?? 0,
      isTrending: data.isTrending ?? false,
      isNew: data.isNew ?? false,
      stats: data.stats ?? { views: 0, likes: 0, sales: 0 },
    });
  }
);
