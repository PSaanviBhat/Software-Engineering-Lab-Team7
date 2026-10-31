"use client";

import { useState } from "react";
import Link from "next/link";
import axios from "axios";

export default function TutorProfilePage() {
  const [subjects, setSubjects] = useState("");
  const [bio, setBio] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    const subjectList = subjects
      .split(",")
      .map((subject) => subject.trim())
      .filter(Boolean);
    const token = localStorage.getItem("token");

    if (!token) {
      setErrorMessage("Please sign in before creating a tutor profile.");
      return;
    }

    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
      const response = await axios.put(
        `${apiUrl}/auth/tutor-profile`,
        { subjects: subjectList, bio },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      setMessage("Tutor profile saved successfully.");
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Unable to save your tutor profile."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <section className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-8 shadow-md">
        <h1 className="text-3xl font-bold text-gray-900">Become a Tutor</h1>
        <p className="mt-2 text-gray-600">
          Add the subjects you teach and a short introduction for learners.
        </p>

        {message && <p className="mt-4 rounded-md bg-green-50 p-3 text-green-700" role="status">{message}</p>}
        {errorMessage && <p className="mt-4 rounded-md bg-red-50 p-3 text-red-700" role="alert">{errorMessage}</p>}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="subjects" className="block text-sm font-medium text-gray-700">
              Subjects
            </label>
            <input
              id="subjects"
              value={subjects}
              onChange={(event) => setSubjects(event.target.value)}
              placeholder="DBMS, Operating Systems, Networks"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">Separate subjects with commas.</p>
          </div>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
              Short bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Tell learners what you can help them with."
              rows={5}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Saving..." : "Enable Tutor Profile"}
          </button>
        </form>

        <Link href="/" className="mt-5 inline-block text-sm font-medium text-blue-600 hover:text-blue-500">
          Back to home
        </Link>
      </section>
    </main>
  );
}
