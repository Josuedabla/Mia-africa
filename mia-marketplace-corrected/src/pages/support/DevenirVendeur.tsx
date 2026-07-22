import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Store, TrendingUp, Users } from 'lucide-react';

export const DevenirVendeur: React.FC = () => {
  const navigate = useNavigate();
  const steps = [
    { icon: <Store size={32} />, title: 'Créer une boutique', desc: 'Remplissez vos informations et validez votre boutique' },
    { icon: <TrendingUp size={32} />, title: 'Ajouter des produits', desc: 'Téléchargez vos produits avec images et descriptions' },
    { icon: <Users size={32} />, title: 'Gérer les commandes', desc: 'Recevez les commandes et gérez les livraisons' },
    { icon: <CheckCircle size={32} />, title: 'Recevoir les paiements', desc: 'Gagnez de l\'argent à chaque vente' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Devenir Vendeur sur MIA</h1>
      <p className="text-xl text-gray-600 mb-12">Rejoignez des milliers de vendeurs qui gagnent de l'argent sur MIA</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-lg shadow-md p-6 text-center"
          >
            <div className="text-mia-green-600 mb-4 flex justify-center">{step.icon}</div>
            <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
            <p className="text-gray-700 text-sm">{step.desc}</p>
          </motion.div>
        ))}
      </div>

      <motion.button
        whileHover={{ scale: 1.05 }}
        onClick={() => navigate('/vendeur/bienvenue')}
        className="w-full bg-mia-green-600 hover:bg-mia-green-700 text-white font-bold py-3 rounded-lg text-lg"
      >
        Créer ma boutique maintenant
      </motion.button>
    </div>
  );
};

export default DevenirVendeur;
