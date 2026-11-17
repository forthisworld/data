import { FactBasis, MoneyValue, SourceCitation } from '@/types';

/**
 * A compact list of sources, for entity pages. Links go to the original
 * publisher; "read" is when we last checked the source.
 */
export function SourceList({ sources, lastVerified }: { sources?: SourceCitation[]; lastVerified?: string }) {
    if (!sources || sources.length === 0) {
        return <p className="text-sm text-slate-500">No sources yet, so nothing beyond the name is published.</p>;
    }
    return (
        <div>
            <ul className="space-y-3">
                {sources.map(s => (
                    <li key={s.id} id={`source-${s.id}`} className="text-sm scroll-mt-24">
                        {s.url ? (
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:text-sky-200">
                                {s.title} ↗
                            </a>
                        ) : (
                            <span className="text-slate-200">{s.title}</span>
                        )}
                        <p className="text-xs text-slate-500">
                            {s.publisher}
                            {s.date ? ` · ${s.date}` : ''}
                            {s.retrievedAt ? ` · read ${s.retrievedAt}` : ''}
                        </p>
                        {s.note && <p className="text-xs text-slate-600 mt-0.5">{s.note}</p>}
                    </li>
                ))}
            </ul>
            {lastVerified && <p className="mt-3 text-xs text-slate-600">Last verified: {lastVerified}</p>}
        </div>
    );
}

/**
 * How firmly a figure is established, as a small labelled pill.
 * Colours: green = established by a primary source, amber = press report,
 * rose = a named party's claim.
 */
const BASIS: Record<FactBasis, { label: string; title: string; className: string }> = {
    court_finding: { label: 'Court finding', title: 'Stated as a finding by a court', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
    audit_finding: { label: 'Audit finding', title: 'Found by the CAG or another statutory auditor', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
    official_record: { label: 'Official record', title: 'Gazette, census, legislature or other government record', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
    company_filing: { label: 'Company filing', title: "The company's own audited or legal disclosure", className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
    reported: { label: 'Press report', title: 'Reported by the press; not yet confirmed by a primary source', className: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
    claim: { label: 'Claim', title: 'Asserted by a named party; not confirmed', className: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
};

export function BasisBadge({ basis }: { basis?: FactBasis }) {
    if (!basis) return null;
    const b = BASIS[basis];
    return (
        <span title={b.title} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap ${b.className}`}>
            {b.label}
        </span>
    );
}

/** A link to an entry in the page's Sources list. */
export function SourceRef({ id }: { id?: string }) {
    if (!id) return null;
    return (
        <a href={`#source-${id}`} className="text-[11px] text-sky-400 hover:underline whitespace-nowrap" title="Go to source">
            [{id}]
        </a>
    );
}

/** Badge + source link for a money value. */
export function MoneyProvenance({ value }: { value?: MoneyValue }) {
    if (!value) return null;
    return (
        <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
            <BasisBadge basis={value.basis} />
            <SourceRef id={value.sourceId} />
        </span>
    );
}
