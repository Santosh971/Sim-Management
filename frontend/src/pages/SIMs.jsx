import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  FiPlus,
  FiSearch,
  FiDownload,
  FiEdit,
  FiTrash2,
  FiSmartphone,
  FiMessageCircle,
  FiX,
  FiUser,
  FiUpload,
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import {
  PageContainer,
  PageHeader,
  Card,
  CardBody,
  StatCard,
  Badge,
  Button,
  Table,
  Spinner,
  Pagination,
  Grid,
} from '../components/ui'

// Toggle Switch Component
function ToggleSwitch({ enabled, onChange, loading }) {
  return (
    <button
      onClick={onChange}
      disabled={loading}
      style={{
        position: 'relative',
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        backgroundColor: enabled ? '#16a34a' : '#d1d5db',
        border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'background-color 0.2s',
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: '2px',
        left: enabled ? '22px' : '2px',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        backgroundColor: '#ffffff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }} />
    </button>
  )
}

// SIM Modal Component
function SimModal({ isOpen, onClose, sim, onSave, users, loadingUsers }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    mobileNumber: '',
    operator: 'Jio',
    circle: '',
    status: 'active',
    notes: '',
    assignedTo: '',
  })

  const operators = ['Jio', 'Airtel', 'Vi', 'BSNL', 'MTNL', 'Other']
  const statuses = ['active', 'inactive', 'suspended', 'lost']

  useEffect(() => {
    if (sim) {
      setFormData({
        mobileNumber: sim.mobileNumber || '',
        operator: sim.operator || 'Jio',
        circle: sim.circle || '',
        status: sim.status || 'active',
        notes: sim.notes || '',
        assignedTo: sim.assignedTo?._id || '',
      })
    } else {
      setFormData({
        mobileNumber: '',
        operator: 'Jio',
        circle: '',
        status: 'active',
        notes: '',
        assignedTo: '',
      })
    }
  }, [sim])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.mobileNumber) {
      toast.error('Mobile Number is required')
      return
    }

    if (!/^\d{10}$/.test(formData.mobileNumber)) {
      toast.error('Mobile number must be 10 digits')
      return
    }

    setLoading(true)

    try {
      if (sim) {
        await onSave(sim._id, formData)
        toast.success('SIM updated successfully')
      } else {
        await onSave(null, formData)
        toast.success('SIM added successfully')
      }
      onClose()
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || 'Operation failed'
      if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.')
      } else {
        toast.error(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'auto'
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
            {sim ? 'Edit SIM' : 'Add New SIM'}
          </h2>
          <button onClick={onClose} style={{ padding: '8px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <FiX style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px', color: '#374151' }}>
              Mobile Number *
            </label>
            <input
              type="text"
              name="mobileNumber"
              value={formData.mobileNumber}
              onChange={handleChange}
              placeholder="10-digit mobile number"
              maxLength="10"
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px', color: '#374151' }}>
                Operator
              </label>
              <select
                name="operator"
                value={formData.operator}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                {operators.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px', color: '#374151' }}>
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px', color: '#374151' }}>
              Circle
            </label>
            <select
              name="circle"
              value={formData.circle}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box',
                color: formData.circle ? '#111827' : '#9ca3af',
              }}
            >
              <option value="">Select Circle / State</option>

              {/* Telecom Circles (as used by operators) */}
              <optgroup label="Metro Circles">
                <option value="Delhi">Delhi</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Kolkata">Kolkata</option>
                <option value="Chennai">Chennai</option>
              </optgroup>

              <optgroup label="Category A Circles">
                <option value="Maharashtra">Maharashtra</option>
                <option value="Karnataka">Karnataka</option>
                <option value="Tamil Nadu">Tamil Nadu</option>
                <option value="Andhra Pradesh">Andhra Pradesh</option>
                <option value="Gujarat">Gujarat</option>
                <option value="Rajasthan">Rajasthan</option>
                <option value="Uttar Pradesh (East)">Uttar Pradesh (East)</option>
                <option value="Uttar Pradesh (West)">Uttar Pradesh (West)</option>
              </optgroup>

              <optgroup label="Category B Circles">
                <option value="Kerala">Kerala</option>
                <option value="Punjab">Punjab</option>
                <option value="Haryana">Haryana</option>
                <option value="Madhya Pradesh">Madhya Pradesh</option>
                <option value="West Bengal">West Bengal</option>
                <option value="Odisha">Odisha</option>
                <option value="Bihar">Bihar</option>
                <option value="Jharkhand">Jharkhand</option>
                <option value="Telangana">Telangana</option>
              </optgroup>

              <optgroup label="Category C Circles">
                <option value="Himachal Pradesh">Himachal Pradesh</option>
                <option value="Uttarakhand">Uttarakhand</option>
                <option value="Goa">Goa</option>
                <option value="Assam">Assam</option>
                <option value="North East">North East</option>
                <option value="Jammu & Kashmir">Jammu & Kashmir</option>
                <option value="Chhattisgarh">Chhattisgarh</option>
                <option value="Andaman & Nicobar">Andaman & Nicobar</option>
              </optgroup>

              <optgroup label="Union Territories">
                <option value="Chandigarh">Chandigarh</option>
                <option value="Dadra & Nagar Haveli">Dadra & Nagar Haveli</option>
                <option value="Daman & Diu">Daman & Diu</option>
                <option value="Lakshadweep">Lakshadweep</option>
                <option value="Puducherry">Puducherry</option>
                <option value="Ladakh">Ladakh</option>
              </optgroup>
            </select>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px', color: '#374151' }}>
              <FiUser style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
              Assigned User
            </label>
            {loadingUsers ? (
              <div style={{ padding: '10px 14px', color: '#6b7280', fontSize: '14px' }}>
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div style={{
                padding: '10px 14px',
                backgroundColor: '#fffbeb',
                borderRadius: '8px',
                border: '1px solid #fcd34d',
              }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#92400e' }}>
                  No users found. Please add a user first to assign SIMs.
                </p>
              </div>
            ) : (
              <select
                name="assignedTo"
                value={formData.assignedTo}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} {u.email ? `(${u.email})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px', color: '#374151' }}>
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes..."
              rows="3"
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={loading}>
              {loading ? 'Saving...' : (sim ? 'Update' : 'Add SIM')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// SIM List Modal Component
function SimListModal({ isOpen, onClose, title, sims }) {
  if (!isOpen) return null

  const columns = [
    { key: 'mobileNumber', header: 'Mobile Number' },
    {
      key: 'operator',
      header: 'Operator',
      render: (row) => <Badge variant="default">{row.operator}</Badge>
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : row.status === 'inactive' ? 'danger' : 'warning'}>
          {row.status}
        </Badge>
      )
    },
    { key: 'circle', header: 'Circle', render: (row) => row.circle || '-' },
    {
      key: 'messaging',
      header: 'Messaging',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          {row.whatsappEnabled && <span style={{ fontSize: '12px', color: '#25d366' }}>WhatsApp</span>}
          {row.telegramEnabled && <span style={{ fontSize: '12px', color: '#0088cc' }}>Telegram</span>}
          {!row.whatsappEnabled && !row.telegramEnabled && <span style={{ fontSize: '12px', color: '#6b7280' }}>None</span>}
        </div>
      )
    },
    { key: 'assignedTo', header: 'Assigned To', render: (row) => row.assignedTo?.name || 'Unassigned' },
  ]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '900px',
        maxHeight: '80vh',
        overflow: 'auto',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ padding: '8px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <FiX style={{ width: '20px', height: '20px' }} />
          </button>
        </div>
        <div style={{ padding: '24px' }}>
          {sims.length > 0 ? (
            <Table columns={columns} data={sims} emptyMessage="No SIMs Found" />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <FiSmartphone style={{ width: '32px', height: '32px', marginBottom: '8px' }} />
              <p>No SIMs in this category</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Bulk Upload Modal Component
function BulkUploadModal({ isOpen, onClose, onSuccess }) {
  const { api } = useAuth()
  const [file, setFile] = useState(null)
  const [parsedData, setParsedData] = useState([])
  const [errors, setErrors] = useState([])
  const [uploading, setUploading] = useState(false)

  const validOperators = ['Jio', 'Airtel', 'Vi', 'BSNL', 'MTNL', 'Other']
  const validStatuses = ['active', 'inactive', 'suspended', 'lost']

  const downloadTemplate = () => {
    const template = [
      { 'Mobile Number': '9876543210', 'Operator': 'Jio', 'Circle': 'Maharashtra', 'Status': 'active', 'Assigned User Email': 'user@example.com', 'Notes': 'Optional notes' },
    ]
    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'SIM Import Template')
    XLSX.writeFile(wb, 'sim-import-template.xlsx')
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setErrors([])

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(sheet)

        const validationErrors = []
        const validatedData = jsonData.map((row, index) => {
          const mobileNumber = String(row['Mobile Number'] || row.mobileNumber || row.mobile_number || '').trim()
          const operator = String(row['Operator'] || row.operator || 'Jio').trim()
          const circle = String(row['Circle'] || row.circle || '').trim()
          const status = String(row['Status'] || row.status || 'active').toLowerCase().trim()
          const assignedUserEmail = String(row['Assigned User Email'] || row.assignedUserEmail || row.assigned_user_email || '').trim().toLowerCase()
          const notes = String(row['Notes'] || row.notes || '').trim()

          const rowErrors = []

          if (!mobileNumber) {
            rowErrors.push('Missing Mobile Number')
          } else if (!/^\d{10}$/.test(mobileNumber)) {
            rowErrors.push('Invalid 10-digit mobile number')
          }

          if (!validOperators.includes(operator)) {
            rowErrors.push(`Invalid Operator. Must be one of: ${validOperators.join(', ')}`)
          }

          if (!validStatuses.includes(status)) {
            rowErrors.push(`Invalid Status. Must be one of: ${validStatuses.join(', ')}`)
          }

          // Validate email format if provided
          if (assignedUserEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assignedUserEmail)) {
            rowErrors.push('Invalid email format for Assigned User')
          }

          if (rowErrors.length > 0) {
            validationErrors.push({ row: index + 2, errors: rowErrors })
          }

          return { mobileNumber, operator, circle, status, assignedUserEmail, notes }
        })

        setParsedData(validatedData)
        setErrors(validationErrors)
      } catch (error) {
        setErrors([{ row: 0, errors: ['Failed to parse Excel file. Please check the format.'] }])
        setParsedData([])
      }
    }
    reader.readAsArrayBuffer(selectedFile)
  }

  const handleUpload = async () => {
    if (errors.length > 0 || parsedData.length === 0) return

    // Check if user is authenticated
    const token = localStorage.getItem('token')
    if (!token) {
      toast.error('Please log in to upload SIMs')
      onClose()
      return
    }

    setUploading(true)
    try {
      const response = await api.post('/sims/bulk', { sims: parsedData })
      toast.success(`${response.data.data?.inserted || response.data.inserted || parsedData.length} SIMs uploaded successfully`)
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Bulk upload error:', error)

      // Handle validation errors with details
      // if (error.response?.data?.errors) {
      if (Array.isArray(error.response?.data?.errors)) {
        const errorDetails = error.response.data.errors
          .map(e => `Row ${e.row || e.index}: ${e.errors?.join(', ') || e.message || 'Invalid data'}`)
          .slice(0, 5)
          .join('\n')
        toast.error(`Validation errors:\n${errorDetails}${error.response.data.errors.length > 5 ? '\n...and more' : ''}`)
      } else if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.')
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      } else if (error.response?.status === 403) {
        toast.error('Subscription limit reached. Please upgrade your plan.')
      } else if (error.response?.status === 400) {
        toast.error(error.response?.data?.message || 'Invalid data format. Please check your file.')
      } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        toast.error('Network error. Please check if the server is running.')
      } else {
        toast.error(error.response?.data?.message || error.message || 'Bulk upload failed')
      }
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setParsedData([])
    setErrors([])
    onClose()
  }

  if (!isOpen) return null

  const previewColumns = [
    { key: 'mobileNumber', header: 'Mobile Number' },
    { key: 'operator', header: 'Operator' },
    { key: 'circle', header: 'Circle' },
    { key: 'status', header: 'Status' },
    { key: 'assignedUserEmail', header: 'Assigned User', render: (row) => row.assignedUserEmail || '-' },
  ]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
    }} onClick={handleClose}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflow: 'auto',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Bulk Upload SIMs</h2>
          <button onClick={handleClose} style={{ padding: '8px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <FiX style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Download Template Section */}
          <div style={{ marginBottom: '20px' }}>
            <Button variant="secondary" onClick={downloadTemplate}>
              Download Excel Template
            </Button>
          </div>

          {/* File Upload Area */}
          <div
            onClick={() => document.getElementById('bulk-file-input').click()}
            style={{
              border: '2px dashed #d1d5db',
              borderRadius: '8px',
              padding: '32px',
              textAlign: 'center',
              cursor: 'pointer',
              marginBottom: '20px',
              backgroundColor: file ? '#f0fdf4' : '#f9fafb',
            }}
          >
            <FiUpload style={{ width: '32px', height: '32px', color: '#6b7280', marginBottom: '8px' }} />
            <p style={{ margin: 0, color: '#374151', fontWeight: '500' }}>
              {file ? file.name : 'Click to select or drag & drop Excel file (.xlsx, .xls)'}
            </p>
            <input
              id="bulk-file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* Record Count */}
          {parsedData.length > 0 && (
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px' }}>
              <span style={{ fontWeight: '500', color: '#1e40af' }}>{parsedData.length} records found in file</span>
            </div>
          )}

          {/* Validation Errors */}
          {errors.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#dc2626', fontSize: '14px' }}>Validation Errors:</h4>
              {errors.map((err, idx) => (
                <div key={idx} style={{ fontSize: '13px', color: '#dc2626', marginBottom: '4px' }}>
                  Row {err.row}: {err.errors.join(', ')}
                </div>
              ))}
            </div>
          )}

          {/* Preview Table */}
          {parsedData.length > 0 && errors.length === 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Preview (first 5 rows):</h4>
              <Table columns={previewColumns} data={parsedData.slice(0, 5)} emptyMessage="No data" />
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={errors.length > 0 || parsedData.length === 0 || uploading}
              loading={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload All Records'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SIMs() {
  const { user, api } = useAuth()
  const [sims, setSims] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [operator, setOperator] = useState('')
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 })
  const [showModal, setShowModal] = useState(false)
  const [editingSim, setEditingSim] = useState(null)
  const [messagingStats, setMessagingStats] = useState(null)
  const [togglingId, setTogglingId] = useState(null)
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [simListModal, setSimListModal] = useState({ open: false, title: '', sims: [] })
  const [showBulkModal, setShowBulkModal] = useState(false)

  const operators = ['Jio', 'Airtel', 'Vi', 'BSNL', 'MTNL', 'Other']

  useEffect(() => {
    fetchSIMs()
    fetchMessagingStats()
  }, [pagination.page, status, operator])

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true)
      const response = await api.get('/users/company')
      setUsers(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch users')
      setUsers([])
    } finally {
      setLoadingUsers(false)
    }
  }

  const fetchSIMs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        search,
        ...(status && { status }),
        ...(operator && { operator }),
      })

      const response = await api.get(`/sims?${params}`)
      setSims(response.data.data || [])
      setPagination((prev) => ({ ...prev, total: response.data.pagination?.total || 0 }))
    } catch (error) {
      toast.error('Failed to fetch SIMs')
      setSims([])
    } finally {
      setLoading(false)
    }
  }

  const fetchMessagingStats = async () => {
    try {
      const response = await api.get('/sims/messaging-stats')
      setMessagingStats(response.data.data)
    } catch (error) {
      console.error('Failed to fetch messaging stats')
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    fetchSIMs()
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        ...(status && { status }),
        ...(operator && { operator }),
      })
      const response = await api.get(`/sims/export?${params}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'sims-export.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Export completed')
    } catch (error) {
      toast.error('Export failed')
    }
  }

  const handleSaveSim = async (simId, data) => {
    try {
      if (simId) {
        await api.put(`/sims/${simId}`, data)
      } else {
        await api.post('/sims', data)
      }
      fetchSIMs()
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Session expired. Please log in again.')
      }
      throw error
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this SIM?')) return

    try {
      await api.delete(`/sims/${id}`)
      toast.success('SIM deleted successfully')
      fetchSIMs()
    } catch (error) {
      toast.error('Failed to delete SIM')
    }
  }

  const openModal = (sim = null) => {
    setEditingSim(sim)
    setShowModal(true)
    fetchUsers()
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingSim(null)
  }

  const getStatusBadge = (status) => {
    const badges = {
      active: { bg: '#dcfce7', color: '#16a34a' },
      inactive: { bg: '#fef2f2', color: '#dc2626' },
      suspended: { bg: '#fffbeb', color: '#d97706' },
      lost: { bg: '#f1f5f9', color: '#475569' },
    }
    return badges[status] || badges.inactive
  }

  const handleMessagingToggle = async (simId, platform, enabled) => {
    setTogglingId(simId + platform)
    try {
      await api.patch(`/sims/${simId}/messaging`, { platform, enabled: !enabled })
      setSims((prev) =>
        prev.map((sim) =>
          sim._id === simId
            ? { ...sim, [`${platform}Enabled`]: !enabled }
            : sim
        )
      )
      toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} ${!enabled ? 'enabled' : 'disabled'}`)
      fetchMessagingStats()
    } catch (error) {
      toast.error('Failed to update status')
    } finally {
      setTogglingId(null)
    }
  }

  const handleStatCardClick = (type) => {
    let filteredSims = []
    let title = ''

    switch (type) {
      case 'whatsapp':
        filteredSims = sims.filter(sim => sim.whatsappEnabled === true)
        title = 'WhatsApp Enabled SIMs'
        break
      case 'telegram':
        filteredSims = sims.filter(sim => sim.telegramEnabled === true)
        title = 'Telegram Enabled SIMs'
        break
      case 'both':
        filteredSims = sims.filter(sim => sim.whatsappEnabled === true && sim.telegramEnabled === true)
        title = 'Both WhatsApp & Telegram Enabled SIMs'
        break
      case 'none':
        filteredSims = sims.filter(sim => sim.whatsappEnabled === false && sim.telegramEnabled === false)
        title = 'SIMs with No Messaging Enabled'
        break
      default:
        return
    }

    setSimListModal({ open: true, title, sims: filteredSims })
  }

  const columns = [
    {
      key: 'mobileNumber',
      header: 'Mobile Number',
      render: (row) => (
        <div style={{ fontWeight: '500' }}>{row.mobileNumber}</div>
      )
    },
    {
      key: 'operator',
      header: 'Operator',
      render: (row) => <Badge variant="default">{row.operator}</Badge>
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const badge = getStatusBadge(row.status)
        return <Badge variant={row.status === 'active' ? 'success' : row.status === 'inactive' ? 'danger' : 'warning'}>{row.status}</Badge>
      }
    },
    {
      key: 'whatsapp',
      header: 'WhatsApp',
      render: (row) => (
        <div style={{ textAlign: 'center' }}>
          <ToggleSwitch
            enabled={row.whatsappEnabled}
            onChange={() => handleMessagingToggle(row._id, 'whatsapp', row.whatsappEnabled)}
            loading={togglingId === row._id + 'whatsapp'}
          />
        </div>
      )
    },
    {
      key: 'telegram',
      header: 'Telegram',
      render: (row) => (
        <div style={{ textAlign: 'center' }}>
          <ToggleSwitch
            enabled={row.telegramEnabled}
            onChange={() => handleMessagingToggle(row._id, 'telegram', row.telegramEnabled)}
            loading={togglingId === row._id + 'telegram'}
          />
        </div>
      )
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      render: (row) => row.assignedTo?.name || 'Unassigned'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => openModal(row)}
            style={{ padding: '8px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
            title="Edit"
          >
            <FiEdit style={{ width: '16px', height: '16px' }} />
          </button>
          <button
            onClick={() => handleDelete(row._id)}
            style={{ padding: '8px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#dc2626' }}
            title="Delete"
          >
            <FiTrash2 style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      )
    },
  ]

  if (loading) {
    return (
      <PageContainer>
        <Spinner size="lg" />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="SIM Management"
        description="Manage your SIM cards and their details"
        action={
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="secondary" icon={FiDownload} onClick={handleExport}>
              Export
            </Button>
            <Button variant="secondary" icon={FiUpload} onClick={() => setShowBulkModal(true)}>
              Bulk Upload
            </Button>
            <Button icon={FiPlus} onClick={() => openModal()}>
              Add SIM
            </Button>
          </div>
        }
      />

      {/* Messaging Stats */}
      {messagingStats && (
        <Grid cols={4} gap={16} style={{ marginBottom: '24px' }}>
          <StatCard
            title="WhatsApp Enabled"
            value={`${messagingStats.whatsapp?.enabled || 0} / ${messagingStats.total || 0}`}
            icon={FiMessageCircle}
            iconColor="#25d366"
            iconBg="#25d36620"
            onClick={() => handleStatCardClick('whatsapp')}
          />
          <StatCard
            title="Telegram Enabled"
            value={`${messagingStats.telegram?.enabled || 0} / ${messagingStats.total || 0}`}
            icon={FiMessageCircle}
            iconColor="#0088cc"
            iconBg="#0088cc20"
            onClick={() => handleStatCardClick('telegram')}
          />
          <StatCard
            title="Both Enabled"
            value={messagingStats.both || 0}
            icon={FiSmartphone}
            iconColor="#2563eb"
            iconBg="#eff6ff"
            onClick={() => handleStatCardClick('both')}
          />
          <StatCard
            title="None Enabled"
            value={messagingStats.neither || 0}
            icon={FiSmartphone}
            iconColor="#dc2626"
            iconBg="#fef2f2"
            onClick={() => handleStatCardClick('none')}
          />
        </Grid>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: '24px' }}>
        <CardBody>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by mobile number..."
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{
                padding: '10px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                minWidth: '140px',
                backgroundColor: '#ffffff',
                outline: 'none',
              }}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="lost">Lost</option>
            </select>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              style={{
                padding: '10px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                minWidth: '140px',
                backgroundColor: '#ffffff',
                outline: 'none',
              }}
            >
              <option value="">All Operators</option>
              {operators.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
            <Button type="submit">Search</Button>
          </form>
        </CardBody>
      </Card>

      {/* Table */}
      <Card>
        <CardBody style={{ padding: 0 }}>
          <Table
            columns={columns}
            data={sims}
            emptyMessage="No SIMs Found"
          />
        </CardBody>
      </Card>

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <Pagination
          currentPage={pagination.page}
          totalPages={Math.ceil(pagination.total / pagination.limit)}
          total={pagination.total}
          onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
        />
      )}

      {/* Modal */}
      <SimModal
        isOpen={showModal}
        onClose={closeModal}
        sim={editingSim}
        onSave={handleSaveSim}
        users={users}
        loadingUsers={loadingUsers}
      />

      {/* SIM List Modal */}
      <SimListModal
        isOpen={simListModal.open}
        onClose={() => setSimListModal({ open: false, title: '', sims: [] })}
        title={simListModal.title}
        sims={simListModal.sims}
      />

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onSuccess={() => { fetchSIMs(); fetchMessagingStats(); setShowBulkModal(false) }}
      />
    </PageContainer>
  )
}