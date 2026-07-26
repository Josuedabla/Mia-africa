import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const Confidentialite: React.FC = () => {
  const { t } = useTranslation();
  const dataCollectedItems = t('confidentialite.section_data_items', { returnObjects: true }) as string[];
  const dataUsageItems = t('confidentialite.section_usage_items', { returnObjects: true }) as string[];
  return (
  <div className="max-w-4xl mx-auto px-4 py-12">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h1 className="text-4xl font-bold text-gray-900 mb-8">{t('confidentialite.title')}</h1>
      <div className="prose prose-lg text-gray-700 space-y-6">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">{t('confidentialite.section_data_title')}</h2>
          <p>{t('confidentialite.section_data_intro')}</p>
          <ul className="list-disc pl-6 space-y-2">
            {dataCollectedItems.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">{t('confidentialite.section_usage_title')}</h2>
          <p>{t('confidentialite.section_usage_intro')}</p>
          <ul className="list-disc pl-6 space-y-2">
            {dataUsageItems.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">{t('confidentialite.section_security_title')}</h2>
          <p>{t('confidentialite.section_security_text')}</p>
        </section>
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">{t('confidentialite.section_rights_title')}</h2>
          <p>{t('confidentialite.section_rights_text')} miaafricaservice@gmail.com</p>
        </section>
      </div>
    </motion.div>
  </div>
  );
};

export default Confidentialite;
