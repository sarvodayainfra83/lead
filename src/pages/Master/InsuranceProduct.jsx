import React from 'react';
import { ShieldCheck } from 'lucide-react';
import SimpleTextMaster from './SimpleTextMaster';
import { masterApi } from '../../api/masterApi';

/**
 * InsuranceProduct
 * Product Type master for Insurance leads (Life / Health / Vehicle / Property / Accident /
 * Travel Insurance / Other) — feeds the Lead form's Product Type dropdown whenever
 * Lead Type = Insurance. Life Insurance and Health Insurance additionally have their own
 * Sub Product Type list — see InsuranceSubProduct.
 */
export default function InsuranceProduct({ setHeaderAction, searchQuery = '' }) {
  return (
    <SimpleTextMaster
      setHeaderAction={setHeaderAction}
      searchQuery={searchQuery}
      fieldName="productType"
      entityLabel="Insurance Product Type"
      icon={ShieldCheck}
      getAll={masterApi.getInsuranceProducts}
      save={masterApi.saveInsuranceProduct}
      remove={masterApi.deleteInsuranceProduct}
      placeholder="Enter product type (e.g. Life Insurance)"
    />
  );
}
