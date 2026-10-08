const nowIST = () => {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().replace(/\.\d{3}Z$/, '+05:30');
};

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Extracts and normalizes a 10-digit Indian phone number
 */
export const cleanPhoneNumber = (val) => {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  // If 11 digits starting with 0, take last 10
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  // If 12 digits starting with 91, take last 10
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  // If longer or shorter, take last 10 if at least 10 digits
  if (digits.length > 10) return digits.slice(-10);
  return digits;
};

/**
 * Validates email format
 */
export const isValidEmail = (email) => {
  if (!email || !String(email).trim()) return true; // Optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
};

/**
 * Parses DOB value into YYYY-MM-DD string
 */
export const parseDobForDb = (value) => {
  if (value === undefined || value === null || value === '') return '';
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  if (typeof value === 'number') {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    return '';
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const dmy = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      return `${y}-${pad2(m)}-${pad2(d)}`;
    }
    const ymd = trimmed.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
    if (ymd) {
      const [, y, m, d] = ymd;
      return `${y}-${pad2(m)}-${pad2(d)}`;
    }
    const generic = new Date(trimmed);
    if (!isNaN(generic.getTime())) {
      return `${generic.getFullYear()}-${pad2(generic.getMonth() + 1)}-${pad2(generic.getDate())}`;
    }
  }
  return '';
};

/**
 * Parses created date into ISO string
 */
export const parseCreatedDate = (value) => {
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'number') {
    const fromSerial = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!isNaN(fromSerial.getTime())) return fromSerial.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    const dmy = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
    if (dmy) {
      const [, d, m, y] = dmy;
      const fromDMY = new Date(Number(y), Number(m) - 1, Number(d));
      if (!isNaN(fromDMY.getTime())) return fromDMY.toISOString();
    }
    const generic = new Date(trimmed);
    if (!isNaN(generic.getTime())) return generic.toISOString();
  }
  return nowIST();
};

/**
 * Validates and enriches a single row against master data and business rules
 */
