import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, MessageSquare, Mail, Phone } from 'lucide-react';

export const SupportCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'faq' | 'contact'>('faq');

  const faqs = [
    { q: 'Comment créer une boutique ?', a: 'Allez dans Devenir Vendeur et suivez les étapes.' },
    { q: 'Quels sont les frais ?', a: 'MIA prélève 5% sur chaque vente. Les frais de livraison varient.' },
    { q: 'Comment suivre ma commande ?', a: 'Vous recevrez un lien de suivi par email et SMS.' },
    { q: 'Comment devenir livreur ?', a: 'Allez dans Devenir Livreur et validez votre profil.' },
    { q: 'Que faire en cas de problème ?', a: 'Contactez notre support via ce formulaire.' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">Centre d'Aide MIA</h1>
      
      <div className="flex gap-4 mb-8">
        <motion.button
          whileHover={{ scale: 1.05 }}
          onClick={() => setActiveTab('faq')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-all ${
            activeTab === 'faq'
              ? 'bg-mia-green-600 text-white'
              : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          <HelpCircle size={20} />
          FAQ
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          onClick={() => setActiveTab('contact')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-all ${
            activeTab === 'contact'
              ? 'bg-mia-green-600 text-white'
              : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          <MessageSquare size={20} />
          Contact
        </motion.button>
      </div>

      {activeTab === 'faq' && (
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-lg shadow-md p-6"
            >
              <h3 className="font-bold text-gray-900 mb-2">{faq.q}</h3>
              <p className="text-gray-700">{faq.a}</p>
            </motion.div>
          ))}
        </div>
      )}

      {activeTab === 'contact' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <Mail className="text-mia-green-600 flex-shrink-0 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-gray-900">Email</h3>
                <p className="text-gray-700">miaafricaservice@gmail.com</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Phone className="text-mia-green-600 flex-shrink-0 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-gray-900">Téléphone</h3>
                <p className="text-gray-700">+228 92 00 20 09</p>
              </div>
            </div>
            <form className="space-y-4 mt-6">
              <input type="text" placeholder="Votre nom" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              <input type="email" placeholder="Votre email" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              <textarea placeholder="Votre message" rows={5} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              <motion.button
                whileHover={{ scale: 1.02 }}
                type="submit"
                className="w-full bg-mia-green-600 hover:bg-mia-green-700 text-white font-bold py-2 rounded-lg"
              >
                Envoyer
              </motion.button>
            </form>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default SupportCenter;
