/**
 * Page compte - manquait entièrement jusqu'ici : aucune page centrale
 * pour un compte normal (acheteur/vendeur), et surtout aucun moyen de se
 * déconnecter en dehors du panneau admin. C'est ce que l'utilisateur
 * pointait ("on doit avoir quelque part pour... et autres").
 */
import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { LogOut, Coins, Package, Trophy, Gift, Store, Bike, ShieldCheck, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function AccountPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { has } = useCapabilities();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setIsAdmin(Boolean(data?.is_admin)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!isAuthenticated) {
    return <Navigate to="/connexion" replace />;
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const Row = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
    <Link to={to} className="flex items-center justify-between bg-white rounded-xl px-4 py-3.5 border border-gray-100 hover:border-mia-green-200 transition-colors">
      <span className="flex items-center gap-3 text-gray-800 font-medium">
        <Icon size={18} className="text-mia-green-600" /> {label}
      </span>
      <ChevronRight size={16} className="text-gray-300" />
    </Link>
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex justify-end mb-3">
        <LanguageSwitcher />
      </div>

      <div className="bg-mia-green-600 rounded-2xl p-6 mb-6 text-white">
        <p className="text-sm text-mia-green-100">{t('account.connected_as')}</p>
        <p className="text-lg font-bold">{user?.email ?? user?.phone ?? t('account.default_account')}</p>
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-6">{t('account.my_activity')}</p>
      <div className="space-y-2">
        <Row to="/mes-commandes" icon={Package} label={t('account.orders')} />
        <Row to="/portefeuille" icon={Coins} label={t('account.coins')} />
        <Row to="/classements" icon={Trophy} label={t('account.leaderboard')} />
        <Row to="/parrainage" icon={Gift} label={t('account.referral')} />
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-6">{t('account.spaces')}</p>
      <div className="space-y-2">
        <Row
          to={has('seller', 'active') ? '/vendeur/dashboard' : '/devenir'}
          icon={Store}
          label={has('seller', 'active') ? t('account.seller_space') : t('account.become_seller')}
        />
        <Row
          to={has('driver', 'active') ? '/livreur/tournee' : '/devenir-livreur'}
          icon={Bike}
          label={has('driver', 'active') ? t('account.driver_space') : t('account.become_driver')}
        />
        {isAdmin && <Row to="/admin" icon={ShieldCheck} label={t('account.administration')} />}
      </div>

      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 text-red-600 font-semibold mt-8 py-3 rounded-xl hover:bg-red-50 transition-colors"
      >
        <LogOut size={16} /> {t('account.sign_out')}
      </button>
    </div>
  );
}
