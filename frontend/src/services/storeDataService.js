import { storeApi } from './api';

// Cache configuration
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
const BACKGROUND_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const INACTIVE_TIMEOUT = 15 * 60 * 1000; // 15 minutes

class StoreDataService {
    constructor() {
        this.cache = {
            storeItems: new Map(), // Map<storeId, items[]>
            storeDetails: new Map(), // Map<storeId, storeInfo>
            lastUpdate: {
                items: new Map(), // Map<storeId, timestamp>
                details: new Map() // Map<storeId, timestamp>
            }
        };
        this.loadingPromises = new Map();
        this.loadingStates = new Set();
        this.backgroundInterval = null;
        this.lastActivityTime = Date.now();
        this.isActive = false;
    }

    // Get store items with caching
    async getStoreItems(storeId) {
        const loadingKey = `store-${storeId}-items`;
        
        try {
            // Return existing promise if already loading
            if (this.loadingStates.has(loadingKey)) {
                console.log('Store items already loading, returning existing promise');
                const existingPromise = this.loadingPromises.get(loadingKey);
                if (existingPromise) {
                    return await existingPromise;
                }
            }

            // Check cache first
            if (this.isCacheValid(storeId, 'items')) {
                console.log('Returning cached store items');
                return {
                    success: true,
                    items: this.cache.storeItems.get(storeId)
                };
            }

            // Set loading state and create promise
            this.loadingStates.add(loadingKey);
            const promise = (async () => {
                try {
                    console.log(`Fetching items for store ${storeId} from API...`);
                    console.log('API Base URL:', process.env.REACT_APP_API_URL);
                    const response = await storeApi.getStoreItems(storeId.toString());
                    console.log('Store items API response:', response);

                    if (!response?.success) {
                        throw new Error(response?.error || 'Failed to fetch store items');
                    }

                    // Transform and validate items
                    const validItems = (response.items || []).map(item => ({
                        ...item,
                        id: item.id || item.serialnumber,
                        key: item.id || item.serialnumber,
                        store_id: storeId.toString(),
                        received_at: item.received_at || new Date().toISOString()
                    }));

                    console.log(`Processed ${validItems.length} items for store ${storeId}`);

                    // Update cache
                    this.cache.storeItems.set(storeId, validItems);
                    this.cache.lastUpdate.items.set(storeId, Date.now());

                    return {
                        success: true,
                        items: validItems
                    };
                } catch (error) {
                    console.error('Error in store items fetch:', error);
                    throw error;
                }
            })();

            // Store promise for concurrent requests
            this.loadingPromises.set(loadingKey, promise);

            try {
                return await promise;
            } finally {
                if (this.loadingPromises.get(loadingKey) === promise) {
                    this.loadingStates.delete(loadingKey);
                    this.loadingPromises.delete(loadingKey);
                }
            }
        } catch (error) {
            console.error('Error fetching store items:', error);
            return {
                success: false,
                error: error.message || 'Failed to fetch store items',
                items: []
            };
        }
    }

    // Get store details with caching
    async getStoreDetails(storeId) {
        const loadingKey = `store-${storeId}-details`;
        
        try {
            if (this.isCacheValid(storeId, 'details')) {
                console.log('Returning cached store details');
                return {
                    success: true,
                    store: this.cache.storeDetails.get(storeId)
                };
            }

            console.log(`Fetching details for store ${storeId} from API...`);
            console.log('API Base URL:', process.env.REACT_APP_API_URL);
            const response = await storeApi.getStore(storeId.toString());
            console.log('Store details API response:', response);

            if (!response?.success) {
                throw new Error(response?.error || 'Failed to fetch store details');
            }

            // Extract store details from the response
            const store = {
                id: storeId.toString(),
                name: `Store ${storeId}`,  // Default name if not provided
                items: response.items || []
            };

            // Cache the store details
            this.cache.storeDetails.set(storeId, store);
            this.cache.lastUpdate.details.set(storeId, Date.now());

            return {
                success: true,
                store
            };
        } catch (error) {
            console.error('Error fetching store details:', error);
            return {
                success: false,
                error: error.message || 'Failed to fetch store details'
            };
        }
    }

    // Delete store item
    async deleteStoreItem(storeId, itemId) {
        try {
            const response = await storeApi.deleteStoreItem(storeId, itemId);
            if (response?.success) {
                // Invalidate store items cache
                this.cache.storeItems.delete(storeId);
                this.cache.lastUpdate.items.delete(storeId);
            }
            return response;
        } catch (error) {
            console.error('Error deleting store item:', error);
            return {
                success: false,
                error: error.message || 'Failed to delete store item'
            };
        }
    }

    // Check if cache is valid
    isCacheValid(storeId, type) {
        const lastUpdate = this.cache.lastUpdate[type].get(storeId);
        if (!lastUpdate) return false;
        
        const age = Date.now() - lastUpdate;
        return age < CACHE_EXPIRY;
    }

    // Clear store cache
    clearStoreCache(storeId) {
        console.log(`Clearing cache for store ${storeId}`);
        this.cache.storeItems.delete(storeId);
        this.cache.storeDetails.delete(storeId);
        this.cache.lastUpdate.items.delete(storeId);
        this.cache.lastUpdate.details.delete(storeId);
    }

    // Clear all cache
    clearCache() {
        this.cache.storeItems.clear();
        this.cache.storeDetails.clear();
        this.cache.lastUpdate.items.clear();
        this.cache.lastUpdate.details.clear();
        this.loadingStates.clear();
        this.loadingPromises.clear();
    }
}

export const storeDataService = new StoreDataService(); 