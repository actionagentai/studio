'use client';

/**
 * EditableImage — wraps any image element and, in edit mode, renders a
 * single black circular pencil button at the bottom-right corner. Click
 * opens the MediaPicker. No outlines, no badges, no blue — matches legacy.
 */

import { Children, cloneElement, isValidElement, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useSession } from '../providers/SessionProvider';
import { useEditorState } from '../providers/EditorStateProvider';
import { MediaPicker } from '../media/MediaPicker';

interface EditableImageProps {
  path: string;
  src: string;
  alt?: string;
  className?: string;
  wrapperAs?: keyof React.JSX.IntrinsicElements;
  wrapperClassName?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  label?: string;
  sizeType?: 'hero' | 'card' | 'thumbnail' | 'logo' | 'feature';
  allowVideo?: boolean;
}

export function EditableImage({
  path,
  src: initialSrc,
  alt,
  className,
  wrapperAs,
  wrapperClassName,
  children,
  style,
  label,
  sizeType = 'card',
  allowVideo = true,
}: EditableImageProps) {
  const { canEdit } = useSession();
  const { editMode, valueAt, apply, patches } = useEditorState();
  const [pickerOpen, setPickerOpen] = useState(false);

  const live = valueAt(path);
  const currentSrc = (typeof live === 'string' && live) || initialSrc;
  const interactive = canEdit && editMode;
  const isDirty = patches.some((p) => p.path === path);

  // Clone the first child element with the live src; fall back to plain <img>.
  let content: React.ReactNode;
  if (children) {
    const childArr = Children.toArray(children);
    const elementChild = childArr.find((c) => isValidElement(c));
    content = elementChild
      ? cloneElement(elementChild as React.ReactElement<any>, { src: currentSrc })
      : children;
  } else {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    content = <img src={currentSrc} alt={alt || ''} className={className} />;
  }

  const Tag: any = wrapperAs || 'span';
  const wrapperClass = `${wrapperClassName || className || ''} ${interactive ? 'group' : ''}`.trim();

  return (
    <Tag className={wrapperClass} style={style}>
      {content}
      {interactive && (
        <>
          <button
            type="button"
            aria-label={`Replace ${label || 'image'}`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPickerOpen(true); }}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 50,
              width: 30,
              height: 30,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              background: 'rgba(0,0,0,0.85)',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(6px)',
              border: 0,
              cursor: 'pointer',
            }}
          >
            <Pencil width={14} height={14} strokeWidth={1.75} />
            {isDirty && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: '#fbbf24',
                  border: '2px solid #000',
                }}
              />
            )}
          </button>
          {label && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                zIndex: 15,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 500,
                color: '#fff',
                background: 'rgba(17,17,17,0.85)',
                borderRadius: 4,
                opacity: 0,
                transition: 'opacity 150ms ease',
                pointerEvents: 'none',
                fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
              }}
              className="studio-editable-label"
            >
              {label}
            </span>
          )}
          {/* hover reveals label */}
          <style>{`
            .group:hover .studio-editable-label { opacity: 1 !important; }
          `}</style>
        </>
      )}
      {pickerOpen && (
        <MediaPicker
          currentUrl={currentSrc}
          onSelect={(url) => {
            apply(path, url);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
          title={label || 'Edit Image'}
          allowVideo={allowVideo}
          sizeType={sizeType}
        />
      )}
    </Tag>
  );
}
