import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  X,
  Phone,
  Mail,
  IdCard,
  ShieldCheck,
  Camera,
  Upload,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Pencil,
  Loader2,
  KeyRound,
  Copy,
  CheckCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../api/authApi';
import { useAuthStore } from '../store/authStore';

const ProfileModal = ({ isOpen, onClose, user }) => {
  const { updateUser, refreshUser } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [gmail, setGmail] = useState('');
  const [number, setNumber] = useState('');
  
  // Password states
  const [enablePasswordChange, setEnablePasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Avatar states
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const fileInputRef = useRef(null);

  // Reset/sync state when modal opens or user changes
  useEffect(() => {
    if (user && isOpen) {
      setName(user.name || '');
      setGmail(user.gmail || '');
      setNumber(user.number || '');
      setAvatarPreview(user.avatarUrl || user.avatar_url || '');
      setAvatarFile(null);
      setRemoveAvatar(false);
      setEnablePasswordChange(false);
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setIsEditing(false);
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const currentAvatar = removeAvatar
    ? ''
    : avatarPreview || user?.avatarUrl || user?.avatar_url || '';

  const handleCopy = (text, field) => {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`Copied ${field} to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (JPG, PNG, WEBP)');
      return;
    }

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }

    setAvatarFile(file);
    setRemoveAvatar(false);

    // Create local preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatarFile(null);
    setAvatarPreview('');
    setRemoveAvatar(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCancelEdit = () => {
    setName(user?.name || '');
    setGmail(user?.gmail || '');
    setNumber(user?.number || '');
    setAvatarPreview(user?.avatarUrl || user?.avatar_url || '');
    setAvatarFile(null);
    setRemoveAvatar(false);
    setEnablePasswordChange(false);
    setNewPassword('');
    setConfirmPassword('');
    setIsEditing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedGmail = gmail.trim();
    const trimmedNumber = number.trim();

    if (!trimmedName) {
      toast.error('Name cannot be empty');
      return;
    }

    if (trimmedGmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedGmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (enablePasswordChange) {
      if (!newPassword.trim()) {
        toast.error('Please enter your new password');
        return;
      }
      if (newPassword.length < 4) {
        toast.error('Password must be at least 4 characters long');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }

    setLoading(true);
    const toastId = toast.loading(avatarFile ? 'Uploading photo & updating profile...' : 'Updating profile...');

    try {
      const updates = {
        name: trimmedName,
        gmail: trimmedGmail,
        number: trimmedNumber
      };

      if (enablePasswordChange && newPassword.trim()) {
        updates.password = newPassword.trim();
      }

      if (avatarFile) {
        updates.avatarFile = avatarFile;
      } else if (removeAvatar) {
        updates.avatarUrl = '';
      }

      const updated = await authApi.updateProfile(user.id, updates);
      
      // Update global auth store immediately
      updateUser(updated);
      await refreshUser();

      toast.success('Profile updated successfully!', { id: toastId });
      setIsEditing(false);
      setEnablePasswordChange(false);
      setNewPassword('');
      setConfirmPassword('');
      setAvatarFile(null);
      setRemoveAvatar(false);
    } catch (err) {
      console.error('Failed to update profile:', err);
      toast.error(err.message || 'Failed to update profile. Please try again.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const roleLabel =
    user?.role === 'ADMIN'
      ? 'Administrator'
      : user?.role === 'TESTER'
      ? 'Tester'
      : user?.role === 'HR'
      ? 'HR Manager'
      : 'Employee';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-5 md:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[88dvh] sm:max-h-[85vh] flex flex-col overflow-hidden border border-gray-100/80 ring-1 ring-black/5 animate-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header with rich dark navy gradient */}
        <div className="bg-gradient-to-b from-slate-900 via-[#0a2540] to-[#001f35] p-5 sm:p-6 text-white relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col items-center text-center">
            {/* Enlarged Avatar container */}
            <div className="relative group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white shadow-xl overflow-hidden bg-white/15 flex items-center justify-center flex-shrink-0">
                {currentAvatar ? (
                  <img
                    src={currentAvatar}
                    alt={user?.name || 'Profile'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-[#004b7a] text-white flex items-center justify-center font-bold text-3xl sm:text-4xl select-none">
                    {String(name || user?.name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Photo upload overlay icon when in edit mode */}
              {isEditing && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/40 hover:bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center text-white transition-all cursor-pointer border-4 border-transparent"
                  title="Upload profile photo"
                >
                  <Camera size={22} className="animate-pulse" />
                  <span className="text-[10px] font-semibold mt-1">Change</span>
                </button>
              )}
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/jpg, image/webp"
              className="hidden"
            />

            {/* Photo Action Buttons in Edit Mode */}
            {isEditing && (
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm border border-white/30 transition cursor-pointer"
                >
                  <Upload size={12} /> Choose Photo
                </button>
                {currentAvatar && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/80 hover:bg-red-500 text-white backdrop-blur-sm border border-red-400/40 transition cursor-pointer"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>
            )}

            {/* Employee Full Name in Header */}
            <h3 className="text-xl sm:text-2xl font-bold text-white mt-3 truncate max-w-[90%] tracking-tight">
              {isEditing ? name || 'Edit Profile' : user?.name || 'User Profile'}
            </h3>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap justify-center">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider bg-white/15 text-white backdrop-blur-sm border border-white/20">
                <ShieldCheck size={12} /> {roleLabel}
              </span>
              {user?.position && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-white/10 text-slate-100 border border-white/20">
                  {user.position}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 max-h-[calc(85vh-200px)] overflow-y-auto">
          {!isEditing ? (
            /* ================= VIEW MODE ================= */
            <div className="space-y-3.5">
              {/* Profile Details List */}
              <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70 space-y-3">
                {/* Username / Login ID */}
                <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-200/60">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                      <IdCard size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Login ID (Username)</p>
                      <p className="text-[13px] font-semibold text-gray-800 truncate">{user?.id || '-'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(user?.id, 'Login ID')}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-white transition cursor-pointer"
                    title="Copy Login ID"
                  >
                    {copiedField === 'Login ID' ? <CheckCheck size={15} className="text-emerald-600" /> : <Copy size={15} />}
                  </button>
                </div>

                {/* Phone Number */}
                <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-200/60">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                      <Phone size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Phone Number</p>
                      <p className="text-[13px] font-semibold text-gray-800 truncate">{user?.number || '-'}</p>
                    </div>
                  </div>
                  {user?.number && (
                    <button
                      onClick={() => handleCopy(user?.number, 'Phone Number')}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-white transition cursor-pointer"
                      title="Copy Phone Number"
                    >
                      {copiedField === 'Phone Number' ? <CheckCheck size={15} className="text-emerald-600" /> : <Copy size={15} />}
                    </button>
                  )}
                </div>

                {/* Gmail / Email */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center flex-shrink-0">
                      <Mail size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Email (Gmail)</p>
                      <p className="text-[13px] font-semibold text-gray-800 truncate">{user?.gmail || '-'}</p>
                    </div>
                  </div>
                  {user?.gmail && (
                    <button
                      onClick={() => handleCopy(user?.gmail, 'Email')}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-white transition cursor-pointer"
                      title="Copy Email"
                    >
                      {copiedField === 'Email' ? <CheckCheck size={15} className="text-emerald-600" /> : <Copy size={15} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Page Access for non-admins */}
              {user?.role !== 'ADMIN' && user?.role !== 'TESTER' && (
                <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70">
                  <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2">Granted Page Permissions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(user?.accessPages || {})
                      .filter(([key, level]) => level && level !== 'none' && !key.startsWith('__'))
                      .map(([page, level]) => (
                        <span
                          key={page}
                          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border bg-sky-50 text-sky-700 border-sky-200 capitalize"
                        >
                          {page.replace(/([A-Z])/g, ' $1').trim()}: <strong className="ml-1 uppercase text-[10px]">{level}</strong>
                        </span>
                      ))}
                    {Object.entries(user?.accessPages || {}).filter(([k, l]) => l && l !== 'none' && !k.startsWith('__')).length === 0 && (
                      <span className="text-xs text-gray-400 italic">No specific page access granted.</span>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex-1 bg-[#002b49] hover:bg-[#001f35] text-white font-semibold py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  <Pencil size={16} /> Edit Profile
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* ================= EDIT MODE ================= */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-tight">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Email / Gmail */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-tight">
                  Email Address (Gmail)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="email"
                    value={gmail}
                    onChange={(e) => setGmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-tight">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="tel"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="Enter 10-digit phone number"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Change Password Section */}
              <div className="pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEnablePasswordChange(!enablePasswordChange)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    enablePasswordChange
                      ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                    <KeyRound size={15} className="text-indigo-600" />
                    <span>Change Password</span>
                  </div>
                  <span className="text-xs font-semibold text-indigo-600">
                    {enablePasswordChange ? 'Cancel Change' : '+ Set New Password'}
                  </span>
                </button>

                {enablePasswordChange && (
                  <div className="mt-3 p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-3 animate-in fade-in duration-150">
                    {/* New Password */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-tight">
                        New Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          className="w-full pl-9 pr-10 py-2 text-sm border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm New Password */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-tight">
                        Confirm New Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          className="w-full pl-9 pr-10 py-2 text-sm border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>

                      {/* Password Match / Mismatch Indicator */}
                      {newPassword && confirmPassword && (
                        <div className="flex items-center gap-1.5 pt-1 text-xs">
                          {newPassword === confirmPassword ? (
                            <span className="text-emerald-600 font-semibold flex items-center gap-1">
                              <Check size={13} /> Passwords match
                            </span>
                          ) : (
                            <span className="text-red-500 font-semibold flex items-center gap-1">
                              <AlertCircle size={13} /> Passwords do not match
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              <div className="pt-3 flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving Changes...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Save Changes
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleCancelEdit}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
