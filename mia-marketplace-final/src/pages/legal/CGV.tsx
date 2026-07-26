import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const CGV: React.FC = () => {
  const { t } = useTranslation();
  return (
  <div className="max-w-4xl mx-auto px-4 py-12">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h1 className="text-4xl font-bold text-gray-900 mb-8">{t('cgv.title')}</h1>
      <div className="prose prose-lg text-gray-700 space-y-6">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">{t('cgv.section_order_title')}</h2>
          <p>{t('cgv.section_order_text')}</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">{t('cgv.section_payment_title')}</h2>
          <p>{t('cgv.section_payment_text')}</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">{t('cgv.section_delivery_title')}</h2>
          <p>{t('cgv.section_delivery_text')}</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">{t('cgv.section_returns_title')}</h2>
          <p>{t('cgv.section_returns_text')}</p>
        </section>
      </div>
    </motion.div>
  </div>
  );
};

export default CGV;
