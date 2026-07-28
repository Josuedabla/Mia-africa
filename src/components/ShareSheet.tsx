/**
 * ShareSheet
 *
 * "Cliquer sur Partage montre les différents réseaux sociaux + le lien.
 * On privilégie WhatsApp car le plus utilisé." Modale simple listant les
 * canaux renvoyés par share.service.ts, avec WhatsApp mis en avant
 * visuellement (plus grand, en haut, couleur dédiée) plutôt qu'aligné
 * avec les autres réseaux.
 */
import React, { useState } from 'react';
import { X, Check, Copy } from 'lucide-react';
import { buildProductShareChannels, shareNative, copyToClipboard, type ShareChannel } from '@/services/share.service';

interface ShareSheetProps {
  productId: string;
  productSlug?: string | null;
  productName: string;
  price?: string;
  onClose: () => void;
}

const CHANNEL_STYLES: Record<ShareChannel['id'], string> = {
  whatsapp: 'bg-green-500 hover:bg-green-600 text-white',
  facebook: 'bg-blue-600 hover:bg-blue-700 text-white',
  telegram: 'bg-sky-500 hover:bg-sky-600 text-white',
  messenger: 'bg-indigo-500 hover:bg-indigo-600 text-white',
  twitter: 'bg-gray-900 hover:bg-black text-white',
  email: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
  copy_link: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
  native: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
};

export default function ShareSheet({ productId, productSlug, productName, price, onClose }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);
  const channels = buildProductShareChannels({ productId, productSlug, productName, price });
  const primary = channels.find((c) => c.isPrimary);
  const secondary = channels.filter((c) => !c.isPrimary);

  const handleChannelClick = async (channel: ShareChannel) => {
    if (channel.id === 'copy_link') {
      if (channel.url) await copyToClipboard(channel.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    if (channel.id === 'native') {
      const didShare = channel.url && (await shareNative({ title: productName, text: productName, url: channel.url }));
      if (!didShare) return; // pas de fallback nécessaire, l'utilisateur a juste annulé ou le device ne supporte pas
      onClose();
      return;
    }
    if (channel.url) window.open(channel.url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Partager ce produit</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        {/* WhatsApp mis en avant, seul sur sa ligne, plus grand que les autres */}
        {primary && (
          <button
            onClick={() => handleChannelClick(primary)}
            className={`w-full py-3 rounded-xl font-semibold mb-4 flex items-center justify-center gap-2 ${CHANNEL_STYLES[primary.id]}`}
          >
            Partager sur {primary.label}
          </button>
        )}

        <div className="grid grid-cols-4 gap-3">
          {secondary.map((channel) => (
            <button
              key={channel.id}
              onClick={() => handleChannelClick(channel)}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium ${CHANNEL_STYLES[channel.id]}`}
            >
              {channel.id === 'copy_link' ? (
                copied ? <Check size={18} /> : <Copy size={18} />
              ) : null}
              <span>{channel.id === 'copy_link' && copied ? 'Copié !' : channel.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
