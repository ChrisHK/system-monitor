import React from 'react';
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { Tabs, Card, Typography } from 'antd';
import GroupManagement from '../components/settings/GroupManagement';
import StoreManagement from '../components/settings/StoreManagement';
import UserManagement from '../components/settings/UserManagement';
import TagManagementPage from './TagManagementPage';

const { Title } = Typography;

const SettingsPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const currentPath = location.pathname;

    const getActiveKey = () => {
        if (currentPath === '/settings/stores') return 'stores';
        if (currentPath === '/settings/groups') return 'groups';
        if (currentPath === '/settings/users') return 'users';
        if (currentPath === '/settings/tags') return 'tags';
        return 'stores';
    };

    const items = [
        {
            key: 'stores',
            label: 'Store Management',
        },
        {
            key: 'groups',
            label: 'Group Management',
        },
        {
            key: 'users',
            label: 'User Management',
        },
        {
            key: 'tags',
            label: 'Tag Management',
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Title level={2} style={{ marginBottom: '24px' }}>
                Settings
            </Title>
            <Card>
                <Tabs
                    activeKey={getActiveKey()}
                    items={items}
                    onChange={(key) => {
                        navigate(`/settings/${key}`);
                    }}
                />
                <div style={{ padding: '16px' }}>
                    <Routes>
                        <Route index element={<Navigate to="stores" replace />} />
                        <Route path="stores" element={<StoreManagement />} />
                        <Route path="groups" element={<GroupManagement />} />
                        <Route path="users" element={<UserManagement />} />
                        <Route path="tags" element={<TagManagementPage />} />
                    </Routes>
                </div>
            </Card>
        </div>
    );
};

export default SettingsPage; 