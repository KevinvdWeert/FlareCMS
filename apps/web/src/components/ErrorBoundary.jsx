import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Unexpected UI error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ maxWidth: '760px', margin: '60px auto', padding: '20px', fontFamily: 'sans-serif' }}>
          <h2>Something went wrong.</h2>
          <p>Please refresh the page and try again.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
