
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const CartLink = () => {
    const { user } = useAuth();
    const { ticketCount } = useCart();

    // Admin accounts do not use the customer cart.
    if (user?.role === "ADMIN") return null;

    return (
        <Link
            to={user ? "/cart" : "/login"}
            state={!user ? { from: "/cart" } : undefined}
            className="cart-nav-link"
            aria-label={`Shopping cart, ${ticketCount} tickets`}
        >
            <ShoppingCart size={19} />

            <span>Cart</span>

            {ticketCount > 0 && (
                <span className="cart-count-badge">
                    {ticketCount > 99 ? "99+" : ticketCount}
                </span>
            )}
        </Link>
    );
};

export default CartLink;
