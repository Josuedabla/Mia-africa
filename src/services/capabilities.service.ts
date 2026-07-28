/**
 * Capability requests - one MIA account, several possible capabilities
 * (buyer/creator/seller/driver/wallet), instead of the old single `role`
 * field. Each method calls a SECURITY DEFINER RPC that keeps the
 * matching profile table (seller_profiles/delivery_profiles/
 * creator_profiles) and user_capabilities row in sync atomically.
 */
import { supabase } from '@/lib/supabase';

class CapabilitiesService {
  /** Self-serve - a shop is created immediately, matching today's UX. */
  async becomeSeller(params: { shopName: string; category: string; country: string; phone: string; legalCertificationAccepted: boolean }) {
    const { data, error } = await supabase.rpc('become_seller', {
      p_shop_name: params.shopName,
      p_category: params.category,
      p_country: params.country,
      p_phone: params.phone,
      p_legal_certification_accepted: params.legalCertificationAccepted,
    });
    if (error) throw error;
    return data as { shop_id: string; slug: string };
  }

  /** Requires admin approval - status starts 'pending'. */
  async requestDriverCapability(params: { vehicleType: string; zone: string }) {
    const { error } = await supabase.rpc('request_driver_capability', {
      p_vehicle_type: params.vehicleType,
      p_zone: params.zone,
    });
    if (error) throw error;
    return { ok: true as const };
  }

  /** Self-serve - posting content shouldn't need approval. */
  async enableCreatorCapability() {
    const { error } = await supabase.rpc('enable_creator_capability');
    if (error) throw error;
    return { ok: true as const };
  }

  /** Admin-only - approves a pending driver request. */
  async approveDriverCapability(userId: string) {
    const { error } = await supabase.rpc('approve_driver_capability', { p_user_id: userId });
    if (error) throw error;
    return { ok: true as const };
  }
}

export const capabilitiesService = new CapabilitiesService();
export default CapabilitiesService;
