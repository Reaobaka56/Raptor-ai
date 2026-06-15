import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Reviews from './pages/Reviews'
import ReviewDetail from './pages/ReviewDetail'
import Analytics from './pages/Analytics'
import Docs from './pages/Docs'
import Blog from './pages/Blog'
import Changelog from './pages/Changelog'
import Discord from './pages/Discord'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import './index.css'

// Removed the unused ThemeToggle import here!
import { ProtectedRoute } from './components/ProtectedRoute'

import AuthError from './pages/AuthError'
import AuthCallback from './pages/AuthCallback'
import DebugTool from './pages/DebugTool';
import RuleManager from './pages/RuleManager'
import OnboardingGuide from './pages/OnboardingGuide'

function App() {
  return (
    <>
      <Routes>
        <Route path="/auth/error" element={<AuthError />} />
        <Route path="/auth/github/callback" element={<AuthCallback />} />
        <Route path="/" element={<Landing />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/discord" element={<Discord />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/reviews" element={<ProtectedRoute><Layout><Reviews /></Layout></ProtectedRoute>} />
        <Route path="/reviews/:id" element={<ProtectedRoute><Layout><ReviewDetail /></Layout></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Layout><Analytics /></Layout></ProtectedRoute>} />
        <Route path="/rules" element={<ProtectedRoute><Layout><RuleManager /></Layout></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute><Layout><OnboardingGuide /></Layout></ProtectedRoute>} />
        <Route path="/debug" element={<DebugTool />} />
      </Routes>
    </>
  )
}

export default App
