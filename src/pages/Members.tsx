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
      <div className="flex gap-2">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="flex-1 px-3 py-2.5 bg-earth-900 border border-earth-600 rounded-lg text-earth-100 placeholder-earth-500 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
        />
        <select
          value={role}
          onChange={e => setRole(e.target.value as UserRole)}
          className="px-3 py-2.5 bg-earth-900 border border-earth-600 rounded-lg text-earth-100 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
        >
          <option value="member">Member</option>
          <option value="read">Read-only</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 disabled:bg-earth-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors shrink-0"
        >
          {loading ? '...' : 'Invite'}
        </button>
      </div>
      <p className="text-xs text-earth-500">{ROLE_DESCRIPTIONS[role]}</p>
      {error && <p className="text-sm text-sunset-400">{error}</p>}
      {success && <p className="text-sm text-forest-400">{success}</p>}
    </form>
  );
}

function MemberRow({
  member,
  currentUserId,
  onRoleChange,
  onRemove,
}: {
  member: User;
  currentUserId: string;
  onRoleChange: (id: string, role: UserRole) => void;
  onRemove: (id: string) => void;
}) {
  const isSelf = member.id === currentUserId;
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <div className="bg-earth-800 rounded-xl border border-earth-700 px-4 py-3">
      <div className="flex items-center gap-3">
        {/* Avatar placeholder */}
        <div className="w-9 h-9 rounded-full bg-earth-700 flex items-center justify-center text-earth-400 text-sm font-medium shrink-0">
          {(member.name || member.email)[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-earth-100 truncate">
              {member.name || member.email}
            </span>
            {member.status === 'invited' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-vanilla-900/40 text-vanilla-300">
                invited
              </span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ROLE_COLORS[member.role]}`}>
              {ROLE_LABELS[member.role]}
            </span>
            {isSelf && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-earth-600 text-earth-300">
                you
              </span>
            )}
          </div>
          <div className="text-xs text-earth-500 flex items-center gap-2">
            <span className="truncate">{member.email}</span>
            <span className="text-earth-600">·</span>
            <span>Last login: {timeAgo(member.last_login)}</span>
          </div>
        </div>

        {/* Actions */}
        {!isSelf && (
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              value={member.role}
              onChange={e => onRoleChange(member.id, e.target.value as UserRole)}
              className="px-2 py-1.5 bg-earth-900 border border-earth-600 rounded text-earth-300 text-xs focus:outline-none focus:ring-1 focus:ring-forest-500"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="read">Read-only</option>
            </select>
            {confirmRemove ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onRemove(member.id)}
                  className="px-2 py-1.5 bg-sunset-600 hover:bg-sunset-500 text-white text-xs rounded transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmRemove(false)}
                  className="px-2 py-1.5 bg-earth-700 text-earth-300 text-xs rounded hover:bg-earth-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmRemove(true)}
                className="px-2 py-1.5 text-earth-500 hover:text-sunset-400 text-xs transition-colors"
                title="Remove member"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
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
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-earth-50">Members</h1>
          <p className="text-sm text-earth-400 mt-1">
            Manage who has access to the farm. {members.length} member{members.length !== 1 ? 's' : ''}.
          </p>
        </div>

        <InviteForm onInvited={loadMembers} />

        {loading ? (
          <div className="text-center py-8 text-earth-500">Loading...</div>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <MemberRow
                key={m.id}
                member={m}
                currentUserId={user.id}
                onRoleChange={handleRoleChange}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}

export default Members;
