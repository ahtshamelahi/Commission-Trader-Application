'use server';

import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { PartyType } from '@/types/party-data-types';
import { revalidatePath } from 'next/cache';

export async function saveParty(input: {
  id?: number;
  name: string;
  phone?: string;
  address?: string;
  party_type: PartyType;
}) {
  if (!input.name || input.name.trim() === '') {
    return { success: false, message: 'Party name is required.' };
  }

  const supabase = await getSupabaseServerClient();

  try {
    if (input.id) {
      // Update existing
      const { data, error } = await supabase
        .from('parties')
        .update({
          name: input.name.trim(),
          phone: input.phone || null,
          address: input.address || null,
          party_type: input.party_type,
        })
        .eq('id', input.id)
        .select()
        .single();

      if (error) return { success: false, message: error.message };
      revalidatePath('/parties');
      revalidatePath('/purchases');
      revalidatePath('/sales/new');
      revalidatePath('/khata/sales');
      revalidatePath('/khata/purchases');
      revalidatePath('/khata');
      return { success: true, data };
    } else {
      // Create new
      const { data, error } = await supabase
        .from('parties')
        .insert({
          name: input.name.trim(),
          phone: input.phone || null,
          address: input.address || null,
          party_type: input.party_type,
        })
        .select()
        .single();

      if (error) return { success: false, message: error.message };

      revalidatePath('/purchases');
      revalidatePath('/parties');
      revalidatePath('/crops');
      revalidatePath('/sales/new');
      revalidatePath('/sales/all');
      revalidatePath('/khata/sales');
      revalidatePath('/khata/purchases');
      revalidatePath('/khata');

      return { success: true, data };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save party.';
    return { success: false, message };
  }
}
