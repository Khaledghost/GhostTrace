/**
 * GhostTrace - E-commerce Backend Example
 * 
 * This demonstrates GhostTrace integration with an e-commerce
 * backend featuring products, cart, checkout, and admin routes.
 */

require('dotenv').config();
const express = require('express');
const ghosttrace = require('ghosttrace');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Mock data stores
const products = new Map([
  [1, { id: 1, name: 'Laptop', price: 999.99, stock: 50 }],
  [2, { id: 2, name: 'Mouse', price: 29.99, stock: 200 }],
  [3, { id: 3, name: 'Keyboard', price: 79.99, stock: 150 }],
  [4, { id: 4, name: 'Monitor', price: 299.99, stock: 75 }],
]);

const carts = new Map();
const orders = new Map();
let orderIdCounter = 1000;

// Initialize GhostTrace
(async () => {
  await ghosttrace.init({
    adminEmail: process.env.GHOST_ADMIN_EMAIL || 'admin@ecommerce.com',
    adminPassword: process.env.GHOST_ADMIN_PASS || 'StrongPassword123!',
    dashboardPort: process.env.GHOST_PORT || 3001,
    blockThreshold: 70,
  });

  // Very high security for checkout (payment processing)
  app.use('/api/checkout', ghosttrace.secure({ 
    riskThreshold: 40, // Very strict
    rateLimit: 10,
  }));

  // High security for admin operations
  app.use('/api/admin', ghosttrace.secure({ 
    riskThreshold: 50,
    rateLimit: 30,
  }));

  // Standard security for cart operations
  app.use('/api/cart', ghosttrace.secure({ 
    riskThreshold: 65,
  }));

  // Monitor-only for product browsing
  app.use('/api/products', ghosttrace.secure({ 
    blockOnThreat: false,
  }));

  // === Product Routes (Monitor-Only) ===

  app.get('/api/products', (req, res) => {
    const { category, search, minPrice, maxPrice } = req.query;
    let productList = Array.from(products.values());

    if (search) {
      productList = productList.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (minPrice) {
      productList = productList.filter(p => p.price >= parseFloat(minPrice));
    }

    if (maxPrice) {
      productList = productList.filter(p => p.price <= parseFloat(maxPrice));
    }

    res.json({ products: productList, total: productList.length });
  });

  app.get('/api/products/:id', (req, res) => {
    const product = products.get(parseInt(req.params.id));
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product });
  });

  // === Cart Routes ===

  app.get('/api/cart/:userId', (req, res) => {
    const cart = carts.get(req.params.userId) || { items: [], total: 0 };
    res.json({ cart });
  });

  app.post('/api/cart/:userId/add', (req, res) => {
    const { productId, quantity } = req.body;
    const product = products.get(parseInt(productId));

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    let cart = carts.get(req.params.userId) || { items: [], total: 0 };
    
    const existingItem = cart.items.find(i => i.productId === productId);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ 
        productId, 
        name: product.name,
        price: product.price,
        quantity 
      });
    }

    cart.total = cart.items.reduce((sum, item) => 
      sum + (item.price * item.quantity), 0
    );

    carts.set(req.params.userId, cart);
    res.json({ success: true, cart });
  });

  app.delete('/api/cart/:userId/remove/:productId', (req, res) => {
    const cart = carts.get(req.params.userId);
    
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    cart.items = cart.items.filter(i => 
      i.productId !== parseInt(req.params.productId)
    );

    cart.total = cart.items.reduce((sum, item) => 
      sum + (item.price * item.quantity), 0
    );

    carts.set(req.params.userId, cart);
    res.json({ success: true, cart });
  });

  app.delete('/api/cart/:userId', (req, res) => {
    carts.delete(req.params.userId);
    res.json({ success: true });
  });

  // === Checkout Routes (High Security) ===

  app.post('/api/checkout', (req, res) => {
    const { userId, paymentMethod, shippingAddress } = req.body;

    if (!userId || !paymentMethod || !shippingAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const cart = carts.get(userId);
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Check stock and update inventory
    for (const item of cart.items) {
      const product = products.get(item.productId);
      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${product.name}` 
        });
      }
      product.stock -= item.quantity;
    }

    // Create order
    const order = {
      id: orderIdCounter++,
      userId,
      items: cart.items,
      total: cart.total,
      paymentMethod,
      shippingAddress,
      status: 'processing',
      createdAt: new Date(),
    };

    orders.set(order.id, order);
    carts.delete(userId);

    res.json({ 
      success: true, 
      orderId: order.id,
      message: 'Order placed successfully' 
    });
  });

  app.get('/api/orders/:orderId', (req, res) => {
    const order = orders.get(parseInt(req.params.orderId));
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order });
  });

  app.get('/api/orders/user/:userId', (req, res) => {
    const userOrders = Array.from(orders.values())
      .filter(o => o.userId === req.params.userId)
      .sort((a, b) => b.createdAt - a.createdAt);

    res.json({ orders: userOrders });
  });

  // === Admin Routes (High Security) ===

  app.post('/api/admin/products', (req, res) => {
    const { name, price, stock } = req.body;

    if (!name || price === undefined || stock === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = Math.max(...Array.from(products.keys())) + 1;
    const product = { id, name, price: parseFloat(price), stock: parseInt(stock) };
    
    products.set(id, product);
    res.json({ success: true, product });
  });

  app.put('/api/admin/products/:id', (req, res) => {
    const product = products.get(parseInt(req.params.id));
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    Object.assign(product, req.body);
    res.json({ success: true, product });
  });

  app.delete('/api/admin/products/:id', (req, res) => {
    const deleted = products.delete(parseInt(req.params.id));
    
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ success: true });
  });

  app.get('/api/admin/stats', (req, res) => {
    const totalRevenue = Array.from(orders.values())
      .reduce((sum, order) => sum + order.total, 0);

    res.json({
      stats: {
        totalProducts: products.size,
        totalOrders: orders.size,
        totalRevenue: totalRevenue.toFixed(2),
        activeCarts: carts.size,
      }
    });
  });

  // === Health Check ===

  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      products: products.size,
      orders: orders.size,
      activeCarts: carts.size,
    });
  });

  // Start application
  app.listen(PORT, () => {
    console.log(`\n  🚀 E-commerce Backend running on http://localhost:${PORT}`);
    console.log(`  👻 GhostTrace dashboard at http://localhost:${process.env.GHOST_PORT || 3001}`);
    console.log(`\n  🛒 Try these endpoints:`);
    console.log(`     GET  /api/products - Browse products`);
    console.log(`     POST /api/cart/:userId/add - Add to cart`);
    console.log(`     POST /api/checkout - Process order`);
    console.log(`     GET  /api/orders/:orderId - View order`);
    console.log(`     POST /api/admin/products - Add product (admin)\n`);
  });
})().catch(err => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
