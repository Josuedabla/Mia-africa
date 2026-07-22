/**
 * Firestore Service
 * Handles all Firestore database operations
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryConstraint,
  addDoc,
  writeBatch,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

class FirestoreService {
  /**
   * Create a new document
   */
  async createDocument(collectionName: string, data: any, docId?: string) {
    try {
      if (docId) {
        await setDoc(doc(db, collectionName, docId), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return docId;
      } else {
        const docRef = await addDoc(collection(db, collectionName), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return docRef.id;
      }
    } catch (error) {
      console.error(`Error creating document in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get a single document
   */
  async getDocument(collectionName: string, docId: string) {
    try {
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error(`Error getting document from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get multiple documents
   */
  async getDocuments(collectionName: string, constraints: QueryConstraint[] = []) {
    try {
      const q = query(collection(db, collectionName), ...constraints);
      const querySnapshot = await getDocs(q);

      const documents: any[] = [];
      querySnapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() });
      });

      return documents;
    } catch (error) {
      console.error(`Error getting documents from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get documents by field
   */
  async getDocumentsByField(collectionName: string, fieldName: string, value: any) {
    try {
      return await this.getDocuments(collectionName, [where(fieldName, '==', value)]);
    } catch (error) {
      console.error(`Error getting documents by field:`, error);
      throw error;
    }
  }

  /**
   * Update a document
   */
  async updateDocument(collectionName: string, docId: string, data: any) {
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(`Error updating document in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(collectionName: string, docId: string) {
    try {
      await deleteDoc(doc(db, collectionName, docId));
    } catch (error) {
      console.error(`Error deleting document from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Batch write operations
   */
  async batchWrite(operations: Array<{ type: 'set' | 'update' | 'delete'; collection: string; docId: string; data?: any }>) {
    try {
      const batch = writeBatch(db);

      for (const op of operations) {
        const docRef = doc(db, op.collection, op.docId);

        if (op.type === 'set') {
          batch.set(docRef, {
            ...op.data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (op.type === 'update') {
          batch.update(docRef, {
            ...op.data,
            updatedAt: serverTimestamp(),
          });
        } else if (op.type === 'delete') {
          batch.delete(docRef);
        }
      }

      await batch.commit();
    } catch (error) {
      console.error('Error in batch write:', error);
      throw error;
    }
  }

  /**
   * Increment a field
   */
  async incrementField(collectionName: string, docId: string, fieldName: string, value: number = 1) {
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, {
        [fieldName]: increment(value),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(`Error incrementing field:`, error);
      throw error;
    }
  }

  /**
   * Search documents with multiple constraints
   */
  async searchDocuments(
    collectionName: string,
    constraints: QueryConstraint[],
    orderByField?: string,
    orderDirection?: 'asc' | 'desc',
    limitCount?: number
  ) {
    try {
      const queryConstraints = [...constraints];

      if (orderByField) {
        queryConstraints.push(orderBy(orderByField, orderDirection === 'desc' ? 'desc' : 'asc'));
      }

      if (limitCount) {
        queryConstraints.push(limit(limitCount));
      }

      return await this.getDocuments(collectionName, queryConstraints);
    } catch (error) {
      console.error(`Error searching documents:`, error);
      throw error;
    }
  }

  /**
   * Get trending products
   */
  async getTrendingProducts(country: string, limitCount: number = 12) {
    try {
      return await this.searchDocuments(
        'products',
        [
          where('country', '==', country),
          where('status', '==', 'active'),
          where('isTrending', '==', true),
        ],
        'stats.views',
        'desc',
        limitCount
      );
    } catch (error) {
      console.error('Error getting trending products:', error);
      throw error;
    }
  }

  /**
   * Get new products
   */
  async getNewProducts(country: string, limitCount: number = 12) {
    try {
      return await this.searchDocuments(
        'products',
        [
          where('country', '==', country),
          where('status', '==', 'active'),
          where('isNew', '==', true),
        ],
        'createdAt',
        'desc',
        limitCount
      );
    } catch (error) {
      console.error('Error getting new products:', error);
      throw error;
    }
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(category: string, country: string, limitCount: number = 12) {
    try {
      return await this.searchDocuments(
        'products',
        [
          where('category', '==', category),
          where('country', '==', country),
          where('status', '==', 'active'),
        ],
        'stats.views',
        'desc',
        limitCount
      );
    } catch (error) {
      console.error('Error getting products by category:', error);
      throw error;
    }
  }

  /**
   * Get popular shops
   */
  async getPopularShops(country: string, limitCount: number = 6) {
    try {
      return await this.searchDocuments(
        'shops',
        [
          where('country', '==', country),
          where('status', '==', 'active'),
        ],
        'reputation.score',
        'desc',
        limitCount
      );
    } catch (error) {
      console.error('Error getting popular shops:', error);
      throw error;
    }
  }

  /**
   * Get shop by slug
   */
  async getShopBySlug(slug: string) {
    try {
      const shops = await this.getDocumentsByField('shops', 'slug', slug);
      return shops.length > 0 ? shops[0] : null;
    } catch (error) {
      console.error('Error getting shop by slug:', error);
      throw error;
    }
  }

  /**
   * Get products by shop
   */
  async getProductsByShop(shopId: string, limitCount: number = 50) {
    try {
      return await this.searchDocuments(
        'products',
        [
          where('shopId', '==', shopId),
          where('status', '==', 'active'),
        ],
        'createdAt',
        'desc',
        limitCount
      );
    } catch (error) {
      console.error('Error getting products by shop:', error);
      throw error;
    }
  }

  /**
   * Get user orders
   */
  async getUserOrders(userId: string) {
    try {
      return await this.searchDocuments(
        'orders',
        [where('customerId', '==', userId)],
        'createdAt',
        'desc'
      );
    } catch (error) {
      console.error('Error getting user orders:', error);
      throw error;
    }
  }

  /**
   * Get vendor orders
   */
  async getVendorOrders(vendorId: string) {
    try {
      return await this.searchDocuments(
        'orders',
        [where('vendorId', '==', vendorId)],
        'createdAt',
        'desc'
      );
    } catch (error) {
      console.error('Error getting vendor orders:', error);
      throw error;
    }
  }

  /**
   * Get vendor products
   */
  async getVendorProducts(vendorId: string) {
    try {
      const shops = await this.getDocumentsByField('shops', 'vendorId', vendorId);
      if (shops.length === 0) return [];

      const shopId = shops[0].id;
      return await this.getProductsByShop(shopId);
    } catch (error) {
      console.error('Error getting vendor products:', error);
      throw error;
    }
  }

  /**
   * Track interaction
   */
  async trackInteraction(userId: string, type: string, entityType: string, entityId: string, metadata?: any) {
    try {
      await this.createDocument('interactions', {
        userId,
        type,
        entityType,
        entityId,
        metadata,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error tracking interaction:', error);
      throw error;
    }
  }

  /**
   * Get user interactions
   */
  async getUserInteractions(userId: string, type?: string) {
    try {
      const constraints = [where('userId', '==', userId)];
      if (type) {
        constraints.push(where('type', '==', type));
      }

      return await this.searchDocuments('interactions', constraints, 'timestamp', 'desc', 100);
    } catch (error) {
      console.error('Error getting user interactions:', error);
      throw error;
    }
  }
}

export default new FirestoreService();
