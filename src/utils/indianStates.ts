export const INDIAN_STATES: string[] = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

export interface TaxIdTypeOption {
  value: 'GSTIN' | 'PAN' | 'Aadhaar';
  label: string;
  placeholder: string;
  helper: string;
}

export const TAX_ID_TYPES: TaxIdTypeOption[] = [
  {
    value: 'GSTIN',
    label: 'GSTIN (Tax ID)',
    placeholder: 'e.g. 33AABCS1111A1Z1 (15 characters)',
    helper: '15-character Goods and Services Tax Identification Number',
  },
  {
    value: 'PAN',
    label: 'PAN Number',
    placeholder: 'e.g. ABCDE1234F (10 characters)',
    helper: '10-character Permanent Account Number',
  },
  {
    value: 'Aadhaar',
    label: 'Aadhaar Card',
    placeholder: 'e.g. 1234 5678 9012 (12 digits)',
    helper: '12-digit Unique Identification Number',
  },
];
