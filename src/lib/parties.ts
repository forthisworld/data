/**
 * The colour each party is usually shown in, by the short name the member lists use. A reading aid
 * only (chips, the party bar); parties without an entry get a neutral grey.
 */
const PARTY_COLOUR: Record<string, string> = {
    BJP: '#f97316',
    INC: '#0ea5e9',
    'JD(S)': '#15803d',
    'JD(U)': '#16a34a',
    AITC: '#14b8a6',
    DMK: '#dc2626',
    SP: '#e11d48',
    TDP: '#eab308',
    AAP: '#0369a1',
    'CPI(M)': '#b91c1c',
    CPI: '#b91c1c',
    'SHS(UBT)': '#f59e0b',
    SHS: '#f59e0b',
    'NCP(SP)': '#0d9488',
    NCP: '#0d9488',
    YSRCP: '#1d4ed8',
    RJD: '#059669',
    BJD: '#166534',
    IUML: '#15803d',
    JMM: '#16a34a',
    Vacant: '#cbd5e1',
};
export const partyColour = (short?: string): string => (short && PARTY_COLOUR[short]) || '#94a3b8';
