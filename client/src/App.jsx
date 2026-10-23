import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './context/AuthContext.jsx';
import { ComposerProvider } from './context/ComposerContext.jsx';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { FullPageSpinner } from './components/ui/Spinner.jsx';

const Login = lazy(() => import('./pages/auth/Login.jsx'));
const Signup = lazy(() => import('./pages/auth/Signup.jsx'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword.jsx'));
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail.jsx'));
const Home = lazy(() => import('./pages/Home.jsx'));
const Explore = lazy(() => import('./pages/Explore.jsx'));
const Search = lazy(() => import('./pages/Search.jsx'));
const Hashtag = lazy(() => import('./pages/Hashtag.jsx'));
const Reels = lazy(() => import('./pages/Reels.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const FollowList = lazy(() => import('./pages/FollowList.jsx'));
const PostDetail = lazy(() => import('./pages/PostDetail.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const Messages = lazy(() => import('./pages/Messages.jsx'));
const Saved = lazy(() => import('./pages/Saved.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const EditProfile = lazy(() => import('./pages/EditProfile.jsx'));
const Moderation = lazy(() => import('./pages/Moderation.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  return (
    <ComposerProvider>
      <Outlet />
    </ComposerProvider>
  );
}

export function PublicOnly() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated') return <Navigate to={location.state?.from?.pathname || '/'} replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<Home />} />
            <Route path="explore" element={<Explore />} />
            <Route path="explore/tags/:tag" element={<Hashtag />} />
            <Route path="search" element={<Search />} />
            <Route path="reels" element={<Reels />} />
            <Route path="u/:username" element={<Profile />} />
            <Route path="u/:username/followers" element={<FollowList kind="followers" />} />
            <Route path="u/:username/following" element={<FollowList kind="following" />} />
            <Route path="p/:id" element={<PostDetail />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="messages" element={<Messages />} />
            <Route path="messages/:id" element={<Messages />} />
            <Route path="saved" element={<Saved />} />
            <Route path="settings" element={<Settings />} />
            <Route path="settings/profile" element={<EditProfile />} />
            <Route path="moderation" element={<Moderation />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
