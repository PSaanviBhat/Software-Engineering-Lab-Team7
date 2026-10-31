"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const cancelErrors = {
  TOO_LATE_TO_CANCEL: "Bookings cannot be cancelled less than 2 hours before the start.",
  ALREADY_CANCELLED: "This booking is already cancelled.",
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [cancellingId, setCancellingId] = useState(null);

  const loadBookings = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setErrorMessage("Please sign in to see your bookings.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${apiUrl}/bookings/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBookings(response.data);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Could not load your bookings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleCancel = async (booking) => {
    if (!window.confirm(`Cancel your ${booking.subject} session?`)) return;

    setMessage("");
    setErrorMessage("");
    setCancellingId(booking.bookingId);
    try {
      await axios.delete(`${apiUrl}/bookings/${booking.bookingId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setMessage("Booking cancelled.");
      await loadBookings();
    } catch (error) {
      const code = error.response?.data?.error;
      setErrorMessage(
        cancelErrors[code] || error.response?.data?.message || "Could not cancel this booking."
      );
    } finally {
      setCancellingId(null);
    }
  };

  const canCancel = (booking) =>
    booking.status === "CONFIRMED" && new Date(booking.start) > new Date();

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <section className="max-w-3xl mx-auto rounded-xl border border-gray-200 bg-white p-6 text-gray-900 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-extrabold">My bookings</h1>
          <div className="flex gap-4">
            <Link href="/calendar" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              Calendar
            </Link>
            <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              Home
            </Link>
          </div>
        </div>

        {message && (
          <p className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700" role="status">
            {message}
          </p>
        )}
        {errorMessage && (
          <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
            {errorMessage}{" "}
            {!localStorage.getItem("token") && (
              <Link href="/login" className="underline font-medium">
                Sign in
              </Link>
            )}
          </p>
        )}

        {isLoading ? (
          <p className="text-sm text-gray-600">Loading...</p>
        ) : bookings.length === 0 ? (
          <p className="text-sm text-gray-600">
            You have no bookings yet. Pick a slot on the{" "}
            <Link href="/calendar" className="underline text-blue-600">
              calendar
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {bookings.map((booking) => (
              <li key={booking.bookingId} className="flex items-center justify-between gap-4 py-4">
                <div className={booking.status === "CANCELLED" ? "opacity-60" : ""}>
                  <p className="font-semibold">
                    {booking.subject} with {booking.tutorName}
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(booking.start).toLocaleString()} –{" "}
                    {new Date(booking.end).toLocaleTimeString()} ·{" "}
                    {booking.mode === "ONLINE" ? "Online" : "In person"}
                  </p>
                  {booking.note && <p className="text-sm text-gray-500">Note: {booking.note}</p>}
                </div>
                {canCancel(booking) ? (
                  <button
                    type="button"
                    onClick={() => handleCancel(booking)}
                    disabled={cancellingId === booking.bookingId}
                    className="shrink-0 py-2 px-4 text-sm font-medium rounded-md border border-red-300 text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                  >
                    {cancellingId === booking.bookingId ? "Cancelling..." : "Cancel"}
                  </button>
                ) : (
                  <span className="shrink-0 text-sm text-gray-500">
                    {booking.status === "CANCELLED" ? "Cancelled" : "Past"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
