"use client";

import { useCallback, useEffect, useState } from "react";
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

function formatSlotTime(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  // Tutor slots list state
  const [mySlots, setMySlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [listMessage, setListMessage] = useState("");
  const [listErrorMessage, setListErrorMessage] = useState("");

  // Edit slot state
  const [editingSlot, setEditingSlot] = useState(null);
  const [editSubject, setEditSubject] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editMode, setEditMode] = useState("ONLINE");
  const [editLink, setEditLink] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editErrorMessage, setEditErrorMessage] = useState("");

  const fetchMySlots = useCallback(async () => {
    if (typeof window === "undefined") return;
    const userRaw = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (!userRaw || !token) {
      setIsLoadingSlots(false);
      return;
    }

    let user;
    try {
      user = JSON.parse(userRaw);
    } catch {
      setIsLoadingSlots(false);
      return;
    }

    if (!user?.id) {
      setIsLoadingSlots(false);
      return;
    }

    setIsLoadingSlots(true);
    try {
      const response = await axios.get(`${apiUrl}/slots`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { tutorId: user.id },
      });
      setMySlots(response.data);
    } catch (err) {
      setListErrorMessage(
        err.response?.data?.message || "Failed to load your availability slots."
      );
    } finally {
      setIsLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    fetchMySlots();
  }, [fetchMySlots]);

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

      await fetchMySlots();
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

  const handleStartEdit = (slot) => {
    setEditingSlot(slot);
    setEditErrorMessage("");
    setEditSubject(slot.subject);

    const startD = new Date(slot.start);
    const endD = new Date(slot.end);

    const yyyy = startD.getFullYear();
    const mm = String(startD.getMonth() + 1).padStart(2, "0");
    const dd = String(startD.getDate()).padStart(2, "0");
    setEditDate(`${yyyy}-${mm}-${dd}`);

    const startH = String(startD.getHours()).padStart(2, "0");
    const startM = String(startD.getMinutes()).padStart(2, "0");
    setEditStartTime(`${startH}:${startM}`);

    const endH = String(endD.getHours()).padStart(2, "0");
    const endM = String(endD.getMinutes()).padStart(2, "0");
    setEditEndTime(`${endH}:${endM}`);

    setEditMode(slot.mode);
    setEditLink(slot.link || "");
  };

  const handleCancelEdit = () => {
    setEditingSlot(null);
    setEditErrorMessage("");
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditErrorMessage("");

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setEditErrorMessage("Please sign in before editing a slot.");
      return;
    }

    const startIso = toIsoWithOffset(editDate, editStartTime);
    const endIso = toIsoWithOffset(editDate, editEndTime);

    if (!startIso || !endIso) {
      setEditErrorMessage("Please enter a valid date and time range.");
      return;
    }

    const payload = {
      subject: editSubject.trim(),
      start: startIso,
      end: endIso,
      mode: editMode,
    };
    if (editMode === "ONLINE" && editLink.trim()) {
      payload.link = editLink.trim();
    }

    setIsSavingEdit(true);

    try {
      await axios.put(`${apiUrl}/slots/${editingSlot.id}`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      setListMessage("Slot updated successfully.");
      setEditingSlot(null);
      await fetchMySlots();
    } catch (err) {
      const code = err.response?.data?.error;
      if (code === "SLOT_OVERLAP") {
        setEditErrorMessage("You already have a slot that overlaps this time.");
      } else if (code === "SLOT_BOOKED") {
        setEditErrorMessage("Cannot edit a slot that has already been booked.");
      } else if (code === "SLOT_IN_PAST") {
        setEditErrorMessage("Slot must start in the future.");
      } else if (code === "INVALID_TIME_RANGE") {
        setEditErrorMessage("End time must be after start time.");
      } else if (code === "INVALID_INPUT") {
        setEditErrorMessage("Invalid slot details. Please check your inputs.");
      } else if (code === "FORBIDDEN") {
        setEditErrorMessage("You can only edit your own slots.");
      } else {
        setEditErrorMessage(
          err.response?.data?.message || "Failed to update slot. Please try again."
        );
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteSlot = async (slot) => {
    const isBooked = slot.status === "BOOKED";
    const confirmMessage = isBooked
      ? `This slot is currently booked. Deleting it will cancel the learner's booking and notify them by email. Are you sure you want to delete this slot?`
      : `Are you sure you want to delete your ${slot.subject} slot?`;

    if (!window.confirm(confirmMessage)) return;

    setListMessage("");
    setListErrorMessage("");

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setListErrorMessage("Please sign in before deleting a slot.");
      return;
    }

    try {
      await axios.delete(`${apiUrl}/slots/${slot.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setListMessage(
        isBooked
          ? "Slot deleted and learner booking cancelled."
          : "Slot deleted successfully."
      );
      await fetchMySlots();
    } catch (err) {
      setListErrorMessage(
        err.response?.data?.message || "Failed to delete slot. Please try again."
      );
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

        {/* Section: Tutor's slots list (view, edit, delete) */}
        <section
          className="mt-10 border-t border-gray-200 pt-8"
          aria-labelledby="my-slots-list-heading"
        >
          <div className="flex items-center justify-between">
            <h2
              id="my-slots-list-heading"
              className="text-lg font-semibold text-gray-900"
            >
              My Availability Slots
            </h2>
            <button
              type="button"
              onClick={fetchMySlots}
              disabled={isLoadingSlots}
              className="text-sm text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
            >
              {isLoadingSlots ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {listMessage && (
            <div
              role="status"
              className="mt-4 rounded-md bg-green-50 p-3 text-sm font-medium text-green-800 border border-green-200"
            >
              {listMessage}
            </div>
          )}

          {listErrorMessage && (
            <div
              role="alert"
              className="mt-4 rounded-md bg-red-50 p-3 text-sm font-medium text-red-800 border border-red-200"
            >
              {listErrorMessage}
            </div>
          )}

          {/* Edit Slot Form (Modal / Form View) */}
          {editingSlot && (
            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                Edit Slot ({editingSlot.subject})
              </h3>

              {editErrorMessage && (
                <div
                  role="alert"
                  className="mb-4 rounded-md bg-red-50 p-3 text-sm font-medium text-red-800 border border-red-200"
                >
                  {editErrorMessage}
                </div>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label
                    htmlFor="editSubject"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Subject
                  </label>
                  <input
                    id="editSubject"
                    type="text"
                    required
                    maxLength={100}
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="editDate"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Date
                    </label>
                    <input
                      id="editDate"
                      type="date"
                      required
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="editStartTime"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Start Time
                    </label>
                    <input
                      id="editStartTime"
                      type="time"
                      required
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="editEndTime"
                      className="block text-sm font-medium text-gray-700"
                    >
                      End Time
                    </label>
                    <input
                      id="editEndTime"
                      type="time"
                      required
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="editMode"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Mode
                  </label>
                  <select
                    id="editMode"
                    value={editMode}
                    onChange={(e) => setEditMode(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="ONLINE">Online</option>
                    <option value="IN_PERSON">In person</option>
                  </select>
                </div>

                {editMode === "ONLINE" && (
                  <div>
                    <label
                      htmlFor="editLink"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Meeting Link
                    </label>
                    <input
                      id="editLink"
                      type="url"
                      maxLength={500}
                      value={editLink}
                      onChange={(e) => setEditLink(e.target.value)}
                      placeholder="https://meet.google.com/xyz"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {isSavingEdit ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSavingEdit}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Slots List */}
          {isLoadingSlots ? (
            <p className="mt-4 text-sm text-gray-500">Loading your slots...</p>
          ) : mySlots.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              You haven&apos;t created any availability slots yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-gray-200 border-t border-b border-gray-200">
              {mySlots.map((slot) => {
                const isBooked = slot.status === "BOOKED";
                return (
                  <li
                    key={slot.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {slot.subject}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            isBooked
                              ? "bg-amber-100 text-amber-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {slot.status}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {slot.mode === "ONLINE" ? "Online" : "In person"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {formatSlotTime(slot.start)} &ndash;{" "}
                        {new Date(slot.end).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(slot)}
                        className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSlot(slot)}
                        className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <Link
            href="/"
            className="text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            &larr; Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
