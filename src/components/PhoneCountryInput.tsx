/**
 * Champ téléphone + sélecteur de pays (indicatif et drapeau liés au même
 * contrôle) — remplace les anciens <input type="text" placeholder="+228..."/>
 * en texte libre (ex. VendorOnboarding.tsx), qui laissaient l'utilisateur
 * taper n'importe quoi et ne validaient rien.
 *
 * Basé sur `react-phone-number-input` (recommandé par la spec produit,
 * section 3.b) : le drapeau et l'indicatif changent ensemble quand on
 * choisit un pays, la valeur est toujours normalisée en E.164
 * (ex. "+22890000000") ce qui correspond au format déjà utilisé par
 * Supabase Auth (signInWithOtp({ phone })) et par la colonne
 * `profiles.phone` / `shops.phone`.
 *
 * Le pays par défaut vient de useCountry() (auto-détection IP/GPS/téléphone
 * déjà en place) — jamais un pays choisi arbitrairement (Togo) pour tout le
 * monde, conformément à la règle produit "jamais de sélecteur de pays
 * imposé au chargement". L'utilisateur reste toujours libre de changer le
 * drapeau lui-même s'il compose un numéro d'un autre pays.
 */
import React from 'react';
import PhoneInput, { type Value } from 'react-phone-number-input';
import { isValidPhoneNumber } from 'react-phone-number-input';
import fr from 'react-phone-number-input/locale/fr.json';
import en from 'react-phone-number-input/locale/en.json';
import 'react-phone-number-input/style.css';
import { useTranslation } from 'react-i18next';

interface PhoneCountryInputProps {
  /** Valeur courante, au format E.164 (ex. "+22890000000") ou vide. */
  value: string;
  onChange: (value: string) => void;
  /** Code pays ISO 3166-1 alpha-2 par défaut (ex. depuis useCountry()). */
  defaultCountry?: string;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  /** Affiche un message d'erreur si le numéro est non vide et invalide. */
  showValidation?: boolean;
  className?: string;
}

export default function PhoneCountryInput({
  value,
  onChange,
  defaultCountry = 'TG',
  required = false,
  disabled = false,
  label = 'Téléphone',
  showValidation = true,
  className = '',
}: PhoneCountryInputProps) {
  const { t, i18n } = useTranslation();
  const isEmpty = !value;
  const isValid = isEmpty ? true : isValidPhoneNumber(value);
  const phoneLibLabels = i18n.language === 'en' ? en : fr;

  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <PhoneInput
        international
        // Drapeau + indicatif liés au même sélecteur ; countryCallingCodeEditable
        // à false évite qu'un utilisateur édite l'indicatif "à la main" et se
        // retrouve avec un numéro qui ne correspond plus au drapeau affiché.
        countryCallingCodeEditable={false}
        defaultCountry={defaultCountry as any}
        labels={phoneLibLabels}
        value={value as Value}
        onChange={(v) => onChange(v ?? '')}
        disabled={disabled}
        required={required}
        placeholder="90 00 00 00"
        className={`mia-phone-input w-full border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-mia-green-500 outline-none ${
          showValidation && !isValid ? 'border-red-400' : 'border-gray-300'
        }`}
      />
      {showValidation && !isValid && (
        <p className="text-xs text-red-500 mt-1">{t('vendor_onboarding.phone_invalid')}</p>
      )}
    </div>
  );
}

/** Ré-export pratique pour valider un numéro ailleurs (ex. avant submit). */
export { isValidPhoneNumber };
