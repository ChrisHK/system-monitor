import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    Container,
    TextField,
    Typography,
    Paper,
    Alert,
    CircularProgress
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (!username || !password) {
                setError('Please enter both username and password');
                setLoading(false);
                return;
            }

            const response = await api.post('/users/login', {
                username,
                password
            });

            if (response.data && response.data.token) {
                // Extract user data from response
                const user = response.data.user || {};
                
                // Ensure all required fields are present
                const userData = {
                    id: user.id || user._id,
                    username: user.username || username,
                    role: user.role || 'user',
                    name: user.name || username,
                    email: user.email || '',
                    created_at: user.created_at || new Date().toISOString()
                };

                // Log the processed user data
                console.log('Processed user data:', userData);

                const loginSuccess = await login(response.data.token, userData);
                if (loginSuccess) {
                    navigate('/');
                } else {
                    setError('Failed to set authentication state');
                }
            } else {
                console.error('Invalid server response:', response.data);
                setError('Invalid response from server');
            }
        } catch (error) {
            console.error('Login error:', error);
            if (error.response?.status === 401) {
                setError('Invalid username or password');
            } else if (error.response?.status === 404) {
                setError('Server not found. Please try again later.');
            } else {
                setError('Login failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <Paper
                    elevation={3}
                    sx={{
                        padding: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '100%',
                    }}
                >
                    <Typography component="h1" variant="h5">
                        Sign in
                    </Typography>
                    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {error}
                            </Alert>
                        )}
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="username"
                            label="Username"
                            name="username"
                            autoComplete="username"
                            autoFocus
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={loading}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="password"
                            label="Password"
                            type="password"
                            id="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2 }}
                            disabled={loading}
                        >
                            {loading ? <CircularProgress size={24} /> : 'Sign In'}
                        </Button>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
};

export default LoginPage; 