"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const emptyFilters = { subject: "", tutorId: "", mode: "" };
const bookingErrors = {
  SLOT_TAKEN: "Sorry, someone else just booked this slot. Please pick another one.",
  LEARNER_OVERLAP: "You already have a booking that overlaps this time.",
  OWN_SLOT: "You cannot book your own slot.",
  SLOT_IN_PAST: "This slot has already started.",
};

export default function CalendarPage() {
  const calendarRef = useRef(null);
  const rangeRef = useRef(null);
  const filtersRef = useRef(emptyFilters);

  const [filters, setFilters] = useState(emptyFilters);
  const [tutors, setTutors] = useState([]);
  const [events, setEvents] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingError, setBookingError] = useState("");
  const [bookingNotice, setBookingNotice] = useState("");
  const [isBooking, setIsBooking] = useState(false);

  // Loads slots for the visible date range, applying the current filters.
  const fetchSlots = useCallback(async () => {
    const range = rangeRef.current;
    if (!range) return;

    const token = localStorage.getItem("token");
    if (!token) {
      setErrorMessage("Please sign in to see the calendar.");
      return;
    }

    const current = filtersRef.current;
    const params = {
      from: range.start.toISOString(),
      to: range.end.toISOString(),
    };
    if (current.subject.trim()) params.subject = current.subject.trim();
    if (current.tutorId) params.tutorId = current.tutorId;
    if (current.mode) params.mode = current.mode;

    try {
      const response = await axios.get(`${apiUrl}/slots`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setErrorMessage("");
      setEvents(
        response.data.map((slot) => ({
          id: slot.id,
          title: `${slot.subject}${slot.tutorName ? " - " + slot.tutorName : ""}`,
          start: slot.start,
          end: slot.end,
          extendedProps: {
            subject: slot.subject,
            tutorName: slot.tutorName,
            mode: slot.mode,
            status: slot.status,
          },
          backgroundColor: slot.status === "FREE" ? "#16a34a" : "#9ca3af",
          borderColor: slot.status === "FREE" ? "#16a34a" : "#9ca3af",
        }))
      );
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || "Could not load slots. Please try again."
      );
    }
  }, []);

  // Called by the calendar whenever the visible date range changes.
  const handleDatesSet = useCallback(
    (info) => {
      rangeRef.current = { start: info.start, end: info.end };
      fetchSlots();
    },
    [fetchSlots]
  );

  // Reload when a filter changes (short delay so typing does not spam the API).
  useEffect(() => {
    filtersRef.current = filters;
    const timer = setTimeout(fetchSlots, 300);
    return () => clearTimeout(timer);
  }, [filters, fetchSlots]);

  // Load the tutor list for the dropdown once.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    axios
      .get(`${apiUrl}/slots/tutors`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => setTutors(response.data))
      .catch(() => setTutors([]));
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleEventClick = (info) => {
    setBookingError("");
    setSelectedSlot({
      id: info.event.id,
      start: info.event.start,
      end: info.event.end,
      ...info.event.extendedProps,
    });
  };

  const handleBook = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setBookingError("Please sign in to book a slot.");
      return;
    }

    setIsBooking(true);
    setBookingError("");
    try {
      await axios.post(
        `${apiUrl}/bookings`,
        { slotId: selectedSlot.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedSlot(null);
      setBookingNotice("Slot booked! You can see it under My bookings.");
      fetchSlots();
    } catch (err) {
      const code = err.response?.data?.error;
      setBookingError(
        bookingErrors[code] || err.response?.data?.message || "Could not book this slot."
      );
      if (code === "SLOT_TAKEN") fetchSlots();
    } finally {
      setIsBooking(false);
    }
  };

  const handleJumpToDate = (e) => {
    if (e.target.value && calendarRef.current) {
      calendarRef.current.getApi().gotoDate(e.target.value);
    }
  };

  const hasFilters = filters.subject || filters.tutorId || filters.mode;
  const inputClass =
    "mt-1 block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500";

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto bg-white text-gray-900 p-6 rounded-xl shadow-md border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-extrabold text-gray-900">Tutoring Calendar</h1>
          <div className="flex gap-4">
            <Link href="/my-bookings" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              My bookings
            </Link>
            <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              Home
            </Link>
          </div>
        </div>

        {bookingNotice && (
          <div
            role="status"
            className="rounded-md bg-green-50 p-4 mb-4 border border-green-200 text-sm text-green-700"
          >
            {bookingNotice}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
              Subject
            </label>
            <input
              id="subject"
              name="subject"
              type="text"
              value={filters.subject}
              onChange={handleFilterChange}
              placeholder="e.g. Math"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="tutorId" className="block text-sm font-medium text-gray-700">
              Tutor
            </label>
            <select
              id="tutorId"
              name="tutorId"
              value={filters.tutorId}
              onChange={handleFilterChange}
              className={inputClass}
            >
              <option value="">All tutors</option>
              {tutors.map((tutor) => (
                <option key={tutor.id} value={tutor.id}>
                  {tutor.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="mode" className="block text-sm font-medium text-gray-700">
              Mode
            </label>
            <select
              id="mode"
              name="mode"
              value={filters.mode}
              onChange={handleFilterChange}
              className={inputClass}
            >
              <option value="">Online and in person</option>
              <option value="ONLINE">Online</option>
              <option value="IN_PERSON">In person</option>
            </select>
          </div>

          <div>
            <label htmlFor="jumpDate" className="block text-sm font-medium text-gray-700">
              Jump to date
            </label>
            <input
              id="jumpDate"
              type="date"
              onChange={handleJumpToDate}
              className={inputClass}
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setFilters(emptyFilters)}
              disabled={!hasFilters}
              className="w-full py-2 px-4 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#16a34a" }} />
              Free
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#9ca3af" }} />
              Booked
            </span>
          </div>
          <span>{events.length} slot(s) in this view</span>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-md bg-red-50 p-4 mb-4 border border-red-200 text-sm text-red-700"
          >
            {errorMessage}{" "}
            <Link href="/login" className="underline font-medium">
              Sign in
            </Link>
          </div>
        )}

        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          buttonText={{ today: "Today", month: "Month", week: "Week", day: "Day" }}
          events={events}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          height="auto"
          nowIndicator={true}
        />
      </div>

      {selectedSlot && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 text-gray-900 shadow-lg">
            <h2 className="text-xl font-bold">{selectedSlot.subject}</h2>
            <p className="mt-1 text-sm text-gray-600">
              {selectedSlot.tutorName} · {selectedSlot.mode === "ONLINE" ? "Online" : "In person"}
            </p>
            <p className="mt-3 text-sm">
              {selectedSlot.start.toLocaleString()} – {selectedSlot.end.toLocaleTimeString()}
            </p>

            {bookingError && (
              <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                {bookingError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="py-2 px-4 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
              >
                Close
              </button>
              {selectedSlot.status === "FREE" ? (
                <button
                  type="button"
                  onClick={handleBook}
                  disabled={isBooking}
                  className="py-2 px-4 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {isBooking ? "Booking..." : "Book"}
                </button>
              ) : (
                <span className="py-2 text-sm text-gray-500">Already booked</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
