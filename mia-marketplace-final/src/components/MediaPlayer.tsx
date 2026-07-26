/**
 * MediaPlayer
 *
 * Partie 4 du plan de croissance ("lecteur vidéo YouTube/TikTok/Vimeo") -
 * jamais construite jusqu'ici (confirmé par l'audit : aucune trace de
 * MediaPlayer.tsx, aucune colonne pour stocker le lien). On ne
 * réhéberge aucune vidéo : le vendeur colle un lien YouTube, TikTok ou
 * Vimeo (products.external_video_url, migration 20260721000025), et ce
 * composant se contente de l'embarquer proprement.
 *
 * Deux usages :
 *  - mode="full" (fiche produit) : vignette + bouton play, l'iframe ne
 *    se charge qu'au clic (pas de poids ni de lecture surprise).
 *  - mode="hoverPreview" (cartes du flux, Partie 3.5 "prévisualisation
 *    vidéo au survol") : contrôlé par le parent via la prop `active`
 *    (true pendant le survol) - montée/démontée à chaque entrée/sortie
 *    de la souris pour ne jamais laisser une vidéo tourner en arrière-plan.
 */
import React, { useMemo, useState } from 'react';
import { Play } from 'lucide-react';

type Platform = 'youtube' | 'tiktok' | 'vimeo';

interface ParsedVideo {
  platform: Platform | null;
  embedUrl: string | null;
}

export function parseVideoUrl(url: string): ParsedVideo {
  if (!url) return { platform: null, embedUrl: null };

  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/
  );
  if (youtubeMatch) {
    return { platform: 'youtube', embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}` };
  }

  const tiktokMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  if (tiktokMatch) {
    return { platform: 'tiktok', embedUrl: `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}` };
  }

  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return { platform: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }

  return { platform: null, embedUrl: null };
}

interface MediaPlayerProps {
  url: string;
  mode?: 'full' | 'hoverPreview';
  /** Uniquement pour mode="hoverPreview" : le parent pilote play/pause en montant/démontant l'iframe via ce flag. */
  active?: boolean;
  poster?: string;
  className?: string;
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({ url, mode = 'full', active = true, poster, className }) => {
  const { platform, embedUrl } = useMemo(() => parseVideoUrl(url), [url]);
  const [playing, setPlaying] = useState(mode === 'hoverPreview');

  if (!platform || !embedUrl) {
    // Lien non reconnu (ni YouTube ni TikTok) : on ne tente pas
    // d'embarquer n'importe quelle iframe arbitraire, on renvoie un
    // simple lien externe plutôt que de casser la page.
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 text-sm text-mia-green-700 bg-mia-green-50 border border-mia-green-200 rounded-lg py-3"
        onClick={(e) => e.stopPropagation()}
      >
        ▶️ Voir la vidéo
      </a>
    );
  }

  if (mode === 'hoverPreview') {
    if (!active) {
      return poster ? (
        <img src={poster} alt="" className={className ?? 'w-full h-full object-cover'} />
      ) : (
        <div className={className ?? 'w-full h-full bg-gray-100'} />
      );
    }
    const src =
      platform === 'vimeo'
        ? `${embedUrl}?autoplay=1&muted=1&loop=1&controls=0&background=1`
        : `${embedUrl}?autoplay=1&mute=1&controls=0&loop=1&playsinline=1&rel=0&modestbranding=1${
            platform === 'youtube' ? '&playlist=' + embedUrl.split('/').pop() : ''
          }`;
    return (
      <iframe
        src={src}
        className={className ?? 'w-full h-full object-cover'}
        title="Aperçu vidéo produit"
        allow="autoplay; encrypted-media; picture-in-picture"
        frameBorder={0}
        loading="lazy"
      />
    );
  }

  // mode="full" - vignette cliquable avant de charger réellement l'iframe.
  if (!playing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setPlaying(true);
        }}
        className={`relative flex items-center justify-center bg-black ${className ?? 'w-full aspect-video'}`}
      >
        {poster && <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />}
        <span className="relative z-10 w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
          <Play size={24} className="text-mia-green-600 ml-1" fill="currentColor" />
        </span>
        <span className="absolute bottom-2 right-2 text-[10px] font-bold text-white bg-black/60 rounded px-2 py-0.5">
          {platform === 'youtube' ? 'YouTube' : platform === 'tiktok' ? 'TikTok' : 'Vimeo'}
        </span>
      </button>
    );
  }

  return (
    <iframe
      src={`${embedUrl}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
      className={className ?? 'w-full aspect-video'}
      title="Vidéo produit"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
      frameBorder={0}
    />
  );
};

export default MediaPlayer;
