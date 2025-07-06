
import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import DocumentEditor from './components/DocumentEditor'
import SignDocument from './components/SignDocument'
import LandingPage from './components/LandingPage'
import SignatureSuccess from './components/SignatureSuccess' // Import the new component

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Something went wrong</h1>
          <p className="text-gray-700 text-lg mb-6">Please refresh the page and try again.</p>
          <p className="text-gray-500 text-sm mb-4">
            Error: {this.state.error?.message || 'Unknown error'}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 transition-colors duration-200"
          >
            Refresh Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

function App() {
  const { user } = useAuth();
  
  return (
    <ErrorBoundary>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/dashboard" />} />
              <Route path="/login" element={<Login />} />
              <Route path="/sign/:documentId" element={<SignDocument />} />
              <Route path="/signature-success" element={<SignatureSuccess />} /> {/* New route */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/editor/:documentId"
                element={
                  <ProtectedRoute>
                    <DocumentEditor />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={
                <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
                  <h1 className="text-3xl font-bold text-gray-800 mb-4">Page Not Found</h1>
                  <p className="text-gray-600 text-lg">The page you're looking for doesn't exist.</p>
                </div>
              } />
            </Routes>
          </div>
        </Router>
    </ErrorBoundary>
  )
}

const AppWrapper = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);

export default AppWrapper;
