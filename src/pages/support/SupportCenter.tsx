import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { HelpCircle, MessageSquare, Mail, Phone } from 'lucide-react';

const FAQ_KEYS = ['create_shop', 'track_order', 'become_driver', 'problem'] as const;

export const SupportCenter: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'faq' | 'contact'>('faq');

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">{t('support_center.title')}</h1>
      
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
          {t('support_center.tab_faq')}
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
          {t('support_center.tab_contact')}
        </motion.button>
      </div>

      {activeTab === 'faq' && (
        <div className="space-y-4">
          {FAQ_KEYS.map((key, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-lg shadow-md p-6"
            >
              <h3 className="font-bold text-gray-900 mb-2">{t(`support_center.faq_${key}_q`)}</h3>
              <p className="text-gray-700">{t(`support_center.faq_${key}_a`)}</p>
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
                <h3 className="font-bold text-gray-900">{t('support_center.email_label')}</h3>
                <p className="text-gray-700">miaafricaservice@gmail.com</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Phone className="text-mia-green-600 flex-shrink-0 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-gray-900">{t('support_center.phone_label')}</h3>
                <p className="text-gray-700">+228 91 02 20 37</p>
              </div>
            </div>
            <div className="mt-6">
              <p className="text-gray-700 mb-4">
                {t('support_center.whatsapp_intro')}
              </p>
              <motion.a
                whileHover={{ scale: 1.02 }}
                href="https://wa.me/22891022037?text=Bonjour%2C%20j%27ai%20besoin%20d%27aide%20sur%20MIA%20%3A%20"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-mia-green-600 hover:bg-mia-green-700 text-white font-bold py-3 rounded-lg"
              >
                <MessageSquare size={20} />
                {t('support_center.whatsapp_button')}
              </motion.a>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default SupportCenter;
