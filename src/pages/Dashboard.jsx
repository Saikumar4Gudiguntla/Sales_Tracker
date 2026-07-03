import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Typography, List, Alert, Spin } from 'antd'
import {
  TeamOutlined, TrophyOutlined, CloseCircleOutlined, SafetyCertificateOutlined,
  ClockCircleOutlined, CalendarOutlined, WarningOutlined, DollarOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { supabase } from '../supabaseClient'

const cardStyle = { borderRadius: 10 }

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [expiring, setExpiring] = useState([])
  const [followups, setFollowups] = useState([])
  const [recentLeads, setRecentLeads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: s }, { data: exp }, { data: fu }, { data: recent }] = await Promise.all([
      supabase.from('dashboard_stats').select('*').single(),
      supabase.from('licenses').select('*').not('expiry_date', 'is', null)
        .lte('expiry_date', dayjs().add(30, 'day').format('YYYY-MM-DD'))
        .gte('expiry_date', dayjs().format('YYYY-MM-DD'))
        .order('expiry_date', { ascending: true }).limit(10),
      supabase.from('leads').select('*').not('follow_up_date', 'is', null)
        .lte('follow_up_date', dayjs().add(7, 'day').format('YYYY-MM-DD'))
        .order('follow_up_date', { ascending: true }).limit(10),
      supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(8),
    ])
    setStats(s)
    setExpiring(exp || [])
    setFollowups(fu || [])
    setRecentLeads(recent || [])
    setLoading(false)
  }

  if (loading) return <Spin size="large" style={{ display: 'block', marginTop: 100 }} />

  const statCards = [
    { title: 'Total Leads', value: stats?.total_leads ?? 0, icon: <TeamOutlined />, color: '#2F5D62' },
    { title: 'Active Leads', value: stats?.active_leads ?? 0, icon: <ClockCircleOutlined />, color: '#1677ff' },
    { title: 'Won Leads', value: stats?.won_leads ?? 0, icon: <TrophyOutlined />, color: '#389e0d' },
    { title: 'Lost Leads', value: stats?.lost_leads ?? 0, icon: <CloseCircleOutlined />, color: '#cf1322' },
    { title: 'New Licenses (mo.)', value: stats?.new_licenses_this_month ?? 0, icon: <SafetyCertificateOutlined />, color: '#2F5D62' },
    { title: 'Pending Licenses', value: stats?.pending_licenses ?? 0, icon: <ClockCircleOutlined />, color: '#d48806' },
    { title: 'Expiring (30d)', value: stats?.expiring_licenses ?? 0, icon: <WarningOutlined />, color: '#cf1322' },
    { title: 'Follow-ups (7d)', value: stats?.upcoming_followups ?? 0, icon: <CalendarOutlined />, color: '#722ed1' },
    { title: 'Total Revenue', value: stats?.total_revenue ?? 0, prefix: '$', icon: <DollarOutlined />, color: '#389e0d' },
  ]

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 20 }}>Dashboard</Typography.Title>

      <Row gutter={[16, 16]}>
        {statCards.map((c) => (
          <Col xs={24} sm={12} md={8} lg={6} key={c.title}>
            <Card style={cardStyle} className="stat-card">
              <Statistic title={c.title} value={c.value} prefix={c.icon} valueStyle={{ color: c.color }} />
            </Card>
          </Col>
        ))}
      </Row>

      {expiring.length > 0 && (
        <Alert
          style={{ marginTop: 20 }}
          type="warning"
          showIcon
          message={`${expiring.length} license(s) expiring within 30 days`}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        <Col xs={24} lg={12}>
          <Card title="Upcoming Follow-ups" style={cardStyle}>
            <List
              dataSource={followups}
              locale={{ emptyText: 'No follow-ups due in the next 7 days' }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={item.lead_name}
                    description={`${item.next_action || 'Follow up'} — due ${dayjs(item.follow_up_date).format('MMM D')}`}
                  />
                  <Tag color="purple">{item.salesperson || '—'}</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Licenses Expiring Soon" style={cardStyle}>
            <List
              dataSource={expiring}
              locale={{ emptyText: 'No licenses expiring soon' }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={item.customer_name}
                    description={`${item.sku || ''} — expires ${dayjs(item.expiry_date).format('MMM D, YYYY')}`}
                  />
                  <Tag color="red">{dayjs(item.expiry_date).diff(dayjs(), 'day')}d left</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Recent Activity" style={{ marginTop: 20, ...cardStyle }}>
        <Table
          rowKey="id"
          dataSource={recentLeads}
          pagination={false}
          columns={[
            { title: 'Lead', dataIndex: 'lead_name' },
            { title: 'Salesperson', dataIndex: 'salesperson' },
            { title: 'Status', dataIndex: 'status', render: (s) => <Tag>{s}</Tag> },
            { title: 'Added', dataIndex: 'created_at', render: (d) => dayjs(d).format('MMM D, YYYY') },
          ]}
        />
      </Card>
    </div>
  )
}
