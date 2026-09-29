'use client';

export function StarRating({
  value,
  onChange,
  size = 'text-[18px]',
  readOnly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value);
        const cls = `${size} ${filled ? 'text-[#A66A00]' : 'text-outline-variant'}`;
        if (readOnly || !onChange) {
          return (
            <span key={star} className={`material-symbols-outlined ${cls}`} style={{ fontVariationSettings: filled ? "'FILL' 1" : undefined }}>
              star
            </span>
          );
        }
        return (
          <button key={star} type="button" onClick={() => onChange(star)} className="hover:scale-110 transition-transform" aria-label={`${star} star`}>
            <span className={`material-symbols-outlined ${cls}`} style={{ fontVariationSettings: filled ? "'FILL' 1" : undefined }}>
              star
            </span>
          </button>
        );
      })}
    </div>
  );
}
