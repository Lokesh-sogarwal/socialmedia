import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';

export function ConfirmDialog({ title, description, confirmLabel = 'Confirm', tone = 'danger', loading, onConfirm, onCancel, children }) {
  return (
    <Modal title={title} onClose={onCancel} size="sm">
      <div className="p-5">
        {description && <p className="text-sm text-muted">{description}</p>}
        {children}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} data-autofocus>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
