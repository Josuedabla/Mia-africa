import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  updateShop,
  setShopSlug,
  requestShopCustomDomain,
  removeShopCustomDomain,
  checkShopCustomDomainStatus,
  type DnsInstructions,
} from '@/services/db.service';
import { setShopWhatsAppOrdersEnabled, setShopWhatsAppNumber } from '@/services/whatsapp.service';
import { purchaseBlueBadge, BLUE_BADGE_PRICES_COINS, type BlueBadgeDurationMonths } from '@/services/coins.service';
import { useWallet } from '@/hooks/useCoins';
import { supabase } from '@/lib/supabase';
import { sanitizeProductHtml } from '@/lib/sanitizeHtml';
import SlugEditor from '@/components/SlugEditor';
import type { MyShop } from '@/hooks/useMyShop';
import { Save, Loader2, MessageCircle, FileText, Globe, CheckCircle2, Clock, XCircle, BadgeCheck } from 'lucide-react';

interface OutletCtx {
  shop: MyShop;
}

export default function VendorSettings() {
  const { t, i18n } = useTranslation();
  const { shop } = useOutletContext<OutletCtx>();
  const { coins } = useWallet();
  const [name, setName] = useState(shop.name);
  const [whatsappNumber, setWhatsappNumber] = useState(shop.whatsapp_number ?? '');
  const [whatsappEnabled, setWhatsappEnabled] = useState(shop.whatsapp_orders_enabled);
  const [customCgv, setCustomCgv] = useState(shop.custom_cgv_html ?? '');
  const [customReturns, setCustomReturns] = useState(shop.custom_returns_policy_html ?? '');
  const [customPrivacy, setCustomPrivacy] = useState(shop.custom_privacy_policy_html ?? '');
  const [domainInput, setDomainInput] = useState('');
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [customDomain, setCustomDomain] = useState(shop.custom_domain ?? null);
  const [customDomainStatus, setCustomDomainStatus] = useState(shop.custom_domain_status ?? 'none');
  const [dnsInstructions, setDnsInstructions] = useState<DnsInstructions | null>(null);
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [badgeExpiresAt, setBadgeExpiresAt] = useState<string | null>(null);
  const [badgeLoading, setBadgeLoading] = useState(true);
  const [badgePurchasing, setBadgePurchasing] = useState(false);
  const [badgeError, setBadgeError] = useState<string | null>(null);
  const [badgeDuration, setBadgeDuration] = useState<BlueBadgeDurationMonths>(12);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(
      supabase
        .from('seller_profiles')
        .select('blue_badge_expires_at')
        .eq('user_id', shop.owner_id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setBadgeExpiresAt(data?.blue_badge_expires_at ?? null);
        })
    ).finally(() => !cancelled && setBadgeLoading(false));
    return () => {
      cancelled = true;
    };
  }, [shop.owner_id]);

  const badgeActive = badgeExpiresAt ? new Date(badgeExpiresAt).getTime() > Date.now() : false;

  const handlePurchaseBadge = async () => {
    setBadgePurchasing(true);
    setBadgeError(null);
    try {
      const newExpiry = await purchaseBlueBadge(shop.id, badgeDuration);
      setBadgeExpiresAt(newExpiry);
    } catch (err: any) {
      setBadgeError(
        err.message?.includes('INSUFFICIENT_COINS')
          ? t('vendor_settings.blue_badge_insufficient_coins')
          : t('vendor_settings.blue_badge_error')
      );
    } finally {
      setBadgePurchasing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateShop(shop.id, {
        name,
        custom_cgv_html: customCgv.trim() ? sanitizeProductHtml(customCgv) : null,
        custom_returns_policy_html: customReturns.trim() ? sanitizeProductHtml(customReturns) : null,
        custom_privacy_policy_html: customPrivacy.trim() ? sanitizeProductHtml(customPrivacy) : null,
      });
      // "Le vendeur reçoit les commandes au niveau des commandes et sur
      // WhatsApp, sauf s'il désactive." + "Possibilité de modifier le
      // numéro de réception. Avant de publier, l'utilisateur met le numéro
      // WhatsApp sur lequel recevoir les commandes."
      await setShopWhatsAppNumber(shop.id, whatsappNumber);
      await setShopWhatsAppOrdersEnabled(shop.id, whatsappEnabled);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const DOMAIN_ERROR_MESSAGES: Record<string, string> = {
    DOMAIN_ALREADY_TAKEN: 'Ce domaine est déjà rattaché à une autre boutique MIA.',
    INVALID_DOMAIN_FORMAT: "Format de domaine invalide. Exemple attendu : maboutique.com",
    DOMAIN_TAKEN_ON_VERCEL: 'Ce domaine est déjà utilisé ailleurs (hors MIA). Vérifiez que vous êtes bien propriétaire de ce domaine.',
    VERCEL_ATTACH_FAILED: "Le rattachement a échoué côté serveur, réessayez dans quelques instants.",
  };

  const handleAttachDomain = async () => {
    if (!domainInput.trim()) return;
    setDomainSaving(true);
    setDomainError(null);
    try {
      const result = await requestShopCustomDomain(shop.id, domainInput.trim());
      setCustomDomain(result.custom_domain);
      setCustomDomainStatus(result.status as typeof customDomainStatus);
      setDnsInstructions(result.dns_instructions ?? null);
      setDomainInput('');
    } catch (err: any) {
      const code = err?.message ?? '';
      const match = Object.keys(DOMAIN_ERROR_MESSAGES).find((k) => code.includes(k));
      setDomainError(match ? DOMAIN_ERROR_MESSAGES[match] : "Ce domaine n'a pas pu être rattaché à MIA, réessayez.");
    } finally {
      setDomainSaving(false);
    }
  };

  const handleRemoveDomain = async () => {
    if (!customDomain) return;
    setDomainSaving(true);
    try {
      await removeShopCustomDomain(shop.id, customDomain);
      setCustomDomain(null);
      setCustomDomainStatus('none');
      setDnsInstructions(null);
    } finally {
      setDomainSaving(false);
    }
  };

  const handleCheckDomain = async () => {
    setCheckingDomain(true);
    try {
      const result = await checkShopCustomDomainStatus(shop.id);
      setCustomDomainStatus(result.status);
      setDnsInstructions(result.dns_instructions ?? null);
    } finally {
      setCheckingDomain(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900">Paramètres de la boutique</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la boutique</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-mia-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lien de votre boutique</label>
          <SlugEditor
            value={shop.slug}
            baseUrl="mia.africa/boutique/"
            placeholder={shop.slug}
            onSave={(newSlug) => setShopSlug(shop.id, newSlug)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pays (détecté automatiquement)</label>
          <input disabled value={shop.country_code} className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-gray-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
          <input disabled value={shop.category} className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-gray-500" />
        </div>

        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <BadgeCheck size={18} className="text-sky-500" />
            <h3 className="font-semibold text-gray-900">{t('vendor_settings.blue_badge_title')}</h3>
          </div>

          {badgeLoading ? (
            <Loader2 size={16} className="animate-spin text-gray-400" />
          ) : (
            <>
              {badgeActive && (
                <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2.5 mb-3">
                  <BadgeCheck size={16} className="text-sky-500 shrink-0" />
                  <span className="text-sm text-sky-800">
                    {t('vendor_settings.blue_badge_active_until', {
                      date: new Date(badgeExpiresAt as string).toLocaleDateString(i18n.language),
                    })}
                  </span>
                </div>
              )}

              {!badgeActive && <p className="text-xs text-gray-500 mb-3">{t('vendor_settings.blue_badge_description')}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                {([1, 3, 12] as BlueBadgeDurationMonths[]).map((months) => {
                  const price = BLUE_BADGE_PRICES_COINS[months];
                  const perMonth = Math.round(price / months);
                  const selected = badgeDuration === months;
                  return (
                    <button
                      key={months}
                      type="button"
                      onClick={() => setBadgeDuration(months)}
                      className={`text-left border rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        selected
                          ? 'border-sky-500 bg-sky-50 text-sky-800 ring-1 ring-sky-500'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-sky-300'
                      }`}
                    >
                      {t(`vendor_settings.blue_badge_plan_${months}`, { price, perMonth })}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handlePurchaseBadge}
                disabled={badgePurchasing || (coins ?? 0) < BLUE_BADGE_PRICES_COINS[badgeDuration]}
                className="inline-flex items-center gap-1.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2 rounded-lg"
              >
                {badgePurchasing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <BadgeCheck size={14} />
                )}
                {t(badgeActive ? 'vendor_settings.blue_badge_renew_button' : 'vendor_settings.blue_badge_buy_button')}
              </button>
              {(coins ?? 0) < BLUE_BADGE_PRICES_COINS[badgeDuration] && (
                <p className="text-xs text-gray-400 mt-2">{t('vendor_settings.blue_badge_insufficient_coins')}</p>
              )}
            </>
          )}
          {badgeError && <p className="text-xs text-red-600 mt-2">{badgeError}</p>}
        </div>

        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle size={18} className="text-green-600" />
            <h3 className="font-semibold text-gray-900">Commandes via WhatsApp</h3>
          </div>

          <label className="flex items-center justify-between mb-3 cursor-pointer">
            <span className="text-sm text-gray-700">Recevoir les commandes sur WhatsApp</span>
            <input
              type="checkbox"
              checked={whatsappEnabled}
              onChange={(e) => setWhatsappEnabled(e.target.checked)}
              className="w-5 h-5 accent-mia-green-600"
            />
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Si désactivé, le bouton "Commander sur WhatsApp" n'apparaîtra plus sur vos produits. Vos clients passeront
            uniquement par le suivi de commande interne à MIA.
          </p>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-1 block">Numéro WhatsApp de réception</span>
            <input
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              disabled={!whatsappEnabled}
              placeholder="+228 90 00 00 00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-mia-green-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </label>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={18} className="text-mia-green-700" />
            <h3 className="font-semibold text-gray-900">Politiques de la boutique</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Laissez un champ vide pour utiliser la politique MIA par défaut (affichée à vos clients). Renseignez un
            champ pour la remplacer par votre propre texte, spécifique à votre boutique.
          </p>

          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 mb-1 block">
              CGV de la boutique <span className="text-gray-400 font-normal">— sinon : CGV MIA</span>
            </span>
            <textarea
              value={customCgv}
              onChange={(e) => setCustomCgv(e.target.value)}
              rows={4}
              placeholder="Ex : conditions de vente spécifiques à vos produits..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-mia-green-500 text-sm"
            />
          </label>

          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 mb-1 block">
              Politique de retours <span className="text-gray-400 font-normal">— optionnel</span>
            </span>
            <textarea
              value={customReturns}
              onChange={(e) => setCustomReturns(e.target.value)}
              rows={4}
              placeholder="Ex : délai de retour, conditions, frais éventuels..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-mia-green-500 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-1 block">
              Confidentialité <span className="text-gray-400 font-normal">— sinon : politique MIA</span>
            </span>
            <textarea
              value={customPrivacy}
              onChange={(e) => setCustomPrivacy(e.target.value)}
              rows={4}
              placeholder="Ex : usage des données collectées spécifique à votre boutique..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-mia-green-500 text-sm"
            />
          </label>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={18} className="text-mia-green-700" />
            <h3 className="font-semibold text-gray-900">Nom de domaine personnalisé</h3>
          </div>

          {!customDomain || customDomainStatus === 'none' ? (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Par défaut, votre boutique est accessible via <span className="font-semibold">mia.africa/boutique/{shop.slug}</span>.
                Si vous possédez déjà votre propre nom de domaine (ex : maboutique.com), vous pouvez le rattacher ici — votre
                lien MIA restera actif en parallèle.
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="maboutique.com"
                  disabled={domainSaving}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-mia-green-500 text-sm"
                />
                <button
                  type="button"
                  onClick={handleAttachDomain}
                  disabled={domainSaving || !domainInput.trim()}
                  className="inline-flex items-center gap-1.5 bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2 rounded-lg shrink-0"
                >
                  {domainSaving ? <Loader2 size={14} className="animate-spin" /> : 'Rattacher'}
                </button>
              </div>
              {domainError && <p className="text-xs text-red-600 mt-2">{domainError}</p>}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  {customDomainStatus === 'verified' && <CheckCircle2 size={16} className="text-green-600 shrink-0" />}
                  {customDomainStatus === 'pending' && <Clock size={16} className="text-amber-500 shrink-0" />}
                  {customDomainStatus === 'failed' && <XCircle size={16} className="text-red-500 shrink-0" />}
                  <span className="text-sm font-semibold text-gray-800 truncate">{customDomain}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveDomain}
                  disabled={domainSaving}
                  className="text-xs font-semibold text-gray-500 hover:text-red-600 shrink-0 ml-2"
                >
                  Retirer
                </button>
              </div>

              {customDomainStatus === 'pending' && (
                <div className="space-y-2">
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    En attente de propagation DNS (généralement sous 24-48h après avoir configuré l'enregistrement
                    ci-dessous). Votre boutique reste accessible entre-temps via{' '}
                    <span className="font-semibold">mia.africa/boutique/{shop.slug}</span>.
                  </p>
                  {dnsInstructions && (
                    <div className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 font-mono">
                      <p className="mb-1 font-sans font-semibold text-gray-700">
                        Chez votre registrar, ajoutez cet enregistrement :
                      </p>
                      <p>Type : {dnsInstructions.type}</p>
                      <p>Nom : {dnsInstructions.name}</p>
                      <p>Valeur : {dnsInstructions.value}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleCheckDomain}
                    disabled={checkingDomain}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-mia-green-700 hover:text-mia-green-800 disabled:opacity-50"
                  >
                    {checkingDomain ? <Loader2 size={12} className="animate-spin" /> : null}
                    Vérifier maintenant
                  </button>
                </div>
              )}
              {customDomainStatus === 'failed' && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  La vérification a échoué (DNS non configurés correctement). Contactez le support MIA ou retirez ce
                  domaine pour en essayer un autre.
                </p>
              )}
              {customDomainStatus === 'verified' && (
                <p className="text-xs text-green-700">
                  Votre boutique est maintenant accessible directement via ce domaine, en plus de votre lien MIA.
                </p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-60 text-white font-semibold px-4 py-2.5 rounded-lg"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Enregistrer
        </button>
        {saved && <p className="text-sm text-mia-green-700">Modifications enregistrées ✓</p>}
      </div>
    </div>
  );
}
