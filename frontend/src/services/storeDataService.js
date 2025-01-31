import { storeService } from '../api';

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
                const existingPromise = this.loadingPromises.get(loadingKey);
                if (existingPromise) {
                    return await existingPromise;
                }
            }

            // Check cache first
            if (this.isCacheValid(storeId, 'items')) {
                return {
                    success: true,
                    items: this.cache.storeItems.get(storeId)
                };
            }

            // Set loading state and create promise
            this.loadingStates.add(loadingKey);
            const promise = (async () => {
                try {
                    const response = await storeService.getStoreItems(storeId.toString());

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
            throw new Error(error.message || 'Failed to fetch store items');
        }
    }

    // Get store details with caching
    async getStoreDetails(storeId) {
        try {
            if (this.isCacheValid(storeId, 'details')) {
                return {
                    success: true,
                    store: this.cache.storeDetails.get(storeId)
                };
            }

            const response = await storeService.getStore(storeId.toString());

            if (!response?.success) {
                throw new Error(response?.error || 'Failed to fetch store details');
            }

            // Extract store details from the response
            const store = {
                id: storeId.toString(),
                name: response.store?.name || `Store ${storeId}`,
                ...response.store
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
            throw new Error(error.message || 'Failed to fetch store details');
        }
    }

    // Delete store item
    async deleteStoreItem(storeId, itemId) {
        try {
            const response = await storeService.deleteStoreItem(storeId, itemId);
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to delete store item');
            }

            // Invalidate store items cache
            this.cache.storeItems.delete(storeId);
            this.cache.lastUpdate.items.delete(storeId);
            
            return response;
        } catch (error) {
            console.error('Error deleting store item:', error);
            throw new Error(error.message || 'Failed to delete store item');
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

export default new StoreDataService(); 