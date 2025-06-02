/**
 * DressForPleasure Website - Main JavaScript
 * Complete functionality for the e-commerce website
 */

// =================== CONFIGURATION ===================
const CONFIG = {
  // API Endpoints
  api: {
    airtable: {
      baseUrl: 'https://api.airtable.com/v0',
      baseId: 'your_airtable_base_id', // Configure in environment
      apiKey: 'your_airtable_api_key', // Configure in environment
      tables: {
        products: 'Products',
        customers: 'Customers',
        orders: 'Orders',
        orderItems: 'Order_Items'
      }
    },
    n8n: {
      baseUrl: 'https://your-n8n-instance.com/webhook',
      endpoints: {
        contact: '/contact-form',
        newsletter: '/newsletter-signup',
        productSearch: '/product-search',
        aiStylist: '/ai-stylist'
      }
    },
    telegram: {
      botUsername: 'DressForPleasureBot', // Configure your bot username
      chatUrl: 'https://t.me/DressForPleasureBot'
    }
  },
  
  // Site Settings
  site: {
    name: 'DressForPleasure',
    email: 'style@dressforpleasure.com',
    phone: '+49 (0) 30 12345678',
    address: 'Unter den Linden 12, 10117 Berlin'
  },
  
  // UI Settings
  ui: {
    animationDuration: 300,
    loadingDelay: 2000,
    notificationDuration: 5000,
    productsPerPage: 9
  }
};

// =================== STATE MANAGEMENT ===================
const state = {
  // Products
  products: [],
  filteredProducts: [],
  currentCategory: 'all',
  currentPage: 1,
  searchQuery: '',
  
  // Cart
  cart: {
    items: [],
    total: 0,
    count: 0
  },
  
  // UI
  ui: {
    loading: false,
    mobileMenuOpen: false,
    currentModal: null,
    notifications: []
  },
  
  // User
  user: {
    isLoggedIn: false,
    preferences: {}
  }
};

// =================== UTILITY FUNCTIONS ===================
const utils = {
  // DOM manipulation
  $(selector) {
    return document.querySelector(selector);
  },
  
  $$(selector) {
    return document.querySelectorAll(selector);
  },
  
  // API calls
  async apiCall(url, options = {}) {
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options
    };
    
    try {
      const response = await fetch(url, defaultOptions);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  },
  
  // Airtable API
  async airtableCall(table, recordId = '', method = 'GET', data = null) {
    const url = recordId 
      ? `${CONFIG.api.airtable.baseUrl}/${CONFIG.api.airtable.baseId}/${table}/${recordId}`
      : `${CONFIG.api.airtable.baseUrl}/${CONFIG.api.airtable.baseId}/${table}`;
    
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${CONFIG.api.airtable.apiKey}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data && (method === 'POST' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }
    
    return await this.apiCall(url, options);
  },
  
  // n8n webhook calls
  async n8nCall(endpoint, data) {
    const url = `${CONFIG.api.n8n.baseUrl}${endpoint}`;
    return await this.apiCall(url, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  
  // Format currency
  formatCurrency(amount) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  },
  
  // Format date
  formatDate(date) {
    return new Date(date).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },
  
  // Debounce function
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  // Scroll to element
  scrollTo(element, offset = 0) {
    const targetPosition = element.offsetTop - offset;
    window.scrollTo({
      top: targetPosition,
      behavior: 'smooth'
    });
  },
  
  // Local storage helpers
  storage: {
    get(key) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch (error) {
        console.error('Storage get error:', error);
        return null;
      }
    },
    
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error('Storage set error:', error);
        return false;
      }
    },
    
    remove(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error('Storage remove error:', error);
        return false;
      }
    }
  }
};

// =================== INITIALIZATION ===================
class DressForPleasureApp {
  constructor() {
    this.init();
  }
  
  async init() {
    // Show loading screen
    this.showLoadingScreen();
    
    // Initialize components
    await this.initializeComponents();
    
    // Load initial data
    await this.loadInitialData();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Hide loading screen
    setTimeout(() => {
      this.hideLoadingScreen();
    }, CONFIG.ui.loadingDelay);
    
    console.log('DressForPleasure app initialized successfully');
  }
  
