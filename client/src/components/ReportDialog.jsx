import { useState } from 'react';
import { Modal } from './ui/Modal.jsx';
import { Button } from './ui/Button.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';

const REASONS = [
  ['spam', 'Spam'],
  ['harassment', 'Bullying or harassment'],
  ['hate', 'Hate speech or symbols'],
  ['violence', 'Violence or dangerous behaviour'],
  ['nudity', 'Nudity or sexual content'],
  ['misinformation', 'False information'],
  ['other', 'Something else'],
];

export function ReportDialog({ targetType, target, onClose }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!reason) return setError('Choose a reason');
    setSubmitting(true);
    try {
      await api.post('/reports', { targetType, target, reason, details });
      toast.success('Thanks — our moderators will review this.');
      onClose();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
    return undefined;
  }

  return (
    <Modal title={`Report ${targetType}`} onClose={onClose} size="sm">
      <form onSubmit={submit} className="p-5">
        <fieldset>
          <legend className="mb-3 text-sm text-muted">Why are you reporting this? Reports are anonymous.</legend>
          <div className="space-y-1">
            {REASONS.map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-3 rounded-control px-3 py-2 hover:bg-blush/40">
                <input
                  type="radio"
                  name="reason"
                  value={value}
                  checked={reason === value}
                  onChange={() => {
                    setReason(value);
                    setError('');
                  }}
                  className="h-4 w-4 accent-[rgb(var(--color-rose-deep))]"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="label mt-4" htmlFor="report-details">
          More details (optional)
        </label>
        <textarea id="report-details" className="input min-h-[4.5rem]" maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
        {error && <p className="field-error">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="dark" loading={submitting}>
            Submit report
          </Button>
        </div>
      </form>
    </Modal>
  );
}
