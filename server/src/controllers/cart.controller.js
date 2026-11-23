
import mongoose from "mongoose";
import { z } from "zod";

import Cart from "../models/Cart.js";
import Event from "../models/Event.js";

const addItemSchema = z.object({
    eventId: z.string().regex(/^[a-f\d]{24}$/i),
    ticketTypeId: z.string().regex(/^[a-f\d]{24}$/i),
    quantity: z.number().int().min(1).max(20).default(1)
}).strict();

const quantitySchema = z.object({
    quantity: z.number().int().min(1).max(20)
}).strict();

const getOrCreateCart = async (userId) => {
    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
        try {
            cart = await Cart.create({
                user: userId,
                items: []
            });
        } catch (error) {
            // Another request may have created this user's cart first.
            if (error.code !== 11000) throw error;
            cart = await Cart.findOne({ user: userId });
        }
    }

    return cart;
};

const findAvailableTicket = async (eventId, ticketTypeId) => {
    if (
        !mongoose.isValidObjectId(eventId) ||
        !mongoose.isValidObjectId(ticketTypeId)
    ) {
        return { error: "Invalid event or ticket type." };
    }

    const event = await Event.findOne({
        _id: eventId,
        status: "published",
        date: { $gt: new Date() }
    });

    if (!event) {
        return { error: "This event is unavailable or has already started." };
    }

    const ticket = event.ticketTypes.id(ticketTypeId);

    if (!ticket) {
        return { error: "This ticket category no longer exists." };
    }

    const available = Math.max(0, ticket.quantity - ticket.sold);

    if (available < 1) {
        return { error: "This ticket category is sold out." };
    }

    return { event, ticket, available };
};

// GET MY CART
export const getMyCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id })
            .populate({
                path: "items.event",
                select: "title slug date time venue city imageUrl currency status ticketTypes"
            });

        if (!cart) {
            return res.status(200).json({
                success: true,
                cart: { items: [] },
                ticketCount: 0
            });
        }

        const items = cart.items.map((item) => {
            const event = item.event;

            const ticket = event?.ticketTypes?.id(item.ticketTypeId);

            const availableQuantity = ticket
                ? Math.max(0, ticket.quantity - ticket.sold)
                : 0;

            const unavailable =
                !event ||
                event.status !== "published" ||
                new Date(event.date) <= new Date() ||
                !ticket ||
                availableQuantity < item.quantity;

            return {
                _id: item._id,
                event: event ? {
                    _id: event._id,
                    title: event.title,
                    slug: event.slug,
                    date: event.date,
                    time: event.time,
                    venue: event.venue,
                    city: event.city,
                    imageUrl: event.imageUrl,
                    currency: event.currency
                } : null,
                ticketType: ticket ? {
                    _id: ticket._id,
                    name: ticket.name,
                    description: ticket.description,
                    price: ticket.price
                } : null,
                quantity: item.quantity,
                availableQuantity,
                unavailable
            };
        });

        const ticketCount = items.reduce(
            (total, item) => total + item.quantity,
            0
        );

        return res.status(200).json({
            success: true,
            cart: {
                _id: cart._id,
                items
            },
            ticketCount
        });
    } catch (error) {
        console.error("Get cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not retrieve your cart."
        });
    }
};

// ADD ITEM OR INCREASE EXISTING QUANTITY
export const addCartItem = async (req, res) => {
    try {
        const result = addItemSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid cart item details.",
                errors: result.error.issues
            });
        }

        const { eventId, ticketTypeId, quantity } = result.data;

        const availability = await findAvailableTicket(
            eventId,
            ticketTypeId
        );

        if (availability.error) {
            return res.status(400).json({
                success: false,
                message: availability.error
            });
        }

        const cart = await getOrCreateCart(req.user._id);

        const existingItem = cart.items.find((item) =>
            item.event.toString() === eventId &&
            item.ticketTypeId.toString() === ticketTypeId
        );

        const newQuantity = existingItem
            ? existingItem.quantity + quantity
            : quantity;

        if (newQuantity > availability.available) {
            return res.status(400).json({
                success: false,
                message: `Only ${availability.available} ticket(s) are currently available.`
            });
        }

        if (existingItem) {
            existingItem.quantity = newQuantity;
        } else {
            cart.items.push({
                event: eventId,
                ticketTypeId,
                quantity
            });
        }

        await cart.save();

        return res.status(200).json({
            success: true,
            message: "Ticket added to your cart.",
            ticketCount: cart.items.reduce(
                (total, item) => total + item.quantity,
                0
            )
        });
    } catch (error) {
        console.error("Add cart item error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not add this ticket to your cart."
        });
    }
};

// UPDATE ITEM QUANTITY
export const updateCartItem = async (req, res) => {
    try {
        const result = quantitySchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be between 1 and 20."
            });
        }

        const cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found."
            });
        }

        const item = cart.items.id(req.params.itemId);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found."
            });
        }

        const availability = await findAvailableTicket(
            item.event.toString(),
            item.ticketTypeId.toString()
        );

        if (availability.error) {
            return res.status(400).json({
                success: false,
                message: availability.error
            });
        }

        if (result.data.quantity > availability.available) {
            return res.status(400).json({
                success: false,
                message: `Only ${availability.available} ticket(s) are currently available.`
            });
        }

        item.quantity = result.data.quantity;

        await cart.save();

        return res.status(200).json({
            success: true,
            message: "Cart quantity updated.",
            ticketCount: cart.items.reduce(
                (total, cartItem) => total + cartItem.quantity,
                0
            )
        });
    } catch (error) {
        console.error("Update cart item error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not update this cart item."
        });
    }
};

// REMOVE ONE ITEM
export const removeCartItem = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found."
            });
        }

        const item = cart.items.id(req.params.itemId);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found."
            });
        }

        item.deleteOne();
        await cart.save();

        return res.status(200).json({
            success: true,
            message: "Item removed from cart.",
            ticketCount: cart.items.reduce(
                (total, cartItem) => total + cartItem.quantity,
                0
            )
        });
    } catch (error) {
        console.error("Remove cart item error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not remove this item."
        });
    }
};

// CLEAR CART
export const clearCart = async (req, res) => {
    try {
        await Cart.findOneAndUpdate(
            { user: req.user._id },
            { $set: { items: [] } }
        );

        return res.status(200).json({
            success: true,
            message: "Cart cleared.",
            ticketCount: 0
        });
    } catch (error) {
        console.error("Clear cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not clear your cart."
        });
    }
};
