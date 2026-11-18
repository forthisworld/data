/**
 * The ForThisWorld mark: a compass. The ring and needle take the text colour;
 * the north half of the needle is always the brand red. Also drawn, at fixed
 * colours, in public/icons/icon.svg.
 *
 * `live` makes it behave like a compass: with `intro` the needle swings in and settles, it
 * trembles while `moving` is set (the map is being dragged or zoomed), and it comes to rest
 * with a small swing afterwards. The styles are in globals.css (.ftw-compass) and are switched
 * off for reduced motion.
 */
export default function CompassMark({ className, title, live, moving, intro }: { className?: string; title?: string; live?: boolean; moving?: boolean; intro?: boolean }) {
    return (
        <svg viewBox="0 0 64 64" className={[className, live && 'ftw-compass', live && intro && !moving && 'ftw-compass-intro', live && moving && 'ftw-compass-moving'].filter(Boolean).join(' ')}
            role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
            <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" strokeWidth="3.5" />
            {/* east-west, light */}
            <path d="M11 32 L32 28.5 L53 32 L32 35.5 Z" fill="currentColor" opacity="0.35" />
            <g className="ftw-needle">
                {/* south half */}
                <path d="M32 32 L36.5 32 L32 54 L27.5 32 Z" fill="currentColor" />
                {/* north half */}
                <path d="M32 10 L36.5 32 L27.5 32 Z" fill="var(--ftw-north, #e11d48)" />
            </g>
            <circle cx="32" cy="32" r="3.2" fill="var(--ftw-surface, #fff)" stroke="currentColor" strokeWidth="2" />
        </svg>
    );
}
