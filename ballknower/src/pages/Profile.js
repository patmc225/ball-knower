import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, updateProfile } from 'firebase/auth';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db, linkAnonymousWithCredential } from '../firebaseConfig';
import { ArcadeButton, ArcadeCard } from '../components/ArcadeUI';
import Footer from '../components/Footer';

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [newUsername, setNewUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInError, setSignInError] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);
  const [showExistingSignIn, setShowExistingSignIn] = useState(false);
  const auth = getAuth();

  // Sign in handler for email/password
  const handleSignIn = async (e) => {
    e.preventDefault();
    setSignInError('');
    setSignInLoading(true);
    try {
      await signInWithEmailAndPassword(auth, signInEmail, signInPassword);
    } catch (err) {
      console.error('Sign-in failed:', err);
      setSignInError(err.message || 'Sign-in failed');
    } finally {
      setSignInLoading(false);
    }
  };

  // Load user data
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      
      if (firebaseUser) {
        try {
          // Get user profile from Firestore
          const userRef = doc(db, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            setUserProfile(userData);
            setNewUsername(userData.displayName || '');
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
          setError("Failed to load profile data");
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Check if username is available
  const checkUsernameAvailability = async (username) => {
    if (!username.trim()) {
      setUsernameAvailable(false);
      return false;
    }

    try {
      const lowercaseUsername = username.toLowerCase();
      const usersRef = collection(db, "users");
      const querySnapshot = await getDocs(usersRef);
      const hasMatch = querySnapshot.docs.some(doc => {
        const userData = doc.data();
        const otherUsername = userData.displayName || '';
        return doc.id !== user.uid && otherUsername.toLowerCase() === lowercaseUsername;
      });
      
      const isAvailable = !hasMatch;
      setUsernameAvailable(isAvailable);
      return isAvailable;
    } catch (err) {
      console.error("Error checking username:", err);
      setError("Failed to check username availability");
      return false;
    }
  };

  // Handle username change
  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setNewUsername(value);
    if (value !== userProfile?.displayName) {
      checkUsernameAvailability(value);
    } else {
      setUsernameAvailable(true);
    }
  };

  // Save profile changes
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    
    if (!user) return;
    if (newUsername === userProfile?.displayName) {
      setError("No changes to save");
      return;
    }
    
    // Verify username is available
    const isAvailable = await checkUsernameAvailability(newUsername);
    if (!isAvailable) {
      setError("Username is not available");
      return;
    }
    
    setIsSaving(true);
    setError('');

    try {
      // Update Firestore profile
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        displayName: newUsername
      });
      
      // Update Auth profile if available
      if (user.email) {
        await updateProfile(user, {
          displayName: newUsername
        });
      }
      
      // Update local state
      setUserProfile({
        ...userProfile,
        displayName: newUsername
      });
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error("Error updating profile:", err);
      setError("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle linking anonymous account with email/password
  const handleLinkAccount = async (e) => {
    e.preventDefault();
    
    if (!user || !user.isAnonymous) {
      setError("Only anonymous accounts can be linked");
      return;
    }
    
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    setIsSaving(true);
    setError('');
    
    try {
      const result = await linkAnonymousWithCredential(email, password);
      
      if (result.success) {
        setShowSuccess(true);
        setLinkMode(false);
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        setError(result.error || "Failed to link account");
      }
    } catch (err) {
      console.error("Error linking account:", err);
      setError("Failed to link account: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-dark-bg">
        <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg text-arcade-text font-sans pb-4">
      <div className="max-w-2xl mx-auto px-6 sm:px-8 pt-4 sm:pt-8">
        <div className="flex justify-between items-center mb-10 border-b border-slate-800 pb-6">
          <h1 className="font-heading text-4xl text-white tracking-wide">PROFILE</h1>
          <button
            onClick={() => navigate('/')}
            className="text-slate-400 hover:text-white font-heading text-xl transition-colors"
          >
            Back to Home
          </button>
        </div>

        {!user ? (
          <ArcadeCard glow="blue" className="p-8">
            <h2 className="font-heading text-3xl text-brand-blue mb-4">SIGN IN</h2>
            <p className="mb-6 text-slate-400">
              Sign in to customize your profile and save your progress across devices.
            </p>
            <form onSubmit={handleSignIn} className="space-y-4">
              {signInError && <div className="bg-red-900/30 text-red-300 p-3 rounded border border-red-500/50 mb-4">{signInError}</div>}
              <div>
                <label className="block text-xs uppercase text-slate-500 mb-1">Email</label>
                <input
                    type="email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder="Enter email"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-brand-blue transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-slate-500 mb-1">Password</label>
                <input
                    type="password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-brand-blue transition-colors"
                />
              </div>
              <ArcadeButton
                type="submit"
                disabled={signInLoading}
                className="w-full"
                size="lg"
              >
                {signInLoading ? 'Signing In...' : 'Sign In'}
              </ArcadeButton>
            </form>
          </ArcadeCard>
        ) : (
          <div className="space-y-6">
            
            {error && (
              <div className="bg-red-900/30 border border-red-500/50 text-red-300 p-4 rounded-lg font-mono text-sm animate-fade-in">
                {error}
              </div>
            )}
            
            {showSuccess && (
              <div className="bg-green-900/30 border border-green-500/50 text-green-300 p-4 rounded-lg font-mono text-sm animate-fade-in">
                {linkMode ? "Account linked successfully!" : "Profile updated successfully!"}
              </div>
            )}
            
            {/* Anonymous User Banner */}
            {user.isAnonymous && !linkMode && (
              <div className="bg-yellow-900/20 border border-yellow-500/30 text-yellow-200 p-6 rounded-xl mb-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div>
                    <p className="font-heading text-xl text-yellow-400 mb-1">TEMPORARY ACCOUNT</p>
                    <p className="text-sm text-yellow-200/70">Create an account to save your progress across devices.</p>
                  </div>
                  <ArcadeButton 
                    onClick={() => setLinkMode(true)}
                    variant="secondary"
                    size="sm"
                  >
                    Create Account
                  </ArcadeButton>
                </div>
              </div>
            )}
            
            {/* Email/Password Form for Linking */}
            {linkMode ? (
              <ArcadeCard glow="blue" className="p-8 mb-6">
                <h3 className="font-heading text-2xl text-brand-blue mb-2">CREATE ACCOUNT</h3>
                <p className="text-sm text-slate-400 mb-6">
                  Your stats and username will be saved to your new account.
                </p>
                
                <form onSubmit={handleLinkAccount} className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase text-slate-500 mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-brand-blue transition-colors"
                      placeholder="your.email@example.com"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs uppercase text-slate-500 mb-1">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-brand-blue transition-colors"
                      placeholder="Min. 6 characters"
                      minLength={6}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs uppercase text-slate-500 mb-1">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-brand-blue transition-colors"
                      placeholder="Confirm Password"
                      required
                    />
                  </div>
                  
                  <div className="flex gap-4 pt-2">
                    <ArcadeButton
                      type="submit"
                      disabled={isSaving || !email || !password || password !== confirmPassword}
                      className="flex-1"
                    >
                      {isSaving ? 'Creating...' : 'Create Account'}
                    </ArcadeButton>
                    
                    <button
                      type="button"
                      onClick={() => setLinkMode(false)}
                      className="px-6 py-3 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 font-heading text-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </ArcadeCard>
            ) : (
            /* Username Form */
            <ArcadeCard className="p-8">
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div>
                  <label className="block text-xs uppercase text-slate-500 mb-1">Username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={handleUsernameChange}
                    className={`w-full bg-slate-900 border rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none transition-colors text-xl font-bold ${
                      !usernameAvailable ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-brand-blue'
                    }`}
                    placeholder="Enter username"
                  />
                  {!usernameAvailable && (
                    <p className="text-red-500 text-xs mt-2 font-mono">This username is already taken</p>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    <div>
                    <label className="block text-xs uppercase text-slate-500 mb-1">Email</label>
                    <div className="w-full bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-slate-400 font-mono text-sm">
                        {user.email || 'N/A'}
                    </div>
                    </div>
                </div>
                
                <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-slate-800 mt-4">
                  <ArcadeButton
                    type="submit"
                    disabled={isSaving || !usernameAvailable || newUsername === userProfile?.displayName}
                    className="flex-1"
                    size="lg"
                  >
                    {isSaving ? 'Saving...' : 'SAVE CHANGES'}
                  </ArcadeButton>
                  
                  <button
                    type="button"
                    onClick={() => auth.signOut().then()}
                    className="px-6 py-3 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 font-heading text-lg transition-colors"
                  >
                    SIGN OUT
                  </button>
                </div>
              </form>
            </ArcadeCard>
            )}

            {/* Sign In with Existing Account (revealed on button click) */}
            {user.isAnonymous && !linkMode && (
              <div className="mt-8 pt-8 border-t border-slate-800">
                {!showExistingSignIn ? (
                    <div className="text-center">
                        <p className="text-slate-500 mb-4 text-sm">Already have an account?</p>
                        <button
                        type="button"
                        onClick={() => setShowExistingSignIn(true)}
                        className="text-brand-blue hover:text-blue-400 underline decoration-brand-blue/50 underline-offset-4 font-heading text-xl"
                        >
                        SIGN IN WITH EXISTING ACCOUNT
                        </button>
                    </div>
                ) : (
                  <ArcadeCard glow="pink" className="p-8 relative animate-fade-in">
                    <button onClick={() => setShowExistingSignIn(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white">✕</button>
                    <h3 className="font-heading text-2xl text-brand-pink mb-4">EXISTING ACCOUNT</h3>
                    <p className="mb-6 text-slate-400 text-sm">
                      Sign in here to access your existing stats.
                    </p>
                    <form onSubmit={handleSignIn} className="space-y-4">
                      {signInError && <div className="bg-red-900/30 text-red-300 p-3 rounded border border-red-500/50 mb-4">{signInError}</div>}
                      <div>
                        <label className="block text-xs uppercase text-slate-500 mb-1">Email</label>
                        <input
                            type="email"
                            value={signInEmail}
                            onChange={(e) => setSignInEmail(e.target.value)}
                            placeholder="Email"
                            required
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-brand-pink transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase text-slate-500 mb-1">Password</label>
                        <input
                            type="password"
                            value={signInPassword}
                            onChange={(e) => setSignInPassword(e.target.value)}
                            placeholder="Password"
                            required
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:border-brand-pink transition-colors"
                        />
                      </div>
                      <ArcadeButton
                        type="submit"
                        disabled={signInLoading}
                        variant="secondary"
                        className="w-full"
                      >
                        {signInLoading ? 'Signing In...' : 'Sign In'}
                      </ArcadeButton>
                    </form>
                  </ArcadeCard>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Profile;
