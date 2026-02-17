import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch and handle React component errors
 * Prevents the entire app from crashing when a component throws an error
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-black p-4">
          <div className="glass-panel p-8 rounded-3xl max-w-2xl w-full">
            <div className="text-center space-y-6">
              <div className="text-6xl">⚠️</div>
              <h2 className="text-3xl gothic-font text-[color:var(--accent)] uppercase tracking-[0.2em]">
                Something Went Wrong
              </h2>
              <p className="text-zinc-400 text-base leading-relaxed">
                The application encountered an unexpected error. This has been logged
                and we apologize for the inconvenience.
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left mt-6">
                  <summary className="cursor-pointer text-sm text-zinc-500 uppercase tracking-[0.2em] mb-3">
                    Error Details (Development Only)
                  </summary>
                  <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-4 space-y-2">
                    <p className="text-red-400 font-mono text-xs">
                      {this.state.error.toString()}
                    </p>
                    {this.state.errorInfo && (
                      <pre className="text-red-300 font-mono text-xs overflow-auto max-h-60">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </details>
              )}

              <div className="flex gap-4 justify-center pt-4">
                <button
                  onClick={this.handleReset}
                  className="px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-[0.2em] bg-[color:var(--accent)] text-black hover:brightness-105 transition-all"
                >
                  Try Again
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-[0.2em] border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-all"
                >
                  Return Home
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
