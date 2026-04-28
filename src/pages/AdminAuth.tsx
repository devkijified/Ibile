import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const ADMIN_PASSWORD = 'ADMIN123@IBILE';

export default function AdminAuth({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('adminAuth', 'true');
      onAuth();
      toast.success('Admin access granted!');
      navigate('/admin/dashboard');
    } else {
      toast.error('Incorrect admin password');
      setPassword('');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>🔐 Admin Verification</h1>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>Enter admin password to access this area</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Admin Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '16px'
              }}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: 'pointer',
              marginBottom: '12px'
            }}
          >
            {loading ? 'Verifying...' : 'Verify Admin Access'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/pos')}
            style={{
              width: '100%',
              padding: '12px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            Back to POS
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#9ca3af' }}>
          <p>Contact super admin for password</p>
        </div>
      </div>
    </div>
  );
}
