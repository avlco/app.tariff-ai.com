import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    this.setState({ 
      error, 
      errorInfo 
    });
    
    // TODO: Send error to monitoring service (e.g., Sentry)
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, { extra: errorInfo });
    // }
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
          <Card className="max-w-2xl w-full shadow-xl">
            <CardContent className="p-8">
              <div className="flex flex-col items-center text-center space-y-6">
                {/* Icon */}
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
                </div>

                {/* Title */}
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                    משהו השתבש
                  </h1>
                  <p className="text-slate-600 dark:text-slate-300">
                    אנו מתנצלים על אי הנוחות. התקלה נרשמה והצוות שלנו כבר עובד על התיקון.
                  </p>
                </div>

                {/* Developer Details */}
                {isDev && this.state.error && (
                  <details className="w-full text-left">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white mb-2">
                      פרטים טכניים (מצב פיתוח)
                    </summary>
                    <div className="mt-3 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                            Error:
                          </p>
                          <pre className="text-xs text-red-600 dark:text-red-400 overflow-auto whitespace-pre-wrap break-words">
                            {this.state.error.toString()}
                          </pre>
                        </div>
                        
                        {this.state.errorInfo?.componentStack && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                              Component Stack:
                            </p>
                            <pre className="text-xs text-slate-600 dark:text-slate-400 overflow-auto whitespace-pre-wrap break-words max-h-48">
                              {this.state.errorInfo.componentStack}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </details>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <Button
                    onClick={this.handleReset}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    נסה שוב
                  </Button>
                  
                  <Button
                    onClick={this.handleGoHome}
                    className="w-full sm:w-auto bg-gradient-to-r from-[#42C0B9] to-[#2DA39D] hover:from-[#4DD4CC] hover:to-[#42C0B9] text-white"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    חזור לדף הבית
                  </Button>
                </div>

                {/* Additional Help */}
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  אם הבעיה נמשכת, אנא צור קשר עם התמיכה הטכנית
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
