'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { Alert, AlertDescription } from '@components/ui/alert';
import {
  AlertTriangle,
  RefreshCw,
  Bug,
  Home,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCircle
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface AdminErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  showDetails: boolean;
  copied: boolean;
}

interface AdminErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  context?: string;
  className?: string;
}

class AdminErrorBoundary extends Component<AdminErrorBoundaryProps, AdminErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: AdminErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      showDetails: false,
      copied: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AdminErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Log to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      console.error('Admin Error Boundary caught an error:', error, errorInfo);
      // Here you would typically send to monitoring service like Sentry
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleRetry = () => {
    const { retryCount } = this.state;

    if (retryCount >= 3) {
      // After 3 retries, suggest a page reload
      window.location.reload();
      return;
    }

    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
      showDetails: false,
      copied: false
    }));
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  handleCopyError = async () => {
    const { error, errorInfo } = this.state;
    const errorText = `
Error: ${error?.message || 'Unknown error'}
Stack: ${error?.stack || 'No stack trace'}
Component Stack: ${errorInfo?.componentStack || 'No component stack'}
Context: ${this.props.context || 'Admin Dashboard'}
Timestamp: ${new Date().toISOString()}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      setTimeout(() => {
        this.setState({ copied: false });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy error to clipboard:', err);
    }
  };

  render() {
    const { children, fallback, context = 'Admin Dashboard', className } = this.props;
    const { hasError, error, errorInfo, retryCount, showDetails, copied } = this.state;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      const isNetworkError = error?.message?.includes('fetch') || error?.message?.includes('network');
      const isTypeError = error?.name === 'TypeError';
      const isCriticalError = retryCount >= 3;

      return (
        <div className={cn('min-h-[400px] flex items-center justify-center p-6', className)}>
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className={cn(
                  'p-4 rounded-full',
                  isCriticalError
                    ? 'bg-red-100 text-red-600'
                    : 'bg-orange-100 text-orange-600'
                )}>
                  <AlertTriangle className="h-8 w-8" />
                </div>
              </div>

              <CardTitle className="text-xl">
                {isCriticalError
                  ? 'Critical Error in Admin Dashboard'
                  : 'Something went wrong'
                }
              </CardTitle>

              <CardDescription className="text-base">
                {isNetworkError
                  ? 'Unable to connect to the server. Please check your internet connection.'
                  : isTypeError
                  ? 'A component failed to load properly. This might be temporary.'
                  : `An error occurred while loading the ${context}.`
                }
              </CardDescription>

              {retryCount > 0 && (
                <div className="flex justify-center mt-3">
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    Retry attempt: {retryCount}/3
                  </Badge>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Error Summary */}
              <Alert className="bg-red-50 border-red-200">
                <Bug className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  <strong>Error:</strong> {error?.message || 'Unknown error occurred'}
                </AlertDescription>
              </Alert>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={this.handleRetry}
                  className="flex items-center gap-2"
                  disabled={retryCount >= 3}
                >
                  <RefreshCw className="h-4 w-4" />
                  {retryCount >= 3 ? 'Reload Page' : 'Try Again'}
                </Button>

                <Button
                  variant="outline"
                  onClick={this.handleGoHome}
                  className="flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go to Home
                </Button>

                <Button
                  variant="outline"
                  onClick={this.toggleDetails}
                  className="flex items-center gap-2"
                >
                  {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {showDetails ? 'Hide' : 'Show'} Details
                </Button>
              </div>

              {/* Detailed Error Information */}
              {showDetails && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-gray-900">Error Details</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={this.handleCopyError}
                      className="flex items-center gap-2"
                    >
                      {copied ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy Error
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Error Stack */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Error Stack:</label>
                    <pre className="text-xs bg-gray-50 p-3 rounded border overflow-x-auto max-h-40 overflow-y-auto">
                      {error?.stack || 'No stack trace available'}
                    </pre>
                  </div>

                  {/* Component Stack */}
                  {errorInfo?.componentStack && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Component Stack:</label>
                      <pre className="text-xs bg-gray-50 p-3 rounded border overflow-x-auto max-h-40 overflow-y-auto">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}

                  {/* Environment Info */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Environment:</label>
                    <div className="text-xs bg-gray-50 p-3 rounded border">
                      <div>User Agent: {navigator.userAgent}</div>
                      <div>URL: {window.location.href}</div>
                      <div>Timestamp: {new Date().toISOString()}</div>
                      <div>Context: {context}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Help Text */}
              <div className="text-center text-sm text-gray-500 pt-4 border-t">
                If this problem persists, please contact your system administrator or check the{' '}
                <a href="/help" className="text-blue-600 hover:underline">help documentation</a>.
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

export { AdminErrorBoundary };
