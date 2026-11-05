"use client";

import { useState } from "react";
import Link from "next/link";
import axios from "axios";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

function toIsoWithOffset(dateStr, timeStr) {
  const formattedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  const d = new Date(`${dateStr}T${formattedTime}`);
  if (isNaN(d.getTime())) return null;
  const offsetMinutes = -d.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const mins = String(abs % 60).padStart(2, "0");
  return `${dateStr}T${formattedTime}${sign}${hours}:${mins}`;
}

export default function MySlotsPage() {
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [mode, setMode] = useState("ONLINE");
  const [link, setLink] = useState("");
  const [repeatWeeks, setRepeatWeeks] = useState(1);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setErrorMessage("Please sign in before creating availability slots.");
      return;
    }

    const startIso = toIsoWithOffset(date, startTime);
    const endIso = toIsoWithOffset(date, endTime);

    if (!startIso || !endIso) {
      setErrorMessage("Please enter a valid date and time range.");
      return;
    }

    const weeksNumber = parseInt(repeatWeeks, 10);
    if (isNaN(weeksNumber) || weeksNumber < 1 || weeksNumber > 8) {
      setErrorMessage("Repeat weekly must be between 1 and 8 weeks.");
      return;
    }

    const payload = {
      subject: subject.trim(),
      start: startIso,
      end: endIso,
      mode,
      repeatWeeks: weeksNumber,
    };

    if (mode === "ONLINE" && link.trim()) {
      payload.link = link.trim();
    }

    setIsLoading(true);

    try {
      const response = await axios.post(`${apiUrl}/slots`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const count = response.data?.count || 1;
      setSuccessMessage(`Created ${count} slot${count === 1 ? "" : "s"}`);

      // Reset form fields
      setSubject("");
      setDate("");
      setStartTime("");
      setEndTime("");
      setLink("");
      setRepeatWeeks(1);
    } catch (err) {
      const errorCode = err.response?.data?.error;
      const details = err.response?.data?.details;

      if (errorCode === "SLOT_OVERLAP") {
        const conflicts =
          details?.conflicts ||
          details?.conflictingStarts ||
          (Array.isArray(details) ? details : []);

        if (conflicts && conflicts.length > 0) {
          const formattedList = conflicts
            .map((iso) => new Date(iso).toLocaleString())
            .join(", ");
          setErrorMessage(
            `You already have a slot that overlaps this time: ${formattedList}`
          );
        } else {
          setErrorMessage("You already have a slot that overlaps this time.");
        }
      } else if (errorCode === "SLOT_IN_PAST") {
        setErrorMessage("Slot must start in the future.");
      } else if (errorCode === "INVALID_TIME_RANGE") {
        setErrorMessage("End time must be after start time.");
      } else if (errorCode === "INVALID_INPUT") {
        setErrorMessage("Invalid slot details. Please check your inputs.");
      } else if (errorCode === "FORBIDDEN") {
        setErrorMessage("Only tutors can create availability slots.");
      } else if (errorCode === "UNAUTHORIZED") {
        setErrorMessage("Your session has expired. Please sign in again.");
      } else {
        setErrorMessage(
          err.response?.data?.message || "Failed to create slot. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <section className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Create Availability Slots
          </h1>
          <Link
            href="/calendar"
            className="text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            View Calendar
          </Link>
        </div>

        {successMessage && (
          <div
            role="status"
            className="mt-4 rounded-md bg-green-50 p-4 text-sm font-medium text-green-800 border border-green-200"
          >
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-md bg-red-50 p-4 text-sm font-medium text-red-800 border border-red-200"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="subject"
              className="block text-sm font-medium text-gray-700"
            >
              Subject
            </label>
            <input
              id="subject"
              type="text"
              required
              maxLength={100}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Mathematics, Operating Systems"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="date"
                className="block text-sm font-medium text-gray-700"
              >
                Date
              </label>
              <input
                id="date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="startTime"
                className="block text-sm font-medium text-gray-700"
              >
                Start Time
              </label>
              <input
                id="startTime"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="endTime"
                className="block text-sm font-medium text-gray-700"
              >
                End Time
              </label>
              <input
                id="endTime"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="mode"
                className="block text-sm font-medium text-gray-700"
              >
                Mode
              </label>
              <select
                id="mode"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="ONLINE">Online</option>
                <option value="IN_PERSON">In person</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="repeatWeeks"
                className="block text-sm font-medium text-gray-700"
              >
                Repeat weekly for
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="repeatWeeks"
                  type="number"
                  min="1"
                  max="8"
                  required
                  value={repeatWeeks}
                  onChange={(e) => setRepeatWeeks(e.target.value)}
                  className="block w-24 rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <span className="text-sm text-gray-500">week(s) (1 to 8)</span>
              </div>
            </div>
          </div>

          {mode === "ONLINE" && (
            <div>
              <label
                htmlFor="link"
                className="block text-sm font-medium text-gray-700"
              >
                Meeting Link
              </label>
              <input
                id="link"
                type="url"
                maxLength={500}
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://meet.google.com/xyz or similar"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full inline-flex justify-center items-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Creating..." : "Create Slot(s)"}
            </button>
          </div>
        </form>

        {/* Room for PTS-26: Tutor's slots list (edit / delete) */}
        <section
          className="mt-10 border-t border-gray-200 pt-8"
          aria-labelledby="my-slots-list-heading"
        >
          <h2
            id="my-slots-list-heading"
            className="text-lg font-semibold text-gray-900"
          >
            My Availability Slots
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Slot management (view, edit, and cancel) will be available here.
          </p>
        </section>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <Link
            href="/"
            className="text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            ← Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
