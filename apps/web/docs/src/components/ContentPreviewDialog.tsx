import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { MediaPreview } from './MediaPreview';
import { ReviewStatus } from './ReviewStatus';
import type { Row } from '../types';

export type ContentPreviewKind = 'narrations' | 'translations' | 'media' | 'audio' | 'audio-file';

export function ContentPreviewDialog({ row, kind, token, canAutomate, onClose }: {
  row: Row; kind: ContentPreviewKind; token: string; canAutomate: boolean; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current!;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
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
      {hasFile && <MediaPreview key={path} token={token} image={kind === 'media'} path={path}/>}
      {!isAudio && kind !== 'media' && <>
        {kind === 'translations' && row.ShortDescription && <p className="text-preview">{row.ShortDescription}</p>}
        <p className="text-preview">{kind === 'narrations' ? row.TextContent || 'Chưa có văn bản.' : row.Description || 'Chưa có văn bản.'}</p>
      </>}
      {kind === 'audio' && <>
        {row.TTSText && <p className="text-preview">{row.TTSText}</p>}
        {!hasFile && <p className="notice">Bản ghi chưa có file âm thanh. Cần tải file audio thật lên hoặc cấu hình nhà cung cấp TTS để tạo file.</p>}
      </>}
      {canAutomate && kind !== 'media' && kind !== 'audio-file' && <Link to="/admin/automation">Dịch / tạo audio từ văn bản đã duyệt</Link>}
    </div>
  </dialog>, document.body);
}
