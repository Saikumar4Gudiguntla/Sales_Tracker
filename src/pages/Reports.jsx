import { useEffect, useState, useMemo } from 'react'
import { Card, Row, Col, Typography, Select, Button, Table } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import dayjs from 'dayjs'
import { supabase } from '../supabaseClient'
import { exportToExcel } from '../utils/excel'

const COLORS = ['#2F5D62', '#1677ff', '#389e0d', '#d48806', '#cf1322', '#722ed1']

export default function Reports() {
  const [leads, setLeads] = useState([])
  const [licenses, setLicenses] = useState([])
  const [period, setPeriod] = useState('monthly')

  useEffect(() => {
    supabase.from('leads').select('*').then(({ data }) => setLeads(data || []))
    supabase.from('licenses').select('*').then(({ data }) => setLicenses(data || []))
  }, [])

  const statusBreakdown = useMemo(() => {
    const counts = {}
    leads.forEach((l) => { counts[l.status || 'New'] = (counts[l.status || 'New'] || 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [leads])

  const salesBySalesperson = useMemo(() => {
    const counts = {}
    leads.forEach((l) => {
      const key = l.salesperson || 'Unassigned'
      counts[key] = (counts[key] || 0) + 1
    })
    return Object.entries(counts).map(([name, leads]) => ({ name, leads }))
  }, [leads])

  const trend = useMemo(() => {
    const fmt = period === 'monthly' ? 'YYYY-MM' : period === 'weekly' ? 'YYYY-[W]WW' : 'YYYY-MM-DD'
    const counts = {}
    leads.forEach((l) => {
      if (!l.date_received) return
      const key = dayjs(l.date_received).format(fmt)
      counts[key] = (counts[key] || 0) + 1
    })
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([period, leads]) => ({ period, leads }))
  }, [leads, period])

  const revenueByMonth = useMemo(() => {
    const counts = {}
    licenses.forEach((l) => {
      if (!l.purchase_date) return
      const key = dayjs(l.purchase_date).format('YYYY-MM')
      counts[key] = (counts[key] || 0) + Number(l.amount || 0)
    })
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([month, revenue]) => ({ month, revenue }))
  }, [licenses])

  function exportReport() {
    exportToExcel(statusBreakdown, `lead-status-report-${dayjs().format('YYYY-MM-DD')}.xlsx`, 'Status Breakdown')
  }

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Reports</Typography.Title>
        <Button icon={<DownloadOutlined />} onClick={exportReport}>Export Status Report</Button>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Lead Status Breakdown">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statusBreakdown} dataKey="value" nameKey="name" outerRadius={100} label>
                  {statusBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Leads by Salesperson">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={salesBySalesperson}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="leads" fill="#2F5D62" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title="Lead Trend"
            extra={
              <Select size="small" value={period} onChange={setPeriod}
                options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />
            }
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="leads" stroke="#1677ff" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Revenue by Month">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                <Bar dataKey="revenue" fill="#389e0d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card title="Status Breakdown — Detail" style={{ marginTop: 16 }}>
        <Table
          rowKey="name"
          dataSource={statusBreakdown}
          pagination={false}
          columns={[{ title: 'Status', dataIndex: 'name' }, { title: 'Count', dataIndex: 'value' }]}
        />
      </Card>
    </div>
  )
}
