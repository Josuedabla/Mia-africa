import React from 'react';
import { motion } from 'framer-motion';

export const CGU: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-12">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h1 className="text-4xl font-bold text-gray-900 mb-8">Conditions Générales d'Utilisation</h1>
      <div className="prose prose-lg text-gray-700 space-y-6">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Création de compte</h2>
          <p>En créant un compte MIA, vous acceptez :</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Fournir des informations exactes et à jour</li>
            <li>Protéger votre mot de passe</li>
            <li>Accepter ces conditions</li>
          </ul>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Comportements interdits</h2>
          <p>Sont interdits :</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>La fraude et les faux comptes</li>
            <li>Le harcèlement et l'abus</li>
            <li>Le spam et la publicité non autorisée</li>
            <li>La violation des droits d'auteur</li>
            <li>Les activités illégales</li>
          </ul>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Suspension de compte</h2>
          <p>MIA peut suspendre votre compte en cas de violation de ces conditions.</p>
        </section>
      </div>
    </motion.div>
  </div>
);

export default CGU;
