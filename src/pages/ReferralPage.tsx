import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Users, Copy, Check, Gift } from 'lucide-react';

interface ReferredUser {
  uid: string;
}

export default function ReferralPage() {
  const { t } = useTranslation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [level1, setLevel1] = useState<ReferredUser[]>([]);
  const [level2Count, setLevel2Count] = useState(0);
  const [copied, setCopied] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const { data: level1Rows } = await supabase.from('referrals').select('user_id').eq('referrer_id', user.id);
      if (cancelled) return;
      const level1Uids = (level1Rows ?? []).map((r) => r.user_id);
      setLevel1(level1Uids.map((uid) => ({ uid })));

      if (level1Uids.length > 0) {
        const { count } = await supabase
          .from('referrals')
          .select('user_id', { count: 'exact', head: true })
          .in('referrer_id', level1Uids);
        if (!cancelled) setLevel2Count(count ?? 0);
      }
      if (!cancelled) setDataLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (authLoading) return null;
  if (!isAuthenticated || !user) return <Navigate to="/connexion" replace />;

  const referralLink = `${window.location.origin}/connexion?ref=${user.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-mia-green-600 text-white flex items-center justify-center mx-auto mb-4">
          <Users size={26} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{t('referral_page.page_title')}</h1>
        <p className="text-gray-500 mt-1 max-w-md mx-auto">{t('referral_page.page_subtitle')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-2">{t('referral_page.link_label')}</p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={referralLink}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
          />
          <button
            onClick={handleCopy}
            className="shrink-0 inline-flex items-center gap-1.5 bg-mia-green-600 hover:bg-mia-green-700 text-white font-semibold px-4 py-2 rounded-lg text-sm"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t('referral_page.copied_button') : t('referral_page.copy_button')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-2xl font-bold text-gray-900">{dataLoading ? '...' : level1.length}</p>
          <p className="text-sm text-gray-500">{t('referral_page.level1_label')}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-2xl font-bold text-gray-900">{dataLoading ? '...' : level2Count}</p>
          <p className="text-sm text-gray-500">{t('referral_page.level2_label')}</p>
        </div>
      </div>

      <div className="bg-mia-green-50 border border-mia-green-200 rounded-xl p-5 flex items-start gap-3">
        <Gift className="text-mia-green-600 shrink-0 mt-0.5" size={20} />
        <div className="text-sm text-mia-green-800">
          <p className="font-semibold mb-1">{t('referral_page.how_it_works_title')}</p>
          <p>{t('referral_page.how_it_works_description')}</p>
        </div>
      </div>
    </div>
  );
}
