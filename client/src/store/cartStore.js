import { create } from 'zustand';

const useCartStore = create((set, get) => ({
  // State
  items:        [],
  restaurantId: null,
  restaurantName: '',

  // Get total items count
  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  // Get subtotal
  subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

  /**
   * Add item to cart.
   * Returns { conflict: true, pendingItem } if restaurant mismatch,
   * so the UI can show a confirmation modal.
   */
  addItem: (item, restaurantId, restaurantName) => {
    const state = get();

    // Cross-restaurant conflict
    if (state.restaurantId && state.restaurantId !== restaurantId && state.items.length > 0) {
      return { conflict: true, pendingItem: { item, restaurantId, restaurantName } };
    }

    const existing = state.items.find((i) => i._id === item._id);
    if (existing) {
      set({
        items: state.items.map((i) =>
          i._id === item._id ? { ...i, quantity: i.quantity + 1 } : i
        ),
      });
    } else {
      set({
        items: [...state.items, { ...item, quantity: 1 }],
        restaurantId,
        restaurantName,
      });
    }
    return { conflict: false };
  },

  // Confirm replacing cart (cross-restaurant)
  replaceCart: (item, restaurantId, restaurantName) => {
    set({
      items: [{ ...item, quantity: 1 }],
      restaurantId,
      restaurantName,
    });
  },

  // Increase quantity
  increment: (itemId) => {
    set({
      items: get().items.map((i) =>
        i._id === itemId ? { ...i, quantity: i.quantity + 1 } : i
      ),
    });
  },

  // Decrease quantity (remove if 0)
  decrement: (itemId) => {
    const updated = get().items
      .map((i) => (i._id === itemId ? { ...i, quantity: i.quantity - 1 } : i))
      .filter((i) => i.quantity > 0);
    set({
      items: updated,
      restaurantId: updated.length === 0 ? null : get().restaurantId,
      restaurantName: updated.length === 0 ? '' : get().restaurantName,
    });
  },

  // Remove item entirely
  removeItem: (itemId) => {
    const updated = get().items.filter((i) => i._id !== itemId);
    set({
      items: updated,
      restaurantId: updated.length === 0 ? null : get().restaurantId,
      restaurantName: updated.length === 0 ? '' : get().restaurantName,
    });
  },

  // Clear cart
  clearCart: () => set({ items: [], restaurantId: null, restaurantName: '' }),
}));

export default useCartStore;
