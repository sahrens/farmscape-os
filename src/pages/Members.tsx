import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import * as api from '@/lib/api';
import type { User, UserRole } from '@/lib/types';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  member: 'Member',
  read: 'Read-only',
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Full access + manage members',
  member: 'Log activities, create & edit own elements',
  read: 'View only',
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-sunset-900/40 text-sunset-300',
  member: 'bg-forest-900/40 text-forest-300',
  read: 'bg-earth-700 text-earth-400',
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function InviteForm({ onInvited }: { onInvited: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.members.invite(email.trim(), role);
      setSuccess(`Invite sent to ${email}`);
      setEmail('');
      onInvited();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-earth-800 rounded-xl p-4 border border-earth-700 space-y-3">
      <h3 className="text-sm font-semibold text-earth-200">Invite new member</h3>
      {/* Stacked on mobile, row on larger screens */}
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="email@example.com"
        className="w-full px-3 py-2.5 bg-earth-900 border border-earth-600 rounded-lg text-earth-100 placeholder-earth-500 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
      />
      <div className="flex gap-2">
        <select
          value={role}
          onChange={e => setRole(e.target.value as UserRole)}
          className="flex-1 px-3 py-2.5 bg-earth-900 border border-earth-600 rounded-lg text-earth-100 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
        >
          <option value="member">Member</option>
          <option value="read">Read-only</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="flex-1 py-2.5 bg-forest-600 hover:bg-forest-500 disabled:bg-earth-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? 'Sending...' : 'Send invite'}
        </button>
      </div>
      <p className="text-xs text-earth-500">{ROLE_DESCRIPTIONS[role]}</p>
      {error && <p className="text-sm text-sunset-400">{error}</p>}
      {success && <p className="text-sm text-forest-400">{success}</p>}
    </form>
  );
}

function MemberCard({
  member,
  currentUserId,
  onRoleChange,
  onRemove,
  onResendInvite,
}: {
  member: User;
  currentUserId: string;
  onRoleChange: (id: string, role: UserRole) => void;
  onRemove: (id: string) => void;
  onResendInvite: (id: string) => void;
}) {
  const isSelf = member.id === currentUserId;
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  return (
    <div className="bg-earth-800 rounded-xl border border-earth-700 p-4 space-y-3">
      {/* Top row: avatar + name + badges */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-earth-700 flex items-center justify-center text-earth-400 text-sm font-medium shrink-0">
          {(member.name || member.email)[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-earth-100 break-all">
              {member.name || 'No name set'}
            </span>
            {isSelf && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-earth-600 text-earth-300 shrink-0">
                you
              </span>
            )}
          </div>
          <p className="text-xs text-earth-500 break-all mt-0.5">{member.email}</p>
        </div>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[member.role]}`}>
          {ROLE_LABELS[member.role]}
        </span>
        {member.status === 'invited' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-vanilla-900/40 text-vanilla-300">
            Invited
          </span>
        )}
        {member.status === 'invited' && !isSelf && (
          <button
            onClick={async () => {
              setResending(true);
              try {
                await onResendInvite(member.id);
                setResent(true);
                setTimeout(() => setResent(false), 3000);
              } catch { /* handled by parent */ }
              setResending(false);
            }}
            disabled={resending || resent}
            className="text-xs px-2 py-0.5 rounded-full bg-forest-900/40 text-forest-300 hover:bg-forest-800/60 transition-colors disabled:opacity-50"
          >
            {resent ? 'Sent!' : resending ? 'Sending...' : 'Resend invite'}
          </button>
        )}
        <span className="text-xs text-earth-500 ml-auto">
          {member.last_login ? `Active ${timeAgo(member.last_login)}` : 'Never logged in'}
        </span>
      </div>

      {/* Actions — only for non-self */}
      {!isSelf && (
        <div className="flex items-center gap-2 pt-1 border-t border-earth-700">
          <select
            value={member.role}
            onChange={e => onRoleChange(member.id, e.target.value as UserRole)}
            className="flex-1 px-2.5 py-2 bg-earth-900 border border-earth-600 rounded-lg text-earth-300 text-xs focus:outline-none focus:ring-1 focus:ring-forest-500"
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="read">Read-only</option>
          </select>
          {confirmRemove ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onRemove(member.id)}
                className="px-3 py-2 bg-sunset-600 hover:bg-sunset-500 text-white text-xs rounded-lg transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="px-3 py-2 bg-earth-700 text-earth-300 text-xs rounded-lg hover:bg-earth-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              className="px-3 py-2 text-earth-500 hover:text-sunset-400 text-xs transition-colors"
              title="Remove member"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Members() {
  const user = useStore(s => s.user);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.members.list();
      setMembers(list);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRoleChange = async (id: string, role: UserRole) => {
    try {
      await api.members.updateRole(id, role);
      setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m));
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await api.members.remove(id);
      setMembers(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  const handleResendInvite = async (id: string) => {
    try {
      await api.members.resendInvite(id);
    } catch (err) {
      console.error('Failed to resend invite:', err);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto bg-earth-900 text-earth-100">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <p className="text-earth-500">Admin access required to manage members.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-earth-900 text-earth-100">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-4">
        <div>
          <h1 className="text-xl font-bold text-earth-50">Members</h1>
          <p className="text-sm text-earth-400 mt-1">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>

        <InviteForm onInvited={loadMembers} />

        {loading ? (
          <div className="text-center py-8 text-earth-500">Loading...</div>
        ) : (
          <div className="space-y-3">
            {members.map(m => (
              <MemberCard
                key={m.id}
                member={m}
                currentUserId={user.id}
                onRoleChange={handleRoleChange}
                onRemove={handleRemove}
                onResendInvite={handleResendInvite}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Members;
