import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="max-w-5xl w-full text-center flex flex-col items-center space-y-8">
        <div className="relative w-full max-w-3xl aspect-[4/3] mx-auto">
          <Image
            src="/not-found/not-found.svg"
            alt="Page Not Found"
            fill
            className="object-contain"
            priority
          />
        </div>
        
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
            Oops! Page Not Found
          </h1>
          <p className="text-lg text-slate-600 max-w-lg mx-auto">
            The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-white bg-[#FF7400] rounded-full hover:bg-[#e66a00] hover:shadow-lg hover:shadow-orange-200 transition-all duration-300 transform hover:-translate-y-0.5"
        >
          Return to Homepage
        </Link>
      </div>
    </div>
  );
}
