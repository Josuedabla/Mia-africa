/**
 * MIA AI Description Generator + full product form.
 *
 * Vendor fills in name / raw notes / features / price / category / photos,
 * picks a tone, optional SEO keywords and special instructions, hits
 * "✨ Améliorer avec MIA AI" (calls generateProductListing Cloud
 * Function), reviews/edits the result in the WYSIWYG editor, and saves.
 * A live quality score (heuristic, no AI call) nudges them to improve
 * weak spots before publishing.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { createProduct, updateProduct, setProductSlug } from '@/services/db.service';
import { geminiService, type ProductTone } from '@/services/gemini.service';
import { sanitizeProductHtml } from '@/lib/sanitizeHtml';
import { computeQualityScore } from '@/lib/qualityScore';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { parseVideoUrl } from '@/components/MediaPlayer';
import SlugEditor from '@/components/SlugEditor';
import type { MyShop } from '@/hooks/useMyShop';
import { Sparkles, Loader2, Upload, X, Save } from 'lucide-react';

interface OutletCtx {
  shop: MyShop;
  userId: string;
}

const TONES: { value: ProductTone; labelKey: string }[] = [
  { value: 'professionnel', labelKey: 'vendor_product_form.tone_professional' },
  { value: 'premium', labelKey: 'vendor_product_form.tone_premium' },
  { value: 'persuasif', labelKey: 'vendor_product_form.tone_persuasive' },
  { value: 'simple', labelKey: 'vendor_product_form.tone_simple' },
  { value: 'luxe', labelKey: 'vendor_product_form.tone_luxury' },
  { value: 'tiktok-viral', labelKey: 'vendor_product_form.tone_tiktok' },
];

const CATEGORY_KEYS = ['fashion', 'electronics', 'beauty', 'home', 'food', 'other'] as const;
const CATEGORIES = ['Mode', 'Électronique', 'Beauté', 'Maison', 'Alimentation', 'Autre'];

type VariantAttrKey = 'couleur' | 'taille' | 'poids';
const VARIANT_ATTR_LABEL_KEYS: Record<VariantAttrKey, string> = {
  couleur: 'vendor_product_form.variant_color',
  taille: 'vendor_product_form.variant_size',
  poids: 'vendor_product_form.variant_weight',
};
const VARIANT_ATTR_KEYS: VariantAttrKey[] = ['couleur', 'taille', 'poids'];

interface VariantAttrState {
  enabled: boolean;
  values: string[];
  input: string;
}

function emptyVariantAttrs(): Record<VariantAttrKey, VariantAttrState> {
  return {
    couleur: { enabled: false, values: [], input: '' },
    taille: { enabled: false, values: [], input: '' },
    poids: { enabled: false, values: [], input: '' },
  };
}

/** Produit cartésien des valeurs des attributs activés, ex: [{couleur:'Rouge',taille:'M'}, ...]. */
function cartesianCombinations(
  attrs: Record<VariantAttrKey, VariantAttrState>
): Record<string, string>[] {
  const enabledKeys = VARIANT_ATTR_KEYS.filter((k) => attrs[k].enabled && attrs[k].values.length > 0);
  if (enabledKeys.length === 0) return [];
  return enabledKeys.reduce<Record<string, string>[]>(
    (acc, key) =>
      acc.flatMap((combo) => attrs[key].values.map((v) => ({ ...combo, [key]: v }))),
    [{}]
  );
}

function combinationKey(combo: Record<string, string>): string {
  return VARIANT_ATTR_KEYS.filter((k) => combo[k]).map((k) => `${k}:${combo[k]}`).join('|');
}

function combinationLabel(combo: Record<string, string>): string {
  return VARIANT_ATTR_KEYS.filter((k) => combo[k]).map((k) => combo[k]).join(' / ');
}

interface PhotoMeta {
  url: string;
  width: number;
  height: number;
}

