import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import {
  PageHeader, Card, Avatar, StatusPill
} from '../components/ui';
import {
  User, Mail, Phone, Shield, School, Lock, Camera, Trash2,
  CheckCircle2, AlertCircle, Save, KeyRound, Sparkles
} from 'lucide-react';

export default function UserProfile() {
  const { user, schoolName, updateUser } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [name, setName] = useState(user?.name || user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Handle image upload from file picker
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (PNG, JPG, or WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile photo must be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      setAvatarUrl(base64);
      try {
        await api.post('/user/avatar', { avatar_url: base64 });
        updateUser({ avatar_url: base64 });
        toast.success('Profile photo uploaded and saved successfully.');
      } catch (err) {
        toast.error('Could not save photo on server.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    setAvatarUrl(null);
    try {
      await api.put('/user/profile', { avatar_url: null });
      updateUser({ avatar_url: null });
      toast.success('Profile photo removed.');
    } catch (err) {
      toast.error('Failed to remove photo.');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Full name is required.');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await api.put('/user/profile', {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null
      });

      const updated = res?.data || { name: name.trim(), email, phone };
      updateUser(updated);
      toast.success('Profile details updated successfully.');
    } catch (err) {
      toast.error(err?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Current password is required.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await api.put('/user/profile', {
        current_password: currentPassword,
        new_password: newPassword
      });

      toast.success('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err?.message || 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Personal Profile & Account Settings"
        subtitle="Manage your personal details, profile picture, security credentials, and system identity."
      />

      {/* 360 User Hero Card */}
      <div className="glass-card p-6 rounded-2xl border border-line bg-surface/80 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="relative group">
            <Avatar
              name={name || user?.username}
              src={avatarUrl}
              size="xl"
              className="w-20 h-20 text-2xl shadow-md ring-4 ring-brand-500/20"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload photo"
              className="absolute bottom-0 right-0 p-2 rounded-full bg-brand-700 text-white shadow-md hover:bg-brand-900 transition-transform active:scale-95 cursor-pointer"
              title="Change profile picture"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">
                {name || user?.username}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/15 text-brand-700 dark:text-brand-300 font-mono capitalize">
                {(user?.role || '').replace('_', ' ')}
              </span>
              <StatusPill status={user?.status || 'active'} size="sm" />
            </div>

            <p className="text-xs text-muted font-mono mt-1">
              @{user?.username} • {schoolName || user?.school_name || 'Active Campus'}
            </p>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Upload Photo</span>
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="p-1.5 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition text-xs"
                  title="Remove custom photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: General Information */}
        <div className="lg:col-span-2">
          <Card
            title="Personal Details"
            subtitle="Update your full name, primary email address, and phone number"
          >
            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-ink block mb-1">Full Legal Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-muted absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Tendai Moyo"
                    className="glass-input w-full pl-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-ink block mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-muted absolute left-3 top-2.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="e.g. tendai@school.ac.zw"
                      className="glass-input w-full pl-9 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-ink block mb-1">Contact Phone</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-muted absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+263 77..."
                      className="glass-input w-full pl-9 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="font-semibold text-muted block mb-1">System Username (Fixed)</label>
                  <input
                    type="text"
                    disabled
                    value={user?.username || ''}
                    className="glass-input w-full font-mono bg-canvas/60 text-muted cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="font-semibold text-muted block mb-1">Designated Role (Fixed)</label>
                  <input
                    type="text"
                    disabled
                    value={(user?.role || '').replace('_', ' ').toUpperCase()}
                    className="glass-input w-full font-mono bg-canvas/60 text-muted cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="btn-primary text-xs flex items-center gap-1.5 px-5 py-2.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingProfile ? 'Saving Changes…' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </form>
          </Card>
        </div>

        {/* Right: Security & Password Change */}
        <div className="lg:col-span-1 space-y-6">
          <Card
            title="Change Password"
            subtitle="Update your system credentials"
          >
            <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-ink block mb-1">Current Password *</label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-muted absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="glass-input w-full pl-9 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">New Password *</label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-muted absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="glass-input w-full pl-9 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-ink block mb-1">Confirm New Password *</label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-muted absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="glass-input w-full pl-9 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="btn-secondary w-full text-xs py-2 flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{savingPassword ? 'Updating…' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </Card>

          {/* Account Metadata */}
          <div className="p-4 rounded-2xl bg-canvas border border-line text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-ink">
              <Shield className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>Institutional Identity</span>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Assigned to <strong>{schoolName || user?.school_name || 'Active Campus'}</strong> with verified credentials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
