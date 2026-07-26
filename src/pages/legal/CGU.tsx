import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const CGU: React.FC = () => {
  const { t } = useTranslation();
  const accountItems = t('cgu.section_account_items', { returnObjects: true }) as string[];
  const forbiddenItems = t('cgu.section_forbidden_items', { returnObjects: true }) as string[];
  return (
  <div className="max-w-4xl mx-auto px-4 py-12">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h1 className="text-4xl font-bold text-gray-900 mb-8">{t('cgu.title')}</h1>
      <div className="prose prose-lg text-gray-700 space-y-6">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">{t('cgu.section_account_title')}</h2>
          <p>{t('cgu.section_account_intro')}</p>
          <ul className="list-disc pl-6 space-y-2">
            {accountItems.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">{t('cgu.section_forbidden_title')}</h2>
          <p>{t('cgu.section_forbidden_intro')}</p>
          <ul className="list-disc pl-6 space-y-2">
            {forbiddenItems.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">{t('cgu.section_suspension_title')}</h2>
          <p>{t('cgu.section_suspension_text')}</p>
        </section>
      </div>
    </motion.div>
  </div>
  );
};

export default CGU;
