import React, { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { VendorShop } from '@/hooks/useVendorShop';
import { Plus, Pencil, ImageOff } from 'lucide-react';

interface OutletCtx {
  shop: VendorShop;
}

interface VendorProduct {
  id: string;
  name: string;
  price: number;
  currency?: string;
  images?: string[];
  status: string;
  stock: number;
  qualityScore?: { overall: number };
}

function ScoreBadge({ score }: { score?: number }) {
  if (score == null) return null;
  const color =
    score >= 80 ? 'bg-mia-green-100 text-mia-green-700' :
    score >= 50 ? 'bg-amber-100 text-amber-700' :
    'bg-red-100 text-red-700';
  return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${color}`}>{score}/100</span>;
}

export default function VendorProducts() {
  const { shop } = useOutletContext<OutletCtx>();
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const q = query(collection(db, 'products'), where('shopId', '==', shop.id), orderBy('createdAt', 'desc'));
    getDocs(q)
      .then((snap) => {
        if (cancelled) return;
        setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [shop.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
        <Link
          to="/vendeur/produits/nouveau"
          className="inline-flex items-center gap-2 bg-mia-green-600 hover:bg-mia-green-700 text-white font-semibold px-4 py-2.5 rounded-lg"
        >
          <Plus size={18} /> Nouveau produit
        </Link>
      </div>

      {loading && <p className="text-gray-400 text-sm">Chargement...</p>}

      {!loading && products.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500 mb-4">Vous n'avez encore ajouté aucun produit.</p>
          <Link to="/vendeur/produits/nouveau" className="text-mia-green-700 font-semibold">
            Ajouter votre premier produit →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div key={product.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="aspect-square bg-gray-100 flex items-center justify-center">
              {product.images?.[0] ? (
                <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <ImageOff className="text-gray-300" size={32} />
              )}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-semibold text-gray-900 line-clamp-1">{product.name}</p>
                <ScoreBadge score={product.qualityScore?.overall} />
              </div>
              <p className="text-mia-green-700 font-bold mb-1">
                {product.price?.toLocaleString()} {product.currency ?? 'FCFA'}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Stock : {product.stock ?? 0}</span>
                <span className="capitalize">{product.status}</span>
              </div>
              <Link
                to={`/vendeur/produits/${product.id}`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-mia-green-700"
              >
                <Pencil size={14} /> Modifier
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
