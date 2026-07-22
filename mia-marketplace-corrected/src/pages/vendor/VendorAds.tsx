import React from 'react';
import { Megaphone } from 'lucide-react';

export default function VendorAds() {
  return (
    <div className="text-center py-20">
      <Megaphone className="mx-auto text-mia-green-400 mb-4" size={40} />
      <h1 className="text-xl font-bold text-gray-900 mb-2">MIA Ads arrive bientôt</h1>
      <p className="text-gray-500 max-w-md mx-auto">
        Boostez la visibilité de vos produits auprès de milliers d'acheteurs. Cette fonctionnalité
        est en cours de développement.
      </p>
    </div>
  );
}
