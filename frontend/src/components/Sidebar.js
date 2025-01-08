import React, { useState, useEffect } from 'react';
import { Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    DatabaseOutlined,
    ExportOutlined,
    BranchesOutlined,
    SettingOutlined
} from '@ant-design/icons';
import axios from 'axios';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [stores, setStores] = useState([]);
    const API_BASE_URL = 'http://192.168.0.10:3000';

    useEffect(() => {
        const fetchStores = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/stores`, {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000,
                    withCredentials: true
                });
                
                if (response.data.success) {
                    setStores(response.data.stores.map(store => ({
                        key: `store/${store.id}`,
                        label: store.name,
                        onClick: () => navigate(`/store/${store.id}`)
                    })));
                }
            } catch (error) {
                console.error('Error fetching stores:', error);
            }
        };

        fetchStores();
    }, [navigate]);

    // Get the current selected key based on path
    const getSelectedKey = () => {
        const path = location.pathname;
        if (path === '/') return 'inventory';
        if (path.startsWith('/store/')) return `store/${path.split('/')[2]}`;
        return path.substring(1); // Remove the leading slash
    };

    const items = [
        {
            key: 'inventory',
            icon: <DatabaseOutlined />,
            label: 'Inventory',
            onClick: () => navigate('/inventory')
        },
        {
            key: 'outbound',
            icon: <ExportOutlined />,
            label: 'Outbound',
            onClick: () => navigate('/outbound')
        },
        {
            key: 'branches',
            icon: <BranchesOutlined />,
            label: 'Branches',
            children: stores
        },
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: 'Settings',
            onClick: () => navigate('/settings')
        }
    ];

    return (
        <Menu
            mode="inline"
            selectedKeys={[getSelectedKey()]}
            defaultOpenKeys={['branches']}
            style={{ height: '100%', borderRight: 0 }}
            items={items}
        />
    );
};

export default Sidebar; 