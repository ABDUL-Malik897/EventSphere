import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
    ArrowLeft,
    ShoppingCart,
    Trash2
} from "lucide-react";

import { useCart } from "../context/CartContext";
import CartLink from "../components/CartLink";

import api from "../services/api";
import { startRazorpayCheckoutForCart } from "../services/razorpayCheckout";

const formatCurrency = (amount, currency = "INR") => {
    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency,
            maximumFractionDigits: 0
        }).format(amount);
    } catch {
        return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
    }
};

const Cart = () => {
    const {
        items,
        ticketCount,
        loading,
        error,
        updateItem,
        removeItem,
        clearCart,
        refreshCart
    } = useCart();

    const [actionError, setActionError] = useState("");
    const [busyItem, setBusyItem] = useState("");
    const [clearing, setClearing] = useState(false);
    const navigate = useNavigate();
    const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);

    const subtotal = useMemo(() => {
        return items.reduce((total, item) => {
            return total +
                (Number(item.ticketType?.price) || 0) *
                item.quantity;
        }, 0);
    }, [items]);

    const currencies = [
        ...new Set(
            items.map((item) => item.event?.currency || "INR")
        )
    ];

    const hasMixedCurrencies = currencies.length > 1;

    const canCheckout =
        items.length > 0 &&
        !hasMixedCurrencies &&
        items.every((item) => !item.unavailable);

    const changeQuantity = async (itemId, quantity) => {
        setBusyItem(itemId);
        setActionError("");

        try {
            await updateItem(itemId, quantity);
        } catch (err) {
            setActionError(
                err.response?.data?.message ||
                "Could not update this quantity."
            );
        } finally {
            setBusyItem("");
        }
    };

    const handleRemove = async (itemId) => {
        setBusyItem(itemId);
        setActionError("");

        try {
            await removeItem(itemId);
        } catch (err) {
            setActionError(
                err.response?.data?.message ||
                "Could not remove this item."
            );
        } finally {
            setBusyItem("");
        }
    };

    const handleClear = async () => {
        if (!window.confirm("Remove all items from your cart?")) {
            return;
        }

        setClearing(true);
        setActionError("");

        try {
            await clearCart();
        } catch (err) {
            setActionError(
                err.response?.data?.message ||
                "Could not clear your cart."
            );
        } finally {
            setClearing(false);
        }
    };

    const handleCheckout = async () => {
        if (!canCheckout || checkoutSubmitting) return;

        setCheckoutSubmitting(true);
        setActionError("");

        let checkoutId = null;

        try {
            // STEP 1: Reserve every cart item together.
            const response = await api.post("/checkouts");

            checkoutId = response.data.checkout?._id;

            if (!checkoutId) {
                throw new Error(
                    "The server did not return a checkout reference."
                );
            }

            // Refresh the cart. It remains intact until successful payment.
            await refreshCart();

            // STEP 2: Open one Razorpay payment for the complete checkout.
            const paymentResult =
                await startRazorpayCheckoutForCart(checkoutId);

            // STEP 3: Navigate to the checkout status page.
            navigate(`/checkout/${checkoutId}`, {
                replace: true,
                state: {
                    notice: paymentResult.message || ""
                }
            });

        } catch (err) {
            console.error("Combined checkout error:", err);

            // If the reservation was created but Razorpay initialization
            // failed, preserve the checkout so the customer can retry.
            if (checkoutId) {
                navigate(`/checkout/${checkoutId}`, {
                    replace: true,
                    state: {
                        notice:
                            err.response?.data?.message ||
                            err.message ||
                            "Payment could not be initialized. You can retry from this checkout."
                    }
                });

                return;
            }

            setActionError(
                err.response?.data?.message ||
                err.message ||
                "Unable to start checkout. Please try again."
            );

        } finally {
            setCheckoutSubmitting(false);
        }
    };


    return (
        <div className="cart-page">
            <header className="cart-topbar">
                <Link to="/" className="brand">
                    <span className="brand-icon">
                        <ShoppingCart size={22} />
                    </span>

                    <span>
                        event<span className="brand-accent">sphere</span>
                    </span>
                </Link>

                <CartLink />
            </header>

            <main className="cart-container">
                <div className="cart-heading">
                    <div>
                        <span className="section-label">
                            YOUR SELECTED EXPERIENCES
                        </span>

                        <h1>Your cart</h1>

                        <p>
                            Review your tickets before proceeding to checkout.
                        </p>
                    </div>

                    <Link to="/" className="cart-continue-link">
                        <ArrowLeft size={16} />
                        Explore events
                    </Link>
                </div>

                {actionError && (
                    <div className="auth-error" role="alert">
                        {actionError}
                    </div>
                )}

                {loading ? (
                    <div className="cart-empty-state">
                        Loading your cart...
                    </div>
                ) : error ? (
                    <div className="cart-empty-state">
                        <h2>Unable to load your cart</h2>
                        <p>{error}</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="cart-empty-state">
                        <ShoppingCart size={42} />

                        <h2>Your cart is empty</h2>

                        <p>
                            Discover an event and add your preferred tickets.
                        </p>

                        <Link to="/" className="cart-primary-btn">
                            Explore events
                        </Link>
                    </div>
                ) : (
                    <div className="cart-layout">
                        <section className="cart-items-section">
                            <div className="cart-items-heading">
                                <h2>
                                    Cart items ({ticketCount} tickets)
                                </h2>

                                <button
                                    type="button"
                                    className="cart-clear-btn"
                                    onClick={handleClear}
                                    disabled={clearing}
                                >
                                    <Trash2 size={15} />
                                    {clearing ? "Clearing..." : "Clear cart"}
                                </button>
                            </div>

                            <div className="cart-items-list">
                                {items.map((item) => {
                                    const event = item.event;
                                    const ticket = item.ticketType;
                                    const price = Number(ticket?.price) || 0;

                                    const currency =
                                        event?.currency || "INR";

                                    const maxAvailable = Math.min(
                                        20,
                                        Math.max(0, item.availableQuantity || 0)
                                    );

                                    return (
                                        <article
                                            className="cart-item"
                                            key={item._id}
                                        >
                                            <img
                                                className="cart-item-image"
                                                src={
                                                    event?.imageUrl ||
                                                    "https://placehold.co/300x200?text=Event"
                                                }
                                                alt={event?.title || "Event"}
                                            />

                                            <div className="cart-item-content">
                                                <div className="cart-item-heading">
                                                    <div>
                                                        <span className="cart-item-category">
                                                            {ticket?.name || "Ticket unavailable"}
                                                        </span>

                                                        <h3>
                                                            {event?.title ||
                                                                "Event unavailable"}
                                                        </h3>

                                                        <p>
                                                            {event?.venue
                                                                ? `${event.venue}, ${event.city}`
                                                                : "Event details unavailable"}
                                                        </p>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className="cart-remove-btn"
                                                        onClick={() =>
                                                            handleRemove(item._id)
                                                        }
                                                        disabled={
                                                            busyItem === item._id
                                                        }
                                                        aria-label="Remove item"
                                                    >
                                                        <Trash2 size={17} />
                                                    </button>
                                                </div>

                                                {item.unavailable && (
                                                    <p className="cart-warning">
                                                        This ticket selection is
                                                        currently unavailable or
                                                        exceeds the remaining
                                                        inventory. Adjust the
                                                        quantity or remove it.
                                                    </p>
                                                )}

                                                <div className="cart-item-footer">
                                                    <div className="cart-quantity-control">
                                                        <label>
                                                            Quantity
                                                        </label>

                                                        <select
                                                            value={item.quantity}
                                                            disabled={
                                                                busyItem === item._id ||
                                                                maxAvailable < 1
                                                            }
                                                            onChange={(e) =>
                                                                changeQuantity(
                                                                    item._id,
                                                                    Number(e.target.value)
                                                                )
                                                            }
                                                        >
                                                            {item.quantity > maxAvailable && (
                                                                <option value={item.quantity}>
                                                                    {item.quantity} currently in cart
                                                                </option>
                                                            )}

                                                            {Array.from(
                                                                { length: maxAvailable },
                                                                (_, index) => index + 1
                                                            ).map((quantity) => (
                                                                <option
                                                                    key={quantity}
                                                                    value={quantity}
                                                                >
                                                                    {quantity}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div className="cart-item-price">
                                                        <span>
                                                            {formatCurrency(price, currency)}
                                                            {" "}each
                                                        </span>

                                                        <strong>
                                                            {formatCurrency(
                                                                price * item.quantity,
                                                                currency
                                                            )}
                                                        </strong>
                                                    </div>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>

                        {hasMixedCurrencies && (
                            <div className="cart-warning">
                                Your cart contains different currencies. Please purchase
                                events in the same currency together.
                            </div>
                        )}

                        <aside className="cart-summary">
                            <h2>Order summary</h2>

                            <div className="cart-summary-row">
                                <span>Total tickets</span>
                                <strong>{ticketCount}</strong>
                            </div>

                            <div className="cart-summary-row">
                                <span>Subtotal</span>
                                <strong>
                                    {formatCurrency(subtotal)}
                                </strong>
                            </div>

                            <div className="cart-summary-total">
                                <span>Estimated total</span>
                                <strong>
                                    {formatCurrency(subtotal)}
                                </strong>
                            </div>

                            <button
                                type="button"
                                className="cart-primary-btn"
                                disabled={!canCheckout || checkoutSubmitting}
                                onClick={handleCheckout}
                            >
                                {checkoutSubmitting
                                    ? "Preparing checkout..."
                                    : "Proceed to secure payment"}
                            </button>

                            <p className="cart-summary-note">
                                Adding tickets to your cart does not reserve
                                inventory. When you proceed to checkout, your
                                selected tickets are reserved for 10 minutes.
                                You can start another checkout without completing
                                an earlier pending checkout.
                            </p>
                        </aside>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Cart;
