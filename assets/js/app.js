// Prepwise - Main JavaScript Application

// Expiration Status Configuration
// ---------------------------------------------------------------------------
// Output escaping
//
// Every value that reaches innerHTML must pass through escapeHtml(). Inventory
// names, recipe titles, step text and allergen names are all user-supplied AND
// can arrive from an imported backup file, which is an untrusted input.
//
// Not for plain-text outputs (the .txt shopping list, the Markdown AI export) —
// those are not HTML and escaping them would corrupt the text.
// ---------------------------------------------------------------------------
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const EXPIRATION_STATUS = {
    fresh: {
        label: "Fresh",
        color: "bg-green-100 text-green-800 border-green-300",
        icon: "✓",
        countsAsAvailable: true
    },
    expiringSoon: {
        label: "Expiring Soon",
        color: "bg-yellow-100 text-yellow-800 border-yellow-300", 
        icon: "⚠️",
        countsAsAvailable: true,
        warning: true
    },
    expiringToday: {
        label: "Expires Today",
        color: "bg-orange-100 text-orange-800 border-orange-300",
        icon: "🔶",
        countsAsAvailable: true,
        urgent: true
    },
    expired: {
        label: "Expired",
        color: "bg-red-100 text-red-800 border-red-300",
        icon: "❌",
        countsAsAvailable: false,
        autoAddToShopping: true
    }
};

// Phase 4: Common Allergen Database (FDA Top 9 + Common Allergens)
const COMMON_ALLERGENS = {
    // FDA Major Allergens
    dairy: {
        names: ["milk", "dairy", "lactose", "casein", "whey", "butter", "cheese", "cream", "yogurt"],
        severity: "major",
        icon: "🥛",
        color: "bg-blue-100 text-blue-800 border-blue-300",
        crossContamination: ["may contain milk", "processed in facility with milk"]
    },
    eggs: {
        names: ["egg", "eggs", "albumin", "mayonnaise", "meringue"],
        severity: "major",
        icon: "🥚",
        color: "bg-yellow-100 text-yellow-800 border-yellow-300"
    },
    peanuts: {
        names: ["peanut", "peanuts", "groundnut", "arachis oil"],
        severity: "major",
        icon: "🥜",
        color: "bg-orange-100 text-orange-800 border-orange-300"
    },
    treeNuts: {
        names: ["almond", "walnut", "cashew", "pistachio", "pecan", "hazelnut", "brazil nut", "macadamia", "pine nut"],
        severity: "major",
        icon: "🌰",
        color: "bg-amber-100 text-amber-800 border-amber-300"
    },
    shellfish: {
        names: ["shrimp", "crab", "lobster", "crawfish", "scallop", "oyster", "clam", "mussel"],
        severity: "major",
        icon: "🦐",
        color: "bg-red-100 text-red-800 border-red-300"
    },
    fish: {
        names: ["salmon", "tuna", "cod", "fish", "anchovy", "sardine", "trout", "bass"],
        severity: "major",
        icon: "🐟",
        color: "bg-cyan-100 text-cyan-800 border-cyan-300"
    },
    wheat: {
        names: ["wheat", "flour", "gluten", "bread", "pasta", "semolina", "couscous"],
        severity: "major",
        icon: "🌾",
        color: "bg-yellow-100 text-yellow-800 border-yellow-300"
    },
    soy: {
        names: ["soy", "soybean", "tofu", "miso", "tempeh", "edamame", "soy sauce"],
        severity: "major",
        icon: "🫘",
        color: "bg-green-100 text-green-800 border-green-300"
    },
    sesame: {
        names: ["sesame", "tahini", "sesame oil"],
        severity: "major",
        icon: "🌰",
        color: "bg-stone-100 text-stone-800 border-stone-300"
    },
    // Additional Common Allergens
    sulfites: {
        names: ["sulfites", "sulfur dioxide", "wine", "dried fruit"],
        severity: "moderate",
        icon: "🍷",
        color: "bg-purple-100 text-purple-800 border-purple-300"
    }
};

// Common Food Shelf Life Database
const FOOD_SHELF_LIFE = {
    // Dairy Products
    milk: { days: 7, category: "dairy", requiresRefrigeration: true },
    cheese: { days: 14, category: "dairy", requiresRefrigeration: true },
    yogurt: { days: 10, category: "dairy", requiresRefrigeration: true },
    butter: { days: 30, category: "dairy", requiresRefrigeration: true },
    cream: { days: 7, category: "dairy", requiresRefrigeration: true },
    
    // Meat & Proteins
    "ground beef": { days: 2, category: "meat", requiresRefrigeration: true },
    "chicken breast": { days: 3, category: "meat", requiresRefrigeration: true },
    "ground turkey": { days: 2, category: "meat", requiresRefrigeration: true },
    "pork chops": { days: 3, category: "meat", requiresRefrigeration: true },
    eggs: { days: 21, category: "protein", requiresRefrigeration: true },
    
    // Produce
    bananas: { days: 5, category: "fruit", requiresRefrigeration: false },
    apples: { days: 30, category: "fruit", requiresRefrigeration: false },
    oranges: { days: 14, category: "fruit", requiresRefrigeration: false },
    strawberries: { days: 3, category: "fruit", requiresRefrigeration: true },
    lettuce: { days: 7, category: "vegetable", requiresRefrigeration: true },
    tomatoes: { days: 7, category: "vegetable", requiresRefrigeration: false },
    carrots: { days: 21, category: "vegetable", requiresRefrigeration: true },
    potatoes: { days: 30, category: "vegetable", requiresRefrigeration: false },
    
    // Pantry Items
    bread: { days: 5, category: "grain", requiresRefrigeration: false },
    pasta: { days: 730, category: "grain", requiresRefrigeration: false }, // 2 years
    rice: { days: 730, category: "grain", requiresRefrigeration: false }, // 2 years
    "canned tomatoes": { days: 1095, category: "canned", requiresRefrigeration: false }, // 3 years
    "olive oil": { days: 730, category: "oil", requiresRefrigeration: false }, // 2 years
    
    // Frozen Items
    "frozen vegetables": { days: 365, category: "frozen", requiresRefrigeration: true },
    "frozen fruit": { days: 365, category: "frozen", requiresRefrigeration: true },
    "ice cream": { days: 60, category: "frozen", requiresRefrigeration: true }
};

// ---------------------------------------------------------------------------
// Defaults
//
// Declared before `state` because both the initial state and sanitizeBackup()
// build from them. Keeping one copy is what stops an imported profile from
// being accepted with a shape the rest of the app does not expect.
// ---------------------------------------------------------------------------
const DEFAULT_EXPIRATION_SETTINGS = {
    enableNotifications: true,
    warningDays: 3, // Days before expiry to show warning
    autoAddExpiredToShopping: true,
    autoRemoveExpiredFromRecipes: true,
    dailyExpirationCheck: true,
    lastNotificationCheck: null
};

const DEFAULT_ALERT_PREFERENCES = {
    showWarnings: true,
    blockDangerous: true,
    alertLevel: 'all',
    requireConfirmation: true
};

const ALERT_LEVELS = ['all', 'severe', 'life-threatening'];

/*
 * The one definition of an empty profile.
 *
 * There were two, and they disagreed: the initial state used
 * {allergies, dietaryRestrictions, alertPreferences} while confirmClearData()
 * rebuilt it as {allergies, dietaryPreferences, alertSettings} - two keys that
 * nothing else in the app reads. Clearing your data therefore left
 * alertPreferences undefined, so every allergy-warning preference silently
 * reverted until the next reload re-sanitized it. Both callers now come here.
 */
function emptyUserProfile() {
    return {
        allergies: [],
        alertPreferences: { ...DEFAULT_ALERT_PREFERENCES }
    };
}

/*
 * The measures the app offers. Most kitchens use two or three of these over and
 * over, so the last one chosen becomes the next default - see rememberUnit().
 */
const UNITS = ['units', 'oz', 'lb', 'g', 'kg', 'cups', 'tbsp', 'tsp'];

/*
 * Ordered least to most dangerous. The wording follows how allergy severity is
 * usually described to patients: an intolerance that is merely unpleasant, up
 * to anaphylaxis. getSeverityLevel() ranks these, and 'life-threatening' is the
 * one that turns a recipe warning from advisory into blocking.
 */
const ALLERGY_SEVERITIES = ['mild', 'moderate', 'severe', 'life-threatening'];

const SEVERITY_LABELS = {
    'mild': 'Mild',
    'moderate': 'Moderate',
    'severe': 'Severe',
    'life-threatening': 'Life-threatening'
};

const SEVERITY_CLASSES = {
    'mild': 'severity-mild',
    'moderate': 'severity-moderate',
    'severe': 'severity-severe',
    'life-threatening': 'severity-critical'
};

// Application State
let state = {
    view: 'overview',
    inventory: [],
    recipes: [],
    showInventoryForm: false,
    showRecipeForm: false,
    selectedRecipe: null,
    editingInventoryId: null,
    editingRecipeId: null,
    recipeSearch: '',
    recipeFilter: 'all',
    inventorySearch: '',
    inventorySort: 'name',
    // New expiration settings
    expirationSettings: { ...DEFAULT_EXPIRATION_SETTINGS },
    // Phase 4: User Allergy Profile
    userProfile: emptyUserProfile()
};

// DOM Elements Cache
const elements = {
    navigation: {
        overviewBtn: null,
        inventoryBtn: null,
        recipesBtn: null,
        settingsBtn: null
    },
    views: {
        overview: null,
        inventory: null,
        recipes: null,
        settings: null
    },
    overview: {
        percentage: null,
        availableRecipes: null,
        totalRecipes: null,
        lowStockCount: null,
        expiringSoonCount: null,
        expiredCount: null,
        expirationAlert: null,
        expirationList: null,
        conflictsAlert: null,
        conflictsList: null,
        shoppingList: null,
        shoppingItems: null,
        copyShoppingBtn: null
    },
    inventory: {
        addBtn: null,
        form: null,
        list: null,
        formElements: {
            name: null,
            current: null,
            max: null,
            unit: null,
            saveBtn: null,
            cancelBtn: null
        }
    },
    recipes: {
        addBtn: null,
        exportBtn: null,
        form: null,
        grid: null,
        search: null,
        filter: null,
        conflictsAlert: null,
        conflictsSummary: null,
        conflictsDetails: null,
        noRecipesMessage: null,
        formElements: {
            name: null,
            prepTime: null,
            cookTime: null,
            servings: null,
            ingredients: null,
            steps: null,
            saveBtn: null,
            cancelBtn: null,
            addIngredientBtn: null,
            addStepBtn: null,
            addParagraphBtn: null
        }
    },
    modal: {
        container: null,
        title: null,
        meta: null,
        ingredients: null,
        instructions: null,
        closeBtn: null
    }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    initializeIcons();
    initializeEventListeners();
    initializeActionDelegation();
    initializeDialogAccessibility();
    loadData();
    initializeTimers();
    updateView();
});

// Initialize DOM element references
function initializeElements() {
    // Navigation
    elements.navigation.overviewBtn = document.getElementById('overview-btn');
    elements.navigation.inventoryBtn = document.getElementById('inventory-btn');
    elements.navigation.recipesBtn = document.getElementById('recipes-btn');
    elements.navigation.timersBtn = document.getElementById('timers-btn');
    elements.navigation.settingsBtn = document.getElementById('settings-btn');

    // Views
    elements.views.overview = document.getElementById('overview-view');
    elements.views.inventory = document.getElementById('inventory-view');
    elements.views.recipes = document.getElementById('recipes-view');
    elements.views.timers = document.getElementById('timers-view');
    elements.views.settings = document.getElementById('settings-view');

    // Overview elements
    elements.overview.percentage = document.getElementById('overall-percentage');
    elements.overview.availableRecipes = document.getElementById('available-recipes');
    elements.overview.totalRecipes = document.getElementById('total-recipes');
    elements.overview.lowStockCount = document.getElementById('low-stock-count');
    elements.overview.expiringSoonCount = document.getElementById('expiring-soon-count');
    elements.overview.expiredCount = document.getElementById('expired-count');
    elements.overview.expirationAlert = document.getElementById('expiration-alert');
    elements.overview.expirationList = document.getElementById('expiration-list');
    elements.overview.conflictsAlert = document.getElementById('conflicts-alert');
    elements.overview.conflictsList = document.getElementById('conflicts-list');
    elements.overview.shoppingList = document.getElementById('shopping-list');
    elements.overview.shoppingItems = document.getElementById('shopping-items');

    // Inventory elements
    elements.inventory.addBtn = document.getElementById('add-inventory-btn');
    elements.inventory.form = document.getElementById('inventory-form');
    elements.inventory.list = document.getElementById('inventory-list');
    elements.inventory.search = document.getElementById('inventory-search');
    elements.inventory.formElements.name = document.getElementById('item-name');
    elements.inventory.formElements.current = document.getElementById('item-current');
    elements.inventory.formElements.max = document.getElementById('item-max');
    elements.inventory.formElements.unit = document.getElementById('item-unit');
    elements.inventory.formElements.saveBtn = document.getElementById('save-inventory-btn');
    elements.inventory.formElements.cancelBtn = document.getElementById('cancel-inventory-btn');

    // Recipe elements
    elements.recipes.addBtn = document.getElementById('add-recipe-btn');
    elements.recipes.exportBtn = document.getElementById('export-recipes-btn');
    elements.recipes.form = document.getElementById('recipe-form');
    elements.recipes.grid = document.getElementById('recipes-grid');
    elements.recipes.search = document.getElementById('recipe-search');
    elements.recipes.filter = document.getElementById('recipe-filter');
    elements.recipes.conflictsAlert = document.getElementById('recipe-conflicts-alert');
    elements.recipes.conflictsSummary = document.getElementById('recipe-conflicts-summary');
    elements.recipes.conflictsDetails = document.getElementById('recipe-conflicts-details');
    elements.recipes.noRecipesMessage = document.getElementById('no-recipes-message');
    
    elements.recipes.formElements.name = document.getElementById('recipe-name');
    elements.recipes.formElements.prepTime = document.getElementById('recipe-prep-time');
    elements.recipes.formElements.cookTime = document.getElementById('recipe-cook-time');
    elements.recipes.formElements.servings = document.getElementById('recipe-servings');
    elements.recipes.formElements.ingredients = document.getElementById('recipe-ingredients');
    elements.recipes.formElements.steps = document.getElementById('recipe-steps');
    elements.recipes.formElements.saveBtn = document.getElementById('save-recipe-btn');
    elements.recipes.formElements.cancelBtn = document.getElementById('cancel-recipe-btn');
    elements.recipes.formElements.addIngredientBtn = document.getElementById('add-ingredient-btn');
    elements.recipes.formElements.addStepBtn = document.getElementById('add-step-btn');
    elements.recipes.formElements.addParagraphBtn = document.getElementById('add-paragraph-btn');

    // Modal elements
    elements.modal.container = document.getElementById('recipe-modal');
    elements.modal.title = document.getElementById('modal-recipe-title');
    elements.modal.meta = document.getElementById('modal-recipe-meta');
    elements.modal.ingredients = document.getElementById('modal-ingredients');
    elements.modal.instructions = document.getElementById('modal-instructions');
    elements.modal.closeBtn = document.getElementById('close-modal-btn');
}

// Initialize Lucide icons
function initializeIcons() {
    // Create icons after page load
    setTimeout(() => {
        // Chef hat icon
        const chefHatIcon = document.getElementById('chef-hat-icon');
        if (chefHatIcon) {
            chefHatIcon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"></path><line x1="6" y1="17" x2="18" y2="17"></line></svg>';
        }

        // Shopping cart icon
        const shoppingCartIcon = document.getElementById('shopping-cart-icon');
        if (shoppingCartIcon) {
            shoppingCartIcon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="m2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg>';
        }

        // Replace icon placeholders throughout the document
        replaceIconPlaceholders();
    }, 100);
}

// Replace icon placeholders with actual SVG icons
function replaceIconPlaceholders() {
    const iconMappings = {
        'plus-icon': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>',
        'check-icon': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>',
        'x-icon': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>',
        'edit-icon': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1"></path><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z"></path><path d="M16 5l3 3"></path></svg>',
        'trash-icon': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>',
        'download-icon': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7,10 12,15 17,10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
        'search-icon': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>',
        'clock-icon': '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12,6 12,12 16,14"></polyline></svg>',
        'chef-hat-icon': '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"></path><line x1="6" y1="17" x2="18" y2="17"></line></svg>'
    };

    Object.keys(iconMappings).forEach(className => {
        const elements = document.querySelectorAll('.' + className);
        elements.forEach(element => {
            element.innerHTML = iconMappings[className];
        });
    });

    // Add plus icon to buttons
    document.querySelectorAll('.plus-icon').forEach(el => {
        el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5v14"></path></svg>';
    });
}

// Initialize event listeners
function initializeEventListeners() {
    // Navigation
    elements.navigation.overviewBtn.addEventListener('click', () => setView('overview'));
    elements.navigation.inventoryBtn.addEventListener('click', () => setView('inventory'));
    elements.navigation.recipesBtn.addEventListener('click', () => setView('recipes'));
    elements.navigation.timersBtn.addEventListener('click', () => setView('timers'));
    if (elements.inventory.search) {
        elements.inventory.search.addEventListener('input', handleInventorySearch);
    }
    elements.navigation.settingsBtn.addEventListener('click', () => setView('settings'));

    // Inventory
    elements.inventory.addBtn.addEventListener('click', () => showInventoryForm());
    elements.inventory.formElements.saveBtn.addEventListener('click', saveInventoryItem);
    elements.inventory.formElements.cancelBtn.addEventListener('click', () => hideInventoryForm());
    
    // Add event listener for expiration date suggestions
    elements.inventory.formElements.name.addEventListener('input', handleExpirationSuggestion);

    // Recipes
    elements.recipes.addBtn.addEventListener('click', () => showRecipeForm());
    elements.recipes.exportBtn.addEventListener('click', exportRecipesToJSON);
    elements.recipes.formElements.saveBtn.addEventListener('click', saveRecipe);
    elements.recipes.formElements.cancelBtn.addEventListener('click', () => hideRecipeForm());
    elements.recipes.formElements.addIngredientBtn.addEventListener('click', addIngredientRow);
    elements.recipes.formElements.addStepBtn.addEventListener('click', () => addStepRow('step'));
    elements.recipes.formElements.addParagraphBtn.addEventListener('click', () => addStepRow('paragraph'));
    elements.recipes.search.addEventListener('input', handleRecipeSearch);
    elements.recipes.filter.addEventListener('change', handleRecipeFilter);

    // Export buttons

    // Modal
    elements.modal.closeBtn.addEventListener('click', () => closeRecipeModal());
    elements.modal.container.addEventListener('click', (e) => {
        if (e.target === elements.modal.container) {
            closeRecipeModal();
        }
    });

    // Import file input
    const importFileInput = document.getElementById('import-file-input');
    if (importFileInput) {
        importFileInput.addEventListener('change', handleImportFile);
    }

    // Clear data confirmation checkbox
    const confirmCheckbox = document.getElementById('confirm-clear-checkbox');
    if (confirmCheckbox) {
        confirmCheckbox.addEventListener('change', (e) => {
            const confirmBtn = document.getElementById('confirm-clear-btn');
            if (confirmBtn) {
                confirmBtn.disabled = !e.target.checked;
            }
        });
    }
}

function handleExpirationSuggestion() {
    const itemName = elements.inventory.formElements.name.value.trim();
    const trackingEnabled = document.getElementById('track-expiration-checkbox')?.checked;
    
    if (itemName && trackingEnabled) {
        const purchaseDate = document.getElementById('purchase-date-input')?.value || new Date().toISOString().split('T')[0];
        const suggestion = suggestExpirationDate(itemName, new Date(purchaseDate));
        
        const suggestionBox = document.getElementById('suggestion-box');
        const suggestionText = document.getElementById('suggestion-text');
        const useSuggestionBtn = document.getElementById('use-suggestion-btn');
        
        if (suggestion && suggestionBox && suggestionText && useSuggestionBtn) {
            suggestionText.textContent = `💡 Suggested expiry: ${suggestion.suggestedDate} (${suggestion.shelfLifeDays} days from purchase)`;
            useSuggestionBtn.style.display = 'block';
            suggestionBox.style.display = 'block';
            
            useSuggestionBtn.onclick = () => {
                const expirationDateInput = document.getElementById('expiration-date-input');
                if (expirationDateInput) {
                    expirationDateInput.value = suggestion.suggestedDate;
                }
                suggestionBox.style.display = 'none';
            };
        } else if (suggestionBox) {
            suggestionBox.style.display = 'none';
        }
    }
}

// View Management
function setView(viewName) {
    state.view = viewName;
    updateView();
}

function updateView() {
    // Update navigation buttons. aria-current mirrors the .active class so the
    // selected tab is announced, not just tinted.
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.removeAttribute('aria-current');
    });
    const activeBtn = document.querySelector(`#${state.view}-btn`);
    activeBtn.classList.add('active');
    activeBtn.setAttribute('aria-current', 'true');

    // Update view visibility
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.querySelector(`#${state.view}-view`).classList.add('active');

    // Update view-specific content
    switch (state.view) {
        case 'overview':
            updateOverviewView();
            break;
        case 'inventory':
            updateInventoryView();
            break;
        case 'recipes':
            updateRecipesView();
            break;
        case 'timers':
            updateTimersView();
            break;
        case 'settings':
            updateSettingsView();
            break;
    }
}

