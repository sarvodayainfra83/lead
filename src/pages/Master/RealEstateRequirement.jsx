import React from 'react';
import { ClipboardList } from 'lucide-react';
import SimpleTextMaster from './SimpleTextMaster';
import { masterApi } from '../../api/masterApi';

/**
 * RealEstateRequirement
 * Requirement master for Real Estate leads (1BHK / 2BHK / ... / Plot/Land / Other) — feeds
 * the Lead form's Requirement dropdown whenever Lead Type = Real Estate.
 */
export default function RealEstateRequirement({ setHeaderAction, searchQuery = '' }) {
  return (
    <SimpleTextMaster
      setHeaderAction={setHeaderAction}
      searchQuery={searchQuery}
      fieldName="requirement"
      entityLabel="Real Estate Requirement"
      icon={ClipboardList}
      getAll={masterApi.getRealEstateRequirements}
      save={masterApi.saveRealEstateRequirement}
      remove={masterApi.deleteRealEstateRequirement}
      placeholder="Enter requirement (e.g. 2BHK)"
    />
  );
}
