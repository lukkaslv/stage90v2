import { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Music,
  Link2,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';

type AuthMode = 'login' | 'register' | 'invite';
type RegisterRole = 'user' | 'author';

function validSocialUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);
    return url.protocol === 'https:' && (
      (host === 'instagram.com' && parts.length === 1) ||
      (host === 'youtube.com' && parts.length === 2 && ['channel', 'c', 'user'].includes(parts[0])) ||
      (host === 'youtube.com' && parts.length === 1 && parts[0].startsWith('@'))
    );
  } catch { return false; }
}

interface AuthModalProps {
  initialMode: AuthMode;
  onClose: () => void;
}

export default function AuthModal({ initialMode, onClose }: AuthModalProps) {
  const { signIn, signUp, setPassword: savePassword } = useAuth();
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
  const [socialUrl, setSocialUrl] = useState('');

  // Checkboxes
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

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
    if (!email.trim() || password.length < 8 || password !== confirmPassword) {
      setError('შეავსეთ ელ-ფოსტა და მიუთითეთ მინიმუმ 8-სიმბოლოიანი, დადასტურებასთან შესაბამისი პაროლი');
      return;
    }
    if (!validSocialUrl(socialUrl.trim())) {
      setError('მიუთითეთ თქვენი Instagram-ის ან YouTube-ის პროფილის სწორი ბმული');
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
    if (registerRole === 'author' && !artistName.trim()) {
      setError('შეავსეთ ავტორის სახელი');
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
      socialUrl: socialUrl.trim(),
    });
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNotice(result.needsEmailConfirmation
      ? 'ანგარიში შეიქმნა. დაადასტურეთ ელ-ფოსტა, შემდეგ შედით ანგარიშში. შეფასება და რეცენზია ადმინისტრატორის ვერიფიკაციის შემდეგ გახდება ხელმისაწვდომი.'
      : 'ანგარიში შეიქმნა. შეფასება და რეცენზია ადმინისტრატორის ვერიფიკაციის შემდეგ გახდება ხელმისაწვდომი.');
  };

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8 || password !== confirmPassword) {
      setError('პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს და ემთხვეოდეს დადასტურებას');
      return;
    }
    setError('');
    setIsSubmitting(true);
    const result = await savePassword(password);
    setIsSubmitting(false);
    if (result.error) { setError(result.error); return; }
    window.history.replaceState(window.history.state, '', window.location.pathname);
    onClose();
  };

  const inputClass =
    'w-full rounded-lg border border-[#1e1e24] bg-[#0a0a0c] px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 transition-colors focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30';

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
        role="dialog"
        aria-modal="true"
        aria-labelledby="stage-auth-heading"
        className="stage-modal relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2a2a32] bg-[#121215] shadow-2xl animate-fade-in"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="დახურვა"
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-[#1e1e24] hover:text-gray-300"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="mb-6 text-center">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-[#4d5060]">
              <img src="/stage90-mark.svg" alt="" className="h-full w-full" />
            </div>
            <h2 id="stage-auth-heading" className="text-xl font-bold text-white">
              {mode === 'login' ? 'ავტორიზაცია' : mode === 'invite' ? 'პაროლის შექმნა' : 'რეგისტრაცია'}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              ქართული მუსიკის სცენა
            </p>
          </div>

          {/* Mode switch */}
          {mode !== 'invite' && <div className="stage-auth-tabs mb-6 flex gap-1 rounded-xl border border-[#1e1e24] bg-[#0a0a0c] p-1">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                mode === 'login' ? 'bg-blue-400/10 text-blue-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              შესვლა
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                mode === 'register' ? 'bg-blue-400/10 text-blue-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              რეგისტრაცია
            </button>
          </div>}

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
                className="w-full rounded-lg bg-gradient-to-r from-blue-400 to-pink-500 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90 glow-cyan"
              >
                {isSubmitting ? 'მიმდინარეობს...' : 'შესვლა'}
              </button>
              <p className="text-center text-xs text-gray-600">
                არ გაქვთ ანგარიში?{' '}
                <button type="button" onClick={() => setMode('register')} className="text-blue-400 hover:text-blue-300">
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
                    registerRole === 'user' ? 'bg-blue-400/10 text-blue-400' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  მე მომხმარებელი ვარ
                </button>
                <button
                  type="button"
                  onClick={() => { setRegisterRole('author'); setError(''); }}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                    registerRole === 'author' ? 'bg-pink-400/10 text-pink-400' : 'text-gray-500 hover:text-gray-300'
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
                <p className="mt-1 text-[11px] text-gray-600">ამ ელ-ფოსტით შეხვალთ ანგარიშში</p>
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

              {/* AUTHOR ROLE FIELDS */}
              {registerRole === 'author' && (
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

                </>
              )}

              <div className="rounded-lg border border-pink-500/20 bg-pink-500/5 p-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-300">თქვენი Instagram-ის ან YouTube-ის პროფილის ბმული *</label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                  <input type="url" value={socialUrl} onChange={(event) => setSocialUrl(event.target.value)} placeholder="https://www.instagram.com/თქვენი_პროფილი/" className={`${inputClass} pl-10`} />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-gray-400">ანგარიში მაშინვე შეიქმნება. ადმინისტრატორი გადაამოწმებს მითითებულ პროფილს და ჩართავს შეფასებისა და რეცენზიის უფლებას.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-gray-300">პაროლი *
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" className={`${inputClass} mt-1`} />
                </label>
                <label className="block text-sm text-gray-300">გაიმეორეთ პაროლი *
                  <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} autoComplete="new-password" className={`${inputClass} mt-1`} />
                </label>
              </div>

              {/* Legal checkboxes */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setAgreeTerms(!agreeTerms)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    agreeTerms ? 'border-blue-400 bg-blue-400/20' : 'border-[#2a2a32] bg-[#0a0a0c]'
                  }`}
                >
                  {agreeTerms && <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />}
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
                    agreePrivacy ? 'border-blue-400 bg-blue-400/20' : 'border-[#2a2a32] bg-[#0a0a0c]'
                  }`}
                >
                  {agreePrivacy && <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />}
                </button>
                <span className="text-xs leading-relaxed text-gray-400">
                  ვეთანხმები პერსონალურ მონაცემთა დამუშავების პოლიტიკას *
                </span>
              </label>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-gradient-to-r from-blue-400 to-pink-500 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90 glow-cyan"
              >
                {isSubmitting ? 'იქმნება...' : 'ანგარიშის შექმნა'}
              </button>
            </form>
          )}

          {mode === 'invite' && (
            <form onSubmit={handleInvite} className="space-y-4">
              <p className="text-sm text-gray-400">თქვენი განაცხადი დამტკიცებულია. შექმენით პაროლი ანგარიშში შესასვლელად.</p>
              <label className="block text-sm text-gray-300">პაროლი *
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} className={`${inputClass} mt-1`} />
              </label>
              <label className="block text-sm text-gray-300">გაიმეორეთ პაროლი *
                <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} className={`${inputClass} mt-1`} />
              </label>
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="flex items-center gap-2 text-xs text-gray-400">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{showPassword ? 'პაროლის დამალვა' : 'პაროლის ჩვენება'}</button>
              <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-gradient-to-r from-blue-400 to-pink-500 py-3 text-sm font-bold text-black disabled:opacity-50">{isSubmitting ? 'ინახება...' : 'პაროლის შენახვა'}</button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