// Data Management
function loadData() {
    try {
        const inventoryData = localStorage.getItem('prepwise-inventory');
        const recipesData = localStorage.getItem('prepwise-recipes');

        // localStorage is an input like any other: it holds whatever a previous
        // build wrote, whatever an import let through before sanitizeBackup()
        // existed, and whatever anyone typed into devtools. Repair it on the way
        // in rather than trusting it for the lifetime of the app.
        if (inventoryData) {
            const parsed = JSON.parse(inventoryData);
            state.inventory = Array.isArray(parsed)
                ? ensureUniqueIds(parsed.map(sanitizeInventoryItem).filter(Boolean))
                : [];
        }
        if (recipesData) {
            const parsed = JSON.parse(recipesData);
            state.recipes = Array.isArray(parsed)
                ? ensureUniqueIds(parsed.map(sanitizeRecipe).filter(Boolean))
                : [];
        }

        // Initialize expiration monitoring after loading data
        initializeExpirationMonitoring();

        // Phase 4: Load user allergy profile
        loadUserProfile();
    } catch (error) {
        // No existing data found
    }
}

function saveInventoryToStorage() {
    try {
        const dataString = JSON.stringify(state.inventory);
        localStorage.setItem('prepwise-inventory', dataString);
    } catch (error) {
        console.error('❌ Failed to save inventory:', error);
    }
}

function saveRecipesToStorage() {
    try {
        localStorage.setItem('prepwise-recipes', JSON.stringify(state.recipes));
    } catch (error) {
        console.error('Failed to save recipes:', error);
    }
}

function saveExpirationSettings() {
    try {
        localStorage.setItem('prepwise-expiration-settings', JSON.stringify(state.expirationSettings));
    } catch (error) {
        console.error('Failed to save expiration settings:', error);
    }
}

// Phase 4: User Profile Storage Functions
function saveUserProfile() {
    try {
        localStorage.setItem('prepwise-user-profile', JSON.stringify(state.userProfile));
    } catch (error) {
        console.error('Failed to save user profile:', error);
    }
}

function loadUserProfile() {
    try {
        const profileData = localStorage.getItem('prepwise-user-profile');
        if (profileData) {
            // Guarantees alertPreferences exists, whatever was stored - the
            // allergy modal reads it unguarded.
            state.userProfile = sanitizeUserProfile(JSON.parse(profileData));
        }
    } catch (error) {
        console.error('Failed to load user profile:', error);
    }
}

function loadExpirationSettings() {
    try {
        const settings = localStorage.getItem('prepwise-expiration-settings');
        if (settings) {
            // warningDays drives every freshness calculation; an out-of-range
            // value stored here would mislabel the whole pantry.
            state.expirationSettings = sanitizeExpirationSettings(JSON.parse(settings));
        }
    } catch (error) {
        console.error('Failed to load expiration settings:', error);
    }
}

// Expiration Management Functions
function calculateExpirationStatus(item) {
    if (!item.hasExpiration || !item.expirationDate) {
        return { status: 'fresh', daysUntilExpiry: null };
    }
    
    const today = new Date();
    const expiryDate = new Date(item.expirationDate);
    const timeDiff = expiryDate.getTime() - today.getTime();
    const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    let status;
    if (daysUntilExpiry < 0) {
        status = 'expired';
    } else if (daysUntilExpiry === 0) {
        status = 'expiringToday';
    } else if (daysUntilExpiry <= state.expirationSettings.warningDays) {
        status = 'expiringSoon';
    } else {
        status = 'fresh';
    }
    
    return { status, daysUntilExpiry, expiryDate };
}

// Recompute derived expiration fields in memory. No persistence, no notifications —
// safe to call from read-only paths (e.g. building an export) that must not surprise
// the user with a modal or write to storage.
function refreshExpirationStatuses() {
    state.inventory.forEach(item => {
        const expirationInfo = calculateExpirationStatus(item);
        item.expirationStatus = expirationInfo.status;
        item.daysUntilExpiry = expirationInfo.daysUntilExpiry;
        item.lastExpirationCheck = new Date().toISOString().split('T')[0];
    });
}

function updateAllExpirationStatuses() {
    refreshExpirationStatuses();

    saveInventoryToStorage();
    checkForExpirationNotifications();
}

function suggestExpirationDate(itemName, purchaseDate = new Date()) {
    const normalizedName = itemName.toLowerCase().trim();
    
    // Direct match
    let shelfLife = FOOD_SHELF_LIFE[normalizedName];
    
    // Partial match if no direct match
    if (!shelfLife) {
        const match = Object.entries(FOOD_SHELF_LIFE).find(([key, value]) => 
            normalizedName.includes(key) || key.includes(normalizedName)
        );
        shelfLife = match?.[1];
    }
    
    if (shelfLife) {
        const expiryDate = new Date(purchaseDate);
        expiryDate.setDate(expiryDate.getDate() + shelfLife.days);
        return {
            suggestedDate: expiryDate.toISOString().split('T')[0],
            shelfLifeDays: shelfLife.days,
            category: shelfLife.category,
            confidence: normalizedName in FOOD_SHELF_LIFE ? 'high' : 'medium'
        };
    }
    
    return null;
}

function getExpiredItems() {
    return state.inventory.filter(item => 
        item.hasExpiration && item.expirationStatus === 'expired'
    );
}

function getExpiringSoonItems() {
    return state.inventory.filter(item => 
        item.hasExpiration && 
        (item.expirationStatus === 'expiringSoon' || item.expirationStatus === 'expiringToday')
    );
}

function getExpiringTodayItems() {
    return state.inventory.filter(item => 
        item.hasExpiration && item.expirationStatus === 'expiringToday'
    );
}

function getExpirationStatusInfo(item) {
    switch(item.expirationStatus) {
        case 'expired':
            return {
                text: 'EXPIRED',
                badgeClass: 'bg-red-100 text-red-800',
                borderColor: 'border-red-500'
            };
        case 'expiringToday':
            return {
                text: 'EXPIRES TODAY',
                badgeClass: 'bg-orange-100 text-orange-800',
                borderColor: 'border-orange-500'
            };
        case 'expiringSoon':
            return {
                text: 'EXPIRING SOON',
                badgeClass: 'bg-yellow-100 text-yellow-800',
                borderColor: 'border-yellow-500'
            };
        default:
            return {
                text: 'FRESH',
                badgeClass: 'bg-green-100 text-green-800',
                borderColor: 'border-green-500'
            };
    }
}

function checkForExpirationNotifications() {
    const today = new Date().toISOString().split('T')[0];
    const expiringItems = state.inventory.filter(item => {
        if (!item.hasExpiration) return false;
        
        const status = item.expirationStatus;
        return (status === 'expiringSoon' || status === 'expiringToday' || status === 'expired') 
               && !item.expirationNotified;
    });
    
    if (expiringItems.length > 0 && state.expirationSettings.enableNotifications) {
        showExpirationNotificationModal(expiringItems);
        
        // Mark as notified
        expiringItems.forEach(item => {
            item.expirationNotified = true;
        });
        saveInventoryToStorage();
    }
}

function initializeExpirationMonitoring() {
    // Load expiration settings
    loadExpirationSettings();
    
    // Run expiration check on app startup
    updateAllExpirationStatuses();
    
    // Set up daily check (if user has enabled it)
    if (state.expirationSettings.dailyExpirationCheck) {
        const lastCheck = state.expirationSettings.lastNotificationCheck;
        const today = new Date().toISOString().split('T')[0];
        
        // Only check once per day
        if (lastCheck !== today) {
            updateAllExpirationStatuses();
            
            // Update last check date
            state.expirationSettings.lastNotificationCheck = today;
            saveExpirationSettings();
        }
    }
}

// UI Helper Functions for Expiration
function toggleExpirationFields(enabled) {
    const expirationInputs = document.getElementById('expiration-inputs');
    if (expirationInputs) {
        expirationInputs.style.display = enabled ? 'block' : 'none';
    }
}

// ============================================================================
// Phase 4: Allergen Detection and Analysis Functions
// ============================================================================

function detectAllergens(ingredientName) {
    const detected = [];
    const name = ingredientName.toLowerCase().trim();

    Object.entries(COMMON_ALLERGENS).forEach(([allergen, data]) => {
        const matches = data.names.filter(keyword => {
            // Exact match gets highest confidence
            if (name === keyword) return true;
            // Word boundary match gets high confidence
            if (name.includes(` ${keyword} `) || name.startsWith(`${keyword} `) || name.endsWith(` ${keyword}`)) return true;
            // Partial match gets medium confidence
            if (name.includes(keyword)) return true;
            return false;
        });

        if (matches.length > 0) {
            const confidence = name === matches[0] ? 'high' :
                           name.includes(` ${matches[0]} `) ? 'high' : 'medium';

            detected.push({
                allergen,
                confidence,
                matchedKeyword: matches[0],
                severity: data.severity,
                icon: data.icon,
                color: data.color
            });
        }
    });

    return detected;
}

/*
 * Recipes reaching these helpers may predate sanitizeBackup() or have been
 * hand-edited in localStorage, where `ingredients` and `steps` are merely
 * conventional. Ten call sites used to assume an array; a recipe without one
 * threw on every render, on every load, until the user cleared all data.
 */
function recipeIngredients(recipe) {
    return Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
}

function recipeSteps(recipe) {
    return Array.isArray(recipe?.steps) ? recipe.steps : [];
}

function analyzeRecipeAllergies(recipe) {
    const userAllergies = state.userProfile?.allergies || [];
    const recipeAllergens = [];

    // Analyze each ingredient
    recipeIngredients(recipe).forEach(ingredient => {
        const detectedAllergens = detectAllergens(ingredient.item);
        const inventoryItem = state.inventory.find(item =>
            item.name.toLowerCase() === ingredient.item.toLowerCase()
        );

        // Use verified allergens from inventory if available
        const finalAllergens = inventoryItem?.allergens ||
                              detectedAllergens.map(d => d.allergen);

        finalAllergens.forEach(allergen => {
            if (!recipeAllergens.find(ra => ra.allergen === allergen)) {
                const allergenData = detectedAllergens.find(d => d.allergen === allergen) || {};
                recipeAllergens.push({
                    allergen,
                    ingredient: ingredient.item,
                    verified: !!inventoryItem?.verified,
                    icon: allergenData.icon || '⚠️',
                    color: allergenData.color || 'bg-gray-100 text-gray-800'
                });
            }
        });
    });

    // Find conflicts with user allergies
    const conflicts = userAllergies.filter(userAllergy =>
        recipeAllergens.some(recipeAllergen =>
            recipeAllergen.allergen === userAllergy.name
        )
    );

    const hasLifeThreatening = conflicts.some(c => c.severity === 'life-threatening');
    const hasSevere = conflicts.some(c => c.severity === 'severe');

    return {
        recipeAllergens,
        conflicts,
        hasConflicts: conflicts.length > 0,
        hasLifeThreatening,
        hasSevere,
        safetyLevel: hasLifeThreatening ? 'danger' :
                     hasSevere ? 'warning' :
                     conflicts.length > 0 ? 'caution' : 'safe'
    };
}

function getSeverityLevel(severity) {
    const levels = {
        'life-threatening': 4,
        'severe': 3,
        'moderate': 2,
        'mild': 1
    };
    return levels[severity] || 0;
}

