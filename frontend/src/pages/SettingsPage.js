import React from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
    Box,
    Paper,
    Tabs,
    Tab,
    Typography,
    Container
} from '@mui/material';
import { styled } from '@mui/material/styles';
import UserManagement from '../components/settings/UserManagement';
import StoreManagement from '../components/settings/StoreManagement';

const StyledTab = styled(Tab)(({ theme }) => ({
    textTransform: 'none',
    fontWeight: 500,
    fontSize: '1rem',
    marginRight: theme.spacing(1),
    '&.Mui-selected': {
        color: theme.palette.primary.main,
    },
}));

const SettingsPage = () => {
    const location = useLocation();
    const currentPath = location.pathname;

    const getTabValue = () => {
        if (currentPath.includes('/settings/stores')) return 0;
        if (currentPath.includes('/settings/users')) return 1;
        return 0;
    };

    return (
        <Container maxWidth="lg">
            <Box sx={{ width: '100%', mb: 3 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Settings
                </Typography>
                <Paper sx={{ width: '100%', mb: 2 }}>
                    <Tabs
                        value={getTabValue()}
                        indicatorColor="primary"
                        textColor="primary"
                        sx={{ borderBottom: 1, borderColor: 'divider' }}
                    >
                        <StyledTab
                            label="Store Management"
                            component={Link}
                            to="stores"
                        />
                        <StyledTab
                            label="User Management"
                            component={Link}
                            to="users"
                        />
                    </Tabs>
                </Paper>

                <Box sx={{ mt: 3 }}>
                    <Routes>
                        <Route index element={<Navigate to="stores" replace />} />
                        <Route path="stores/*" element={<StoreManagement />} />
                        <Route path="users/*" element={<UserManagement />} />
                    </Routes>
                </Box>
            </Box>
        </Container>
    );
};

export default SettingsPage; 