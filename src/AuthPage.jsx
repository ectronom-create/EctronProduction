import { useState } from 'react'
import { supabase } from './lib/supabase'

export default function AuthPage({ onSession }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [empId, setEmpId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (data.session) onSession(data.session)
      } else {
        // Sign up
        if (!empId.trim()) throw new Error('Employee ID is required for signup.')
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { emp_id: empId, role: 'staff' } // Default to staff
          }
        })
        if (error) throw error
        if (data.session) {
          onSession(data.session)
        } else {
          setError('Signup successful. Please check your email to verify (if email confirmation is enabled), or try logging in.')
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '30px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--text)' }}>
          {isLogin ? 'Login to Dashboard' : 'Create Account'}
        </h2>
        
        {error && <div style={{ background: 'rgba(213,63,63,.1)', color: 'var(--red)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
          {error}
        </div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="name@company.com" 
              required 
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••" 
              required 
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Employee ID</label>
              <input 
                type="text" 
                value={empId} 
                onChange={(e) => setEmpId(e.target.value)} 
                placeholder="e.g., EMP-001" 
                required 
              />
            </div>
          )}

          <button className="btn primary" type="submit" disabled={loading} style={{ marginTop: '8px', width: '100%', justifyContent: 'center' }}>
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: 'var(--text2)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            type="button" 
            onClick={() => { setIsLogin(!isLogin); setError(''); }} 
            style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
          >
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  )
}
