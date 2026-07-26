import React, { useState } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';

/**
 * Éditeur de "lien à partager" (slug), réutilisé pour les boutiques
 * (VendorSettings.tsx) et les produits (VendorProductForm.tsx).
 *
 * Sauvegarde immédiate au clic sur ✓ (pas rattaché au bouton
 * "Enregistrer" du formulaire parent) : changer un lien public est une
 * action distincte, avec sa propre validation d'unicité côté serveur
 * (RPC set_shop_slug / set_product_slug, migration 20260723000028) -
 * mieux vaut que l'échec ("ce lien est déjà pris") soit localisé ici
 * plutôt que de faire échouer toute la sauvegarde du formulaire.
 */

const ERROR_MESSAGES: Record<string, string> = {
  SLUG_ALREADY_TAKEN: 'Ce lien est déjà utilisé par une autre boutique/produit. Essayez-en un autre.',
  INVALID_SLUG_FORMAT: 'Utilisez uniquement des lettres minuscules, chiffres et tirets (3 à 60 caractères), ex : ma-boutique-lome.',
};

function genericErrorMessage(error: unknown): string {
  const code = (error as any)?.message ?? '';
  for (const key of Object.keys(ERROR_MESSAGES)) {
    if (code.includes(key)) return ERROR_MESSAGES[key];
  }
  return "Ce lien n'a pas pu être enregistré, réessayez.";
}

interface SlugEditorProps {
  value: string;
  baseUrl: string; // ex: "mia.africa/boutique/" ou "mia.africa/produit/"
  onSave: (newSlug: string) => Promise<string>; // doit retourner le slug confirmé par le serveur
  placeholder?: string;
}

export default function SlugEditor({ value, baseUrl, onSave, placeholder }: SlugEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(value);

  const startEditing = () => {
    setDraft(current);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    const normalized = draft.trim().toLowerCase().replace(/\s+/g, '-');
    if (normalized === current) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const confirmed = await onSave(normalized);
      setCurrent(confirmed);
      setEditing(false);
    } catch (err) {
      setError(genericErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500">
          {baseUrl}
          <span className="font-semibold text-gray-800">{current || '—'}</span>
        </span>
        <button
          type="button"
          onClick={startEditing}
          className="text-xs font-semibold text-mia-green-700 hover:text-mia-green-800 flex items-center gap-1"
        >
          <Pencil size={12} /> Modifier
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 shrink-0">{baseUrl}</span>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          disabled={saving}
          className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-mia-green-500"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving || draft.trim().length < 3}
          className="w-8 h-8 rounded-lg bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-50 text-white flex items-center justify-center shrink-0"
          aria-label="Confirmer"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center shrink-0"
          aria-label="Annuler"
        >
          <X size={14} />
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