  async initializeComponents() {
    // Initialize navigation
    this.navigation = new Navigation();
    
    // Initialize product manager
    this.productManager = new ProductManager();
    
    // Initialize cart
    this.cart = new Cart();
    
    // Initialize search
    this.search = new Search();
    
    // Initialize forms
    this.forms = new Forms();
    
    // Initialize animations
    this.animations = new Animations();
    
    // Initialize notifications
    this.notifications = new Notifications();
    
    // Initialize telegram integration
    this.telegram = new TelegramIntegration();
  }
  
  async loadInitialData() {
    try {
      // Load products
      await this.productManager.loadProducts();
      
      // Load cart from storage
      this.cart.loadFromStorage();
      
      // Load user preferences
      this.loadUserPreferences();
      
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.notifications.show('Fehler beim Laden der Daten', 'error');
    }
  }
  
  setupEventListeners() {
    // Window events
    window.addEventListener('scroll', this.handleScroll.bind(this));
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // Form submissions
    this.handleFormSubmissions();
    
    // Modal events
    this.handleModalEvents();
    
    // Product interactions
    this.handleProductInteractions();
  }
  
  handleScroll() {
    const navbar = utils.$('#navbar');
    if (window.scrollY > 100) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    
    // Animate elements on scroll
    this.animations.animateOnScroll();
  }
  
  handleResize() {
    // Handle responsive behaviors
    if (window.innerWidth > 768) {
      const mobileMenu = utils.$('#nav-menu');
      const mobileBtn = utils.$('#mobile-menu-btn');
      mobileMenu.classList.remove('active');
      mobileBtn.classList.remove('active');
      state.ui.mobileMenuOpen = false;
    }
  }
  
  handleFormSubmissions() {
    // Newsletter form
    const newsletterForm = utils.$('#newsletter-form');
    if (newsletterForm) {
      newsletterForm.addEventListener('submit', this.forms.handleNewsletterSubmit.bind(this.forms));
    }
    
    // Contact form
    const contactForm = utils.$('#contact-form');
    if (contactForm) {
      contactForm.addEventListener('submit', this.forms.handleContactSubmit.bind(this.forms));
    }
  }
  
  handleModalEvents() {
    // Modal close events
    utils.$$('.modal-close').forEach(closeBtn => {
      closeBtn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        this.closeModal(modal);
      });
    });
    
    // Click outside modal to close
    utils.$$('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal);
        }
      });
    });
  }
  
  handleProductInteractions() {
    // Category filter buttons
    utils.$$('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const category = e.target.dataset.category;
        this.productManager.filterByCategory(category);
      });
    });
    
    // Load more products
    const loadMoreBtn = utils.$('#load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        this.productManager.loadMoreProducts();
      });
    }
  }
  
  showLoadingScreen() {
    const loadingScreen = utils.$('#loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.remove('hidden');
    }
  }
  
  hideLoadingScreen() {
    const loadingScreen = utils.$('#loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 500);
    }
  }
  
  openModal(modalId) {
    const modal = utils.$(`#${modalId}`);
    if (modal) {
      modal.classList.add('show');
      state.ui.currentModal = modalId;
      document.body.style.overflow = 'hidden';
    }
  }
  
  closeModal(modal) {
    if (typeof modal === 'string') {
      modal = utils.$(`#${modal}`);
    }
    if (modal) {
      modal.classList.remove('show');
      state.ui.currentModal = null;
      document.body.style.overflow = '';
    }
  }
  
  loadUserPreferences() {
    const preferences = utils.storage.get('user_preferences');
    if (preferences) {
      state.user.preferences = preferences;
    }
  }
  
  saveUserPreferences() {
    utils.storage.set('user_preferences', state.user.preferences);
  }
}

// =================== NAVIGATION CLASS ===================
class Navigation {
  constructor() {
    this.setupNavigation();
  }
  
