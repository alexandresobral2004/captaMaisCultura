'use client';

import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PipelineStepStatus = 'passou' | 'bloqueou' | 'penalizou' | 'idle';

interface PipelineStepProps {
  step: number;
  label: string;
  description: string;
  status?: PipelineStepStatus;
  detail?: string;
  className?: string;
}

const statusConfig: Record<PipelineStepStatus, {
  icon: React.ComponentType<{ className?: string }>;
  className: string;
  label: string;
}> = {
  passou: {
    icon: CheckCircle,
    className: 'pipeline-step-passou',
    label: '✅ Passou',
  },
  bloqueou: {
    icon: XCircle,
    className: 'pipeline-step-bloqueou',
    label: '❌ Bloqueou',
  },
  penalizou: {
    icon: AlertTriangle,
    className: 'pipeline-step-penalizou',
    label: '⚠️ Penalizou',
  },
  idle: {
    icon: Minus,
    className: 'pipeline-step-idle',
    label: '—',
  },
};

export function PipelineStep({
  step,
  label,
  description,
  status = 'idle',
  detail,
  className,
}: PipelineStepProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn('pipeline-step', config.className, className)}>
      <div className="pipeline-step-header">
        <span className="pipeline-step-number">{step}</span>
        <div className="pipeline-step-info">
          <span className="pipeline-step-label">{label}</span>
          <span className="pipeline-step-desc">{description}</span>
        </div>
        {status !== 'idle' && (
          <div className="pipeline-step-status">
            <Icon className="h-4 w-4" />
            <span>{config.label}</span>
          </div>
        )}
      </div>
      {detail && <p className="pipeline-step-detail">{detail}</p>}
    </div>
  );
}

interface PipelineVisualizerProps {
  steps: Array<{
    step: number;
    label: string;
    description: string;
    status?: PipelineStepStatus;
    detail?: string;
  }>;
}

export function PipelineVisualizer({ steps }: PipelineVisualizerProps) {
  return (
    <div className="pipeline-visualizer">
      {steps.map((s, i) => (
        <React.Fragment key={s.step}>
          <PipelineStep {...s} />
          {i < steps.length - 1 && <div className="pipeline-arrow">→</div>}
        </React.Fragment>
      ))}
    </div>
  );
}
