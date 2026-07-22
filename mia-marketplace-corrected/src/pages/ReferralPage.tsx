import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Users, Copy, Check, Gift } from 'lucide-react';

interface ReferredUser {
  uid: string;
}

export default function ReferralPage() {
  const { user, isAuthenticated } = useAuth();
  const [level1, setLevel1] = useState<ReferredUser[]>([]);
  const [level2Count, setLevel2Count] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const level1Snap = await getDocs(query(collection(db, 'referrals'), where('referrerUid', '==', user.uid)));
      if (cancelled) return;
      const level1Uids = level1Snap.docs.map((d) => d.id);
      setLevel1(level1Uids.map((uid) => ({ uid })));

      if (level1Uids.length > 0) {
        // Level 2 = anyone whose referrerUid is one of my level-1 referrals.
        // Firestore 'in' queries cap at 30 values - fine for a first version.
        const chunks: string[][] = [];
        for (let i = 0; i < level1Uids.length; i += 30) chunks.push(level1Uids.slice(i, i + 30));
        let count = 0;
        for (const chunk of chunks) {
          const snap = await getDocs(query(collection(db, 'referrals'), where('referrerUid', 'in', chunk)));
          count += snap.size;
        }
        if (!cancelled) setLevel2Count(count);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!isAuthenticated || !user) return <Navigate to="/connexion" replace />;

  const referralLink = `${window.location.origin}/connexion?ref=${user.uid}`;

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
        <h1 className="text-2xl font-bold text-gray-900">Programme de parrainage MIA</h1>
        <p className="text-gray-500 mt-1 max-w-md mx-auto">
          Gagnez du cashback réel sur les achats de vos filleuls, directs et indirects — versé
          immédiatement dans votre portefeuille, utilisable tout de suite.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-2">Votre lien de parrainage</p>
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
            {copied ? 'Copié' : 'Copier'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-2xl font-bold text-gray-900">{loading ? '...' : level1.length}</p>
          <p className="text-sm text-gray-500">Filleuls directs (niveau 1)</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-2xl font-bold text-gray-900">{loading ? '...' : level2Count}</p>
          <p className="text-sm text-gray-500">Filleuls indirects (niveau 2)</p>
        </div>
      </div>

      <div className="bg-mia-green-50 border border-mia-green-200 rounded-xl p-5 flex items-start gap-3">
        <Gift className="text-mia-green-600 shrink-0 mt-0.5" size={20} />
        <div className="text-sm text-mia-green-800">
          <p className="font-semibold mb-1">Comment ça marche</p>
          <p>
            Vous gagnez 3% de cashback sur chaque achat payé par un filleul direct, et 1% sur les achats
            des personnes qu'il a lui-même parrainées. Le cashback est crédité immédiatement dans votre
            portefeuille MIA — utilisable tout de suite pour acheter, ou retirable vers mobile money dès
            que votre solde atteint 1 000 FCFA.
          </p>
        </div>
      </div>
    </div>
  );
}
