'use client';

// The interactive replacement for a bare <input type=file>: a large icon
// target that takes a click, a keyboard Enter/Space, or a dropped file. The
// real input stays in the DOM (hidden) so FormData, focus and form.reset()
// behave exactly as they always did.

import { useEffect, useRef, useState } from 'react';
import { bytes } from '@/lib/format';

const ACCEPT = 'video/mp4,video/webm,video/quicktime,video/x-matroska';

function UploadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3" />
      <path d="m7 9 5-5 5 5" />
      <path d="M12 4v12" />
    </svg>
  );
}

type FileDropProps = {
  /** Present when the file should ride along in the surrounding form's FormData. */
  name?: string;
  id?: string;
  disabled?: boolean;
  prompt: string;
  /** Fired with the chosen file (click or drop), or null when cleared. */
  onFile?: (file: File | null) => void;
};

export function FileDrop({ name, id = 'file', disabled = false, prompt, onFile }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);

  // form.reset() clears the hidden input; the visible state has to follow.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const clear = () => setFile(null);
    form.addEventListener('reset', clear);
    return () => form.removeEventListener('reset', clear);
  }, []);

  const pick = (f: File | null) => {
    setFile(f);
    onFile?.(f);
  };

  return (
    <label
      className="dropzone"
      data-drag={drag || undefined}
      data-disabled={disabled || undefined}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (disabled) return;
        const dropped = e.dataTransfer.files?.[0];
        if (!dropped) return;
        // Hand the dropped file to the real input so FormData sees it too.
        if (inputRef.current) {
          const transfer = new DataTransfer();
          transfer.items.add(dropped);
          inputRef.current.files = transfer.files;
        }
        pick(dropped);
      }}
    >
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={ACCEPT}
        disabled={disabled}
        className="dropzone-input"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
      <UploadIcon />
      {file ? (
        <>
          <span className="dropzone-file num">
            {file.name} ({bytes(file.size)})
          </span>
          <span className="dropzone-sub">Click or drop to choose a different file</span>
        </>
      ) : (
        <>
          <span>{prompt}</span>
          <span className="dropzone-sub">MP4, WebM, MOV or MKV. Click to browse, or drop it here.</span>
        </>
      )}
    </label>
  );
}
