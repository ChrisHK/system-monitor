import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    Typography,
    Alert,
    Grid,
    Card,
    CardContent,
    CardActions,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { storeApi } from '../../services/api';

const StoreUsers = () => {
    const [users, setUsers] = useState([]);
    const [stores, setStores] = useState([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        email: '',
        role: 'user',
        store_id: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { isAdmin } = useAuth();

    useEffect(() => {
        fetchUsers();
        fetchStores();
    }, []);

    const fetchUsers = async () => {
        try {
            console.log('Fetching users...');
            const response = await storeApi.getUsers();
            console.log('Users response:', response);
            
            if (response?.success) {
                setUsers(response.users);
            } else {
                throw new Error(response?.error || 'Failed to fetch users');
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            setError('Failed to fetch users');
        }
    };

    const fetchStores = async () => {
        try {
            console.log('Fetching stores...');
            const response = await storeApi.getStores();
            console.log('Stores response:', response);
            
            if (response?.success) {
                setStores(response.stores);
            } else {
                throw new Error(response?.error || 'Failed to fetch stores');
            }
        } catch (error) {
            console.error('Error fetching stores:', error);
            setError('Failed to fetch stores');
        }
    };

    const handleOpenDialog = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                username: user.username,
                password: '',
                email: user.email,
                role: user.role || 'user',
                store_id: user.store_id || ''
            });
        } else {
            setEditingUser(null);
            setFormData({
                username: '',
                password: '',
                email: '',
                role: 'user',
                store_id: ''
            });
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingUser(null);
        setFormData({
            username: '',
            password: '',
            email: '',
            role: 'user',
            store_id: ''
        });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            let response;
            if (editingUser) {
                console.log('Updating user:', editingUser.id);
                response = await storeApi.updateUser(editingUser.id, formData);
            } else {
                console.log('Creating new user');
                response = await storeApi.createUser(formData);
            }

            console.log('User operation response:', response);
            
            if (response?.success) {
                setSuccess(editingUser ? 'User updated successfully' : 'User created successfully');
                handleCloseDialog();
                fetchUsers();
            } else {
                throw new Error(response?.error || 'Operation failed');
            }
        } catch (error) {
            console.error('Error in user operation:', error);
            setError(error.message || 'Operation failed');
        }
    };

    const handleDelete = async (userId) => {
        try {
            console.log('Deleting user:', userId);
            const response = await storeApi.deleteUser(userId);
            console.log('Delete user response:', response);
            
            if (response?.success) {
                setSuccess('User deleted successfully');
                fetchUsers();
            } else {
                throw new Error(response?.error || 'Failed to delete user');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            setError(error.message || 'Failed to delete user');
        }
    };

    if (!isAdmin()) {
        return (
            <Typography variant="h6" color="error">
                Access Denied: Admin privileges required
            </Typography>
        );
    }

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5">Store Users Management</Typography>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => handleOpenDialog()}
                >
                    Add New User
                </Button>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}
            {success && (
                <Alert severity="success" sx={{ mb: 2 }}>
                    {success}
                </Alert>
            )}

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Username</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell>Store</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>{user.role}</TableCell>
                                <TableCell>
                                    {stores.find(s => s.id === user.store_id)?.name || 'N/A'}
                                </TableCell>
                                <TableCell>
                                    <Button
                                        size="small"
                                        startIcon={<EditIcon />}
                                        onClick={() => handleOpenDialog(user)}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        size="small"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => handleDelete(user.id)}
                                    >
                                        Delete
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={openDialog} onClose={handleCloseDialog}>
                <DialogTitle>
                    {editingUser ? 'Edit User' : 'Add New User'}
                </DialogTitle>
                <DialogContent>
                    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
                        <TextField
                            fullWidth
                            label="Username"
                            value={formData.username}
                            onChange={(e) =>
                                setFormData({ ...formData, username: e.target.value })
                            }
                            margin="normal"
                            required
                        />
                        <TextField
                            fullWidth
                            label="Password"
                            type="password"
                            value={formData.password}
                            onChange={(e) =>
                                setFormData({ ...formData, password: e.target.value })
                            }
                            margin="normal"
                            required={!editingUser}
                            helperText={editingUser ? "Leave blank to keep current password" : ""}
                        />
                        <TextField
                            fullWidth
                            label="Email"
                            type="email"
                            value={formData.email}
                            onChange={(e) =>
                                setFormData({ ...formData, email: e.target.value })
                            }
                            margin="normal"
                            required
                        />
                        <FormControl fullWidth margin="normal">
                            <InputLabel>Role</InputLabel>
                            <Select
                                value={formData.role}
                                onChange={(e) =>
                                    setFormData({ ...formData, role: e.target.value })
                                }
                                label="Role"
                            >
                                <MenuItem value="admin">Admin</MenuItem>
                                <MenuItem value="user">User</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth margin="normal">
                            <InputLabel>Store</InputLabel>
                            <Select
                                value={formData.store_id}
                                onChange={(e) =>
                                    setFormData({ ...formData, store_id: e.target.value })
                                }
                                label="Store"
                            >
                                <MenuItem value="">None</MenuItem>
                                {stores.map((store) => (
                                    <MenuItem key={store.id} value={store.id}>
                                        {store.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button onClick={handleSubmit} variant="contained" color="primary">
                        {editingUser ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default StoreUsers; 