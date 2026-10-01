import { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Music,
  HelpCircle,
  Link2,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';

type AuthMode = 'login' | 'register';
type RegisterRole = 'user' | 'artist';

interface AuthModalProps {
  initialMode: AuthMode;
  onClose: () => void;
}

export default function AuthModal({ initialMode, onClose }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [registerRole, setRegisterRole] = useState<RegisterRole>('user');
  const [showPassword, setShowPassword] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Common register fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // User-specific
  const [displayName, setDisplayName] = useState('');
  const [regReason, setRegReason] = useState('');

  // Artist-specific
  const [artistName, setArtistName] = useState('');
  const [verifyLink, setVerifyLink] = useState('');

  // Checkboxes
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [sentVerification, setSentVerification] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError('შეავსეთ ყველა ველი');
      return;
    }
    setError('');
    setNotice('');
    setIsSubmitting(true);
    const result = await signIn(loginEmail.trim(), loginPassword);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError('შეავსეთ ყველა აუცილებელი ველი');
      return;
    }
    if (password !== confirmPassword) {
      setError('პაროლები არ ემთხვევა ერთმანეთს');
      return;
    }
    if (!agreeTerms || !agreePrivacy) {
      setError('ეთანხმეთ შეთანხმების პირობებს და პოლიტიკას');
      return;
    }
    if (registerRole === 'user' && (!displayName.trim() || !regReason.trim())) {
      setError('შეავსეთ გამოსაჩენი სახელი და რეგისტრაციის მიზეზი');
      return;
    }
    if (registerRole === 'artist' && (!artistName.trim() || !verifyLink.trim() || !sentVerification)) {
      setError('შეავსეთ ავტორის ველები და დაადასტურეთ გაგზავნა');
      return;
    }
    setError('');
    setNotice('');
    setIsSubmitting(true);
    const result = await signUp(email.trim(), password, {
      role: registerRole,
      displayName: displayName.trim(),
      registrationReason: regReason.trim(),
      artistName: artistName.trim(),
      verificationLink: verifyLink.trim(),
    });
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setNotice('ანგარიში შეიქმნა. გთხოვთ, დაადასტუროთ ელ-ფოსტა და შემდეგ შეხვიდეთ.');
    } else {
      onClose();
    }
  };

  const inputClass =
    'w-full rounded-lg border border-[#1e1e24] bg-[#0a0a0c] px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 transition-colors focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2a2a32] bg-[#121215] shadow-2xl animate-fade-in"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-[#1e1e24] hover:text-gray-300"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="mb-6 text-center">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 glow-cyan">
              <Music className="h-6 w-6 text-black" />
            </div>
            <h2 className="text-xl font-bold text-white">
              {mode === 'login' ? 'ავტორიზაცია' : 'რეგისტრაცია'}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              რზტ — რისა ზა თვორჩესტვო
            </p>
          </div>

          {/* Mode switch */}
          <div className="mb-6 flex gap-1 rounded-xl border border-[#1e1e24] bg-[#0a0a0c] p-1">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                mode === 'login' ? 'bg-cyan-400/10 text-cyan-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              შესვლა
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                mode === 'register' ? 'bg-cyan-400/10 text-cyan-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              რეგისტრაცია
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-400">
              {error}
            </div>
          )}
          {notice && (
            <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
              {notice}
            </div>
          )}

          {/* LOGIN MODE */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">ელ-ფოსტა</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="თქვენი ელ-ფოსტა"
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">პაროლი</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} pl-10 pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90 glow-cyan"
              >
                {isSubmitting ? 'მიმდინარეობს...' : 'შესვლა'}
              </button>
              <p className="text-center text-xs text-gray-600">
                არ გაქვთ ანგარიში?{' '}
                <button type="button" onClick={() => setMode('register')} className="text-cyan-400 hover:text-cyan-300">
                  დარეგისტრირდით
                </button>
              </p>
            </form>
          )}

          {/* REGISTER MODE */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Role toggle */}
              <div className="flex gap-1 rounded-xl border border-[#1e1e24] bg-[#0a0a0c] p-1">
                <button
                  type="button"
                  onClick={() => { setRegisterRole('user'); setError(''); }}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                    registerRole === 'user' ? 'bg-cyan-400/10 text-cyan-400' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  მე მომხმარებელი ვარ
                </button>
                <button
                  type="button"
                  onClick={() => { setRegisterRole('artist'); setError(''); }}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                    registerRole === 'artist' ? 'bg-violet-400/10 text-violet-400' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  მე ავტორი ვარ
                </button>
              </div>

              {/* Common: Email */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">ელ-ფოსტა *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="თქვენი ელ-ფოსტა"
                    className={`${inputClass} pl-10`}
                  />
                </div>
                {registerRole === 'user' && (
                  <p className="mt-1 text-[11px] text-gray-600">ასევე იქნება ლოგინი ავტორიზაციისთვის</p>
                )}
              </div>

              {/* USER ROLE FIELDS */}
              {registerRole === 'user' && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">გამოსაჩენი სახელი *</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="თქვენი ნიკნეიმი"
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">რეგისტრაციის მიზეზი *</label>
                    <input
                      type="text"
                      value={regReason}
                      onChange={(e) => setRegReason(e.target.value)}
                      placeholder="მოკლედ აღწერეთ მიზანი"
                      className={inputClass}
                    />
                  </div>
                </>
              )}

              {/* ARTIST ROLE FIELDS */}
              {registerRole === 'artist' && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      ავტორის სახელი პლატფორმებზე *
                    </label>
                    <div className="relative">
                      <Music className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                      <input
                        type="text"
                        value={artistName}
                        onChange={(e) => setArtistName(e.target.value)}
                        placeholder="თქვენი ავტორის სახელი"
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                  </div>

                  {/* Verification box */}
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-violet-400" />
                      <span className="text-sm font-semibold text-violet-300">
                        ავტორის რეგისტრაციის დადასტურება (?)
                      </span>
                    </div>
                    <p className="mb-3 text-xs leading-relaxed text-gray-400">
                      ავტორის სტატუსის მისაღებად საჭიროა თქვენი ოფიციალური ან ვერიფიცირებული
                      სოც. ქსელიდან გაგზავნოთ დასტური ჩვენს ელ-ფოსტაზე.
                    </p>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      მიუთითეთ თქვენი სოც. ქსელის ან/და ელ-ფოსტის მისამართი, საიდანაც მივიღებთ დასტურს *
                    </label>
                    <div className="relative">
                      <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                      <input
                        type="text"
                        value={verifyLink}
                        onChange={(e) => setVerifyLink(e.target.value)}
                        placeholder="https:// ან ელ-ფოსტა"
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                  </div>

                  {/* Sent verification checkbox */}
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setSentVerification(!sentVerification)}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                        sentVerification
                          ? 'border-violet-400 bg-violet-400/20'
                          : 'border-[#2a2a32] bg-[#0a0a0c]'
                      }`}
                    >
                      {sentVerification && <CheckCircle2 className="h-3.5 w-3.5 text-violet-400" />}
                    </button>
                    <span className="text-xs leading-relaxed text-gray-400">
                      გავაგზავნე რეგისტრაციის დასტური ჩემი ოფიციალური/ვერიფიცირებული სოც. ქსელიდან *
                    </span>
                  </label>
                </>
              )}

              {/* Password & Confirm (both roles) */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">პაროლი *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} pl-10 pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">დაადასტურეთ პაროლი *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>

              {/* Legal checkboxes */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setAgreeTerms(!agreeTerms)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    agreeTerms ? 'border-cyan-400 bg-cyan-400/20' : 'border-[#2a2a32] bg-[#0a0a0c]'
                  }`}
                >
                  {agreeTerms && <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />}
                </button>
                <span className="text-xs leading-relaxed text-gray-400">
                  ვეთანხმები მომხმარებლის შეთანხმების პირობებს *
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setAgreePrivacy(!agreePrivacy)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    agreePrivacy ? 'border-cyan-400 bg-cyan-400/20' : 'border-[#2a2a32] bg-[#0a0a0c]'
                  }`}
                >
                  {agreePrivacy && <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />}
                </button>
                <span className="text-xs leading-relaxed text-gray-400">
                  ვეთანხმები პერსონალურ მონაცემთა დამუშავების პოლიტიკას *
                </span>
              </label>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90 glow-cyan"
              >
                {isSubmitting ? 'მიმდინარეობს...' : registerRole === 'user'
                  ? 'მომხმარებლის ანგარიშის შექმნა'
                  : 'ავტორის ანგარიშის შექმნა'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
