import React from 'react';
import { DashboardLayout } from '../dashboard/dashboard-layout';
import { TopHeader } from '@/components/layout/top-header';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { PartiesClientPage } from '@/components/parties/parties-client-page';
import { Party } from '@/types/party-data-types';
import { Crop } from '@/types/crop-data-types';
export const dynamic = 'force-dynamic';

export default async function PartiesPage() {
  const supabase = getSupabaseServerClient();

  const [partiesRes, cropsRes] = await Promise.all([
    supabase.from('parties').select('*').order('name', { ascending: true }),
    supabase.from('crops').select('*').order('name', { ascending: true }),
  ]);

  const parties: Party[] = partiesRes.data || [];
  const crops: Crop[] = cropsRes.data || [];

  return (
    <DashboardLayout>
      <TopHeader
        title="Parties & Crop Catalog"
        subtitle="Manage your suppliers, buyers, and crop types for purchase and sale transactions"
      />
      <PartiesClientPage initialParties={parties} initialCrops={crops} />
    </DashboardLayout>
  );
}
