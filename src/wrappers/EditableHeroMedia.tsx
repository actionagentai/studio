'use client';

/**
 * EditableHeroMedia — wrapper for hero sections that render an image OR a video.
 *
 * Shows a single pencil button at top-right (same position as EditableImage).
 * Click → MediaPicker with both image + video tabs. Selecting:
 *   - an image → sets imagePath
 *   - a video → sets videoPath (and keeps image as the poster)
 */

import { Children, cloneElement, isValidElement, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useSession } from '../providers/SessionProvider';
import { useEditorState } from '../providers/EditorStateProvider';
import { MediaPicker } from '../media/MediaPicker';

interface EditableHeroMediaProps {
  imagePath: string;
  videoPath: string;
  image?: string;
  video?: string;
  label?: string;
  children?: React.ReactNode;
  wrapperAs?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
}

export function EditableHeroMedia({
  imagePath,
  videoPath,
  image: initialImage,
  video: initialVideo,
  label = 'Hero Media',
  children,
  wrapperAs,
  className,
  style,
}: EditableHeroMediaProps) {
  const { canEdit } = useSession();
  const { editMode, valueAt, apply, patches } = useEditorState();
  const [pickerOpen, setPickerOpen] = useState(false);

  const liveImage = valueAt(imagePath);
  const liveVideo = valueAt(videoPath);
  const currentImage = (typeof liveImage === 'string' && liveImage) || initialImage;
  const currentVideo = (typeof liveVideo === 'string' && liveVideo) || initialVideo;
  const interactive = canEdit && editMode;
  const isDirty = patches.some((p) => p.path === imagePath || p.path === videoPath);

  // Clone the child element and inject the live src + poster so the actual
  // <video>/<img> in the page reflects the editor state. The `key` forces
  // a remount when src changes — required for <video> to actually pick up
  // a new source (otherwise it keeps playing the old one).
  let content: React.ReactNode = children;
  if (children) {
    const childArr = Children.toArray(children);
    const elementChild = childArr.find((c) => isValidElement(c));
    if (elementChild) {
      const el = elementChild as React.ReactElement<any>;
      const isVideoTag = typeof el.type === 'string' && el.type === 'video';
      const overrides: Record<string, unknown> = {};
      if (isVideoTag) {
        if (currentVideo) overrides.src = currentVideo;
        if (currentImage) overrides.poster = currentImage;
        overrides.key = `${currentVideo || ''}|${currentImage || ''}`;
      } else {
        if (currentImage) overrides.src = currentImage;
        overrides.key = currentImage || '';
      }
      content = cloneElement(el, overrides);
    }
  }

  const Tag: any = wrapperAs || 'span';

  return (
    <Tag
      className={className}
      style={style}
      data-studio-editable="hero-media"
      data-studio-path={imagePath}
    >
      {content}
      {interactive && (
        <button
          type="button"
          aria-label={`Replace ${label}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPickerOpen(true); }}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          style={pencilStyle}
        >
          <Pencil width={14} height={14} strokeWidth={1.75} />
          {isDirty && <span aria-hidden style={dirtyDotStyle} />}
        </button>
      )}
      {pickerOpen && (
        <MediaPicker
          currentUrl={currentVideo || currentImage}
          currentMediaType={currentVideo ? 'video' : 'image'}
          allowVideo
          sizeType="hero"
          title={label}
          onClose={() => setPickerOpen(false)}
          onSelect={(url, type) => {
            if (type === 'video') apply(videoPath, url);
            else apply(imagePath, url);
            setPickerOpen(false);
          }}
        />
      )}
    </Tag>
  );
}

const pencilStyle: React.CSSProperties = {
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
};
const dirtyDotStyle: React.CSSProperties = {
  position: 'absolute',
  top: -2,
  right: -2,
  width: 10,
  height: 10,
  borderRadius: 999,
  background: '#fbbf24',
  border: '2px solid #000',
};
