import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MediaPreview } from './MediaPreview';
import { ReviewStatus } from './ReviewStatus';
import { GoogleVoicePreview } from './GoogleVoicePreview';
import type { Row } from '../types';

export type ContentPreviewKind = 'narrations' | 'translations' | 'media' | 'audio' | 'audio-file';

export function ContentPreviewDialog({ row, kind, token, onClose }: {
  row: Row; kind: ContentPreviewKind; token: string; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current!;
    const trigger = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  const isAudio = kind === 'audio' || kind === 'audio-file';
  const hasFile = kind === 'media' || kind === 'audio-file' || (kind === 'audio' && !!row.FileUrl);
  const path = row.SubmissionId ? `cms/submissions/${row.SubmissionId}/preview`
    : kind === 'audio' ? `cms/audio-preview/${row.Id}/stream` : `cms/media/images/${row.Id}/stream`;

  return createPortal(<dialog ref={dialog} className="modal content-preview-dialog" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} onClose={e => { if (!e.currentTarget.open) onClose(); }}>
    <div className="modal-title">
      <h2 id={titleId}>Xem trước: {row.Name || row.Title || row.OriginalFileName || `#${row.Id}`}</h2>
      <button type="button" autoFocus onClick={onClose}>Đóng xem trước</button>
    </div>
    <div className="content-preview-body">
      <ReviewStatus row={row}/>
      {['narrations', 'translations'].includes(kind) && <GoogleVoicePreview token={token} key={`${kind}-${row.Id}`} language={String(row.LanguageCode || 'vi')} text={String(kind === 'narrations' ? row.TextContent || '' : kind === 'translations' ? row.Description || row.ShortDescription || '' : row.TTSText || '')}/>}
      {hasFile && <MediaPreview key={path} token={token} image={kind === 'media'} path={path}/>}
      {!isAudio && kind !== 'media' && <>
        {kind === 'translations' && row.ShortDescription && <p className="text-preview">{row.ShortDescription}</p>}
        <p className="text-preview">{kind === 'narrations' ? row.TextContent || 'Chưa có văn bản.' : row.Description || 'Chưa có văn bản.'}</p>
      </>}
      {kind === 'audio' && <>
        {row.TTSText && <p className="text-preview">{row.TTSText}</p>}
        {!hasFile && <p className="notice">Bản ghi chưa có file âm thanh. Hệ thống tạo giọng nói từ văn bản thuyết minh đã được Admin duyệt; kiểm tra trạng thái tạo giọng.</p>}
      </>}
    </div>
  </dialog>, document.body);
}
