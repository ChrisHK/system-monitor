import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, isAuthenticated, error: authError } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // If already authenticated, redirect to home
        if (isAuthenticated()) {
            navigate('/');
        }
    }, [isAuthenticated, navigate]);

    useEffect(() => {
        // Update local error state when auth error changes
        if (authError) {
            setError(authError);
        }
    }, [authError]);

    const onFinish = async (values) => {
        try {
            setLoading(true);
            setError(null);
            
            const result = await login(values.username, values.password);
            
            if (!result?.success) {
                throw new Error(result?.error || 'Login failed');
            }

            message.success('Login successful');
            // Navigate to the intended page or home
            const from = location.state?.from || '/';
            navigate(from, { replace: true });
        } catch (error) {
            console.error('Login failed:', error);
            setError(error.message || 'Failed to login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '100vh',
            background: '#f0f2f5'
        }}>
            <Card style={{ width: 300, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                <h2 style={{ textAlign: 'center', marginBottom: 24 }}>Login</h2>
                {error && (
                    <Alert
                        message={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: 24 }}
                    />
                )}
                <Form
                    name="login"
                    onFinish={onFinish}
                    autoComplete="off"
                >
                    <Form.Item
                        name="username"
                        rules={[{ required: true, message: 'Please input your username!' }]}
                    >
                        <Input 
                            prefix={<UserOutlined />} 
                            placeholder="Username" 
                            size="large"
                            disabled={loading}
                            autoComplete="username"
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Please input your password!' }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Password"
                            size="large"
                            disabled={loading}
                            autoComplete="current-password"
                        />
                    </Form.Item>

                    <Form.Item>
                        <Button 
                            type="primary" 
                            htmlType="submit"
                            loading={loading}
                            style={{ width: '100%' }}
                            size="large"
                        >
                            Log in
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default LoginPage; 