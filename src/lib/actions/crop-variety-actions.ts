'use server';

import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';

export async function saveCropVariety(cropId: number, name: string) {
  if (!name.trim()) return { success: false, message: 'Variety name is required.' };
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('crop_varieties')
    .insert({ crop_id: cropId, name: name.trim() })
    .select()
    .single();
  if (error) return { success: false, message: error.message };
  return { success: true, data };
}

export async function deleteCropVariety(varietyId: number) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('crop_varieties').delete().eq('id', varietyId);
  if (error) return { success: false, message: error.message };
  return { success: true };
}
