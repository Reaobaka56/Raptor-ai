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
import AuthCallback from './pages/AuthCallback'
import AuthError from './pages/AuthError'


function App() {
  return (
    <Routes>
          <Route path="/auth/error" element={<AuthError />} />
          <Route path="/" element={<Landing />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="/discord" element={<Discord />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
          <Route path="/reviews" element={<Layout><Reviews /></Layout>} />
          <Route path="/reviews/:id" element={<Layout><ReviewDetail /></Layout>} />
          <Route path="/analytics" element={<Layout><Analytics /></Layout>} />
          <Route path="/auth/github/callback" element={<AuthCallback />} />
      </Routes>
  )
}

export default App
