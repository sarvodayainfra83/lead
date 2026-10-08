// Canonical field definitions, aliases, and metadata for Smart Bulk Lead Import

export const BULK_LEAD_FIELDS = {
  customerName: {
    key: 'customerName',
    label: 'Customer Name',
    required: true,
    category: 'basic',
    description: 'Full name of the customer or client',
    aliases: [
      'customer name',
      'name',
      'client name',
      'client',
      'customer',
      'person name',
      'lead name',
      'full name',
      'contact person',
      'customer_name',
      'person_name',
      'client_name',
      'lead_name',
      'customername',
      'personname'
    ]
  },
  customerNumber: {
    key: 'customerNumber',
    label: 'Customer Number',
    required: true,
    category: 'basic',
    description: '10-digit mobile or phone number',
    aliases: [
      'customer number',
      'phone',
      'phone no',
      'phone number',
      'phoneno',
      'phonenumber',
      'mobile',
      'mobile no',
      'mobile number',
      'mobileno',
      'mobilenumber',
      'contact',
      'contact no',
      'contact number',
      'contactno',
      'contactnumber',
      'customer mobile',
      'customer mobile no',
      'customer mobile number',
      'cell',
      'cell no',
      'cell number',
      'telephone',
      'tel no',
      'person number',
      'customer_number',
      'person_number',
      'phone_number',
      'mobile_number',
      'contact_number'
    ]
  },
  customerEmail: {
    key: 'customerEmail',
    label: 'Customer Email',
    required: false,
    category: 'basic',
    description: 'Email address of the customer',
    aliases: [
      'customer email',
      'email',
      'email id',
      'email address',
      'emailid',
      'mail',
      'mail id',
      'mail address',
      'customer_email',
      'e-mail',
      'email_id',
      'email_address'
    ]
  },
  dob: {
    key: 'dob',
    label: 'Customer DOB',
    required: false,
    category: 'basic',
    description: 'Date of birth (DD/MM/YYYY or YYYY-MM-DD)',
    aliases: [
      'customer dob',
      'dob',
      'date of birth',
      'birth date',
      'birthdate',
      'd.o.b',
      'd.o.b.',
      'customer_dob',
      'birth_date',
      'date_of_birth'
    ]
  },
  occupation: {
    key: 'occupation',
    label: 'Customer Occupation',
    required: false,
    category: 'basic',
    description: 'Profession, business, job, or occupation',
    aliases: [
      'customer occupation',
      'occupation',
      'profession',
      'job',
      'designation',
      'business',
      'work',
      'employment',
      'customer_occupation'
    ]
  },
  customerAddress: {
    key: 'customerAddress',
    label: 'Customer Address / Location',
    required: false,
    category: 'basic',
    description: 'Address, city, or residential area',
    aliases: [
      'customer address',
      'address',
      'location',
      'city',
      'area',
      'residence',
      'residential address',
      'customer location',
      'customer_address',
      'customer_location'
    ]
  },
  investmentBudget: {
    key: 'investmentBudget',
    label: 'Investment Budget / Range',
    required: false,
    category: 'business',
    description: 'Budget range (e.g. 20k - 50k, 50 Lakh - 1 Cr)',
    aliases: [
      'investment budget',
      'investment range',
      'budget',
      'budget range',
      'price range',
      'investment',
      'budget_range',
      'investment_budget',
      'investment_range',
      'price_range'
    ]
  },
  whenToBuyPlan: {
    key: 'whenToBuyPlan',
    label: 'When to Buy Plan',
    required: false,
    category: 'business',
    description: 'Buying timeline (e.g. Immediate, 3 Months, 1 Year)',
    aliases: [
      'when to buy plan',
      'when to buy',
      'buying plan',
      'purchase timeline',
      'timeline',
      'timeframe',
      'planning to buy',
      'when_to_buy_plan',
      'when_to_buy',
      'purchase_timeline'
    ]
  },
  productType: {
    key: 'productType',
    label: 'Product Type / Project',
    required: false,
    category: 'vertical',
    description: 'Specific Product Type from master for this Lead Type',
    aliases: [
      'product type',
      'product',
      'project',
      'project name',
      'scheme',
      'insurance product',
      'mutual fund product',
      'insurance type',
      'plan type',
      'policy type',
      'product_type',
      'project_name',
      'insurance_type'
    ]
  },
  requirement: {
    key: 'requirement',
    label: 'Requirement (Real Estate)',
    required: false,
    category: 'vertical',
    description: 'Real Estate requirement (e.g. 2 BHK, 3 BHK, Commercial Plot)',
    aliases: [
      'requirement',
      'property requirement',
      'unit type',
      'bhk',
      'configuration',
      'size',
      'flat type',
      'property type',
      'house type',
      'unit_type',
      'property_requirement'
    ]
  },
  insuranceSubType: {
    key: 'insuranceSubType',
    label: 'Sub Product Type (Insurance)',
    required: false,
    category: 'vertical',
    description: 'Insurance sub product type',
    aliases: [
      'sub product type',
      'insurance sub type',
      'sub type',
      'plan subtype',
      'policy sub type',
      'sub_product_type',
      'insurance_sub_type'
    ]
  },
  anyDesease: {
    key: 'anyDesease',
    label: 'Pre-existing Disease (Insurance)',
    required: false,
    category: 'vertical',
    description: 'Any pre-existing medical condition',
    aliases: [
      'any disease',
      'any desease',
      'pre existing disease',
      'pre-existing disease',
      'medical history',
      'disease',
      'illness',
      'any_disease',
      'any_desease'
    ]
  },
  referencerName: {
    key: 'referencerName',
    label: 'Referencer Name',
    required: false,
    category: 'source',
    description: 'Name of person who referred this lead',
    aliases: [
      'referencer name',
      'referencer',
      'referred by',
      'reference name',
      'ref name',
      'reference by',
      'referencer_name',
      'referred_by'
    ]
  },
  timestamp: {
    key: 'timestamp',
    label: 'Created Date',
    required: false,
    category: 'meta',
    description: 'Date/time the lead was generated',
    aliases: [
      'created date',
      'date',
      'lead date',
      'creation date',
      'entry date',
      'timestamp',
      'created_date',
      'created_at'
    ]
  },
  remarks: {
    key: 'remarks',
    label: 'Remarks / Comments',
    required: false,
    category: 'meta',
    description: 'Additional notes or remarks',
    aliases: [
      'remarks',
      'remark',
      'comments',
      'comment',
      'notes',
      'note',
      'description',
      'feedback',
      'lead remarks'
    ]
  }
};

export const CANONICAL_FIELD_LIST = Object.values(BULK_LEAD_FIELDS);

export const TEMPLATE_DOWNLOAD_HEADERS = [
  'Created Date',
  'Product Type',
  'Requirement',
  'Investment Range',
  'When to Buy Plan',
  'Person Name',
  'Person Number',
  'Customer Email',
  'Customer DOB',
  'Customer Occupation',
  'Address',
  'Remarks'
];
