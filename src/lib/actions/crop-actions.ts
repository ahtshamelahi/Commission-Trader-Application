'use server';

import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';

import { revalidatePath } from 'next/cache';

export async function saveCrop(name: string) {
  if (!name || name.trim() === '') {
    return { success: false, message: 'Crop name is required.' };
  }

  const supabase = await getSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from('crops')
      .insert({ name: name.trim() })
      .select()
      .single();

    if (error) {
      return { success: false, message: error.message };
    }

    revalidatePath('/purchases');
    revalidatePath('/parties');
    revalidatePath('/sales/new');
    revalidatePath('/stock');

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to add crop.';
    return { success: false, message };
  }
}

function revalidateCrops() {
  revalidatePath('/purchases');
  revalidatePath('/parties');
  revalidatePath('/sales/new');
  revalidatePath('/stock');
  revalidatePath('/crops');
}

export async function deleteCrop(cropId: number) {
  if (!Number.isInteger(cropId) || cropId <= 0) {
    return { success: false, message: 'Invalid crop.' };
  }
  const supabase = await getSupabaseServerClient();

  const { data: movements } = await supabase
    .from('stock_movements')
    .select('quantity_kg')
    .eq('crop_id', cropId);
  const stock = (movements || []).reduce((s, r) => s + Number(r.quantity_kg || 0), 0);
  if (Math.abs(stock) >= 0.005) {
    return { success: false, message: 'Cannot delete this crop while stock remains. Stock must be 0.' };
  }

  const { error: varErr } = await supabase.from('crop_varieties').delete().eq('crop_id', cropId);
  if (varErr) return { success: false, message: varErr.message };

  const { error } = await supabase.from('crops').delete().eq('id', cropId);
  if (error) {
    return {
      success: false,
      message: error.message.includes('foreign key') || error.code === '23503'
        ? 'Cannot delete this crop because it is used in purchases or sales. Stock is 0, but records still exist.'
        : error.message,
    };
  }
  revalidateCrops();
  return { success: true };
}
