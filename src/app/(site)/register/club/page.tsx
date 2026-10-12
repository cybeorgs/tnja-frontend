import ClubRegistrationForm from "@/components/features/registers/ClubRegistrationForm";
import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Breadcrumb from "@/components/common/Breadcrumb";

export const metadata: Metadata = {
  title: "Club Registration | TNJA",
  description: "Register your club with Tamil Nadu Judo Association.",
};

export default function ClubRegisterPage() {
  return (
    <main className="bg-white min-h-screen pb-20">
      {/* Banner Section */}
      <section className="bg-[#F6F6F6] relative overflow-hidden h-[150px] flex items-center mb-16">
        <div className="max-w-[1200px] mx-auto w-full px-4 relative z-10">
          <h1 className="text-[32px] font-bold text-[#1A1A1A] mb-2 tracking-tight">
            New Registration
          </h1>
          
          <Breadcrumb 
            items={[
              { label: "Home", href: "/" },
              { label: "Registration", href: "/register" },
              { label: "Registration as Club Member" }
            ]} 
          />
        </div>

        {/* Judo Players Image Overlay */}
        {/* <div className="absolute right-0 top-0 h-full w-[450px] md:w-[600px] pointer-events-none select-none">
          <div className="relative h-full w-full">
            <Image 
              src="/homepage/banner/Judo.svg" 
              alt="Judo Players" 
              fill 
              className="object-contain object-right transform scale-110 translate-y-4"
              priority
            />
          </div>
        </div> */}
      </section>

      {/* Form Header Section */}
      <div className="max-w-[1200px] mx-auto px-4 mb-10">
        <div className="text-center">
          <p className="text-[#FF7400] font-bold uppercase tracking-[0.25em] text-[11px] mb-4">
            New Registration
          </p>
          <h2 className="text-4xl md:text-[42px] font-bold text-[#1A1A1A] tracking-tight leading-none">
            New Club Registration Form
          </h2>
        </div>
      </div>

      <ClubRegistrationForm />
    </main>
  );
}
