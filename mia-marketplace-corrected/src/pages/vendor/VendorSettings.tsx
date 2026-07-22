import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import firestoreService from '@/services/firestore.service';
import type { VendorShop } from '@/hooks/useVendorShop';
import { Save, Loader2 } from 'lucide-react';

interface OutletCtx {
  shop: VendorShop;
}

export default function VendorSettings() {
  const { shop } = useOutletContext<OutletCtx>();
  const [name, setName] = useState(shop.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await firestoreService.updateDocument('shops', shop.id, { name });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900">Paramètres de la boutique</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la boutique</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-mia-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pays</label>
          <input disabled value={shop.country} className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-gray-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
          <input disabled value={shop.category} className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-gray-500" />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-60 text-white font-semibold px-4 py-2.5 rounded-lg"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Enregistrer
        </button>
        {saved && <p className="text-sm text-mia-green-700">Modifications enregistrées ✓</p>}
      </div>
    </div>
  );
}
