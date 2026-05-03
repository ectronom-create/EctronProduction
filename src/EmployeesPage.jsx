import { useState } from 'react'

const EMPTY_EMP = { name: '', empId: '', phone: '', email: '' }

export default function EmployeesPage({ employees, onSave, stationCount }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editIdx, setEditIdx] = useState(-1)
  const [form, setForm] = useState({ ...EMPTY_EMP })
  const [formErr, setFormErr] = useState('')

  function openAdd() {
    setEditIdx(-1)
    setForm({ ...EMPTY_EMP })
    setFormErr('')
    setModalOpen(true)
  }

  function openEdit(i) {
    setEditIdx(i)
    setForm({ ...employees[i] })
    setFormErr('')
    setModalOpen(true)
  }

  function handleSave() {
    if (!form.name.trim() || !form.empId.trim()) {
      setFormErr('⚠ الاسم والرقم الوظيفي مطلوبان')
      return
    }
    const dup = employees.findIndex((e, i) => e.empId === form.empId.trim() && i !== editIdx)
    if (dup !== -1) {
      setFormErr('⚠ الرقم الوظيفي مستخدم بالفعل')
      return
    }
    const updated = [...employees]
    const obj = {
      name: form.name.trim(),
      empId: form.empId.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
    }
    if (editIdx === -1) {
      updated.push(obj)
    } else {
      updated[editIdx] = obj
    }
    onSave(updated)
    setModalOpen(false)
  }

  function handleDelete(i) {
    if (!window.confirm(`هل تريد حذف "${employees[i].name}"؟`)) return
    const updated = employees.filter((_, idx) => idx !== i)
    onSave(updated)
  }

  const initials = (name) =>
    name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')

  return (
    <section className="section">
      <div className="toolbar">
        <div>
          <h2>سجل الموظفين</h2>
          <p className="kpi-sub" style={{ marginTop: 2 }}>إدارة بيانات موظفي خط الإنتاج</p>
        </div>
        <button className="btn primary" type="button" onClick={openAdd}>
          + إضافة موظف
        </button>
      </div>

      {/* Stats */}
      <div className="kpi-grid" style={{ marginBottom: 18 }}>
        <div className="kpi-card">
          <div className="kpi-label">إجمالي الموظفين</div>
          <div className="kpi-value">{employees.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">نشطون في الجدول</div>
          <div className="kpi-value" style={{ color: 'var(--green)' }}>{employees.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">المحطات المعرّفة</div>
          <div className="kpi-value" style={{ color: 'var(--amber)' }}>{stationCount}</div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-title">قائمة الموظفين</div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>الموظف</th>
                <th>الرقم الوظيفي</th>
                <th>الهاتف</th>
                <th>البريد الإلكتروني</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text2)', padding: 30 }}>
                    لا يوجد موظفون. اضغط "إضافة موظف" للبدء.
                  </td>
                </tr>
              )}
              {employees.map((e, i) => (
                <tr key={`emp-${e.empId}-${i}`}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="emp-avatar">{initials(e.name)}</span>
                      <span style={{ fontWeight: 600 }}>{e.name}</span>
                    </div>
                  </td>
                  <td><span className="tag">{e.empId}</span></td>
                  <td style={{ color: 'var(--text2)', fontSize: 13 }}>{e.phone || '—'}</td>
                  <td style={{ color: 'var(--text2)', fontSize: 13 }}>{e.email || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn" type="button" onClick={() => openEdit(i)}>تعديل</button>
                      <button className="btn danger" type="button" onClick={() => handleDelete(i)}>حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editIdx === -1 ? 'إضافة موظف جديد' : 'تعديل بيانات الموظف'}</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">الاسم الكامل *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="الاسم الكامل"
                />
              </div>
              <div className="form-group">
                <label className="form-label">الرقم الوظيفي *</label>
                <input
                  type="text"
                  value={form.empId}
                  onChange={(e) => setForm({ ...form, empId: e.target.value })}
                  placeholder="EMP-001"
                />
              </div>
              <div className="form-group">
                <label className="form-label">رقم الهاتف</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+968 XXXX XXXX"
                />
              </div>
              <div className="form-group">
                <label className="form-label">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@company.com"
                />
              </div>
            </div>
            {formErr && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{formErr}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn" type="button" onClick={() => setModalOpen(false)}>إلغاء</button>
              <button className="btn primary" type="button" onClick={handleSave}>حفظ</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
