'use server';

import { z } from 'zod';
import { UnauthenticatedError, runAction, type ActionResult } from '@/platform/actions';
import { getSessionUser } from '@/platform/auth/session';
import { neighborhoodsOfDistrict, type Neighborhood } from '@/modules/properties/taxonomy';

/** Yönetim paneli: seçilen ilçenin mahalleleri (referans veri, 1 saat önbellekli) */
export async function getDistrictNeighborhoods(districtId: number): Promise<ActionResult<Neighborhood[]>> {
  return runAction(async () => {
    if (!(await getSessionUser())) throw new UnauthenticatedError();
    return neighborhoodsOfDistrict(z.number().int().positive().parse(districtId));
  });
}
