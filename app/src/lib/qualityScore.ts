/**
 * Product listing quality score - pure heuristics, no AI call, so it can
 * run live on every keystroke in the vendor product form without cost or
 * latency. Mirrors the "MIA Coach" idea from the recommendations doc:
 * "Votre produit a 87/100. Ajoutez une vidéo pour augmenter vos chances
 * de vente."
 */

export interface QualityScoreInput {
  title: string;
  descriptionHtml: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  photos: { width: number; height: number }[];
  price: number;
}

export interface QualityScoreBreakdown {
  photos: number;
  title: number;
  description: number;
  seo: number;
  overall: number;
  tips: string[];
}

function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function scorePhotos(photos: QualityScoreInput['photos']): { score: number; tips: string[] } {
  const tips: string[] = [];
  let score = 0;

  if (photos.length === 0) {
    tips.push("Ajoutez au moins une photo - une fiche sans photo est presque invisible pour les clients.");
    return { score: 0, tips };
  }

  // up to 60 pts for quantity (aim for 4+ photos), up to 40 pts for resolution
  const quantityScore = Math.min(photos.length / 4, 1) * 60;
  if (photos.length < 4) {
    tips.push(`Ajoutez ${4 - photos.length} photo(s) de plus (idéal : 4 à 6 angles différents).`);
  }

  const lowRes = photos.filter((p) => p.width < 800 || p.height < 800);
  const resolutionScore = ((photos.length - lowRes.length) / photos.length) * 40;
  if (lowRes.length > 0) {
    tips.push(`${lowRes.length} photo(s) ont une résolution faible (< 800px) - utilisez des images plus nettes.`);
  }

  score = Math.round(quantityScore + resolutionScore);
  return { score, tips };
}

function scoreTitle(title: string): { score: number; tips: string[] } {
  const tips: string[] = [];
  const len = title.trim().length;
  let score = 0;

  if (len === 0) {
    tips.push('Ajoutez un titre de produit.');
    return { score: 0, tips };
  }
  if (len < 15) {
    score = 40;
    tips.push('Titre trop court : décrivez le produit plus précisément (marque, modèle, couleur...).');
  } else if (len > 80) {
    score = 60;
    tips.push('Titre trop long : gardez l\'essentiel, sous 80 caractères.');
  } else {
    score = 100;
  }
  return { score, tips };
}

function scoreDescription(html: string): { score: number; tips: string[] } {
  const tips: string[] = [];
  const text = plainText(html);
  const words = text.length ? text.split(' ').length : 0;
  let score = 0;

  if (words === 0) {
    tips.push("Ajoutez une description - utilisez le bouton ✨ MIA AI pour en générer une en quelques secondes.");
    return { score: 0, tips };
  }

  if (words < 40) {
    score = 40;
    tips.push('Description trop courte : visez 100 à 200 mots pour rassurer l\'acheteur.');
  } else if (words > 300) {
    score = 70;
    tips.push('Description longue : gardez l\'essentiel, les clients lisent surtout les 2 premières lignes.');
  } else {
    score = 100;
  }

  const hasList = /<ul>|<ol>/.test(html);
  if (!hasList) {
    score = Math.max(0, score - 15);
    tips.push('Ajoutez une liste de caractéristiques (plus facile à scanner sur mobile).');
  }

  return { score: Math.round(score), tips };
}

function scoreSeo(seoTitle: string, seoDescription: string, keywords: string[]): { score: number; tips: string[] } {
  const tips: string[] = [];
  let score = 0;

  if (!seoTitle) tips.push('Ajoutez un titre SEO (affiché dans les résultats Google).');
  else score += 30;

  if (!seoDescription) tips.push('Ajoutez une meta description SEO (max 155 caractères).');
  else score += 30;

  if (keywords.length === 0) tips.push('Ajoutez au moins 3 mots-clés de recherche.');
  else score += Math.min(keywords.length / 5, 1) * 40;

  return { score: Math.round(score), tips };
}

export function computeQualityScore(input: QualityScoreInput): QualityScoreBreakdown {
  const photos = scorePhotos(input.photos);
  const title = scoreTitle(input.title);
  const description = scoreDescription(input.descriptionHtml);
  const seo = scoreSeo(input.seoTitle, input.seoDescription, input.keywords);

  // Weighted like the audit's product quality bar: photos & description
  // matter most for conversion.
  const overall = Math.round(
    photos.score * 0.3 + title.score * 0.15 + description.score * 0.35 + seo.score * 0.2
  );

  const tips = [...photos.tips, ...title.tips, ...description.tips, ...seo.tips].slice(0, 4);
  if (input.price <= 0) tips.unshift('Renseignez un prix valide.');

  return {
    photos: photos.score,
    title: title.score,
    description: description.score,
    seo: seo.score,
    overall,
    tips,
  };
}
