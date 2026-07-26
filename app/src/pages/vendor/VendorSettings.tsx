import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { updateShop } from '@/services/db.service';
import { setShopWhatsAppOrdersEnabled, setShopWhatsAppNumber } from '@/services/whatsapp.service';
import type { MyShop } from '@/hooks/useMyShop';
import { Save, Loader2, MessageCircle } from 'lucide-react';

interface OutletCtx {
  shop: MyShop;
}

export default function VendorSettings() {
  const { shop } = useOutletContext<OutletCtx>();
  const [name, setName] = useState(shop.name);
  const [whatsappNumber, setWhatsappNumber] = useState(shop.whatsapp_number ?? '');
  const [whatsappEnabled, setWhatsappEnabled] = useState(shop.whatsapp_orders_enabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateShop(shop.id, { name });
      // "Le vendeur reçoit les commandes au niveau des commandes et sur
      // WhatsApp, sauf s'il désactive." + "Possibilité de modifier le
      // numéro de réception. Avant de publier, l'utilisateur met le numéro
      // WhatsApp sur lequel recevoir les commandes."
      await setShopWhatsAppNumber(shop.id, whatsappNumber);
      await setShopWhatsAppOrdersEnabled(shop.id, whatsappEnabled);
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Pays (détecté automatiquement)</label>
          <input disabled value={shop.country_code} className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-gray-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
          <input disabled value={shop.category} className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-gray-500" />
        </div>

        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle size={18} className="text-green-600" />
            <h3 className="font-semibold text-gray-900">Commandes via WhatsApp</h3>
          </div>

          <label className="flex items-center justify-between mb-3 cursor-pointer">
            <span className="text-sm text-gray-700">Recevoir les commandes sur WhatsApp</span>
            <input
              type="checkbox"
              checked={whatsappEnabled}
              onChange={(e) => setWhatsappEnabled(e.target.checked)}
              className="w-5 h-5 accent-mia-green-600"
            />
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Si désactivé, le bouton "Commander sur WhatsApp" n'apparaîtra plus sur vos produits. Vos clients passeront
            uniquement par le suivi de commande interne à MIA.
          </p>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-1 block">Numéro WhatsApp de réception</span>
            <input
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              disabled={!whatsappEnabled}
              placeholder="+228 90 00 00 00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-mia-green-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </label>
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
