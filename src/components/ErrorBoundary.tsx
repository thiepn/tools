import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import {
  attemptModuleLoadRecovery,
  hasModuleLoadRecoveryAttempt,
  isModuleLoadError,
} from '../utilities/module-load-recovery';

interface Props {
  children: ReactNode;
  fallbackToolId?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function errorDiagnostics(error: Error | null, toolId?: string): string {
  const lines = [
    toolId ? `Tool: ${toolId}` : '',
    error ? `${error.name}: ${error.message}` : 'Unexpected application error',
    error?.stack ?? '',
  ];
  return lines.filter(Boolean).join('\n');
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

    // React.lazy import failures can reach the boundary without a preload event
    // in some browsers. Recover exactly once here as a second line of defense.
    attemptModuleLoadRecovery(error);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public override render() {
    if (!this.state.hasError) return this.props.children;

    const moduleFailure = isModuleLoadError(this.state.error);
    const recoveryAttempted = moduleFailure && hasModuleLoadRecoveryAttempt();
    const diagnostics = errorDiagnostics(this.state.error, this.props.fallbackToolId);

    return (
      <div className="w-full max-w-2xl mx-auto p-6 my-12 bg-white dark:bg-neutral-900 rounded-xl border border-red-200 dark:border-red-800 shadow-sm space-y-4 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center text-red-600 dark:text-red-400">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
          {moduleFailure ? 'Tiny Tools could not load this tool' : 'Something went wrong in this tool'}
        </h2>

        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {moduleFailure
            ? recoveryAttempted
              ? 'The tool module is still unavailable after one automatic refresh. Tiny Tools will not keep reloading in a loop.'
              : 'The tool module is unavailable and automatic recovery could not run safely. Reload Tiny Tools to try the current deployment.'
            : 'The tool hit an unexpected runtime error. You can retry the tool or return to the tool directory.'}
        </p>

        <details className="text-left rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-red-800 dark:text-red-300">
            Technical details
          </summary>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-red-200 dark:border-red-900 p-3 text-xs font-mono text-neutral-700 dark:text-neutral-300">
            {diagnostics}
          </pre>
        </details>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <a
            href="#/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to All Tools
          </a>
          <button
            type="button"
            onClick={moduleFailure ? this.handleReload : this.handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {moduleFailure ? 'Reload Tiny Tools' : 'Try Again'}
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
