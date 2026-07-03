import { useState } from 'react'
import { Form, Input, Button, Card, Typography, Tabs, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const doSignIn = async (values) => {
    setLoading(true)
    const { error } = await signIn(values.email, values.password)
    setLoading(false)
    if (error) message.error(error.message)
    else navigate('/')
  }

  const doSignUp = async (values) => {
    setLoading(true)
    const { error } = await signUp(values.email, values.password, values.fullName)
    setLoading(false)
    if (error) message.error(error.message)
    else message.success('Account created. Check your email to confirm, then sign in.')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#16323A' }}>
      <Card style={{ width: 380 }}>
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 4 }}>CRM &amp; License Tracker</Typography.Title>
        <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>Sign in to continue</Typography.Text>
        <Tabs
          defaultActiveKey="signin"
          items={[
            {
              key: 'signin',
              label: 'Sign in',
              children: (
                <Form layout="vertical" onFinish={doSignIn}>
                  <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                    <Input placeholder="you@company.com" />
                  </Form.Item>
                  <Form.Item name="password" label="Password" rules={[{ required: true }]}>
                    <Input.Password />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block loading={loading}>Sign in</Button>
                </Form>
              ),
            },
            {
              key: 'signup',
              label: 'Create account',
              children: (
                <Form layout="vertical" onFinish={doSignUp}>
                  <Form.Item name="fullName" label="Full name" rules={[{ required: true }]}>
                    <Input placeholder="Jane Doe" />
                  </Form.Item>
                  <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                    <Input placeholder="you@company.com" />
                  </Form.Item>
                  <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
                    <Input.Password />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block loading={loading}>Create account</Button>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
