import React from 'react';
import { motion } from 'framer-motion';

export const Confidentialite: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-12">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h1 className="text-4xl font-bold text-gray-900 mb-8">Politique de Confidentialité</h1>
      <div className="prose prose-lg text-gray-700 space-y-6">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Données collectées</h2>
          <p>MIA collecte les données suivantes :</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Informations de profil (nom, email, téléphone, adresse)</li>
            <li>Données de transaction (commandes, paiements)</li>
            <li>Données de localisation (pour livraison)</li>
            <li>Données d'utilisation (clics, vues, interactions)</li>
            <li>Cookies et données techniques</li>
          </ul>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Utilisation des données</h2>
          <p>Vos données sont utilisées pour :</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Traiter vos commandes et paiements</li>
            <li>Améliorer nos services</li>
            <li>Vous envoyer des notifications</li>
            <li>Détecter la fraude</li>
            <li>Respecter les obligations légales</li>
          </ul>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Protection des données</h2>
          <p>MIA utilise le chiffrement SSL et les meilleures pratiques de sécurité pour protéger vos données.</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Vos droits</h2>
          <p>Vous avez le droit d'accéder, modifier ou supprimer vos données. Contactez-nous à miaafricaservice@gmail.com</p>
        </section>
      </div>
    </motion.div>
  </div>
);

export default Confidentialite;
