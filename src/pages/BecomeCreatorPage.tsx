import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCapabilities } from '@/hooks/useCapabilities';
import { capabilitiesService } from '@/services/capabilities.service';

export default function BecomeCreatorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isCreator, loading } = useCapabilities();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/connexion');
    }
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading || !isAuthenticated) return null;

  if (loading) return null;

  const handleActivate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await capabilitiesService.enableCreatorCapability();
    } catch (err: any) {
      setError(err.message ?? t('common.error_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-pink-600 text-white flex items-center justify-center mx-auto mb-5">
        <Sparkles size={28} />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('become_creator.title')}</h1>
      <p className="text-gray-600 mb-6">{t('become_creator.description')}</p>

      {isCreator ? (
        <div className="flex items-center justify-center gap-2 text-mia-green-700 font-semibold">
          <CheckCircle2 size={20} /> {t('become_creator.already_active')}
        </div>
      ) : (
        <button
          onClick={handleActivate}
          disabled={submitting}
          className="bg-pink-600 hover:bg-pink-700 disabled:opacity-60 text-white font-bold py-3 px-6 rounded-lg inline-flex items-center gap-2"
        >
          {submitting && <Loader2 size={18} className="animate-spin" />}
          {t('become_creator.activate_button')}
        </button>
      )}
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
