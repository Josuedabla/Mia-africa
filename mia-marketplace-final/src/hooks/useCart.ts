/**
 * useCart Hook
 * Manages shopping cart state and operations
 */

import { useState, useCallback, useEffect } from 'react';
import { trackEvent } from '../services/db.service';
import { checkoutCart, type CheckoutResult } from '../services/checkout.service';

export interface CartItem {
  productId: string;
  shopId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface Cart {
  items: CartItem[];
  totalAmount: number;
  totalItems: number;
}

interface UseCartReturn extends Cart {
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartItemCount: () => number;
  /**
   * Lance le passage en caisse pour tout le panier, même s'il contient
   * des produits de plusieurs boutiques différentes. Le serveur (RPC
   * checkout_cart) scinde automatiquement en une commande par boutique -
   * "chaque vendeur reçoit seulement ce qui est commandé chez lui". Vide
   * le panier local seulement si l'appel réussit.
   */
  checkout: (params?: {
    deliveryAddress?: string;
    deliveryLat?: number;
    deliveryLng?: number;
    productPaymentTiming?: 'before' | 'after';
    deliveryPaymentTiming?: 'before' | 'after' | 'included';
  }) => Promise<CheckoutResult>;
}

const CART_STORAGE_KEY = 'mia_cart';

export function useCart(): UseCartReturn {
  const [cart, setCart] = useState<Cart>(() => {
    // Load cart from localStorage on mount
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : { items: [], totalAmount: 0, totalItems: 0 };
    } catch {
      return { items: [], totalAmount: 0, totalItems: 0 };
    }
  });

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const calculateTotals = useCallback((items: CartItem[]) => {
    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    return { totalAmount, totalItems };
  }, []);

  const addToCart = useCallback((item: CartItem) => {
    setCart((prevCart) => {
      const existingItem = prevCart.items.find((i) => i.productId === item.productId);

      let newItems: CartItem[];
      if (existingItem) {
        newItems = prevCart.items.map((i) =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      } else {
        newItems = [...prevCart.items, item];
      }

      const { totalAmount, totalItems } = calculateTotals(newItems);
      return { items: newItems, totalAmount, totalItems };
    });

    // Track interaction
    trackEvent('cart_add', 'product', item.productId).catch(console.error);
  }, [calculateTotals]);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prevCart) => {
      const newItems = prevCart.items.filter((i) => i.productId !== productId);
      const { totalAmount, totalItems } = calculateTotals(newItems);
      return { items: newItems, totalAmount, totalItems };
    });
  }, [calculateTotals]);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prevCart) => {
      const newItems = prevCart.items.map((i) =>
        i.productId === productId ? { ...i, quantity } : i
      );
      const { totalAmount, totalItems } = calculateTotals(newItems);
      return { items: newItems, totalAmount, totalItems };
    });
  }, [calculateTotals, removeFromCart]);

  const clearCart = useCallback(() => {
    setCart({ items: [], totalAmount: 0, totalItems: 0 });
  }, []);

  const checkout = useCallback<UseCartReturn['checkout']>(
    async (params) => {
      if (cart.items.length === 0) throw new Error('Le panier est vide.');

      const result = await checkoutCart({
        items: cart.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
        deliveryAddress: params?.deliveryAddress,
        deliveryLat: params?.deliveryLat,
        deliveryLng: params?.deliveryLng,
        productPaymentTiming: params?.productPaymentTiming,
        deliveryPaymentTiming: params?.deliveryPaymentTiming,
      });

      // Un événement par boutique commandée, pour que l'algorithme de
      // recommandation/analytics distingue bien des achats multi-vendeurs.
      await Promise.all(
        result.orders.map((o) => trackEvent('checkout', 'order', o.order_id, { shopId: o.shop_id }).catch(() => undefined))
      );

      clearCart();
      return result;
    },
    [cart.items, clearCart]
  );

  const getCartTotal = useCallback(() => {
    return cart.totalAmount;
  }, [cart.totalAmount]);

  const getCartItemCount = useCallback(() => {
    return cart.totalItems;
  }, [cart.totalItems]);

  return {
    ...cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartItemCount,
    checkout,
  };
}
