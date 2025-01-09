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
    CardActions
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, LocationOn, Phone, Email } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const StoreManagement = () => {
    const [stores, setStores] = useState([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingStore, setEditingStore] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        phone: '',
        email: '',
        description: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { isAdmin } = useAuth();

    useEffect(() => {
        fetchStores();
    }, []);

    const fetchStores = async () => {
        try {
            const response = await api.get('/stores');
            if (response.data.success) {
                setStores(response.data.stores);
            }
        } catch (error) {
            setError('Failed to fetch stores');
        }
    };

    const handleOpenDialog = (store = null) => {
        if (store) {
            setEditingStore(store);
            setFormData({
                name: store.name,
                address: store.address,
                phone: store.phone,
                email: store.email,
                description: store.description || ''
            });
        } else {
            setEditingStore(null);
            setFormData({
                name: '',
                address: '',
                phone: '',
                email: '',
                description: ''
            });
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingStore(null);
        setFormData({
            name: '',
            address: '',
            phone: '',
            email: '',
            description: ''
        });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            if (editingStore) {
                const response = await api.put(`/stores/${editingStore.id}`, formData);
                if (response.data.success) {
                    setSuccess('Store updated successfully');
                }
            } else {
                const response = await api.post('/stores', formData);
                if (response.data.success) {
                    setSuccess('Store created successfully');
                }
            }
            handleCloseDialog();
            fetchStores();
        } catch (error) {
            setError(error.response?.data?.error || 'Operation failed');
        }
    };

    const handleDelete = async (storeId) => {
        try {
            const response = await api.delete(`/stores/${storeId}`);
            if (response.data.success) {
                setSuccess('Store deleted successfully');
                fetchStores();
            }
        } catch (error) {
            setError('Failed to delete store');
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
                <Typography variant="h5">Store Management</Typography>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => handleOpenDialog()}
                >
                    Add New Store
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

            <Grid container spacing={3}>
                {stores.map((store) => (
                    <Grid item xs={12} sm={6} md={4} key={store.id}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    {store.name}
                                </Typography>
                                <Box display="flex" alignItems="center" mb={1}>
                                    <LocationOn color="action" sx={{ mr: 1 }} />
                                    <Typography variant="body2" color="text.secondary">
                                        {store.address}
                                    </Typography>
                                </Box>
                                <Box display="flex" alignItems="center" mb={1}>
                                    <Phone color="action" sx={{ mr: 1 }} />
                                    <Typography variant="body2" color="text.secondary">
                                        {store.phone}
                                    </Typography>
                                </Box>
                                <Box display="flex" alignItems="center" mb={1}>
                                    <Email color="action" sx={{ mr: 1 }} />
                                    <Typography variant="body2" color="text.secondary">
                                        {store.email}
                                    </Typography>
                                </Box>
                                {store.description && (
                                    <Typography variant="body2" color="text.secondary" mt={2}>
                                        {store.description}
                                    </Typography>
                                )}
                            </CardContent>
                            <CardActions>
                                <Button
                                    size="small"
                                    startIcon={<EditIcon />}
                                    onClick={() => handleOpenDialog(store)}
                                >
                                    Edit
                                </Button>
                                <Button
                                    size="small"
                                    color="error"
                                    startIcon={<DeleteIcon />}
                                    onClick={() => handleDelete(store.id)}
                                >
                                    Delete
                                </Button>
                            </CardActions>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Dialog open={openDialog} onClose={handleCloseDialog}>
                <DialogTitle>
                    {editingStore ? 'Edit Store' : 'Add New Store'}
                </DialogTitle>
                <DialogContent>
                    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
                        <TextField
                            fullWidth
                            label="Store Name"
                            value={formData.name}
                            onChange={(e) =>
                                setFormData({ ...formData, name: e.target.value })
                            }
                            margin="normal"
                            required
                        />
                        <TextField
                            fullWidth
                            label="Address"
                            value={formData.address}
                            onChange={(e) =>
                                setFormData({ ...formData, address: e.target.value })
                            }
                            margin="normal"
                            required
                        />
                        <TextField
                            fullWidth
                            label="Phone"
                            value={formData.phone}
                            onChange={(e) =>
                                setFormData({ ...formData, phone: e.target.value })
                            }
                            margin="normal"
                            required
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
                        <TextField
                            fullWidth
                            label="Description"
                            value={formData.description}
                            onChange={(e) =>
                                setFormData({ ...formData, description: e.target.value })
                            }
                            margin="normal"
                            multiline
                            rows={4}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button onClick={handleSubmit} variant="contained" color="primary">
                        {editingStore ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default StoreManagement; 