function renderRecipeAllergyStatus(recipe) {
    const userAllergies = state.userProfile?.allergies || [];

    // If user has no allergies set up, don't show status
    if (userAllergies.length === 0) {
        return '';
    }

    const analysis = analyzeRecipeAllergies(recipe);
    const conflicts = analysis.conflicts;

    if (conflicts.length === 0) {
        return `<div class="inline-block px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700 border border-green-300">✓ Safe for You</div>`;
    }

    const maxSeverity = Math.max(...conflicts.map(c => getSeverityLevel(c.severity)));
    const isLifeThreatening = conflicts.some(c => c.severity === 'life-threatening');

    if (isLifeThreatening) {
        return `
            <div class="space-y-2">
                <div class="inline-block px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-800 border-2 border-red-500">
                    🚨 DANGER - Life Threatening
                </div>
                <div class="text-xs bg-red-50 p-2 rounded border border-red-200">
                    <div class="font-bold text-red-900 mb-1">Contains:</div>
                    ${conflicts.map(c => `
                        <div class="flex items-center gap-1">
                            <span>${COMMON_ALLERGENS[c.name]?.icon || '⚠️'}</span>
                            <span class="font-medium text-red-800">${escapeHtml(c.name)}</span>
                            <span class="text-red-600">(${escapeHtml(c.severity)})</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else {
        const alertColor = maxSeverity >= 3 ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-yellow-100 text-yellow-800 border-yellow-300';
        return `
            <div class="space-y-2">
                <div class="inline-block px-3 py-1 rounded-full text-sm font-bold ${alertColor} border">
                    ⚠️ ALLERGY WARNING
                </div>
                <div class="text-xs space-y-1">
                    ${conflicts.map(c => `
                        <div class="flex items-center gap-1">
                            <span>${COMMON_ALLERGENS[c.name]?.icon || '⚠️'}</span>
                            <span class="font-medium">${escapeHtml(c.name)}</span>
                            <span class="text-gray-600">(${escapeHtml(c.severity)})</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
}

/**
 * The start-timer control shown beside a recipe step that declares a duration.
 *
 * Pressing it starts the timer without leaving the recipe, and the button turns
 * into the live countdown for that step - the cook stays where they are reading
 * rather than being thrown to another view mid-instruction. The `source` key
 * ties the timer to the step so reopening the recipe finds it still running.
 */
/**
 * Present prep/cook/servings with the unit the form asked for.
 *
 * The fields are still free text, because "overnight" and "1 hr 20" are things
 * cooks legitimately write. A bare number gets the unit appended; anything with
 * words in it is already self-describing and is shown as typed.
 */
function formatRecipeMeta(value, unit) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return /^\d+(\.\d+)?$/.test(text) ? `${text} ${unit}` : text;
}

/*
 * Ticking ingredients off while you cook.
 *
 * Held in memory rather than localStorage: a tick means "I have already put
 * this in the pan", which is only true for the next twenty minutes. Persisting
 * it would mean reopening a recipe next week with half of it greyed out.
 */
const cookingChecks = new Map();

function toggleCookCheck(index, checked) {
    const recipe = state.selectedRecipe;
    if (!recipe) return;

    if (!cookingChecks.has(recipe.id)) cookingChecks.set(recipe.id, new Set());
    const used = cookingChecks.get(recipe.id);

    const position = Number(index);
    if (checked) used.add(position); else used.delete(position);

    const row = elements.modal.ingredients.querySelector(`[data-index="${position}"]`)?.closest('.cook-ingredient');
    if (row) row.classList.toggle('is-used', checked);

    updateCookProgress(recipe);
}

function updateCookProgress(recipe) {
    const total = recipeIngredients(recipe).length;
    const used = (cookingChecks.get(recipe.id) || new Set()).size;

    const label = document.getElementById('cook-progress');
    if (label) {
        label.textContent = used ? `${used} of ${total} used` : '';
    }

    const finish = document.getElementById('recipe-complete-btn');
    if (finish) finish.classList.toggle('hidden', used === 0);
}

/**
 * What "Recipe completed" would do to the pantry.
 *
 * Each ticked ingredient is matched to a pantry item and the amount deducted.
 * Two things are deliberately *not* deducted automatically:
 *
 *   - anything the pantry does not hold, since there is nothing to subtract;
 *   - anything whose unit differs from the pantry's. The app compares
 *     quantities without converting units, which is a harmless simplification
 *     while it only affects a badge - but subtracting 2 "cups" from a figure
 *     recorded in "lb" would silently corrupt the stored amount. Those rows are
 *     listed, flagged, and left unticked for the cook to decide.
 */
function planRecipeDeduction(recipe) {
    const used = cookingChecks.get(recipe.id) || new Set();

    return recipeIngredients(recipe).map((ing, index) => {
        if (!used.has(index)) return null;

        const item = findInventoryItemByName(ing.item);
        const amount = parseFloat(ing.amount);
        const known = Number.isFinite(amount) && amount > 0;

        if (!item) {
            return { name: ing.item, status: 'absent', amount: ing.amount, unit: ing.unit };
        }
        if (!known) {
            return { name: ing.item, status: 'unmeasured', item, amount: ing.amount, unit: ing.unit };
        }
        if (String(item.unit).toLowerCase() !== String(ing.unit).toLowerCase()) {
            return {
                name: ing.item, status: 'unit-mismatch', item, amount, unit: ing.unit,
                pantryUnit: item.unit, before: item.current
            };
        }
        return {
            name: ing.item, status: 'ready', item, amount, unit: ing.unit,
            before: item.current, after: Math.max(0, item.current - amount)
        };
    }).filter(Boolean);
}

/** Show what finishing the recipe would change, and let the cook adjust it. */
function showRecipeCompleteModal() {
    const recipe = state.selectedRecipe;
    if (!recipe) return;

    const plan = planRecipeDeduction(recipe);
    const modal = document.getElementById('recipe-complete-modal');
    const list = document.getElementById('recipe-complete-list');
    if (!modal || !list) return;

    if (!plan.length) {
        showNotification('Tick the ingredients you used first', 'error');
        return;
    }

    list.innerHTML = plan.map((row, index) => {
        // Only rows that can be deducted safely are ticked to begin with.
        const deductible = row.status === 'ready';
        const note = {
            'ready': `${row.before} → ${row.after} ${escapeHtml(row.unit)}`,
            'unit-mismatch': `recipe says ${escapeHtml(row.unit)}, pantry holds ${escapeHtml(row.pantryUnit)} — check before deducting`,
            'absent': 'not in your pantry, nothing to deduct',
            'unmeasured': 'no amount given, nothing to deduct'
        }[row.status];

        return `
            <label class="complete-row ${deductible ? '' : 'is-blocked'}">
                <input type="checkbox" data-complete-index="${index}" ${deductible ? 'checked' : ''}
                       ${row.status === 'absent' || row.status === 'unmeasured' ? 'disabled' : ''}>
                <span class="complete-name">${escapeHtml(row.name)}</span>
                <span class="complete-note">${note}</span>
            </label>
        `;
    }).join('');

    // Stash the plan for the confirm step.
    modal.dataset.recipeId = recipe.id;
    pendingCompletion = plan;
    modal.classList.remove('hidden');
}

let pendingCompletion = null;

function closeRecipeCompleteModal() {
    document.getElementById('recipe-complete-modal')?.classList.add('hidden');
    pendingCompletion = null;
}

/** Apply only the rows still ticked in the confirmation. */
function confirmRecipeComplete() {
    const recipe = state.selectedRecipe;
    if (!recipe || !pendingCompletion) return closeRecipeCompleteModal();

    const chosen = Array.from(
        document.querySelectorAll('#recipe-complete-list input[data-complete-index]:checked')
    ).map(input => pendingCompletion[Number(input.dataset.completeIndex)]);

    let changed = 0;
    chosen.forEach(row => {
        if (!row || !row.item) return;
        const amount = parseFloat(row.amount);
        if (!Number.isFinite(amount) || amount <= 0) return;
        row.item.current = Math.max(0, row.item.current - amount);
        changed++;
    });

    if (changed) {
        saveInventoryToStorage();
        refreshExpirationStatuses();
    }

    cookingChecks.delete(recipe.id);
    closeRecipeCompleteModal();
    closeRecipeModal();
    updateView();

    showNotification(changed
        ? `Nice one. ${changed} ingredient${changed === 1 ? '' : 's'} deducted from your pantry`
        : 'Recipe finished; nothing was deducted', 'success');
}

function renderStepTimerControl(recipe, step, index) {
    const seconds = Number(step?.timerSeconds);
    if (!Number.isFinite(seconds) || seconds <= 0) return '';

    const source = `recipe:${recipe.id}:step:${index}`;
    const idle = typeof describeDuration === 'function' ? describeDuration(seconds) : `${seconds}s`;
    const label = `${recipe.name} — step ${index + 1}`;

    // The group is the stable element; its contents are swapped by
    // updateStepTimerDisplays() as the timer changes state.
    return `
        <span class="step-timer-group"
              data-timer-source="${escapeHtml(source)}"
              data-timer-idle="${escapeHtml(idle)}"
              data-timer-seconds="${escapeHtml(seconds)}"
              data-timer-label="${escapeHtml(label)}"
              data-timer-step="${escapeHtml(index + 1)}"></span>
    `;
}

function renderExpirationBadge(item) {
    if (!item.hasExpiration || !item.expirationStatus) return '';
    
    const statusConfig = EXPIRATION_STATUS[item.expirationStatus];
    if (!statusConfig) return '';
    
    let label = statusConfig.label;
    if (item.daysUntilExpiry !== null && item.daysUntilExpiry >= 0) {
        label += ` (${escapeHtml(item.daysUntilExpiry)}d)`;
    } else if (item.daysUntilExpiry !== null && item.daysUntilExpiry < 0) {
        label += ` (${Math.abs(item.daysUntilExpiry)}d ago)`;
    }
    
    return `
        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color} border">
            <span>${statusConfig.icon}</span>
            <span>${label}</span>
        </span>
    `;
}

function handleExpirationSuggestion(itemId, suggestedDate) {
    const expirationDateInput = document.getElementById('expiration-date-input');
    if (expirationDateInput) {
        expirationDateInput.value = suggestedDate;
    }
}

function showExpirationNotificationModal(items) {
    const expiredItems = items.filter(item => item.expirationStatus === 'expired');
    const expiringTodayItems = items.filter(item => item.expirationStatus === 'expiringToday');
    const expiringSoonItems = items.filter(item => item.expirationStatus === 'expiringSoon');
    
    const modalHTML = `
        <div id="expiration-notification-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="expiration-notification-title">
            <div class="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
                <div class="flex items-center gap-2 mb-4">
                    <span class="text-2xl" aria-hidden="true">🍎</span>
                    <h2 id="expiration-notification-title" class="text-xl font-bold text-gray-800">Food Freshness Alert</h2>
                </div>
                
                ${expiredItems.length > 0 ? `
                    <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <h3 class="font-semibold text-red-800 flex items-center gap-2 mb-2">
                            <span>❌</span> Expired Items (${expiredItems.length})
                        </h3>
                        <div class="space-y-1 text-sm">
                            ${expiredItems.map(item => `
                                <div class="flex justify-between items-center">
                                    <span class="font-medium">${escapeHtml(item.name)}</span>
                                    <span class="text-red-600">${Math.abs(item.daysUntilExpiry)} days ago</span>
                                </div>
                            `).join('')}
                        </div>
                        <p class="text-xs text-red-700 mt-2">
                            These items have been automatically added to your shopping list and marked as unavailable for recipes.
                        </p>
                    </div>
                ` : ''}
                
                ${expiringTodayItems.length > 0 ? `
                    <div class="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <h3 class="font-semibold text-orange-800 flex items-center gap-2 mb-2">
                            <span>🔶</span> Expiring Today (${expiringTodayItems.length})
                        </h3>
                        <div class="space-y-1 text-sm">
                            ${expiringTodayItems.map(item => `
                                <div class="flex justify-between items-center">
                                    <span class="font-medium">${escapeHtml(item.name)}</span>
                                    <span class="text-orange-600">Use today!</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${expiringSoonItems.length > 0 ? `
                    <div class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h3 class="font-semibold text-yellow-800 flex items-center gap-2 mb-2">
                            <span>⚠️</span> Expiring Soon (${expiringSoonItems.length})
                        </h3>
                        <div class="space-y-1 text-sm">
                            ${expiringSoonItems.map(item => `
                                <div class="flex justify-between items-center">
                                    <span class="font-medium">${escapeHtml(item.name)}</span>
                                    <span class="text-yellow-600">${escapeHtml(item.daysUntilExpiry)} day${item.daysUntilExpiry === 1 ? '' : 's'}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="flex gap-2">
                    <button id="view-recipes-with-expiring-btn" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                        View Recipes Using These Items
                    </button>
                    <button id="close-expiration-notification-btn" data-dialog-close class="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition">
                        Got It
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    setupExpirationNotificationHandlers(items);
}

function setupExpirationNotificationHandlers(items) {
    const closeBtn = document.getElementById('close-expiration-notification-btn');
    const viewRecipesBtn = document.getElementById('view-recipes-with-expiring-btn');
    const modal = document.getElementById('expiration-notification-modal');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });
    }
    
    if (viewRecipesBtn) {
        viewRecipesBtn.addEventListener('click', () => {
            // Switch to recipes view and filter for expiring items
            setView('recipes');
            state.recipeFilter = 'use-expiring';
            updateView();
            modal.remove();
        });
    }
}

// Inventory Management
/**
 * Put an edit form beside the thing it edits.
 *
 * Both forms live at the top of their view. That is right for "add", but when
 * editing the twentieth item in a list it meant the form opened off-screen with
 * no indication anything had happened - and scrolling up and back down for
 * every edit is miserable on a tablet. The form is a single element, so it can
 * simply be moved next to the row being edited and moved back afterwards.
 */
function positionFormNear(form, anchor, fallbackParent) {
    if (anchor && anchor.parentElement) {
        anchor.after(form);
    } else if (fallbackParent) {
        fallbackParent.prepend(form);
    }
}

function revealForm(form, firstField) {
    form.classList.remove('hidden');
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (firstField) {
        // Focus after the scroll starts, or the browser jumps instead of gliding.
        setTimeout(() => firstField.focus({ preventScroll: true }), 220);
    }
}

function showInventoryForm(editId = null) {
    state.showInventoryForm = true;
    state.editingInventoryId = editId;
    
    if (editId) {
        const item = state.inventory.find(i => i.id === editId);
        if (item) {
            elements.inventory.formElements.name.value = item.name;
            elements.inventory.formElements.current.value = item.current;
            elements.inventory.formElements.max.value = item.max;
            elements.inventory.formElements.unit.value = item.unit;
            
            // Set expiration fields if they exist
            const trackExpirationCheckbox = document.getElementById('track-expiration-checkbox');
            const purchaseDateInput = document.getElementById('purchase-date-input');
            const expirationDateInput = document.getElementById('expiration-date-input');
            
            if (trackExpirationCheckbox) {
                trackExpirationCheckbox.checked = item.hasExpiration || false;
                toggleExpirationFields(item.hasExpiration || false);
            }
            if (purchaseDateInput) {
                purchaseDateInput.value = item.purchaseDate || '';
            }
            if (expirationDateInput) {
                expirationDateInput.value = item.expirationDate || '';
            }
        }
    } else {
        elements.inventory.formElements.name.value = '';
        elements.inventory.formElements.current.value = 0;
        elements.inventory.formElements.max.value = 100;
        elements.inventory.formElements.unit.value = defaultUnit();
        
        // Reset expiration fields
        const trackExpirationCheckbox = document.getElementById('track-expiration-checkbox');
        const purchaseDateInput = document.getElementById('purchase-date-input');
        const expirationDateInput = document.getElementById('expiration-date-input');
        
        if (trackExpirationCheckbox) {
            trackExpirationCheckbox.checked = false;
            toggleExpirationFields(false);
        }
        if (purchaseDateInput) {
            purchaseDateInput.value = new Date().toISOString().split('T')[0];
        }
        if (expirationDateInput) {
            expirationDateInput.value = '';
        }
    }
    
    const anchor = editId
        ? elements.inventory.list.querySelector(`[data-item-id="${CSS.escape(String(editId))}"]`)
        : null;
    positionFormNear(elements.inventory.form, anchor, elements.inventory.list.parentElement);
    revealForm(elements.inventory.form, elements.inventory.formElements.name);
}

function hideInventoryForm() {
    state.showInventoryForm = false;
    state.editingInventoryId = null;
    elements.inventory.form.classList.add('hidden');
    // Back to the top of the view, ready for the next "Add item".
    elements.inventory.list.parentElement.prepend(elements.inventory.form);
}

function saveInventoryItem() {
    const name = elements.inventory.formElements.name.value.trim();
    const current = parseFloat(elements.inventory.formElements.current.value) || 0;
    const max = parseFloat(elements.inventory.formElements.max.value) || 0;
    const unit = elements.inventory.formElements.unit.value;
    
    if (!name) return;
    
    // Get expiration-related values
    const trackExpirationCheckbox = document.getElementById('track-expiration-checkbox');
    const purchaseDateInput = document.getElementById('purchase-date-input');
    const expirationDateInput = document.getElementById('expiration-date-input');
    
    const hasExpiration = trackExpirationCheckbox?.checked || false;
    const purchaseDate = purchaseDateInput?.value || null;
    const expirationDate = expirationDateInput?.value || null;
    
    const item = {
        id: state.editingInventoryId || Date.now(),
        name,
        current,
        max,
        unit,
        // Expiration fields
        hasExpiration,
        purchaseDate,
        expirationDate,
        expirationStatus: 'fresh',
        shelfLifeDays: null,
        lastExpirationCheck: new Date().toISOString().split('T')[0],
        expirationNotified: false,
        daysUntilExpiry: null
    };
    
    // Calculate expiration status if tracking is enabled
    if (hasExpiration && expirationDate) {
        const expirationInfo = calculateExpirationStatus(item);
        item.expirationStatus = expirationInfo.status;
        item.daysUntilExpiry = expirationInfo.daysUntilExpiry;
    }
    
    if (state.editingInventoryId) {
        const index = state.inventory.findIndex(i => i.id === state.editingInventoryId);
        if (index !== -1) {
            // Preserve existing expiration notification status when editing
            const existingItem = state.inventory[index];
            item.expirationNotified = existingItem.expirationNotified || false;
            state.inventory[index] = item;
        }
    } else {
        state.inventory.push(item);
    }
    
    saveInventoryToStorage();
    hideInventoryForm();
    updateView();
}

function updateInventoryAmount(id, amount) {
    const item = state.inventory.find(i => i.id === id);
    if (item) {
        item.current = Math.max(0, Math.min(amount, item.max));
        saveInventoryToStorage();
        updateView();
    }
}

function deleteInventoryItem(id) {
    if (confirm('Are you sure you want to delete this item?')) {
        state.inventory = state.inventory.filter(i => i.id !== id);
        saveInventoryToStorage();
        updateView();
    }
}

/** First letter for the A-Z rail; anything not A-Z groups under #. */
function initialOf(name) {
    const first = String(name || '').trim().charAt(0).toUpperCase();
    return first >= 'A' && first <= 'Z' ? first : '#';
}

/**
 * The rows to show: search applied, then sorted.
 *
 * Sorting by name is the default because it is what makes the A-Z rail mean
 * anything - jumping to "P" is only useful if P is where you expect it.
 */
function visibleInventoryItems() {
    const needle = state.inventorySearch.trim().toLowerCase();
    const items = state.inventory.filter(item =>
        !needle || String(item.name).toLowerCase().includes(needle));

    const byName = (a, b) =>
        String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' });

    if (state.inventorySort === 'low') {
        // Emptiest first - the restocking view.
        return items.sort((a, b) => (a.current / a.max) - (b.current / b.max) || byName(a, b));
    }
    if (state.inventorySort === 'expiry') {
        // Soonest first; anything untracked sinks to the bottom.
        const due = item => (item.hasExpiration && item.expirationDate)
            ? Date.parse(item.expirationDate) : Number.POSITIVE_INFINITY;
        return items.sort((a, b) => due(a) - due(b) || byName(a, b));
    }
    return items.sort(byName);
}

/**
 * The letter rail, shared by the pantry and the recipe grid.
 *
 * Letters with nothing under them stay in place but are inert, so the rail
 * never reflows as the list changes - a moving target is worse than a dead key.
 */
function renderLetterRail(railId, names, { enabled = true, minimum = 6 } = {}) {
    const rail = document.getElementById(railId);
    if (!rail) return;

    const present = new Set(names.map(initialOf));
    const letters = ['#'].concat('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));

    rail.innerHTML = letters.map(letter => `
        <button type="button" class="index-letter" data-action="${escapeHtml(rail.dataset.jumpAction)}"
                data-letter="${escapeHtml(letter)}" ${present.has(letter) ? '' : 'disabled'}
                aria-label="Jump to ${escapeHtml(letter === '#' ? 'other' : letter)}">${escapeHtml(letter)}</button>
    `).join('');

    // Only worth the space once there is enough to scroll past, and only
    // meaningful while the list is actually in alphabetical order.
    rail.classList.toggle('hidden', !enabled || names.length < minimum);
}

/** Scroll to the first row under a letter and flash it, iOS-style. */
function jumpToLetter(container, letter) {
    const target = container?.querySelector(`[data-item-initial="${CSS.escape(letter)}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('is-jumped');
    setTimeout(() => target.classList.remove('is-jumped'), 1200);
}

function handleInventorySearch(event) {
    state.inventorySearch = event.target.value;
    updateInventoryView();
}

function handleInventorySort(event) {
    state.inventorySort = event.target.value;
    updateInventoryView();
}

function updateInventoryView() {
    const container = elements.inventory.list;
    container.innerHTML = '';

    const items = visibleInventoryItems();
    renderLetterRail('inventory-index', items.map(item => item.name), {
        enabled: state.inventorySort === 'name'
    });

    const summary = document.getElementById('inventory-count');
    if (summary) {
        summary.textContent = state.inventory.length
            ? `${items.length} of ${state.inventory.length} item${state.inventory.length === 1 ? '' : 's'}`
            : '';
    }

    if (state.inventory.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-500">No items in inventory yet. Click "Add Item" to get started.</div>';
        return;
    }

    if (items.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-gray-500">Nothing in your pantry matches that search.</div>`;
        return;
    }

    items.forEach((item, index) => {
        const percentage = (item.current / item.max) * 100;
        const progressColor = percentage < 30 ? 'bg-orange-500' : 
                             percentage < 60 ? 'bg-yellow-500' : 'bg-green-500';
        
        // Get expiration badge
        const expirationBadge = renderExpirationBadge(item);
        
        // Determine if this item should be grayed out due to expiration
        const isExpired = item.hasExpiration && item.expirationStatus === 'expired';
        const itemClass = isExpired ? 'item-expired' : '';
        
        const itemElement = document.createElement('div');
        itemElement.className = `bg-white rounded-xl p-4 shadow border border-gray-100 ${itemClass}`;
        itemElement.dataset.itemId = item.id;
        itemElement.dataset.itemInitial = initialOf(item.name);
        itemElement.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <h3 class="font-semibold text-gray-800">${escapeHtml(item.name)}</h3>
                        ${expirationBadge}
                    </div>
                    <p class="text-sm text-gray-500">${escapeHtml(item.current)} / ${escapeHtml(item.max)} ${escapeHtml(item.unit)}</p>
                    ${item.hasExpiration && item.expirationDate ? `
                        <p class="text-xs text-gray-500 mt-1">
                            Expires: ${new Date(item.expirationDate).toLocaleDateString()}
                        </p>
                    ` : ''}
                </div>
                <div class="flex gap-2">
                    <button type="button" data-action="inventory-edit" data-id="${escapeHtml(item.id)}" class="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition" aria-label="Edit ${escapeHtml(item.name)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1"></path><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z"></path><path d="M16 5l3 3"></path></svg>
                    </button>
                    <button type="button" data-action="inventory-delete" data-id="${escapeHtml(item.id)}" class="text-red-600 hover:bg-red-50 p-2 rounded-lg transition" aria-label="Delete ${escapeHtml(item.name)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div class="h-3 rounded-full transition-all ${progressColor}" style="width: ${percentage}%"></div>
            </div>
            ${isExpired ? `
                <div class="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    ⚠️ This item has expired and is not available for recipes
                </div>
            ` : ''}
            <div class="flex gap-2">
                <button type="button" data-action="inventory-adjust" data-id="${escapeHtml(item.id)}" data-amount="${escapeHtml(item.current - 5)}" class="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition text-sm" ${isExpired ? 'disabled' : ''}>-5</button>
                <button type="button" data-action="inventory-adjust" data-id="${escapeHtml(item.id)}" data-amount="${escapeHtml(item.current - 1)}" class="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition text-sm" ${isExpired ? 'disabled' : ''}>-1</button>
                <button type="button" data-action="inventory-adjust" data-id="${escapeHtml(item.id)}" data-amount="${escapeHtml(item.current + 1)}" class="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition text-sm">+1</button>
                <button type="button" data-action="inventory-adjust" data-id="${escapeHtml(item.id)}" data-amount="${escapeHtml(item.current + 5)}" class="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition text-sm">+5</button>
            </div>
        `;
        container.appendChild(itemElement);
    });
}

// Recipe Management
function showRecipeForm(editId = null) {
    state.showRecipeForm = true;
    state.editingRecipeId = editId;
    
    // Clear form
    elements.recipes.formElements.name.value = '';
    elements.recipes.formElements.prepTime.value = '';
    elements.recipes.formElements.cookTime.value = '';
    elements.recipes.formElements.servings.value = '';
    
    if (editId) {
        const recipe = state.recipes.find(r => r.id === editId);
        if (recipe) {
            elements.recipes.formElements.name.value = recipe.name;
            elements.recipes.formElements.prepTime.value = recipe.prepTime || '';
            elements.recipes.formElements.cookTime.value = recipe.cookTime || '';
            elements.recipes.formElements.servings.value = recipe.servings || '';
            
            // Load ingredients and steps
            loadRecipeFormData(recipe);
        }
    } else {
        // Initialize with empty ingredient and step
        elements.recipes.formElements.ingredients.innerHTML = '';
        elements.recipes.formElements.steps.innerHTML = '';
        addIngredientRow();
        addStepRow('step');
    }
    
    /*
     * An empty pantry used to disable Save outright, which meant you could not
     * write down a recipe until you had first inventoried your kitchen. That is
     * backwards for anyone whose starting point is a stack of recipes. The note
     * now explains the situation instead of blocking it, and each ingredient row
     * offers to stock the pantry as it is typed.
     */
    const emptyPantryNote = document.getElementById('no-inventory-warning');
    if (emptyPantryNote) emptyPantryNote.classList.toggle('hidden', state.inventory.length > 0);
    elements.recipes.formElements.addIngredientBtn.disabled = false;
    elements.recipes.formElements.saveBtn.disabled = false;

    refreshIngredientSuggestions();

    const anchor = editId
        ? elements.recipes.grid.querySelector(`[data-recipe-id="${CSS.escape(String(editId))}"]`)
        : null;
    // Inside the grid the form has to span both columns, or it squeezes into one
    // and the cards reflow around it.
    elements.recipes.form.classList.toggle('form-in-grid', !!anchor);
    positionFormNear(elements.recipes.form, anchor, elements.recipes.grid.parentElement);
    revealForm(elements.recipes.form, elements.recipes.formElements.name);
}

function hideRecipeForm() {
    state.showRecipeForm = false;
    state.editingRecipeId = null;
    elements.recipes.form.classList.add('hidden');
    elements.recipes.form.classList.remove('form-in-grid');
    elements.recipes.grid.parentElement.prepend(elements.recipes.form);
}

function loadRecipeFormData(recipe) {
    // Load ingredients
    elements.recipes.formElements.ingredients.innerHTML = '';
    if (recipeIngredients(recipe).length > 0) {
        recipeIngredients(recipe).forEach(ing => {
            addIngredientRow(ing);
        });
    } else {
        addIngredientRow();
    }
    
    // Load steps
    elements.recipes.formElements.steps.innerHTML = '';
    if (recipeSteps(recipe).length > 0) {
        recipeSteps(recipe).forEach(step => {
            addStepRow(step.type, step.content, step.timerSeconds);
        });
    } else {
        addStepRow('step');
    }
}

/** Feed the shared <datalist> the pantry names, so typing suggests them. */
function refreshIngredientSuggestions() {
    const list = document.getElementById('inventory-options');
    if (!list) return;
    list.innerHTML = state.inventory
        .map(item => `<option value="${escapeHtml(item.name)}"></option>`)
        .join('');
}

function findInventoryItemByName(name) {
    const wanted = String(name || '').trim().toLowerCase();
    if (!wanted) return null;
    return state.inventory.find(item => String(item.name).toLowerCase() === wanted) || null;
}

/*
 * An ingredient is a free-text field backed by a datalist rather than a select.
 * A select can only offer what the pantry already holds, which is why a recipe
 * could not be written before the pantry existed; a combobox lets you pick an
 * existing item *or* name a new one, with the same keystrokes.
 */
function addIngredientRow(ingredient = null) {
    const container = elements.recipes.formElements.ingredients;
    const row = document.createElement('div');
    row.className = 'ingredient-row';

    const selectedItem = ingredient ? ingredient.item : '';
    const selectedAmount = ingredient ? ingredient.amount : '';
    const selectedUnit = ingredient ? ingredient.unit : defaultUnit();

    const units = UNITS;

    row.innerHTML = `
        <input type="text" class="ingredient-name" list="inventory-options"
               placeholder="Ingredient" aria-label="Ingredient name"
               value="${escapeHtml(selectedItem)}">
        <input type="number" class="ingredient-amount" placeholder="Amount" min="0" step="any"
               aria-label="Amount" value="${escapeHtml(selectedAmount)}">
        <select class="ingredient-unit" aria-label="Unit" data-change-action="remember-unit">
            ${units.map(unit => `<option value="${unit}" ${selectedUnit === unit ? 'selected' : ''}>${unit}</option>`).join('')}
        </select>
        <label class="ingredient-have">
            <input type="checkbox" class="ingredient-have-checkbox">
            <span class="ingredient-have-text">I have this</span>
        </label>
        <button type="button" data-action="remove-row" data-levels="1" class="text-red-600 hover:bg-red-50 p-2 rounded-lg transition" aria-label="Remove ingredient">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
        </button>
    `;

    const nameInput = row.querySelector('.ingredient-name');
    nameInput.addEventListener('input', () => syncIngredientRow(row));
    nameInput.addEventListener('change', () => syncIngredientRow(row));

    container.appendChild(row);
    syncIngredientRow(row);
}

/**
 * Keep a row honest about whether the pantry already holds this ingredient.
 *
 * Something already stocked shows as such and cannot be re-added; something new
 * offers the tick box. Picking a known item also adopts its unit, so the recipe
 * and the pantry speak in the same measure.
 */
function syncIngredientRow(row) {
    const nameInput = row.querySelector('.ingredient-name');
    const checkbox = row.querySelector('.ingredient-have-checkbox');
    const text = row.querySelector('.ingredient-have-text');
    const unitSelect = row.querySelector('.ingredient-unit');
    if (!nameInput || !checkbox || !text) return;

    const existing = findInventoryItemByName(nameInput.value);
    const named = nameInput.value.trim().length > 0;

    if (existing) {
        checkbox.checked = true;
        checkbox.disabled = true;
        text.textContent = 'In pantry';
        row.classList.add('is-stocked');
        if (unitSelect && existing.unit && [...unitSelect.options].some(o => o.value === existing.unit)) {
            unitSelect.value = existing.unit;
        }
        return;
    }

    checkbox.disabled = !named;
    if (!named) checkbox.checked = false;
    text.textContent = 'I have this';
    row.classList.remove('is-stocked');
}

/**
 * Put every new ingredient into the pantry, on save.
 *
 * The tick decides the *quantity*, not whether the item is recorded at all:
 *
 *   ticked   -> current = the recipe's amount, target the same. You have it.
 *   unticked -> current = 0, target the recipe's amount. You need it.
 *
 * Both are true statements about the kitchen, and the second is the useful one:
 * an item at zero is low stock by definition, so it lands on the shopping list
 * at the full amount the recipe asks for. Writing down a recipe therefore tells
 * you what to buy for it, without anyone having to compile that list by hand.
 *
 * Ingredients the pantry already holds are left completely alone - the existing
 * quantity is the user's own record, and a new recipe mentioning the item is no
 * reason to overwrite it.
 */
function stockPantryFromRecipeForm() {
    const rows = Array.from(elements.recipes.formElements.ingredients.children);
    const stocked = [];
    const needed = [];

    rows.forEach(row => {
        const name = row.querySelector('.ingredient-name')?.value.trim();
        if (!name || findInventoryItemByName(name)) return;

        const checkbox = row.querySelector('.ingredient-have-checkbox');
        const haveIt = !!checkbox && checkbox.checked && !checkbox.disabled;

        // The target is what the recipe calls for; at least 1 so the stock bar
        // has something to divide by.
        const target = Math.max(Number(row.querySelector('.ingredient-amount')?.value) || 1, 1);
        const item = sanitizeInventoryItem({
            name,
            current: haveIt ? target : 0,
            max: target,
            unit: row.querySelector('.ingredient-unit')?.value || 'units'
        });
        if (!item) return;

        // sanitizeInventoryItem floors max at current and at 1, but a deliberate
        // zero-stock item has to keep its zero.
        item.current = haveIt ? target : 0;

        state.inventory.push(item);
        (haveIt ? stocked : needed).push(item.name);
    });

    if (stocked.length || needed.length) {
        ensureUniqueIds(state.inventory);
        saveInventoryToStorage();
        refreshIngredientSuggestions();
    }
    return { stocked, needed };
}

function addStepRow(type = 'step', content = '', timerSeconds = null) {
    const container = elements.recipes.formElements.steps;
    const row = document.createElement('div');
    row.className = 'mb-3';

    // A step that needs a timer usually knows it at writing time - "simmer 20
    // minutes" - so the duration is captured with the recipe and the cook only
    // has to press start later.
    const hasTimer = Number.isFinite(Number(timerSeconds)) && Number(timerSeconds) > 0;
    const totalSeconds = hasTimer ? Number(timerSeconds) : 0;
    const timerHours = hasTimer && totalSeconds >= 3600 ? Math.floor(totalSeconds / 3600) : '';
    const timerMinutes = hasTimer ? Math.floor((totalSeconds % 3600) / 60) : '';
    const timerRest = hasTimer ? totalSeconds % 60 : '';

    row.innerHTML = `
        <div class="step-controls">
            <select class="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" aria-label="Instruction type">
                <option value="step" ${type === 'step' ? 'selected' : ''}>Step</option>
                <option value="paragraph" ${type === 'paragraph' ? 'selected' : ''}>Paragraph</option>
            </select>
            <button type="button" data-action="remove-row" data-levels="2" class="text-red-600 hover:bg-red-50 p-2 rounded-lg transition" aria-label="Remove this instruction">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
            </button>
        </div>
        <textarea placeholder="${type === 'step' ? 'Enter step instruction...' : 'Enter paragraph text...'}" rows="${type === 'paragraph' ? 4 : 2}" class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">${escapeHtml(content)}</textarea>
        <div class="step-timer-fields">
            <label class="step-timer-toggle">
                <input type="checkbox" class="step-timer-checkbox" ${hasTimer ? 'checked' : ''}>
                Needs a timer
            </label>
            <span class="step-timer-inputs ${hasTimer ? '' : 'hidden'}">
                <input type="number" class="step-timer-hours" min="0" max="99" step="1" placeholder="hr"
                       inputmode="numeric" aria-label="Timer hours" data-unit="Hours"
                       data-change-action="clamp-number" value="${escapeHtml(timerHours)}">
                <input type="number" class="step-timer-minutes" min="0" max="59" step="1" placeholder="min"
                       inputmode="numeric" aria-label="Timer minutes" data-unit="Minutes"
                       data-change-action="clamp-number" value="${escapeHtml(timerMinutes)}">
                <input type="number" class="step-timer-seconds" min="0" max="59" step="1" placeholder="sec"
                       inputmode="numeric" aria-label="Timer seconds" data-unit="Seconds"
                       data-change-action="clamp-number" value="${escapeHtml(timerRest)}">
            </span>
        </div>
    `;

    const selectElement = row.querySelector('select');
    const textareaElement = row.querySelector('textarea');
    const timerCheckbox = row.querySelector('.step-timer-checkbox');
    const timerInputs = row.querySelector('.step-timer-inputs');

    selectElement.addEventListener('change', function() {
        const newType = this.value;
        textareaElement.rows = newType === 'paragraph' ? 4 : 2;
        textareaElement.placeholder = newType === 'step' ? 'Enter step instruction...' : 'Enter paragraph text...';
    });

    timerCheckbox.addEventListener('change', function() {
        timerInputs.classList.toggle('hidden', !this.checked);
        if (this.checked) row.querySelector('.step-timer-hours').focus();
    });

    container.appendChild(row);
}

/** Read a step row's timer fields. Returns null when it has no timer. */
function readStepTimer(row) {
    const checkbox = row.querySelector('.step-timer-checkbox');
    if (!checkbox || !checkbox.checked) return null;

    // Belt and braces: the fields clamp as they are edited, sanitizeStep()
    // clamps anything arriving from a file, and this clamps again on the way
    // into storage. A duration drives a countdown, so none of the three is
    // where a bad number should first be noticed.
    const field = (selector, max) =>
        Math.max(0, Math.min(Math.round(Number(row.querySelector(selector)?.value) || 0), max));

    const total = Math.min(
        field('.step-timer-hours', 99) * 3600 +
        field('.step-timer-minutes', 59) * 60 +
        field('.step-timer-seconds', 59),
        IMPORT_LIMITS.timerSeconds
    );

    return total > 0 ? total : null;
}


function saveRecipe() {
    const name = elements.recipes.formElements.name.value.trim();
    if (!name) return;
    
    // Collect ingredients
    // Anything ticked as owned joins the pantry before the recipe is judged
    // against it, so a brand-new recipe does not report itself as unmakeable.
    const { stocked, needed } = stockPantryFromRecipeForm();

    const ingredients = Array.from(elements.recipes.formElements.ingredients.children).map(row => ({
        item: row.querySelector('.ingredient-name')?.value.trim() || '',
        amount: row.querySelector('.ingredient-amount')?.value || '',
        unit: row.querySelector('.ingredient-unit')?.value || 'units'
    })).filter(ing => ing.item);
    
    if (ingredients.length === 0) {
        alert('Please add at least one ingredient');
        return;
    }
    
    // Collect steps
    const steps = Array.from(elements.recipes.formElements.steps.children).map(row => {
        const select = row.querySelector('select');
        const textarea = row.querySelector('textarea');
        const step = {
            type: select.value,
            content: textarea.value.trim()
        };
        const timerSeconds = readStepTimer(row);
        if (timerSeconds) step.timerSeconds = timerSeconds;
        return step;
    }).filter(step => step.content);
    
    const recipe = {
        id: state.editingRecipeId || Date.now(),
        name,
        prepTime: elements.recipes.formElements.prepTime.value,
        cookTime: elements.recipes.formElements.cookTime.value,
        servings: elements.recipes.formElements.servings.value,
        ingredients,
        steps
    };
    
    if (state.editingRecipeId) {
        const index = state.recipes.findIndex(r => r.id === state.editingRecipeId);
        if (index !== -1) {
            state.recipes[index] = recipe;
        }
    } else {
        state.recipes.push(recipe);
    }
    
    saveRecipesToStorage();
    hideRecipeForm();
    updateView();

    // Say what happened to the pantry, since saving a recipe now changes it.
    const parts = [];
    if (stocked.length) parts.push(`${stocked.length} added to your pantry`);
    if (needed.length) parts.push(`${needed.length} added to your shopping list`);
    if (parts.length) showNotification(parts.join(', '), 'success');
}

function deleteRecipe(id) {
    if (confirm('Are you sure you want to delete this recipe?')) {
        state.recipes = state.recipes.filter(r => r.id !== id);
        saveRecipesToStorage();
        updateView();
    }
}

function handleRecipeSearch(e) {
    state.recipeSearch = e.target.value.toLowerCase();
    updateRecipesView();
}

function handleRecipeFilter(e) {
    state.recipeFilter = e.target.value;
    updateRecipesView();
}

// Recipe Analysis Functions
function canMakeRecipe(recipe) {
    return recipeIngredients(recipe).every(ing => {
        const invItem = state.inventory.find(i => 
            i.name.toLowerCase() === ing.item.toLowerCase()
        );
        if (!invItem) return false;
        
        // Check if item is expired and should be excluded
        if (invItem.hasExpiration && invItem.expirationStatus === 'expired') {
            return false;
        }
        
        return invItem.current >= parseFloat(ing.amount);
    });
}

function getMissingIngredients(recipe) {
    return recipeIngredients(recipe).filter(ing => {
        const invItem = state.inventory.find(i => 
            i.name.toLowerCase() === ing.item.toLowerCase()
        );
        if (!invItem) return true;
        
        // Include expired items as "missing" even if we have quantity
        if (invItem.hasExpiration && invItem.expirationStatus === 'expired') {
            return true;
        }
        
        return invItem.current < parseFloat(ing.amount);
    });
}

function getMissingIngredientsWithContext(recipe) {
    return recipeIngredients(recipe).map(ingredient => {
        const inventoryItem = state.inventory.find(item => 
            item.name.toLowerCase() === ingredient.item.toLowerCase()
        );
        
        if (!inventoryItem) {
            return {
                ...ingredient,
                reason: 'not-in-inventory',
                available: 0
            };
        }
        
        if (inventoryItem.hasExpiration && inventoryItem.expirationStatus === 'expired') {
            return {
                ...ingredient,
                reason: 'expired',
                available: 0,
                expiredAmount: inventoryItem.current,
                daysExpired: Math.abs(inventoryItem.daysUntilExpiry),
                note: `Current items expired (${Math.abs(inventoryItem.daysUntilExpiry)} days ago)`
            };
        }
        
        const requiredAmount = parseFloat(ingredient.amount);
        const availableAmount = inventoryItem.current;
        
        if (availableAmount < requiredAmount) {
            return {
                ...ingredient,
                reason: 'insufficient-quantity',
                available: availableAmount,
                needed: requiredAmount - availableAmount
            };
        }
        
        return null; // Not missing
    }).filter(item => item !== null);
}

function recipeUsesExpiringIngredients(recipe) {
    return recipeIngredients(recipe).some(ingredient => {
        const inventoryItem = state.inventory.find(item => 
            item.name.toLowerCase() === ingredient.item.toLowerCase()
        );
        return inventoryItem?.hasExpiration && 
               (inventoryItem.expirationStatus === 'expiringSoon' || 
                inventoryItem.expirationStatus === 'expiringToday');
    });
}

function recipeHasExpiredIngredients(recipe) {
    return recipeIngredients(recipe).some(ingredient => {
        const inventoryItem = state.inventory.find(item => 
            item.name.toLowerCase() === ingredient.item.toLowerCase()
        );
        return inventoryItem?.hasExpiration && inventoryItem.expirationStatus === 'expired';
    });
}

function getSharedMissingIngredients() {
    const totalNeeded = {};
    
    state.recipes.forEach(recipe => {
        recipeIngredients(recipe).forEach(ing => {
            const key = ing.item.toLowerCase();
            if (!totalNeeded[key]) {
                totalNeeded[key] = {
                    item: ing.item,
                    total: 0,
                    recipes: []
                };
            }
            totalNeeded[key].total += parseFloat(ing.amount) || 0;
            totalNeeded[key].recipes.push({
                name: recipe.name,
                amount: ing.amount,
                unit: ing.unit
            });
        });
    });
    
    const conflicting = [];
    Object.values(totalNeeded).forEach(item => {
        if (item.recipes.length > 1) {
            const invItem = state.inventory.find(i => i.name.toLowerCase() === item.item.toLowerCase());
            const available = invItem ? invItem.current : 0;
            
            if (available < item.total) {
                conflicting.push({
                    item: item.item,
                    available,
                    needed: item.total,
                    deficit: item.total - available,
                    unit: item.recipes[0].unit,
                    recipes: item.recipes.map(r => `${r.name} (${r.amount} ${r.unit})`)
                });
            }
        }
    });
    
    return conflicting;
}

function getOverallInventoryPercentage() {
    if (state.inventory.length === 0) return 0;
    const avg = state.inventory.reduce((sum, item) => sum + (item.current / item.max) * 100, 0) / state.inventory.length;
    return Math.round(avg);
}

function getLowStockItems() {
    return state.inventory.filter(item => (item.current / item.max) < 0.3);
}

function generateEnhancedShoppingList() {
    const lowStockItems = getLowStockItems();
    const expiredItems = getExpiredItems();

    const shoppingList = [];
    const expiredIds = new Set(expiredItems.map(item => item.id));
    const lowStockIds = new Set(lowStockItems.map(item => item.id));

    // Low stock but still usable: buy only the gap up to the restock target.
    lowStockItems.forEach(item => {
        if (expiredIds.has(item.id)) return; // handled below, at the full target
        shoppingList.push({
            item: item.name,
            amount: item.max - item.current,
            unit: item.unit,
            reason: 'low-stock',
            priority: 'normal'
        });
    });

    // Expired: the entire on-hand quantity is spoiled and gets discarded, so the
    // shortfall is the full restock target — not just the amount being thrown out.
    // (Buying only what expired would leave the user below target with nothing usable.)
    expiredItems.forEach(item => {
        const target = item.max > 0 ? item.max : item.current;
        const daysAgo = Math.abs(item.daysUntilExpiry || 0);
        const spoiled = `${item.current} ${item.unit || ''}`.trim();

        shoppingList.push({
            item: item.name,
            amount: target,
            unit: item.unit,
            reason: lowStockIds.has(item.id) ? 'expired-and-low-stock' : 'expired',
            priority: 'high',
            note: `Replaces ${spoiled} that expired ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`
        });
    });

    // Sort by priority: high > medium > normal
    return shoppingList.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, normal: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
}

function updateRecipesView() {
    updateRecipeFilters();
    updateRecipeConflictsAlert();
    updateRecipeGrid();
}

function updateRecipeFilters() {
    const canMakeCount = state.recipes.filter(canMakeRecipe).length;
    const missingCount = state.recipes.filter(r => !canMakeRecipe(r)).length;
    const sharedMissing = getSharedMissingIngredients();
    const conflictCount = state.recipes.filter(r => {
        const missing = getMissingIngredients(r);
        return missing.some(m => sharedMissing.some(s => s.item.toLowerCase() === m.item.toLowerCase()));
    }).length;
    
    // NEW: Expiration-based counts
    const usingExpiringCount = state.recipes.filter(recipeUsesExpiringIngredients).length;
    const hasExpiredIngredientsCount = state.recipes.filter(recipeHasExpiredIngredients).length;

    // Phase 4: Allergy-based counts
    const userAllergies = state.userProfile?.allergies || [];
    const safeForUserCount = state.recipes.filter(r =>
        !analyzeRecipeAllergies(r).hasConflicts
    ).length;
    const allergyWarningCount = state.recipes.filter(r => {
        const analysis = analyzeRecipeAllergies(r);
        return analysis.hasConflicts && !analysis.hasLifeThreatening;
    }).length;
    const dangerousCount = state.recipes.filter(r =>
        analyzeRecipeAllergies(r).hasLifeThreatening
    ).length;

    elements.recipes.filter.innerHTML = `
        <option value="all">All Recipes (${state.recipes.length})</option>
        <option value="canMake">Can Make (${canMakeCount})</option>
        <option value="missing">Missing Ingredients (${missingCount})</option>
        <option value="conflict">Has Conflicts (${conflictCount})</option>
        <option value="use-expiring">Use Expiring Items (${usingExpiringCount})</option>
        ${hasExpiredIngredientsCount > 0 ? `<option value="has-expired">⚠️ Has Expired Items (${hasExpiredIngredientsCount})</option>` : ''}
        ${userAllergies.length > 0 ? `<option value="safe">✓ Safe for Me (${safeForUserCount})</option>` : ''}
        ${allergyWarningCount > 0 ? `<option value="allergy-warning">⚠️ Allergy Warning (${allergyWarningCount})</option>` : ''}
        ${dangerousCount > 0 ? `<option value="dangerous">🚨 Dangerous (${dangerousCount})</option>` : ''}
    `;
    elements.recipes.filter.value = state.recipeFilter;
}

function updateRecipeConflictsAlert() {
    const sharedMissing = getSharedMissingIngredients();
    
    if (sharedMissing.length > 0) {
        elements.recipes.conflictsAlert.classList.remove('hidden');
        elements.recipes.conflictsSummary.textContent = 
            `${sharedMissing.length} ingredient${sharedMissing.length > 1 ? 's' : ''} shared across multiple recipes with insufficient inventory:`;
        
        elements.recipes.conflictsDetails.innerHTML = sharedMissing.map(item => 
            `<div class="text-sm text-purple-700">
                • <span class="font-medium">${escapeHtml(item.item)}</span>: need ${escapeHtml(item.deficit)} more ${escapeHtml(item.unit)} (have ${escapeHtml(item.available)}, need ${escapeHtml(item.needed)} total)
            </div>`
        ).join('');
    } else {
        elements.recipes.conflictsAlert.classList.add('hidden');
    }
}

function updateRecipeGrid() {
    // Sorted by name so the letter rail lands where the eye expects.
    const filteredRecipes = getFilteredRecipes()
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));
    const container = elements.recipes.grid;

    renderLetterRail('recipe-index', filteredRecipes.map(recipe => recipe.name));
    
    if (filteredRecipes.length === 0) {
        elements.recipes.noRecipesMessage.classList.remove('hidden');
        document.getElementById('recipe-index')?.classList.add('hidden');
        container.innerHTML = '';
        return;
    }
    
    elements.recipes.noRecipesMessage.classList.add('hidden');
    container.innerHTML = '';
    
    filteredRecipes.forEach(recipe => {
        const canMake = canMakeRecipe(recipe);
        const missing = getMissingIngredients(recipe);
        const sharedMissing = getSharedMissingIngredients();
        const hasSharedMissing = missing.some(m => 
            sharedMissing.some(s => s.item.toLowerCase() === m.item.toLowerCase())
        );
        
        const borderClass = canMake ? 'border-green-200 hover:border-green-400' : 
                           hasSharedMissing ? 'border-purple-300 hover:border-purple-500' :
                           'border-orange-200 hover:border-orange-400';
        
        const recipeElement = document.createElement('div');
        recipeElement.className = `bg-white rounded-xl p-5 shadow border-2 cursor-pointer transition ${borderClass}`;
        recipeElement.setAttribute('role', 'listitem');
        recipeElement.dataset.recipeId = recipe.id;
        recipeElement.dataset.itemInitial = initialOf(recipe.name);
        // The whole card stays clickable for pointers, but the keyboard path is
        // the real button in the title - a div click listener is unreachable by Tab.
        recipeElement.addEventListener('click', (event) => {
            // Let the edit/delete/title buttons handle their own clicks.
            if (event.target.closest('[data-action]')) return;
            showRecipeModal(recipe);
        });
        
        let statusHTML = '';
        if (canMake) {
            statusHTML = '<div class="inline-block px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">✓ Can Make</div>';
        } else {
            let conflictBadge = '';
            if (hasSharedMissing) {
                conflictBadge = '<div class="inline-block px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700 border border-purple-300">⚡ Conflicting Ingredients</div>';
            } else {
                conflictBadge = '<div class="inline-block px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-700">⚠ Missing Ingredients</div>';
            }
            
            const missingHTML = missing.map(ing => {
                const conflictInfo = sharedMissing.find(s => s.item.toLowerCase() === ing.item.toLowerCase());
                return `
                    <div class="${conflictInfo ? 'text-purple-700 font-medium' : ''}">
                        • ${escapeHtml(ing.item)} (${escapeHtml(ing.amount)} ${escapeHtml(ing.unit)})
                        ${conflictInfo ? `<span class="text-xs ml-1">⚡ (conflict: need ${conflictInfo.deficit} more for all recipes)</span>` : ''}
                    </div>
                `;
            }).join('');
            
            statusHTML = `
                <div class="space-y-2">
                    ${conflictBadge}
                    <div class="text-xs text-gray-600 mt-2">
                        <div class="font-medium mb-1">Missing:</div>
                        ${missingHTML}
                    </div>
                </div>
            `;
        }
        
        const metaHTML = [
            recipe.prepTime ? `<div class="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12,6 12,12 16,14"></polyline></svg><span>${escapeHtml(formatRecipeMeta(recipe.prepTime, 'min'))}</span></div>` : '',
            recipe.servings ? `<span>• ${escapeHtml(formatRecipeMeta(recipe.servings, 'servings'))}</span>` : ''
        ].filter(Boolean).join('');

        // Phase 4: Add allergy warnings
        const allergyStatusHTML = renderRecipeAllergyStatus(recipe);

        recipeElement.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <h3 class="font-semibold text-gray-800 text-lg">
                    <button type="button" class="recipe-title-btn" data-action="recipe-view" data-id="${escapeHtml(recipe.id)}">${escapeHtml(recipe.name)}</button>
                </h3>
                <div class="flex gap-2">
                    <button type="button" data-action="recipe-edit" data-id="${escapeHtml(recipe.id)}" class="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition" aria-label="Edit recipe ${escapeHtml(recipe.name)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1"></path><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z"></path><path d="M16 5l3 3"></path></svg>
                    </button>
                    <button type="button" data-action="recipe-delete" data-id="${escapeHtml(recipe.id)}" class="text-red-600 hover:bg-red-50 p-2 rounded-lg transition" aria-label="Delete recipe ${escapeHtml(recipe.name)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
            ${metaHTML ? `<div class="flex gap-3 text-sm text-gray-600 mb-3">${metaHTML}</div>` : ''}
            ${allergyStatusHTML ? `<div class="mb-3">${allergyStatusHTML}</div>` : ''}
            ${statusHTML}
        `;
        
        container.appendChild(recipeElement);
    });
}

function getFilteredRecipes() {
    return state.recipes.filter(recipe => {
        // Search filter
        const matchesSearch = recipe.name.toLowerCase().includes(state.recipeSearch) ||
            recipeIngredients(recipe).some(ing => ing.item.toLowerCase().includes(state.recipeSearch));
        
        if (!matchesSearch) return false;
        
        // Status filter
        if (state.recipeFilter === 'all') return true;
        if (state.recipeFilter === 'canMake') return canMakeRecipe(recipe);
        if (state.recipeFilter === 'missing') return !canMakeRecipe(recipe);
        if (state.recipeFilter === 'conflict') {
            const missing = getMissingIngredients(recipe);
            const sharedMissing = getSharedMissingIngredients();
            return missing.some(m => sharedMissing.some(s => s.item.toLowerCase() === m.item.toLowerCase()));
        }
        if (state.recipeFilter === 'use-expiring') return recipeUsesExpiringIngredients(recipe);
        if (state.recipeFilter === 'has-expired') return recipeHasExpiredIngredients(recipe);

        // Phase 4: Allergy-based filters
        if (state.recipeFilter === 'safe') return !analyzeRecipeAllergies(recipe).hasConflicts;
        if (state.recipeFilter === 'allergy-warning') {
            const analysis = analyzeRecipeAllergies(recipe);
            return analysis.hasConflicts && !analysis.hasLifeThreatening;
        }
        if (state.recipeFilter === 'dangerous') return analyzeRecipeAllergies(recipe).hasLifeThreatening;


        return true;
    });
}

// ---------------------------------------------------------------------------
// Pantry emblem
//
// Replaces the old package glyph, which was a shipping carton — an image about
// things arriving, in an app about what you already have and how long it keeps.
//
// A preserving jar says both halves of the name: a full larder is *prepared*,
// and putting food by is the wise part. The sprig keeps it a kitchen rather
// than a warehouse, and the fill level is drawn from the same number printed
// beside it, so the emblem states the pantry's condition instead of decorating
// it. Purely decorative to assistive tech — the figure is already announced.
// ---------------------------------------------------------------------------

// Interior of the jar, in viewBox units: the fill travels between these.
const EMBLEM_FILL = { top: 18, bottom: 36, left: 16, right: 32 };

const PANTRY_EMBLEM_SVG = `
<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4"
     stroke-linecap="round" stroke-linejoin="round" focusable="false">
    <defs>
        <clipPath id="pantry-emblem-clip">
            <path d="M15 16h18v17a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4z"/>
        </clipPath>
    </defs>

    <!-- what is put by -->
    <rect class="emblem-fill" x="${EMBLEM_FILL.left - 4}" y="${EMBLEM_FILL.bottom}"
          width="${EMBLEM_FILL.right - EMBLEM_FILL.left + 8}" height="0"
          clip-path="url(#pantry-emblem-clip)" fill="currentColor" stroke="none"
          opacity="0.42"/>

    <!-- the jar: lid sits a hair above the shoulder so the two read apart -->
    <path d="M15 16h18v17a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4z"/>
    <rect x="13.4" y="10.4" width="21.2" height="4.4" rx="1.4"/>

    <!-- a sprig, because it is a kitchen and not a warehouse -->
    <path d="M24 10.4c0-3.6.7-6.2 2.6-8.4"/>
    <path d="M23.9 8.5c-2.1.4-4-.7-5-2.8 2.2-.5 4.1.4 5 2.8z"/>
    <path d="M25.4 4.9c.2-2.2 1.8-3.8 4.1-4.2.2 2.3-1.3 4-4.1 4.2z"/>
</svg>`;

/**
 * Draw the emblem and set its fill to the given stock percentage.
 * Re-renders the skeleton only once; afterwards only the fill rect moves, so
 * the CSS transition on it has something continuous to animate.
 */
function renderPantryEmblem(percentage) {
    const host = document.getElementById('pantry-emblem');
    if (!host) return;

    if (!host.firstElementChild) host.innerHTML = PANTRY_EMBLEM_SVG;

    const fill = host.querySelector('.emblem-fill');
    if (!fill) return;

    const ratio = Math.min(Math.max(Number(percentage) || 0, 0), 100) / 100;
    const span = EMBLEM_FILL.bottom - EMBLEM_FILL.top;
    // Keep a sliver visible at 1-2% so "nearly empty" still reads as a level
    // rather than as an empty jar.
    const height = ratio > 0 ? Math.max(ratio * span, 1.5) : 0;

    fill.setAttribute('height', String(height));
    fill.setAttribute('y', String(EMBLEM_FILL.bottom - height));
}

// Overview View
function updateOverviewView() {
    const percentage = getOverallInventoryPercentage();
    const lowStock = getLowStockItems();
    const expiringSoon = getExpiringSoonItems();
    const expired = getExpiredItems();
    const expiringToday = getExpiringTodayItems();
    const sharedMissing = getSharedMissingIngredients();
    const canMakeCount = state.recipes.filter(canMakeRecipe).length;
    const enhancedShoppingList = generateEnhancedShoppingList();
    
    // Update stats
    elements.overview.percentage.textContent = `${percentage}%`;
    renderPantryEmblem(percentage);
    elements.overview.availableRecipes.textContent = canMakeCount;
    elements.overview.totalRecipes.textContent = `out of ${state.recipes.length} total`;
    elements.overview.lowStockCount.textContent = lowStock.length;
    elements.overview.expiringSoonCount.textContent = expiringSoon.length;
    elements.overview.expiredCount.textContent = expired.length;
    // A count of zero is information; a count above zero is a call to action.
    document.getElementById('expired-tile')?.classList.toggle('is-alerting', expired.length > 0);
    
    // Update expiration alerts
    const needsAttention = [...expired, ...expiringToday, ...expiringSoon.filter(item => item.expirationStatus === 'expiringSoon')];
    if (needsAttention.length > 0) {
        elements.overview.expirationAlert.classList.remove('hidden');
        elements.overview.expirationList.innerHTML = needsAttention.map(item => {
            const statusInfo = getExpirationStatusInfo(item);
            return `
                <div class="bg-white rounded-lg p-4 border-l-4 ${statusInfo.borderColor}">
                    <div class="flex justify-between items-start mb-2">
                        <div class="font-medium text-gray-900">${escapeHtml(item.name)}</div>
                        <div class="${statusInfo.badgeClass} px-3 py-1 rounded-full text-sm font-semibold">
                            ${statusInfo.text}
                        </div>
                    </div>
                    <div class="text-sm text-gray-600 mb-1">
                        <span class="font-medium">Quantity:</span> ${escapeHtml(item.current)} ${escapeHtml(item.unit)}
                        ${item.location ? ` • <span class="font-medium">Location:</span> ${escapeHtml(item.location)}` : ''}
                    </div>
                    ${item.expirationDate ? `
                        <div class="text-sm text-gray-600">
                            <span class="font-medium">Expires:</span> ${new Date(item.expirationDate).toLocaleDateString()}
                            ${item.daysUntilExpiry !== undefined ? ` (${Math.abs(item.daysUntilExpiry)} days ${item.daysUntilExpiry < 0 ? 'ago' : item.daysUntilExpiry === 0 ? 'today' : 'remaining'})` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    } else {
        elements.overview.expirationAlert.classList.add('hidden');
    }
    
    // Update conflicts
    if (sharedMissing.length > 0) {
        elements.overview.conflictsAlert.classList.remove('hidden');
        elements.overview.conflictsList.innerHTML = sharedMissing.map(item => `
            <div class="bg-white rounded-lg p-4 border border-purple-200">
                <div class="flex justify-between items-start mb-2">
                    <div class="font-medium text-purple-900 text-lg">${escapeHtml(item.item)}</div>
                    <div class="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">
                        Need ${escapeHtml(item.deficit)} more ${escapeHtml(item.unit)}
                    </div>
                </div>
                <div class="text-sm text-gray-600 mb-2">
                    <span class="font-medium">Available:</span> ${escapeHtml(item.available)} ${escapeHtml(item.unit)} • 
                    <span class="font-medium"> Total Needed:</span> ${escapeHtml(item.needed)} ${escapeHtml(item.unit)}
                </div>
                <div class="text-sm text-purple-700 mt-2 space-y-1">
                    <div class="font-medium">Required by:</div>
                    ${item.recipes.map(recipe => `<div class="ml-3">• ${escapeHtml(recipe)}</div>`).join('')}
                </div>
            </div>
        `).join('');
    } else {
        elements.overview.conflictsAlert.classList.add('hidden');
    }
    
    // Update enhanced shopping list
    if (enhancedShoppingList.length > 0) {
        elements.overview.shoppingList.classList.remove('hidden');
        elements.overview.shoppingItems.innerHTML = enhancedShoppingList.map(item => {
            const priorityClass = item.priority === 'high' ? 'text-red-600 font-bold' : 
                                 item.priority === 'medium' ? 'text-orange-600 font-medium' : 
                                 'text-orange-600 font-medium';
            const reasonText = item.reason === 'expired' ? '🚨 EXPIRED' :
                              item.reason === 'expired-and-low-stock' ? '🚨 EXPIRED + LOW' :
                              'Low Stock';
            
            return `
                <div class="flex justify-between items-center text-sm">
                    <div>
                        <span class="text-gray-700">${escapeHtml(item.item)}</span>
                        ${item.note ? `<div class="text-xs text-gray-500">${escapeHtml(item.note)}</div>` : ''}
                    </div>
                    <div class="text-right">
                        <span class="${priorityClass}">${escapeHtml(item.amount)} ${escapeHtml(item.unit)}</span>
                        <div class="text-xs ${priorityClass}">${reasonText}</div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        elements.overview.shoppingList.classList.add('hidden');
    }

    /*
     * The overview always ends with one thing to do. An empty app is offered the
     * sample kitchen; a stocked one gets the AI shortcut, which would only have
     * an empty pantry to summarise before that.
     */
    const empty = !hasAnyData();
    document.getElementById('overview-sample-prompt')?.classList.toggle('hidden', !empty);
    document.getElementById('overview-ai-card')?.classList.toggle('hidden', empty);
}

// Recipe Modal
function showRecipeModal(recipe) {
    state.selectedRecipe = recipe;
    
    elements.modal.title.textContent = recipe.name;
    
    // Meta information
    const meta = [
        recipe.prepTime ? `Prep: ${escapeHtml(formatRecipeMeta(recipe.prepTime, 'min'))}` : '',
        recipe.cookTime ? `Cook: ${escapeHtml(formatRecipeMeta(recipe.cookTime, 'min'))}` : '',
        recipe.servings ? `Servings: ${escapeHtml(formatRecipeMeta(recipe.servings, 'servings'))}` : ''
    ].filter(Boolean);
    elements.modal.meta.innerHTML = meta.join('<span class="mx-2">•</span>');
    
    // Ingredients
    const used = cookingChecks.get(recipe.id) || new Set();
    elements.modal.ingredients.innerHTML = recipeIngredients(recipe).map((ing, index) => {
        const invItem = findInventoryItemByName(ing.item);
        const hasEnough = invItem && invItem.current >= parseFloat(ing.amount);
        const bgClass = hasEnough ? 'bg-green-50' : 'bg-orange-50';
        const checked = used.has(index);

        return `
            <label class="cook-ingredient ${bgClass} ${checked ? 'is-used' : ''}">
                <input type="checkbox" class="cook-check" data-change-action="cook-check"
                       data-index="${index}" ${checked ? 'checked' : ''}
                       aria-label="Used ${escapeHtml(ing.item)}">
                <span class="cook-ingredient-name">${escapeHtml(ing.item)}</span>
                <span class="cook-ingredient-amount">${escapeHtml(ing.amount)} ${escapeHtml(ing.unit)}</span>
            </label>
        `;
    }).join('');

    updateCookProgress(recipe);
    
    // Instructions
    let stepNumber = 0;
    elements.modal.instructions.innerHTML = recipeSteps(recipe).filter(isPlainObject).map((step, index) => {
        const timerControl = renderStepTimerControl(recipe, step, index);

        if (step.type === 'paragraph') {
            return `
                <div class="text-gray-700 leading-relaxed">${escapeHtml(step.content)}${timerControl}</div>
            `;
        }

        stepNumber++;
        return `
            <div class="flex gap-3">
                <div class="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
                    ${stepNumber}
                </div>
                <div class="flex-1 pt-1">
                    <p class="text-gray-700">${escapeHtml(step.content)}</p>
                    ${timerControl}
                </div>
            </div>
        `;
    }).join('') || '';

    // Show live figures immediately for any step already counting down.
    if (typeof updateStepTimerDisplays === 'function') updateStepTimerDisplays();
    
    elements.modal.container.classList.remove('hidden');
}

function closeRecipeModal() {
    state.selectedRecipe = null;
    elements.modal.container.classList.add('hidden');
}

// Export Functions
function exportRecipesToJSON() {
    const dataStr = JSON.stringify(state.recipes, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recipes-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function exportShoppingList() {
    const lowStock = getLowStockItems();
    const sharedMissing = getSharedMissingIngredients();
    const enhancedShoppingList = generateEnhancedShoppingList();
    
    let content = '🛒 SHOPPING LIST\n';
    content += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    if (sharedMissing.length > 0) {
        content += '⚡ PRIORITY ITEMS (Needed by Multiple Recipes):\n';
        content += '━'.repeat(50) + '\n';
        sharedMissing.forEach(item => {
            content += `□ ${item.item}: Need ${item.deficit} more ${item.unit}\n`;
            content += `  Currently have: ${item.available} ${item.unit}\n`;
            content += `  Total needed: ${item.needed} ${item.unit}\n`;
            content += `  Required by: ${item.recipes.join(', ')}\n\n`;
        });
    }
    
    if (enhancedShoppingList.length > 0) {
        content += '\n📦 SHOPPING NEEDS:\n';
        content += '━'.repeat(50) + '\n';
        
        // Group by priority
        const highPriority = enhancedShoppingList.filter(item => item.priority === 'high');
        const normalPriority = enhancedShoppingList.filter(item => item.priority === 'normal');
        
        if (highPriority.length > 0) {
            content += '\n🚨 HIGH PRIORITY (Expired Items):\n';
            highPriority.forEach(item => {
                content += `□ ${item.item}: ${item.amount} ${item.unit}\n`;
                if (item.note) content += `  ${item.note}\n`;
            });
        }
        
        if (normalPriority.length > 0) {
            content += '\n📋 LOW STOCK ITEMS:\n';
            normalPriority.forEach(item => {
                content += `□ ${item.item}: ${item.amount} ${item.unit}\n`;
            });
        }
    }
    
    if (lowStock.length === 0 && sharedMissing.length === 0 && enhancedShoppingList.length === 0) {
        content += '\n✓ No items needed at this time!\n';
    }
    
    const dataBlob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shopping-list-${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
}

// ============================================================================
// Data Export & Import Functions
// ============================================================================

// Storage keys constant
const STORAGE_KEYS = {
    inventory: 'prepwise-inventory',
    recipes: 'prepwise-recipes',
    userProfile: 'prepwise-user-profile',
    allergySettings: 'prepwise-allergy-settings',
    expirationSettings: 'prepwise-expiration-settings',
    lastBackup: 'prepwise-last-backup'
};

// Export full backup
function exportFullBackup() {
    try {
        const backup = {
            inventory: JSON.parse(localStorage.getItem(STORAGE_KEYS.inventory) || '[]'),
            recipes: JSON.parse(localStorage.getItem(STORAGE_KEYS.recipes) || '[]'),
            userProfile: JSON.parse(localStorage.getItem(STORAGE_KEYS.userProfile) || '{}'),
            allergySettings: JSON.parse(localStorage.getItem(STORAGE_KEYS.allergySettings) || '{}'),
            expirationSettings: JSON.parse(localStorage.getItem(STORAGE_KEYS.expirationSettings) || '{}'),
            version: '1.0',
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `prepwise-full-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);

        // Update last backup timestamp
        localStorage.setItem(STORAGE_KEYS.lastBackup, Date.now().toString());
        updateSettingsView();

        showNotification('Backup exported successfully!', 'success');
    } catch (error) {
        console.error('Export failed:', error);
        showNotification('Failed to export backup', 'error');
    }
}

// Export inventory only
function exportInventory() {
    try {
        const inventory = JSON.parse(localStorage.getItem(STORAGE_KEYS.inventory) || '[]');
        const backup = {
            inventory: inventory,
            version: '1.0',
            exportDate: new Date().toISOString(),
            exportType: 'inventory-only'
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `prepwise-inventory-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);

        localStorage.setItem(STORAGE_KEYS.lastBackup, Date.now().toString());
        updateSettingsView();

        showNotification('Inventory exported successfully!', 'success');
    } catch (error) {
        console.error('Export failed:', error);
        showNotification('Failed to export inventory', 'error');
    }
}

// Export allergy profile
function exportAllergyProfile() {
    try {
        const backup = {
            userProfile: JSON.parse(localStorage.getItem(STORAGE_KEYS.userProfile) || '{}'),
            allergySettings: JSON.parse(localStorage.getItem(STORAGE_KEYS.allergySettings) || '{}'),
            version: '1.0',
            exportDate: new Date().toISOString(),
            exportType: 'allergy-profile'
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `prepwise-allergy-profile-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);

        localStorage.setItem(STORAGE_KEYS.lastBackup, Date.now().toString());
        updateSettingsView();

        showNotification('Allergy profile exported successfully!', 'success');
    } catch (error) {
        console.error('Export failed:', error);
        showNotification('Failed to export allergy profile', 'error');
    }
}

// ---------------------------------------------------------------------------
// AI-friendly export
//
// Deliberately NOT the same format as the backup JSON. The backup must be
// lossless and round-trippable so import works; this export is the opposite —
// lossy, denormalized, and self-describing, so an AI assistant can reason about
// it without guessing at the schema.
//
// Three things it does that the backup cannot:
//   1. Recomputes expiration at export time. The stored expirationStatus and
//      daysUntilExpiry are snapshots from the last app open and go stale, which
//      would make an assistant confidently wrong about what's still good.
//   2. Explains the semantics that aren't obvious from field names (notably
//      that `max` is a restock target, not physical capacity).
//   3. Drops allergy severity and record IDs, keeping only what an assistant
//      needs to reason about food. See AI_EXPORT_EXCLUSIONS.
// ---------------------------------------------------------------------------

/*
 * What the export leaves behind, listed in Settings.
 *
 * Every line here has to name something the app actually holds - otherwise it
 * reads as reassurance about data that was never at risk, and invites the reader
 * to assume the app collects far more than it does. Prepwise records a pantry,
 * recipes, and food allergies. That is the whole of it.
 */
const AI_EXPORT_EXCLUSIONS = [
    'How severe each allergy is — only the allergen names are shared',
    'Internal record IDs and your app settings'
];

function formatExpiryForAI(item) {
    if (!item.hasExpiration || !item.expirationDate) return 'not tracked';

    // Recompute rather than trusting the stored snapshot.
    const { status, daysUntilExpiry } = calculateExpirationStatus(item);
    const on = ` (${item.expirationDate})`;

    switch (status) {
        case 'expired':
            return `EXPIRED ${Math.abs(daysUntilExpiry)} day${Math.abs(daysUntilExpiry) === 1 ? '' : 's'} ago${on}`;
        case 'expiringToday':
            return `expires today${on}`;
        case 'expiringSoon':
            return `expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}${on}`;
        default:
            return `fresh${on}`;
    }
}

function buildAIExport() {
    // Bring derived expiration state up to date first. Recipe availability and the
    // shopping list both read the stored expirationStatus, so without this the
    // document could contradict its own inventory table.
    refreshExpirationStatuses();

    const today = new Date().toISOString().split('T')[0];
    const inventory = state.inventory || [];
    const recipes = state.recipes || [];
    const profile = state.userProfile || {};

    const lines = [];
    lines.push(`# Prepwise Pantry Export — ${today}`);
    lines.push('');
    lines.push('Exported from Prepwise, a local-only pantry and recipe tracker.');
    lines.push('');
    lines.push('**Reading this file:** "On hand" is the current quantity. "Target" is the');
    lines.push('level the user considers fully stocked — it is a restock goal, not physical');
    lines.push('capacity. Expiration is calculated as of the export date above. Items marked');
    lines.push('EXPIRED are excluded from what the user can currently cook.');
    lines.push('');

    /*
     * Allergen names only - never severity, per AI_EXPORT_EXCLUSIONS and what
     * Settings promises.
     *
     * There is no "dietary restrictions" line. The app has never had an input
     * for one, so every export said "none recorded" forever: a category the
     * reader is invited to believe is tracked, costing tokens to say nothing.
     * Same reasoning that removed emergencyContact. If an input is ever built,
     * the line comes back with it.
     */
    const allergies = Array.isArray(profile.allergies) ? profile.allergies : [];

    lines.push('## Allergies');
    lines.push('');
    lines.push(allergies.length
        ? `Must be avoided: ${allergies.map(a => a.name).join(', ')}`
        : 'None recorded.');
    lines.push('');

    // --- Inventory ---
    lines.push(`## Inventory (${inventory.length} item${inventory.length === 1 ? '' : 's'})`);
    lines.push('');
    if (inventory.length) {
        lines.push('| Item | On hand | Target | Unit | Expiration |');
        lines.push('|---|---|---|---|---|');
        inventory.forEach(item => {
            lines.push(`| ${item.name} | ${item.current} | ${item.max} | ${item.unit || ''} | ${formatExpiryForAI(item)} |`);
        });
    } else {
        lines.push('_Inventory is empty._');
    }
    lines.push('');

    // --- Recipes ---
    lines.push(`## Recipes (${recipes.length})`);
    lines.push('');
    if (recipes.length) {
        recipes.forEach(recipe => {
            const meta = [
                recipe.prepTime ? `${formatRecipeMeta(recipe.prepTime, 'min')} prep` : null,
                recipe.cookTime ? `${formatRecipeMeta(recipe.cookTime, 'min')} cook` : null,
                recipe.servings ? `serves ${recipe.servings}` : null
            ].filter(Boolean).join(', ');

            lines.push(`### ${recipe.name}${meta ? ` — ${meta}` : ''}`);
            lines.push('');

            const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
            if (ingredients.length) {
                lines.push('Ingredients:');
                ingredients.forEach(ing => {
                    lines.push(`- ${ing.amount || ''} ${ing.unit || ''} ${ing.item}`.replace(/\s+/g, ' ').trim());
                });
                lines.push('');
            }

            const missing = getMissingIngredients(recipe);
            lines.push(missing.length
                ? `Can make now: no — short ${missing.map(m => `${m.amount} ${m.unit} ${m.item}`.replace(/\s+/g, ' ').trim()).join('; ')}`
                : 'Can make now: yes');
            lines.push('');

            const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
            if (steps.length) {
                lines.push('Steps:');
                steps.forEach((step, i) => {
                    const label = step.type && step.type !== 'step' ? ` _(${step.type})_` : '';
                    lines.push(`${i + 1}. ${step.content}${label}`);
                });
                lines.push('');
            }
        });
    } else {
        lines.push('_No recipes saved._');
    }

    // --- Shopping needs ---
    const shopping = generateEnhancedShoppingList();
    lines.push(`## Suggested Shopping List (${shopping.length})`);
    lines.push('');
    if (shopping.length) {
        shopping.forEach(entry => {
            const note = entry.note ? ` — ${entry.note}` : '';
            lines.push(`- ${entry.amount} ${entry.unit} ${entry.item} (${entry.reason}, ${entry.priority} priority)${note}`.replace(/\s+/g, ' '));
        });
    } else {
        lines.push('_Nothing needed right now._');
    }
    lines.push('');

    return lines.join('\n');
}

// Copy the AI export to the clipboard for pasting straight into a chat.
/**
 * Put text on the clipboard, falling back for insecure contexts.
 *
 * The async Clipboard API needs a secure context, which `file://` and plain
 * `http://` on a LAN are not - and a kitchen tablet is quite likely to be on
 * exactly one of those.
 */
async function copyTextToClipboard(text, successMessage) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            const area = document.createElement('textarea');
            area.value = text;
            area.setAttribute('readonly', '');
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(area);
            if (!ok) throw new Error('execCommand copy failed');
        }
        showNotification(successMessage, 'success');
        return true;
    } catch (error) {
        console.error('Clipboard copy failed:', error);
        showNotification('Could not copy to the clipboard', 'error');
        return false;
    }
}

/** The shopping list as plain text, one line per thing to buy. */
function buildShoppingListText() {
    const items = generateEnhancedShoppingList();
    if (!items.length) return 'Nothing to buy - the pantry is in good shape.';

    return ['Shopping list', ''].concat(items.map(item => {
        const note = item.reason === 'expired' ? '  (replaces expired stock)' : '';
        return `- ${item.amount} ${item.unit} ${item.item}${note}`;
    })).join('\n');
}

/** The contested ingredients as plain text. */
function buildConflictsText() {
    const conflicts = getSharedMissingIngredients();
    if (!conflicts.length) return 'No ingredients are being fought over.';

    return ['Ingredients several recipes need', ''].concat(conflicts.map(conflict => {
        const recipes = (conflict.recipes || []).join(', ');
        return `- ${conflict.item}: need ${conflict.needed} ${conflict.unit}, have ${conflict.available} ${conflict.unit}`
            + (recipes ? ` (${recipes})` : '');
    })).join('\n');
}

/**
 * Put the export on the clipboard, and say so *on the button*.
 *
 * The toast alone was not enough: it appears in the corner while the eye is on
 * the button that was just pressed, and a copy that gives no feedback reads as
 * a copy that did not happen. The button confirms in place for two seconds and
 * then returns to itself.
 */
function confirmOnButton(action, message) {
    // Whichever copy of the control was pressed - the Overview and Settings
    // each have one.
    const button = document.activeElement?.closest?.(`[data-action="${action}"]`)
        || document.querySelector(`.view.active [data-action="${action}"]`);
    if (!button || button.dataset.confirming === 'true') return;

    const label = button.querySelector('.font-medium') || button;
    const original = label.textContent;
    button.dataset.confirming = 'true';
    button.classList.add('is-confirmed');
    label.textContent = message;

    setTimeout(() => {
        label.textContent = original;
        button.classList.remove('is-confirmed');
        delete button.dataset.confirming;
    }, 2000);
}

function copyViaTextarea(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
}

async function copyAIExport() {
    const markdown = buildAIExport();
    try {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(markdown);
            } catch (denied) {
                // A secure context is not a granted permission. Rather than
                // give up, fall back to the same path file:// uses.
                if (!copyViaTextarea(markdown)) throw denied;
            }
        } else {
            // file:// and plain http:// have no async clipboard API.
            if (!copyViaTextarea(markdown)) throw new Error('execCommand copy failed');
        }
        confirmOnButton('ai-copy', '✓ Copied');
        showNotification('Copied — paste it into your AI assistant', 'success');
    } catch (error) {
        console.error('Clipboard copy failed:', error);
        showNotification('Could not copy. Use "Download as Markdown" instead.', 'error');
    }
}

// Download the AI export as a .md file.
function downloadAIExport() {
    try {
        const markdown = buildAIExport();
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `prepwise-for-ai-${new Date().toISOString().split('T')[0]}.md`;
        link.click();
        URL.revokeObjectURL(url);

        showNotification('Markdown export downloaded', 'success');
    } catch (error) {
        console.error('AI export failed:', error);
        showNotification('Failed to build export', 'error');
    }
}

// ---------------------------------------------------------------------------
// Backup validation
//
// An imported file is untrusted: it can come from another person, a shared
// folder, or a chat. Previously only `version` and `exportDate` were checked,
// so arbitrarily shaped objects could reach state and localStorage. This
// verifies the shape of everything before any of it is applied, and returns a
// human-readable reason on failure (or null when the file is acceptable).
// ---------------------------------------------------------------------------
function validateBackup(backup) {
    const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

    if (!isObject(backup)) return 'not a JSON object';
    if (typeof backup.version !== 'string') return 'missing version';
    if (typeof backup.exportDate !== 'string' || isNaN(Date.parse(backup.exportDate))) {
        return 'missing or unreadable export date';
    }

    // Every collection is optional, but must be the right type when present.
    const arrayFields = ['inventory', 'recipes'];
    for (const field of arrayFields) {
        if (backup[field] !== undefined && !Array.isArray(backup[field])) {
            return field + ' must be a list';
        }
    }

    const objectFields = ['userProfile', 'allergySettings', 'expirationSettings'];
    for (const field of objectFields) {
        if (backup[field] !== undefined && !isObject(backup[field])) {
            return field + ' must be an object';
        }
    }

    if (Array.isArray(backup.inventory)) {
        if (backup.inventory.length > 10000) return 'inventory is implausibly large';
        for (const item of backup.inventory) {
            if (!isObject(item)) return 'an inventory entry is not an object';
            if (typeof item.name !== 'string' || !item.name.trim()) {
                return 'an inventory item has no name';
            }
            if (item.current !== undefined && !Number.isFinite(Number(item.current))) {
                return 'inventory item "' + item.name + '" has a non-numeric quantity';
            }
            if (item.max !== undefined && !Number.isFinite(Number(item.max))) {
                return 'inventory item "' + item.name + '" has a non-numeric target';
            }
            if (item.expirationDate !== undefined && item.expirationDate !== null &&
                (typeof item.expirationDate !== 'string' || isNaN(Date.parse(item.expirationDate)))) {
                return 'inventory item "' + item.name + '" has an invalid expiration date';
            }
        }
    }

    if (Array.isArray(backup.recipes)) {
        if (backup.recipes.length > 10000) return 'recipe list is implausibly large';
        for (const recipe of backup.recipes) {
            if (!isObject(recipe)) return 'a recipe entry is not an object';
            if (typeof recipe.name !== 'string' || !recipe.name.trim()) {
                return 'a recipe has no name';
            }
            if (recipe.ingredients !== undefined && !Array.isArray(recipe.ingredients)) {
                return 'recipe "' + recipe.name + '" has a malformed ingredient list';
            }
            if (Array.isArray(recipe.ingredients)) {
                for (const ing of recipe.ingredients) {
                    if (!isObject(ing) || typeof ing.item !== 'string') {
                        return 'recipe "' + recipe.name + '" has a malformed ingredient';
                    }
                }
            }
            if (recipe.steps !== undefined && !Array.isArray(recipe.steps)) {
                return 'recipe "' + recipe.name + '" has a malformed step list';
            }
        }
    }

    if (isObject(backup.userProfile) && backup.userProfile.allergies !== undefined) {
        if (!Array.isArray(backup.userProfile.allergies)) {
            return 'allergy list must be a list';
        }
        for (const allergy of backup.userProfile.allergies) {
            if (!isObject(allergy) || typeof allergy.name !== 'string') {
                return 'an allergy entry is malformed';
            }
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// Backup sanitization
//
// validateBackup() answers "is this a backup file at all" and rejects loudly.
// This answers the harder question: given a file that *looks* like a backup,
// what is safe to keep? It never hands back any part of the parsed input —
// every value is rebuilt from an allowlist of known fields, coerced to the
// type the app expects, bounded in size, and stripped of characters that can
// misrepresent it on screen.
//
// It is deliberately silent and lossy rather than rejecting: a file with one
// odd field should still import the other 200 items. Whatever it changes is
// counted and reported to the user before they confirm.
//
// This also runs over localStorage on load, so data that got in before these
// rules existed (or was edited by hand in devtools) is repaired rather than
// trusted forever.
// ---------------------------------------------------------------------------

const IMPORT_LIMITS = {
    fileBytes: 10 * 1024 * 1024,
    inventory: 5000,
    recipes: 2000,
    ingredientsPerRecipe: 200,
    stepsPerRecipe: 500,
    allergies: 200,
    settingsKeys: 50,
    tinyText: 40,
    shortText: 200,
    longText: 5000,
    quantity: 1e9,
    timerSeconds: 99 * 3600 + 59 * 60 + 59
};

// Keys that must never be copied onto an object built from user input. Object
// spread does not invoke setters, so today's merge paths are not exploitable —
// but a future Object.assign() or a for..in copy would be, and by then the
// dangerous data would already be sitting in localStorage.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isPlainObject = value =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Coerce to a display-safe string.
 *
 * Strips C0/C1 control characters and the Unicode bidi overrides — the latter
 * can make "Milk" render as something else entirely in a list, which matters
 * for a file someone else prepared. escapeHtml() handles markup; this handles
 * characters that are dangerous precisely because they are invisible.
 */
function cleanString(value, maxLength, { multiline = false } = {}) {
    let text;
    if (typeof value === 'string') text = value;
    else if (typeof value === 'number' && Number.isFinite(value)) text = String(value);
    else if (typeof value === 'boolean') text = String(value);
    else return '';

    // Multiline text (recipe steps) keeps tab/newline/carriage return.
    const controls = multiline
        ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g
        : /[\u0000-\u001F\u007F-\u009F]/g;
    const bidiOverrides = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

    return text
        .replace(controls, '')
        .replace(bidiOverrides, '')
        .trim()
        .slice(0, maxLength);
}

function cleanNumber(value, { min = 0, max = IMPORT_LIMITS.quantity, fallback = 0 } = {}) {
    const number = typeof value === 'number' ? value : Number(String(value ?? '').trim());
    // Number([]) is 0 and Number('') is 0, so anything non-numeric that coerces
    // silently is caught by requiring the original to be a number or a
    // non-empty numeric string.
    if (!Number.isFinite(number)) return fallback;
    if (typeof value !== 'number' && !/^-?\d*\.?\d+(?:e[+-]?\d+)?$/i.test(String(value ?? '').trim())) {
        return fallback;
    }
    return Math.min(Math.max(number, min), max);
}

function cleanBoolean(value, fallback = false) {
    return typeof value === 'boolean' ? value : fallback;
}

/** Normalise to the YYYY-MM-DD form the rest of the app stores, or null. */
function cleanDate(value) {
    if (typeof value !== 'string') return null;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return null;
    return new Date(parsed).toISOString().split('T')[0];
}

function cleanStringArray(value, { maxItems, maxLength }) {
    if (!Array.isArray(value)) return [];
    const out = [];
    for (const entry of value) {
        const text = cleanString(entry, maxLength);
        if (text) out.push(text);
        if (out.length >= maxItems) break;
    }
    return out;
}

function cleanEnum(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
}

/** A flat bag of primitives. Used for settings the app stores but never reads. */
function cleanPrimitiveMap(value) {
    if (!isPlainObject(value)) return {};
    const out = {};
    let count = 0;
    for (const key of Object.keys(value)) {
        if (FORBIDDEN_KEYS.has(key) || count >= IMPORT_LIMITS.settingsKeys) continue;
        const entry = value[key];
        const type = typeof entry;
        if (entry === null || type === 'boolean' || type === 'number' || type === 'string') {
            out[cleanString(key, IMPORT_LIMITS.tinyText)] =
                type === 'string' ? cleanString(entry, IMPORT_LIMITS.shortText) : entry;
            count++;
        }
    }
    delete out['']; // a key that cleaned away to nothing
    return out;
}

function sanitizeInventoryItem(raw) {
    if (!isPlainObject(raw)) return null;

    const name = cleanString(raw.name, IMPORT_LIMITS.shortText);
    if (!name) return null;

    const current = cleanNumber(raw.current, { fallback: 0 });
    // A zero or missing target divides by zero in the stock bar, so floor it at
    // something the UI can render.
    const max = Math.max(cleanNumber(raw.max, { fallback: 0 }), current, 1);
    const expirationDate = cleanDate(raw.expirationDate);

    const item = {
        id: cleanNumber(raw.id, { min: 0, fallback: 0 }) || Date.now() + Math.floor(Math.random() * 100000),
        name,
        current,
        max,
        unit: cleanString(raw.unit, IMPORT_LIMITS.tinyText) || 'units',
        hasExpiration: cleanBoolean(raw.hasExpiration) && !!expirationDate,
        purchaseDate: cleanDate(raw.purchaseDate),
        expirationDate,
        // Only a key the status table actually has; anything else (including
        // "__proto__" or "toString") would resolve to an inherited member.
        expirationStatus: Object.prototype.hasOwnProperty.call(EXPIRATION_STATUS, raw.expirationStatus)
            ? raw.expirationStatus
            : 'fresh',
        shelfLifeDays: raw.shelfLifeDays === null || raw.shelfLifeDays === undefined
            ? null
            : cleanNumber(raw.shelfLifeDays, { min: 0, max: 36500, fallback: 0 }),
        lastExpirationCheck: cleanDate(raw.lastExpirationCheck),
        expirationNotified: cleanBoolean(raw.expirationNotified),
        // Recomputed from the dates on every load; never trusted from a file.
        daysUntilExpiry: null
    };

    const location = cleanString(raw.location, IMPORT_LIMITS.shortText);
    if (location) item.location = location;

    const allergens = cleanStringArray(raw.allergens, { maxItems: 50, maxLength: IMPORT_LIMITS.tinyText });
    if (allergens.length) item.allergens = allergens;
    if (raw.verified !== undefined) item.verified = cleanBoolean(raw.verified);

    return item;
}

function sanitizeIngredient(raw) {
    if (!isPlainObject(raw)) return null;
    const ingredientName = cleanString(raw.item, IMPORT_LIMITS.shortText);
    if (!ingredientName) return null;
    return {
        item: ingredientName,
        // Stored as a string throughout the app (it comes from an input value)
        // and read back with parseFloat.
        amount: cleanString(raw.amount, IMPORT_LIMITS.tinyText),
        unit: cleanString(raw.unit, IMPORT_LIMITS.tinyText) || 'units'
    };
}

function sanitizeStep(raw) {
    if (!isPlainObject(raw)) return null;
    const content = cleanString(raw.content, IMPORT_LIMITS.longText, { multiline: true });
    if (!content) return null;

    const step = { type: cleanEnum(raw.type, ['step', 'paragraph'], 'step'), content };

    // Optional per-step timer. Bounded to a day: the field drives a countdown,
    // and an imported recipe should not be able to describe a 400-year simmer.
    if (raw.timerSeconds !== undefined && raw.timerSeconds !== null) {
        const seconds = Math.round(cleanNumber(raw.timerSeconds, {
            min: 0, max: IMPORT_LIMITS.timerSeconds, fallback: 0
        }));
        if (seconds > 0) step.timerSeconds = seconds;
    }

    return step;
}

function sanitizeRecipe(raw) {
    if (!isPlainObject(raw)) return null;

    const name = cleanString(raw.name, IMPORT_LIMITS.shortText);
    if (!name) return null;

    return {
        id: cleanNumber(raw.id, { min: 0, fallback: 0 }) || Date.now() + Math.floor(Math.random() * 100000),
        name,
        prepTime: cleanString(raw.prepTime, IMPORT_LIMITS.tinyText),
        cookTime: cleanString(raw.cookTime, IMPORT_LIMITS.tinyText),
        servings: cleanString(raw.servings, IMPORT_LIMITS.tinyText),
        // Always arrays. Half the recipe code calls .forEach/.every on these
        // without checking, so "absent" has to become "empty" here.
        ingredients: (Array.isArray(raw.ingredients) ? raw.ingredients : [])
            .slice(0, IMPORT_LIMITS.ingredientsPerRecipe)
            .map(sanitizeIngredient)
            .filter(Boolean),
        steps: (Array.isArray(raw.steps) ? raw.steps : [])
            .slice(0, IMPORT_LIMITS.stepsPerRecipe)
            .map(sanitizeStep)
            .filter(Boolean)
    };
}

function sanitizeAllergy(raw) {
    if (!isPlainObject(raw)) return null;
    const name = cleanString(raw.name, IMPORT_LIMITS.tinyText);
    if (!name) return null;
    return {
        name,
        severity: cleanEnum(raw.severity, ALLERGY_SEVERITIES, 'moderate'),
        dateAdded: cleanDate(raw.dateAdded) || new Date().toISOString().split('T')[0]
    };
}

function sanitizeUserProfile(raw) {
    const source = isPlainObject(raw) ? raw : {};
    const preferences = isPlainObject(source.alertPreferences) ? source.alertPreferences : {};

    const allergies = [];
    const seen = new Set();
    for (const entry of Array.isArray(source.allergies) ? source.allergies : []) {
        const allergy = sanitizeAllergy(entry);
        if (!allergy) continue;
        const key = allergy.name.toLowerCase();
        if (seen.has(key)) continue; // duplicates break the add/remove toggles
        seen.add(key);
        allergies.push(allergy);
        if (allergies.length >= IMPORT_LIMITS.allergies) break;
    }

    return {
        allergies,
        // Always complete: the allergy modal reads these without guarding.
        alertPreferences: {
            showWarnings: cleanBoolean(preferences.showWarnings, DEFAULT_ALERT_PREFERENCES.showWarnings),
            blockDangerous: cleanBoolean(preferences.blockDangerous, DEFAULT_ALERT_PREFERENCES.blockDangerous),
            alertLevel: cleanEnum(preferences.alertLevel, ALERT_LEVELS, DEFAULT_ALERT_PREFERENCES.alertLevel),
            requireConfirmation: cleanBoolean(preferences.requireConfirmation, DEFAULT_ALERT_PREFERENCES.requireConfirmation)
        }
        /*
         * No emergency contact, no dietary restrictions, nothing else personal.
         * Both were fields no screen ever wrote to, existing only to be
         * disclaimed in an export. The allowlist drops them on import like any
         * other unknown field, so a backup carrying one loses it.
         */
    };
}

function sanitizeExpirationSettings(raw) {
    const source = isPlainObject(raw) ? raw : {};
    return {
        enableNotifications: cleanBoolean(source.enableNotifications, DEFAULT_EXPIRATION_SETTINGS.enableNotifications),
        // Unbounded here means every item is permanently "expiring soon".
        warningDays: Math.round(cleanNumber(source.warningDays, {
            min: 0, max: 365, fallback: DEFAULT_EXPIRATION_SETTINGS.warningDays
        })),
        autoAddExpiredToShopping: cleanBoolean(source.autoAddExpiredToShopping, DEFAULT_EXPIRATION_SETTINGS.autoAddExpiredToShopping),
        autoRemoveExpiredFromRecipes: cleanBoolean(source.autoRemoveExpiredFromRecipes, DEFAULT_EXPIRATION_SETTINGS.autoRemoveExpiredFromRecipes),
        dailyExpirationCheck: cleanBoolean(source.dailyExpirationCheck, DEFAULT_EXPIRATION_SETTINGS.dailyExpirationCheck),
        lastNotificationCheck: cleanDate(source.lastNotificationCheck)
    };
}

/** Give every record an id that is unique within the list and unused elsewhere. */
function ensureUniqueIds(records, taken = new Set()) {
    for (const record of records) {
        while (taken.has(record.id)) {
            record.id = Date.now() + Math.floor(Math.random() * 1000000);
        }
        taken.add(record.id);
    }
    return records;
}

/**
 * Rebuild a whole backup from untrusted input.
 * @returns {{ backup: object, notes: string[] }} notes describe what changed.
 */
function sanitizeBackup(raw) {
    const source = isPlainObject(raw) ? raw : {};
    const notes = [];
    const backup = {
        version: cleanString(source.version, IMPORT_LIMITS.tinyText) || '1.0',
        exportDate: cleanString(source.exportDate, IMPORT_LIMITS.tinyText)
    };

    if (Array.isArray(source.inventory)) {
        const capped = source.inventory.slice(0, IMPORT_LIMITS.inventory);
        if (source.inventory.length > capped.length) {
            notes.push(`only the first ${IMPORT_LIMITS.inventory} inventory items were kept`);
        }
        backup.inventory = ensureUniqueIds(capped.map(sanitizeInventoryItem).filter(Boolean));
        const dropped = capped.length - backup.inventory.length;
        if (dropped > 0) notes.push(`${dropped} unusable inventory ${dropped === 1 ? 'entry' : 'entries'} skipped`);
    }

    if (Array.isArray(source.recipes)) {
        const capped = source.recipes.slice(0, IMPORT_LIMITS.recipes);
        if (source.recipes.length > capped.length) {
            notes.push(`only the first ${IMPORT_LIMITS.recipes} recipes were kept`);
        }
        backup.recipes = ensureUniqueIds(capped.map(sanitizeRecipe).filter(Boolean));
        const dropped = capped.length - backup.recipes.length;
        if (dropped > 0) notes.push(`${dropped} unusable ${dropped === 1 ? 'recipe' : 'recipes'} skipped`);
    }

    if (source.userProfile !== undefined) {
        backup.userProfile = sanitizeUserProfile(source.userProfile);
        const originalAllergies = Array.isArray(source.userProfile?.allergies)
            ? source.userProfile.allergies.length
            : 0;
        const dropped = originalAllergies - backup.userProfile.allergies.length;
        if (dropped > 0) notes.push(`${dropped} duplicate or unusable allergy ${dropped === 1 ? 'entry' : 'entries'} skipped`);
    }

    if (source.allergySettings !== undefined) {
        backup.allergySettings = cleanPrimitiveMap(source.allergySettings);
    }

    if (source.expirationSettings !== undefined) {
        backup.expirationSettings = sanitizeExpirationSettings(source.expirationSettings);
    }

    return { backup, notes };
}

// Global variable to store backup data during import
let pendingImportData = null;
// Which door the pending data came in through. Read by confirmImport() so an
// agent's proposal cannot be turned into a replace-everything, whatever the
// radio in the DOM currently says.
let pendingImportSource = 'file';

/**
 * Stage sanitized data for import and open the preview.
 *
 * The single way anything reaches `pendingImportData`. A file, the sample
 * kitchen and an agent's proposal all arrive here, already through
 * validateBackup() and sanitizeBackup(), and all get the same confirmation.
 */
function stageImport(backup, notes = [], source = 'file') {
    pendingImportData = backup;
    pendingImportSource = source;
    showImportModal(backup, notes, source);
}

// Handle import file selection
function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Read nothing enormous into memory; a pantry backup is kilobytes.
    if (file.size > IMPORT_LIMITS.fileBytes) {
        showNotification('That file is too large to be a Prepwise backup', 'error');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target.result);

            // Validate backup file
            const problem = validateBackup(parsed);
            if (problem) {
                showNotification('Invalid backup file: ' + problem, 'error');
                return;
            }

            // Rebuild it from scratch. Nothing from `parsed` is kept by
            // reference, so nothing downstream can be surprised by its shape.
            const { backup, notes } = sanitizeBackup(parsed);

            // Store backup data
            pendingImportData = backup;

            // Show import modal with preview
            showImportModal(backup, notes);
        } catch (error) {
            console.error('Failed to read backup file:', error);
            showNotification('Failed to read backup file: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
}

/**
 * Load the sample pantry.
 *
 * It goes through validateBackup() and sanitizeBackup() like any other import,
 * and opens the same preview with the same merge/replace choice. Two reasons:
 * the user sees what they are about to get and can still back out, and the
 * sample gets no privileges a hostile file would not have. Data that ships with
 * the app is still data.
 */
function loadSampleData() {
    const sample = window.prepwiseSampleData?.();
    if (!sample) {
        showNotification('Sample data is unavailable', 'error');
        return;
    }

    const problem = validateBackup(sample);
    if (problem) {
        // Only reachable if the shipped sample and the validator disagree,
        // which is a bug in this repo rather than anything the user did.
        console.error('Sample data failed validation:', problem);
        showNotification('Sample data could not be loaded: ' + problem, 'error');
        return;
    }

    const { backup, notes } = sanitizeBackup(sample);
    stageImport(backup, notes, 'sample');
}

/*
 * The preview serves two sources now. Only the wording differs - the gates, the
 * merge/replace choice and the confirmation are identical, because the sample is
 * not more trusted than a file, it is only better known.
 */
const IMPORT_WORDING = {
    file: { title: 'Import Backup Data', dateLabel: 'Backup Date:', contents: 'This backup contains:' },
    sample: { title: 'Load Sample Data', dateLabel: 'Sample from:', contents: 'The sample kitchen contains:' },
    /*
     * An AI agent's proposal - typically read off a photo of a fridge. It gets
     * the same preview and the same confirmation as a file, because a model's
     * output deserves the same scepticism: it can misread a label, invent a
     * quantity, or repeat an instruction planted in the picture.
     *
     * mergeOnly is the one difference, and it is a restriction, not a licence.
     * A misread photo may add wrong items; it may never empty a pantry.
     */
    agent: {
        title: 'An assistant suggests these items',
        dateLabel: 'Suggested:',
        contents: 'The assistant proposes adding:',
        mergeOnly: true,
        // The user did not write this, so a count is not enough. See
        // renderImportDetails().
        details: 'Every item it suggests:'
    },
    /*
     * A recipe an assistant wrote. Carries no `inventory` key at all, and
     * mergeBackupData() handles recipes and inventory independently, so the
     * pantry is untouched by construction rather than by a check. The preview's
     * own count line says "0 inventory items", which shows the user as much.
     *
     * Note this differs on purpose from saving a recipe through the form, where
     * stockPantryFromRecipeForm() deliberately does add every new ingredient to
     * the pantry so it lands on the shopping list. A cook writing a recipe is
     * saying "this is what I cook"; an assistant offering one is not entitled to
     * restock the kitchen off the back of it.
     */
    'agent-recipe': {
        title: 'An assistant suggests this recipe',
        dateLabel: 'Suggested:',
        contents: 'The assistant proposes adding:',
        mergeOnly: true,
        details: 'What it wrote:'
    }
};

/**
 * List what a proposal actually contains, rather than how much of it there is.
 *
 * The counts above are right for a backup file: the user exported it, so they
 * know what is in it. They are not right for something an assistant wrote,
 * which the user has never read — confirming "1 recipe" is confirming a recipe
 * sight unseen, and a model can put the unit in the ingredient's name (observed:
 * an ingredient called "cups") or invent a quantity. This brings agent
 * proposals up to the standard the rest of the app already keeps, where
 * planRecipeDeduction() shows every before → after.
 *
 * Duplicates are marked rather than hidden: merge skips them, and a user who
 * expected an item to arrive should be told it will not.
 */
function renderImportDetails(backup, source) {
    const panel = document.getElementById('import-details');
    const list = document.getElementById('import-details-list');
    const heading = document.getElementById('import-details-heading');
    if (!panel || !list) return;

    const label = IMPORT_WORDING[source]?.details;
    if (!label) {
        list.innerHTML = '';
        panel.classList.add('hidden');
        return;
    }
    if (heading) heading.textContent = label;

    const key = value => String(value ?? '').toLowerCase();
    const heldItems = new Set((state.inventory || []).map(item => key(item.name)));
    const heldRecipes = new Set((state.recipes || []).map(recipe => key(recipe.name)));

    // Every value here is agent-supplied or from a file. escapeHtml() on all of
    // it, including inside attributes - this is the exact path the sanitizer
    // exists to distrust, and sanitizing is not a substitute for escaping.
    const row = (name, note, skipped, sub = '', flag = '') => `
        <li class="import-detail-row">
            <span class="import-detail-main">
                <span class="import-detail-name">${escapeHtml(name)}</span>
                ${sub ? `<span class="import-detail-sub">${escapeHtml(sub)}</span>` : ''}
                ${flag ? `<span class="import-detail-flag">${escapeHtml(flag)}</span>` : ''}
            </span>
            <span class="import-detail-note${skipped ? ' import-detail-skip' : ''}">${escapeHtml(note)}</span>
        </li>`;

    const rows = [];

    (backup.inventory || []).forEach(item => {
        const skipped = heldItems.has(key(item.name));
        const amount = `${item.current} ${item.unit || 'units'}`.trim();
        rows.push(row(item.name, skipped ? 'already in your pantry — skipped' : amount, skipped));
    });

    (backup.recipes || []).forEach(recipe => {
        const skipped = heldRecipes.has(key(recipe.name));
        if (skipped) {
            rows.push(row(recipe.name, 'already in your recipes — skipped', true));
            return;
        }
        const ingredientList = recipeIngredients(recipe);
        const steps = recipeSteps(recipe).length;
        const timers = recipeSteps(recipe).filter(step => step.timerSeconds).length;
        const parts = [
            `${ingredientList.length} ingredient${ingredientList.length === 1 ? '' : 's'}`,
            `${steps} step${steps === 1 ? '' : 's'}`
        ];
        if (timers) parts.push(`${timers} timer${timers === 1 ? '' : 's'}`);
        if (recipe.servings) parts.push(`serves ${recipe.servings}`);

        /*
         * Name the ingredients rather than counting them. A count cannot show
         * what an assistant actually wrote, and this is where its mistakes
         * land: one proposed an ingredient called "cups" - it meant four cups
         * of rice and put the unit in the name. Nobody reading "8 ingredients"
         * could have caught that; anybody reading the list would.
         */
        const names = ingredientList.map(ing => ing.item).filter(Boolean);

        /*
         * And point at that specific mistake, since it is the one observed in
         * the wild and it is cheap to spot: an ingredient named after a unit is
         * a unit that ended up in the wrong field. Flagged, never rejected -
         * the cook decides, as everywhere else.
         */
        const unitWords = new Set(UNITS.map(unit => unit.toLowerCase()));
        const looksLikeUnit = names.filter(name => unitWords.has(String(name).trim().toLowerCase()));
        const flag = looksLikeUnit.length
            ? `Check "${looksLikeUnit.join('", "')}" — that is a unit, not an ingredient.`
            : '';

        rows.push(row(recipe.name, parts.join(' · '), false, names.join(', '), flag));
    });

    list.innerHTML = rows.join('');
    panel.classList.toggle('hidden', rows.length === 0);
}

// Show import modal
function showImportModal(backup, notes = [], source = 'file') {
    const modal = document.getElementById('import-modal');
    if (!modal) return;

    const wording = IMPORT_WORDING[source] || IMPORT_WORDING.file;
    document.getElementById('import-modal-title').textContent = wording.title;
    document.getElementById('import-date-label').textContent = wording.dateLabel;
    document.getElementById('import-contents-heading').textContent = wording.contents;

    // Update modal content. textContent throughout - none of this is markup.
    const exported = Date.parse(backup.exportDate);
    document.getElementById('import-backup-date').textContent =
        Number.isNaN(exported) ? 'unknown' : new Date(exported).toLocaleString();
    document.getElementById('import-inventory-count').textContent = backup.inventory?.length || 0;
    document.getElementById('import-recipes-count').textContent = backup.recipes?.length || 0;
    document.getElementById('import-allergies-count').textContent = backup.userProfile?.allergies?.length || 0;

    // Tell the user what sanitizing changed, rather than silently altering
    // their file - the counts above are post-cleanup and would otherwise be
    // quietly wrong.
    const notice = document.getElementById('import-adjustments');
    if (notice) {
        if (notes.length) {
            notice.textContent = 'Note: ' + notes.join('; ') + '.';
            notice.classList.remove('hidden');
        } else {
            notice.textContent = '';
            notice.classList.add('hidden');
        }
    }

    renderImportDetails(backup, source);

    // Sources that may only merge do not get shown a choice they cannot make.
    // confirmImport() enforces the same thing again from pendingImportSource,
    // so hiding this is the courtesy, not the control.
    const replaceOption = document.getElementById('import-replace-option');
    if (replaceOption) replaceOption.classList.toggle('hidden', !!wording.mergeOnly);
    if (wording.mergeOnly) {
        const mergeRadio = document.querySelector('input[name="import-method"][value="merge"]');
        if (mergeRadio) mergeRadio.checked = true;
    }

    modal.classList.remove('hidden');
}

// Close import modal
function closeImportModal() {
    const modal = document.getElementById('import-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    pendingImportData = null;
    pendingImportSource = 'file';
}

// Confirm import
function confirmImport() {
    if (!pendingImportData) return;

    // Read the radio, then overrule it for sources that may only ever merge.
    // The DOM is editable; the source this data arrived through is not.
    const chosen = document.querySelector('input[name="import-method"]:checked')?.value || 'merge';
    const importMethod = IMPORT_WORDING[pendingImportSource]?.mergeOnly ? 'merge' : chosen;

    if (importMethod === 'merge') {
        mergeBackupData(pendingImportData);
    } else {
        replaceAllData(pendingImportData);
    }

    closeImportModal();
}

// Merge backup data with existing data
function mergeBackupData(backup) {
    try {
        // Merge inventory (skip duplicates based on name)
        if (backup.inventory && Array.isArray(backup.inventory)) {
            const existingInventory = state.inventory;
            const existingNames = new Set(existingInventory.map(item => String(item.name).toLowerCase()));
            // An imported record carrying an id that is already in use would
            // make edit and delete act on the wrong row.
            ensureUniqueIds(backup.inventory, new Set(existingInventory.map(item => item.id)));

            let addedCount = 0;
            backup.inventory.forEach(item => {
                if (!existingNames.has(item.name.toLowerCase())) {
                    existingInventory.push(item);
                    addedCount++;
                }
            });

            state.inventory = existingInventory;
            saveInventoryToStorage();
        }

        // Merge recipes (skip duplicates based on title)
        if (backup.recipes && Array.isArray(backup.recipes)) {
            const existingRecipes = state.recipes;
            const recipeKey = recipe => String(recipe?.name ?? '').toLowerCase();
            const existingTitles = new Set(existingRecipes.map(recipeKey));
            ensureUniqueIds(backup.recipes, new Set(existingRecipes.map(recipe => recipe.id)));

            let addedCount = 0;
            backup.recipes.forEach(recipe => {
                if (!existingTitles.has(recipeKey(recipe))) {
                    existingRecipes.push(recipe);
                    addedCount++;
                }
            });

            state.recipes = existingRecipes;
            saveRecipesToStorage();
        }

        // Merge user profile (combine allergies)
        if (backup.userProfile) {
            const existingProfile = state.userProfile;

            if (backup.userProfile.allergies && Array.isArray(backup.userProfile.allergies)) {
                const existingAllergies = existingProfile.allergies || [];
                const existingAllergyNames = new Set(existingAllergies.map(a => a.name.toLowerCase()));

                backup.userProfile.allergies.forEach(allergy => {
                    if (!existingAllergyNames.has(allergy.name.toLowerCase())) {
                        existingAllergies.push(allergy);
                    }
                });

                existingProfile.allergies = existingAllergies;
            }

            // Merge dietary preferences
            if (backup.userProfile.dietaryPreferences) {
                existingProfile.dietaryPreferences = {
                    ...existingProfile.dietaryPreferences,
                    ...backup.userProfile.dietaryPreferences
                };
            }

            state.userProfile = existingProfile;
            saveUserProfile();
        }

        // Merge settings (preference is given to existing settings unless they're empty)
        if (backup.expirationSettings) {
            state.expirationSettings = {
                ...backup.expirationSettings,
                ...state.expirationSettings
            };
            saveExpirationSettings();
        }

        updateAllExpirationStatuses();
        updateView();
        showNotification('Data merged successfully!', 'success');
    } catch (error) {
        console.error('Merge failed:', error);
        showNotification('Failed to merge data: ' + error.message, 'error');
    }
}

// Replace all data with backup
function replaceAllData(backup) {
    try {
        // Replace inventory
        if (backup.inventory) {
            state.inventory = backup.inventory;
            localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(backup.inventory));
        }

        // Replace recipes
        if (backup.recipes) {
            state.recipes = backup.recipes;
            localStorage.setItem(STORAGE_KEYS.recipes, JSON.stringify(backup.recipes));
        }

        // Replace user profile
        if (backup.userProfile) {
            state.userProfile = backup.userProfile;
            localStorage.setItem(STORAGE_KEYS.userProfile, JSON.stringify(backup.userProfile));
        }

        // Replace settings
        if (backup.allergySettings) {
            localStorage.setItem(STORAGE_KEYS.allergySettings, JSON.stringify(backup.allergySettings));
        }

        if (backup.expirationSettings) {
            state.expirationSettings = backup.expirationSettings;
            localStorage.setItem(STORAGE_KEYS.expirationSettings, JSON.stringify(backup.expirationSettings));
        }

        // Freshness is derived, not stored: recompute it now rather than
        // leaving imported items looking fresh until the next page load.
        updateAllExpirationStatuses();
        updateView();
        showNotification('All data replaced successfully!', 'success');
    } catch (error) {
        console.error('Replace failed:', error);
        showNotification('Failed to replace data: ' + error.message, 'error');
    }
}

// Update settings view
function updateSettingsView() {
    syncDisplayControls();

    // Populate the "not shared with AI" list from the single source of truth
    const exclusionsList = document.getElementById('ai-export-exclusions');
    if (exclusionsList && !exclusionsList.childElementCount) {
        AI_EXPORT_EXCLUSIONS.forEach(entry => {
            const li = document.createElement('li');
            li.textContent = entry;
            exclusionsList.appendChild(li);
        });
    }

    // Update last backup date
    const lastBackupTimestamp = localStorage.getItem(STORAGE_KEYS.lastBackup);
    const lastBackupElement = document.getElementById('last-backup-date');
    if (lastBackupElement) {
        if (lastBackupTimestamp) {
            const date = new Date(parseInt(lastBackupTimestamp));
            lastBackupElement.textContent = date.toLocaleString();
        } else {
            lastBackupElement.textContent = 'Never';
        }
    }

    // Update inventory count
    const inventoryCountElement = document.getElementById('total-inventory-count');
    if (inventoryCountElement) {
        inventoryCountElement.textContent = state.inventory.length;
    }

    // Update recipes count
    const recipesCountElement = document.getElementById('total-recipes-count');
    if (recipesCountElement) {
        recipesCountElement.textContent = state.recipes.length;
    }

    // Update allergies count
    const allergiesCountElement = document.getElementById('total-allergies-count');
    if (allergiesCountElement) {
        allergiesCountElement.textContent = state.userProfile?.allergies?.length || 0;
    }

    // Check if backup reminder should be shown
    checkBackupReminder();
}

/**
 * Has the user put anything into the app yet?
 *
 * Two places care: the backup reminder has nothing to warn about until this is
 * true, and the overview swaps its AI shortcut for a "load the sample" prompt
 * while it is false.
 */
function hasAnyData() {
    return state.inventory.length > 0
        || state.recipes.length > 0
        || (state.userProfile?.allergies?.length || 0) > 0;
}

// Check if backup reminder should be shown
function checkBackupReminder() {
    const lastBackupTimestamp = localStorage.getItem(STORAGE_KEYS.lastBackup);
    const reminderElement = document.getElementById('backup-reminder');

    if (!reminderElement) return;

    const daysSinceBackup = lastBackupTimestamp
        ? Math.floor((Date.now() - parseInt(lastBackupTimestamp)) / (1000 * 60 * 60 * 24))
        : 999;

    // An empty app has nothing to lose, and "you have not backed up in 999
    // days" is a strange first thing to say to someone who has just arrived.
    // The reminder starts once there is a pantry to protect.
    if (daysSinceBackup > 30 && hasAnyData()) {
        reminderElement.classList.remove('hidden');
    } else {
        reminderElement.classList.add('hidden');
    }
}

// Dismiss backup reminder
function dismissBackupReminder() {
    const reminderElement = document.getElementById('backup-reminder');
    if (reminderElement) {
        reminderElement.classList.add('hidden');
    }
}

// Show clear data confirmation modal
function showClearDataConfirmation() {
    const modal = document.getElementById('clear-data-modal');
    if (!modal) return;

    // Update counts
    document.getElementById('clear-inventory-count').textContent = state.inventory.length;
    document.getElementById('clear-recipes-count').textContent = state.recipes.length;
    document.getElementById('clear-allergies-count').textContent = state.userProfile?.allergies?.length || 0;

    // Reset checkbox
    const checkbox = document.getElementById('confirm-clear-checkbox');
    if (checkbox) {
        checkbox.checked = false;
    }

    // Disable confirm button
    const confirmBtn = document.getElementById('confirm-clear-btn');
    if (confirmBtn) {
        confirmBtn.disabled = true;
    }

    modal.classList.remove('hidden');
}

// Close clear data modal
function closeClearDataModal() {
    const modal = document.getElementById('clear-data-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Confirm clear all data
function confirmClearData() {
    try {
        // Clear all data from localStorage
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });

        // Reset state
        state.inventory = [];
        state.recipes = [];
        state.userProfile = emptyUserProfile();
        state.expirationSettings = {
            enableAlerts: true,
            alertDaysBefore: 3,
            showExpiredItems: true
        };

        closeClearDataModal();
        updateView();
        showNotification('All data cleared successfully', 'success');
    } catch (error) {
        console.error('Failed to clear data:', error);
        showNotification('Failed to clear data: ' + error.message, 'error');
    }
}

// Simple notification function
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-4 rounded-xl shadow-lg z-50 ${
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
        'bg-blue-500'
    } text-white font-medium`;
    // Announced as a status message; without this the toast is invisible to
    // screen readers (WCAG 4.1.3).
    notification.setAttribute('role', 'status');
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.transition = 'opacity 0.3s';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================================================
// Phase 4: Allergy Profile Management Functions
// ============================================================================

function showAllergyProfileModal() {
    const modalHTML = `
        <div id="allergy-modal" data-action="allergy-modal-backdrop" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="allergy-modal-title">
            <div class="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                <div class="flex justify-between items-center mb-4">
                    <h2 id="allergy-modal-title" class="text-2xl font-bold text-gray-800">⚠️ Allergy & Safety Profile</h2>
                    <button type="button" data-action="allergy-modal-close" data-dialog-close class="text-gray-400 hover:text-gray-600" aria-label="Close allergy profile">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <!-- Quick Setup for Common Allergies -->
                <div class="mb-6">
                    <h3 class="font-semibold mb-3 text-gray-700">Quick Setup - Common Allergies</h3>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                        ${Object.entries(COMMON_ALLERGENS).map(([key, allergen]) => {
                            const isSelected = (state.userProfile?.allergies || []).some(a => a.name === key);
                            return `
                                <label class="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-blue-50 border-blue-300' : ''}">
                                    <input type="checkbox" class="common-allergen-checkbox" data-allergen="${key}" ${isSelected ? 'checked' : ''}>
                                    <span>${allergen.icon}</span>
                                    <span class="capitalize text-xs">${key.replace(/([A-Z])/g, ' $1')}</span>
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- User's Current Allergies -->
                <div class="mb-6">
                    <h3 class="font-semibold mb-3 text-gray-700">My Allergies</h3>
                    <div id="user-allergies-list" class="space-y-2 mb-3">
                        ${renderUserAllergiesList()}
                    </div>
                    <div id="severity-controls" class="bg-gray-50 p-3 rounded hidden">
                        <label for="severity-select" class="block text-sm font-medium mb-1">Severity for <span id="severity-allergen-name" class="font-bold"></span>:</label>
                        <select id="severity-select" class="w-full px-3 py-2 border rounded">
                            <option value="mild">Mild</option>
                            <option value="moderate">Moderate</option>
                            <option value="severe">Severe</option>
                            <option value="life-threatening">Life-Threatening</option>
                        </select>
                    </div>
                </div>

                <!-- Alert Preferences -->
                <div class="mb-6">
                    <h3 class="font-semibold mb-3 text-gray-700">Safety Preferences</h3>
                    <div class="space-y-3">
                        <label class="flex items-center justify-between">
                            <span class="text-sm">Show allergy warnings on recipes</span>
                            <input type="checkbox" id="show-warnings" class="rounded" ${state.userProfile.alertPreferences?.showWarnings ? 'checked' : ''}>
                        </label>
                        <label class="flex items-center justify-between">
                            <span class="text-sm">Block life-threatening recipes</span>
                            <input type="checkbox" id="block-dangerous" class="rounded" ${state.userProfile.alertPreferences?.blockDangerous ? 'checked' : ''}>
                        </label>
                    </div>
                </div>

                <div class="flex gap-2">
                    <button type="button" data-action="allergy-profile-save" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                        Save Profile
                    </button>
                    <button type="button" data-action="allergy-modal-close" class="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    setupAllergyModalHandlers();
}

function renderUserAllergiesList() {
    const allergies = state.userProfile?.allergies || [];
    if (allergies.length === 0) {
        return '<p class="text-sm text-gray-500 italic">No allergies added yet. Select from common allergies above.</p>';
    }

    return allergies.map(allergy => {
        const allergenData = COMMON_ALLERGENS[allergy.name] || {};
        const current = ALLERGY_SEVERITIES.includes(allergy.severity) ? allergy.severity : 'moderate';
        const options = ALLERGY_SEVERITIES.map(level => `
            <option value="${level}" ${level === current ? 'selected' : ''}>${SEVERITY_LABELS[level]}</option>
        `).join('');

        return `
            <div class="flex items-center justify-between gap-3 p-2 bg-gray-50 rounded">
                <div class="flex items-center gap-2 flex-1">
                    <span>${allergenData.icon || '⚠️'}</span>
                    <span class="font-medium capitalize">${escapeHtml(String(allergy.name).replace(/([A-Z])/g, ' $1'))}</span>
                </div>
                <label class="sr-only" for="severity-${escapeHtml(allergy.name)}">
                    Reaction severity for ${escapeHtml(allergy.name)}
                </label>
                <select id="severity-${escapeHtml(allergy.name)}"
                        class="severity-select ${SEVERITY_CLASSES[current]}"
                        data-change-action="allergy-severity"
                        data-allergen="${escapeHtml(allergy.name)}">
                    ${options}
                </select>
                <button type="button" data-action="allergy-remove" data-allergen="${escapeHtml(allergy.name)}" class="text-red-600 hover:bg-red-50 p-1 rounded" aria-label="Remove ${escapeHtml(allergy.name)}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;
    }).join('');
}

/**
 * Change how badly an allergen affects this person.
 *
 * Severity is not cosmetic: getSeverityLevel() ranks it, renderRecipeAllergyStatus()
 * turns 'life-threatening' into a blocking warning rather than an advisory one,
 * and the blockDangerous preference keys off it. Until now every allergy was
 * stuck on the 'moderate' default that addAllergy() assigns.
 */
function setAllergySeverity(allergenName, severity) {
    if (!ALLERGY_SEVERITIES.includes(severity)) return;

    const allergy = (state.userProfile?.allergies || [])
        .find(entry => entry.name === allergenName);
    if (!allergy) return;

    allergy.severity = severity;
    saveUserProfile();

    // Recolour the control in place; re-rendering the list would close the
    // select the user just used.
    const control = document.querySelector(
        `[data-change-action="allergy-severity"][data-allergen="${CSS.escape(allergenName)}"]`
    );
    if (control) {
        control.className = 'severity-select ' + SEVERITY_CLASSES[severity];
    }

    // Recipe warnings depend on this, so the views behind the modal are stale.
    updateView();
}

function setupAllergyModalHandlers() {
    // Handle checkbox changes
    document.querySelectorAll('.common-allergen-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const allergenName = e.target.dataset.allergen;
            if (e.target.checked) {
                addAllergy(allergenName);
            } else {
                removeAllergy(allergenName);
            }
        });
    });
}

function addAllergy(allergenName) {
    if (!state.userProfile.allergies) {
        state.userProfile.allergies = [];
    }

    // Check if already exists
    const exists = state.userProfile.allergies.find(a => a.name === allergenName);
    if (!exists) {
        state.userProfile.allergies.push({
            name: allergenName,
            severity: 'moderate',
            dateAdded: new Date().toISOString().split('T')[0]
        });

        // Update the display
        updateAllergyListDisplay();
    }
}

function removeAllergy(allergenName) {
    if (state.userProfile.allergies) {
        state.userProfile.allergies = state.userProfile.allergies.filter(a => a.name !== allergenName);
        updateAllergyListDisplay();

        // Uncheck the checkbox
        const checkbox = document.querySelector(`.common-allergen-checkbox[data-allergen="${allergenName}"]`);
        if (checkbox) checkbox.checked = false;
    }
}

function updateAllergyListDisplay() {
    const listContainer = document.getElementById('user-allergies-list');
    if (listContainer) {
        listContainer.innerHTML = renderUserAllergiesList();
    }
}

function saveAllergyProfile() {
    // Update preferences
    const showWarnings = document.getElementById('show-warnings')?.checked;
    const blockDangerous = document.getElementById('block-dangerous')?.checked;

    // The profile can arrive from an imported file, so never assume the nested
    // object is there.
    if (!isPlainObject(state.userProfile.alertPreferences)) {
        state.userProfile.alertPreferences = { ...DEFAULT_ALERT_PREFERENCES };
    }
    state.userProfile.alertPreferences.showWarnings = showWarnings === true;
    state.userProfile.alertPreferences.blockDangerous = blockDangerous === true;

    // Save to localStorage
    saveUserProfile();

    // Close modal
    closeAllergyModal();

    // Refresh the view to show new allergy warnings
    updateView();
}

function closeAllergyModal() {
    const modal = document.getElementById('allergy-modal');
    if (modal) {
        modal.remove();
    }
}


// ---------------------------------------------------------------------------
// Event delegation
//
// The app has no inline event handlers, which is what allows a strict
// Content-Security-Policy (script-src 'self', no unsafe-inline). Interactive
// elements declare data-action, and this single document-level listener
// dispatches them. Because handlers are looked up in a fixed table, imported
// data can never introduce a new one.
// ---------------------------------------------------------------------------
const ACTIONS = {
    // Inventory
    'inventory-edit': el => showInventoryForm(resolveId(el.dataset.id)),
    'inventory-delete': el => deleteInventoryItem(resolveId(el.dataset.id)),
    'inventory-adjust': el => updateInventoryAmount(resolveId(el.dataset.id), Number(el.dataset.amount)),
    'quick-entry': () => showSimpleItemEntry(),

    // Recipes
    'recipe-view': el => {
        const recipe = state.recipes.find(r => r.id === resolveId(el.dataset.id));
        if (recipe) showRecipeModal(recipe);
    },
    'recipe-edit': el => showRecipeForm(resolveId(el.dataset.id)),
    'recipe-delete': el => deleteRecipe(resolveId(el.dataset.id)),

    // Recipe form rows
    'remove-row': el => {
        let target = el;
        const levels = Number(el.dataset.levels) || 1;
        for (let i = 0; i < levels && target; i++) target = target.parentElement;
        if (target) target.remove();
    },

    // Allergy profile
    'allergy-profile': () => showAllergyProfileModal(),
    'allergy-profile-save': () => saveAllergyProfile(),
    'allergy-modal-close': () => closeAllergyModal(),
    'allergy-modal-backdrop': (el, event) => { if (event.target === el) closeAllergyModal(); },
    'allergy-remove': el => removeAllergy(el.dataset.allergen),

    // Exports
    'export-full-backup': () => exportFullBackup(),
    'export-inventory': () => exportInventory(),
    'export-allergy-profile': () => exportAllergyProfile(),
    'export-recipes': () => exportRecipesToJSON(),
    'ai-copy': () => copyAIExport(),
    'ai-download': () => downloadAIExport(),

    // Import
    'import-pick': () => document.getElementById('import-file-input')?.click(),
    'import-confirm': () => confirmImport(),
    'import-close': () => closeImportModal(),
    'sample-data-load': () => loadSampleData(),

    // Backup reminder / destructive actions
    'backup-reminder-export': () => { exportFullBackup(); dismissBackupReminder(); },
    'clear-data-confirm': () => showClearDataConfirmation(),
    'clear-data-execute': () => confirmClearData(),
    'clear-data-close': () => closeClearDataModal(),

    // Quick entry modal
    'simple-entry-process': () => processSimpleEntry(),
    'simple-entry-close': () => closeSimpleEntryModal(),

    // Timers
    'timer-preset': el => startTimer(Number(el.dataset.seconds)),
    'timer-start-custom': () => startCustomTimer(),
    'timer-pause': el => pauseTimer(el.dataset.id),
    'timer-resume': el => resumeTimer(el.dataset.id),
    'timer-add': el => addTimerTime(el.dataset.id, Number(el.dataset.seconds)),
    'timer-reset': el => resetTimer(el.dataset.id),
    'timer-dismiss': el => dismissTimer(el.dataset.id),
    'timer-clear-finished': () => clearFinishedTimers(),
    'timer-rename': el => beginRenameTimer(el.dataset.id),

    // Overview: copy rather than download. Files are a Settings concern.
    'copy-shopping': () => copyTextToClipboard(buildShoppingListText(), 'Shopping list copied'),
    'copy-conflicts': () => copyTextToClipboard(buildConflictsText(), 'Conflicting ingredients copied'),

    'inventory-jump': el => jumpToLetter(elements.inventory.list, el.dataset.letter),
    'recipe-jump': el => jumpToLetter(elements.recipes.grid, el.dataset.letter),

    // Cooking
    'recipe-complete': () => showRecipeCompleteModal(),
    'recipe-complete-confirm': () => confirmRecipeComplete(),
    'recipe-complete-close': () => closeRecipeCompleteModal(),
    'timer-from-step': el => startTimer(
        Number(el.dataset.seconds),
        el.dataset.label,
        el.dataset.source
    )
};

// Handlers for `change`, keyed by data-change-action. See the note in
// initializeActionDelegation() for why these cannot live in ACTIONS.
const CHANGE_ACTIONS = {
    'clamp-number': el => clampNumberField(el),
    'inventory-sort': el => handleInventorySort({ target: el }),
    'cook-check': el => toggleCookCheck(el.dataset.index, el.checked),
    'remember-unit': el => rememberUnit(el.value),
    'toggle-expiration': el => toggleExpirationFields(el.checked),
    'allergy-severity': el => setAllergySeverity(el.dataset.allergen, el.value),
    'text-scale': el => setTextScale(el.value),
    'theme': el => setTheme(el.value),
    'agent-tools': el => window.prepwiseAgent?.setEnabled(el.checked)
};

/**
 * The unit to start a fresh row with.
 *
 * Always defaulting to "oz" meant someone who works in grams re-picked it for
 * every single item. The last unit chosen is remembered per device instead, so
 * the second entry onwards is usually already right.
 */
function defaultUnit() {
    const remembered = window.prepwiseDisplay?.readUnit?.();
    return UNITS.includes(remembered) ? remembered : 'units';
}

function rememberUnit(unit) {
    if (UNITS.includes(unit)) window.prepwiseDisplay?.saveUnit?.(unit);
}

/**
 * Hold a number field to its declared range, and say so.
 *
 * `min`/`max` on a number input restrict the spinner but not typing, so "999"
 * in a minutes box is accepted by the browser and silently corrected later.
 * Every layer downstream already clamps, so nothing invalid ever reached the
 * timer logic - but the field went on showing a figure the app was not using,
 * which is its own kind of wrong. This corrects the field in place, on change
 * rather than per keystroke, and tells the user what happened.
 */
function clampNumberField(input) {
    const raw = String(input.value).trim();
    if (raw === '') return;

    const min = Number.isFinite(Number(input.min)) ? Number(input.min) : 0;
    const max = Number.isFinite(Number(input.max)) ? Number(input.max) : Infinity;
    const parsed = Number(raw);
    const clamped = Math.min(Math.max(Number.isFinite(parsed) ? Math.round(parsed) : min, min), max);

    if (String(clamped) === raw) return;

    input.value = String(clamped);
    input.classList.add('is-corrected');
    setTimeout(() => input.classList.remove('is-corrected'), 1400);

    const unit = input.dataset.unit || 'That value';
    showNotification(`${unit} must be between ${min} and ${max} \u2014 set to ${clamped}`, 'error');
}

/**
 * Apply and remember a text size.
 *
 * The work happens in display.js, which owns the storage key because it has to
 * read it in <head> before this file exists. If that script somehow did not
 * load, the control degrades to doing nothing rather than throwing.
 */
function setTextScale(scale) {
    if (!window.prepwiseDisplay) return;
    window.prepwiseDisplay.save(scale);
}

function setTheme(theme) {
    if (!window.prepwiseDisplay) return;
    window.prepwiseDisplay.saveTheme(theme);
}

/** Point the Settings radios at whatever is actually in force. */
function syncDisplayControls() {
    if (!window.prepwiseDisplay) return;

    const check = (name, value) => {
        const option = document.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`);
        if (option) option.checked = true;
    };

    check('text-scale', window.prepwiseDisplay.read());
    // The stored preference, not the resolved palette: "system" has to stay
    // selected, or a dark-at-night device would silently move the radio to Dark.
    check('theme', window.prepwiseDisplay.readTheme());
}

// Inventory and recipe ids are numbers created with Date.now(), but an imported
// file could carry a string. Compare loosely by normalising here.
function resolveId(raw) {
    const asNumber = Number(raw);
    return Number.isFinite(asNumber) && String(asNumber) === String(raw) ? asNumber : raw;
}

// ---------------------------------------------------------------------------
// Dialog accessibility
//
// Every modal in the app is a [role="dialog"] overlay, opened two different
// ways: the static ones in index.html toggle a .hidden class, the dynamic ones
// (allergy profile, quick entry, freshness alert) are inserted and removed
// from the DOM. A MutationObserver watches for both, so no open/close call
// site needs to know about any of this. What it provides, per WCAG 2.1.1 and
// 2.4.3: focus moves into a dialog when it opens, Tab cycles inside it rather
// than escaping to the page underneath, Escape closes it through the dialog's
// own close control (marked data-dialog-close, so existing cleanup logic
// runs), and focus returns to wherever it was when the dialog closed.
// ---------------------------------------------------------------------------

const openDialogStack = [];

function dialogIsVisible(dialog) {
    return dialog.isConnected && !dialog.classList.contains('hidden');
}

function dialogFocusables(dialog) {
    const selector = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
        'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(dialog.querySelectorAll(selector))
        .filter(el => el.offsetParent !== null || el === document.activeElement);
}

function dialogOpened(dialog) {
    if (openDialogStack.some(entry => entry.dialog === dialog)) return;
    const opener = document.activeElement !== document.body ? document.activeElement : null;
    openDialogStack.push({ dialog, opener });
    // Let the current render settle before moving focus.
    setTimeout(() => {
        if (!dialogIsVisible(dialog) || dialog.contains(document.activeElement)) return;
        const target = dialog.querySelector('[autofocus]') || dialogFocusables(dialog)[0];
        if (target) target.focus();
    }, 0);
}

function dialogClosed(dialog) {
    const index = openDialogStack.findIndex(entry => entry.dialog === dialog);
    if (index === -1) return;
    const { opener } = openDialogStack.splice(index, 1)[0];
    if (opener && opener.isConnected && typeof opener.focus === 'function') {
        opener.focus();
    }
}

function topOpenDialog() {
    for (let i = openDialogStack.length - 1; i >= 0; i--) {
        if (dialogIsVisible(openDialogStack[i].dialog)) return openDialogStack[i].dialog;
        openDialogStack.splice(i, 1);
    }
    return null;
}

function initializeDialogAccessibility() {
    document.addEventListener('keydown', event => {
        const dialog = topOpenDialog();
        if (!dialog) return;

        if (event.key === 'Escape') {
            const closer = dialog.querySelector('[data-dialog-close]');
            if (closer) {
                event.preventDefault();
                closer.click();
            }
            return;
        }

        if (event.key === 'Tab') {
            const focusables = dialogFocusables(dialog);
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;

            if (!dialog.contains(active)) {
                event.preventDefault();
                first.focus();
            } else if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    /*
     * Deliberately not one subtree-wide observer. Watching all of <body> with
     * subtree:true would wake this code on every mutation of every render -
     * each inventory row, each recipe card - to look for dialogs that are only
     * ever in two places. Instead:
     *
     *   - the static dialogs in index.html open by toggling .hidden on
     *     themselves, so each is observed for its own class attribute;
     *   - the built-at-runtime ones (allergy profile, quick entry, freshness
     *     alert) are appended straight to <body> and removed again, so a
     *     childList observer on <body> alone catches them.
     */
    const watchVisibility = dialog => {
        new MutationObserver(() => {
            if (dialogIsVisible(dialog)) dialogOpened(dialog);
            else dialogClosed(dialog);
        }).observe(dialog, { attributes: true, attributeFilter: ['class'] });
    };

    document.querySelectorAll('[role="dialog"]').forEach(watchVisibility);

    new MutationObserver(mutations => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType !== Node.ELEMENT_NODE) return;
                if (!node.matches('[role="dialog"]')) return;
                watchVisibility(node);
                if (dialogIsVisible(node)) dialogOpened(node);
            });
            mutation.removedNodes.forEach(node => {
                if (node.nodeType !== Node.ELEMENT_NODE) return;
                if (node.matches('[role="dialog"]')) dialogClosed(node);
            });
        }
    }).observe(document.body, { childList: true });
}

function initializeActionDelegation() {
    document.addEventListener('click', event => {
        const trigger = event.target.closest('[data-action]');
        if (!trigger) return;

        const handler = ACTIONS[trigger.dataset.action];
        if (!handler) return;

        handler(trigger, event);
    });

    /*
     * Selects and checkboxes never produce a click that carries their new value,
     * so they need their own table. Without this the only way to react to one
     * was an inline `onchange`, which script-src 'self' silently kills - that is
     * exactly how the "Track Expiration Date" checkbox came to do nothing.
     */
    document.addEventListener('change', event => {
        const control = event.target.closest('[data-change-action]');
        if (!control) return;

        const handler = CHANGE_ACTIONS[control.dataset.changeAction];
        if (!handler) return;

        handler(control, event);
    });
}

// Exposed for console/debug use; the UI dispatches through ACTIONS above.
window.showInventoryForm = showInventoryForm;
window.deleteInventoryItem = deleteInventoryItem;
window.updateInventoryAmount = updateInventoryAmount;
window.showRecipeForm = showRecipeForm;
window.deleteRecipe = deleteRecipe;
window.showRecipeModal = showRecipeModal;
window.exportRecipesToJSON = exportRecipesToJSON;
window.exportShoppingList = exportShoppingList;
window.toggleExpirationFields = toggleExpirationFields;
window.showAllergyProfileModal = showAllergyProfileModal;
window.closeAllergyModal = closeAllergyModal;
window.saveAllergyProfile = saveAllergyProfile;
window.addAllergy = addAllergy;
window.removeAllergy = removeAllergy;

// Data export/import functions
window.exportFullBackup = exportFullBackup;
window.exportInventory = exportInventory;
window.exportAllergyProfile = exportAllergyProfile;
window.handleImportFile = handleImportFile;
window.showImportModal = showImportModal;
window.closeImportModal = closeImportModal;
window.confirmImport = confirmImport;
window.showClearDataConfirmation = showClearDataConfirmation;
window.closeClearDataModal = closeClearDataModal;
window.confirmClearData = confirmClearData;
window.dismissBackupReminder = dismissBackupReminder;