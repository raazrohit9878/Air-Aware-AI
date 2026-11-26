import React from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from './App.jsx';
import AuthGate from './AuthGate.jsx';
import Brand from './components/Brand.jsx';
import './style.css';
import './auth.css';

class AppErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('AirAware failed to render:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-error" role="alert">
          <Brand />
          <h1>AirAware couldn’t load</h1>
          <p>{this.state.error.message || 'An unexpected error interrupted startup.'}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload the app
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AuthGate Dashboard={Dashboard} />
    </AppErrorBoundary>
  </React.StrictMode>,
);
