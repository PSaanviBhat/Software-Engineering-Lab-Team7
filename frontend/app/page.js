import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-6 sm:p-12">
      <div className="max-w-2xl w-full text-center space-y-8 bg-white p-10 rounded-2xl shadow-sm border border-gray-200">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
          Peer-to-Peer Tutoring Scheduler
        </h1>
        <p className="text-lg text-gray-600">
          Connect with peer tutors, manage availability slots, and book one-on-one sessions seamlessly.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
          >
            Create an Account
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
          >
            Sign In
          </Link>
          <Link
            href="/tutor-profile"
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
          >
            Become a Tutor
          </Link>
        </div>
      </div>
    </main>
  );
}
