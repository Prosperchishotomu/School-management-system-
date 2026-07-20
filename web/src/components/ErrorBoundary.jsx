import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // In production, send to error logging service here
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-8">
          <div className="max-w-lg w-full text-center space-y-6 animate-fadeIn">
            {/* Icon */}
            <div className="w-20 h-20 rounded-2xl bg-brick-critical/10 flex items-center justify-center mx-auto text-brick-critical">
              <AlertTriangle className="w-10 h-10" />
            </div>

            {/* Heading */}
            <div>
              <h2 className="text-2xl font-display font-bold text-ink">
                Something went wrong
              </h2>
              <p className="text-sm font-sans text-ink/60 mt-2 leading-relaxed">
                {this.props.fallbackMessage ||
                  'An unexpected error occurred in this section. The rest of the application is still available.'}
              </p>
            </div>

            {/* Dev-mode stack trace */}
            {isDev && this.state.error && (
              <div className="text-left bg-brick-critical/5 border border-brick-critical/20 rounded-xl p-4 text-xs font-mono text-brick-critical overflow-x-auto max-h-48 overflow-y-auto">
                <p className="font-bold">{this.state.error?.toString()}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-2 text-ink/50 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-primary text-white rounded-xl text-sm font-semibold font-sans shadow hover:opacity-90 transition-opacity cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = '/dashboard')}
                className="flex items-center gap-2 px-5 py-2.5 bg-sage/20 text-ink rounded-xl text-sm font-semibold font-sans hover:bg-sage/30 transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
