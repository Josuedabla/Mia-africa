/**
 * Bouton de signalement produit (procédure notice-and-takedown, voir
 * MIA-Cadre-Legal-Moderation.md section 3). Un signalement "sécurité
 * mineur" dépublie immédiatement le produit côté serveur (voir
 * report_product() dans la migration 20260723000031) - ce composant
 * n'a besoin que d'envoyer le signalement, pas de gérer lui-même le
 * retrait.
 */
import React, { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { reportProduct, type ProductReportReason } from '@/services/db.service';

const REASONS: { value: ProductReportReason; label: string }[] = [
  { value: 'produit_illegal', label: 'Produit illégal ou interdit (médicament, drogue, arme...)' },
  { value: 'contrefacon', label: 'Contrefaçon' },
  { value: 'securite_mineur', label: 'Sécurité des mineurs' },
  { value: 'autre', label: 'Autre' },
];

export default function ReportProductButton({ productId }: { productId: string }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ProductReportReason>('produit_illegal');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleOpen = () => {
    if (!isAuthenticated) {
      navigate('/connexion');
      return;
    }
    setOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await reportProduct(productId, reason, details.trim() || undefined);
      setSent(true);
    } catch {
      // silencieux: un signalement qui échoue techniquement ne doit pas
      // bloquer la navigation de l'utilisateur, le bouton reste disponible.
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return <p className="text-xs text-gray-400 mt-2">Signalement envoyé, merci. Notre équipe va l'examiner.</p>;
  }

  return (
    <div className="mt-2">
      <button
        onClick={handleOpen}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
      >
        <Flag size={12} /> Signaler ce produit
      </button>

      {open && (
        <div className="mt-2 bg-gray-50 rounded-lg p-3 space-y-2">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as ProductReportReason)}
            className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Détails (optionnel)"
            rows={2}
            className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-lg"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Envoyer le signalement
          </button>
        </div>
      )}
    </div>
  );
}
