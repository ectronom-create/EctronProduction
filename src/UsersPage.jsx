import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

export default function UsersPage() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchProfiles()
  }, [])

  async function fetchProfiles() {
    setLoading(true)
    // We join with employees to get the name
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, emp_id, employees (name)')

    if (error) {
      setError(error.message)
    } else {
      setProfiles(data || [])
    }
    setLoading(false)
  }

  async function handleRoleChange(profileId, newRole) {
    setError('')
    setSuccess('')
    
    // Optimistic UI update
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, role: newRole } : p))

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', profileId)

    if (error) {
      setError(`Failed to update role: ${error.message}`)
      // Revert on error
      fetchProfiles()
    } else {
      setSuccess('Role updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading system users...</div>

  return (
    <section className="section">
      <div className="toolbar">
        <div>
          <h2>System Users & Access</h2>
          <p className="kpi-sub" style={{ marginTop: 2 }}>Manage roles and permissions for all registered users</p>
        </div>
      </div>

      {(error || success) && (
        <div className="alerts">
          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}
        </div>
      )}

      <div className="card">
        <div className="card-title">Registered Accounts</div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Account Role</th>
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: 'var(--text2)' }}>
                    No users found.
                  </td>
                </tr>
              )}
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td><span className="tag">{p.emp_id || 'N/A'}</span></td>
                  <td style={{ fontWeight: 600 }}>{p.employees?.name || 'Unknown Employee'}</td>
                  <td>
                    <select 
                      value={p.role} 
                      onChange={(e) => handleRoleChange(p.id, e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg2)', cursor: 'pointer' }}
                    >
                      <option value="staff">Staff (Staff View Only)</option>
                      <option value="supervisor">Supervisor (View & Upload)</option>
                      <option value="admin">Admin (Full Access)</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
