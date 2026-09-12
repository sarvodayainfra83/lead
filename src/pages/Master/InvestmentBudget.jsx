import React from 'react';
import { Wallet } from 'lucide-react';
import SimpleTextMaster from './SimpleTextMaster';
import { masterApi } from '../../api/masterApi';

/**
 * InvestmentBudget
 * Investment Budget master (10k - 20k, 20k - 50k, ... Above 5 Lakh) — shared across all
 * Lead Types, feeds the Lead form's Investment Budget dropdown.
 */
export default function InvestmentBudget({ setHeaderAction, searchQuery = '' }) {
  return (
    <SimpleTextMaster
      setHeaderAction={setHeaderAction}
      searchQuery={searchQuery}
      fieldName="investmentBudget"
      entityLabel="Investment Budget"
      icon={Wallet}
      getAll={masterApi.getInvestmentBudgets}
      save={masterApi.saveInvestmentBudget}
      remove={masterApi.deleteInvestmentBudget}
      placeholder="Enter investment budget (e.g. 10k - 20k)"
    />
  );
}
