"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your email...");
  // React runs effects twice in development; this makes sure the link is used only once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setMessage("This verification link is incomplete. Please use the link from your email.");
      return;
    }

    axios
      .post(`${apiUrl}/auth/verify-email`, { token })
      .then(() => {
        setStatus("success");
        setMessage("Your email is verified. You can now book tutoring sessions.");
      })
      .catch((error) => {
        const data = error.response?.data;
        if (data?.error === "EMAIL_ALREADY_VERIFIED") {
          setStatus("success");
          setMessage("Your email is already verified. You can book tutoring sessions.");
          return;
        }
        setStatus("error");
        setMessage(data?.message || "We could not verify your email. Please try again.");
      });
  }, []);

  const box =
    status === "success"
      ? "bg-green-50 border-green-200 text-green-700"
      : status === "error"
        ? "bg-red-50 border-red-200 text-red-700"
        : "bg-blue-50 border-blue-200 text-blue-700";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">Email verification</h2>
        <div role="status" className={`rounded-md p-4 border text-sm ${box}`}>
          {message}
        </div>
        {status !== "loading" && (
          <div className="text-center">
            <Link
              href={status === "success" ? "/calendar" : "/login"}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              {status === "success" ? "Go to the calendar" : "Back to sign in"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}