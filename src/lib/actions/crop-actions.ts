'use server';

import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';

export async function saveCrop(name: string) {
  if (!name || name.trim() === '') {
    return { success: false, message: 'Crop name is required.' };
  }

  const supabase = getSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from('crops')
      .insert({ name: name.trim() })
      .select()
      .single();

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to add crop.';
    return { success: false, message };
  }
}
