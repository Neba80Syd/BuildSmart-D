'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { StarRating } from '../StarRating';

export function ReviewForm({ targetType, targetId }: { targetType: 'ARCHITECT' | 'VENDOR' | 'PRODUCT'; targetId: string }) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (title.trim().length < 3 || body.trim().length < 10) {
      toast.error('Please add a title (3+ chars) and a review (10+ chars).');
      return;
    }
    setSending(true);
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType, targetId, rating, title: title.trim(), body: body.trim() }),
    });
    const data = await res.json();
    setSending(false);
    if (res.ok) {
      toast.success('Review submitted for moderation');
      setTitle('');
      setBody('');
      setRating(5);
    } else {
      toast.error(data.error ?? 'Could not submit review');
    }
  };

  const field =
    'w-full bg-white dark:bg-tertiary border border-[#DDE2E0] dark:border-outline-variant/30 rounded-lg px-3 py-2 text-body-sm text-on-surface dark:text-on-surface focus:outline-none focus:border-[#315C4C] dark:focus:border-inverse-primary';

  return (
    <div className="space-y-4">
      <div>
        <span className="block text-label-md text-on-surface-variant dark:text-surface-variant mb-1.5">Your rating</span>
        <StarRating value={rating} onChange={setRating} />
      </div>
      <div>
        <label className="block text-label-md text-on-surface-variant dark:text-surface-variant mb-1.5">Title</label>
        <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summary of your experience" />
      </div>
      <div>
        <label className="block text-label-md text-on-surface-variant dark:text-surface-variant mb-1.5">Review</label>
        <textarea className={`${field} min-h-28`} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share details about quality, communication, and outcome…" />
      </div>
      <button onClick={submit} disabled={sending} className="btn-primary px-5 py-2.5 rounded-lg text-label-md disabled:opacity-60">
        {sending ? 'Submitting…' : 'Submit Review'}
      </button>
    </div>
  );
}
