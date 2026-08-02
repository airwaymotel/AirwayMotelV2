// ── AAMVA PDF417 Parser ─────────────────────────────────────────────
// Shared between the desktop ID scanner and the mobile phone scan page
// so both barcode paths use identical parsing logic.

export interface ScannedIdData {
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  idNumber: string;
  idType: string;
  issuingState: string;
  expirationDate: string;
  issueDate: string;
  eyeColor: string;
  hairColor: string;
  height: string;
  weight: string;
  veteran: boolean;
  organDonor: boolean;
  realId: boolean;
}

const STATE_MAP: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR',
  '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
  '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI',
  '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
  '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE',
  '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
  '36': 'NY', '37': 'NC', '38': 'ND', '40': 'OK',
  '41': 'OR', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '49': 'UT', '50': 'VT', '51': 'VA',
  '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY',
};

const EYE_COLOR_MAP: Record<string, string> = {
  BLK: 'Black', BLU: 'Blue', BRO: 'Brown', GRY: 'Gray',
  GRN: 'Green', HAZ: 'Hazel', MAR: 'Maroon', DIC: 'Dichromatic',
};

const HAIR_COLOR_MAP: Record<string, string> = {
  BAL: 'Bald', BLK: 'Black', BLN: 'Blond', BRO: 'Brown',
  GRY: 'Gray', RED: 'Red/Auburn', SDY: 'Sandy', WHI: 'White',
};

function normalizeDate8(raw: string): string {
  // 8-digit AAMVA dates: YYYYMMDD if it starts with 19/20, else MMDDYYYY (legacy)
  if (raw.length !== 8) return '';
  if (raw.startsWith('19') || raw.startsWith('20')) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return `${raw.slice(4, 8)}-${raw.slice(0, 2)}-${raw.slice(2, 4)}`;
}

export function parseAAMVA(rawText: string): ScannedIdData | null {
  try {
    // AAMVA format starts with @\n followed by ANSI or AAMVA
    if (!rawText.includes('ANSI') && !rawText.includes('AAMVA')) {
      return null;
    }

    const result: ScannedIdData = {
      firstName: '',
      middleName: '',
      lastName: '',
      fullName: '',
      dateOfBirth: '',
      gender: '',
      address: { street: '', city: '', state: '', zipCode: '' },
      idNumber: '',
      idType: 'Driver License',
      issuingState: '',
      expirationDate: '',
      issueDate: '',
      eyeColor: '',
      hairColor: '',
      height: '',
      weight: '',
      veteran: false,
      organDonor: false,
      realId: false,
    };

    const lines = rawText.split(/\n|\r/).map((l) => l.trim()).filter(Boolean);

    // Extract issuer ID from header
    const headerMatch = rawText.match(/ANSI\s*(\d{6})/);
    if (headerMatch) {
      const issuerId = headerMatch[1].substring(0, 2);
      result.issuingState = STATE_MAP[issuerId] || issuerId;
    }

    // Parse each line for AAMVA elements
    for (const line of lines) {
      const daaMatch = line.match(/^DAA(.+)/);
      if (daaMatch) {
        const nameParts = daaMatch[1].split(',').map((s) => s.trim());
        if (nameParts.length >= 1) result.lastName = nameParts[0];
        if (nameParts.length >= 2) {
          const firstMiddle = nameParts[1].split(' ').map((s) => s.trim());
          result.firstName = firstMiddle[0] || '';
          result.middleName = firstMiddle.slice(1).join(' ');
        }
        result.fullName = `${result.firstName} ${result.middleName} ${result.lastName}`.replace(/\s+/g, ' ').trim();
      }
      const dacMatch = line.match(/^DAC(.+)/);
      if (dacMatch) result.firstName = dacMatch[1].trim();
      const dadMatch = line.match(/^DAD(.+)/);
      if (dadMatch) result.middleName = dadMatch[1].trim();
      const dcbMatch = line.match(/^DCB(.+)/);
      if (dcbMatch) result.lastName = dcbMatch[1].trim();
      const dcsMatch = line.match(/^DCS(.+)/);
      if (dcsMatch) result.lastName = dcsMatch[1].trim();
      const dbbMatch = line.match(/^DBB(.+)/);
      if (dbbMatch) result.dateOfBirth = normalizeDate8(dbbMatch[1].trim());
      const dbcMatch = line.match(/^DBC(.+)/);
      if (dbcMatch) {
        const g = dbcMatch[1].trim().toUpperCase();
        result.gender = g === '1' || g === 'M' ? 'Male' : g === '2' || g === 'F' ? 'Female' : g;
      }
      const dagMatch = line.match(/^DAG(.+)/);
      if (dagMatch) result.address.street = dagMatch[1].trim();
      const daiMatch = line.match(/^DAI(.+)/);
      if (daiMatch) result.address.city = daiMatch[1].trim();
      const dajMatch = line.match(/^DAJ(.+)/);
      if (dajMatch) result.address.state = dajMatch[1].trim();
      const dakMatch = line.match(/^DAK(.+)/);
      if (dakMatch) result.address.zipCode = dakMatch[1].trim().substring(0, 5);
      const daqMatch = line.match(/^DAQ(.+)/);
      if (daqMatch) result.idNumber = daqMatch[1].trim();
      const dbaMatch = line.match(/^DBA(.+)/);
      if (dbaMatch) result.expirationDate = normalizeDate8(dbaMatch[1].trim());
      const dbdMatch = line.match(/^DBD(.+)/);
      if (dbdMatch) result.issueDate = normalizeDate8(dbdMatch[1].trim());
      const dayMatch = line.match(/^DAY(.+)/);
      if (dayMatch) {
        const key = dayMatch[1].trim().toUpperCase();
        result.eyeColor = EYE_COLOR_MAP[key] || dayMatch[1].trim();
      }
      const dazMatch = line.match(/^DAZ(.+)/);
      if (dazMatch) {
        const key = dazMatch[1].trim().toUpperCase();
        result.hairColor = HAIR_COLOR_MAP[key] || dazMatch[1].trim();
      }
      const dauMatch = line.match(/^DAU(.+)/);
      if (dauMatch) result.height = dauMatch[1].trim();
      const dawMatch = line.match(/^DAW(.+)/);
      if (dawMatch) result.weight = dawMatch[1].trim();
      if (line.includes('ID') || line.includes('IDENTIFICATION')) {
        result.idType = 'State ID';
      }
    }

    if (!result.fullName) {
      result.fullName = `${result.firstName} ${result.middleName} ${result.lastName}`.replace(/\s+/g, ' ').trim();
    }
    if (!result.issuingState && result.address.state) {
      result.issuingState = result.address.state;
    }
    if (!result.lastName && !result.firstName && !result.idNumber) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Build a minimal ScannedIdData object from a raw barcode string that did not
 * parse as AAMVA (e.g. a plain ID number). Used as a fallback so the flow can
 * still continue from a partial barcode read.
 */
export function partialScannedIdFromRaw(rawText: string): ScannedIdData {
  return {
    firstName: '',
    middleName: '',
    lastName: '',
    fullName: '',
    dateOfBirth: '',
    gender: '',
    address: { street: '', city: '', state: '', zipCode: '' },
    idNumber: rawText,
    idType: 'State ID',
    issuingState: '',
    expirationDate: '',
    issueDate: '',
    eyeColor: '',
    hairColor: '',
    height: '',
    weight: '',
    veteran: false,
    organDonor: false,
    realId: false,
  };
}
