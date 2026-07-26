import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Store, TrendingUp, Users } from 'lucide-react';

const STEP_KEYS = ['create_shop', 'add_products', 'manage_orders', 'get_paid'] as const;
const STEP_ICONS = [
  <Store size={32} key="store" />,
  <TrendingUp size={32} key="trending" />,
  <Users size={32} key="users" />,
  <CheckCircle size={32} key="check" />,
];

export const DevenirVendeur: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('devenir_vendeur.title')}</h1>
      <p className="text-xl text-gray-600 mb-12">{t('devenir_vendeur.subtitle')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {STEP_KEYS.map((key, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-lg shadow-md p-6 text-center"
          >
            <div className="text-mia-green-600 mb-4 flex justify-center">{STEP_ICONS[i]}</div>
            <h3 className="font-bold text-gray-900 mb-2">{t(`devenir_vendeur.step_${key}_title`)}</h3>
            <p className="text-gray-700 text-sm">{t(`devenir_vendeur.step_${key}_desc`)}</p>
          </motion.div>
        ))}
      </div>

      <motion.button
        whileHover={{ scale: 1.05 }}
        onClick={() => navigate('/vendeur/bienvenue')}
        className="w-full bg-mia-green-600 hover:bg-mia-green-700 text-white font-bold py-3 rounded-lg text-lg"
      >
        {t('devenir_vendeur.cta_button')}
      </motion.button>
    </div>
  );
};

export default DevenirVendeur;
