import React from 'react';
import { Menu } from 'antd';
import {
    DatabaseOutlined,
    ExportOutlined,
    BranchesOutlined,
    SettingOutlined
} from '@ant-design/icons';

const Sidebar = () => {
    const branches = [
        'Main Store',
        'FMP Store',
        'Mississauga Store'
    ];

    const branchItems = branches.map(branch => ({
        key: branch.toLowerCase().replace(' ', '-'),
        label: branch
    }));

    const items = [
        {
            key: 'inventory',
            icon: <DatabaseOutlined />,
            label: 'Inventory'
        },
        {
            key: 'outbound',
            icon: <ExportOutlined />,
            label: 'Outbound'
        },
        {
            key: 'branches',
            icon: <BranchesOutlined />,
            label: 'Branches',
            children: branchItems
        },
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: 'Settings'
        }
    ];

    return (
        <Menu
            mode="inline"
            defaultSelectedKeys={['inventory']}
            defaultOpenKeys={['branches']}
            style={{ height: '100%', borderRight: 0 }}
            items={items}
        />
    );
};

export default Sidebar; 