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
