
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState
} from "react";

import api from "../services/api";
import { useAuth } from "./AuthContext";

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
    const { user, loading: authLoading } = useAuth();

    const canUseCart = ["ATTENDEE", "ORGANIZER"].includes(user?.role);

    const [items, setItems] = useState([]);
    const [ticketCount, setTicketCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const refreshCart = useCallback(async () => {
        if (!canUseCart) {
            setItems([]);
            setTicketCount(0);
            setLoading(false);
            return null;
        }

        setLoading(true);

        try {
            const response = await api.get("/cart");

            const cartItems = response.data.cart?.items || [];

            setItems(cartItems);
            setTicketCount(
                response.data.ticketCount ??
                cartItems.reduce(
                    (total, item) => total + item.quantity,
                    0
                )
            );

            setError("");

            return response.data;
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to load your cart."
            );

            throw err;
        } finally {
            setLoading(false);
        }
    }, [canUseCart]);

    useEffect(() => {
        if (authLoading) return;

        if (canUseCart) {
            refreshCart().catch(() => {});
        } else {
            setItems([]);
            setTicketCount(0);
            setLoading(false);
            setError("");
        }
    }, [authLoading, canUseCart, refreshCart]);

    const addItem = useCallback(async (item) => {
        const response = await api.post("/cart/items", item);

        await refreshCart();

        return response.data;
    }, [refreshCart]);

    const updateItem = useCallback(async (itemId, quantity) => {
        const response = await api.patch(
            `/cart/items/${itemId}`,
            { quantity }
        );

        await refreshCart();

        return response.data;
    }, [refreshCart]);

    const removeItem = useCallback(async (itemId) => {
        const response = await api.delete(
            `/cart/items/${itemId}`
        );

        await refreshCart();

        return response.data;
    }, [refreshCart]);

    const clearCart = useCallback(async () => {
        const response = await api.delete("/cart");

        await refreshCart();

        return response.data;
    }, [refreshCart]);

    const value = useMemo(() => ({
        items,
        ticketCount,
        loading,
        error,
        refreshCart,
        addItem,
        updateItem,
        removeItem,
        clearCart
    }), [
        items,
        ticketCount,
        loading,
        error,
        refreshCart,
        addItem,
        updateItem,
        removeItem,
        clearCart
    ]);

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);

    if (!context) {
        throw new Error(
            "useCart must be used inside CartProvider"
        );
    }

    return context;
};
