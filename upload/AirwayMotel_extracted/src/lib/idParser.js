/**
 * ID Barcode Parser
 *
 * Takes a raw PDF417 barcode string from a US driver's license / state ID
 * and returns a flat object of fields mapped to our form schema.
 *
 * Uses aamva-parser for AAMVA-compliant decoding (covers all 50 states).
 * Returns null for any field not present or not parseable — callers should
 * treat every field as possibly null.
 */

import { parse } from 'aamva-parser';

/**
 * Attempt to parse an AAMVA PDF417 barcode string into form-ready fields.
 *
 * @param {string} barcodeText - The raw text decoded from the PDF417 barcode.
 * @returns {{ firstName: string|null, lastName: string|null, dob: string|null,
 *   idNumber: string|null, idType: string|null, idState: string|null,
 *   address: string|null, city: string|null, state: string|null, zip: string|null,
 *   sex: string|null, eyeColor: string|null, height: string|null } | null}
 *   Parsed fields, or null if the barcode isn't valid AAMVA at all.
 */
export function parseIdBarcode(barcodeText) {
  if (!barcodeText || typeof barcodeText !== 'string') return null;

  try {
    const license = parse(barcodeText);

    // If we didn't even get a name, this probably isn't a valid AAMVA barcode.
    if (!license.firstName && !license.lastName) return null;

    // Format DOB as YYYY-MM-DD (what our date inputs expect).
    let dob = null;
    if (license.dateOfBirth instanceof Date && !isNaN(license.dateOfBirth)) {
      dob = license.dateOfBirth.toISOString().split('T')[0];
    }

    // Normalize gender to a single letter matching our DB convention.
    const sex = license.gender
      ? license.gender.charAt(0)   // "Male" → "M", "Female" → "F"
      : null;

    // Eye color — the enum string, e.g. "Brown", "Blue"
    const eyeColor = license.eyeColor || null;

    // Height — aamva-parser returns total inches as a number.
    // Convert to ft'in" format matching the existing data style (e.g. "6'03\"").
    let height = null;
    if (typeof license.height === 'number' && license.height > 0) {
      const inches = Math.round(license.height);
      const ft = Math.floor(inches / 12);
      const remainder = inches % 12;
      height = `${ft}'${String(remainder).padStart(2, '0')}"`;
    }

    // Determine ID type label based on issuing country and DL number presence.
    const idType = license.country === 'Canada'
      ? 'Provincial ID'
      : (license.driversLicenseId ? 'Driver License' : 'State ID');

    // The issuing state — from the parsed address state.
    const idState = license.state || null;

    // Combine street address lines into one string.
    const address = [
      license.streetAddress,
      license.streetAddressSupplement,
    ].filter(Boolean).join(', ') || null;

    return {
      firstName: license.firstName || null,
      lastName: license.lastName || null,
      dob,
      idNumber: license.driversLicenseId || license.documentId || null,
      idType,
      idState,
      address,
      city: license.city || null,
      state: idState,
      zip: license.postalCode || null,
      sex,
      eyeColor,
      height,
    };
  } catch {
    // aamva-parser throws on completely invalid input. Swallow and return null.
    return null;
  }
}
