import { useState } from 'react'
import { Layout as AntLayout, Menu, Dropdown, Avatar, Switch, Space, Typography } from 'antd'
import {
  DashboardOutlined, TeamOutlined, SafetyCertificateOutlined,
  BarChartOutlined, UserOutlined, LogoutOutlined, MoonOutlined, SunOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const { Header, Sider, Content } = AntLayout

const items = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/leads', icon: <TeamOutlined />, label: 'Leads' },
  { key: '/licenses', icon: <SafetyCertificateOutlined />, label: 'Licenses' },
  { key: '/reports', icon: <BarChartOutlined />, label: 'Reports' },
]

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, signOut } = useAuth()

  const userMenu = {
    items: [
      { key: 'role', label: `Role: ${profile?.role || 'sales'}`, disabled: true },
      { type: 'divider' },
      { key: 'signout', icon: <LogoutOutlined />, label: 'Sign out', onClick: () => signOut().then(() => navigate('/login')) },
    ],
  }

  return (
    <AntLayout style={{ minHeight: '100vh' }} className={dark ? 'dark' : ''}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark">
        <div className="app-logo">{collapsed ? 'CT' : 'CRM Tracker'}</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header style={{ background: '#fff', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography.Text strong>Sales &amp; License Operations</Typography.Text>
          <Space size="large">
            <Switch checkedChildren={<MoonOutlined />} unCheckedChildren={<SunOutlined />} checked={dark} onChange={setDark} />
            <Dropdown menu={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <span>{profile?.full_name || profile?.email}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: 20 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}
