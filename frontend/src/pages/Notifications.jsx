import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  FiBell,
  FiCheck,
  FiTrash2,
  FiAlertCircle,
  FiClock,
  FiCreditCard,
  FiInfo,
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import {
  PageContainer,
  PageHeader,
  Card,
  CardBody,
  Badge,
  Button,
  Spinner,
  Pagination,
} from '../components/ui'

export default function Notifications() {
  const { api } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 })

  useEffect(() => {
    fetchNotifications()
  }, [pagination.page, filter])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(filter === 'unread' && { isRead: 'false' }),
        ...(filter === 'read' && { isRead: 'true' }),
      })

      const response = await api.get(`/notifications?${params}`)
      setNotifications(response.data.data || [])
      setPagination((prev) => ({ ...prev, total: response.data.pagination?.total || 0 }))
    } catch (error) {
      toast.error('Failed to fetch notifications')
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      )
      toast.success('Notification marked as read')
    } catch (error) {
      toast.error('Failed to mark notification as read')
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read')
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      toast.success('All notifications marked as read')
    } catch (error) {
      toast.error('Failed to mark all as read')
    }
  }

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`)
      setNotifications((prev) => prev.filter((n) => n._id !== id))
      toast.success('Notification deleted')
    } catch (error) {
      toast.error('Failed to delete notification')
    }
  }

  const getTypeStyle = (type) => {
    const styles = {
      recharge_due: { bg: '#fffbeb', color: '#d97706', icon: FiCreditCard },
      inactive_sim: { bg: '#fef2f2', color: '#dc2626', icon: FiAlertCircle },
      subscription_expiry: { bg: '#eff6ff', color: '#2563eb', icon: FiClock },
      system: { bg: '#f1f5f9', color: '#475569', icon: FiInfo },
      alert: { bg: '#fef2f2', color: '#dc2626', icon: FiAlertCircle },
      info: { bg: '#eff6ff', color: '#2563eb', icon: FiInfo },
    }
    return styles[type] || styles.info
  }

  const getPriorityStyle = (priority) => {
    const styles = {
      low: { bg: '#f1f5f9', color: '#475569' },
      medium: { bg: '#eff6ff', color: '#2563eb' },
      high: { bg: '#fffbeb', color: '#d97706' },
      critical: { bg: '#fef2f2', color: '#dc2626' },
    }
    return styles[priority] || styles.medium
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) return `${diffDays}d ago`
    if (diffHours > 0) return `${diffHours}h ago`
    if (diffMins > 0) return `${diffMins}m ago`
    return 'Just now'
  }

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
        title="Notifications"
        description="View and manage your notifications"
        action={
          <Button variant="secondary" icon={FiCheck} onClick={markAllAsRead}>
            Mark All as Read
          </Button>
        }
      />

      {/* Filters */}
      <Card style={{ marginBottom: '24px' }}>
        <CardBody>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['all', 'unread', 'read'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: filter === f ? '#2563eb' : '#f1f5f9',
                  color: filter === f ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  fontSize: '14px',
                  textTransform: 'capitalize',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Notifications List */}
      {notifications.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifications.map((notification) => {
            const typeStyle = getTypeStyle(notification.type)
            const priorityStyle = getPriorityStyle(notification.priority)
            const IconComponent = typeStyle.icon

            return (
              <Card
                key={notification._id}
                style={{ borderLeft: notification.isRead ? 'none' : '4px solid #2563eb' }}
              >
                <CardBody>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: typeStyle.bg,
                          color: typeStyle.color,
                          fontSize: '12px',
                          textTransform: 'capitalize',
                        }}>
                          <IconComponent style={{ width: '12px', height: '12px' }} />
                          {notification.type.replace('_', ' ')}
                        </span>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: priorityStyle.bg,
                          color: priorityStyle.color,
                          fontSize: '12px',
                          textTransform: 'capitalize',
                        }}>
                          {notification.priority}
                        </span>
                        {!notification.isRead && (
                          <span style={{
                            width: '8px',
                            height: '8px',
                            backgroundColor: '#2563eb',
                            borderRadius: '50%',
                          }} />
                        )}
                      </div>
                      <h3 style={{ fontWeight: '600', color: '#111827', marginBottom: '4px', margin: 0 }}>
                        {notification.title}
                      </h3>
                      <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: 1.5, margin: '4px 0' }}>
                        {notification.message}
                      </p>
                      <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '8px', margin: 0 }}>
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {!notification.isRead && (
                        <Button variant="secondary" size="sm" onClick={() => markAsRead(notification._id)} icon={FiCheck}>
                          Mark Read
                        </Button>
                      )}
                      <Button variant="danger" size="sm" onClick={() => deleteNotification(notification._id)} icon={FiTrash2}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardBody>
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <FiBell style={{ width: '48px', height: '48px', color: '#9ca3af', marginBottom: '16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>No Notifications</h3>
              <p style={{ color: '#6b7280' }}>You're all caught up!</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <Pagination
          currentPage={pagination.page}
          totalPages={Math.ceil(pagination.total / pagination.limit)}
          total={pagination.total}
          onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
        />
      )}
    </PageContainer>
  )
}