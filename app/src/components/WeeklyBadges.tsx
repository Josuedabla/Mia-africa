/**
 * WeeklyBadges
 *
 * Vitrine publique des gains de classement d'une boutique (diamant, or,
 * argent, bronze - voir migration 20260720000024). Affiché sur la page
 * boutique pour que la compétition soit visible de tous, pas seulement
 * du vendeur lui-même dans son tableau de bord - c'est ce qui rend la
 * "compétition positive" motivante publiquement.
 */
import React, { useEffect, useState } from 'react';
import { getShopWeeklyAwards, CRITERION_LABELS, type ShopWeeklyAward } from '@/services/leaderboard.service';

interface WeeklyBadgesProps {
  shopId: string;
}

export default function WeeklyBadges({ shopId }: WeeklyBadgesProps) {
  const [awards, setAwards] = useState<ShopWeeklyAward[]>([]);

  useEffect(() => {
    getShopWeeklyAwards(shopId, 4)
      .then(setAwards)
      .catch(() => setAwards([]));
  }, [shopId]);

  if (awards.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {awards.map((award, i) => (
        <div
          key={i}
          title={`${CRITERION_LABELS[award.criterion]} - rang #${award.rank} (semaine du ${new Date(award.week_start).toLocaleDateString('fr-FR')})`}
          className="flex items-center gap-1.5 bg-white/15 backdrop-blur px-2.5 py-1 rounded-full text-xs font-semibold"
        >
          <span className="text-base">{award.badge_emoji}</span>
          <span>{CRITERION_LABELS[award.criterion]}</span>
        </div>
      ))}
    </div>
  );
}
