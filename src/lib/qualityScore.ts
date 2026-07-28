/**
 * Product listing quality score - pure heuristics, no AI call, so it can
 * run live on every keystroke in the vendor product form without cost or
 * latency. Mirrors the "MIA Coach" idea from the recommendations doc:
 * "Votre produit a 87/100. Ajoutez une vidéo pour augmenter vos chances
 * de vente."
 *
 * This module has no access to react-i18next (it's a plain function, not
 * a component), so tips are returned as translation keys + params rather
 * than final text - the calling component (VendorProductForm) resolves
 * them with t().
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

export interface QualityScoreTip {
  key: string;
  params?: Record<string, string | number>;
}

export interface QualityScoreBreakdown {
  photos: number;
  title: number;
  description: number;
  seo: number;
  overall: number;
  tips: QualityScoreTip[];
}

function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function scorePhotos(photos: QualityScoreInput['photos']): { score: number; tips: QualityScoreTip[] } {
  const tips: QualityScoreTip[] = [];
  let score = 0;

  if (photos.length === 0) {
    tips.push({ key: 'quality_score.tip_no_photos' });
    return { score: 0, tips };
  }

  // up to 60 pts for quantity (aim for 4+ photos), up to 40 pts for resolution
  const quantityScore = Math.min(photos.length / 4, 1) * 60;
  if (photos.length < 4) {
    tips.push({ key: 'quality_score.tip_more_photos', params: { count: 4 - photos.length } });
  }

  const lowRes = photos.filter((p) => p.width < 800 || p.height < 800);
  const resolutionScore = ((photos.length - lowRes.length) / photos.length) * 40;
  if (lowRes.length > 0) {
    tips.push({ key: 'quality_score.tip_low_res', params: { count: lowRes.length } });
  }

  score = Math.round(quantityScore + resolutionScore);
  return { score, tips };
}

function scoreTitle(title: string): { score: number; tips: QualityScoreTip[] } {
  const tips: QualityScoreTip[] = [];
  const len = title.trim().length;
  let score = 0;

  if (len === 0) {
    tips.push({ key: 'quality_score.tip_no_title' });
    return { score: 0, tips };
  }
  if (len < 15) {
    score = 40;
    tips.push({ key: 'quality_score.tip_title_too_short' });
  } else if (len > 80) {
    score = 60;
    tips.push({ key: 'quality_score.tip_title_too_long' });
  } else {
    score = 100;
  }
  return { score, tips };
}

function scoreDescription(html: string): { score: number; tips: QualityScoreTip[] } {
  const tips: QualityScoreTip[] = [];
  const text = plainText(html);
  const words = text.length ? text.split(' ').length : 0;
  let score = 0;

  if (words === 0) {
    tips.push({ key: 'quality_score.tip_no_description' });
    return { score: 0, tips };
  }

  if (words < 40) {
    score = 40;
    tips.push({ key: 'quality_score.tip_description_too_short' });
  } else if (words > 300) {
    score = 70;
    tips.push({ key: 'quality_score.tip_description_too_long' });
  } else {
    score = 100;
  }

  const hasList = /<ul>|<ol>/.test(html);
  if (!hasList) {
    score = Math.max(0, score - 15);
    tips.push({ key: 'quality_score.tip_add_list' });
  }

  return { score: Math.round(score), tips };
}

function scoreSeo(seoTitle: string, seoDescription: string, keywords: string[]): { score: number; tips: QualityScoreTip[] } {
  const tips: QualityScoreTip[] = [];
  let score = 0;

  if (!seoTitle) tips.push({ key: 'quality_score.tip_seo_title' });
  else score += 30;

  if (!seoDescription) tips.push({ key: 'quality_score.tip_seo_description' });
  else score += 30;

  if (keywords.length === 0) tips.push({ key: 'quality_score.tip_seo_keywords' });
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
  if (input.price <= 0) tips.unshift({ key: 'quality_score.tip_invalid_price' });

  return {
    photos: photos.score,
    title: title.score,
    description: description.score,
    seo: seo.score,
    overall,
    tips,
  };
}
