import { useState } from 'react'
import { Layout as AntLayout, Menu, Switch, Typography } from 'antd'
import {
  DashboardOutlined, TeamOutlined, SafetyCertificateOutlined,
  BarChartOutlined, MoonOutlined, SunOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

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
          <Switch checkedChildren={<MoonOutlined />} unCheckedChildren={<SunOutlined />} checked={dark} onChange={setDark} />
        </Header>
        <Content style={{ margin: 20 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}