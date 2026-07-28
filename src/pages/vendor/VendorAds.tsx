import React from 'react';
import { useTranslation } from 'react-i18next';
import { Megaphone } from 'lucide-react';

export default function VendorAds() {
  const { t } = useTranslation();
  return (
    <div className="text-center py-20">
      <Megaphone className="mx-auto text-mia-green-400 mb-4" size={40} />
      <h1 className="text-xl font-bold text-gray-900 mb-2">{t('vendor_ads.title')}</h1>
      <p className="text-gray-500 max-w-md mx-auto">
        {t('vendor_ads.description')}
      </p>
    </div>
  );
}
