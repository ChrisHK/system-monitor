import React, { useState } from 'react';

const SearchBar = ({ onSearch }) => {
    const [searchField, setSearchField] = useState('serialnumber');
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (searchTerm.trim() && !isSubmitting) {
            setIsSubmitting(true);
            onSearch(searchField, searchTerm.trim());
            setIsSubmitting(false);
        }
    };

    const handleClear = () => {
        setSearchTerm('');
        setIsSubmitting(false);
        onSearch();
    };

    return (
        <div className="search-container">
            <form onSubmit={handleSubmit} className="search-box">
                <select 
                    value={searchField}
                    onChange={(e) => setSearchField(e.target.value)}
                    disabled={isSubmitting}
                >
                    <option value="serialnumber">Serial Number</option>
                    <option value="computername">Computer Name</option>
                    <option value="manufacturer">Manufacturer</option>
                    <option value="model">Model</option>
                    <option value="systemsku">System SKU</option>
                </select>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Enter search text..."
                    disabled={isSubmitting}
                />
                <button 
                    type="submit" 
                    className="search-btn"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Searching...' : 'Search'}
                </button>
                <button 
                    type="button" 
                    className="clear-btn" 
                    onClick={handleClear}
                    disabled={isSubmitting}
                >
                    Clear
                </button>
            </form>
        </div>
    );
};

export default SearchBar; 