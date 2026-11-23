import { useEffect, useMemo, useState } from "react";
import api from "./services/api";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { startRazorpayCheckout } from "./services/razorpayCheckout";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Heart,
  Laptop,
  MapPin,
  Menu,
  Music2,
  Palette,
  Search,
  Sparkles,
  Ticket,
  Trophy,
  Utensils,
  X,
} from "lucide-react";
import CartLink from "./components/CartLink";
import "./App.css";



const categories = [
  { name: "All Events", icon: Sparkles },
  { name: "Music", icon: Music2 },
  { name: "Technology", icon: Laptop },
  { name: "Food & Drink", icon: Utensils },
  { name: "Arts", icon: Palette },
  { name: "Sports", icon: Trophy },
];

function App() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("All Cities");
  const [activeCategory, setActiveCategory] = useState("All Events");
  const [favorites, setFavorites] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [bookingQuantity, setBookingQuantity] = useState(1);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState("");
  

  useEffect(() => {
      const controller = new AbortController();

      const fetchEvents = async () => {
          try {
              const response = await api.get("/events?limit=50", {
                  signal: controller.signal
              });

              const formattedEvents = response.data.data.map((event) => {
                  const eventDate = new Date(event.date);

                  return {
                      ...event,
                      id: event._id,
                      image: event.imageUrl,
                      date: eventDate.toLocaleString("en-US", {
                          month: "short"
                      }).toUpperCase(),
                      day: String(eventDate.getDate()).padStart(2, "0"),
                      year: eventDate.getFullYear()
                  };
              });

              setEvents(formattedEvents);
              setLoadError("");

          } catch (error) {
              if (
                  error.name === "CanceledError" ||
                  error.code === "ERR_CANCELED"
              ) {
                  return;
              }

              console.error("Event fetching failed:", error);

              setLoadError(
                  "Unable to load events. Please check your server connection."
              );

          } finally {
              if (!controller.signal.aborted) {
                  setLoading(false);
              }
          }
      };

      fetchEvents();

      return () => controller.abort();

  }, [reloadKey]);

  const visibleEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch =
        `${event.title} ${event.category} ${event.venue} ${event.city}`
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesCity =
        city === "All Cities" || event.city === city;

      const matchesCategory =
        activeCategory === "All Events" ||
        event.category === activeCategory;

      return matchesSearch && matchesCity && matchesCategory;
    });
  }, [search, city, activeCategory]);

  const featuredEvent = events[0];

  const toggleFavorite = (id) => {
    setFavorites((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  };

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  };

  const openEvent = (event) => {
      if (!event?._id) {
          console.error("Event is missing its MongoDB ID:", event);
          return;
      }

      navigate(`/events/${event._id}`);
  };

  const handleBooking = async () => {
      if (!user) {
          setSelectedEvent(null);
          navigate("/login");
          return;
      }

      if (!selectedTicket || availableTickets < 1) {
          setBookingError("This ticket category is unavailable.");
          return;
      }

      if (
          !Number.isInteger(bookingQuantity) ||
          bookingQuantity < 1 ||
          bookingQuantity > Math.min(10, availableTickets)
      ) {
          setBookingError("Please select a valid ticket quantity.");
          return;
      }

      setBookingSubmitting(true);
      setBookingError("");

      let bookingId = null;

      try {
          // STEP 1: Reserve tickets.
          const reservationResponse = await api.post(
              "/bookings",
              {
                  eventId: selectedEvent._id,
                  ticketTypeId: selectedTicketId,
                  quantity: Number(bookingQuantity)
              }
          );

          bookingId = reservationResponse.data.booking._id;

          // Close event details before opening Checkout.
          setSelectedEvent(null);

          // STEP 2: Create Razorpay order and open Checkout.
          const paymentResult = await startRazorpayCheckout(bookingId);

          // STEP 3: Redirect only after server verification.
          if (paymentResult.status === "confirmed") {
              navigate(`/payment/success/${bookingId}`);
              return;
          }

          if (paymentResult.status === "dismissed") {
              showNotice(
                  "Checkout closed. Your reservation remains pending until it expires."
              );
          } else {
              showNotice(
                  paymentResult.message ||
                  "Payment was not confirmed. Check your booking status."
              );
          }

          navigate("/my-bookings");

      } catch (error) {
          console.error("Booking or payment error:", error);

          if (bookingId) {
              // Reservation was created, but order initialization or
              // another payment step failed. Keep it visible in My Bookings.
              showNotice(
                  error.response?.data?.message ||
                  error.message ||
                  "Checkout could not be started. Check My Bookings."
              );

              setSelectedEvent(null);
              navigate("/my-bookings");

          } else {
              setBookingError(
                  error.response?.data?.message ||
                  "Unable to create reservation. Please try again."
              );
          }

      } finally {
          setBookingSubmitting(false);
      }
  };

  return (
    <div className="app">
      {/* NAVIGATION */}
      <header className="navbar">
        <a href="#" className="brand">
          <span className="brand-icon">
            <Ticket size={23} />
          </span>
          <span>event<span className="brand-accent">sphere</span></span>
        </a>

        <nav className={`nav-links ${menuOpen ? "nav-open" : ""}`}>
          <a href="#events" onClick={() => setMenuOpen(false)}>Explore events</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#organizers" onClick={() => setMenuOpen(false)}>For organizers</a>
        </nav>

        <div className="nav-actions">
            <CartLink />
            {user ? (
                <Link to="/dashboard" className="sign-in-btn">
                    My account
                </Link>
            ) : (
                <Link to="/login" className="sign-in-btn">
                    Sign in
                </Link>
            )}

            {user ? (
                <button
                    className="create-event-btn"
                    onClick={async () => {
                        try {
                            await logout();
                            showNotice("Logged out successfully.");
                        } catch {
                            showNotice("Unable to contact the server.");
                        }
                    }}
                >
                    Sign out
                </button>
            ) : (
                <Link to="/register" className="create-event-btn">
                    Join EventSphere <ArrowUpRight size={16} />
                </Link>
            )}
        </div>

        <button
          className="menu-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <main>
        {/* HERO */}
        <section className="hero">
          <div className="hero-content">
            <div className="eyebrow">
              <span className="live-dot"></span>
              DISCOVER EXPERIENCES NEAR YOU
            </div>

            <h1>
              Life happens.
              <br />
              <span>Be there.</span>
            </h1>

            <p className="hero-description">
              Discover extraordinary events, meet amazing people and
              create memories that stay with you forever.
            </p>

            <div className="hero-search">
              <div className="search-input-wrapper">
                <Search size={20} />
                <input
                  type="text"
                  placeholder="Search events, experiences..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="search-location">
                <MapPin size={19} />
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  aria-label="Select city"
                >
                  <option>All Cities</option>
                  <option>Lucknow</option>
                  <option>Delhi</option>
                  <option>Mumbai</option>
                </select>
              </div>

              <button
                className="search-button"
                onClick={() => document.getElementById("events")?.scrollIntoView({ behavior: "smooth" })}
              >
                Explore <ArrowRight size={17} />
              </button>
            </div>

            <div className="hero-meta">
              <div className="avatar-stack">
                <span>A</span>
                <span>R</span>
                <span>S</span>
                <span>+</span>
              </div>
              <p><strong>Discover your people.</strong> Find your next experience.</p>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-image">
              <img
                  src={
                      featuredEvent?.image ||
                      "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&q=90"
                  }
                  alt={featuredEvent?.title || "Featured event"}
              />
              <div className="hero-image-overlay"></div>

              <div className="floating-top">
                <Sparkles size={15} />
                YOUR NEXT GREAT EXPERIENCE
              </div>

              <div className="hero-event-info">
                  <span className="hero-event-date">
                      <CalendarDays size={15} />
                      {featuredEvent
                          ? `${featuredEvent.date} ${featuredEvent.day} · ${featuredEvent.city.toUpperCase()}`
                          : "DISCOVER UPCOMING EVENTS"}
                  </span>

                  <h3>
                      {featuredEvent?.title || "Discover your next experience"}
                  </h3>

                  <div className="hero-event-bottom">
                      <span>
                          {featuredEvent
                              ? `Starting at ₹${featuredEvent.price.toLocaleString("en-IN")}`
                              : "Explore exciting events"}
                      </span>

                      <button
                          onClick={() => featuredEvent && openEvent(featuredEvent)}
                          aria-label="View featured event"
                      >
                          <ArrowUpRight />
                      </button>
                  </div>
              </div>
            </div>
            <div className="hero-decoration decoration-one"></div>
            <div className="hero-decoration decoration-two"></div>
          </div>
        </section>

        {/* CATEGORIES */}
        <section className="category-section">
          <div className="section-heading">
            <div>
              <span className="section-label">FIND YOUR INTEREST</span>
              <h2>Explore by category</h2>
            </div>
          </div>

          <div className="category-list">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.name}
                  className={`category-chip ${
                    activeCategory === category.name ? "active" : ""
                  }`}
                  onClick={() => setActiveCategory(category.name)}
                >
                  <Icon size={19} />
                  {category.name}
                </button>
              );
            })}
          </div>
        </section>

        {/* EVENTS */}
        <section className="events-section" id="events">
          <div className="section-heading events-heading">
            <div>
              <span className="section-label">HANDPICKED FOR YOU</span>
              <h2>Discover amazing events<span className="heading-dot">.</span></h2>
              <p className="section-description">
                From unforgettable concerts to inspiring experiences.
              </p>
            </div>

            <button
              className="view-all-btn"
              onClick={() => {
                setSearch("");
                setCity("All Cities");
                setActiveCategory("All Events");
              }}
            >
              Clear filters <ArrowRight size={17} />
            </button>
          </div>

          <div className="event-grid">
            {loading ? (
                <div className="empty-state">
                    <p>Discovering amazing events...</p>
                </div>
            ) : loadError ? (
                <div className="empty-state">
                    <h3>Unable to load events</h3>
                    <p>{loadError}</p>

                    <button
                        onClick={() => {
                            setLoading(true);
                            setReloadKey((previous) => previous + 1);
                        }}
                    >
                        Try again
                    </button>
                </div>
            ) : visibleEvents.length > 0 ? (
              visibleEvents.map((event) => (
                <article className="event-card" key={event.id}>
                  <div
                    className="event-image"
                    onClick={() => openEvent(event)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") openEvent(event);
                    }}
                  >
                    <img src={event.image} alt={event.title} loading="lazy" />
                    <span className="event-tag">{event.tag}</span>

                    <button
                      className={`favorite-btn ${
                        favorites.includes(event.id) ? "favorited" : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(event.id);
                      }}
                      aria-label="Add event to favorites"
                    >
                      <Heart
                        size={19}
                        fill={favorites.includes(event.id) ? "currentColor" : "none"}
                      />
                    </button>

                    <div className="event-date-badge">
                      <span>{event.date}</span>
                      <strong>{event.day}</strong>
                    </div>
                  </div>

                  <div className="event-details">
                    <span className="event-category">{event.category}</span>
                    <h3>
                        <button
                            type="button"
                            className="event-title-link"
                            onClick={() => openEvent(event)}
                        >
                            {event.title}
                        </button>
                    </h3>

                    <div className="event-info">
                      <span><MapPin size={15} /> {event.venue}</span>
                      <span><Clock3 size={15} /> {event.time}</span>
                    </div>

                    <div className="event-card-footer">
                      <div className="event-price">
                        <span>Starting from</span>
                        <strong>₹{event.price.toLocaleString("en-IN")}</strong>
                      </div>
                      <button
                          className="event-view-btn"
                          onClick={(e) => {
                              e.stopPropagation();
                              openEvent(event);
                          }}
                          aria-label={`View ${event.title}`}
                      >
                          <ArrowUpRight size={19} />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <Search size={35} />
                <h3>No events found</h3>
                <p>Try another search or change your filters.</p>
                <button
                  onClick={() => {
                    setSearch("");
                    setCity("All Cities");
                    setActiveCategory("All Events");
                  }}
                >
                  Show all events
                </button>
              </div>
            )}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="how-section" id="how-it-works">
          <div className="how-heading">
            <span className="section-label">SIMPLE BY DESIGN</span>
            <h2>Your next experience is<br />just three steps away.</h2>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <span className="step-number">01</span>
              <div className="step-icon"><Search size={24} /></div>
              <h3>Discover</h3>
              <p>Find experiences that match your interests and your city.</p>
            </div>

            <div className="step-card">
              <span className="step-number">02</span>
              <div className="step-icon"><Ticket size={24} /></div>
              <h3>Book your spot</h3>
              <p>Choose your ticket and secure your place at the event.</p>
            </div>

            <div className="step-card">
              <span className="step-number">03</span>
              <div className="step-icon"><CheckCircle2 size={24} /></div>
              <h3>Show up & enjoy</h3>
              <p>Get your digital pass and make unforgettable memories.</p>
            </div>
          </div>
        </section>

        {/* ORGANIZER CTA */}
        <section className="organizer-section" id="organizers">
          <div className="organizer-content">
            <span className="section-label">HAVE SOMETHING TO SHARE?</span>
            <h2>Great events deserve<br />great audiences.</h2>
            <p>
              Bring your vision to life. Create an event, connect with your
              audience and manage everything in one place.
            </p>
            <button
              className="organizer-btn"
              onClick={() => showNotice("Organizer registration is coming in our next module.")}
            >
              Become an organizer <ArrowUpRight size={18} />
            </button>
          </div>
          <div className="organizer-art">
            <div className="organizer-ticket">
              <Ticket size={42} />
              <span>MAKE IT</span>
              <strong>HAPPEN.</strong>
              <small>YOUR EVENT. YOUR AUDIENCE.</small>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <a href="#" className="brand footer-brand">
          <span className="brand-icon"><Ticket size={22} /></span>
          <span>event<span className="brand-accent">sphere</span></span>
        </a>

        <p>Discover experiences. Create memories.</p>

        <span className="copyright">
          © 2026 EventSphere. Made for moments that matter.
        </span>
      </footer>

      {/* EVENT DETAILS MODAL */}
      {selectedEvent && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedEvent(null)}
          role="presentation"
        >
          <div
            className="event-modal"
            role="dialog"
            aria-modal="true"
            aria-label={selectedEvent.title}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setSelectedEvent(null)}
              aria-label="Close event details"
            >
              <X />
            </button>

            <img src={selectedEvent.image} alt={selectedEvent.title} />

            <div className="modal-body">
                <span className="event-category">
                    {selectedEvent.category}
                </span>

                <h2>{selectedEvent.title}</h2>

                <p>{selectedEvent.description}</p>

                <div className="modal-info">
                    <span>
                        <CalendarDays />
                        {selectedEvent.date} {selectedEvent.day}, {selectedEvent.year}
                    </span>

                    <span>
                        <Clock3 />
                        {selectedEvent.time}
                    </span>

                    <span>
                        <MapPin />
                        {selectedEvent.venue}, {selectedEvent.city}
                    </span>
                </div>

                <div className="booking-ticket-section">
                    <h3>Select your tickets</h3>

                    {selectedEvent.ticketTypes?.length > 0 ? (
                        <>
                            <div className="booking-ticket-options">
                                {selectedEvent.ticketTypes.map((ticket) => {
                                    const remaining = Math.max(
                                        0,
                                        ticket.quantity - ticket.sold
                                    );

                                    return (
                                        <button
                                            type="button"
                                            key={ticket._id}
                                            className={`booking-ticket-option ${
                                                selectedTicketId === ticket._id
                                                    ? "selected"
                                                    : ""
                                            }`}
                                            disabled={remaining === 0}
                                            onClick={() => {
                                                setSelectedTicketId(ticket._id);
                                                setBookingQuantity(1);
                                                setBookingError("");
                                            }}
                                        >
                                            <span>
                                                <strong>{ticket.name}</strong>

                                                <small>
                                                    {ticket.description || "Event admission"}
                                                </small>

                                                <small>
                                                    {remaining} tickets available
                                                </small>
                                            </span>

                                            <strong>
                                                ₹{ticket.price.toLocaleString("en-IN")}
                                            </strong>
                                        </button>
                                    );
                                })}
                            </div>

                            {selectedTicket && availableTickets > 0 && (
                                <div className="booking-quantity-row">
                                    <label htmlFor="bookingQuantity">
                                        Number of tickets
                                    </label>

                                    <select
                                        id="bookingQuantity"
                                        value={bookingQuantity}
                                        onChange={(e) =>
                                            setBookingQuantity(Number(e.target.value))
                                        }
                                    >
                                        {Array.from(
                                            { length: Math.min(10, availableTickets) },
                                            (_, index) => index + 1
                                        ).map((quantity) => (
                                            <option key={quantity} value={quantity}>
                                                {quantity}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {selectedTicket && (
                                <div className="booking-price-summary">
                                    <span>Estimated reservation total</span>

                                    <strong>
                                        ₹{(
                                            selectedTicket.price * bookingQuantity
                                        ).toLocaleString("en-IN")}
                                    </strong>
                                </div>
                            )}
                        </>
                    ) : (
                        <p>No ticket categories are available for this event.</p>
                    )}

                    {bookingError && (
                        <div className="auth-error" role="alert">
                            {bookingError}
                        </div>
                    )}

                    <div className="booking-notice">
                        Reservations are held for 10 minutes. Payment is not
                        collected in this development version.
                    </div>
                </div>

                <div className="modal-footer">
                    <div>
                        <span>Selected ticket</span>

                        <strong>
                            {selectedTicket
                                ? `₹${selectedTicket.price.toLocaleString("en-IN")}`
                                : "Unavailable"}
                        </strong>
                    </div>

                    <button
                        className="search-button"
                        disabled={
                            bookingSubmitting ||
                            !selectedTicket ||
                            availableTickets < 1
                        }
                        onClick={handleBooking}
                    >
                        {bookingSubmitting
                            ? "Reserving..."
                            : user
                                ? "Reserve tickets"
                                : "Sign in to book"}

                        <ArrowRight size={17} />
                    </button>
                </div>
            </div>

          </div>
        </div>
      )}

      {/* NOTIFICATION */}
      {notice && (
        <div className="toast">
          <CheckCircle2 size={19} />
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss notification">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