  setupNavigation() {
    // Mobile menu toggle
    const mobileMenuBtn = utils.$('#mobile-menu-btn');
    const navMenu = utils.$('#nav-menu');
    
    if (mobileMenuBtn && navMenu) {
      mobileMenuBtn.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        mobileMenuBtn.classList.toggle('active');
        state.ui.mobileMenuOpen = !state.ui.mobileMenuOpen;
      });
    }
    
    // Smooth scrolling for navigation links
    utils.$$('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        const targetElement = utils.$(`#${targetId}`);
        
        if (targetElement) {
          utils.scrollTo(targetElement, 100);
          
          // Update active nav link
          this.updateActiveNavLink(link);
          
          // Close mobile menu if open
          if (state.ui.mobileMenuOpen) {
            navMenu.classList.remove('active');
            mobileMenuBtn.classList.remove('active');
            state.ui.mobileMenuOpen = false;
          }
        }
      });
    });
    
    // Search button
    const searchBtn = utils.$('#search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        app.openModal('search-modal');
      });
    }
    
    // Cart button
    const cartBtn = utils.$('#cart-btn');
    if (cartBtn) {
      cartBtn.addEventListener('click', () => {
        app.openModal('cart-modal');
      });
    }
    
    // Telegram button
    const telegramBtn = utils.$('#telegram-btn');
    if (telegramBtn) {
      telegramBtn.addEventListener('click', () => {
        app.telegram.showWidget();
      });
    }
  }
  
  updateActiveNavLink(activeLink) {
    utils.$$('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    activeLink.classList.add('active');
  }
}

// =================== PRODUCT MANAGER CLASS ===================
class ProductManager {
  constructor() {
    this.currentPage = 1;
    this.productsPerPage = CONFIG.ui.productsPerPage;
  }
  
  async loadProducts() {
    try {
      state.ui.loading = true;
      
      // Simulate API call (replace with actual Airtable call)
      const response = await this.simulateProductLoad();
      
      state.products = response.products || [];
      state.filteredProducts = [...state.products];
      
      this.renderProducts();
      
    } catch (error) {
      console.error('Error loading products:', error);
      app.notifications.show('Fehler beim Laden der Produkte', 'error');
    } finally {
      state.ui.loading = false;
    }
  }
  
  async simulateProductLoad() {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Sample product data
    return {
      products: [
        {
          id: 'prod1',
          name: 'Elegante Seidenbluse Marianne',
          category: 'oberteile',
          price: 89.99,
          image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400&h=500&fit=crop',
          description: 'Zeitlose Eleganz trifft auf modernen Komfort. Diese exquisite Seidenbluse in Champagner-Ton ist das perfekte Stück für besondere Anlässe.',
          featured: true,
          inStock: true
        },
        {
          id: 'prod2',
          name: 'Designer Handtasche Milano',
          category: 'handtaschen',
          price: 159.99,
          image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=500&fit=crop',
          description: 'Luxuriöse Handtasche aus italienischem Leder in klassischem Cognac. Mit goldenen Beschlägen und abnehmbarem Schulterriemen.',
          featured: true,
          inStock: true
        },
        {
          id: 'prod3',
          name: 'Cashmere Pullover Sophie',
          category: 'oberteile',
          price: 129.99,
          image: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&h=500&fit=crop',
          description: 'Kuschelig weicher Cashmere-Pullover in zartem Rosé. Perfect für kalte Tage, wenn Komfort auf Stil trifft.',
          featured: false,
          inStock: true
        },
        {
          id: 'prod4',
          name: 'Vintage Perlenkette Classic',
          category: 'schmuck',
          price: 79.99,
          image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&h=500&fit=crop',
          description: 'Klassische Perlenkette mit echten Süßwasserperlen. Ein zeitloses Schmuckstück, das jedes Outfit veredelt.',
          featured: true,
          inStock: true
        },
        {
          id: 'prod5',
          name: 'Sommer Maxikleid Luna',
          category: 'kleider',
          price: 94.99,
          image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&h=500&fit=crop',
          description: 'Fließendes Maxikleid in floraler Blütenprint. Perfect für Sommerfeste und Urlaubsmomente.',
          featured: true,
          inStock: true
        },
        {
          id: 'prod6',
          name: 'Seide Schal Parisian Chic',
          category: 'accessoires',
          price: 69.99,
          image: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=400&h=500&fit=crop',
          description: 'Luxuriöser Seidenschal mit elegantem Paisley-Muster. Handgerollt und in traditioneller Färbetechnik hergestellt.',
          featured: false,
          inStock: true
        }
      ]
    };
  }
  
