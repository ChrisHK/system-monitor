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
    CircularProgress
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, LocationOn, Phone, Email } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { storeService } from '../../api';

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
    const [loading, setLoading] = useState(false);
    const { isAdmin } = useAuth();

    useEffect(() => {
        fetchStores();
    }, []);

    const fetchStores = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await storeService.getStores();
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to fetch stores');
            }
            
            setStores(response.stores);
        } catch (error) {
            console.error('Error fetching stores:', error);
            setError(error.message || 'Failed to fetch stores');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (store = null) => {
        setError('');
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
        setLoading(true);

        try {
            let response;
            if (editingStore) {
                response = await storeService.updateStore(editingStore.id, formData);
            } else {
                response = await storeService.createStore(formData);
            }
            
            if (!response?.success) {
                throw new Error(response?.error || 'Operation failed');
            }
            
            setSuccess(editingStore ? 'Store updated successfully' : 'Store created successfully');
            handleCloseDialog();
            await fetchStores();
        } catch (error) {
            console.error('Error in store operation:', error);
            setError(error.message || 'Operation failed');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (storeId) => {
        try {
            setLoading(true);
            setError('');
            const response = await storeService.deleteStore(storeId);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to delete store');
            }
            
            setSuccess('Store deleted successfully');
            await fetchStores();
        } catch (error) {
            console.error('Error deleting store:', error);
            setError(error.message || 'Failed to delete store');
        } finally {
            setLoading(false);
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
                    disabled={loading}
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

            {loading && (
                <Box display="flex" justifyContent="center" my={3}>
                    <CircularProgress />
                </Box>
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
                                    disabled={loading}
                                >
                                    Edit
                                </Button>
                                <Button
                                    size="small"
                                    color="error"
                                    startIcon={<DeleteIcon />}
                                    onClick={() => handleDelete(store.id)}
                                    disabled={loading}
                                >
                                    Delete
                                </Button>
                            </CardActions>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Dialog 
                open={openDialog} 
                onClose={handleCloseDialog}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>
                    {editingStore ? 'Edit Store' : 'Add New Store'}
                </DialogTitle>
                <DialogContent>
                    {error && (
                        <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
                            {error}
                        </Alert>
                    )}
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
                            disabled={loading}
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
                            disabled={loading}
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
                            disabled={loading}
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
                            disabled={loading}
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
                            disabled={loading}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog} disabled={loading}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        variant="contained" 
                        color="primary"
                        disabled={loading}
                    >
                        {loading ? (
                            <CircularProgress size={24} color="inherit" />
                        ) : (
                            editingStore ? 'Update' : 'Create'
                        )}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default StoreManagement; 