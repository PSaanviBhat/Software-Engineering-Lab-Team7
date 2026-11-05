"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const cancelErrors = {
  TOO_LATE_TO_CANCEL: "Bookings cannot be cancelled less than 2 hours before the start.",
  ALREADY_CANCELLED: "This booking is already cancelled.",
};
const rescheduleErrors = {
  SLOT_TAKEN: "Sorry, someone else just booked that slot. Please pick another one.",
  LEARNER_OVERLAP: "That slot overlaps another booking of yours.",
  OWN_SLOT: "You cannot book your own slot.",
  SLOT_IN_PAST: "That slot has already started.",
  TOO_LATE_TO_CANCEL: "Bookings cannot be changed less than 2 hours before the start.",
  ALREADY_CANCELLED: "This booking is already cancelled.",
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [cancellingId, setCancellingId] = useState(null);
  const [reschedulingId, setReschedulingId] = useState(null);
  const [options, setOptions] = useState([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [movingSlotId, setMovingSlotId] = useState(null);

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

  // Loads the free future slots for the same subject as the booking being moved.
  const loadOptions = async (booking) => {
    setOptions([]);
    setIsLoadingOptions(true);
    try {
      const response = await axios.get(`${apiUrl}/slots`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        params: { subject: booking.subject, from: new Date().toISOString() },
      });
      setOptions(
        response.data.filter(
          (slot) =>
            slot.status === "FREE" &&
            slot.subject === booking.subject &&
            slot.id !== booking.slotId
        )
      );
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Could not load available slots.");
      setReschedulingId(null);
    } finally {
      setIsLoadingOptions(false);
    }
  };

  const handleStartReschedule = (booking) => {
    if (reschedulingId === booking.bookingId) {
      setReschedulingId(null);
      return;
    }

    setMessage("");
    setErrorMessage("");
    setReschedulingId(booking.bookingId);
    loadOptions(booking);
  };

  const handleReschedule = async (booking, slot) => {
    setMessage("");
    setErrorMessage("");
    setMovingSlotId(slot.id);
    try {
      await axios.patch(
        `${apiUrl}/bookings/${booking.bookingId}`,
        { newSlotId: slot.id },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      setMessage("Booking moved to the new slot.");
      setReschedulingId(null);
      await loadBookings();
    } catch (error) {
      const code = error.response?.data?.error;
      setErrorMessage(
        rescheduleErrors[code] ||
          error.response?.data?.message ||
          "Could not reschedule this booking."
      );
      if (code === "SLOT_TAKEN") loadOptions(booking);
    } finally {
      setMovingSlotId(null);
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
              <li key={booking.bookingId} className="py-4">
                <div className="flex items-center justify-between gap-4">
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
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartReschedule(booking)}
                        className="py-2 px-4 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                      >
                        {reschedulingId === booking.bookingId ? "Close" : "Reschedule"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancel(booking)}
                        disabled={cancellingId === booking.bookingId}
                        className="py-2 px-4 text-sm font-medium rounded-md border border-red-300 text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                      >
                        {cancellingId === booking.bookingId ? "Cancelling..." : "Cancel"}
                      </button>
                    </div>
                  ) : (
                    <span className="shrink-0 text-sm text-gray-500">
                      {booking.status === "CANCELLED" ? "Cancelled" : "Past"}
                    </span>
                  )}
                </div>

                {reschedulingId === booking.bookingId && (
                  <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                    <p className="text-sm font-medium text-gray-700">
                      Pick a new {booking.subject} slot:
                    </p>
                    {isLoadingOptions ? (
                      <p className="mt-2 text-sm text-gray-600">Loading...</p>
                    ) : options.length === 0 ? (
                      <p className="mt-2 text-sm text-gray-600">
                        No free {booking.subject} slots are available right now.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {options.map((slot) => (
                          <li key={slot.id}>
                            <button
                              type="button"
                              onClick={() => handleReschedule(booking, slot)}
                              disabled={movingSlotId !== null}
                              className="w-full text-left py-2 px-3 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                            >
                              {movingSlotId === slot.id ? "Moving... " : ""}
                              {new Date(slot.start).toLocaleString()} –{" "}
                              {new Date(slot.end).toLocaleTimeString()} · {slot.tutorName} ·{" "}
                              {slot.mode === "ONLINE" ? "Online" : "In person"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