  filterByCategory(category) {
    state.currentCategory = category;
    
    // Update filter buttons
    utils.$$('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.category === category) {
        btn.classList.add('active');
      }
    });
    
    // Filter products
    if (category === 'all') {
      state.filteredProducts = [...state.products];
    } else {
      state.filteredProducts = state.products.filter(product => 
        product.category === category
      );
    }
    
    // Reset pagination
    this.currentPage = 1;
    
    // Re-render products
    this.renderProducts();
  }
  
  renderProducts() {
    const productsGrid = utils.$('#products-grid');
    if (!productsGrid) return;
    
    // Clear loading placeholder
    productsGrid.innerHTML = '';
    
    if (state.filteredProducts.length === 0) {
      productsGrid.innerHTML = `
        <div class="no-products">
          <div class="no-products-icon">🔍</div>
          <h3>Keine Produkte gefunden</h3>
          <p>Versuchen Sie eine andere Kategorie oder Suche.</p>
        </div>
      `;
      return;
    }
    
    // Calculate products to show
    const startIndex = 0;
    const endIndex = this.currentPage * this.productsPerPage;
    const productsToShow = state.filteredProducts.slice(startIndex, endIndex);
    
    // Render products
    productsToShow.forEach(product => {
      const productCard = this.createProductCard(product);
      productsGrid.appendChild(productCard);
    });
    
    // Show/hide load more button
    const loadMoreBtn = utils.$('#load-more-btn');
    if (loadMoreBtn) {
      if (endIndex >= state.filteredProducts.length) {
        loadMoreBtn.style.display = 'none';
      } else {
        loadMoreBtn.style.display = 'inline-flex';
      }
    }
  }
  
  createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.productId = product.id;
    
    card.innerHTML = `
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}" loading="lazy">
        ${product.featured ? '<div class="product-badge">Featured</div>' : ''}
      </div>
      <div class="product-info">
        <div class="product-category">${this.getCategoryDisplayName(product.category)}</div>
        <h3 class="product-name">${product.name}</h3>
        <div class="product-price">${utils.formatCurrency(product.price)}</div>
        <p class="product-description">${product.description}</p>
        <div class="product-actions">
          <button class="btn btn-primary add-to-cart-btn" data-product-id="${product.id}">
            In den Warenkorb
          </button>
          <button class="btn btn-outline view-product-btn" data-product-id="${product.id}">
            Details
          </button>
        </div>
      </div>
    `;
    
    // Add event listeners
    const addToCartBtn = card.querySelector('.add-to-cart-btn');
    addToCartBtn.addEventListener('click', () => {
      app.cart.addItem(product);
    });
    
    const viewProductBtn = card.querySelector('.view-product-btn');
    viewProductBtn.addEventListener('click', () => {
      this.showProductDetails(product);
    });
    
    return card;
  }
  
  getCategoryDisplayName(category) {
    const categoryNames = {
      'oberteile': 'Oberteile',
      'kleider': 'Kleider',
      'handtaschen': 'Handtaschen',
      'schmuck': 'Schmuck',
      'accessoires': 'Accessoires'
    };
    
    return categoryNames[category] || category;
  }
  
  showProductDetails(product) {
    // Create product detail modal content
    const modalContent = `
      <div class="product-detail-modal">
        <div class="product-detail-image">
          <img src="${product.image}" alt="${product.name}">
        </div>
        <div class="product-detail-info">
          <div class="product-category">${this.getCategoryDisplayName(product.category)}</div>
          <h2>${product.name}</h2>
          <div class="product-price">${utils.formatCurrency(product.price)}</div>
          <p class="product-description">${product.description}</p>
          <div class="product-features">
            <div class="feature">✅ Kostenloser Versand ab 50€</div>
            <div class="feature">🔄 30 Tage Rückgaberecht</div>
            <div class="feature">💎 Premium-Qualität</div>
          </div>
          <div class="product-actions">
            <button class="btn btn-primary btn-full add-to-cart-btn" data-product-id="${product.id}">
              In den Warenkorb - ${utils.formatCurrency(product.price)}
            </button>
            <button class="btn btn-secondary">
              💬 Styling-Beratung
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Show in modal (implement modal system)
    app.notifications.show(`Produktdetails für ${product.name}`, 'info');
  }
  
  loadMoreProducts() {
    this.currentPage++;
    this.renderProducts();
  }
}

// =================== CART CLASS ===================
class Cart {
  constructor() {
    this.items = [];
    this.total = 0;
    this.count = 0;
    this.loadFromStorage();
  }
  
  addItem(product, quantity = 1) {
    const existingItem = this.items.find(item => item.id === product.id);
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      this.items.push({
        ...product,
        quantity
      });
    }
    
    this.updateTotals();
    this.updateUI();
    this.saveToStorage();
    
    app.notifications.show(`${product.name} wurde zum Warenkorb hinzugefügt`, 'success');
  }
  
  removeItem(productId) {
    this.items = this.items.filter(item => item.id !== productId);
    this.updateTotals();
    this.updateUI();
    this.saveToStorage();
  }
  
  updateQuantity(productId, quantity) {
    const item = this.items.find(item => item.id === productId);
    if (item) {
      if (quantity <= 0) {
        this.removeItem(productId);
      } else {
        item.quantity = quantity;
        this.updateTotals();
        this.updateUI();
        this.saveToStorage();
      }
    }
  }
  
  updateTotals() {
    this.count = this.items.reduce((total, item) => total + item.quantity, 0);
    this.total = this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }
  
  updateUI() {
    // Update cart count in navigation
    const cartCount = utils.$('.cart-count');
    if (cartCount) {
      cartCount.textContent = this.count;
      cartCount.style.display = this.count > 0 ? 'inline' : 'none';
    }
    
    // Update cart modal content
    this.renderCartModal();
  }
  
  renderCartModal() {
    const cartContent = utils.$('#cart-content');
    if (!cartContent) return;
    
    if (this.items.length === 0) {
      cartContent.innerHTML = `
        <div class="empty-cart">
          <div class="empty-cart-icon">🛍️</div>
          <p>Ihr Warenkorb ist leer</p>
          <button class="btn btn-primary" onclick="app.closeModal('cart-modal')">Jetzt shoppen</button>
        </div>
      `;
      return;
    }
    
    const cartItemsHTML = this.items.map(item => `
      <div class="cart-item" data-product-id="${item.id}">
        <div class="cart-item-image">
          <img src="${item.image}" alt="${item.name}">
        </div>
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <div class="cart-item-price">${utils.formatCurrency(item.price)}</div>
          <div class="cart-item-controls">
            <button class="quantity-btn decrease" data-product-id="${item.id}">-</button>
            <span class="quantity">${item.quantity}</span>
            <button class="quantity-btn increase" data-product-id="${item.id}">+</button>
            <button class="remove-btn" data-product-id="${item.id}">🗑️</button>
          </div>
        </div>
        <div class="cart-item-total">
          ${utils.formatCurrency(item.price * item.quantity)}
        </div>
      </div>
    `).join('');
    
    cartContent.innerHTML = `
      <div class="cart-items">
        ${cartItemsHTML}
      </div>
      <div class="cart-summary">
        <div class="cart-total">
          <strong>Gesamtsumme: ${utils.formatCurrency(this.total)}</strong>
        </div>
        <div class="cart-actions">
          <button class="btn btn-outline" onclick="app.closeModal('cart-modal')">Weiter shoppen</button>
          <button class="btn btn-primary">Zur Kasse</button>
        </div>
      </div>
    `;
    
    // Add event listeners for cart controls
    this.setupCartControls();
  }
  
  setupCartControls() {
    // Quantity controls
    utils.$$('.quantity-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const productId = e.target.dataset.productId;
        const isIncrease = e.target.classList.contains('increase');
        const item = this.items.find(item => item.id === productId);
        
        if (item) {
          const newQuantity = isIncrease ? item.quantity + 1 : item.quantity - 1;
          this.updateQuantity(productId, newQuantity);
        }
      });
    });
    
    // Remove buttons
    utils.$$('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const productId = e.target.dataset.productId;
        this.removeItem(productId);
      });
    });
  }
  
  saveToStorage() {
    utils.storage.set('cart', {
      items: this.items,
      total: this.total,
      count: this.count
    });
  }
  
  loadFromStorage() {
    const savedCart = utils.storage.get('cart');
    if (savedCart) {
      this.items = savedCart.items || [];
      this.total = savedCart.total || 0;
      this.count = savedCart.count || 0;
      this.updateUI();
    }
  }
  
  clear() {
    this.items = [];
    this.total = 0;
    this.count = 0;
    this.updateUI();
    this.saveToStorage();
  }
}

// =================== SEARCH CLASS ===================
class Search {
  constructor() {
    this.setupSearch();
  }
  
  setupSearch() {
    const searchInput = utils.$('#search-input');
    const searchSubmit = utils.$('#search-submit');
    const searchResults = utils.$('#search-results');
    
    if (searchInput) {
      // Setup debounced search
      const debouncedSearch = utils.debounce(this.performSearch.bind(this), 300);
      
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length >= 2) {
          debouncedSearch(query);
        } else {
          this.clearSearchResults();
        }
      });
      
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.performSearch(e.target.value.trim());
        }
      });
    }
    
    if (searchSubmit) {
      searchSubmit.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) {
          this.performSearch(query);
        }
      });
    }
    
    // Setup search suggestions
    this.setupSearchSuggestions();
  }
  
  setupSearchSuggestions() {
    utils.$$('.suggestion-tag').forEach(tag => {
      tag.addEventListener('click', (e) => {
        const query = e.target.textContent;
        utils.$('#search-input').value = query;
        this.performSearch(query);
      });
    });
  }
  
  async performSearch(query) {
    if (!query) return;
    
    try {
      // Filter products locally (in a real app, this would be an API call)
      const results = state.products.filter(product => 
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.description.toLowerCase().includes(query.toLowerCase()) ||
        product.category.toLowerCase().includes(query.toLowerCase())
      );
      
      this.displaySearchResults(results, query);
      
    } catch (error) {
      console.error('Search error:', error);
      app.notifications.show('Fehler bei der Suche', 'error');
    }
  }
  
  displaySearchResults(results, query) {
    const searchResults = utils.$('#search-results');
    const searchSuggestions = utils.$('#search-suggestions');
    
    if (!searchResults) return;
    
    // Hide suggestions, show results
    if (searchSuggestions) searchSuggestions.style.display = 'none';
    searchResults.style.display = 'block';
    
    if (results.length === 0) {
      searchResults.innerHTML = `
        <div class="no-search-results">
          <h4>Keine Ergebnisse für "${query}"</h4>
          <p>Versuchen Sie andere Suchbegriffe oder durchstöbern Sie unsere Kategorien.</p>
        </div>
      `;
      return;
    }
    
    const resultsHTML = results.map(product => `
      <div class="search-result-item" data-product-id="${product.id}">
        <div class="search-result-image">
          <img src="${product.image}" alt="${product.name}">
        </div>
        <div class="search-result-info">
          <h4>${product.name}</h4>
          <div class="search-result-category">${app.productManager.getCategoryDisplayName(product.category)}</div>
          <div class="search-result-price">${utils.formatCurrency(product.price)}</div>
        </div>
        <div class="search-result-actions">
          <button class="btn btn-primary btn-sm add-to-cart-btn" data-product-id="${product.id}">
            Warenkorb
          </button>
        </div>
      </div>
    `).join('');
    
    searchResults.innerHTML = `
      <div class="search-results-header">
        <h4>${results.length} Ergebnis${results.length !== 1 ? 'se' : ''} für "${query}"</h4>
        <button class="clear-search-btn">Zurück</button>
      </div>
      <div class="search-results-list">
        ${resultsHTML}
      </div>
    `;
    
    // Setup result interactions
    this.setupSearchResultInteractions();
  }
  
  setupSearchResultInteractions() {
    // Add to cart from search results
    utils.$$('.search-result-item .add-to-cart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const productId = e.target.dataset.productId;
        const product = state.products.find(p => p.id === productId);
        if (product) {
          app.cart.addItem(product);
        }
      });
    });
    
    // View product details from search
    utils.$$('.search-result-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('add-to-cart-btn')) {
          const productId = item.dataset.productId;
          const product = state.products.find(p => p.id === productId);
          if (product) {
            app.productManager.showProductDetails(product);
            app.closeModal('search-modal');
          }
        }
      });
    });
    
    // Clear search button
    const clearSearchBtn = utils.$('.clear-search-btn');
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        this.clearSearchResults();
      });
    }
  }
  
  clearSearchResults() {
    const searchResults = utils.$('#search-results');
    const searchSuggestions = utils.$('#search-suggestions');
    
    if (searchResults) searchResults.style.display = 'none';
    if (searchSuggestions) searchSuggestions.style.display = 'block';
    
    // Clear search input
    const searchInput = utils.$('#search-input');
    if (searchInput) searchInput.value = '';
  }
}

// =================== FORMS CLASS ===================
class Forms {
  constructor() {
    this.setupFormValidation();
  }
  
  setupFormValidation() {
    // Add real-time validation for inputs
    utils.$$('input[type="email"]').forEach(input => {
      input.addEventListener('blur', this.validateEmail);
    });
    
    utils.$$('input[required]').forEach(input => {
      input.addEventListener('blur', this.validateRequired);
    });
  }
  
  validateEmail(e) {
    const email = e.target.value;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (email && !emailRegex.test(email)) {
      e.target.setCustomValidity('Bitte geben Sie eine gültige E-Mail-Adresse ein');
    } else {
      e.target.setCustomValidity('');
    }
  }
  
  validateRequired(e) {
    if (!e.target.value.trim()) {
      e.target.setCustomValidity('Dieses Feld ist erforderlich');
    } else {
      e.target.setCustomValidity('');
    }
  }
  
  async handleNewsletterSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const email = form.querySelector('#newsletter-email').value;
    
    if (!email) {
      app.notifications.show('Bitte geben Sie Ihre E-Mail-Adresse ein', 'warning');
      return;
    }
    
    try {
      // Show loading state
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Wird angemeldet...';
      submitBtn.disabled = true;
      
      // Call n8n webhook
      await utils.n8nCall(CONFIG.api.n8n.endpoints.newsletter, {
        email,
        source: 'website',
        timestamp: new Date().toISOString()
      });
      
      // Success
      app.notifications.show('Erfolgreich für Newsletter angemeldet!', 'success');
      form.reset();
      
      // Reset button
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      
    } catch (error) {
      console.error('Newsletter signup error:', error);
      app.notifications.show('Fehler bei der Anmeldung. Bitte versuchen Sie es erneut.', 'error');
      
      // Reset button
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.textContent = 'Anmelden';
      submitBtn.disabled = false;
    }
  }
  
  async handleContactSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    const contactData = {
      name: form.querySelector('#contact-name').value,
      email: form.querySelector('#contact-email').value,
      subject: form.querySelector('#contact-subject').value,
      message: form.querySelector('#contact-message').value,
      timestamp: new Date().toISOString()
    };
    
    if (!contactData.name || !contactData.email || !contactData.message) {
      app.notifications.show('Bitte füllen Sie alle erforderlichen Felder aus', 'warning');
      return;
    }
    
    try {
      // Show loading state
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Wird gesendet...';
      submitBtn.disabled = true;
      
      // Call n8n webhook
      await utils.n8nCall(CONFIG.api.n8n.endpoints.contact, contactData);
      
      // Success
      app.notifications.show('Ihre Nachricht wurde erfolgreich gesendet!', 'success');
      form.reset();
      
      // Reset button
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      
    } catch (error) {
      console.error('Contact form error:', error);
      app.notifications.show('Fehler beim Senden der Nachricht. Bitte versuchen Sie es erneut.', 'error');
      
      // Reset button
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.textContent = 'Nachricht senden';
      submitBtn.disabled = false;
    }
  }
}

// =================== ANIMATIONS CLASS ===================
class Animations {
  constructor() {
    this.setupIntersectionObserver();
    this.setupScrollAnimations();
  }
  
  setupIntersectionObserver() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
    
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, observerOptions);
    
    // Observe elements that should animate
    utils.$$('.service-card, .product-card, .about-content, .featured-content').forEach(el => {
      this.observer.observe(el);
    });
  }
  
  setupScrollAnimations() {
    // Parallax effect for hero background
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;
      const heroBackground = utils.$('.hero-background');
      
      if (heroBackground) {
        heroBackground.style.transform = `translateY(${scrolled * 0.5}px)`;
      }
    });
  }
  
  animateOnScroll() {
    // Additional scroll-based animations can be added here
  }
}

// =================== NOTIFICATIONS CLASS ===================
class Notifications {
  constructor() {
    this.notifications = [];
    this.container = this.createNotificationContainer();
  }
  
  createNotificationContainer() {
    let container = utils.$('#notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      container.className = 'notification-container';
      document.body.appendChild(container);
    }
    return container;
  }
  
  show(message, type = 'info', duration = CONFIG.ui.notificationDuration) {
    const notification = this.createNotification(message, type);
    this.container.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // Auto remove
    setTimeout(() => {
      this.remove(notification);
    }, duration);
    
    return notification;
  }
  
  createNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${icons[type] || icons.info}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;
    
    // Add close functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      this.remove(notification);
    });
    
    return notification;
  }
  
  remove(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, CONFIG.ui.animationDuration);
  }
  
  clear() {
    utils.$$('.notification').forEach(notification => {
      this.remove(notification);
    });
  }
}

// =================== TELEGRAM INTEGRATION CLASS ===================
class TelegramIntegration {
  constructor() {
    this.widget = this.createWidget();
    this.setupTelegramEvents();
  }
  
  createWidget() {
    let widget = utils.$('#telegram-widget');
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'telegram-widget';
      widget.className = 'telegram-widget';
      widget.innerHTML = `
        <div class="telegram-header">
          <span>💬 DressForPleasure Style-Bot</span>
          <button class="telegram-close" id="telegram-close">&times;</button>
        </div>
        <div class="telegram-content">
          <p>Starten Sie eine Unterhaltung mit unserem KI-Styling-Assistenten!</p>
          <button class="btn btn-primary" id="start-telegram-chat">Chat starten</button>
        </div>
      `;
      document.body.appendChild(widget);
    }
    return widget;
  }
  
  setupTelegramEvents() {
    // Close widget
    const closeBtn = utils.$('#telegram-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hideWidget();
      });
    }
    
    // Start chat
    const startChatBtn = utils.$('#start-telegram-chat');
    if (startChatBtn) {
      startChatBtn.addEventListener('click', () => {
        this.openTelegramChat();
      });
    }
    
    // Show widget automatically after some time
    setTimeout(() => {
      this.showWidget();
    }, 30000); // Show after 30 seconds
  }
  
  showWidget() {
    this.widget.classList.add('show');
  }
  
  hideWidget() {
    this.widget.classList.remove('show');
  }
  
  openTelegramChat() {
    // Open Telegram bot in new window/tab
    window.open(CONFIG.api.telegram.chatUrl, '_blank');
    this.hideWidget();
    
    // Track interaction
    app.notifications.show('Telegram-Chat wird geöffnet...', 'info');
  }
}

// =================== INITIALIZE APPLICATION ===================
let app;

document.addEventListener('DOMContentLoaded', () => {
  app = new DressForPleasureApp();
});

// Export for global access
window.DressForPleasure = {
  app,
  utils,
  state,
  CONFIG
};