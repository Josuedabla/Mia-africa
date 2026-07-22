import React from 'react';
import { motion } from 'framer-motion';

export const CGV: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-12">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h1 className="text-4xl font-bold text-gray-900 mb-8">Conditions Générales de Vente</h1>
      <div className="prose prose-lg text-gray-700 space-y-6">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Commande</h2>
          <p>Toute commande implique l'acceptation de ces conditions. Les prix affichés incluent les taxes.</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Paiement</h2>
          <p>Les paiements sont traités via Chariow. Votre commande est confirmée après paiement réussi.</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Livraison</h2>
          <p>Les délais de livraison dépendent de votre localisation. Les frais de livraison sont affichés avant confirmation.</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Retours</h2>
          <p>Les retours sont acceptés dans les 14 jours. Contactez le vendeur pour initier un retour.</p>
        </section>
      </div>
    </motion.div>
  </div>
);

export default CGV;
