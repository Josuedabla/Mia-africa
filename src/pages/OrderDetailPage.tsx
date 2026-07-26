/**
 * OrderDetailPage
 *
 * Affiche le code OTP à donner au livreur (uniquement visible tant que la
 * livraison n'est pas confirmée), et une fois la commande 'delivered',
 * propose un formulaire d'avis par produit acheté. L'écriture de l'avis
 * est protégée côté serveur (RLS reviews_insert_if_purchased) - ce
 * composant se contente de refléter cet état, pas de le décider.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, KeyRound, Star } from 'lucide-react';
import { getOrderDetail } from '@/services/orders.service';
import { submitReview, getMyReviewForOrderItem } from '@/services/reviews.service';

function ReviewForm({ orderId, productId, productName }: { orderId: string; productId: string; productName: string }) {
  const { t } = useTranslation();
  const [existingReview, setExistingReview] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getMyReviewForOrderItem(orderId, productId)
      .then((review) => {
        if (review) {
          setExistingReview(review);
          setRating(review.rating);
          setComment(review.comment ?? '');
        }
      })
      .finally(() => setLoading(false));
  }, [orderId, productId]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitReview({ orderId, productId, rating, comment });
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  if (existingReview || submitted) {
    return (
      <div className="bg-gray-50 rounded-lg p-3 mt-2">
        <p className="text-sm font-medium text-gray-700 mb-1">{t('order_detail.your_review_on', { product: productName })}</p>
        <div className="flex gap-0.5 mb-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} size={16} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
          ))}
        </div>
        {comment && <p className="text-sm text-gray-600">{comment}</p>}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-3 mt-2">
      <p className="text-sm font-medium text-gray-700 mb-2">{t('order_detail.leave_review_on', { product: productName })}</p>
      <div className="flex gap-1 mb-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)}>
            <Star size={22} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t('order_detail.review_placeholder') as string}
        rows={2}
        className="w-full border border-gray-200 rounded-lg p-2 text-sm mb-2"
      />
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="bg-mia-green-600 hover:bg-mia-green-700 disabled:bg-gray-400 text-white text-sm font-semibold px-4 py-2 rounded-lg"
      >
        {submitting ? t('order_detail.sending') : t('order_detail.submit_review')}
      </button>
    </div>
  );
}

export default function OrderDetailPage() {
  const { t, i18n } = useTranslation();
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    getOrderDetail(orderId)
      .then(setOrder)
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-mia-green-600" size={32} />
      </div>
    );
  }

  if (!order) return <div className="text-center py-16 text-gray-500">{t('order_detail.not_found')}</div>;

  const delivery = Array.isArray(order.deliveries) ? order.deliveries[0] : order.deliveries;
  const isDelivered = order.status === 'delivered';

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">{order.shops?.name}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {t('order_detail.order_from', { date: new Date(order.created_at).toLocaleDateString(i18n.language) })}
      </p>

      {/* Code OTP - visible tant que la livraison n'est pas confirmée. Le
          client le communique au livreur en main propre à la remise. */}
      {delivery && delivery.status !== 'delivered' && delivery.otp_code && (
        <div className="bg-mia-green-50 border border-mia-green-200 rounded-xl p-4 mb-4 text-center">
          <div className="flex items-center justify-center gap-2 text-mia-green-700 mb-2">
            <KeyRound size={18} />
            <span className="text-sm font-medium">{t('order_detail.delivery_code_label')}</span>
          </div>
          <p className="text-3xl font-bold tracking-[0.3em] text-mia-green-800">{delivery.otp_code}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        {(order.order_items ?? []).map((item: any) => (
          <div key={item.id} className="border-b border-gray-100 last:border-b-0 pb-3 last:pb-0">
            <div className="flex justify-between text-sm text-gray-700 mb-1">
              <span>
                {item.quantity} × {item.products?.name}
              </span>
              <span>{item.subtotal?.toLocaleString()} XOF</span>
            </div>
            {isDelivered && item.products?.id && (
              <ReviewForm orderId={order.id} productId={item.products.id} productName={item.products.name} />
            )}
          </div>
        ))}
        <div className="flex justify-between font-bold text-gray-900 pt-2">
          <span>{t('order_detail.total')}</span>
          <span>{order.total?.toLocaleString()} XOF</span>
        </div>
      </div>
    </div>
  );
}
