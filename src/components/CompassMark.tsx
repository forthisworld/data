/**
 * The ForThisWorld mark: a compass. The ring and needle take the text colour;
 * the north half of the needle is always the brand red. Also drawn, at fixed
 * colours, in public/icons/icon.svg.
 */
export default function CompassMark({ className, title }: { className?: string; title?: string }) {
    return (
        <svg viewBox="0 0 64 64" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
            <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" strokeWidth="3.5" />
            {/* east-west, light */}
            <path d="M11 32 L32 28.5 L53 32 L32 35.5 Z" fill="currentColor" opacity="0.35" />
            {/* south half */}
            <path d="M32 32 L36.5 32 L32 54 L27.5 32 Z" fill="currentColor" />
            {/* north half */}
            <path d="M32 10 L36.5 32 L27.5 32 Z" fill="var(--ftw-north, #e11d48)" />
            <circle cx="32" cy="32" r="3.2" fill="var(--ftw-surface, #fff)" stroke="currentColor" strokeWidth="2" />
        </svg>
    );
}
