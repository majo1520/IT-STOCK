import React from 'react';
import { Alert, Button } from 'react-bootstrap';
import { BsExclamationTriangle } from 'react-icons/bs';

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
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to an error reporting service
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
    
    // You could send this to a logging service
    // logErrorToService(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    
    // If a retry callback is provided, call it
    if (this.props.onRetry) {
      this.props.onRetry();
    }
    
    // If no retry callback is provided, try reloading the component
    if (this.props.shouldReloadOnRetry !== false) {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="error-boundary-container p-3">
          <Alert variant="danger">
            <div className="d-flex align-items-center mb-3">
              <BsExclamationTriangle size={24} className="me-2" />
              <h5 className="mb-0">Something went wrong</h5>
            </div>
            
            <p className="mb-3">
              {this.props.errorMessage || "We're sorry, but an error occurred while rendering this component."}
            </p>
            
            {this.props.showErrorDetails && (
              <div className="error-details small bg-light text-dark p-2 mb-3 rounded">
                <p className="mb-1"><strong>Error:</strong> {this.state.error?.toString()}</p>
                {this.state.errorInfo && (
                  <pre className="mb-0 small" style={{ maxHeight: '200px', overflow: 'auto' }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}
            
            <div className="d-flex justify-content-end">
              <Button 
                variant="outline-light" 
                size="sm" 
                onClick={this.handleRetry}
              >
                {this.props.retryButtonText || "Try Again"}
              </Button>
            </div>
          </Alert>
          
          {this.props.fallback && this.props.fallback}
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary; 