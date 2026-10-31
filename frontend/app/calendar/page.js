"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import axios from "axios";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  // Called by the calendar whenever the visible date range changes.
  const loadSlots = useCallback(async (info) => {
    const token = localStorage.getItem("token");
    if (!token) {
      setErrorMessage("Please sign in to see the calendar.");
      return;
    }

    try {
      const response = await axios.get(`${apiUrl}/slots`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          from: info.start.toISOString(),
          to: info.end.toISOString(),
        },
      });

      setErrorMessage("");
      setEvents(
        response.data.map((slot) => ({
          id: slot.id,
          title: `${slot.subject}${slot.tutorName ? " - " + slot.tutorName : ""}`,
          start: slot.start,
          end: slot.end,
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto bg-white text-gray-900 p-6 rounded-xl shadow-md border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-extrabold text-gray-900">Tutoring Calendar</h1>
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-500">
            Home
          </Link>
        </div>

        <div className="flex gap-4 text-sm text-gray-600 mb-4">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#16a34a" }} />
            Free
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#9ca3af" }} />
            Booked
          </span>
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
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          buttonText={{ today: "Today", month: "Month", week: "Week", day: "Day" }}
          events={events}
          datesSet={loadSlots}
          height="auto"
          nowIndicator={true}
        />
      </div>
    </div>
  );
}
