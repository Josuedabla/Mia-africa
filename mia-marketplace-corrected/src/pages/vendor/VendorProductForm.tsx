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
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import firestoreService from '@/services/firestore.service';
import { geminiService, type ProductTone } from '@/services/gemini.service';
import { sanitizeProductHtml } from '@/lib/sanitizeHtml';
import { computeQualityScore } from '@/lib/qualityScore';
import RichTextEditor from '@/components/editor/RichTextEditor';
import type { VendorShop } from '@/hooks/useVendorShop';
import { Sparkles, Loader2, Upload, X, Save } from 'lucide-react';

interface OutletCtx {
  shop: VendorShop;
  userId: string;
}

const TONES: { value: ProductTone; label: string }[] = [
  { value: 'professionnel', label: 'Professionnel' },
  { value: 'premium', label: 'Premium' },
  { value: 'persuasif', label: 'Persuasif' },
  { value: 'simple', label: 'Simple' },
  { value: 'luxe', label: 'Luxe' },
  { value: 'tiktok-viral', label: 'TikTok viral' },
];

const CATEGORIES = ['Mode', 'Électronique', 'Beauté', 'Maison', 'Alimentation', 'Autre'];

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
  const navigate = useNavigate();
  const { productId } = useParams<{ productId?: string }>();
  const isEditing = Boolean(productId) && productId !== 'nouveau';

  const [name, setName] = useState('');
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

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEditing);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing || !productId) return;
    getDoc(doc(db, 'products', productId)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      setName(data.name ?? '');
      setCategory(data.category ?? CATEGORIES[0]);
      setPrice(data.price ?? 0);
      setStock(data.stock ?? 0);
      setDescriptionHtml(data.description ?? '');
      setSeoTitle(data.seoTitle ?? '');
      setSeoDescription(data.seoDescription ?? '');
      setKeywords(data.keywords ?? []);
      setPhotos((data.images ?? []).map((url: string) => ({ url, width: 1000, height: 1000 })));
      setLoadingExisting(false);
    });
  }, [isEditing, productId]);

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
        const path = `products/${shop.id}/${Date.now()}-${file.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file, { contentType: file.type });
        const url = await getDownloadURL(storageRef);
        newPhotos.push({ url, width: meta.width, height: meta.height });
      }
      setPhotos((prev) => [...prev, ...newPhotos]);
    } catch (err: any) {
      setError(err.message ?? "Échec de l'envoi des photos.");
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleGenerate = async () => {
    if (!name || !category || !price) {
      setError('Renseignez au moins le nom, la catégorie et le prix avant de lancer MIA AI.');
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
        country: shop.country,
      });
      setDescriptionHtml(sanitizeProductHtml(result.descriptionHtml));
      setSeoTitle(result.seoTitle);
      setSeoDescription(result.seoDescription);
      setKeywords(result.keywords);
    } catch (err: any) {
      setError(err.message ?? "L'assistant IA n'a pas pu générer la fiche. Réessayez.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (status: 'draft' | 'active') => {
    if (!name || !price) {
      setError('Le nom et le prix sont obligatoires.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        shopId: shop.id,
        shopName: shop.name,
        name,
        category,
        price,
        currency: 'FCFA',
        stock,
        country: shop.country,
        description: sanitizeProductHtml(descriptionHtml),
        seoTitle,
        seoDescription,
        keywords,
        images: photos.map((p) => p.url),
        status,
        aiGenerated: Boolean(descriptionHtml),
        qualityScore: { overall: qualityScore.overall, updatedAt: serverTimestamp() },
      };

      if (isEditing && productId) {
        await firestoreService.updateDocument('products', productId, payload);
      } else {
        await firestoreService.createDocument('products', payload);
      }
      navigate('/vendeur/produits');
    } catch (err: any) {
      setError(err.message ?? "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingExisting) return <p className="text-gray-400 text-sm">Chargement...</p>;

  return (
    <div className="space-y-6 pb-24">
      <h1 className="text-2xl font-bold text-gray-900">
        {isEditing ? 'Modifier le produit' : 'Nouveau produit'}
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: base info + photos + AI assistant */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-900">Informations produit</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du produit</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : Chaussure Nike homme"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-mia-green-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix (FCFA)</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock disponible</label>
              <input
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes rapides (une caractéristique par ligne)
              </label>
              <textarea
                value={rawNotes}
                onChange={(e) => setRawNotes(e.target.value)}
                rows={4}
                placeholder={'Couleur noire\nTaille 40-45\nPour sport et sortie'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none resize-none"
              />
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-gray-900">Photos ({photos.length}/6)</h2>
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
                  <span className="text-[11px] mt-1">Ajouter</span>
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
          </section>

          <section className="bg-mia-green-50 border border-mia-green-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="text-mia-green-600" size={20} />
              <h2 className="font-bold text-gray-900">Assistant MIA AI</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ton</label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTone(t.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                      tone === t.value
                        ? 'bg-mia-green-600 text-white border-mia-green-600'
                        : 'bg-white text-gray-600 border-gray-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mots-clés SEO (séparés par des virgules)</label>
              <input
                value={seoKeywordsInput}
                onChange={(e) => setSeoKeywordsInput(e.target.value)}
                placeholder="chaussure homme, basket sport, Nike Lomé"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instructions spéciales (optionnel)</label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                rows={2}
                placeholder="Adapte aux jeunes africains, ajoute des emojis, mets en avant la livraison rapide"
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
              {generating ? 'Génération en cours...' : '✨ Améliorer avec MIA AI'}
            </button>
          </section>

          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-gray-900">Description</h2>
            <RichTextEditor value={descriptionHtml} onChange={setDescriptionHtml} />
          </section>

          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-gray-900">Référencement (SEO)</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre SEO</label>
              <input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                maxLength={70}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meta description</label>
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
            <h2 className="font-bold text-gray-900 mb-3">Score qualité de la fiche</h2>
            <div className="text-center mb-4">
              <p className="text-4xl font-extrabold text-mia-green-600">{qualityScore.overall}</p>
              <p className="text-xs text-gray-400">/ 100</p>
            </div>
            <div className="space-y-2 mb-4">
              {[
                { label: 'Photos', value: qualityScore.photos },
                { label: 'Titre', value: qualityScore.title },
                { label: 'Description', value: qualityScore.description },
                { label: 'SEO', value: qualityScore.seo },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                    <span>{row.label}</span>
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
                  <li key={i}>💡 {tip}</li>
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
          Enregistrer en brouillon
        </button>
        <button
          type="button"
          onClick={() => handleSave('active')}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-mia-green-600 hover:bg-mia-green-700 disabled:opacity-60 text-white font-semibold"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Publier
        </button>
      </div>
    </div>
  );
}
