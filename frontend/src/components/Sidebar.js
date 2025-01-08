import React from 'react';
import { Menu } from 'antd';
import {
    DatabaseOutlined,
    ExportOutlined,
    BranchesOutlined,
    SettingOutlined
} from '@ant-design/icons';

const { SubMenu } = Menu;

const Sidebar = () => {
    const branches = [
        'Main Store',
        'FMP Store',
        'Mississauga Store'
    ];

    return (
        <Menu
            mode="inline"
            defaultSelectedKeys={['inventory']}
            defaultOpenKeys={['branches']}
            style={{ height: '100%', borderRight: 0 }}
        >
            <Menu.Item key="inventory" icon={<DatabaseOutlined />}>
                Inventory
            </Menu.Item>
            <Menu.Item key="outbound" icon={<ExportOutlined />}>
                Outbound
            </Menu.Item>
            <SubMenu key="branches" icon={<BranchesOutlined />} title="Branches">
                {branches.map(branch => (
                    <Menu.Item key={branch.toLowerCase().replace(' ', '-')}>
                        {branch}
                    </Menu.Item>
                ))}
            </SubMenu>
            <Menu.Item key="settings" icon={<SettingOutlined />}>
                Settings
            </Menu.Item>
        </Menu>
    );
};

export default Sidebar; 