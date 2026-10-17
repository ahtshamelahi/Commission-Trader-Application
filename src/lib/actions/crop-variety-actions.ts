'use server';

import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';

import { revalidatePath } from 'next/cache';

export async function saveCropVariety(cropId: number, name: string) {
  if (!name.trim()) return { success: false, message: 'Variety name is required.' };
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('crop_varieties')
    .insert({ crop_id: cropId, name: name.trim() })
    .select()
    .single();
  if (error) return { success: false, message: error.message };

  revalidatePath('/purchases');
  revalidatePath('/parties');
  revalidatePath('/sales/new');
  revalidatePath('/stock');

  return { success: true, data };
}

export async function deleteCropVariety(varietyId: number) {
  const supabase = await getSupabaseServerClient();

  const { data: variety } = await supabase
    .from('crop_varieties')
    .select('id, crop_id')
    .eq('id', varietyId)
    .maybeSingle();
  if (!variety) return { success: false, message: 'Variety not found.' };

  const [{ data: purchases }, { data: sales }] = await Promise.all([
    supabase.from('purchases').select('gross_weight_kg').eq('crop_id', variety.crop_id).eq('variety_id', varietyId),
    supabase.from('sales').select('physical_weight_kg').eq('crop_id', variety.crop_id).eq('variety_id', varietyId),
  ]);
  const purchased = (purchases || []).reduce((s, r) => s + Number(r.gross_weight_kg || 0), 0);
  const sold = (sales || []).reduce((s, r) => s + Number(r.physical_weight_kg || 0), 0);
  if (Math.abs(purchased - sold) >= 0.005) {
    return { success: false, message: 'Cannot delete this variety while stock remains. Stock must be 0.' };
  }

  const { error } = await supabase.from('crop_varieties').delete().eq('id', varietyId);
  if (error) return { success: false, message: error.message };

  revalidatePath('/purchases');
  revalidatePath('/parties');
  revalidatePath('/sales/new');
  revalidatePath('/stock');

  return { success: true };
}
