/**
 * AIRWAY MOTEL — Terms and Conditions
 * 
 * Transcribed from the official Airway Motel agreement form.
 * This is the exact text guests must agree to before check-in.
 */

export const TERMS_AND_CONDITIONS = [
  {
    number: 1,
    text: 'Checkout time is 10 AM on date of checkout.',
  },
  {
    number: 2,
    text: 'A fee of $10 dollars per hour will be assessed for each hour guest stays past checkout time.',
  },
  {
    number: 3,
    text: 'Deposits for key and T.V. remote will not be returned unless each is returned in serviceable condition.',
  },
  {
    number: 4,
    text: 'Guests may request refund of room rent and deposits for key and T.V. remote, within five (5) minutes of check-in time if room unsatisfactory. NO refunds will be given outside this time for any reason.',
  },
  {
    number: 5,
    text: 'The following WILL NOT be tolerated during your stay at AIRWAY MOTEL, for any reason: Illicit drug activity, solicitation (prostitution), illegal weapon possession, or any activities that would pose a danger to guests, staff, general public or in violation of any state/county/city municipal code.',
  },
  {
    number: 6,
    text: 'Management reserves the right to EVICT any guest or visitors AT ANY TIME, without refund, for any damage to property, harassment of other guests or staff, causing harm to others, refusal to pay rent fees, allowing/having unregistered visitors in room, participating in any illegal or suspicious activities or any other management policies/verbal directions. Any person(s) can be barred from entering AIRWAY MOTEL property at any time.',
  },
  {
    number: 7,
    text: 'Management reserves the right to enter any room at any time, for inspection, for repairs, for cleaning, pest control measures, or other actions to maintain room/facilities. Management/staff will knock before entering room.',
  },
  {
    number: 8,
    text: 'AIRWAY MOTEL, management/staff, does not/will not assume any responsibility for any lost, stolen, or damaged personal items/valuables or vehicles. AIRWAY MOTEL, management/staff does not/will not assume any responsibility for any accident(s), personal injury or death(s) occurring on property and shall not be held liable of the for mentioned reason(s).',
  },
  {
    number: 9,
    text: 'Upon check-out, eviction, or nonpayment of room rental fee, AIRWAY MOTEL/management/staff will assume all properties including valuables left in room/on property were left intentionally and assumes the right to the aforementioned items. Should guest/tenant leave by circumstances beyond their control, management will at their discretion, pack and store guest/tenant belongings for a period of 30 days at a fee of $200 dollars, paid in full upon recovery of items. Note: Any items that are excessively large (furniture and appliances), non-servable, perishable, or unsafe will not be stored.',
  },
  {
    number: 10,
    text: 'Any tenant who commits, conducts, facilitates, allows, permits, or fails on Airway Motel property any public nuisance as defined in section 37-50 (c) or (d) of the Denver Revised Municipal Code, or any other activity prohibited by law or the Denver Revised Municipal Code shall be subject to immediate eviction.',
  },
];

export const TERMS_HEADER =
  'By signing below, as a guest of AIRWAY MOTEL you state that you have fully read the statements, conditions below and agree to abide by them, without exception, while staying at AIRWAY MOTEL.';

export const MOTEL_INFO = {
  name: 'Airway Motel',
  address: 'Denver, CO',
  phone: '',        // Will be filled in by admin in Settings
  checkoutTime: '10:00 AM',
  lateFeePerHour: 10,
  storageFee: 200,
  storagePeriodDays: 30,
};
