'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** A block of text with a copy button. */
export default function CopyBlock({ text, wrap = false }: { text: string; wrap?: boolean }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="relative mt-2 rounded-md border border-ftw-line bg-ftw-surface">
            <pre className={`overflow-x-auto p-3 pr-12 text-sm text-ftw-text ${wrap ? 'whitespace-pre-wrap' : ''}`}><code>{text}</code></pre>
            <button
                onClick={async () => {
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                }}
                aria-label="Copy"
                className="absolute right-2 top-2 rounded p-1.5 text-ftw-muted hover:bg-black/5"
            >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
        </div>
    );
}
