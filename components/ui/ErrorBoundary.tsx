'use client';
import React from 'react';

interface S { hasError: boolean; msg: string; }
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; label?: string }, S> {
  state: S = { hasError: false, msg: '' };
  static getDerivedStateFromError(e: Error) { return { hasError: true, msg: e.message }; }
  componentDidCatch(e: Error) { console.error('Chart boundary caught:', e); }
  render() {
    if (this.state.hasError) return (
      <div className="rounded-2xl border flex flex-col items-center justify-center p-8 gap-2 text-center"
        style={{ background: 'var(--card)', borderColor: 'rgba(239,68,68,0.25)', minHeight: 160 }}>
        <div className="text-xl">⚠️</div>
        <div className="text-sm font-semibold font-display" style={{ color: 'var(--red)' }}>{this.props.label || 'Render error'}</div>
        <div className="text-xs" style={{ color: 'var(--text3)' }}>{this.state.msg}</div>
      </div>
    );
    return this.props.children;
  }
}
