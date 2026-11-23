
const PENDING_CART_KEY = "eventsphere_pending_cart_item";

export const savePendingCartItem = (item) => {
    try {
        sessionStorage.setItem(
            PENDING_CART_KEY,
            JSON.stringify(item)
        );
    } catch (error) {
        console.error("Could not save pending cart item:", error);
    }
};

export const readPendingCartItem = () => {
    try {
        const raw = sessionStorage.getItem(PENDING_CART_KEY);

        if (!raw) return null;

        const item = JSON.parse(raw);

        if (
            typeof item.eventId !== "string" ||
            typeof item.ticketTypeId !== "string" ||
            !Number.isInteger(item.quantity) ||
            item.quantity < 1
        ) {
            return null;
        }

        return item;
    } catch {
        return null;
    }
};

export const clearPendingCartItem = () => {
    try {
        sessionStorage.removeItem(PENDING_CART_KEY);
    } catch (error) {
        console.error("Could not clear pending cart item:", error);
    }
};
