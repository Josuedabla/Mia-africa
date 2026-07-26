/**
 * Page compte - manquait entièrement jusqu'ici : aucune page centrale
 * pour un compte normal (acheteur/vendeur), et surtout aucun moyen de se
 * déconnecter en dehors du panneau admin. C'est ce que l'utilisateur
 * pointait ("on doit avoir quelque part pour... et autres").
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Coins, Package, Trophy, Gift, Store, Bike, ShieldCheck, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useCapabilities } from '@/hooks/useCapabilities';

export default function AccountPage() {
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
  }, [user]);

  if (!isAuthenticated) {
    navigate('/connexion');
    return null;
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
      <div className="bg-mia-green-600 rounded-2xl p-6 mb-6 text-white">
        <p className="text-sm text-mia-green-100">Connecté en tant que</p>
        <p className="text-lg font-bold">{user?.email ?? user?.phone ?? 'Mon compte'}</p>
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-6">Mon activité</p>
      <div className="space-y-2">
        <Row to="/mes-commandes" icon={Package} label="Mes commandes" />
        <Row to="/portefeuille" icon={Coins} label="Pièces MIA" />
        <Row to="/classements" icon={Trophy} label="Classements" />
        <Row to="/parrainage" icon={Gift} label="Parrainage" />
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-6">Espaces</p>
      <div className="space-y-2">
        <Row
          to={has('seller', 'active') ? '/vendeur/dashboard' : '/devenir'}
          icon={Store}
          label={has('seller', 'active') ? 'Mon espace vendeur' : 'Devenir vendeur'}
        />
        <Row
          to={has('driver', 'active') ? '/livreur/tournee' : '/devenir-livreur'}
          icon={Bike}
          label={has('driver', 'active') ? 'Mon espace livreur' : 'Devenir livreur'}
        />
        {isAdmin && <Row to="/admin" icon={ShieldCheck} label="Administration" />}
      </div>

      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 text-red-600 font-semibold mt-8 py-3 rounded-xl hover:bg-red-50 transition-colors"
      >
        <LogOut size={16} /> Se déconnecter
      </button>
    </div>
  );
}
