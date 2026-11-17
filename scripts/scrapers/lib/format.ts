/**
 * Parsing helpers for Indian government/financial text formats.
 */

export interface ParsedMoney {
    valueInRupees: number;
    unit: 'rupee' | 'lakh' | 'crore' | 'arab';
    raw: string;
}

const UNIT_MULTIPLIERS: Record<string, number> = {
    rupee: 1,
    rupees: 1,
    rs: 1,
    inr: 1,
    lakh: 1e5,
    lakhs: 1e5,
    lac: 1e5,
    lacs: 1e5,
    crore: 1e7,
    crores: 1e7,
    cr: 1e7,
    arab: 1e9,
};

/**
 * Parse strings like:
 *   "Rs 2,300 crore"      -> 23_000_000_000
 *   "INR 45.6 lakh"       -> 4_560_000
 *   "₹308 crore"          -> 3_080_000_000
 *   "Rs. 12,500"          -> 12500
 * Returns null when no monetary amount is found.
 */
export function parseIndianMoney(input: string): ParsedMoney | null {
    const cleaned = input.replace(/,/g, '');
    const match = cleaned.match(/(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)\s*(lakh|lakhs|lac|lacs|crore|crores|cr|arab)?/i);
    if (!match) return null;

    const value = parseFloat(match[1]);
    const unitWord = (match[2] || 'rupee').toLowerCase();
    const multiplier = UNIT_MULTIPLIERS[unitWord];
    if (multiplier === undefined || Number.isNaN(value)) return null;

    return {
        valueInRupees: value * multiplier,
        unit: unitWord === 'arab' ? 'arab' : multiplier === 1 ? 'rupee' : multiplier === 1e5 ? 'lakh' : 'crore',
        raw: input.trim(),
    };
}

/**
 * Parse common Indian date formats into ISO yyyy-mm-dd where possible.
 * Handles "24 October 2016", "2016-10-24", "Oct 2016" (day=01), "2016".
 */
export function parseIndianDate(input: string): string | null {
    const s = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{4}$/.test(s)) return `${s}-01-01`;

    const months = [
        'jan', 'feb', 'mar', 'apr', 'may', 'jun',
        'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
    ];
    const m = s.toLowerCase().match(/^(\d{1,2})?\s*([a-z]{3})[a-z]*\s*(\d{4})$/);
    if (m) {
        const monthIdx = months.indexOf(m[2]);
        if (monthIdx >= 0) {
            const day = m[1] ? m[1].padStart(2, '0') : '01';
            return `${m[3]}-${String(monthIdx + 1).padStart(2, '0')}-${day}`;
        }
    }
    return null;
}

/** Format rupees into a human crore/lakh string. */
export function formatRupees(valueInRupees: number): string {
    if (Math.abs(valueInRupees) >= 1e7) return `Rs ${(valueInRupees / 1e7).toFixed(2)} crore`;
    if (Math.abs(valueInRupees) >= 1e5) return `Rs ${(valueInRupees / 1e5).toFixed(2)} lakh`;
    return `Rs ${valueInRupees.toFixed(0)}`;
}
