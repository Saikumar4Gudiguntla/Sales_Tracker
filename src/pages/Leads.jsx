import { useEffect, useMemo, useState } from 'react'
import {
  Table, Button, Input, Select, Space, Modal, Form, DatePicker, message,
  Tag, Popconfirm, Upload, Typography, Row, Col,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, UploadOutlined, DownloadOutlined,
  EditOutlined, DeleteOutlined, InboxOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { supabase } from '../supabaseClient'
import { readWorkbook, parseLeadsWorkbook, exportToExcel } from '../utils/excel'

const STATUS_OPTIONS = ['New', 'Contacted', 'Demo Scheduled', 'Demo Done', 'Negotiation', 'Won', 'Lost', 'Disqualified']

export default function Leads() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(null)
  const [salesFilter, setSalesFilter] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: rows, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (error) message.error(error.message)
    setData(rows || [])
    setLoading(false)
  }

  const salespeople = useMemo(() => [...new Set(data.map((d) => d.salesperson).filter(Boolean))], [data])

  const filtered = useMemo(() => {
    return data.filter((d) => {
      if (statusFilter && d.status !== statusFilter) return false
      if (salesFilter && d.salesperson !== salesFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const hay = [d.lead_name, d.contact_name, d.topic_sku, d.notes, d.source].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [data, search, statusFilter, salesFilter])

  function openNew() {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  function openEdit(record) {
    setEditing(record)
    form.setFieldsValue({
      ...record,
      date_received: record.date_received ? dayjs(record.date_received) : null,
      follow_up_date: record.follow_up_date ? dayjs(record.follow_up_date) : null,
      demo_date: record.demo_date ? dayjs(record.demo_date) : null,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    const values = await form.validateFields()
    const payload = {
      ...values,
      date_received: values.date_received ? values.date_received.format('YYYY-MM-DD') : null,
      follow_up_date: values.follow_up_date ? values.follow_up_date.format('YYYY-MM-DD') : null,
      demo_date: values.demo_date ? values.demo_date.format('YYYY-MM-DD') : null,
    }
    let error
    if (editing) {
      ({ error } = await supabase.from('leads').update(payload).eq('id', editing.id))
    } else {
      ({ error } = await supabase.from('leads').insert(payload))
    }
    if (error) { message.error(error.message); return }
    message.success(editing ? 'Lead updated' : 'Lead added')
    setModalOpen(false)
    load()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) return message.error(error.message)
    message.success('Lead deleted')
    load()
  }

  async function handleArchive(id, archived) {
    const { error } = await supabase.from('leads').update({ archived }).eq('id', id)
    if (error) return message.error(error.message)
    load()
  }

  async function handleImport(file) {
    try {
      const wb = await readWorkbook(file)
      const leads = parseLeadsWorkbook(wb)
      if (leads.length === 0) { message.warning('No recognizable lead rows found'); return false }

      // duplicate detection: same lead_name + contact_name already present
      const existingKeys = new Set(data.map((d) => `${d.lead_name}|${d.contact_name}`.toLowerCase()))
      const toInsert = leads.filter((l) => !existingKeys.has(`${l.lead_name}|${l.contact_name}`.toLowerCase()))
      const skipped = leads.length - toInsert.length

      if (toInsert.length > 0) {
        const { error } = await supabase.from('leads').insert(toInsert)
        if (error) { message.error(error.message); return false }
      }
      message.success(`Imported ${toInsert.length} lead(s)${skipped ? `, skipped ${skipped} duplicate(s)` : ''}`)
      load()
    } catch (e) {
      message.error('Failed to parse file: ' + e.message)
    }
    return false // prevent antd auto-upload
  }

  function handleExport() {
    exportToExcel(filtered.map(({ id, created_at, updated_at, ...rest }) => rest), `leads-export-${dayjs().format('YYYY-MM-DD')}.xlsx`, 'Leads')
  }

  const columns = [
    { title: 'Lead Name', dataIndex: 'lead_name', sorter: (a, b) => (a.lead_name || '').localeCompare(b.lead_name || '') },
    { title: 'Contact', dataIndex: 'contact_name' },
    { title: 'Topic / SKU', dataIndex: 'topic_sku' },
    { title: 'Salesperson', dataIndex: 'salesperson' },
    {
      title: 'Status', dataIndex: 'status',
      render: (s) => <Tag color={s === 'Won' ? 'green' : s === 'Lost' || s === 'Disqualified' ? 'red' : 'blue'}>{s}</Tag>,
      sorter: (a, b) => (a.status || '').localeCompare(b.status || ''),
    },
    { title: 'Next Action', dataIndex: 'next_action', ellipsis: true },
    {
      title: 'Received', dataIndex: 'date_received',
      render: (d) => d ? dayjs(d).format('MMM D, YYYY') : '—',
      sorter: (a, b) => dayjs(a.date_received || 0).unix() - dayjs(b.date_received || 0).unix(),
    },
    {
      title: 'Actions', key: 'actions', fixed: 'right', width: 140,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="Delete this lead?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Leads</Typography.Title>
        <Space>
          <Upload beforeUpload={handleImport} showUploadList={false} accept=".xlsx,.xls,.csv">
            <Button icon={<UploadOutlined />}>Import Excel</Button>
          </Upload>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Export</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>Add Lead</Button>
        </Space>
      </Row>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={10}>
          <Input placeholder="Search by name, contact, topic, notes…" prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)} allowClear />
        </Col>
        <Col xs={12} sm={7}>
          <Select placeholder="Filter by status" allowClear style={{ width: '100%' }} value={statusFilter} onChange={setStatusFilter}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))} />
        </Col>
        <Col xs={12} sm={7}>
          <Select placeholder="Filter by salesperson" allowClear style={{ width: '100%' }} value={salesFilter} onChange={setSalesFilter}
            options={salespeople.map((s) => ({ value: s, label: s }))} />
        </Col>
      </Row>

      <Table rowKey="id" loading={loading} dataSource={filtered} columns={columns} scroll={{ x: 1100 }} />

      <Modal
        title={editing ? 'Edit Lead' : 'Add Lead'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText="Save"
        width={640}
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={12}><Form.Item name="lead_name" label="Lead / Company Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="contact_name" label="Contact Name"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="topic_sku" label="Topic / SKU"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="salesperson" label="Salesperson"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="status" label="Status"><Select options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="source" label="Source"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="date_received" label="Date Received"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="follow_up_date" label="Follow-up Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={24}><Form.Item name="next_action" label="Next Action"><Input.TextArea rows={2} /></Form.Item></Col>
            <Col span={24}><Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
