import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackToolId?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in tool:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-2xl mx-auto p-6 my-12 bg-white dark:bg-neutral-900 rounded-xl border border-red-200 dark:border-red-800 shadow-sm space-y-4 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center text-red-600 dark:text-red-400">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            Something went wrong in this tool
          </h2>

          <p className="text-xs text-neutral-600 dark:text-neutral-400 font-mono p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded text-left overflow-x-auto">
            {this.state.error?.message || 'Unexpected application error'}
          </p>

          <div className="flex items-center justify-center gap-3 pt-2">
            <a
              href="#/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to All Tools
            </a>
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
