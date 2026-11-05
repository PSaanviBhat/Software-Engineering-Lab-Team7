"use client";

import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import axios from "axios";

export default function CalendarPage() {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadBookings() {
      const token = localStorage.getItem("token");
      if (!token) {
        if (isMounted) {
          setErrorMessage("Please sign in to view your bookings.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
        const response = await axios.get(`${apiUrl}/bookings/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isMounted) setBookings(response.data.bookings || []);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error.response?.data?.message || "Unable to load your bookings."
          );
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadBookings();
    return () => {
      isMounted = false;
    };
  }, []);

  const events = bookings.map((booking) => ({
    id: booking.bookingId,
    title: `Mine - ${booking.subject}`,
    start: booking.start,
    end: booking.end,
    extendedProps: booking,
  }));

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-8">
      <section className="mx-auto max-w-6xl rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Bookings</h1>
          <p className="mt-2 text-gray-600">
            Your confirmed tutoring sessions are shown in your local time.
          </p>
        </div>

        {errorMessage && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-red-700" role="alert">
            {errorMessage}
          </p>
        )}

        {isLoading ? (
          <p className="py-12 text-center text-gray-600" role="status">Loading bookings...</p>
        ) : !errorMessage ? (
          <div className="calendar-shell" aria-label="My bookings calendar">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
              }}
              height="auto"
              events={events}
              eventColor="#2563eb"
              eventTextColor="#ffffff"
              eventContent={(eventInfo) => (
                <span aria-label={`Mine booking: ${eventInfo.event.title}`}>
                  {eventInfo.event.title}
                </span>
              )}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}
