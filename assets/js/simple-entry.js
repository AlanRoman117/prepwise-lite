// Quick bulk entry for PrepWise
// Paste a plain-text list of items to add several at once.

function showSimpleItemEntry() {
    const modalHTML = `
        <div id="simple-entry-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="simple-entry-title">
            <div class="bg-white rounded-2xl max-w-lg w-full p-6">
                <div class="flex justify-between items-center mb-4">
                    <h2 id="simple-entry-title" class="text-2xl font-bold text-gray-800">Quick Add Items</h2>
                    <button type="button" data-action="simple-entry-close" data-dialog-close class="text-gray-400 hover:text-gray-600" aria-label="Close quick add">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <div class="space-y-4">
                    <p class="text-gray-600" id="bulk-items-label">Enter items from your shopping trip:</p>

                    <textarea id="bulk-items" aria-labelledby="bulk-items-label"
                              placeholder="Enter items like this:
Milk 2 cups
Bread 1 loaf  
Apples 5 units
Ground Beef 2 lbs
Eggs 12 units
..."
                              rows="10" 
                              class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"></textarea>
                    
                    <div class="text-sm text-gray-500">
                        <p><strong>Format:</strong> Item Name [Quantity] [Unit]</p>
                        <p>Quantity and unit are optional (defaults to 1 unit)</p>
                    </div>
                    
                    <div class="flex gap-2">
                        <button type="button" data-action="simple-entry-process" class="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
                            Add All Items
                        </button>
                        <button type="button" data-action="simple-entry-close" class="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function processSimpleEntry() {
    const text = document.getElementById('bulk-items').value.trim();
    if (!text) {
        alert('Please enter some items');
        return;
    }
    
    const lines = text.split('\n').filter(line => line.trim());
    let addedCount = 0;
    let updatedCount = 0;
    
    lines.forEach(line => {
        const parsed = parseSimpleEntryLine(line.trim());
        if (parsed) {
            // Check if item already exists in inventory
            const existingItem = state.inventory.find(item => 
                item.name.toLowerCase() === parsed.name.toLowerCase()
            );
            
            if (existingItem) {
                // Update existing item
                existingItem.current = Math.min(
                    existingItem.current + parsed.quantity, 
                    existingItem.max
                );
                updatedCount++;
            } else {
                // Add new item
                // Every other write into state.inventory goes through the
                // sanitizer; this one hand-built its item and so produced a
                // record missing the fields renderers read (hasExpiration,
                // expirationStatus, daysUntilExpiry) until the next reload.
                const newItem = sanitizeInventoryItem({
                    id: Date.now() + Math.random(),
                    name: parsed.name,
                    current: parsed.quantity,
                    max: Math.max(parsed.quantity * 2, parsed.quantity + 5), // Reasonable default
                    unit: parsed.unit
                });
                if (newItem) {
                    state.inventory.push(newItem);
                    addedCount++;
                }
            }
        }
    });
    
    if (addedCount > 0 || updatedCount > 0) {
        saveInventoryToStorage();
        updateView();
        
        let message = 'Success! ';
        if (addedCount > 0) message += `Added ${addedCount} new items. `;
        if (updatedCount > 0) message += `Updated ${updatedCount} existing items.`;
        
        alert(message);
    } else {
        alert('No valid items found. Please check the format:\nItem Name [Quantity] [Unit]');
    }
    
    closeSimpleEntryModal();
}

function parseSimpleEntryLine(line) {
    if (!line || line.length < 2) return null;
    
    // Pattern 1: "Item Name Quantity Unit"
    const fullMatch = line.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s+(\w+)$/);
    if (fullMatch) {
        return {
            name: fullMatch[1].trim(),
            quantity: parseFloat(fullMatch[2]),
            unit: fullMatch[3]
        };
    }
    
    // Pattern 2: "Item Name Quantity"
    const quantityMatch = line.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);
    if (quantityMatch) {
        return {
            name: quantityMatch[1].trim(),
            quantity: parseFloat(quantityMatch[2]),
            unit: 'units'
        };
    }
    
    // Pattern 3: Just "Item Name" (default to 1 unit)
    return {
        name: line.trim(),
        quantity: 1,
        unit: 'units'
    };
}

function closeSimpleEntryModal() {
    const modal = document.getElementById('simple-entry-modal');
    if (modal) {
        modal.remove();
    }
}

// Make functions globally available
window.showSimpleItemEntry = showSimpleItemEntry;
window.closeSimpleEntryModal = closeSimpleEntryModal;
window.processSimpleEntry = processSimpleEntry;