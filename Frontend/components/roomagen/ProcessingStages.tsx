'use client';

import React, { useEffect, useState } from 'react';

interface ProcessingStagesProps {
  tool: string;
  isProcessing: boolean;
  onCancel?: () => void;
}

const STAGES = [
  { id: 1, label: 'Image uploaded & verified', icon: 'cloud_done' },
  { id: 2, label: 'Generation request submitted', icon: 'send' },
  { id: 3, label: 'Roomagen AI analyzing layout', icon: 'psychology' },
  { id: 4, label: 'Synthesizing architectural visualization', icon: 'architecture' },
  { id: 5, label: 'Finalizing high-resolution output', icon: 'verified' },
];

export function ProcessingStages({ tool, isProcessing }: ProcessingStagesProps) {
  const [activeStage, setActiveStage] = useState<number>(3);

  // Smoothly advance visual stages while processing is active
  useEffect(() => {
    if (!isProcessing) return;
    const t1 = setTimeout(() => setActiveStage(3), 1000);
    const t2 = setTimeout(() => setActiveStage(4), 4000);
    const t3 = setTimeout(() => setActiveStage(5), 9000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isProcessing]);

  const toolTitle =
    tool === 'SKETCH_TO_FLOOR_PLAN'
      ? 'Converting Sketch to 2D Floor Plan'
      : tool === 'FLOOR_PLAN_TO_3D'
      ? 'Generating 3D Visualization'
      : 'Colorizing Architectural Floor Plan';

  return (
    <div className="flex flex-col items-center text-center p-8 bg-surface-container-lowest dark:bg-surface-dim rounded-2xl border border-outline-variant dark:border-outline shadow-elevation max-w-lg mx-auto w-full">
      {/* Animated Circular Pulse */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 dark:bg-primary-container/20 flex items-center justify-center animate-pulse">
          <div className="w-14 h-14 rounded-full bg-primary/20 dark:bg-primary-container/40 flex items-center justify-center animate-spin">
            <span className="material-symbols-outlined text-[28px] text-primary dark:text-primary-fixed-dim">
              auto_awesome
            </span>
          </div>
        </div>
      </div>

      <h3 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-2">
        {toolTitle}
      </h3>
      <p className="text-body-sm text-on-surface-variant dark:text-surface-variant max-w-sm mb-6">
        Roomagen AI is analyzing your design. This may take a few moments. You can navigate safely while generation continues in the background.
      </p>

      {/* Progress Stages Checklist */}
      <div className="w-full space-y-2.5 text-left border-t border-outline-variant/60 dark:border-outline/40 pt-5">
        {STAGES.map((s) => {
          const isDone = s.id < activeStage;
          const isCurrent = s.id === activeStage;
          const isUpcoming = s.id > activeStage;

          return (
            <div
              key={s.id}
              className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                isCurrent
                  ? 'bg-secondary-container/30 dark:bg-primary-container/10 border border-primary/20'
                  : ''
              }`}
            >
              <div className="flex-shrink-0">
                {isDone ? (
                  <span className="material-symbols-outlined text-[20px] text-emerald-600 dark:text-emerald-400">
                    check_circle
                  </span>
                ) : isCurrent ? (
                  <span className="material-symbols-outlined text-[20px] text-primary dark:text-primary-fixed-dim animate-spin">
                    progress_activity
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant/40">
                    radio_button_unchecked
                  </span>
                )}
              </div>
              <span
                className={`text-label-md ${
                  isDone
                    ? 'text-on-surface dark:text-inverse-on-surface font-normal'
                    : isCurrent
                    ? 'text-primary dark:text-primary-fixed-dim font-semibold'
                    : 'text-on-surface-variant/50'
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
