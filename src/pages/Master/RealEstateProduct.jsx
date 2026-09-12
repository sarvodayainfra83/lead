import React from 'react';
import { Building2 } from 'lucide-react';
import SimpleTextMaster from './SimpleTextMaster';
import { masterApi } from '../../api/masterApi';

/**
 * RealEstateProduct
 * Product Type master for Real Estate leads (e.g. Vrindavan Garden, Bhardwaj Sky,
 * Shri Ram Lotus Valley, Evarraa By Dee Vee) — feeds the Lead form's Product Type dropdown
 * whenever Lead Type = Real Estate.
 */
export default function RealEstateProduct({ setHeaderAction, searchQuery = '' }) {
  return (
    <SimpleTextMaster
      setHeaderAction={setHeaderAction}
      searchQuery={searchQuery}
      fieldName="productType"
      entityLabel="Real Estate Product Type"
      icon={Building2}
      getAll={masterApi.getRealEstateProducts}
      save={masterApi.saveRealEstateProduct}
      remove={masterApi.deleteRealEstateProduct}
      placeholder="Enter product type (e.g. Vrindavan Garden)"
    />
  );
}
