import React, { useState } from 'react';
import { useFleet } from '../../context/FleetContext';
import { LogisticsVisual } from './LogisticsVisual';
import { Eye, EyeOff, Shield, User, ArrowRight, Lock, AlertCircle, Sparkles } from 'lucide-react';
import appLogo from '../../assets/app-logo.png';

export const LoginPage = () => {
  const { login } = useFleet();
  const [phone, setPhone] = useState('9876543210');
  const [password, setPassword] = useState('admin123');
  const [selectedRole, setSelectedRole] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handlePhoneChange = (e) => {
    // Clean input: remove whitespace
    const cleanVal = e.target.value.replace(/\s+/g, '');
    setPhone(cleanVal);
    setSelectedRole(null);
    if (errorMsg) setErrorMsg('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    setSelectedRole(null);
    if (errorMsg) setErrorMsg('');
  };

  const setDemoCredentials = (role) => {
    setSelectedRole(role);
    if (role === 'admin') {
      setPhone('9876543210');
      setPassword('admin123');
    } else {
      setPhone('9123456789');
      setPassword('driver123');
    }
    setErrorMsg('');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setErrorMsg('');

    const trimmedPhone = phone.trim();
    const trimmedPassword = password.trim();

    if (!trimmedPhone || !trimmedPassword) {
      setErrorMsg('Invalid credentials: Please enter both phone number and password.');
      return;
    }

    if (trimmedPhone.length < 10) {
      setErrorMsg('Invalid credentials: Please enter a valid 10-digit phone number.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(trimmedPhone, trimmedPassword);
      if (!result || !result.success) {
        setErrorMsg(
          result?.error?.includes('Invalid credentials')
            ? result.error
            : 'Invalid credentials: Incorrect phone number or password.'
        );
      }
    } catch {
      setErrorMsg('Unable to reach the fleet authentication service. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#0D0D0F] text-[#F5F5F5] animate-fadeIn select-none">
      {/* Left Panel - Hero Graphic & Network Centerpiece (Desktop) */}
      <LogisticsVisual />

      {/* Right Panel - Enterprise Login Form */}
      <div className="w-full lg:w-2/5 bg-[#0D0D0F] flex flex-col justify-between p-6 sm:p-10 lg:p-12 min-h-screen overflow-y-auto">
        
        {/* Top Header Branding */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1A1A1D] border border-[#2A2A2E] flex items-center justify-center shadow-lg p-1.5 flex-shrink-0">
              <img src={appLogo} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#F5F5F5] tracking-tight leading-tight">INTELLIGENT FLEET</h2>
              <span className="text-[11px] text-[#9CA3AF] font-semibold tracking-wider uppercase">Enterprise Portal</span>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#1A1A1D] border border-[#2A2A2E] text-[10px] font-bold text-[#9CA3AF]">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>TLS 1.3 SECURE</span>
          </div>
        </div>

        {/* Mobile-Only Hero Banner (< lg) */}
        <div className="lg:hidden my-6 p-4 rounded-2xl bg-[#1A1A1D] border border-[#2A2A2E]">
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Enterprise Fleet Operations</span>
          <h3 className="text-base font-bold text-[#F5F5F5] mt-0.5">Intelligent Fleet Network</h3>
          <p className="text-xs text-[#9CA3AF] mt-1">Real-time fleet operations, dispatch coordination, and route optimization.</p>
        </div>

        {/* Form Container */}
        <div className="my-auto py-4 max-w-md w-full mx-auto">
          
          {/* Welcome Text */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-[#F5F5F5] tracking-tight">Welcome back</h1>
            <p className="mt-1.5 text-xs sm:text-sm text-[#9CA3AF]">
              Sign in to access your fleet operations.
            </p>
          </div>

          {/* Quick Demo Credentials Bar */}
          <div className="mb-5 p-3.5 rounded-2xl bg-[#1A1A1D] border border-[#2A2A2E] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-[#9CA3AF] uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>QUICK ACCESS</span>
              </span>
              <span className="text-[10px] text-[#9CA3AF]">Select operational role to sign in.</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDemoCredentials('admin')}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center space-x-2 focus:outline-none ${
                  selectedRole === 'admin'
                    ? 'bg-white text-[#0D0D0F] border-white shadow-md'
                    : 'bg-[#252528] hover:bg-[#323236] text-[#F5F5F5] border-[#2A2A2E]'
                }`}
              >
                <Shield className={`w-3.5 h-3.5 ${selectedRole === 'admin' ? 'text-[#0D0D0F]' : 'text-amber-400'}`} />
                <span>Admin / Manager</span>
              </button>

              <button
                type="button"
                onClick={() => setDemoCredentials('driver')}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center space-x-2 focus:outline-none ${
                  selectedRole === 'driver'
                    ? 'bg-white text-[#0D0D0F] border-white shadow-md'
                    : 'bg-[#252528] hover:bg-[#323236] text-[#F5F5F5] border-[#2A2A2E]'
                }`}
              >
                <User className={`w-3.5 h-3.5 ${selectedRole === 'driver' ? 'text-[#0D0D0F]' : 'text-emerald-400'}`} />
                <span>Fleet Driver</span>
              </button>
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div 
              role="alert" 
              className="mb-5 p-3.5 rounded-2xl bg-rose-950/70 border border-rose-800/60 text-rose-200 text-xs font-semibold flex items-start space-x-2.5 animate-fadeIn"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold text-rose-100 block">Authentication Error</span>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label 
                htmlFor="phone-input" 
                className="block text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-2"
              >
                Phone Number
              </label>
              <input
                id="phone-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="Enter 10-digit phone number"
                className="w-full h-12 px-4 rounded-xl bg-[#1A1A1D] border border-[#2A2A2E] text-[#F5F5F5] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-white transition-all placeholder:text-[#52525B]"
                required
              />
            </div>

            <div>
              <label 
                htmlFor="password-input" 
                className="block text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Enter password"
                  className="w-full h-12 px-4 pr-12 rounded-xl bg-[#1A1A1D] border border-[#2A2A2E] text-[#F5F5F5] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-white transition-all placeholder:text-[#52525B]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#F5F5F5] transition-colors p-2 rounded-lg hover:bg-white/5 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !phone || !password}
              className="w-full h-12 rounded-xl bg-white hover:bg-neutral-200 text-[#0D0D0F] font-extrabold text-sm shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:pointer-events-none mt-3"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#0D0D0F] border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In to System</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security / Access Note */}
          <div className="mt-5 text-center">
            <p className="text-[11px] text-[#9CA3AF] font-medium flex items-center justify-center space-x-1.5">
              <Lock className="w-3 h-3 text-[#9CA3AF]" />
              <span>Encrypted TLS 1.3 Session • Role-Based Access Control (RBAC)</span>
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-6 border-t border-[#2A2A2E] text-center text-xs text-[#9CA3AF]">
          INTELLIGENT FLEET • ENTERPRISE OPERATIONS PLATFORM
        </div>
      </div>
    </div>
  );
};
