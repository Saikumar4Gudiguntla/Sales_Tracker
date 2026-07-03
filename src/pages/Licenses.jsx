import { useEffect, useMemo, useState } from 'react'
import {
  Table, Button, Input, Select, Space, Modal, Form, DatePicker, InputNumber, Switch,
  message, Tag, Popconfirm, Upload, Typography, Row, Col,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, UploadOutlined, DownloadOutlined,
  EditOutlined, DeleteOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { supabase } from '../supabaseClient'
import { readWorkbook, parseLicensesWorkbook, exportToExcel } from '../utils/excel'

const STATUS_OPTIONS = ['Pending', 'Active', 'Expiring', 'Expired', 'Cancelled']

export default function Licenses() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: rows, error } = await supabase.from('licenses').select('*').order('created_at', { ascending: false })
    if (error) message.error(error.message)
    setData(rows || [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return data.filter((d) => {
      if (statusFilter && d.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const hay = [d.customer_name, d.sku, d.roles_notes].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [data, search, statusFilter])

  function openNew() { setEditing(null); form.resetFields(); setModalOpen(true) }
  function openEdit(record) {
    setEditing(record)
    form.setFieldsValue({
      ...record,
      purchase_date: record.purchase_date ? dayjs(record.purchase_date) : null,
      renewal_date: record.renewal_date ? dayjs(record.renewal_date) : null,
      expiry_date: record.expiry_date ? dayjs(record.expiry_date) : null,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    const values = await form.validateFields()
    const payload = {
      ...values,
      purchase_date: values.purchase_date ? values.purchase_date.format('YYYY-MM-DD') : null,
      renewal_date: values.renewal_date ? values.renewal_date.format('YYYY-MM-DD') : null,
      expiry_date: values.expiry_date ? values.expiry_date.format('YYYY-MM-DD') : null,
    }
    let error
    if (editing) ({ error } = await supabase.from('licenses').update(payload).eq('id', editing.id))
    else ({ error } = await supabase.from('licenses').insert(payload))
    if (error) { message.error(error.message); return }
    message.success(editing ? 'License updated' : 'License added')
    setModalOpen(false)
    load()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('licenses').delete().eq('id', id)
    if (error) return message.error(error.message)
    message.success('License deleted')
    load()
  }

  async function handleImport(file) {
    try {
      const wb = await readWorkbook(file)
      const licenses = parseLicensesWorkbook(wb)
      if (licenses.length === 0) { message.warning('No recognizable license rows found'); return false }
      const existingKeys = new Set(data.map((d) => (d.customer_name || '').toLowerCase()))
      const toInsert = licenses.filter((l) => !existingKeys.has((l.customer_name || '').toLowerCase()))
      const skipped = licenses.length - toInsert.length
      if (toInsert.length > 0) {
        const { error } = await supabase.from('licenses').insert(toInsert)
        if (error) { message.error(error.message); return false }
      }
      message.success(`Imported ${toInsert.length} license(s)${skipped ? `, skipped ${skipped} duplicate(s)` : ''}`)
      load()
    } catch (e) {
      message.error('Failed to parse file: ' + e.message)
    }
    return false
  }

  function handleExport() {
    exportToExcel(filtered.map(({ id, created_at, updated_at, lead_id, ...rest }) => rest), `licenses-export-${dayjs().format('YYYY-MM-DD')}.xlsx`, 'Licenses')
  }

  const columns = [
    { title: 'Customer', dataIndex: 'customer_name', sorter: (a, b) => (a.customer_name || '').localeCompare(b.customer_name || '') },
    { title: 'SKU', dataIndex: 'sku' },
    { title: 'Qty', dataIndex: 'license_qty', width: 70 },
    { title: 'Sub. Type', dataIndex: 'subscription_type', render: (t) => t === 'M' ? 'Monthly' : 'Annual', width: 100 },
    { title: 'Amount', dataIndex: 'amount', render: (a) => `$${Number(a || 0).toLocaleString()}`, sorter: (a, b) => (a.amount || 0) - (b.amount || 0) },
    {
      title: 'Status', dataIndex: 'status',
      render: (s) => <Tag color={s === 'Active' ? 'green' : s === 'Expired' || s === 'Cancelled' ? 'red' : s === 'Expiring' ? 'orange' : 'blue'}>{s}</Tag>,
    },
    { title: 'Expiry', dataIndex: 'expiry_date', render: (d) => d ? dayjs(d).format('MMM D, YYYY') : '—', sorter: (a, b) => dayjs(a.expiry_date || 0).unix() - dayjs(b.expiry_date || 0).unix() },
    {
      title: 'Actions', key: 'actions', fixed: 'right', width: 140,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="Delete this license?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Licenses</Typography.Title>
        <Space>
          <Upload beforeUpload={handleImport} showUploadList={false} accept=".xlsx,.xls,.csv">
            <Button icon={<UploadOutlined />}>Import Excel</Button>
          </Upload>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Export</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>Add License</Button>
        </Space>
      </Row>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12}>
          <Input placeholder="Search by customer, SKU, notes…" prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)} allowClear />
        </Col>
        <Col xs={12} sm={8}>
          <Select placeholder="Filter by status" allowClear style={{ width: '100%' }} value={statusFilter} onChange={setStatusFilter}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))} />
        </Col>
      </Row>

      <Table rowKey="id" loading={loading} dataSource={filtered} columns={columns} scroll={{ x: 1100 }} />

      <Modal
        title={editing ? 'Edit License' : 'Add License'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText="Save"
        width={680}
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={12}><Form.Item name="customer_name" label="Customer Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="sku" label="SKU"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="license_qty" label="# of Licenses"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
            <Col span={8}><Form.Item name="subscription_type" label="Subscription"><Select options={[{ value: 'A', label: 'Annual' }, { value: 'M', label: 'Monthly' }]} /></Form.Item></Col>
            <Col span={8}><Form.Item name="amount" label="Amount ($)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
            <Col span={8}><Form.Item name="status" label="Status"><Select options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="purchase_date" label="Purchase Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="renewal_date" label="Renewal Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="expiry_date" label="Expiry Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="agreement_client_signed" label="Client Signed" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={6}><Form.Item name="agreement_countersigned" label="Countersigned" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={6}><Form.Item name="payment_done" label="Payment Done" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={6}><Form.Item name="license_loaded" label="License Loaded" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={24}><Form.Item name="roles_notes" label="Notes"><Input.TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
