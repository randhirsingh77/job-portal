import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './store/AuthContext';
import Nav from './components/Nav';
import Home from './pages/Home';
import Search from './pages/Search';
import JobDetail from './pages/JobDetail';
import Company, { Companies } from './pages/Company';
import Collections from './pages/Collections';
import { Login, Signup } from './pages/Auth';
import { ProfilePage, SavedPage, AlertsPage, TrackerPage, MatchesPage } from './pages/Seeker';
import { RecruiterDashboard, ClaimPage } from './pages/Recruiter';
import Admin from './pages/Admin';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Nav />
        <main className="wrap">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/companies/:id" element={<Company />} />
            <Route path="/collections" element={<Collections />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/tracker" element={<TrackerPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/recruiter" element={<RecruiterDashboard />} />
            <Route path="/recruiter/claim" element={<ClaimPage />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
);
