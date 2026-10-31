"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const emptyFilters = { subject: "", tutorId: "", mode: "" };

export default function CalendarPage() {
  const calendarRef = useRef(null);
  const rangeRef = useRef(null);
  const filtersRef = useRef(emptyFilters);

  const [filters, setFilters] = useState(emptyFilters);
  const [tutors, setTutors] = useState([]);
  const [events, setEvents] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

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
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-500">
            Home
          </Link>
        </div>

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
          datesSet={handleDatesSet}
          height="auto"
          nowIndicator={true}
        />
      </div>
    </div>
  );
}
