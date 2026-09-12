import React from 'react';
import { TrendingUp } from 'lucide-react';
import SimpleTextMaster from './SimpleTextMaster';
import { masterApi } from '../../api/masterApi';

/**
 * MutualFundProduct
 * Product Type master for Mutual Fund leads (Equity Fund, Debit Fund, Hybrid Fund,
 * Money Market Fund, Growth Fund, ...) — feeds the Lead form's Product Type dropdown
 * whenever Lead Type = Mutual Fund.
 */
export default function MutualFundProduct({ setHeaderAction, searchQuery = '' }) {
  return (
    <SimpleTextMaster
      setHeaderAction={setHeaderAction}
      searchQuery={searchQuery}
      fieldName="productType"
      entityLabel="Mutual Fund Product Type"
      icon={TrendingUp}
      getAll={masterApi.getMutualFundProducts}
      save={masterApi.saveMutualFundProduct}
      remove={masterApi.deleteMutualFundProduct}
      placeholder="Enter product type (e.g. Equity Fund)"
    />
  );
}