export const validateSingleRow = ({
  row,
  rowIndex,
  leadType,
  masterData = {},
  filePhoneFirstSeen = {},
  existingLeadsPhoneMap = {}
}) => {
  const errors = [];
  const warnings = [];

  const {
    productMaster = [],
    requirementsMaster = [],
    investmentBudgetsMaster = [],
    insuranceSubProductsMaster = []
  } = masterData;

  const isRealEstate = (leadType || '').toLowerCase().includes('real') || (leadType || '').toLowerCase().includes('estate');
  const isInsurance = (leadType || '').toLowerCase().includes('insurance');
  const isMutualFund = (leadType || '').toLowerCase().includes('mutual') || (leadType || '').toLowerCase().includes('fund');

  // 1. Validate Customer Name (Required)
  const customerName = String(row.customerName ?? row.personName ?? '').trim();
  if (!customerName) {
    errors.push('Customer Name is required');
  }

  // 2. Validate Customer Number (Required, 10 digits)
  const rawNumber = String(row.customerNumber ?? row.number ?? '').trim();
  const cleanNumber = cleanPhoneNumber(rawNumber);

  if (!rawNumber) {
    errors.push('Customer Number is required');
  } else if (cleanNumber.length !== 10) {
    errors.push(`Invalid phone number "${rawNumber}" (must be a valid 10-digit number)`);
  }

  // 3. Validate Email (Optional)
  const customerEmail = String(row.customerEmail ?? row.email ?? '').trim();
  if (customerEmail && !isValidEmail(customerEmail)) {
    errors.push(`Invalid email format "${customerEmail}"`);
  }

  // 4. Validate DOB (Optional)
  const rawDob = row.dob;
  const parsedDob = parseDobForDb(rawDob);
  if (rawDob && !parsedDob) {
    warnings.push(`Could not parse DOB "${rawDob}", will be skipped`);
  }

  // 5. Master Data Matching: Product Type
  const rawProductType = String(row.productType ?? row.insuranceType ?? '').trim();
  let matchedProductType = '';
  let productMatchStatus = 'none'; // 'exact' | 'unmatched' | 'none'

  if (rawProductType) {
    const match = productMaster.find(
      p => String(p.productType || '').trim().toLowerCase() === rawProductType.toLowerCase()
    );
    if (match) {
      matchedProductType = match.productType;
      productMatchStatus = 'exact';
    } else {
      productMatchStatus = 'unmatched';
      warnings.push(`Product Type "${rawProductType}" was not found in Master Data`);
    }
  }

  // 6. Master Data Matching: Requirement (Real Estate only)
  const rawRequirement = String(row.requirement ?? '').trim();
  let matchedRequirement = rawRequirement;
  if (isRealEstate && rawRequirement && requirementsMaster.length > 0) {
    const match = requirementsMaster.find(
      r => String(r.requirement || '').trim().toLowerCase() === rawRequirement.toLowerCase()
    );
    if (match) {
      matchedRequirement = match.requirement;
    } else {
      warnings.push(`Requirement "${rawRequirement}" is not in Real Estate Master list`);
    }
  }

  // 7. Master Data Matching: Investment Budget
  const rawBudget = String(row.investmentBudget ?? '').trim();
  let matchedBudget = rawBudget;
  if (rawBudget && investmentBudgetsMaster.length > 0) {
    const match = investmentBudgetsMaster.find(
      b => String(b.investmentBudget || '').trim().toLowerCase() === rawBudget.toLowerCase()
    );
    if (match) {
      matchedBudget = match.investmentBudget;
    }
  }

  // 8. Master Data Matching: Insurance Sub Product Type
  const rawSubType = String(row.insuranceSubType ?? '').trim();
  let matchedSubType = rawSubType;
  if (isInsurance && rawSubType && insuranceSubProductsMaster.length > 0) {
    const match = insuranceSubProductsMaster.find(
      s => String(s.subProductType || '').trim().toLowerCase() === rawSubType.toLowerCase()
    );
    if (match) {
      matchedSubType = match.subProductType;
    }
  }

  // 9. Duplicate Detection
  if (cleanNumber.length === 10) {
    // Check in-file duplicates (only flag if seen in an earlier row)
    const firstSeen = filePhoneFirstSeen[cleanNumber];
    if (firstSeen !== undefined && firstSeen < rowIndex + 1) {
      warnings.push(`Duplicate phone number in file (First appeared in Row #${firstSeen})`);
    }

    // Check DB duplicates
    if (existingLeadsPhoneMap[cleanNumber]) {
      const existing = existingLeadsPhoneMap[cleanNumber];
      warnings.push(`Phone already exists in DB as Lead #${existing.leadNo || ''} (${existing.customerName || existing.personName || 'Existing'})`);
    }
  }

  // Status computation
  let status = 'VALID';
  if (errors.length > 0) {
    status = 'ERROR';
  } else if (warnings.length > 0) {
    status = 'WARNING';
  }

  return {
    rowIndex: rowIndex + 1,
    status,
    errors,
    warnings,
    // Normalized fields
    customerName,
    customerNumber: cleanNumber || rawNumber,
    rawNumber,
    customerEmail,
    dob: parsedDob,
    occupation: String(row.occupation ?? '').trim(),
    customerAddress: String(row.customerAddress ?? row.location ?? '').trim(),
    investmentBudget: matchedBudget,
    whenToBuyPlan: String(row.whenToBuyPlan ?? '').trim(),
    productType: matchedProductType || rawProductType,
    rawProductType,
    productMatchStatus,
    requirement: matchedRequirement,
    insuranceSubType: matchedSubType,
    anyDesease: String(row.anyDesease ?? '').trim(),
    referencerName: String(row.referencerName ?? '').trim(),
    remarks: String(row.remarks ?? '').trim(),
    timestamp: parseCreatedDate(row.timestamp),
    // Raw original mapped row
    rawRow: row
  };
};

/**
 * Validates an entire batch of parsed rows
 */
export const validateAllRows = (rows, columnMapping, leadType, masterData = {}, existingLeads = []) => {
  // Build lookup map for column mapping: targetFieldKey -> sourceHeader
  const fieldToHeaderMap = {};
  columnMapping.forEach(({ sourceHeader, targetFieldKey }) => {
    if (targetFieldKey) {
      fieldToHeaderMap[targetFieldKey] = sourceHeader;
    }
  });

  // Convert raw rows to canonical object format based on mapping
  const mappedRows = rows.map(rawRow => {
    const obj = {};
    Object.entries(fieldToHeaderMap).forEach(([fieldKey, headerName]) => {
      obj[fieldKey] = rawRow[headerName];
    });
    return obj;
  });

  // Calculate in-file phone first-seen row numbers
  const filePhoneFirstSeen = {};
  mappedRows.forEach((row, idx) => {
    const num = cleanPhoneNumber(row.customerNumber);
    if (num.length === 10) {
      if (filePhoneFirstSeen[num] === undefined) {
        filePhoneFirstSeen[num] = idx + 1; // 1-indexed row number
      }
    }
  });

  // Calculate DB existing phone lookup map
  const existingLeadsPhoneMap = {};
  (existingLeads || []).forEach(l => {
    const num = cleanPhoneNumber(l.customerNumber || l.number);
    if (num && num.length === 10) {
      existingLeadsPhoneMap[num] = l;
    }
  });

  return mappedRows.map((row, idx) =>
    validateSingleRow({
      row,
      rowIndex: idx,
      leadType,
      masterData,
      filePhoneFirstSeen,
      existingLeadsPhoneMap
    })
  );
};