function readImageMeta(file: File): Promise<{ width: number; height: number; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height, dataUrl: reader.result as string });
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function VendorProductForm() {
  const { shop } = useOutletContext<OutletCtx>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { productId } = useParams<{ productId?: string }>();
  const isEditing = Boolean(productId) && productId !== 'nouveau';

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState<number>(0);
  const [stock, setStock] = useState<number>(1);
  const [rawNotes, setRawNotes] = useState(''); // vendor's quick bullet notes
  const [tone, setTone] = useState<ProductTone>('professionnel');
  const [seoKeywordsInput, setSeoKeywordsInput] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  const [descriptionHtml, setDescriptionHtml] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);

  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [isAgeRestricted, setIsAgeRestricted] = useState(false);

  const [variantAttrs, setVariantAttrs] = useState<Record<VariantAttrKey, VariantAttrState>>(emptyVariantAttrs());
  const [variantStocks, setVariantStocks] = useState<Record<string, number>>({});

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEditing);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing || !productId) return;
    supabase
      .from('products')
      .select('*, product_media(url, width, height, position)')
      .eq('id', productId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setName(data.name ?? '');
        setSlug(data.slug ?? '');
        setCategory(data.category ?? CATEGORIES[0]);
        setPrice(data.price ?? 0);
        setStock(data.stock ?? 0);
        setDescriptionHtml(data.description ?? '');
        setSeoTitle(data.seo_title ?? '');
        setSeoDescription(data.seo_description ?? '');
        setKeywords(data.keywords ?? []);
        setVideoUrl(data.external_video_url ?? '');
        setIsAgeRestricted(Boolean(data.is_age_restricted));
        const media = (data.product_media ?? []).sort((a: any, b: any) => a.position - b.position);
        setPhotos(media.map((m: any) => ({ url: m.url, width: m.width ?? 1000, height: m.height ?? 1000 })));
        setLoadingExisting(false);
      });

    Promise.all([
      supabase.from('product_variant_attributes').select('attribute, values').eq('product_id', productId),
      supabase.from('product_variants').select('attributes, stock').eq('product_id', productId),
    ]).then(([{ data: attrRows }, { data: variantRows }]) => {
      if (attrRows && attrRows.length > 0) {
        const next = emptyVariantAttrs();
        for (const row of attrRows) {
          const key = row.attribute as VariantAttrKey;
          if (next[key]) next[key] = { enabled: true, values: row.values ?? [], input: '' };
        }
        setVariantAttrs(next);
      }
      if (variantRows && variantRows.length > 0) {
        const stocks: Record<string, number> = {};
        for (const row of variantRows) {
          stocks[combinationKey(row.attributes as Record<string, string>)] = row.stock ?? 0;
        }
        setVariantStocks(stocks);
      }
    });
  }, [isEditing, productId]);

  const combinations = useMemo(() => cartesianCombinations(variantAttrs), [variantAttrs]);
  const enabledVariantKeys = VARIANT_ATTR_KEYS.filter((k) => variantAttrs[k].enabled);
  const variantsEnabledCount = enabledVariantKeys.length;
  const incompleteVariantAttrKey = enabledVariantKeys.find((k) => variantAttrs[k].values.length === 0);
  const incompleteVariantAttribute = incompleteVariantAttrKey ? t(VARIANT_ATTR_LABEL_KEYS[incompleteVariantAttrKey]) : null;
  const variantsTotalStock = combinations.reduce((sum, combo) => sum + (variantStocks[combinationKey(combo)] ?? 0), 0);

  const toggleVariantAttr = (key: VariantAttrKey) => {
    setVariantAttrs((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));
  };

  const addVariantValue = (key: VariantAttrKey) => {
    setVariantAttrs((prev) => {
      const value = prev[key].input.trim();
      if (!value || prev[key].values.includes(value)) return { ...prev, [key]: { ...prev[key], input: '' } };
      return { ...prev, [key]: { ...prev[key], values: [...prev[key].values, value], input: '' } };
    });
  };

  const removeVariantValue = (key: VariantAttrKey, value: string) => {
    setVariantAttrs((prev) => ({ ...prev, [key]: { ...prev[key], values: prev[key].values.filter((v) => v !== value) } }));
  };

  const featureList = useMemo(
    () => rawNotes.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 20),
    [rawNotes]
  );

  const qualityScore = useMemo(
    () =>
      computeQualityScore({
        title: name,
        descriptionHtml,
        seoTitle,
        seoDescription,
        keywords,
        photos: photos.map((p) => ({ width: p.width, height: p.height })),
        price,
      }),
    [name, descriptionHtml, seoTitle, seoDescription, keywords, photos, price]
  );

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingPhotos(true);
    setError(null);
    try {
      const newPhotos: PhotoMeta[] = [];
      for (const file of Array.from(files).slice(0, 6 - photos.length)) {
        const meta = await readImageMeta(file);
        // Path is <shop_id>/<filename> - the bucket is 'products' itself,
        // and the storage RLS policy checks (storage.foldername(name))[1]
        // == shop_id, so the shop id must be the first path segment.
        const path = `${shop.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from('products').upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        const { data: publicUrl } = supabase.storage.from('products').getPublicUrl(path);
        newPhotos.push({ url: publicUrl.publicUrl, width: meta.width, height: meta.height });
      }
      setPhotos((prev) => [...prev, ...newPhotos]);
    } catch (err: any) {
      setError(err.message ?? t('vendor_product_form.photo_upload_error'));
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleGenerate = async () => {
    if (!name || !category || !price) {
      setError(t('vendor_product_form.generate_missing_fields'));
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const result = await geminiService.generateProductListing({
        productName: name,
        category,
        price,
        features: featureList,
        tone,
        seoKeywords: seoKeywordsInput.split(',').map((k) => k.trim()).filter(Boolean),
        specialInstructions,
        country: shop.country_code,
      });
      setDescriptionHtml(sanitizeProductHtml(result.descriptionHtml));
      setSeoTitle(result.seoTitle);
      setSeoDescription(result.seoDescription);
      setKeywords(result.keywords);
    } catch (err: any) {
      setError(err.message ?? t('vendor_product_form.generate_error'));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (status: 'draft' | 'active') => {
    if (!name || !price) {
      setError(t('vendor_product_form.required_fields'));
      return;
    }
    const trimmedVideoUrl = videoUrl.trim();
    if (trimmedVideoUrl && !parseVideoUrl(trimmedVideoUrl).platform) {
      setError(t('vendor_product_form.invalid_video_url'));
      return;
    }
    if (variantsEnabledCount > 0 && incompleteVariantAttribute) {
      setError(t('vendor_product_form.incomplete_variant_error', { attribute: incompleteVariantAttribute }));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        shop_id: shop.id,
        name,
        category,
        price,
        currency: 'FCFA',
        stock: variantsEnabledCount > 0 ? variantsTotalStock : stock,
        country_code: shop.country_code,
        description: sanitizeProductHtml(descriptionHtml),
        seo_title: seoTitle,
        seo_description: seoDescription,
        keywords,
        status,
        ai_generated: Boolean(descriptionHtml),
        quality_score: qualityScore.overall,
        external_video_url: trimmedVideoUrl || null,
        has_variants: variantsEnabledCount > 0,
        is_age_restricted: isAgeRestricted,
      };

      let savedProductId = productId;
      if (isEditing && productId) {
        await updateProduct(productId, payload);
      } else {
        const created = await createProduct(payload);
        savedProductId = created.id;
      }

      // product_media is a separate table - replace wholesale on save
      // (simplest correct approach; a future optimization could diff
      // instead of delete+reinsert).
      if (savedProductId) {
        await supabase.from('product_media').delete().eq('product_id', savedProductId);
        if (photos.length > 0) {
          await supabase.from('product_media').insert(
            photos.map((p, i) => ({
              product_id: savedProductId,
              media_type: 'image',
              url: p.url,
              position: i,
              width: p.width,
              height: p.height,
            }))
          );
        }
      }

      // Attributs + combinaisons de variantes - même approche "remplacer
      // entièrement" que product_media : plus simple et sans risque
      // d'incohérence qu'un diff, pour un formulaire qui se soumet en
      // entier à chaque sauvegarde.
      if (savedProductId) {
        await supabase.from('product_variant_attributes').delete().eq('product_id', savedProductId);
        await supabase.from('product_variants').delete().eq('product_id', savedProductId);
        if (variantsEnabledCount > 0) {
          await supabase.from('product_variant_attributes').insert(
            enabledVariantKeys.map((key) => ({
              product_id: savedProductId,
              attribute: key,
              values: variantAttrs[key].values,
            }))
          );
          if (combinations.length > 0) {
            await supabase.from('product_variants').insert(
              combinations.map((combo) => ({
                product_id: savedProductId,
                attributes: combo,
                stock: variantStocks[combinationKey(combo)] ?? 0,
              }))
            );
          }
        }
      }

      navigate('/vendeur/produits');
    } catch (err: any) {
      if (err.message?.includes('PROHIBITED_PRODUCT_CONTENT')) {
        setError(t('vendor_product_form.prohibited_content_error'));
      } else {
        setError(err.message ?? t('vendor_product_form.save_error'));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadingExisting) return <p className="text-gray-400 text-sm">{t('common.loading')}</p>;

  return (
    <div className="space-y-6 pb-24">
      <h1 className="text-2xl font-bold text-gray-900">
        {isEditing ? t('vendor_product_form.edit_title') : t('vendor_product_form.new_title')}
      </h1>

      {isEditing && productId && (
        <SlugEditor
          value={slug}
          baseUrl="mia.africa/produit/"
          placeholder={productId}
          onSave={async (newSlug) => {
            const confirmed = await setProductSlug(productId, newSlug);
            setSlug(confirmed);
            return confirmed;
          }}
        />
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: base info + photos + AI assistant */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-900">{t('vendor_product_form.section_info')}</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('vendor_product_form.product_name')}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('vendor_product_form.product_name_placeholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mia-green-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('vendor_product_form.category')}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none"
                >
                  {CATEGORIES.map((c, i) => <option key={c} value={c}>{t(`vendor_product_form.category_${CATEGORY_KEYS[i]}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('vendor_product_form.price')}</label>
                <input
                  type="number"
                  min={0}
                  value={price || ''}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('vendor_product_form.stock_available')}</label>
              {variantsEnabledCount > 0 ? (
                <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-gray-500">
                  {t('vendor_product_form.stock_from_variants', { count: variantsTotalStock })}
                </div>
              ) : (
                <input
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('vendor_product_form.quick_notes')}
              </label>
              <textarea
                value={rawNotes}
                onChange={(e) => setRawNotes(e.target.value)}
                rows={4}
                placeholder={t('vendor_product_form.quick_notes_placeholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none resize-none"
              />
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <h2 className="font-bold text-gray-900">{t('vendor_product_form.variants_title')}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('vendor_product_form.variants_help')}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {VARIANT_ATTR_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleVariantAttr(key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                    variantAttrs[key].enabled
                      ? 'bg-mia-green-600 text-white border-mia-green-600'
                      : 'bg-white text-gray-600 border-gray-300'
                  }`}
                >
                  {t(VARIANT_ATTR_LABEL_KEYS[key])}
                </button>
              ))}
            </div>

            {enabledVariantKeys.map((key) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('vendor_product_form.variant_values_for', { attribute: t(VARIANT_ATTR_LABEL_KEYS[key]) })}
                </label>
                <div className="flex gap-2">
                  <input
                    value={variantAttrs[key].input}
                    onChange={(e) =>
                      setVariantAttrs((prev) => ({ ...prev, [key]: { ...prev[key], input: e.target.value } }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addVariantValue(key);
                      }
                    }}
                    placeholder={
                      key === 'couleur' ? t('vendor_product_form.variant_color_placeholder') : key === 'taille' ? t('vendor_product_form.variant_size_placeholder') : t('vendor_product_form.variant_weight_placeholder')
                    }
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => addVariantValue(key)}
                    className="px-4 py-2 rounded-lg border border-gray-300 font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {t('vendor_product_form.add')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {variantAttrs[key].values.map((v) => (
                    <span key={v} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full flex items-center gap-1">
                      {v}
                      <button type="button" onClick={() => removeVariantValue(key, v)}>
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  {variantAttrs[key].values.length === 0 && (
                    <span className="text-xs text-amber-600">{t('vendor_product_form.variant_no_values')}</span>
                  )}
                </div>
              </div>
            ))}

            {combinations.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('vendor_product_form.stock_per_combination', { count: combinations.length })}
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {combinations.map((combo) => {
                    const key = combinationKey(combo);
                    return (
                      <div key={key} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-gray-700">{combinationLabel(combo)}</span>
                        <input
                          type="number"
                          min={0}
                          value={variantStocks[key] ?? 0}
                          onChange={(e) =>
                            setVariantStocks((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                          }
                          className="w-24 border border-gray-300 rounded-lg px-2 py-1 outline-none text-right"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-gray-900">{t('vendor_product_form.photos_title', { count: photos.length })}</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {photos.map((photo, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {photos.length < 6 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-mia-green-400 hover:text-mia-green-600">
                  {uploadingPhotos ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                  <span className="text-[11px] mt-1">{t('vendor_product_form.add')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e.target.files)}
                  />
                </label>
              )}
            </div>
            <div className="pt-2 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('vendor_product_form.video_url_label')}
              </label>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder={t('vendor_product_form.video_url_placeholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-mia-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                {t('vendor_product_form.video_url_help')}
              </p>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={isAgeRestricted}
                  onChange={(e) => setIsAgeRestricted(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  {t('vendor_product_form.age_restricted_label')}
                </span>
              </label>
            </div>
          </section>

          <section className="bg-mia-green-50 border border-mia-green-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="text-mia-green-600" size={20} />
              <h2 className="font-bold text-gray-900">{t('vendor_product_form.ai_assistant_title')}</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('vendor_product_form.tone_label')}</label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((toneOption) => (
                  <button
                    key={toneOption.value}
                    type="button"
                    onClick={() => setTone(toneOption.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                      tone === toneOption.value
                        ? 'bg-mia-green-600 text-white border-mia-green-600'
                        : 'bg-white text-gray-600 border-gray-300'
                    }`}
                  >
                    {t(toneOption.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('vendor_product_form.seo_keywords_label')}</label>
              <input
                value={seoKeywordsInput}
                onChange={(e) => setSeoKeywordsInput(e.target.value)}
                placeholder={t('vendor_product_form.seo_keywords_placeholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('vendor_product_form.special_instructions_label')}</label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                rows={2}
                placeholder={t('vendor_product_form.special_instructions_placeholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none resize-none"
              />
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-60 text-white font-bold py-3 rounded-lg"
            >
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {generating ? t('vendor_product_form.generating') : t('vendor_product_form.generate_button')}
            </button>
          </section>

          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-gray-900">{t('vendor_product_form.description_title')}</h2>
            <RichTextEditor value={descriptionHtml} onChange={setDescriptionHtml} />
          </section>

          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-gray-900">{t('vendor_product_form.seo_title')}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('vendor_product_form.seo_title_label')}</label>
              <input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                maxLength={70}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('vendor_product_form.seo_meta_label')}</label>
              <textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                maxLength={170}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none resize-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {keywords.map((k, i) => (
                <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full flex items-center gap-1">
                  {k}
                  <button type="button" onClick={() => setKeywords((prev) => prev.filter((_, idx) => idx !== i))}>
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          </section>
        </div>

        {/* Right column: live quality score */}
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sticky top-4">
            <h2 className="font-bold text-gray-900 mb-3">{t('vendor_product_form.quality_score_title')}</h2>
            <div className="text-center mb-4">
              <p className="text-4xl font-extrabold text-mia-green-600">{qualityScore.overall}</p>
              <p className="text-xs text-gray-400">/ 100</p>
            </div>
            <div className="space-y-2 mb-4">
              {[
                { labelKey: 'vendor_product_form.score_photos', value: qualityScore.photos },
                { labelKey: 'vendor_product_form.score_title', value: qualityScore.title },
                { labelKey: 'vendor_product_form.score_description', value: qualityScore.description },
                { labelKey: 'vendor_product_form.score_seo', value: qualityScore.seo },
              ].map((row) => (
                <div key={row.labelKey}>
                  <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                    <span>{t(row.labelKey)}</span>
                    <span>{row.value}/100</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-mia-green-500 rounded-full"
                      style={{ width: `${row.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {qualityScore.tips.length > 0 && (
              <ul className="space-y-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
                {qualityScore.tips.map((tip, i) => (
                  <li key={i}>💡 {t(tip.key, tip.params)}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div className="fixed bottom-16 md:bottom-0 inset-x-0 bg-white border-t border-gray-200 px-4 py-3 flex justify-end gap-3 z-10">
        <button
          type="button"
          onClick={() => handleSave('draft')}
          disabled={saving}
          className="px-4 py-2.5 rounded-lg border border-gray-300 font-semibold text-gray-700 disabled:opacity-60"
        >
          {t('vendor_product_form.save_draft')}
        </button>
        <button
          type="button"
          onClick={() => handleSave('active')}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-60 text-white font-semibold"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {t('vendor_product_form.publish')}
        </button>
      </div>
    </div>
  );
}
